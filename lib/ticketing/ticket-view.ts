import type { TicketStatus } from "@/app/generated/prisma/enums";

export type TicketView =
  | { kind: "upload"; rejectionReason: string | null }
  | { kind: "review" }
  /** `cashPending`: a cash pre-registration whose QR works but whose amount is collected at the door. */
  | { kind: "ticket"; checkedIn: boolean; cashPending?: boolean }
  | { kind: "cancelled" };

/** What the attendee-facing ticket page shows for each status. */
export function ticketViewFor(ticket: {
  status: TicketStatus;
  rejectionReason: string | null;
  eventCancelled?: boolean;
}): TicketView {
  if (ticket.eventCancelled) return { kind: "cancelled" };
  switch (ticket.status) {
    case "PENDING_RECEIPT":
      return { kind: "upload", rejectionReason: null };
    case "REJECTED":
      return { kind: "upload", rejectionReason: ticket.rejectionReason };
    case "PENDING_VALIDATION":
      return { kind: "review" };
    case "PAID":
      return { kind: "ticket", checkedIn: false };
    case "PENDING_CASH":
      return { kind: "ticket", checkedIn: false, cashPending: true };
    case "CHECKED_IN":
      return { kind: "ticket", checkedIn: true };
    case "CANCELLED":
      return { kind: "cancelled" };
  }
}
