import { describe, expect, it } from "vitest";
import { getClientIp, rateLimitKey } from "./request-keys";

const headers = (init: Record<string, string>) => new Headers(init);

describe("getClientIp", () => {
  it("prefers x-real-ip, which the proxy sets itself", () => {
    expect(getClientIp(headers({ "x-real-ip": "198.51.100.2", "x-forwarded-for": "6.6.6.6, 203.0.113.7" }))).toBe(
      "198.51.100.2",
    );
  });

  it("uses the rightmost x-forwarded-for hop (the one appended by our proxy)", () => {
    expect(getClientIp(headers({ "x-forwarded-for": "6.6.6.6, 203.0.113.7" }))).toBe("203.0.113.7");
    expect(getClientIp(headers({ "x-forwarded-for": "203.0.113.9" }))).toBe("203.0.113.9");
  });

  it("returns null when nothing usable is present", () => {
    expect(getClientIp(headers({}))).toBeNull();
  });

  it("ignores values that are not IP-shaped", () => {
    expect(getClientIp(headers({ "x-forwarded-for": "1.2.3.4, <script>" }))).toBeNull();
    expect(getClientIp(headers({ "x-real-ip": "nope", "x-forwarded-for": "1.2.3.4" }))).toBe("1.2.3.4");
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
