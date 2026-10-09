import { describe, expect, it } from "vitest";
import { canTransition, initialStatus, TICKET_STATUSES } from "./status";

const ALLOWED: Array<[string, string]> = [
  ["PENDING_RECEIPT", "PENDING_VALIDATION"],
  ["REJECTED", "PENDING_VALIDATION"],
  ["PENDING_VALIDATION", "PENDING_VALIDATION"],
  ["PENDING_VALIDATION", "PAID"],
  ["PENDING_VALIDATION", "REJECTED"],
  ["PAID", "CHECKED_IN"],
  ["PENDING_RECEIPT", "CANCELLED"],
  ["PENDING_VALIDATION", "CANCELLED"],
  ["PAID", "CANCELLED"],
  ["REJECTED", "CANCELLED"],
];

describe("canTransition", () => {
  it("allows exactly the documented transitions", () => {
    for (const from of TICKET_STATUSES) {
      for (const to of TICKET_STATUSES) {
        const expected = ALLOWED.some(([f, t]) => f === from && t === to);
        expect(canTransition(from, to), `${from} -> ${to}`).toBe(expected);
      }
    }
  });

  it("never leaves CANCELLED or cancels a checked-in ticket", () => {
    for (const to of TICKET_STATUSES) expect(canTransition("CANCELLED", to)).toBe(false);
    expect(canTransition("CHECKED_IN", "CANCELLED")).toBe(false);
  });
});

describe("initialStatus", () => {
  it("public paid SPEI waits for a receipt", () => {
    expect(initialStatus({ method: "SPEI", priceCents: 35000, channel: "public" })).toBe(
      "PENDING_RECEIPT",
    );
  });

  it("public free tickets are paid immediately", () => {
    expect(initialStatus({ method: "FREE", priceCents: 0, channel: "public" })).toBe("PAID");
    expect(initialStatus({ method: "SPEI", priceCents: 0, channel: "public" })).toBe("PAID");
  });

  it("door cash walk-ins are checked in", () => {
    expect(initialStatus({ method: "CASH", priceCents: 10000, channel: "door" })).toBe(
      "CHECKED_IN",
    );
  });

  it("refuses combinations the system never creates", () => {
    expect(() => initialStatus({ method: "CASH", priceCents: 10000, channel: "public" })).toThrow();
    expect(() => initialStatus({ method: "SPEI", priceCents: 100, channel: "door" })).toThrow();
  });
});

describe("initialStatus price validation", () => {
  it("rejects negative, fractional and NaN prices", () => {
    for (const priceCents of [-1, 1.5, Number.NaN, Infinity]) {
      expect(() => initialStatus({ method: "SPEI", priceCents, channel: "public" })).toThrow();
    }
  });
});
