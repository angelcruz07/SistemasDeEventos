"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import type { Prisma } from "@/app/generated/prisma/client";
import prisma from "@/app/lib/prisma";
import { getOwnedEvent } from "@/lib/server/guards";
import { ensureOrderForTicket, lockEvent } from "@/lib/server/orders";
import { sendOrderEmail, sendTicketEmail } from "@/lib/server/ticket-email";
import { PRE_ISSUE_STATUSES, canTransitionOrder, planIssuance } from "@/lib/ticketing/order";
import { isCodeCollision } from "@/lib/ticketing/registration";
import { canCancel, resendKindFor, validateRejectReason } from "@/lib/ticketing/review";
import { createWithUniqueCode, generateDistinctCodes } from "@/lib/ticketing/short-code";

export type ReviewResult = { success: true } | { success: false; error: string };

const NOT_FOUND: ReviewResult = { success: false, error: "Boleto no encontrado." };
const STALE: ReviewResult = {
  success: false,
  error: "El boleto ya cambió de estado. Actualiza la lista para ver su estado actual.",
};
const GENERIC: ReviewResult = { success: false, error: "No se pudo completar la acción." };
const TX_OPTIONS = { maxWait: 5000, timeout: 10000 };

/**
 * Server actions are public endpoints: every action re-checks that the caller owns
 * the event AND that the order/ticket belongs to it. Status changes are conditional
 * updateMany calls, so a double click or two reviewers can only win once, and only the
 * winner sends email. Orders are never deleted: cancelling is a status change.
 */
async function loadOrder(eventId: string, orderId: string) {
  const owned = await getOwnedEvent(eventId);
  if (!owned) return null;
  const order = await prisma.order.findFirst({ where: { id: orderId, eventId: owned.event.id } });
  return order ? { event: owned.event, order } : null;
}

/**
 * The attendees list still speaks ticket ids. A ticket resolves to its order; a ticket
 * written by pre-order code gets its order created here, under the event lock. An id with
 * no ticket may be an order that has no ticket yet.
 */
async function orderIdFor(eventId: string, id: string): Promise<string | null> {
  const owned = await getOwnedEvent(eventId);
  if (!owned) return null;
  const ticket = await prisma.ticket.findFirst({ where: { id, eventId: owned.event.id }, select: { id: true, orderId: true } });
  if (ticket?.orderId) return ticket.orderId;
  if (ticket) {
    const order = await prisma.$transaction(async (tx) => {
      await lockEvent(tx, owned.event.id);
      return ensureOrderForTicket(tx, ticket.id);
    }, TX_OPTIONS);
    return order?.id ?? null;
  }
  const order = await prisma.order.findFirst({ where: { id, eventId: owned.event.id }, select: { id: true } });
  return order?.id ?? null;
}

function done(eventId: string): ReviewResult {
  revalidatePath(`/dashboard/events/${eventId}/attendees`);
  return { success: true };
}

export async function approveOrder(eventId: string, orderId: string): Promise<ReviewResult> {
  try {
    const loaded = await loadOrder(eventId, orderId);
    if (!loaded) return NOT_FOUND;
    const { event, order } = loaded;
    if (order.status !== "PENDING_VALIDATION") return STALE;

    // One batch of distinct codes per attempt; a collision (P2002) retries the whole transaction.
    const issued = await createWithUniqueCode(
      () => generateDistinctCodes(order.quantity, randomInt).join(","),
      (joined) =>
        prisma.$transaction(async (tx) => {
          await lockEvent(tx, event.id);
          const now = new Date();
          const { count } = await tx.order.updateMany({
            where: { id: order.id, eventId: event.id, status: "PENDING_VALIDATION" },
            data: { status: "PAID", reviewedAt: now, rejectionReason: null },
          });
          if (count !== 1) return null;

          // Tickets older code already moved to PAID/CHECKED_IN count as issued (no duplicates, no
          // second email); pre-issue ones are flipped; only the missing remainder is created.
          const alreadyIssued = await tx.ticket.findMany({
            where: { orderId: order.id, status: { in: ["PAID", "CHECKED_IN"] } },
            select: { id: true },
          });
          const preIssue = { orderId: order.id, status: { in: [...PRE_ISSUE_STATUSES] } };
          const plan = planIssuance(order.quantity, await tx.ticket.count({ where: preIssue }), alreadyIssued.length);
          if (plan.flip > 0) {
            await tx.ticket.updateMany({
              where: preIssue,
              data: { status: "PAID", reviewedAt: now, rejectionReason: null },
            });
          }
          if (plan.create > 0) {
            await tx.ticket.createMany({
              data: joined
                .split(",")
                .slice(0, plan.create)
                .map((code, i) => ({
                  eventId: event.id,
                  orderId: order.id,
                  seq: alreadyIssued.length + plan.flip + i + 1,
                  code,
                  name: order.name,
                  email: order.email,
                  answers: order.answers as Prisma.InputJsonValue,
                  status: "PAID" as const,
                  paymentMethod: order.paymentMethod,
                  amountCents: order.unitPriceCents,
                  currency: order.currency,
                  reviewedAt: now,
                })),
            });
          }
          const before = new Set(alreadyIssued.map((t) => t.id));
          const paid = await tx.ticket.findMany({
            where: { orderId: order.id, status: "PAID" },
            orderBy: { seq: "asc" },
            select: { id: true, name: true, email: true, code: true },
          });
          return paid.filter((t) => !before.has(t.id)); // only newly issued tickets get an email
        }, TX_OPTIONS),
      // Only a short-code clash is retried; the (eventId, email) unique cannot be fixed by a new code.
      isCodeCollision,
    );
    if (!issued) return STALE;

    for (const ticket of issued) {
      if (!ticket.email) continue;
      const email = ticket.email;
      after(() => sendTicketEmail({ id: ticket.id, name: ticket.name, email, code: ticket.code }, event));
    }
    return done(event.id);
  } catch (error) {
    console.error("approveOrder failed:", error instanceof Error ? error.name : "unknown");
    return GENERIC;
  }
}

export async function rejectOrder(eventId: string, orderId: string, reason: string): Promise<ReviewResult> {
  try {
    const validation = validateRejectReason(reason);
    if (!validation.ok) return { success: false, error: validation.error };

    const loaded = await loadOrder(eventId, orderId);
    if (!loaded) return NOT_FOUND;
    const { event, order } = loaded;
    if (order.status !== "PENDING_VALIDATION") return STALE; // reject has the same precondition as approve

    const changed = await prisma.$transaction(async (tx) => {
      const now = new Date();
      const { count } = await tx.order.updateMany({
        where: { id: order.id, eventId: event.id, status: "PENDING_VALIDATION" },
        data: { status: "REJECTED", rejectionReason: validation.reason, reviewedAt: now },
      });
      if (count !== 1) return false;
      await tx.ticket.updateMany({
        where: { orderId: order.id, status: { in: [...PRE_ISSUE_STATUSES] } },
        data: { status: "REJECTED", rejectionReason: validation.reason, reviewedAt: now },
      });
      return true;
    }, TX_OPTIONS);
    if (!changed) return STALE;

    if (order.email) {
      const target = { id: order.id, name: order.name, email: order.email, code: order.code, amountCents: order.amountCents };
      after(() => sendOrderEmail("rejected", target, event, validation.reason));
    }
    return done(event.id);
  } catch (error) {
    console.error("rejectOrder failed:", error instanceof Error ? error.name : "unknown");
    return GENERIC;
  }
}

export async function cancelOrder(eventId: string, orderId: string): Promise<ReviewResult> {
  try {
    const loaded = await loadOrder(eventId, orderId);
    if (!loaded) return NOT_FOUND;
    const { event, order } = loaded;
    if (!canTransitionOrder(order.status, "CANCELLED")) {
      return { success: false, error: "Este boleto ya no se puede cancelar." };
    }

    const changed = await prisma.$transaction(async (tx) => {
      const now = new Date();
      // Conditional on the status we saw, so a concurrent change wins.
      const { count } = await tx.order.updateMany({
        where: { id: order.id, eventId: event.id, status: order.status },
        data: { status: "CANCELLED", reviewedAt: now },
      });
      if (count !== 1) return false;
      // Unpaid mirrors and issued tickets are cancelled; a ticket already used at the door stays CHECKED_IN.
      await tx.ticket.updateMany({
        where: { orderId: order.id, status: { in: [...PRE_ISSUE_STATUSES, "PAID"] } },
        data: { status: "CANCELLED", reviewedAt: now },
      });
      return true;
    }, TX_OPTIONS);
    if (!changed) return STALE;
    return done(event.id);
  } catch (error) {
    console.error("cancelOrder failed:", error instanceof Error ? error.name : "unknown");
    return GENERIC;
  }
}

export async function resendOrder(eventId: string, orderId: string): Promise<ReviewResult> {
  try {
    const loaded = await loadOrder(eventId, orderId);
    if (!loaded) return NOT_FOUND;
    const { event, order } = loaded;
    const kind = resendKindFor(order.status);
    if (!kind) return { success: false, error: "No hay un correo que reenviar para este estado." };
    if (!order.email) return { success: false, error: "Este boleto no tiene correo." };

    if (kind === "received") {
      const target = { id: order.id, name: order.name, email: order.email, code: order.code, amountCents: order.amountCents };
      after(() => sendOrderEmail("received", target, event));
    } else {
      const email = order.email;
      const tickets = await prisma.ticket.findMany({
        where: { orderId: order.id, status: { in: ["PAID", "CHECKED_IN"] } },
        orderBy: { seq: "asc" },
        select: { id: true, name: true, code: true },
      });
      for (const ticket of tickets) after(() => sendTicketEmail({ ...ticket, email }, event));
    }
    return done(event.id);
  } catch (error) {
    console.error("resendOrder failed:", error instanceof Error ? error.name : "unknown");
    return GENERIC;
  }
}

// Ticket-id entry points used by the current attendees list: they resolve to the order.

export async function approveTicket(eventId: string, ticketId: string): Promise<ReviewResult> {
  const orderId = await orderIdFor(eventId, ticketId).catch(() => null);
  return orderId ? approveOrder(eventId, orderId) : NOT_FOUND;
}

export async function rejectTicket(eventId: string, ticketId: string, reason: string): Promise<ReviewResult> {
  const orderId = await orderIdFor(eventId, ticketId).catch(() => null);
  return orderId ? rejectOrder(eventId, orderId, reason) : NOT_FOUND;
}

export async function resendTicketEmail(eventId: string, ticketId: string): Promise<ReviewResult> {
  try {
    const owned = await getOwnedEvent(eventId);
    if (!owned) return NOT_FOUND;
    const ticket = await prisma.ticket.findFirst({
      where: { id: ticketId, eventId: owned.event.id },
      select: { id: true, name: true, email: true, code: true, status: true },
    });
    // An issued ticket gets its own email; anything else is the order's "received" email.
    if (ticket && (ticket.status === "PAID" || ticket.status === "CHECKED_IN")) {
      if (!ticket.email) return { success: false, error: "Este boleto no tiene correo." };
      const email = ticket.email;
      after(() => sendTicketEmail({ id: ticket.id, name: ticket.name, email, code: ticket.code }, owned.event));
      return done(owned.event.id);
    }
    const orderId = await orderIdFor(eventId, ticketId);
    return orderId ? resendOrder(eventId, orderId) : NOT_FOUND;
  } catch (error) {
    console.error("resendTicketEmail failed:", error instanceof Error ? error.name : "unknown");
    return GENERIC;
  }
}

/**
 * Ticket-level cancel stays: it cancels that ticket only. A ticket that merely mirrors an
 * unpaid order cancels the order instead, otherwise the open order would keep blocking the buyer.
 */
export async function cancelTicket(eventId: string, ticketId: string): Promise<ReviewResult> {
  try {
    const owned = await getOwnedEvent(eventId);
    if (!owned) return NOT_FOUND;
    const { event } = owned;
    const ticket = await prisma.ticket.findFirst({
      where: { id: ticketId, eventId: event.id },
      select: { id: true, status: true },
    });
    if (!ticket) {
      const orderId = await orderIdFor(eventId, ticketId);
      return orderId ? cancelOrder(eventId, orderId) : NOT_FOUND;
    }
    // Conditional on the status we saw, so a concurrent change (e.g. check-in) wins.
    if (!canCancel(ticket.status)) {
      return { success: false, error: "Este boleto ya no se puede cancelar." };
    }
    if (PRE_ISSUE_STATUSES.includes(ticket.status)) {
      const orderId = await orderIdFor(eventId, ticketId);
      return orderId ? cancelOrder(eventId, orderId) : NOT_FOUND;
    }

    const { count } = await prisma.ticket.updateMany({
      where: { id: ticket.id, eventId: event.id, status: ticket.status },
      data: { status: "CANCELLED", reviewedAt: new Date() },
    });
    if (count !== 1) return STALE;
    return done(event.id);
  } catch (error) {
    console.error("cancelTicket failed:", error instanceof Error ? error.name : "unknown");
    return GENERIC;
  }
}
