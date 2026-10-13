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
import { sendOrderEmail, sendTicketEmails } from "@/lib/server/ticket-email";
import { parseFormSchema, validateAnswers } from "@/lib/ticketing/form-schema";
import { ORDER_STATUSES, decideOrder, isOpenOrder, parseQuantity } from "@/lib/ticketing/order";
import { isUniqueViolation } from "@/lib/ticketing/registration";
import { createWithUniqueCode, generateDistinctCodes } from "@/lib/ticketing/short-code";

export interface RegistrationInput {
  name: string;
  email: string;
  fields: Record<string, unknown>;
  /** Number of tickets; omitted means 1. Validated on the server. */
  quantity?: unknown;
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
  // Never reveals how many spots remain.
  quantity: "No hay lugares suficientes para esa cantidad.",
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
 * Public registration: creates ONE Order for N tickets. At most one OPEN order
 * per (event, email): a repeated email re-sends that order's link and the response is
 * the same as for a new registration, so the form cannot be used to probe emails.
 * A buyer whose earlier order is PAID/CANCELLED simply creates a new order (no email unique).
 * A quantity-1 order is mirrored by one ticket with the SAME id and code (the shape the
 * migration backfill produces), so emailed links and the organizer list keep working.
 * A quantity > 1 order has no tickets until approval (design D3); a free one issues all N
 * tickets at once and sends their emails in one batch.
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
    const quantity = parseQuantity(input.quantity ?? 1);
    if (quantity === null) return { success: false, error: "Elige una cantidad válida de boletos." };

    const emailKey = rateLimitKey("register:email", `${event.id}:${email}`);
    if (!(await hitRateLimit(emailKey, MAX_PER_EMAIL, WINDOW_MS)).allowed) return RATE_LIMITED;

    // Whole transaction is retried only on a short-code collision (P2002): the
    // event row lock rules out an email race, so any P2002 here is the code.
    const outcome = await createWithUniqueCode(
      // First code is the order code (also the mirror ticket code); the rest serve a free N-ticket order.
      () => generateDistinctCodes(quantity > 1 ? quantity + 1 : 1, randomInt).join(","),
      (joined) =>
        prisma.$transaction(async (tx) => {
          const [code, ...ticketCodes] = joined.split(",");
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
            quantity,
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
              quantity,
              unitPriceCents: current.priceCents,
              amountCents: decision.amountCents,
              currency: current.currency,
              paymentMethod: decision.method,
              status: decision.status,
            },
          });
          const ticketBase = {
            eventId: event.id,
            name,
            email,
            answers: answersJson,
            paymentMethod: decision.method,
            amountCents: current.priceCents,
            currency: current.currency,
          };
          let issued: { id: string; name: string; email: string; code: string }[] = [];
          if (quantity === 1) {
            // Mirror ticket: same id and code as the order (PAID at once for a free event).
            await tx.ticket.create({
              data: { ...ticketBase, id, orderId: id, seq: 1, code, status: decision.status },
            });
            if (decision.issueNow > 0) issued = [{ id, name, email, code }];
          } else if (decision.issueNow > 0) {
            // Free N-ticket order: all tickets exist from the start. A paid one gets none until approval (D3).
            const rows = ticketCodes.slice(0, quantity).map((ticketCode, i) => ({
              ...ticketBase,
              id: randomUUID(),
              orderId: id,
              seq: i + 1,
              code: ticketCode,
              status: "PAID" as const,
            }));
            await tx.ticket.createMany({ data: rows });
            issued = rows.map((r) => ({ id: r.id, name, email, code: r.code }));
          }
          return { kind: "created" as const, order, event: current, issued };
        }, TX_OPTIONS),
      isUniqueViolation,
    );

    if (outcome.kind === "refused") return { success: false, error: REFUSALS[outcome.reason] };

    // Best effort, after commit and after the response: a provider outage must not undo the
    // registration, and awaiting the send would make a duplicate (re-send) slower than a new
    // registration, revealing which emails are registered. the senders never throw.
    const { order, event: emailEvent } = outcome;
    const issued = outcome.kind === "created" ? outcome.issued : [];
    if (issued.length > 0) {
      after(() => sendTicketEmails(issued, emailEvent));
    } else if (order.status !== "PAID" && order.status !== "CANCELLED") {
      const target = { id: order.id, name: order.name, email, code: order.code, amountCents: order.amountCents };
      after(() => sendOrderEmail("received", target, emailEvent));
    }
    return { success: true };
  } catch (error) {
    const code = typeof error === "object" && error !== null ? (error as { code?: unknown }).code : undefined;
    console.error("registerForEvent failed:", error instanceof Error ? error.name : "unknown", code ?? "");
    return GENERIC_ERROR;
  }
}
