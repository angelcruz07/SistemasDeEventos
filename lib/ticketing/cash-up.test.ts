import { describe, expect, it } from "vitest";
import { computeCashUp } from "./cash-up";

type Method = "SPEI" | "CASH" | "FREE";

const order = (paymentMethod: Method, status: string, amountCents = 10000) => ({
  paymentMethod,
  status: status as never,
  amountCents,
});
const ticket = (paymentMethod: Method, status: string) => ({ paymentMethod, status: status as never });

describe("computeCashUp", () => {
  it("takes money from PAID orders grouped by method and counts from tickets", () => {
    const r = computeCashUp(
      [order("SPEI", "PAID", 30000), order("CASH", "PAID", 10000)],
      [ticket("SPEI", "PAID"), ticket("SPEI", "CHECKED_IN"), ticket("SPEI", "PAID"), ticket("CASH", "CHECKED_IN")],
    );
    expect(r.byMethod.SPEI).toEqual({ count: 3, totalCents: 30000 });
    expect(r.byMethod.CASH).toEqual({ count: 1, totalCents: 10000 });
    expect(r.totalCents).toBe(40000);
    expect(r.formatted).toEqual({ SPEI: "$300.00", CASH: "$100.00", FREE: "$0.00", total: "$400.00" });
  });

  it("counts only collected money: unpaid, rejected and cancelled orders add nothing", () => {
    const r = computeCashUp(
      [
        order("SPEI", "PENDING_RECEIPT"),
        order("SPEI", "PENDING_VALIDATION"),
        order("SPEI", "REJECTED"),
        order("SPEI", "CANCELLED"),
      ],
      [],
    );
    expect(r.totalCents).toBe(0);
    expect(r.byMethod.SPEI.count).toBe(0);
  });

  it("counts FREE tickets but never FREE money", () => {
    const r = computeCashUp([order("FREE", "PAID", 5000)], [ticket("FREE", "PAID"), ticket("FREE", "CHECKED_IN")]);
    expect(r.byMethod.FREE).toEqual({ count: 2, totalCents: 0 });
    expect(r.totalCents).toBe(0);
  });

  it("reports checked-in vs paid-not-yet-in from tickets", () => {
    const r = computeCashUp(
      [],
      [ticket("SPEI", "PAID"), ticket("SPEI", "PAID"), ticket("CASH", "CHECKED_IN"), ticket("FREE", "PAID")],
    );
    expect(r.checkedIn).toBe(1);
    expect(r.paidNotIn).toBe(3);
    expect(r.paidTotal).toBe(4);
  });

  it("ignores cancelled and unissued tickets in the counts", () => {
    const r = computeCashUp(
      [],
      [ticket("SPEI", "CANCELLED"), ticket("SPEI", "PENDING_VALIDATION"), ticket("SPEI", "PAID")],
    );
    expect(r.paidTotal).toBe(1);
    expect(r.byMethod.SPEI.count).toBe(1);
  });

  it("keeps the full amount of a paid order whose tickets were partially cancelled (no refunds)", () => {
    const r = computeCashUp(
      [order("SPEI", "PAID", 30000)],
      [ticket("SPEI", "PAID"), ticket("SPEI", "CANCELLED"), ticket("SPEI", "CANCELLED")],
    );
    expect(r.totalCents).toBe(30000);
    expect(r.paidTotal).toBe(1);
  });
});
