import { describe, expect, it } from "vitest";
import type { OrderStatus } from "@/app/generated/prisma/enums";
import {
  MAX_QUANTITY_UNCAPPED,
  MAX_AMOUNT_CENTS,
  ORDER_STATUSES,
  PRE_ISSUE_STATUSES,
  canTransitionOrder,
  decideOrder,
  isOpenOrder,
  blocksRegistration,
  blocksWalkIn,
  maxQuantity,
  orderAmount,
  parseQuantity,
  planIssuance,
} from "./order";

describe("parseQuantity", () => {
  it("accepts positive integers and integer strings", () => {
    expect(parseQuantity(1)).toBe(1);
    expect(parseQuantity(7)).toBe(7);
    expect(parseQuantity("3")).toBe(3);
    expect(parseQuantity(" 12 ")).toBe(12);
  });
  it.each([0, -1, 1.5, NaN, Infinity, "0", "-2", "1.5", "1e2", "abc", "", " ", null, undefined, {}, [], true])(
    "rejects %s",
    (value) => {
      expect(parseQuantity(value)).toBeNull();
    },
  );
  it("rejects values beyond the safe integer range", () => {
    expect(parseQuantity(Number.MAX_SAFE_INTEGER + 1)).toBeNull();
    expect(parseQuantity("99999999999999999999")).toBeNull();
  });
});

describe("maxQuantity", () => {
  it("caps at 50 when there is no capacity", () => {
    expect(MAX_QUANTITY_UNCAPPED).toBe(50);
    expect(maxQuantity(null, 0)).toBe(50);
    expect(maxQuantity(null, 10_000)).toBe(50);
  });
  it("is the remaining room with a capacity", () => {
    expect(maxQuantity(100, 40)).toBe(60);
    expect(maxQuantity(100, 99)).toBe(1);
    expect(maxQuantity(100, 100)).toBe(0);
  });
  it("is zero room when the capacity was lowered below held", () => {
    expect(maxQuantity(10, 12)).toBe(0);
  });
});

describe("orderAmount", () => {
  it("multiplies unit price by quantity", () => {
    expect(orderAmount(25_000, 3)).toBe(75_000);
    expect(orderAmount(0, 5)).toBe(0);
  });
  it("is null past the 32-bit limit", () => {
    expect(MAX_AMOUNT_CENTS).toBe(2 ** 31 - 1);
    expect(orderAmount(MAX_AMOUNT_CENTS, 1)).toBe(MAX_AMOUNT_CENTS);
    expect(orderAmount(MAX_AMOUNT_CENTS, 2)).toBeNull();
    expect(orderAmount(2 ** 30, 2)).toBeNull();
  });
  it("is null for invalid inputs", () => {
    expect(orderAmount(-1, 1)).toBeNull();
    expect(orderAmount(100, 0)).toBeNull();
    expect(orderAmount(100.5, 1)).toBeNull();
  });
});

describe("isOpenOrder", () => {
  it("is PENDING_RECEIPT, PENDING_VALIDATION, REJECTED and PENDING_CASH", () => {
    const open = ORDER_STATUSES.filter(isOpenOrder).sort();
    expect(open).toEqual(["PENDING_CASH", "PENDING_RECEIPT", "PENDING_VALIDATION", "REJECTED"]);
  });
  it("is not PAID or CANCELLED", () => {
    expect(isOpenOrder("PAID")).toBe(false);
    expect(isOpenOrder("CANCELLED")).toBe(false);
  });
});

const baseEvent = {
  registrationOpen: true,
  isCancelled: false,
  capacity: 100 as number | null,
  priceCents: 25_000,
  allowSpei: true,
  allowCashPrereg: false,
};
const decide = (over: Partial<Parameters<typeof decideOrder>[0]> = {}, event = {}) =>
  decideOrder({ event: { ...baseEvent, ...event }, held: 0, quantity: 2, existing: null, ...over });

describe("decideOrder", () => {
  it("creates a SPEI order awaiting receipt for a paid event", () => {
    expect(decide()).toEqual({
      kind: "create",
      status: "PENDING_RECEIPT",
      method: "SPEI",
      amountCents: 50_000,
      issueNow: 0,
    });
  });
  it("creates a PAID FREE order and issues every ticket now", () => {
    expect(decide({ quantity: 3 }, { priceCents: 0 })).toEqual({
      kind: "create",
      status: "PAID",
      method: "FREE",
      amountCents: 0,
      issueNow: 3,
    });
  });
  it("refuses an email that already has an open or paid order in the event", () => {
    for (const status of ["PENDING_RECEIPT", "PENDING_VALIDATION", "REJECTED", "PENDING_CASH", "PAID"] as const) {
      expect(decide({ existing: { id: "o1", status } })).toEqual({ kind: "refused", reason: "email" });
    }
  });
  it("lets the email register again once its order was cancelled", () => {
    expect(decide({ existing: { id: "o4", status: "CANCELLED" } }).kind).toBe("create");
  });
  it("reports the taken email even when the event is full or closed", () => {
    const existing = { id: "o1", status: "PAID" as OrderStatus };
    expect(decide({ existing, held: 100 })).toEqual({ kind: "refused", reason: "email" });
    expect(decide({ existing }, { registrationOpen: false })).toEqual({ kind: "refused", reason: "email" });
  });
  it("refuses everything on a cancelled event", () => {
    expect(decide({ existing: { id: "o1", status: "PENDING_RECEIPT" } }, { isCancelled: true })).toEqual({
      kind: "refused",
      reason: "closed",
    });
  });
  it("is closed when registration is off or a paid event has no SPEI", () => {
    expect(decide({}, { registrationOpen: false })).toEqual({ kind: "refused", reason: "closed" });
    expect(decide({}, { allowSpei: false })).toEqual({ kind: "refused", reason: "closed" });
  });
  it("creates a cash pre-registration with every ticket issued now (PENDING_CASH)", () => {
    expect(decide({ method: "CASH", quantity: 3 }, { allowCashPrereg: true })).toEqual({
      kind: "create",
      status: "PENDING_CASH",
      method: "CASH",
      amountCents: 75_000,
      issueNow: 3,
    });
  });
  it("defaults to SPEI when both are offered and to cash when it is the only public method", () => {
    expect(decide({}, { allowCashPrereg: true })).toMatchObject({ kind: "create", method: "SPEI" });
    expect(decide({}, { allowSpei: false, allowCashPrereg: true })).toMatchObject({
      kind: "create",
      method: "CASH",
      status: "PENDING_CASH",
    });
  });
  it("refuses a method the event does not offer", () => {
    expect(decide({ method: "CASH" })).toEqual({ kind: "refused", reason: "method" });
    expect(decide({ method: "SPEI" }, { allowSpei: false, allowCashPrereg: true })).toEqual({
      kind: "refused",
      reason: "method",
    });
  });
  it("ignores the method on a free event", () => {
    expect(decide({ method: "CASH" }, { priceCents: 0 })).toMatchObject({ kind: "create", method: "FREE", status: "PAID" });
  });
  it("refuses a second cash pre-registration with the same email", () => {
    expect(decide({ existing: { id: "c1", status: "PENDING_CASH" }, method: "CASH" }, { allowCashPrereg: true })).toEqual({
      kind: "refused",
      reason: "email",
    });
  });
  it("accepts exactly the remaining room", () => {
    expect(decide({ held: 98, quantity: 2 }).kind).toBe("create");
  });
  it("refuses a quantity above the remaining room without revealing it", () => {
    expect(decide({ held: 98, quantity: 3 })).toEqual({ kind: "refused", reason: "quantity" });
  });
  it("is full when no room is left or the capacity was lowered below held", () => {
    expect(decide({ held: 100, quantity: 1 })).toEqual({ kind: "refused", reason: "full" });
    expect(decide({ held: 120, quantity: 1 })).toEqual({ kind: "refused", reason: "full" });
  });
  it("caps at 50 without capacity", () => {
    expect(decide({ quantity: 50 }, { capacity: null }).kind).toBe("create");
    expect(decide({ quantity: 51 }, { capacity: null })).toEqual({ kind: "refused", reason: "quantity" });
  });
  it.each([0, -1, 1.5, NaN])("refuses invalid quantity %s", (quantity) => {
    expect(decide({ quantity })).toEqual({ kind: "refused", reason: "quantity" });
  });
  it("refuses an amount that overflows 32 bits", () => {
    expect(decide({ quantity: 2 }, { priceCents: 2 ** 30, capacity: null })).toEqual({
      kind: "refused",
      reason: "quantity",
    });
  });
});

describe("planIssuance", () => {
  it("flips pre-issue tickets and creates the rest", () => {
    expect(planIssuance(3, 0)).toEqual({ flip: 0, create: 3 });
    expect(planIssuance(1, 1)).toEqual({ flip: 1, create: 0 });
    expect(planIssuance(5, 2)).toEqual({ flip: 2, create: 3 });
  });
  it("never flips more than the quantity", () => {
    expect(planIssuance(2, 4)).toEqual({ flip: 2, create: 0 });
  });
  it("counts tickets already issued (old code approved the ticket first) and never exceeds the quantity", () => {
    expect(planIssuance(1, 0, 1)).toEqual({ flip: 0, create: 0 });
    expect(planIssuance(3, 1, 1)).toEqual({ flip: 1, create: 1 });
    expect(planIssuance(2, 0, 5)).toEqual({ flip: 0, create: 0 });
    expect(planIssuance(3, 0, 1)).toEqual({ flip: 0, create: 2 });
  });
});

describe("canTransitionOrder", () => {
  it("follows the order lifecycle", () => {
    expect(canTransitionOrder("PENDING_RECEIPT", "PENDING_VALIDATION")).toBe(true);
    expect(canTransitionOrder("PENDING_VALIDATION", "PENDING_VALIDATION")).toBe(true);
    expect(canTransitionOrder("PENDING_VALIDATION", "PAID")).toBe(true);
    expect(canTransitionOrder("PENDING_VALIDATION", "REJECTED")).toBe(true);
    expect(canTransitionOrder("REJECTED", "PENDING_VALIDATION")).toBe(true);
    expect(canTransitionOrder("PAID", "CANCELLED")).toBe(true);
    expect(canTransitionOrder("PENDING_CASH", "PAID")).toBe(true);
    expect(canTransitionOrder("PENDING_CASH", "CANCELLED")).toBe(true);
  });
  it("blocks illegal moves", () => {
    expect(canTransitionOrder("PENDING_RECEIPT", "PAID")).toBe(false);
    expect(canTransitionOrder("PAID", "REJECTED")).toBe(false);
    expect(canTransitionOrder("CANCELLED", "PAID")).toBe(false);
    // Cash is never reviewed with a receipt: only the door collects it.
    expect(canTransitionOrder("PENDING_CASH", "PENDING_VALIDATION")).toBe(false);
    expect(canTransitionOrder("PENDING_CASH", "REJECTED")).toBe(false);
  });
});

describe("PRE_ISSUE_STATUSES", () => {
  it("is the ticket statuses that mirror an unpaid order", () => {
    expect([...PRE_ISSUE_STATUSES].sort()).toEqual(["PENDING_RECEIPT", "PENDING_VALIDATION", "REJECTED"]);
  });
});

describe("blocksRegistration", () => {
  it("blocks every status except CANCELLED", () => {
    expect(ORDER_STATUSES.filter((st) => !blocksRegistration(st))).toEqual(["CANCELLED"]);
  });
});

describe("blocksWalkIn", () => {
  it("refuses a door walk-in when the email already has an open or PAID order", () => {
    for (const s of ["PENDING_RECEIPT", "PENDING_VALIDATION", "REJECTED", "PAID", "PENDING_CASH"] as const) {
      expect(blocksWalkIn(s)).toBe(true);
    }
  });
  it("lets a cancelled order be replaced", () => {
    expect(blocksWalkIn("CANCELLED")).toBe(false);
  });
});
