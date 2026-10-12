import type { OrderStatus, PaymentMethod, TicketStatus } from "@/app/generated/prisma/enums";
import { policyFor } from "./payment";
import { registrationAvailability, type RegistrationEvent } from "./registration";

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
 * registering again.
 */
export function isOpenOrder(status: OrderStatus): boolean {
  return status === "PENDING_RECEIPT" || status === "PENDING_VALIDATION" || status === "REJECTED";
}

export type OrderRefusal = "closed" | "full" | "quantity";

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

  const policy = policyFor("public", event.priceCents);
  // initialStatus only yields PENDING_RECEIPT or PAID on the public channel; both exist in OrderStatus.
  const status = policy.initialStatus(event.priceCents) as OrderStatus;
  return {
    kind: "create",
    status,
    method: policy.method,
    amountCents,
    issueNow: status === "PAID" ? quantity : 0,
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
};

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

/** Ticket statuses that only mirror an unpaid order (D4); approval flips them, it never duplicates them. */
export const PRE_ISSUE_STATUSES: readonly TicketStatus[] = ["PENDING_RECEIPT", "PENDING_VALIDATION", "REJECTED"];

export interface LegacyTicket {
  id: string;
  eventId: string;
  code: string;
  name: string;
  email: string | null;
  answers: unknown;
  status: TicketStatus;
  paymentMethod: PaymentMethod;
  amountCents: number;
  currency: string;
  rejectionReason: string | null;
  reviewedAt: Date | null;
  registrationEmailSentAt: Date | null;
  createdAt: Date;
}

/**
 * The Order a ticket written by pre-order code stands for. Mirrors the migration
 * backfill exactly (Order.id = Ticket.id, same code, quantity 1, CHECKED_IN -> PAID)
 * so resolving it lazily is indistinguishable from having been backfilled.
 */
export function legacyOrderFromTicket(ticket: LegacyTicket) {
  return {
    id: ticket.id,
    eventId: ticket.eventId,
    code: ticket.code,
    name: ticket.name,
    email: ticket.email,
    answers: ticket.answers,
    quantity: 1,
    unitPriceCents: ticket.amountCents,
    amountCents: ticket.amountCents,
    currency: ticket.currency,
    paymentMethod: ticket.paymentMethod,
    status: (ticket.status === "CHECKED_IN" ? "PAID" : ticket.status) as OrderStatus,
    rejectionReason: ticket.rejectionReason,
    reviewedAt: ticket.reviewedAt,
    registrationEmailSentAt: ticket.registrationEmailSentAt,
    createdAt: ticket.createdAt,
  };
}

/**
 * Which order a public purchase collides with. An open order wins. Otherwise a ticket
 * already holding the email (legacy unique, dropped in the contract step) blocks the
 * purchase unless its order is open.
 */
export function resolveExistingOrder(input: {
  openOrder: { id: string; status: OrderStatus } | null;
  legacyOrder: { id: string; status: OrderStatus } | null;
}): {
  existing: { id: string; status: OrderStatus } | null;
  /** The settled (PAID/CANCELLED) order that owns the email through the legacy unique. */
  taken: { id: string; status: OrderStatus } | null;
} {
  if (input.openOrder) return { existing: input.openOrder, taken: null };
  const legacy = input.legacyOrder;
  if (!legacy) return { existing: null, taken: null };
  return isOpenOrder(legacy.status) ? { existing: legacy, taken: null } : { existing: null, taken: legacy };
}
