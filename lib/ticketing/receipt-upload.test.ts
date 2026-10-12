import { describe, expect, it } from "vitest";
import type { OrderStatus, TicketStatus } from "@/app/generated/prisma/enums";
import { decideReceiptUpload, isBodyTooLarge, MAX_REQUEST_BYTES } from "./receipt-upload";

const event = { isCancelled: false, capacity: 10 };
const decide = (status: TicketStatus, held = 0, over = {}) =>
  decideReceiptUpload({ status, event: { ...event, ...over }, held });

describe("decideReceiptUpload", () => {
  it("accepts PENDING_RECEIPT and REJECTED with a free spot", () => {
    expect(decide("PENDING_RECEIPT", 9)).toEqual({ kind: "accept" });
    expect(decide("REJECTED", 0)).toEqual({ kind: "accept" });
  });
  it("accepts when capacity is unlimited", () => {
    expect(decide("PENDING_RECEIPT", 999, { capacity: null })).toEqual({ kind: "accept" });
  });
  it("refuses as full when held reaches capacity", () => {
    expect(decide("PENDING_RECEIPT", 10)).toEqual({ kind: "refused", reason: "full" });
  });
  it("treats capacity lowered below held as full", () => {
    expect(decide("REJECTED", 12)).toEqual({ kind: "refused", reason: "full" });
  });
  it.each(["PENDING_VALIDATION", "PAID", "CHECKED_IN", "CANCELLED"] as const)("refuses %s", (status) => {
    expect(decide(status)).toEqual({ kind: "refused", reason: "status" });
  });
  it("refuses everything for a cancelled event", () => {
    expect(decide("PENDING_RECEIPT", 0, { isCancelled: true })).toEqual({ kind: "refused", reason: "cancelled" });
  });
});

describe("isBodyTooLarge", () => {
  it("allows missing or small lengths and rejects above the limit", () => {
    expect(isBodyTooLarge(null)).toBe(false);
    // Vercel rejects request bodies over 4.5 MB before our code runs.
    expect(MAX_REQUEST_BYTES).toBeLessThan(4_500_000);
    expect(isBodyTooLarge(String(MAX_REQUEST_BYTES))).toBe(false);
    expect(isBodyTooLarge(String(MAX_REQUEST_BYTES + 1))).toBe(true);
  });
  it("rejects malformed lengths", () => {
    expect(isBodyTooLarge("abc")).toBe(true);
    expect(isBodyTooLarge("-5")).toBe(true);
  });
});

describe("decideReceiptUpload with quantity", () => {
  const decideQty = (status: OrderStatus, held: number, quantity: number, capacity: number | null = 10) =>
    decideReceiptUpload({ status, event: { isCancelled: false, capacity }, held, quantity });

  it("defaults to quantity 1", () => {
    expect(decideReceiptUpload({ status: "PENDING_RECEIPT", event, held: 9 })).toEqual({ kind: "accept" });
  });
  it("accepts a group that fits exactly", () => {
    expect(decideQty("PENDING_RECEIPT", 7, 3)).toEqual({ kind: "accept" });
  });
  it("refuses a group that overshoots as full", () => {
    expect(decideQty("PENDING_RECEIPT", 8, 3)).toEqual({ kind: "refused", reason: "full" });
  });
  it("is unlimited without capacity", () => {
    expect(decideQty("REJECTED", 999, 50, null)).toEqual({ kind: "accept" });
  });
  it("refuses a PAID or CANCELLED order by status", () => {
    expect(decideQty("PAID", 0, 2)).toEqual({ kind: "refused", reason: "status" });
    expect(decideQty("CANCELLED", 0, 2)).toEqual({ kind: "refused", reason: "status" });
  });
});
