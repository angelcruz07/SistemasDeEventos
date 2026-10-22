import { describe, expect, it } from "vitest";
import { HOLDING_STATUSES, SPOT_TICKET_STATUSES, countHeld, hasRoom, hasSpot, heldTotal, isRegistrationOpen } from "./capacity";

describe("heldTotal (D5)", () => {
  it("adds validating order quantities and issued tickets", () => {
    expect(heldTotal({ pendingQuantity: 3, issuedTickets: 4 })).toBe(7);
  });
  it("does not double count tickets already issued for a still-validating order", () => {
    // 1 validating order of qty 1 whose ticket is already PAID: one spot, not two.
    expect(heldTotal({ pendingQuantity: 1, issuedTickets: 1, issuedOfPending: 1 })).toBe(1);
    expect(heldTotal({ pendingQuantity: 3, issuedTickets: 2, issuedOfPending: 1 })).toBe(4);
  });
  it("treats an empty aggregate (null sum) as zero", () => {
    expect(heldTotal({ pendingQuantity: null, issuedTickets: 0, })).toBe(0);
  });
});

describe("HOLDING_STATUSES", () => {
  it("is PENDING_VALIDATION, PAID, CHECKED_IN and PENDING_CASH only", () => {
    expect([...HOLDING_STATUSES].sort()).toEqual(["CHECKED_IN", "PAID", "PENDING_CASH", "PENDING_VALIDATION"]);
  });
});

describe("SPOT_TICKET_STATUSES", () => {
  it("counts issued tickets and cash pre-registrations, one spot each", () => {
    expect([...SPOT_TICKET_STATUSES].sort()).toEqual(["CHECKED_IN", "PAID", "PENDING_CASH"]);
  });
});

describe("countHeld", () => {
  it("counts only holding statuses; rejected frees a spot", () => {
    const statuses = ["PAID", "REJECTED", "PENDING_RECEIPT", "CANCELLED", "CHECKED_IN", "PENDING_VALIDATION"] as const;
    expect(countHeld(statuses)).toBe(3);
  });
});

describe("hasSpot", () => {
  it("is unlimited without capacity", () => {
    expect(hasSpot(10_000, null)).toBe(true);
  });
  it("requires held < capacity", () => {
    expect(hasSpot(99, 100)).toBe(true);
    expect(hasSpot(100, 100)).toBe(false);
    expect(hasSpot(101, 100)).toBe(false);
  });
});

describe("hasRoom", () => {
  it("is unlimited without capacity", () => {
    expect(hasRoom(10_000, 50, null)).toBe(true);
  });
  it("accepts a quantity that fits exactly", () => {
    expect(hasRoom(98, 2, 100)).toBe(true);
    expect(hasRoom(99, 1, 100)).toBe(true);
  });
  it("refuses a quantity that overshoots", () => {
    expect(hasRoom(98, 3, 100)).toBe(false);
    expect(hasRoom(100, 1, 100)).toBe(false);
  });
  it("treats capacity lowered below held as no room", () => {
    expect(hasRoom(12, 1, 10)).toBe(false);
  });
  it("matches hasSpot for a quantity of 1", () => {
    for (const held of [0, 99, 100, 101]) expect(hasRoom(held, 1, 100)).toBe(hasSpot(held, 100));
  });
});

describe("isRegistrationOpen", () => {
  it("is closed when the toggle is off, even with room", () => {
    expect(isRegistrationOpen({ registrationOpen: false, capacity: 100 }, 0)).toEqual({
      open: false,
      reason: "closed",
    });
  });
  it("is full at capacity", () => {
    expect(isRegistrationOpen({ registrationOpen: true, capacity: 100 }, 100)).toEqual({
      open: false,
      reason: "full",
    });
  });
  it("reopens after a rejection frees a spot", () => {
    expect(isRegistrationOpen({ registrationOpen: true, capacity: 100 }, 99)).toEqual({ open: true });
  });
  it("is open without capacity", () => {
    expect(isRegistrationOpen({ registrationOpen: true, capacity: null }, 5)).toEqual({ open: true });
  });
});
