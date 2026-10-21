import type { TicketStatus } from "@/app/generated/prisma/enums";

/** Only these statuses occupy a spot. REJECTED, PENDING_RECEIPT and CANCELLED do not. */
export const HOLDING_STATUSES: readonly TicketStatus[] = [
  "PENDING_VALIDATION",
  "PAID",
  "CHECKED_IN",
  "PENDING_CASH",
];

/**
 * Ticket statuses that hold one spot each in `countHeld` (D5): issued tickets plus cash
 * pre-registrations, whose QR already exists and whose buyer is expected at the door.
 */
export const SPOT_TICKET_STATUSES: readonly TicketStatus[] = ["PAID", "CHECKED_IN", "PENDING_CASH"];

export function countHeld(statuses: readonly TicketStatus[]): number {
  return statuses.filter((s) => HOLDING_STATUSES.includes(s)).length;
}

/** `capacity` null means unlimited. */
export function hasSpot(held: number, capacity: number | null): boolean {
  return capacity === null || held < capacity;
}

/** Whether `quantity` more spots fit. `capacity` null means unlimited. */
export function hasRoom(held: number, quantity: number, capacity: number | null): boolean {
  return capacity === null || held + quantity <= capacity;
}

export type RegistrationAvailability = { open: true } | { open: false; reason: "closed" | "full" };

export function isRegistrationOpen(
  event: { registrationOpen: boolean; capacity: number | null },
  held: number,
): RegistrationAvailability {
  if (!event.registrationOpen) return { open: false, reason: "closed" };
  if (!hasSpot(held, event.capacity)) return { open: false, reason: "full" };
  return { open: true };
}

/**
 * Spots held (design D5): validating orders hold their quantity, issued tickets hold
 * one each, and an orderless legacy ticket (written by pre-order code) that is
 * validating holds one. Legacy pre-issue tickets that have an order count only through it.
 */
export function heldTotal(input: {
  pendingQuantity: number | null;
  issuedTickets: number;
  /** Issued tickets that belong to a still-validating order: already inside `issuedTickets`. */
  issuedOfPending?: number;
}): number {
  const pending = Math.max(0, (input.pendingQuantity ?? 0) - (input.issuedOfPending ?? 0));
  return pending + input.issuedTickets;
}
