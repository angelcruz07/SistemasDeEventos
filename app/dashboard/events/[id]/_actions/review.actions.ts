"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import type { Prisma } from "@/app/generated/prisma/client";
import prisma from "@/app/lib/prisma";
import { getOwnedEvent } from "@/lib/server/guards";
import { lockEvent } from "@/lib/server/orders";
import {
  sendCashPreregistrationEmail,
  sendOrderEmail,
  sendTicketEmail,
  sendTicketEmails,
} from "@/lib/server/ticket-email";
import { PRE_ISSUE_STATUSES, canTransitionOrder, planIssuance } from "@/lib/ticketing/order";
import { isCodeCollision } from "@/lib/ticketing/registration";
import { countHeld } from "@/lib/server/held";
import { hasRoom } from "@/lib/ticketing/capacity";
import { canCancel, canMarkPaid, manualPayNeedsRoom, resendKindFor, validateRejectReason } from "@/lib/ticketing/review";
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
 * winner sends email. Cancelling is a status change; only deleteOrder removes an order for good.
 */
async function loadOrder(eventId: string, orderId: string) {
  const owned = await getOwnedEvent(eventId);
  if (!owned) return null;
  const order = await prisma.order.findFirst({ where: { id: orderId, eventId: owned.event.id } });
  return order ? { event: owned.event, order } : null;
}

/**
 * The attendees list still speaks ticket ids. A ticket resolves to its order. An id with
 * no ticket may be an order that has no ticket yet.
 */
async function orderIdFor(eventId: string, id: string): Promise<string | null> {
  const owned = await getOwnedEvent(eventId);
  if (!owned) return null;
  const ticket = await prisma.ticket.findFirst({ where: { id, eventId: owned.event.id }, select: { id: true, orderId: true } });
  if (ticket) return ticket.orderId;
  const order = await prisma.order.findFirst({ where: { id, eventId: owned.event.id }, select: { id: true } });
  return order?.id ?? null;
}

function done(eventId: string): ReviewResult {
  revalidatePath(`/dashboard/events/${eventId}/attendees`);
  revalidatePath(`/dashboard/events/${eventId}/stats`);
  return { success: true };
}

type IssuedTicket = { id: string; name: string; email: string | null; code: string };
type PayOutcome = { kind: "paid"; issued: IssuedTicket[] } | { kind: "full" } | null;

/**
 * Turns an unpaid order into PAID inside the event lock. Cash pre-registrations already have their
 * tickets (and QR): they just flip to PAID. Any other order gets its tickets issued like an approval.
 * Returns the newly issued tickets (they get an email), "full" when there is no room, or null when
 * the order changed status meanwhile.
 */
async function payOrder(
  event: { id: string; capacity: number | null },
  order: NonNullable<Awaited<ReturnType<typeof loadOrder>>>["order"],
): Promise<PayOutcome> {
  const fromStatus = order.status;
  return createWithUniqueCode(
    () => generateDistinctCodes(order.quantity, randomInt).join(","),
    (joined) =>
      prisma.$transaction(async (tx): Promise<PayOutcome> => {
        await lockEvent(tx, event.id);
        // Orders that never held a spot must still fit (they would otherwise oversell the event).
        if (manualPayNeedsRoom(fromStatus) && !hasRoom(await countHeld(tx, event.id), order.quantity, event.capacity)) {
          return { kind: "full" };
        }
        const now = new Date();
        const { count } = await tx.order.updateMany({
          where: { id: order.id, eventId: event.id, status: fromStatus },
          data: { status: "PAID", reviewedAt: now, paidAt: now, rejectionReason: null },
        });
        if (count !== 1) return null;

        if (fromStatus === "PENDING_CASH") {
          await tx.ticket.updateMany({
            where: { orderId: order.id, status: "PENDING_CASH" },
            data: { status: "PAID", reviewedAt: now },
          });
          return { kind: "paid", issued: [] }; // their QR was emailed at pre-registration
        }

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
        return { kind: "paid", issued: paid.filter((t) => !before.has(t.id)) }; // only new tickets get an email
      }, TX_OPTIONS),
    // Only a short-code clash is retried; the (eventId, email) unique cannot be fixed by a new code.
    isCodeCollision,
  );
}

function emailIssued(issued: IssuedTicket[], event: Parameters<typeof sendTicketEmails>[1]) {
  // One batch for the whole order (design D9): sequential sends would risk the function timeout.
  const recipients = issued.flatMap((t) => (t.email ? [{ id: t.id, name: t.name, email: t.email, code: t.code }] : []));
  if (recipients.length > 0) after(() => sendTicketEmails(recipients, event));
}

export async function approveOrder(eventId: string, orderId: string): Promise<ReviewResult> {
  try {
    const loaded = await loadOrder(eventId, orderId);
    if (!loaded) return NOT_FOUND;
    const { event, order } = loaded;
    if (order.status !== "PENDING_VALIDATION") return STALE;

    const outcome = await payOrder(event, order);
    if (!outcome || outcome.kind !== "paid") return STALE;
    emailIssued(outcome.issued, event);
    return done(event.id);
  } catch (error) {
    console.error("approveOrder failed:", error instanceof Error ? error.name : "unknown");
    return GENERIC;
  }
}

/**
 * The "Pagado" checkbox: the organizer confirms money received outside the receipt flow.
 * Same effect as an approval (tickets issued and emailed); a cash pre-registration just becomes
 * PAID and is counted in the cash-up under cash. One-way: un-paying is done by cancelling.
 */
export async function markOrderPaid(eventId: string, orderId: string): Promise<ReviewResult> {
  try {
    const loaded = await loadOrder(eventId, orderId);
    if (!loaded) return NOT_FOUND;
    const { event, order } = loaded;
    if (!canMarkPaid(order.status)) {
      return { success: false, error: "Esta compra ya está pagada o cancelada." };
    }

    const outcome = await payOrder(event, order);
    if (!outcome) return STALE;
    if (outcome.kind === "full") {
      return { success: false, error: "No hay lugares suficientes para emitir los boletos de esta compra." };
    }
    emailIssued(outcome.issued, event);
    return done(event.id);
  } catch (error) {
    console.error("markOrderPaid failed:", error instanceof Error ? error.name : "unknown");
    return GENERIC;
  }
}

/**
 * Permanently removes an order with its tickets and receipts (cascade). Unlike cancelling, the
 * order disappears from the list, the stats and the cash-up, and its spots are freed.
 */
export async function deleteOrder(eventId: string, orderId: string): Promise<ReviewResult> {
  try {
    const owned = await getOwnedEvent(eventId);
    if (!owned) return NOT_FOUND;
    if (typeof orderId !== "string" || orderId.length === 0 || orderId.length > 100) return NOT_FOUND;
    const { count } = await prisma.order.deleteMany({ where: { id: orderId, eventId: owned.event.id } });
    if (count !== 1) return { success: false, error: "La compra ya no existe. Actualiza la lista." };
    return done(owned.event.id);
  } catch (error) {
    console.error("deleteOrder failed:", error instanceof Error ? error.name : "unknown");
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
      return { success: false, error: "Esta compra ya no se puede cancelar." };
    }

    const changed = await prisma.$transaction(async (tx) => {
      const now = new Date();
      // Conditional on the status we saw, so a concurrent change wins.
      // paidAt is left untouched on purpose: cancelling never refunds, the cash stays in the cash-up.
      const { count } = await tx.order.updateMany({
        where: { id: order.id, eventId: event.id, status: order.status },
        data: { status: "CANCELLED", reviewedAt: now },
      });
      if (count !== 1) return false;
      // Unpaid mirrors, unpaid cash pre-registrations and issued tickets are cancelled (their QR stops
      // working at the door); a ticket already used at the door stays CHECKED_IN.
      await tx.ticket.updateMany({
        where: { orderId: order.id, status: { in: [...PRE_ISSUE_STATUSES, "PENDING_CASH", "PAID"] } },
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
    if (!order.email) return { success: false, error: "Esta compra no tiene correo." };

    const target = { id: order.id, name: order.name, email: order.email, code: order.code, amountCents: order.amountCents };
    if (kind === "received") {
      after(() => sendOrderEmail("received", target, event));
    } else if (kind === "cash") {
      after(() => sendCashPreregistrationEmail(target, event));
    } else {
      const email = order.email;
      const tickets = await prisma.ticket.findMany({
        where: { orderId: order.id, status: { in: ["PAID", "CHECKED_IN"] } },
        orderBy: { seq: "asc" },
        select: { id: true, name: true, code: true },
      });
      const recipients = tickets.map((t) => ({ ...t, email }));
      if (recipients.length > 0) after(() => sendTicketEmails(recipients, event));
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
    // An unpaid cash ticket is cancelled with its whole order: the amount due at the door is per order.
    if (PRE_ISSUE_STATUSES.includes(ticket.status) || ticket.status === "PENDING_CASH") {
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
