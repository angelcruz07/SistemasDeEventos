import prisma from "@/app/lib/prisma";
import { eventExpiryCutoff, selectSuperseded, shouldRunPurge } from "@/lib/ticketing/receipt-purge";

const BATCH_SIZE = 500;
const MAX_BATCHES = 20;
const LAZY_INTERVAL_MS = 10 * 60 * 1000;

/**
 * Nulls the bytes of receipts that are no longer needed: those of events more
 * than 30 days past, and superseded uploads (older rows of the same ticket).
 * Only candidates are queried, so live latest receipts never starve old rows.
 * Returns how many receipts were purged.
 */
export async function purgeExpiredReceipts(now: Date = new Date()): Promise<number> {
  let purged = 0;

  // (a) Expired events: one conditional UPDATE through the relation filter.
  const expired = await prisma.receipt.updateMany({
    where: { bytes: { not: null }, ticket: { event: { date: { lt: eventExpiryCutoff(now) } } } },
    data: { bytes: null, purgedAt: now },
  });
  purged += expired.count;

  // (b) Superseded: tickets holding more than one receipt with bytes, in bounded batches.
  for (let i = 0; i < MAX_BATCHES; i++) {
    const groups = await prisma.receipt.groupBy({
      by: ["ticketId"],
      where: { bytes: { not: null } },
      having: { id: { _count: { gt: 1 } } },
      orderBy: { ticketId: "asc" },
      take: BATCH_SIZE,
    });
    if (groups.length === 0) break;

    const rows = await prisma.receipt.findMany({
      where: { ticketId: { in: groups.map((g) => g.ticketId) } },
      select: { id: true, ticketId: true, uploadedAt: true, purgedAt: true },
    });
    const ids = selectSuperseded(rows.map((r) => ({ ...r, purged: r.purgedAt !== null })));
    if (ids.length === 0) break;

    const result = await prisma.receipt.updateMany({
      where: { id: { in: ids }, bytes: { not: null } },
      data: { bytes: null, purgedAt: now },
    });
    purged += result.count;
    if (groups.length < BATCH_SIZE) break;
  }
  return purged;
}

let lastLazyRun: Date | null = null;

/** Lazy trigger for page loads: at most once per interval per process. */
export async function purgeExpiredReceiptsThrottled(now: Date = new Date()): Promise<void> {
  if (!shouldRunPurge(lastLazyRun, now, LAZY_INTERVAL_MS)) return;
  lastLazyRun = now;
  await purgeExpiredReceipts(now);
}
