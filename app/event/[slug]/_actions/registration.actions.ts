"use server";

import { randomInt } from "node:crypto";
import { headers } from "next/headers";
import type { Prisma } from "@/app/generated/prisma/client";
import prisma from "@/app/lib/prisma";
import { getTicketingEnv } from "@/lib/env";
import { hitRateLimit } from "@/lib/server/rate-limit";
import { getClientIp, rateLimitKey } from "@/lib/server/request-keys";
import { sendTicketEmail } from "@/lib/server/ticket-email";
import { HOLDING_STATUSES } from "@/lib/ticketing/capacity";
import { parseFormSchema, validateAnswers } from "@/lib/ticketing/form-schema";
import { decideRegistration, emailKindFor, isUniqueViolation } from "@/lib/ticketing/registration";
import { createWithUniqueCode, generateShortCode } from "@/lib/ticketing/short-code";

export interface RegistrationInput {
  name: string;
  email: string;
  fields: Record<string, unknown>;
}

export type RegisterResult =
  | { success: true }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_IP = 10;
const MAX_PER_EMAIL = 3;

const GENERIC_ERROR: RegisterResult = { success: false, error: "No se pudo completar el registro. Inténtalo de nuevo." };
const RATE_LIMITED: RegisterResult = {
  success: false,
  error: "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.",
};
const REFUSALS = {
  closed: "Las inscripciones para este evento están cerradas.",
  full: "Este evento ya no tiene lugares disponibles.",
} as const;

function isInput(value: unknown): value is RegistrationInput {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.name === "string" &&
    typeof v.email === "string" &&
    typeof v.fields === "object" &&
    v.fields !== null &&
    !Array.isArray(v.fields)
  );
}

/**
 * Public registration. One ticket per (event, email). A repeated email never
 * creates a second ticket: the existing link is re-sent and the response is the
 * same as for a new registration, so the form cannot be used to probe emails.
 * (When the event is closed or full a NEW email is refused while a known one
 * still succeeds; that small signal is accepted for the sake of link recovery.)
 */
export async function registerForEvent(slug: string, input: unknown): Promise<RegisterResult> {
  try {
    if (typeof slug !== "string" || !isInput(input)) return GENERIC_ERROR;
    getTicketingEnv(); // Fail before creating anything we could not link to.

    const ip = getClientIp(await headers());
    if (!(await hitRateLimit(rateLimitKey("register:ip", ip), MAX_PER_IP, WINDOW_MS)).allowed) return RATE_LIMITED;

    const event = await prisma.event.findFirst({ where: { slug, isCancelled: false } });
    if (!event) return { success: false, error: "Evento no encontrado." };

    const schema = parseFormSchema(event.formSchema) ?? { version: 1 as const, fields: [] };
    const validated = validateAnswers(schema, input);
    if ("errors" in validated) {
      return { success: false, error: "Revisa los campos marcados.", fieldErrors: { ...validated.errors } };
    }
    const { name, email, answers } = validated.data;

    const emailKey = rateLimitKey("register:email", `${event.id}:${email}`);
    if (!(await hitRateLimit(emailKey, MAX_PER_EMAIL, WINDOW_MS)).allowed) return RATE_LIMITED;

    // Whole transaction is retried only on a short-code collision (P2002): the
    // event row lock rules out an email race, so any P2002 here is the code.
    const outcome = await createWithUniqueCode(
      () => generateShortCode(randomInt),
      (code) =>
        prisma.$transaction(async (tx) => {
          // Serialize registrations (and receipt uploads) per event so capacity cannot be oversold.
          await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${event.id} FOR UPDATE`;
          const current = await tx.event.findUniqueOrThrow({ where: { id: event.id } });
          const existing = await tx.ticket.findUnique({
            where: { eventId_email: { eventId: event.id, email } },
          });
          const held = existing
            ? 0
            : await tx.ticket.count({ where: { eventId: event.id, status: { in: [...HOLDING_STATUSES] } } });

          const decision = decideRegistration({ event: current, held, existing });
          if (decision.kind === "refused") return decision;
          if (decision.kind === "duplicate") return { kind: "duplicate" as const, ticket: existing!, event: current };

          const ticket = await tx.ticket.create({
            data: {
              eventId: event.id,
              code,
              name,
              email,
              answers: answers as unknown as Prisma.InputJsonValue,
              status: decision.status,
              paymentMethod: decision.method,
              amountCents: current.priceCents,
              currency: current.currency,
            },
          });
          return { kind: "created" as const, ticket, event: current };
        }),
      isUniqueViolation,
    );

    if (outcome.kind === "refused") return { success: false, error: REFUSALS[outcome.reason] };

    // Best effort and after commit: a provider outage must not undo the registration.
    const emailKind = emailKindFor(outcome.ticket.status);
    if (emailKind) {
      await sendTicketEmail(
        emailKind,
        { id: outcome.ticket.id, name: outcome.ticket.name, email, code: outcome.ticket.code },
        outcome.event,
      );
    }
    return { success: true };
  } catch (error) {
    const code = typeof error === "object" && error !== null ? (error as { code?: unknown }).code : undefined;
    console.error("registerForEvent failed:", error instanceof Error ? error.name : "unknown", code ?? "");
    return GENERIC_ERROR;
  }
}
