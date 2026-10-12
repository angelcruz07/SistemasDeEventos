import { describe, expect, it } from "vitest";
import { HOLDING_STATUSES, countHeld, hasRoom, hasSpot, isRegistrationOpen } from "./capacity";

describe("HOLDING_STATUSES", () => {
  it("is PENDING_VALIDATION, PAID and CHECKED_IN only", () => {
    expect([...HOLDING_STATUSES].sort()).toEqual(["CHECKED_IN", "PAID", "PENDING_VALIDATION"]);
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
