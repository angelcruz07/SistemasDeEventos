import type { PaymentMethod, TicketStatus } from "@/app/generated/prisma/enums";
import { isRegistrationOpen } from "./capacity";
import { policyFor } from "./payment";

export interface RegistrationEvent {
  registrationOpen: boolean;
  capacity: number | null;
  priceCents: number;
  allowSpei: boolean;
}

export type RefusalReason = "closed" | "full";

/**
 * Whether new public registrations are accepted. A paid event without SPEI is
 * treated as closed: cash is a door-only method and never public.
 */
export function registrationAvailability(
  event: RegistrationEvent,
  held: number,
): { open: true } | { open: false; reason: RefusalReason } {
  if (event.priceCents > 0 && !event.allowSpei) return { open: false, reason: "closed" };
  return isRegistrationOpen(event, held);
}

export type RegistrationDecision =
  | { kind: "duplicate"; ticketId: string; status: TicketStatus }
  | { kind: "refused"; reason: RefusalReason }
  | { kind: "create"; status: TicketStatus; method: PaymentMethod };

/** Pure decision for a public registration. `held` counts tickets that occupy a spot. */
export function decideRegistration(input: {
  event: RegistrationEvent;
  held: number;
  existing: { id: string; status: TicketStatus } | null;
}): RegistrationDecision {
  // An existing ticket always wins, so attendees can recover their link after close/sold out.
  if (input.existing) return { kind: "duplicate", ticketId: input.existing.id, status: input.existing.status };

  const availability = registrationAvailability(input.event, input.held);
  if (!availability.open) return { kind: "refused", reason: availability.reason };

  const policy = policyFor("public", input.event.priceCents);
  return { kind: "create", status: policy.initialStatus(input.event.priceCents), method: policy.method };
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
