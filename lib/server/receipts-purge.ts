import prisma from "@/app/lib/prisma";
import { eventExpiryCutoff, selectSuperseded, shouldRunPurge } from "@/lib/ticketing/receipt-purge";

const BATCH_SIZE = 500;
const MAX_BATCHES = 20;
const LAZY_INTERVAL_MS = 10 * 60 * 1000;

/** Orders that hold more than one receipt with bytes. */
async function groupKeys(): Promise<string[]> {
  const groups = await prisma.receipt.groupBy({
    by: ["orderId"],
    where: { bytes: { not: null } },
    having: { id: { _count: { gt: 1 } } },
    orderBy: { orderId: "asc" },
    take: BATCH_SIZE,
  });
  return groups.map((g) => g.orderId);
}

/** Purges superseded uploads (older rows of the same order), in bounded batches. */
async function purgeSuperseded(now: Date): Promise<number> {
  let purged = 0;
  for (let i = 0; i < MAX_BATCHES; i++) {
    const keys = await groupKeys();
    if (keys.length === 0) break;

    const rows = await prisma.receipt.findMany({
      where: { orderId: { in: keys } },
      select: { id: true, orderId: true, uploadedAt: true, purgedAt: true },
    });
    const ids = selectSuperseded(
      rows.map((r) => ({ id: r.id, groupId: r.orderId, uploadedAt: r.uploadedAt, purged: r.purgedAt !== null })),
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
  // (a) Expired events: one conditional UPDATE.
  const cutoff = eventExpiryCutoff(now);
  const expired = await prisma.receipt.updateMany({
    where: { bytes: { not: null }, order: { event: { date: { lt: cutoff } } } },
    data: { bytes: null, purgedAt: now },
  });

  // (b) Superseded uploads.
  return expired.count + (await purgeSuperseded(now));
}

let lastLazyRun: Date | null = null;

/** Lazy trigger for page loads: at most once per interval per process. */
export async function purgeExpiredReceiptsThrottled(now: Date = new Date()): Promise<void> {
  if (!shouldRunPurge(lastLazyRun, now, LAZY_INTERVAL_MS)) return;
  lastLazyRun = now;
  await purgeExpiredReceipts(now);
}
