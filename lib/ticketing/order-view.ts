import type { OrderStatus, TicketStatus } from "@/app/generated/prisma/enums";
import { PRE_ISSUE_STATUSES } from "./order";

export type OrderView =
  | { kind: "upload"; rejectionReason: string | null }
  | { kind: "review" }
  | { kind: "tickets" }
  | { kind: "cash" }
  | { kind: "cancelled" };

/** What the buyer-facing order page shows for each status. */
export function orderViewFor(order: {
  status: OrderStatus;
  rejectionReason: string | null;
  eventCancelled?: boolean;
}): OrderView {
  if (order.eventCancelled) return { kind: "cancelled" };
  switch (order.status) {
    case "PENDING_RECEIPT":
      return { kind: "upload", rejectionReason: null };
    case "REJECTED":
      return { kind: "upload", rejectionReason: order.rejectionReason };
    case "PENDING_VALIDATION":
      return { kind: "review" };
    case "PAID":
      return { kind: "tickets" };
    case "PENDING_CASH":
      return { kind: "cash" };
    case "CANCELLED":
      return { kind: "cancelled" };
  }
}

/** "Boleto 2 de 3": position of a ticket inside its order. */
export function ticketLabel(seq: number, quantity: number): string {
  return `Boleto ${seq} de ${quantity}`;
}

/** A ticket that only mirrors an unpaid order has no QR yet: its order page is where the buyer pays. */
export function ticketRedirectsToOrder(status: TicketStatus): boolean {
  return PRE_ISSUE_STATUSES.includes(status);
}
