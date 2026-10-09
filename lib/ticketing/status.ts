import type { PaymentMethod, TicketStatus } from "@/app/generated/prisma/enums";

export const TICKET_STATUSES: readonly TicketStatus[] = [
  "PENDING_RECEIPT",
  "PENDING_VALIDATION",
  "PAID",
  "CHECKED_IN",
  "REJECTED",
  "CANCELLED",
];

const TRANSITIONS: Record<TicketStatus, readonly TicketStatus[]> = {
  PENDING_RECEIPT: ["PENDING_VALIDATION", "CANCELLED"],
  // Self-transition models re-upload replacing the pending receipt.
  PENDING_VALIDATION: ["PENDING_VALIDATION", "PAID", "REJECTED", "CANCELLED"],
  PAID: ["CHECKED_IN", "CANCELLED"],
  REJECTED: ["PENDING_VALIDATION", "CANCELLED"],
  CHECKED_IN: [],
  CANCELLED: [],
};

export function canTransition(from: TicketStatus, to: TicketStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export interface InitialStatusInput {
  method: PaymentMethod;
  priceCents: number;
  channel: "public" | "door";
}

export function initialStatus({ method, priceCents, channel }: InitialStatusInput): TicketStatus {
  if (channel === "door") {
    if (method !== "CASH") throw new Error("Door registrations must be CASH");
    return "CHECKED_IN";
  }
  if (method === "CASH") throw new Error("CASH is only available at the door");
  return priceCents === 0 ? "PAID" : "PENDING_RECEIPT";
}
