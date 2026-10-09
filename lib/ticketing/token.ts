import { createHmac, timingSafeEqual } from "node:crypto";

const TICKET_PURPOSE = "ticket:v1:";
const DOOR_PURPOSE = "door:v1:";

export interface DoorSessionPayload {
  accessId: string;
  version: number;
  name: string;
  /** Expiry as epoch milliseconds. */
  exp: number;
}

const b64 = (value: string) => Buffer.from(value, "utf8").toString("base64url");

function mac(secret: string, purpose: string, data: string): Buffer {
  return createHmac("sha256", secret).update(purpose + data).digest();
}

function signatureMatches(expected: Buffer, provided: string): boolean {
  const actual = Buffer.from(provided, "base64url");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

function split(token: string): [string, string] | null {
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return [parts[0], parts[1]];
}

export function signTicketToken(ticketId: string, secret: string): string {
  return `${b64(ticketId)}.${mac(secret, TICKET_PURPOSE, ticketId).toString("base64url")}`;
}

export function verifyTicketToken(token: string, secret: string): string | null {
  const parts = split(token);
  if (!parts) return null;
  const id = Buffer.from(parts[0], "base64url").toString("utf8");
  if (!id) return null;
  return signatureMatches(mac(secret, TICKET_PURPOSE, id), parts[1]) ? id : null;
}

export function signDoorSession(payload: DoorSessionPayload, secret: string): string {
  const body = b64(JSON.stringify(payload));
  return `${body}.${mac(secret, DOOR_PURPOSE, body).toString("base64url")}`;
}

export function verifyDoorSession(
  token: string,
  secret: string,
  now: Date,
): DoorSessionPayload | null {
  const parts = split(token);
  if (!parts || !signatureMatches(mac(secret, DOOR_PURPOSE, parts[0]), parts[1])) return null;
  try {
    const p = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    if (
      typeof p?.accessId !== "string" ||
      typeof p.name !== "string" ||
      !Number.isInteger(p.version) ||
      !Number.isFinite(p.exp) ||
      now.getTime() >= p.exp
    ) {
      return null;
    }
    return { accessId: p.accessId, version: p.version, name: p.name, exp: p.exp };
  } catch {
    return null;
  }
}
