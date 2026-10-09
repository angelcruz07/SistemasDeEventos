import { createHash } from "node:crypto";

const IP_SHAPE = /^[0-9a-fA-F:.]{3,45}$/;

/**
 * Best-effort client IP. TRUST ASSUMPTION: the app runs behind a proxy that
 * overwrites `x-forwarded-for` (Vercel, nginx with proper config). If the
 * header can be spoofed by clients, per-IP limits are bypassable; the per-email
 * limit still applies. Without any header all clients share the "unknown" bucket.
 */
export function getClientIp(headers: { get(name: string): string | null }): string {
  const candidates = [headers.get("x-forwarded-for")?.split(",")[0], headers.get("x-real-ip")];
  for (const raw of candidates) {
    const value = raw?.trim();
    if (value && IP_SHAPE.test(value)) return value;
  }
  return "unknown";
}

/** Bucket key. The value is hashed so emails never sit in the rate-limit table. */
export function rateLimitKey(scope: string, value: string): string {
  return `${scope}:${createHash("sha256").update(value.trim().toLowerCase()).digest("hex")}`;
}
