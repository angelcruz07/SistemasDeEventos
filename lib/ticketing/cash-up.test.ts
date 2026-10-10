import { describe, expect, it } from "vitest";
import { computeCashUp } from "./cash-up";

const t = (paymentMethod: "SPEI" | "CASH" | "FREE", status: string, amountCents = 10000) => ({
  paymentMethod,
  status: status as never,
  amountCents,
});

describe("computeCashUp", () => {
  it("totals 2 SPEI + 1 CASH at 10000", () => {
    const r = computeCashUp([t("SPEI", "PAID"), t("SPEI", "CHECKED_IN"), t("CASH", "CHECKED_IN")]);
    expect(r.byMethod.SPEI).toEqual({ count: 2, totalCents: 20000 });
    expect(r.byMethod.CASH).toEqual({ count: 1, totalCents: 10000 });
    expect(r.totalCents).toBe(30000);
    expect(r.formatted).toEqual({ SPEI: "$200.00", CASH: "$100.00", FREE: "$0.00", total: "$300.00" });
  });

  it("counts only collected money", () => {
    const r = computeCashUp([
      t("SPEI", "PENDING_RECEIPT"),
      t("SPEI", "PENDING_VALIDATION"),
      t("SPEI", "REJECTED"),
      t("SPEI", "CANCELLED"),
    ]);
    expect(r.totalCents).toBe(0);
    expect(r.byMethod.SPEI.count).toBe(0);
  });

  it("counts FREE tickets with zero amount", () => {
    const r = computeCashUp([t("FREE", "PAID", 5000), t("FREE", "CHECKED_IN", 0)]);
    expect(r.byMethod.FREE).toEqual({ count: 2, totalCents: 0 });
    expect(r.totalCents).toBe(0);
  });

  it("reports checked-in vs paid-not-yet-in", () => {
    const r = computeCashUp([t("SPEI", "PAID"), t("SPEI", "PAID"), t("CASH", "CHECKED_IN"), t("FREE", "PAID", 0)]);
    expect(r.checkedIn).toBe(1);
    expect(r.paidNotIn).toBe(3);
    expect(r.paidTotal).toBe(4);
  });
});
