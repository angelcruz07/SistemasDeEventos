import { describe, expect, it } from "vitest";
import { emailKindFor, isCodeCollision, isUniqueViolation, publicPaymentMethods, registrationAvailability } from "./registration";

describe("publicPaymentMethods", () => {
  const paid = { priceCents: 35_000, allowSpei: true, allowCashPrereg: false };
  it("offers SPEI and/or cash pre-registration for a paid event, SPEI first", () => {
    expect(publicPaymentMethods(paid)).toEqual(["SPEI"]);
    expect(publicPaymentMethods({ ...paid, allowCashPrereg: true })).toEqual(["SPEI", "CASH"]);
    expect(publicPaymentMethods({ ...paid, allowSpei: false, allowCashPrereg: true })).toEqual(["CASH"]);
  });
  it("offers nothing for a free event", () => {
    expect(publicPaymentMethods({ ...paid, priceCents: 0, allowCashPrereg: true })).toEqual([]);
  });
});

describe("registrationAvailability", () => {
  const event = { registrationOpen: true, isCancelled: false, capacity: null, priceCents: 35_000, allowSpei: false, allowCashPrereg: false };
  it("is closed for a paid event whose only cash is at the door", () => {
    expect(registrationAvailability(event, 0)).toEqual({ open: false, reason: "closed" });
  });
  it("is open for a paid event with cash pre-registration only", () => {
    expect(registrationAvailability({ ...event, allowCashPrereg: true }, 0)).toEqual({ open: true });
  });
});

describe("emailKindFor", () => {
  it("maps statuses to the email to (re)send", () => {
    expect(emailKindFor("PAID")).toBe("ticket");
    expect(emailKindFor("CHECKED_IN")).toBe("ticket");
    expect(emailKindFor("PENDING_RECEIPT")).toBe("received");
    expect(emailKindFor("PENDING_VALIDATION")).toBe("received");
    expect(emailKindFor("REJECTED")).toBe("received");
    expect(emailKindFor("CANCELLED")).toBeNull();
  });
});

describe("isUniqueViolation", () => {
  it("recognises Prisma P2002 errors only", () => {
    expect(isUniqueViolation({ code: "P2002" })).toBe(true);
    expect(isUniqueViolation({ code: "P2025" })).toBe(false);
    expect(isUniqueViolation(new Error("boom"))).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
  });
});

describe("isCodeCollision", () => {
  it("is true for a P2002 on the code unique or one with unknown target", () => {
    expect(isCodeCollision({ code: "P2002", meta: { target: ["code"] } })).toBe(true);
    expect(isCodeCollision({ code: "P2002" })).toBe(true);
  });
  it("is false for the (eventId, email) unique, however the driver reports it", () => {
    expect(isCodeCollision({ code: "P2002", meta: { target: ["eventId", "email"] } })).toBe(false);
    expect(isCodeCollision({ code: "P2002", message: 'Unique constraint failed on "Ticket_eventId_email_key"' })).toBe(false);
    expect(isCodeCollision({ code: "P2002", meta: { driverAdapterError: { cause: { constraint: { fields: ["eventId", "email"] } } } } })).toBe(false);
  });
  it("is false for other errors", () => {
    expect(isCodeCollision(new Error("x"))).toBe(false);
    expect(isCodeCollision(null)).toBe(false);
  });
});
