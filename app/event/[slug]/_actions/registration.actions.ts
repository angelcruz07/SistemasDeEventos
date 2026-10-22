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
import { sendCashPreregistrationEmail, sendOrderEmail, sendTicketEmails } from "@/lib/server/ticket-email";
import { parseFormSchema, validateAnswers } from "@/lib/ticketing/form-schema";
import { ORDER_STATUSES, blocksRegistration, decideOrder, parsePaymentChoice, parseQuantity } from "@/lib/ticketing/order";
import { isUniqueViolation } from "@/lib/ticketing/registration";
import { createWithUniqueCode, generateDistinctCodes } from "@/lib/ticketing/short-code";

export interface RegistrationInput {
  name: string;
  email: string;
  fields: Record<string, unknown>;
  /** Number of tickets; omitted means 1. Validated on the server. */
  quantity?: unknown;
  /** "SPEI" or "CASH" (cash pre-registration) for a paid event; omitted means the first method offered. */
  paymentMethod?: unknown;
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
const BLOCKING_STATUSES = ORDER_STATUSES.filter(blocksRegistration);
const REFUSALS = {
  closed: "Las inscripciones para este evento están cerradas.",
  full: "Este evento ya no tiene lugares disponibles.",
  // Never reveals how many spots remain.
  quantity: "No hay lugares suficientes para esa cantidad.",
  method: "Ese método de pago no está disponible para este evento.",
  email:
    "Este correo ya está registrado en este evento. Usa otro correo para registrarte; si ya te habías registrado, revisa tu bandeja de entrada (y spam).",
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
 * Public registration: creates ONE Order for N tickets. One email registers once per event:
 * an email with any order that is not CANCELLED is refused with a clear message (checked
 * inside the event lock, so two simultaneous submissions cannot both pass).
 * A quantity-1 order is mirrored by one ticket with the SAME id and code (the shape the
 * migration backfill produces), so emailed links and the organizer list keep working.
 * A quantity > 1 order has no tickets until approval (design D3); a free one issues all N
 * tickets at once and sends their emails in one batch.
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
    const paymentChoice = parsePaymentChoice(input.paymentMethod);

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
          const existing = await tx.order.findFirst({
            where: { eventId: event.id, email, status: { in: BLOCKING_STATUSES } },
            orderBy: { createdAt: "desc" },
            select: { id: true, status: true },
          });
          const decision = decideOrder({
            event: current,
            held: await countHeld(tx, event.id),
            quantity,
            existing,
            method: paymentChoice,
          });
          if (decision.kind === "refused") return decision;

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
              paidAt: decision.status === "PAID" ? new Date() : null,
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
          // TicketStatus has every status a new order can start in (PENDING_RECEIPT, PENDING_CASH, PAID).
          const ticketStatus = decision.status as "PENDING_RECEIPT" | "PENDING_CASH" | "PAID";
          if (quantity === 1) {
            // Mirror ticket: same id and code as the order (PAID at once for a free event, PENDING_CASH
            // with a working QR for a cash pre-registration).
            await tx.ticket.create({
              data: { ...ticketBase, id, orderId: id, seq: 1, code, status: ticketStatus },
            });
            if (decision.issueNow > 0) issued = [{ id, name, email, code }];
          } else if (decision.issueNow > 0) {
            // Free or cash N-ticket order: all tickets exist from the start. A SPEI one gets none until approval (D3).
            const rows = ticketCodes.slice(0, quantity).map((ticketCode, i) => ({
              ...ticketBase,
              id: randomUUID(),
              orderId: id,
              seq: i + 1,
              code: ticketCode,
              status: ticketStatus,
            }));
            await tx.ticket.createMany({ data: rows });
            issued = rows.map((r) => ({ id: r.id, name, email, code: r.code }));
          }
          return { kind: "created" as const, order, event: current, issued };
        }, TX_OPTIONS),
      isUniqueViolation,
    );

    if (outcome.kind === "refused") {
      const error = REFUSALS[outcome.reason];
      return outcome.reason === "email"
        ? { success: false, error, fieldErrors: { email: "Este correo ya fue registrado. Usa otro." } }
        : { success: false, error };
    }

    // Best effort, after commit and after the response: a provider outage must not undo the
    // registration. The senders never throw.
    const { order, event: emailEvent, issued } = outcome;
    const target = { id: order.id, name: order.name, email, code: order.code, amountCents: order.amountCents };
    if (order.status === "PENDING_CASH") {
      // Cash pre-registration: the email carries the QR codes and the amount due at the door.
      after(() => sendCashPreregistrationEmail(target, emailEvent));
    } else if (issued.length > 0) {
      after(() => sendTicketEmails(issued, emailEvent));
    } else if (order.status !== "PAID" && order.status !== "CANCELLED") {
      after(() => sendOrderEmail("received", target, emailEvent));
    }
    return { success: true };
  } catch (error) {
    const code = typeof error === "object" && error !== null ? (error as { code?: unknown }).code : undefined;
    console.error("registerForEvent failed:", error instanceof Error ? error.name : "unknown", code ?? "");
    return GENERIC_ERROR;
  }
}
