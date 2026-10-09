import { describe, expect, it } from "vitest";
import { getClientIp, rateLimitKey } from "./request-keys";

const headers = (init: Record<string, string>) => new Headers(init);

describe("getClientIp", () => {
  it("uses the first hop of x-forwarded-for", () => {
    expect(getClientIp(headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip, then to a constant", () => {
    expect(getClientIp(headers({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(getClientIp(headers({}))).toBe("unknown");
  });

  it("ignores values that are not IP-shaped", () => {
    expect(getClientIp(headers({ "x-forwarded-for": "<script>, 1.2.3.4" }))).toBe("unknown");
  });
});

describe("rateLimitKey", () => {
  it("is deterministic, scoped and does not contain the raw value", () => {
    const a = rateLimitKey("register:email", "Ana@Example.com");
    expect(a).toBe(rateLimitKey("register:email", "ana@example.com"));
    expect(a).toMatch(/^register:email:[0-9a-f]{64}$/);
    expect(a).not.toContain("example");
    expect(rateLimitKey("register:ip", "ana@example.com")).not.toBe(a);
    expect(rateLimitKey("register:email", "bob@example.com")).not.toBe(a);
  });
});
