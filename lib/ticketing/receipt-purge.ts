export const RETENTION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Receipts of events dated before this instant are purged. */
export function eventExpiryCutoff(now: Date): Date {
  return new Date(now.getTime() - RETENTION_DAYS * DAY_MS);
}

export interface ReceiptRef {
  id: string;
  ticketId: string;
  uploadedAt: Date;
  purged: boolean;
}

/**
 * Ids of superseded receipts: anything that is not the latest upload of its ticket
 * (the latest is measured over all rows, purged or not) and is not already purged.
 */
export function selectSuperseded(rows: ReceiptRef[]): string[] {
  const latest = new Map<string, ReceiptRef>();
  for (const row of rows) {
    const current = latest.get(row.ticketId);
    if (!current || row.uploadedAt > current.uploadedAt) latest.set(row.ticketId, row);
  }
  return rows.filter((row) => !row.purged && latest.get(row.ticketId) !== row).map((row) => row.id);
}

/** Throttle for the lazy purge: first run, or at least `intervalMs` since the last. */
export function shouldRunPurge(lastRun: Date | null, now: Date, intervalMs: number): boolean {
  return lastRun === null || now.getTime() - lastRun.getTime() >= intervalMs;
}
