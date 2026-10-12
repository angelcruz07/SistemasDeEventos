import { createHmac, timingSafeEqual } from "node:crypto";

const TICKET_PURPOSE = "ticket:v1:";
const ORDER_PURPOSE = "order:v1:";
const DOOR_PURPOSE = "door:v1:";
const MIN_SECRET_LENGTH = 32;
const B64URL_RE = /^[A-Za-z0-9_-]+$/;

export interface DoorSessionPayload {
  accessId: string;
  version: number;
  name: string;
  /** Expiry as epoch milliseconds. */
  exp: number;
}

const b64 = (value: string) => Buffer.from(value, "utf8").toString("base64url");

function assertSecret(secret: string): void {
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`Signing secret must be at least ${MIN_SECRET_LENGTH} characters`);
  }
}

function mac(secret: string, purpose: string, data: string): Buffer {
  return createHmac("sha256", secret).update(purpose + data).digest();
}

/** Decodes a base64url part only when it is canonical (no lenient or malleable forms). */
function decodeCanonical(part: string): Buffer | null {
  if (!B64URL_RE.test(part)) return null;
  const decoded = Buffer.from(part, "base64url");
  return decoded.toString("base64url") === part ? decoded : null;
}

function signatureMatches(expected: Buffer, provided: string): boolean {
  const actual = decodeCanonical(provided);
  if (!actual || actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

function split(token: string): [string, string] | null {
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return [parts[0], parts[1]];
}

function signId(purpose: string, id: string, secret: string): string {
  assertSecret(secret);
  return `${b64(id)}.${mac(secret, purpose, id).toString("base64url")}`;
}

function verifyId(purpose: string, token: string, secret: string): string | null {
  assertSecret(secret);
  const parts = split(token);
  if (!parts) return null;
  const idBytes = decodeCanonical(parts[0]);
  if (!idBytes) return null;
  const id = idBytes.toString("utf8");
  if (!id || b64(id) !== parts[0]) return null;
  return signatureMatches(mac(secret, purpose, id), parts[1]) ? id : null;
}

export const signTicketToken = (ticketId: string, secret: string): string => signId(TICKET_PURPOSE, ticketId, secret);

export const verifyTicketToken = (token: string, secret: string): string | null =>
  verifyId(TICKET_PURPOSE, token, secret);

/** Buyer-facing order link token; the purpose prefix keeps it distinct from ticket and door tokens. */
export const signOrderToken = (orderId: string, secret: string): string => signId(ORDER_PURPOSE, orderId, secret);

export const verifyOrderToken = (token: string, secret: string): string | null =>
  verifyId(ORDER_PURPOSE, token, secret);

export function signDoorSession(payload: DoorSessionPayload, secret: string): string {
  assertSecret(secret);
  const body = b64(JSON.stringify(payload));
  return `${body}.${mac(secret, DOOR_PURPOSE, body).toString("base64url")}`;
}

export function verifyDoorSession(
  token: string,
  secret: string,
  now: Date,
): DoorSessionPayload | null {
  assertSecret(secret);
  const parts = split(token);
  if (!parts || !decodeCanonical(parts[0])) return null;
  if (!signatureMatches(mac(secret, DOOR_PURPOSE, parts[0]), parts[1])) return null;
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
