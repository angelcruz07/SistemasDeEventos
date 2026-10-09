import { createHash, timingSafeEqual } from "node:crypto";

const sha = (value: string) => createHash("sha256").update(value).digest();

/** Bearer check for cron endpoints. An unset or empty secret disables the endpoint. */
export function isCronAuthorized(authorization: string | null, secret: string | undefined): boolean {
  if (!secret || !authorization?.startsWith("Bearer ")) return false;
  // Hashing first gives equal-length buffers, so timingSafeEqual never throws on length.
  return timingSafeEqual(sha(authorization.slice("Bearer ".length)), sha(secret));
}
