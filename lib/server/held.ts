import type { Prisma } from "@/app/generated/prisma/client";
import prisma from "@/app/lib/prisma";
import { heldTotal } from "@/lib/ticketing/capacity";

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Spots currently held for an event (design D5). Call it inside the Event FOR UPDATE
 * lock whenever the result gates a write.
 */
export async function countHeld(db: Db, eventId: string): Promise<number> {
  const [pending, issuedTickets, issuedOfPending] = await Promise.all([
    db.order.aggregate({ where: { eventId, status: "PENDING_VALIDATION" }, _sum: { quantity: true } }),
    db.ticket.count({ where: { eventId, status: { in: ["PAID", "CHECKED_IN"] } } }),
    // Already-issued tickets of a still-validating order (older code approved the ticket first): counted once.
    db.ticket.count({
      where: { eventId, status: { in: ["PAID", "CHECKED_IN"] }, order: { status: "PENDING_VALIDATION" } },
    }),
  ]);
  return heldTotal({ pendingQuantity: pending._sum.quantity, issuedTickets, issuedOfPending });
}
