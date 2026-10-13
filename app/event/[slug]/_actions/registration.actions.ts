"use server";

import { randomInt, randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { after } from "next/server";
import type { Prisma } from "@/app/generated/prisma/client";
import prisma from "@/app/lib/prisma";
import { getTicketingEnv } from "@/lib/env";
import { hitRateLimit } from "@/lib/server/rate-limit";
import { getClientIp, rateLimitKey } from "@/lib/server/request-keys";
import { countHeld } from "@/lib/server/held";
import { lockEvent } from "@/lib/server/orders";
import { sendOrderEmail, sendTicketEmail } from "@/lib/server/ticket-email";
import { parseFormSchema, validateAnswers } from "@/lib/ticketing/form-schema";
import { ORDER_STATUSES, decideOrder, isOpenOrder } from "@/lib/ticketing/order";
import { emailKindFor, isUniqueViolation } from "@/lib/ticketing/registration";
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
const TX_OPTIONS = { maxWait: 5000, timeout: 10000 };

const GENERIC_ERROR: RegisterResult = { success: false, error: "No se pudo completar el registro. Inténtalo de nuevo." };
const RATE_LIMITED: RegisterResult = {
  success: false,
  error: "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.",
};
const OPEN_STATUSES = ORDER_STATUSES.filter(isOpenOrder);
const REFUSALS = {
  closed: "Las inscripciones para este evento están cerradas.",
  full: "Este evento ya no tiene lugares disponibles.",
  // Quantity is fixed at 1 until the buyer UI ships, so a quantity refusal can only mean no room.
  quantity: "Este evento ya no tiene lugares disponibles.",
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
 * Public registration: creates an Order (quantity 1 for now). At most one OPEN order
 * per (event, email): a repeated email re-sends that order's link and the response is
 * the same as for a new registration, so the form cannot be used to probe emails.
 * A buyer whose earlier order is PAID/CANCELLED simply creates a new order (no email unique).
 * A quantity-1 order is mirrored by one ticket with the SAME id and code (the shape the
 * migration backfill produces), so emailed links and the organizer list keep working.
 * (When the event is closed or full a NEW email is refused while a known one
 * still succeeds; that small signal is accepted for the sake of link recovery.)
 */
export async function registerForEvent(slug: string, input: unknown): Promise<RegisterResult> {
  try {
    if (typeof slug !== "string" || !isInput(input)) return GENERIC_ERROR;
    getTicketingEnv(); // Fail before creating anything we could not link to.

    const ip = getClientIp(await headers());
    // No trustworthy IP: skip the per-IP limit (a shared bucket would be a site-wide DoS). Per-email still applies.
    if (ip && !(await hitRateLimit(rateLimitKey("register:ip", ip), MAX_PER_IP, WINDOW_MS)).allowed) {
      return RATE_LIMITED;
    }

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
          await lockEvent(tx, event.id);
          const current = await tx.event.findUniqueOrThrow({ where: { id: event.id } });
          const openOrder = await tx.order.findFirst({
            where: { eventId: event.id, email, status: { in: OPEN_STATUSES } },
            orderBy: { createdAt: "desc" },
            select: { id: true, status: true },
          });
          const decision = decideOrder({
            event: current,
            held: await countHeld(tx, event.id),
            quantity: 1,
            existing: openOrder,
          });
          if (decision.kind === "refused") return decision;
          if (decision.kind === "duplicate") {
            const order = await tx.order.findUniqueOrThrow({ where: { id: decision.orderId } });
            return { kind: "duplicate" as const, order, event: current };
          }

          const id = randomUUID();
          const answersJson = answers as unknown as Prisma.InputJsonValue;
          const order = await tx.order.create({
            data: {
              id,
              eventId: event.id,
              code,
              name,
              email,
              answers: answersJson,
              quantity: 1,
              unitPriceCents: current.priceCents,
              amountCents: decision.amountCents,
              currency: current.currency,
              paymentMethod: decision.method,
              status: decision.status,
            },
          });
          await tx.ticket.create({
            data: {
              id,
              orderId: id,
              seq: 1,
              eventId: event.id,
              code,
              name,
              email,
              answers: answersJson,
              status: decision.status,
              paymentMethod: decision.method,
              amountCents: current.priceCents,
              currency: current.currency,
            },
          });
          return { kind: "created" as const, order, event: current };
        }, TX_OPTIONS),
      isUniqueViolation,
    );

    if (outcome.kind === "refused") return { success: false, error: REFUSALS[outcome.reason] };

    // Best effort, after commit and after the response: a provider outage must not undo the
    // registration, and awaiting the send would make a duplicate (re-send) slower than a new
    // registration, revealing which emails are registered. the senders never throw.
    const emailKind = emailKindFor(outcome.order.status);
    if (emailKind) {
      const { order, event: emailEvent } = outcome;
      const target = { id: order.id, name: order.name, email, code: order.code, amountCents: order.amountCents };
      // Quantity 1: the order id is also its ticket id.
      after(() => (emailKind === "ticket" ? sendTicketEmail(target, emailEvent) : sendOrderEmail("received", target, emailEvent)));
    }
    return { success: true };
  } catch (error) {
    const code = typeof error === "object" && error !== null ? (error as { code?: unknown }).code : undefined;
    console.error("registerForEvent failed:", error instanceof Error ? error.name : "unknown", code ?? "");
    return GENERIC_ERROR;
  }
}
