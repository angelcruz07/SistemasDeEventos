export const RETENTION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Receipts of events dated before this instant are purged. */
export function eventExpiryCutoff(now: Date): Date {
  return new Date(now.getTime() - RETENTION_DAYS * DAY_MS);
}

export interface PurgeCandidate {
  id: string;
  ticketId: string;
  uploadedAt: Date;
  eventDate: Date;
}

/**
 * Ids to purge from not-yet-purged receipts: those of expired events, plus
 * superseded ones (anything that is not the latest upload of its ticket).
 */
export function selectReceiptsToPurge(rows: PurgeCandidate[], now: Date): string[] {
  const cutoff = eventExpiryCutoff(now).getTime();
  const latest = new Map<string, PurgeCandidate>();
  for (const row of rows) {
    const current = latest.get(row.ticketId);
    if (!current || row.uploadedAt > current.uploadedAt) latest.set(row.ticketId, row);
  }
  return rows
    .filter((row) => row.eventDate.getTime() < cutoff || latest.get(row.ticketId) !== row)
    .map((row) => row.id);
}
