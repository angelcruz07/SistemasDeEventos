import { describe, expect, it } from "vitest";
import { RETENTION_DAYS, eventExpiryCutoff, selectReceiptsToPurge } from "./receipt-purge";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-10-08T12:00:00Z");

const r = (id: string, ticketId: string, uploadedAt: string, eventDate: string) => ({
  id,
  ticketId,
  uploadedAt: new Date(uploadedAt),
  eventDate: new Date(eventDate),
});

describe("eventExpiryCutoff", () => {
  it("is now minus the retention window", () => {
    expect(RETENTION_DAYS).toBe(30);
    expect(eventExpiryCutoff(now).getTime()).toBe(now.getTime() - 30 * DAY);
  });
});

describe("selectReceiptsToPurge", () => {
  it("purges receipts of events older than 30 days", () => {
    const rows = [r("a", "t1", "2026-08-01", "2026-09-01"), r("b", "t2", "2026-09-20", "2026-09-30")];
    expect(selectReceiptsToPurge(rows, now)).toEqual(["a"]);
  });

  it("keeps an event exactly at the cutoff", () => {
    const rows = [r("a", "t1", "2026-09-01", new Date(now.getTime() - 30 * DAY).toISOString())];
    expect(selectReceiptsToPurge(rows, now)).toEqual([]);
  });

  it("purges superseded receipts but keeps the latest of each ticket", () => {
    const future = "2026-12-01";
    const rows = [
      r("old", "t1", "2026-10-01T10:00:00Z", future),
      r("new", "t1", "2026-10-02T10:00:00Z", future),
      r("other", "t2", "2026-10-01T10:00:00Z", future),
    ];
    expect(selectReceiptsToPurge(rows, now)).toEqual(["old"]);
  });

  it("returns each id once", () => {
    const rows = [r("old", "t1", "2026-01-01", "2026-02-01"), r("new", "t1", "2026-01-02", "2026-02-01")];
    expect(selectReceiptsToPurge(rows, now).sort()).toEqual(["new", "old"]);
  });

  it("returns nothing for no rows", () => {
    expect(selectReceiptsToPurge([], now)).toEqual([]);
  });
});
