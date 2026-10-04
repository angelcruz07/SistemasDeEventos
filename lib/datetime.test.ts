import { describe, expect, it } from "vitest";
import { formatMx } from "./datetime";

describe("formatMx", () => {
  it("renders a UTC instant in Mexico City time (UTC-6, no DST)", () => {
    // 2026-10-27T01:30:00Z is still Oct 26, 19:30 in Mexico City
    expect(formatMx(new Date("2026-10-27T01:30:00Z"))).toBe("26/10/2026 19:30");
  });

  it("rolls the date back across the UTC day boundary", () => {
    expect(formatMx(new Date("2026-01-01T05:59:00Z"))).toBe("31/12/2025 23:59");
  });

  it("keeps the same date just after local midnight", () => {
    expect(formatMx(new Date("2026-01-01T06:00:00Z"))).toBe("01/01/2026 00:00");
  });

  it("accepts ISO strings", () => {
    expect(formatMx("2026-06-15T18:00:00Z")).toBe("15/06/2026 12:00");
  });
});
