import { describe, expect, it } from "vitest";
import { CASH_POLICY, FREE_POLICY, SPEI_POLICY, policyFor } from "./payment";

describe("payment policies", () => {
  it("SPEI is public and waits for a receipt when priced", () => {
    expect(SPEI_POLICY).toMatchObject({ method: "SPEI", channel: "public" });
    expect(SPEI_POLICY.initialStatus(35000)).toBe("PENDING_RECEIPT");
  });
  it("FREE is public and paid immediately", () => {
    expect(FREE_POLICY.initialStatus(0)).toBe("PAID");
  });
  it("CASH is door-only and checked in", () => {
    expect(CASH_POLICY).toMatchObject({ method: "CASH", channel: "door" });
    expect(CASH_POLICY.initialStatus(10000)).toBe("CHECKED_IN");
  });
  it("policyFor picks FREE for price 0 and SPEI otherwise on the public channel", () => {
    expect(policyFor("public", 0)).toBe(FREE_POLICY);
    expect(policyFor("public", 100)).toBe(SPEI_POLICY);
    expect(policyFor("door", 100)).toBe(CASH_POLICY);
  });
});
