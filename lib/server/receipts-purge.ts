import prisma from "@/app/lib/prisma";
import { eventExpiryCutoff, receiptGroupKey, selectSuperseded, shouldRunPurge } from "@/lib/ticketing/receipt-purge";

const BATCH_SIZE = 500;
const MAX_BATCHES = 20;
const LAZY_INTERVAL_MS = 10 * 60 * 1000;

/** Ids (orders, or tickets for pre-order receipts) that hold more than one receipt with bytes. */
async function groupKeys(by: "orderId" | "ticketId"): Promise<string[]> {
  const having = { id: { _count: { gt: 1 } } };
  if (by === "orderId") {
    const groups = await prisma.receipt.groupBy({
      by: ["orderId"],
      where: { orderId: { not: null }, bytes: { not: null } },
      having,
      orderBy: { orderId: "asc" },
      take: BATCH_SIZE,
    });
    return groups.flatMap((g) => (g.orderId === null ? [] : [g.orderId]));
  }
  const groups = await prisma.receipt.groupBy({
    by: ["ticketId"],
    where: { orderId: null, ticketId: { not: null }, bytes: { not: null } },
    having,
    orderBy: { ticketId: "asc" },
    take: BATCH_SIZE,
  });
  return groups.flatMap((g) => (g.ticketId === null ? [] : [g.ticketId]));
}

/** One pass of the superseded purge: `by` picks how receipts are grouped, in bounded batches. */
async function purgeSuperseded(by: "orderId" | "ticketId", now: Date): Promise<number> {
  let purged = 0;
  // Receipts that have an order are grouped by it; the rest (written by pre-order code) by their ticket.
  const linked = by === "orderId" ? { orderId: { not: null } } : { orderId: null, ticketId: { not: null } };
  for (let i = 0; i < MAX_BATCHES; i++) {
    const keys = await groupKeys(by);
    if (keys.length === 0) break;

    const rows = await prisma.receipt.findMany({
      where: { ...linked, [by]: { in: keys } },
      select: { id: true, orderId: true, ticketId: true, uploadedAt: true, purgedAt: true },
    });
    const ids = selectSuperseded(
      rows.flatMap((r) => {
        const groupId = receiptGroupKey(r);
        return groupId === null ? [] : [{ id: r.id, groupId, uploadedAt: r.uploadedAt, purged: r.purgedAt !== null }];
      }),
    );
    if (ids.length === 0) break;

    const result = await prisma.receipt.updateMany({
      where: { id: { in: ids }, bytes: { not: null } },
      data: { bytes: null, purgedAt: now },
    });
    purged += result.count;
    if (keys.length < BATCH_SIZE) break;
  }
  return purged;
}

/**
 * Nulls the bytes of receipts that are no longer needed: those of events more
 * than 30 days past, and superseded uploads (older rows of the same order).
 * Only candidates are queried, so live latest receipts never starve old rows.
 * Returns how many receipts were purged.
 */
export async function purgeExpiredReceipts(now: Date = new Date()): Promise<number> {
  // (a) Expired events: one conditional UPDATE. A receipt reaches its event through its
  // order or, for pre-order receipts, through its ticket.
  const cutoff = eventExpiryCutoff(now);
  const expired = await prisma.receipt.updateMany({
    where: {
      bytes: { not: null },
      OR: [{ order: { event: { date: { lt: cutoff } } } }, { ticket: { event: { date: { lt: cutoff } } } }],
    },
    data: { bytes: null, purgedAt: now },
  });

  // (b) Superseded uploads.
  return expired.count + (await purgeSuperseded("orderId", now)) + (await purgeSuperseded("ticketId", now));
}

let lastLazyRun: Date | null = null;

/** Lazy trigger for page loads: at most once per interval per process. */
export async function purgeExpiredReceiptsThrottled(now: Date = new Date()): Promise<void> {
  if (!shouldRunPurge(lastLazyRun, now, LAZY_INTERVAL_MS)) return;
  lastLazyRun = now;
  await purgeExpiredReceipts(now);
}
