import { describe, expect, it } from "vitest";
import { RETENTION_DAYS, eventExpiryCutoff, receiptGroupKey, selectSuperseded, shouldRunPurge } from "./receipt-purge";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-10-08T12:00:00Z");

const r = (id: string, ticketId: string, uploadedAt: string, purged = false) => ({
  id,
  groupId: ticketId,
  uploadedAt: new Date(uploadedAt),
  purged,
});

describe("eventExpiryCutoff", () => {
  it("is now minus the retention window", () => {
    expect(RETENTION_DAYS).toBe(30);
    expect(eventExpiryCutoff(now).getTime()).toBe(now.getTime() - 30 * DAY);
  });
});

describe("selectSuperseded", () => {
  it("returns older receipts but keeps the latest of each ticket", () => {
    const rows = [
      r("old", "t1", "2026-10-01T10:00:00Z"),
      r("new", "t1", "2026-10-02T10:00:00Z"),
      r("other", "t2", "2026-10-01T10:00:00Z"),
    ];
    expect(selectSuperseded(rows)).toEqual(["old"]);
  });

  it("handles three uploads regardless of input order", () => {
    const rows = [
      r("b", "t1", "2026-10-02T00:00:00Z"),
      r("c", "t1", "2026-10-03T00:00:00Z"),
      r("a", "t1", "2026-10-01T00:00:00Z"),
    ];
    expect(selectSuperseded(rows).sort()).toEqual(["a", "b"]);
  });

  it("measures the latest including already-purged rows and skips purged ones", () => {
    const rows = [r("old", "t1", "2026-10-01T00:00:00Z"), r("gone", "t1", "2026-10-02T00:00:00Z", true)];
    expect(selectSuperseded(rows)).toEqual(["old"]);
    expect(selectSuperseded([r("x", "t1", "2026-10-01T00:00:00Z", true), r("y", "t1", "2026-10-02T00:00:00Z")])).toEqual([]);
  });

  it("returns nothing for no rows", () => {
    expect(selectSuperseded([])).toEqual([]);
  });
});

describe("shouldRunPurge", () => {
  const interval = 10 * 60 * 1000;
  it("runs the first time", () => {
    expect(shouldRunPurge(null, now, interval)).toBe(true);
  });
  it("skips inside the interval and runs after it", () => {
    expect(shouldRunPurge(new Date(now.getTime() - interval + 1), now, interval)).toBe(false);
    expect(shouldRunPurge(new Date(now.getTime() - interval), now, interval)).toBe(true);
  });
});

describe("receiptGroupKey", () => {
  it("groups by order when the receipt has one, else by its legacy ticket", () => {
    expect(receiptGroupKey({ orderId: "o1", ticketId: "t1" })).toBe("o1");
    expect(receiptGroupKey({ orderId: null, ticketId: "t1" })).toBe("t1");
  });
  it("is null for an unlinked receipt so it is never grouped", () => {
    expect(receiptGroupKey({ orderId: null, ticketId: null })).toBeNull();
  });
});

describe("selectSuperseded across a dual-linked order", () => {
  it("keeps only the latest receipt of an order regardless of the ticket link", () => {
    const rows = [r("old", "o1", "2026-10-01T00:00:00Z"), r("new", "o1", "2026-10-02T00:00:00Z")];
    expect(selectSuperseded(rows)).toEqual(["old"]);
  });
});
