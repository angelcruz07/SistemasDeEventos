import { createHash, randomBytes, randomInt, scrypt, timingSafeEqual } from "node:crypto";

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCK_DURATION_MS = 15 * 60 * 1000;
export const MAX_STAFF_NAME_LENGTH = 60;

const PIN_LENGTH = 6;
const PIN_RE = /^\d{6}$/;
const SCRYPT_N = 16384;
const KEY_LENGTH = 32;
const SALT_BYTES = 16;
const DOOR_KEY_BYTES = 32;

type RandInt = (min: number, max: number) => number;

/** Uniform 6-digit numeric PIN, zero padded. `rand` is injectable for tests. */
export function generatePin(rand: RandInt = randomInt): string {
  return String(rand(0, 10 ** PIN_LENGTH)).padStart(PIN_LENGTH, "0");
}

/** Random URL-safe link key (256 bits). */
export function generateDoorKey(): string {
  return randomBytes(DOOR_KEY_BYTES).toString("base64url");
}

/** Only this hash is stored, so a DB leak does not reveal door links. */
export function hashDoorKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

function derive(pin: string, salt: Buffer, n: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(pin, salt, KEY_LENGTH, { N: n }, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

/** Format: `scrypt$N$saltHex$hashHex`. The raw PIN is never persisted. */
export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const hash = await derive(pin, salt, SCRYPT_N);
  return `scrypt$${SCRYPT_N}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  if (!PIN_RE.test(pin)) return false;
  const [scheme, nRaw, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !nRaw || !saltHex || !hashHex) return false;
  const n = Number(nRaw);
  if (!Number.isInteger(n) || n < 2 || n > 2 ** 20) return false;
  const expected = Buffer.from(hashHex, "hex");
  const salt = Buffer.from(saltHex, "hex");
  if (expected.length !== KEY_LENGTH || salt.length === 0) return false;
  try {
    const actual = await derive(pin, salt, n);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/** Lock instant once `failedAttempts` reaches the threshold; null while still allowed. */
export function nextLockout(failedAttempts: number, now: Date): Date | null {
  return failedAttempts >= MAX_FAILED_ATTEMPTS ? new Date(now.getTime() + LOCK_DURATION_MS) : null;
}

export function isLocked(lockedUntil: Date | null, now: Date): boolean {
  return lockedUntil !== null && lockedUntil.getTime() > now.getTime();
}

export function parseStaffName(input: unknown): { name: string } | { error: string } {
  // eslint-disable-next-line no-control-regex
  const name = typeof input === "string" ? input.replace(/[\u0000-\u001f\u007f]/g, "").trim() : "";
  if (!name) return { error: "Escribe tu nombre." };
  if (name.length > MAX_STAFF_NAME_LENGTH) {
    return { error: `El nombre no puede superar ${MAX_STAFF_NAME_LENGTH} caracteres.` };
  }
  return { name };
}
