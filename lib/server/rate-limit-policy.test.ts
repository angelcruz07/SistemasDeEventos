import { describe, expect, it } from "vitest";
import { purgeCutoff, shouldPurge } from "./rate-limit-policy";

describe("shouldPurge", () => {
  it("fires only for the lowest ~1% of random draws", () => {
    expect(shouldPurge(0)).toBe(true);
    expect(shouldPurge(0.0099)).toBe(true);
    expect(shouldPurge(0.01)).toBe(false);
    expect(shouldPurge(0.9)).toBe(false);
  });

  it("honours a custom probability", () => {
    expect(shouldPurge(0.4, 0.5)).toBe(true);
    expect(shouldPurge(0.6, 0.5)).toBe(false);
  });
});

describe("purgeCutoff", () => {
  it("is the largest window ago", () => {
    const now = new Date("2026-10-08T12:00:00Z");
    expect(purgeCutoff(now, 600_000).toISOString()).toBe("2026-10-08T11:50:00.000Z");
  });
});
