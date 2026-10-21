import type { OrderStatus, PaymentMethod, TicketStatus } from "@/app/generated/prisma/enums";
import { policyFor, type PublicPaymentChoice } from "./payment";
import { publicPaymentMethods, registrationAvailability, type RegistrationEvent } from "./registration";

/** Per-order ticket limit when the event has no capacity. */
export const MAX_QUANTITY_UNCAPPED = 50;

/** `Order.amountCents` is a 32-bit Postgres integer. */
export const MAX_AMOUNT_CENTS = 2 ** 31 - 1;

export const ORDER_STATUSES: readonly OrderStatus[] = [
  "PENDING_RECEIPT",
  "PENDING_VALIDATION",
  "PAID",
  "REJECTED",
  "CANCELLED",
  "PENDING_CASH",
];

/** Accepts a positive safe integer or a plain digit string; anything else is null. */
export function parseQuantity(input: unknown): number | null {
  let value: number;
  if (typeof input === "number") {
    value = input;
  } else if (typeof input === "string" && /^\s*\d+\s*$/.test(input)) {
    value = Number(input.trim());
  } else {
    return null;
  }
  return Number.isSafeInteger(value) && value >= 1 ? value : null;
}

/**
 * Largest quantity a single order may request. Without capacity the cap is 50; with
 * one it is the remaining room (a capacity lowered below `held` means zero room).
 */
export function maxQuantity(capacity: number | null, held: number): number {
  if (capacity === null) return MAX_QUANTITY_UNCAPPED;
  return Math.max(0, capacity - held);
}

/** `unitPriceCents x quantity`, or null when invalid or beyond the 32-bit column. */
export function orderAmount(unitPriceCents: number, quantity: number): number | null {
  if (!Number.isInteger(unitPriceCents) || unitPriceCents < 0) return null;
  if (!Number.isInteger(quantity) || quantity < 1) return null;
  const amount = unitPriceCents * quantity;
  return Number.isSafeInteger(amount) && amount <= MAX_AMOUNT_CENTS ? amount : null;
}

/**
 * An OPEN order blocks a second one for the same (event, email). REJECTED counts as
 * open (organizer decision): the buyer re-uploads on the same order instead of
 * registering again. A cash pre-registration (PENDING_CASH) is open until the door collects it.
 */
export function isOpenOrder(status: OrderStatus): boolean {
  return (
    status === "PENDING_RECEIPT" ||
    status === "PENDING_VALIDATION" ||
    status === "REJECTED" ||
    status === "PENDING_CASH"
  );
}

/** Accepts "SPEI" or "CASH" from the public form; anything else means "no explicit choice". */
export function parsePaymentChoice(input: unknown): PublicPaymentChoice | null {
  return input === "SPEI" || input === "CASH" ? input : null;
}

/**
 * A door walk-in is refused when the email already owns an open or PAID order for the event.
 * The DB no longer enforces this (the (eventId, email) unique is gone), so the walk-in checks it.
 */
export function blocksWalkIn(status: OrderStatus): boolean {
  return isOpenOrder(status) || status === "PAID";
}

export type OrderRefusal = "closed" | "full" | "quantity" | "method";

export type OrderDecision =
  | { kind: "duplicate"; orderId: string }
  | { kind: "refused"; reason: OrderRefusal }
  | { kind: "create"; status: OrderStatus; method: PaymentMethod; amountCents: number; issueNow: number };

/**
 * Pure decision for a public purchase, taken inside the event-row lock. `held` counts
 * spots already taken (D5). Refusals never reveal how many spots remain.
 */
export function decideOrder(input: {
  event: RegistrationEvent;
  held: number;
  quantity: number;
  existing: { id: string; status: OrderStatus } | null;
  /** Buyer's pick for a paid event. Omitted: the first method the event offers (SPEI before cash). */
  method?: PublicPaymentChoice | null;
}): OrderDecision {
  const { event, held, quantity, existing } = input;
  // A cancelled event accepts nothing, not even link recovery.
  if (event.isCancelled) return { kind: "refused", reason: "closed" };
  // An open order always wins so buyers can recover their link after close/sold out.
  if (existing && isOpenOrder(existing.status)) return { kind: "duplicate", orderId: existing.id };

  const availability = registrationAvailability(event, held);
  if (!availability.open) return { kind: "refused", reason: availability.reason };

  if (!Number.isInteger(quantity) || quantity < 1) return { kind: "refused", reason: "quantity" };
  const room = maxQuantity(event.capacity, held);
  if (room === 0) return { kind: "refused", reason: "full" };
  if (quantity > room) return { kind: "refused", reason: "quantity" };

  const amountCents = orderAmount(event.priceCents, quantity);
  if (amountCents === null) return { kind: "refused", reason: "quantity" };

  const offered = publicPaymentMethods(event);
  const choice = input.method ?? offered[0];
  if (event.priceCents > 0 && (!choice || !offered.includes(choice))) return { kind: "refused", reason: "method" };

  const policy = policyFor("public", event.priceCents, choice);
  // On the public channel initialStatus only yields PENDING_RECEIPT, PENDING_CASH or PAID; all exist in OrderStatus.
  const status = policy.initialStatus(event.priceCents) as OrderStatus;
  return {
    kind: "create",
    status,
    method: policy.method,
    amountCents,
    // Free orders are issued PAID; cash pre-registrations get their (PENDING_CASH) tickets now so the QR can be emailed.
    issueNow: status === "PAID" || status === "PENDING_CASH" ? quantity : 0,
  };
}

/**
 * Approval issuance: tickets already issued count first, legacy pre-issue tickets are
 * flipped to PAID next, and only the rest of the quantity is created new.
 */
export function planIssuance(
  quantity: number,
  preIssue: number,
  alreadyIssued = 0,
): { flip: number; create: number } {
  // Tickets already PAID/CHECKED_IN (e.g. approved by older code) count toward the quantity.
  const remaining = Math.max(0, quantity - alreadyIssued);
  const flip = Math.min(preIssue, remaining);
  return { flip, create: remaining - flip };
}

export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING_RECEIPT: ["PENDING_VALIDATION", "CANCELLED"],
  // Self-transition models re-upload replacing the pending receipt.
  PENDING_VALIDATION: ["PENDING_VALIDATION", "PAID", "REJECTED", "CANCELLED"],
  PAID: ["CANCELLED"],
  REJECTED: ["PENDING_VALIDATION", "CANCELLED"],
  CANCELLED: [],
  // Collected at the door, or cancelled by the organizer (a no-show frees its spots).
  PENDING_CASH: ["PAID", "CANCELLED"],
};

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

/** Ticket statuses that only mirror an unpaid order (D4); approval flips them, it never duplicates them. */
export const PRE_ISSUE_STATUSES: readonly TicketStatus[] = ["PENDING_RECEIPT", "PENDING_VALIDATION", "REJECTED"];
