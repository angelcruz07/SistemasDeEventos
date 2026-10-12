import { describe, expect, it } from "vitest";
import {
  signDoorSession,
  signOrderToken,
  signTicketToken,
  verifyDoorSession,
  verifyOrderToken,
  verifyTicketToken,
  type DoorSessionPayload,
} from "./token";

const SECRET = "s".repeat(32);
const OTHER = "t".repeat(32);
const NOW = new Date("2026-10-26T18:00:00Z");

const session: DoorSessionPayload = {
  accessId: "access-1",
  version: 3,
  name: "Ana",
  exp: NOW.getTime() + 12 * 3600 * 1000,
};

describe("ticket token", () => {
  it("round-trips the ticket id", () => {
    const token = signTicketToken("ticket-123", SECRET);
    expect(verifyTicketToken(token, SECRET)).toBe("ticket-123");
  });

  it("is deterministic", () => {
    expect(signTicketToken("a", SECRET)).toBe(signTicketToken("a", SECRET));
  });

  it("is URL safe", () => {
    expect(signTicketToken("a-b_c", SECRET)).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  });

  it("rejects a wrong secret", () => {
    expect(verifyTicketToken(signTicketToken("a", SECRET), OTHER)).toBeNull();
  });

  it("rejects a tampered id", () => {
    const [, sig] = signTicketToken("a", SECRET).split(".");
    const forged = `${Buffer.from("b").toString("base64url")}.${sig}`;
    expect(verifyTicketToken(forged, SECRET)).toBeNull();
  });

  it("rejects a tampered or truncated signature", () => {
    const token = signTicketToken("a", SECRET);
    expect(verifyTicketToken(token.slice(0, -2), SECRET)).toBeNull();
    expect(verifyTicketToken(`${token}x`, SECRET)).toBeNull();
  });

  it("rejects malformed input without throwing", () => {
    for (const bad of ["", ".", "abc", "a.b.c", "!!.!!"]) {
      expect(verifyTicketToken(bad, SECRET)).toBeNull();
    }
  });

  it("does not accept a door session token", () => {
    expect(verifyTicketToken(signDoorSession(session, SECRET), SECRET)).toBeNull();
  });
});

describe("order token", () => {
  it("round-trips the order id", () => {
    expect(verifyOrderToken(signOrderToken("order-1", SECRET), SECRET)).toBe("order-1");
  });
  it("is deterministic and URL safe", () => {
    expect(signOrderToken("a", SECRET)).toBe(signOrderToken("a", SECRET));
    expect(signOrderToken("a-b_c", SECRET)).toMatch(/^[A-Za-z0-9_-]+.[A-Za-z0-9_-]+$/);
  });
  it("is not interchangeable with a ticket token", () => {
    expect(signOrderToken("a", SECRET)).not.toBe(signTicketToken("a", SECRET));
    expect(verifyOrderToken(signTicketToken("a", SECRET), SECRET)).toBeNull();
    expect(verifyTicketToken(signOrderToken("a", SECRET), SECRET)).toBeNull();
  });
  it("does not accept a door session token", () => {
    expect(verifyOrderToken(signDoorSession(session, SECRET), SECRET)).toBeNull();
    expect(verifyDoorSession(signOrderToken("a", SECRET), SECRET, NOW)).toBeNull();
  });
  it("rejects a wrong secret, tampering and malformed input", () => {
    const token = signOrderToken("a", SECRET);
    expect(verifyOrderToken(token, OTHER)).toBeNull();
    expect(verifyOrderToken(token.slice(0, -2), SECRET)).toBeNull();
    const [, sig] = token.split(".");
    expect(verifyOrderToken(`${Buffer.from("b").toString("base64url")}.${sig}`, SECRET)).toBeNull();
    for (const bad of ["", ".", "abc", "a.b.c", "!!.!!"]) expect(verifyOrderToken(bad, SECRET)).toBeNull();
  });
  it("throws on a short secret", () => {
    expect(() => signOrderToken("a", "x".repeat(31))).toThrow();
    expect(() => verifyOrderToken("a.b", "x".repeat(31))).toThrow();
  });
});

describe("door session", () => {
  it("round-trips the payload", () => {
    const token = signDoorSession(session, SECRET);
    expect(verifyDoorSession(token, SECRET, NOW)).toEqual(session);
  });

  it("rejects an expired session", () => {
    const token = signDoorSession(session, SECRET);
    expect(verifyDoorSession(token, SECRET, new Date(session.exp))).toBeNull();
  });

  it("rejects a wrong secret and tampering", () => {
    const token = signDoorSession(session, SECRET);
    expect(verifyDoorSession(token, OTHER, NOW)).toBeNull();
    const [body, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ ...session, version: 99 })).toString("base64url");
    expect(verifyDoorSession(`${forged}.${sig}`, SECRET, NOW)).toBeNull();
    expect(body).not.toBe(forged);
  });

  it("does not accept a ticket token", () => {
    expect(verifyDoorSession(signTicketToken("a", SECRET), SECRET, NOW)).toBeNull();
  });

  it("rejects malformed input and payload shapes", () => {
    expect(verifyDoorSession("garbage", SECRET, NOW)).toBeNull();
    expect(
      verifyDoorSession(signDoorSession({ ...session, version: "x" } as never, SECRET), SECRET, NOW),
    ).toBeNull();
  });
});

describe("malleability", () => {
  it("rejects non-canonical ticket tokens", () => {
    const [id, sig] = signTicketToken("ticket-1", SECRET).split(".");
    expect(verifyTicketToken(`${id}!.${sig}`, SECRET)).toBeNull();
    expect(verifyTicketToken(`${id}.${sig}=`, SECRET)).toBeNull();
    expect(verifyTicketToken(`${id}.${sig}!`, SECRET)).toBeNull();
  });

  it("rejects non-canonical door session tokens", () => {
    const [body, sig] = signDoorSession(session, SECRET).split(".");
    expect(verifyDoorSession(`${body}.${sig}=`, SECRET, NOW)).toBeNull();
    expect(verifyDoorSession(`${body}.${sig}!`, SECRET, NOW)).toBeNull();
    expect(verifyDoorSession(`${body}!.${sig}`, SECRET, NOW)).toBeNull();
  });
});

describe("secret length", () => {
  it("throws on a short secret for every operation", () => {
    const short = "x".repeat(31);
    expect(() => signTicketToken("a", short)).toThrow();
    expect(() => verifyTicketToken("a.b", short)).toThrow();
    expect(() => signDoorSession(session, short)).toThrow();
    expect(() => verifyDoorSession("a.b", short, NOW)).toThrow();
  });
});
