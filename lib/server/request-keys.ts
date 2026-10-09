import { createHash } from "node:crypto";

const IP_SHAPE = /^[0-9a-fA-F:.]{3,45}$/;

function validIp(raw: string | null | undefined): string | null {
  const value = raw?.trim();
  return value && IP_SHAPE.test(value) ? value : null;
}

/**
 * Best-effort client IP, or null when none can be trusted.
 *
 * TRUST ASSUMPTION: the app sits behind a reverse proxy we control. We prefer
 * `x-real-ip` (set by the proxy itself) and otherwise the RIGHTMOST
 * `x-forwarded-for` hop, which is the one our proxy appended; the leftmost hops
 * are client-supplied and spoofable. Callers must SKIP the per-IP limit on
 * null instead of sharing one bucket, which would let one client lock everyone out.
 */
export function getClientIp(headers: { get(name: string): string | null }): string | null {
  const real = validIp(headers.get("x-real-ip"));
  if (real) return real;
  const hops = headers.get("x-forwarded-for")?.split(",");
  return validIp(hops?.[hops.length - 1]);
}

/** Bucket key. The value is hashed so emails never sit in the rate-limit table. */
export function rateLimitKey(scope: string, value: string): string {
  return `${scope}:${createHash("sha256").update(value.trim().toLowerCase()).digest("hex")}`;
}
