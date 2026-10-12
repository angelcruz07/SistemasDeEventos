import type { Prisma } from "@/app/generated/prisma/client";
import type { OrderStatus } from "@/app/generated/prisma/enums";
import { legacyOrderFromTicket } from "@/lib/ticketing/order";

/** Serializes registrations, uploads and reviews of one event. Must be the first statement of the transaction. */
export async function lockEvent(tx: Prisma.TransactionClient, eventId: string): Promise<void> {
  await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${eventId} FOR UPDATE`;
}

/**
 * Resolves the order of a ticket, creating it when the ticket was written by code that
 * predates orders (orderId NULL). Mirrors the migration backfill and is idempotent, so a
 * race or a repeated call changes nothing. Call it under the event lock.
 */
export async function ensureOrderForTicket(
  tx: Prisma.TransactionClient,
  ticketId: string,
): Promise<{ id: string; status: OrderStatus; quantity: number } | null> {
  const ticket = await tx.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) return null;
  if (ticket.orderId) {
    return tx.order.findUnique({ where: { id: ticket.orderId }, select: { id: true, status: true, quantity: true } });
  }
  const data = legacyOrderFromTicket(ticket);
  await tx.order.createMany({
    data: [{ ...data, answers: data.answers as Prisma.InputJsonValue }],
    skipDuplicates: true,
  });
  await tx.ticket.updateMany({ where: { id: ticket.id, orderId: null }, data: { orderId: data.id } });
  await tx.receipt.updateMany({ where: { ticketId: ticket.id, orderId: null }, data: { orderId: data.id } });
  return tx.order.findUnique({ where: { id: data.id }, select: { id: true, status: true, quantity: true } });
}
