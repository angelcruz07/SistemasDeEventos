import { describe, expect, it } from "vitest";
import { TICKET_STATUSES } from "./status";
import { ORDER_STATUSES } from "./order";
import {
  MAX_REASON_LENGTH,
  canApprove,
  canCancel,
  canMarkPaid,
  manualPayNeedsRoom,
  resendKindFor,
  validateRejectReason,
} from "./review";

describe("canApprove", () => {
  it("only from PENDING_VALIDATION", () => {
    for (const s of TICKET_STATUSES) expect(canApprove(s)).toBe(s === "PENDING_VALIDATION");
  });
});

describe("validateRejectReason", () => {
  it("trims and accepts a reason", () => {
    expect(validateRejectReason("  Monto incorrecto ")).toEqual({ ok: true, reason: "Monto incorrecto" });
  });
  it("rejects empty or whitespace", () => {
    expect(validateRejectReason("   ").ok).toBe(false);
    expect(validateRejectReason("").ok).toBe(false);
  });
  it("rejects non-strings", () => {
    expect(validateRejectReason(undefined as unknown as string).ok).toBe(false);
  });
  it("enforces the max length after trimming", () => {
    expect(validateRejectReason("a".repeat(MAX_REASON_LENGTH)).ok).toBe(true);
    expect(validateRejectReason("a".repeat(MAX_REASON_LENGTH + 1)).ok).toBe(false);
    expect(validateRejectReason(` ${"a".repeat(MAX_REASON_LENGTH)} `).ok).toBe(true);
  });
});

describe("resendKindFor", () => {
  it("maps statuses to an email kind", () => {
    expect(resendKindFor("PENDING_RECEIPT")).toBe("received");
    expect(resendKindFor("REJECTED")).toBe("received");
    expect(resendKindFor("PAID")).toBe("ticket");
  });
  it("returns null where resending makes no sense", () => {
    expect(resendKindFor("PENDING_VALIDATION")).toBeNull();
    expect(resendKindFor("CHECKED_IN")).toBeNull();
    expect(resendKindFor("CANCELLED")).toBeNull();
  });
});

describe("canCancel", () => {
  it("follows the transition matrix", () => {
    expect(canCancel("PAID")).toBe(true);
    expect(canCancel("PENDING_VALIDATION")).toBe(true);
    expect(canCancel("CHECKED_IN")).toBe(false);
    expect(canCancel("CANCELLED")).toBe(false);
  });
});

describe("canMarkPaid", () => {
  it("allows every unpaid, open order and nothing final", () => {
    const allowed = ORDER_STATUSES.filter(canMarkPaid);
    expect(allowed).toEqual(["PENDING_RECEIPT", "PENDING_VALIDATION", "REJECTED", "PENDING_CASH"]);
    expect(canMarkPaid("PAID")).toBe(false);
    expect(canMarkPaid("CANCELLED")).toBe(false);
  });

  it("checks room only for orders that do not hold a spot yet", () => {
    expect(ORDER_STATUSES.filter(manualPayNeedsRoom)).toEqual(["PENDING_RECEIPT", "REJECTED"]);
  });
});
