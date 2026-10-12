import type { TicketStatus } from "@/app/generated/prisma/enums";

/** Only these statuses occupy a spot. REJECTED, PENDING_RECEIPT and CANCELLED do not. */
export const HOLDING_STATUSES: readonly TicketStatus[] = [
  "PENDING_VALIDATION",
  "PAID",
  "CHECKED_IN",
];

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
  orphanPendingTickets: number;
}): number {
  return (input.pendingQuantity ?? 0) + input.issuedTickets + input.orphanPendingTickets;
}
