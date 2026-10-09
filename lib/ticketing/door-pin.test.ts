import { describe, expect, it } from "vitest";
import {
  LOCK_DURATION_MS,
  MAX_FAILED_ATTEMPTS,
  generateDoorKey,
  generatePin,
  hashDoorKey,
  hashPin,
  isLocked,
  nextLockout,
  parseStaffName,
  sessionMatchesAccess,
  verifyPin,
} from "./door-pin";

describe("generatePin", () => {
  it("returns 6 digits, zero padded", () => {
    expect(generatePin(() => 42)).toBe("000042");
    expect(generatePin(() => 999999)).toBe("999999");
  });
  it("asks the RNG for the full 0..999999 range", () => {
    let args: [number, number] | undefined;
    generatePin((min, max) => {
      args = [min, max];
      return 1;
    });
    expect(args).toEqual([0, 1_000_000]);
  });
});

describe("hashPin / verifyPin", () => {
  it("verifies the right PIN and rejects a wrong one", async () => {
    const stored = await hashPin("123456");
    expect(await verifyPin("123456", stored)).toBe(true);
    expect(await verifyPin("123457", stored)).toBe(false);
  });
  it("never stores the raw PIN and salts every hash", async () => {
    const a = await hashPin("123456");
    const b = await hashPin("123456");
    expect(a).not.toContain("123456");
    expect(a).not.toBe(b);
    expect(a.startsWith("scrypt$")).toBe(true);
  });
  it("rejects malformed stored values instead of throwing", async () => {
    expect(await verifyPin("123456", "")).toBe(false);
    expect(await verifyPin("123456", "scrypt$x$y")).toBe(false);
    expect(await verifyPin("123456", "bcrypt$16384$aa$bb")).toBe(false);
  });
  it("rejects non 6-digit input without hashing", async () => {
    const stored = await hashPin("123456");
    expect(await verifyPin("12345", stored)).toBe(false);
    expect(await verifyPin("abcdef", stored)).toBe(false);
  });
});

describe("door key", () => {
  it("is URL-safe with at least 128 bits (here 256)", () => {
    const key = generateDoorKey();
    expect(key).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(generateDoorKey()).not.toBe(key);
  });
  it("hashes deterministically to sha256 hex", () => {
    expect(hashDoorKey("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

describe("lockout policy", () => {
  const now = new Date("2026-10-10T12:00:00Z");
  it("does not lock below the threshold", () => {
    expect(nextLockout(MAX_FAILED_ATTEMPTS - 1, now)).toBeNull();
  });
  it("locks for the cooldown at the threshold and above", () => {
    const until = new Date(now.getTime() + LOCK_DURATION_MS);
    expect(nextLockout(MAX_FAILED_ATTEMPTS, now)).toEqual(until);
    expect(nextLockout(MAX_FAILED_ATTEMPTS + 3, now)).toEqual(until);
  });
  it("uses 5 failures and 15 minutes", () => {
    expect(MAX_FAILED_ATTEMPTS).toBe(5);
    expect(LOCK_DURATION_MS).toBe(15 * 60 * 1000);
  });
  it("isLocked is true only before lockedUntil", () => {
    const until = new Date(now.getTime() + 1000);
    expect(isLocked(until, now)).toBe(true);
    expect(isLocked(until, until)).toBe(false);
    expect(isLocked(null, now)).toBe(false);
  });
});

describe("parseStaffName", () => {
  it("trims and accepts a normal name", () => {
    expect(parseStaffName("  Ana  ")).toEqual({ name: "Ana" });
  });
  it("rejects empty or blank", () => {
    expect(parseStaffName("   ")).toHaveProperty("error");
    expect(parseStaffName(undefined)).toHaveProperty("error");
  });
  it("rejects over 60 chars", () => {
    expect(parseStaffName("a".repeat(61))).toHaveProperty("error");
    expect(parseStaffName("a".repeat(60))).toEqual({ name: "a".repeat(60) });
  });
  it("strips control characters", () => {
    expect(parseStaffName("An\u0000a\n")).toEqual({ name: "Ana" });
  });
});

describe("sessionMatchesAccess", () => {
  const access = { id: "a1", sessionVersion: 3, revokedAt: null };
  const payload = { accessId: "a1", version: 3, name: "Ana", exp: 1 };
  it("accepts a matching session", () => {
    expect(sessionMatchesAccess(payload, access)).toBe(true);
  });
  it("rejects another access, an old version or a revoked access", () => {
    expect(sessionMatchesAccess({ ...payload, accessId: "a2" }, access)).toBe(false);
    expect(sessionMatchesAccess({ ...payload, version: 2 }, access)).toBe(false);
    expect(sessionMatchesAccess(payload, { ...access, revokedAt: new Date() })).toBe(false);
  });
});
