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

export type RegistrationAvailability = { open: true } | { open: false; reason: "closed" | "full" };

export function isRegistrationOpen(
  event: { registrationOpen: boolean; capacity: number | null },
  held: number,
): RegistrationAvailability {
  if (!event.registrationOpen) return { open: false, reason: "closed" };
  if (!hasSpot(held, event.capacity)) return { open: false, reason: "full" };
  return { open: true };
}
