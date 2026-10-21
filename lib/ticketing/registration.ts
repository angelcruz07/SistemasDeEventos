import type { TicketStatus } from "@/app/generated/prisma/enums";
import { isRegistrationOpen } from "./capacity";

export interface RegistrationEvent {
  registrationOpen: boolean;
  isCancelled: boolean;
  capacity: number | null;
  priceCents: number;
  allowSpei: boolean;
  /** Online pre-registration paid in cash at the door. */
  allowCashPrereg: boolean;
}

export type RefusalReason = "closed" | "full";

/**
 * Payment methods the public form offers for a paid event (empty for a free one).
 * `allowCash` (door walk-ins) is never public; `allowCashPrereg` is.
 */
export function publicPaymentMethods(event: {
  priceCents: number;
  allowSpei: boolean;
  allowCashPrereg: boolean;
}): ("SPEI" | "CASH")[] {
  if (event.priceCents === 0) return [];
  const methods: ("SPEI" | "CASH")[] = [];
  if (event.allowSpei) methods.push("SPEI");
  if (event.allowCashPrereg) methods.push("CASH");
  return methods;
}

/**
 * Whether new public registrations are accepted. A paid event with no public method
 * (neither SPEI nor cash pre-registration) is treated as closed: door-only cash is never public.
 */
export function registrationAvailability(
  event: RegistrationEvent,
  held: number,
): { open: true } | { open: false; reason: RefusalReason } {
  if (event.isCancelled) return { open: false, reason: "closed" };
  if (event.priceCents > 0 && publicPaymentMethods(event).length === 0) return { open: false, reason: "closed" };
  return isRegistrationOpen(event, held);
}

/** Which email to (re)send for an existing ticket. Cancelled tickets get nothing. */
export function emailKindFor(status: TicketStatus): "ticket" | "received" | null {
  switch (status) {
    case "PAID":
    case "CHECKED_IN":
      return "ticket";
    case "CANCELLED":
      return null;
    default:
      return "received";
  }
}

/** Prisma unique-constraint violation (P2002). */
export function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2002";
}

/**
 * A P2002 caused by the short code (safe to retry with a new one). The (eventId, email)
 * unique is NOT a collision: retrying cannot fix it. Unknown targets count as the code.
 */
export function isCodeCollision(error: unknown): boolean {
  if (!isUniqueViolation(error)) return false;
  let detail = "";
  try {
    const e = error as { meta?: unknown; message?: unknown };
    detail = JSON.stringify(e.meta ?? "") + String(e.message ?? "");
  } catch {
    // Unserializable metadata: fall through to "code".
  }
  return !/email/i.test(detail);
}
