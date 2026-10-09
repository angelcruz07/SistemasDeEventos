import prisma from "@/app/lib/prisma";
import { selectReceiptsToPurge } from "@/lib/ticketing/receipt-purge";

const BATCH_SIZE = 500;

/**
 * Nulls the bytes of receipts that are no longer needed: those of events more
 * than 30 days past, and superseded uploads (older rows of the same ticket).
 * Works in bounded batches; returns how many receipts were purged.
 */
export async function purgeExpiredReceipts(now: Date = new Date()): Promise<number> {
  const rows = await prisma.receipt.findMany({
    where: { bytes: { not: null } },
    select: { id: true, ticketId: true, uploadedAt: true, ticket: { select: { event: { select: { date: true } } } } },
    orderBy: { uploadedAt: "desc" },
    take: BATCH_SIZE,
  });
  const ids = selectReceiptsToPurge(
    rows.map((r) => ({ id: r.id, ticketId: r.ticketId, uploadedAt: r.uploadedAt, eventDate: r.ticket.event.date })),
    now,
  );
  if (ids.length === 0) return 0;
  const result = await prisma.receipt.updateMany({
    where: { id: { in: ids }, bytes: { not: null } },
    data: { bytes: null, purgedAt: now },
  });
  return result.count;
}
