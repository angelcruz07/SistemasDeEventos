import { describe, expect, it } from "vitest";
import { formatMxn, parsePesosToCents } from "./money";

describe("parsePesosToCents", () => {
  it("parses whole and decimal pesos", () => {
    expect(parsePesosToCents("350")).toBe(35000);
    expect(parsePesosToCents("350.5")).toBe(35050);
    expect(parsePesosToCents("350.50")).toBe(35050);
    expect(parsePesosToCents("0")).toBe(0);
    expect(parsePesosToCents(" 0.07 ")).toBe(7);
  });

  it("avoids float rounding errors", () => {
    expect(parsePesosToCents("19.99")).toBe(1999);
    expect(parsePesosToCents("1.15")).toBe(115);
  });

  it("rejects invalid input", () => {
    for (const bad of ["", "abc", "-5", "1.234", "1,5", "1e3", ".5", "5."]) {
      expect(parsePesosToCents(bad), bad).toBeNull();
    }
  });
});

describe("formatMxn", () => {
  it("formats cents with thousands separators", () => {
    expect(formatMxn(0)).toBe("$0.00");
    expect(formatMxn(35050)).toBe("$350.50");
    expect(formatMxn(123456789)).toBe("$1,234,567.89");
    expect(formatMxn(5)).toBe("$0.05");
  });
});
