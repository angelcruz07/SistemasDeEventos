import { describe, expect, it } from "vitest";
import { decideRegistration, emailKindFor, isUniqueViolation } from "./registration";

const event = { registrationOpen: true, isCancelled: false, capacity: 10, priceCents: 0, allowSpei: true };

describe("decideRegistration", () => {
  it("creates a PAID FREE ticket for a free event", () => {
    expect(decideRegistration({ event, held: 3, existing: null })).toEqual({
      kind: "create",
      status: "PAID",
      method: "FREE",
    });
  });

  it("creates a PENDING_RECEIPT SPEI ticket for a paid event", () => {
    expect(decideRegistration({ event: { ...event, priceCents: 35000 }, held: 3, existing: null })).toEqual({
      kind: "create",
      status: "PENDING_RECEIPT",
      method: "SPEI",
    });
  });

  it("refuses when registration is closed", () => {
    expect(decideRegistration({ event: { ...event, registrationOpen: false }, held: 0, existing: null })).toEqual({
      kind: "refused",
      reason: "closed",
    });
  });

  it("refuses when full, including capacity lowered below the held tickets", () => {
    expect(decideRegistration({ event, held: 10, existing: null })).toEqual({ kind: "refused", reason: "full" });
    expect(decideRegistration({ event: { ...event, capacity: 5 }, held: 8, existing: null })).toEqual({
      kind: "refused",
      reason: "full",
    });
  });

  it("refuses a cancelled event, even for an existing ticket", () => {
    const cancelled = { ...event, isCancelled: true };
    expect(decideRegistration({ event: cancelled, held: 0, existing: null })).toEqual({ kind: "refused", reason: "closed" });
    expect(decideRegistration({ event: cancelled, held: 0, existing: { id: "t1", status: "PAID" } })).toEqual({
      kind: "refused",
      reason: "closed",
    });
  });

  it("allows registration with no capacity limit", () => {
    expect(decideRegistration({ event: { ...event, capacity: null }, held: 9999, existing: null }).kind).toBe("create");
  });

  it("refuses a paid event that does not accept SPEI (cash is door only)", () => {
    expect(
      decideRegistration({ event: { ...event, priceCents: 5000, allowSpei: false }, held: 0, existing: null }),
    ).toEqual({ kind: "refused", reason: "closed" });
  });

  it("returns the existing ticket even when closed or full", () => {
    const existing = { id: "t1", status: "PENDING_RECEIPT" as const };
    expect(decideRegistration({ event: { ...event, registrationOpen: false }, held: 10, existing })).toEqual({
      kind: "duplicate",
      ticketId: "t1",
      status: "PENDING_RECEIPT",
    });
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
