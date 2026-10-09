"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import prisma from "@/app/lib/prisma";
import { getOwnedEvent } from "@/lib/server/guards";
import { sendTicketEmail } from "@/lib/server/ticket-email";
import { canApprove, canCancel, resendKindFor, validateRejectReason } from "@/lib/ticketing/review";

export type ReviewResult = { success: true } | { success: false; error: string };

const NOT_FOUND: ReviewResult = { success: false, error: "Boleto no encontrado." };
const STALE: ReviewResult = {
  success: false,
  error: "El boleto ya cambió de estado. Actualiza la lista para ver su estado actual.",
};
const GENERIC: ReviewResult = { success: false, error: "No se pudo completar la acción." };

/**
 * Server actions are public endpoints: every action re-checks that the caller owns
 * the event AND that the ticket belongs to it. Status changes are conditional
 * updateMany calls (these actions do not take the Event lock), so a double click
 * or two reviewers can only win once, and only the winner sends email.
 */
async function loadTicket(eventId: string, ticketId: string) {
  const owned = await getOwnedEvent(eventId);
  if (!owned) return null;
  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, eventId: owned.event.id },
    select: { id: true, name: true, email: true, code: true, status: true },
  });
  return ticket ? { event: owned.event, ticket } : null;
}

function done(eventId: string): ReviewResult {
  revalidatePath(`/dashboard/events/${eventId}/attendees`);
  return { success: true };
}

export async function approveTicket(eventId: string, ticketId: string): Promise<ReviewResult> {
  try {
    const loaded = await loadTicket(eventId, ticketId);
    if (!loaded) return NOT_FOUND;
    const { event, ticket } = loaded;
    if (!canApprove(ticket.status)) return STALE;

    const { count } = await prisma.ticket.updateMany({
      where: { id: ticket.id, eventId: event.id, status: "PENDING_VALIDATION" },
      data: { status: "PAID", reviewedAt: new Date(), rejectionReason: null },
    });
    if (count !== 1) return STALE;

    if (ticket.email) {
      const email = ticket.email;
      after(() => sendTicketEmail("ticket", { id: ticket.id, name: ticket.name, email, code: ticket.code }, event));
    }
    return done(event.id);
  } catch (error) {
    console.error("approveTicket failed:", error instanceof Error ? error.name : "unknown");
    return GENERIC;
  }
}

export async function rejectTicket(eventId: string, ticketId: string, reason: string): Promise<ReviewResult> {
  try {
    const validation = validateRejectReason(reason);
    if (!validation.ok) return { success: false, error: validation.error };

    const loaded = await loadTicket(eventId, ticketId);
    if (!loaded) return NOT_FOUND;
    const { event, ticket } = loaded;
    if (!canApprove(ticket.status)) return STALE; // reject has the same precondition as approve

    const { count } = await prisma.ticket.updateMany({
      where: { id: ticket.id, eventId: event.id, status: "PENDING_VALIDATION" },
      data: { status: "REJECTED", rejectionReason: validation.reason, reviewedAt: new Date() },
    });
    if (count !== 1) return STALE;

    if (ticket.email) {
      const email = ticket.email;
      after(() =>
        sendTicketEmail("rejected", { id: ticket.id, name: ticket.name, email, code: ticket.code }, event, validation.reason),
      );
    }
    return done(event.id);
  } catch (error) {
    console.error("rejectTicket failed:", error instanceof Error ? error.name : "unknown");
    return GENERIC;
  }
}

export async function resendTicketEmail(eventId: string, ticketId: string): Promise<ReviewResult> {
  try {
    const loaded = await loadTicket(eventId, ticketId);
    if (!loaded) return NOT_FOUND;
    const { event, ticket } = loaded;
    const kind = resendKindFor(ticket.status);
    if (!kind) return { success: false, error: "No hay un correo que reenviar para este estado." };
    if (!ticket.email) return { success: false, error: "Este boleto no tiene correo." };

    const email = ticket.email;
    after(() => sendTicketEmail(kind, { id: ticket.id, name: ticket.name, email, code: ticket.code }, event));
    return done(event.id);
  } catch (error) {
    console.error("resendTicketEmail failed:", error instanceof Error ? error.name : "unknown");
    return GENERIC;
  }
}

export async function cancelTicket(eventId: string, ticketId: string): Promise<ReviewResult> {
  try {
    const loaded = await loadTicket(eventId, ticketId);
    if (!loaded) return NOT_FOUND;
    const { event, ticket } = loaded;
    // Conditional on the status we saw, so a concurrent change (e.g. check-in) wins.
    if (!canCancel(ticket.status)) {
      return { success: false, error: "Este boleto ya no se puede cancelar." };
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
