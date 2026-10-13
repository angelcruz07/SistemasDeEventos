import { describe, expect, it } from "vitest";
import { clampQuantity, orderTotalLabel } from "./quantity-input";

describe("clampQuantity", () => {
  it("keeps a valid value", () => {
    expect(clampQuantity("3", 10)).toBe(3);
    expect(clampQuantity(3, 10)).toBe(3);
  });
  it("falls back to 1 for empty, zero, negative or non-numeric input", () => {
    for (const raw of ["", "0", "-2", "abc", "1.5", NaN]) expect(clampQuantity(raw, 10)).toBe(1);
  });
  it("caps at the maximum", () => {
    expect(clampQuantity("99", 10)).toBe(10);
  });
  it("never goes below 1 even when the maximum is 0", () => {
    expect(clampQuantity("4", 0)).toBe(1);
  });
});

describe("orderTotalLabel", () => {
  it("multiplies unit price by quantity", () => {
    expect(orderTotalLabel(15000, 3)).toBe("$450.00");
  });
  it("says Gratis for free events", () => {
    expect(orderTotalLabel(0, 5)).toBe("Gratis");
  });
  it("uses the same bounds as the server and flags amounts beyond the column", () => {
    expect(orderTotalLabel(2 ** 31 - 1, 2)).toBeNull();
  });
});
