import type { OrderStatus, PaymentMethod, TicketStatus } from "@/app/generated/prisma/enums";
import { formatMx } from "@/lib/datetime";
import { formatMxn } from "./money";
import { PRE_ISSUE_STATUSES, canTransitionOrder } from "./order";
import { canApprove, canCancel, canMarkPaid, resendKindFor } from "./review";
import { formatShortCode } from "./short-code";

export interface OrderRowTicketInput {
  id: string;
  code: string;
  seq: number;
  status: TicketStatus;
  checkedInAt: Date | null;
  checkedInBy: string | null;
}

export interface OrderRowInput {
  id: string;
  code: string;
  name: string;
  email: string | null;
  quantity: number;
  amountCents: number;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  createdAt: Date;
  paidAt: Date | null;
  rejectionReason: string | null;
  answers: unknown;
  receipts: Array<{ id: string; mimeType: string; purgedAt: Date | null; uploadedAt: Date }>;
  tickets: OrderRowTicketInput[];
}

export interface OrderRowTicket {
  id: string;
  code: string;
  position: string;
  status: TicketStatus;
  checkedInAt: string | null;
  checkedInBy: string | null;
  canCancel: boolean;
}

export interface OrderRow {
  id: string;
  name: string;
  email: string | null;
  code: string;
  quantity: number;
  amount: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  createdAt: string;
  paid: boolean;
  answers: Array<{ label: string; value: string }>;
  rejectionReason: string | null;
  receipt: { id: string; mimeType: string; purged: boolean } | null;
  tickets: OrderRowTicket[];
  canReview: boolean;
  canCancel: boolean;
  canResend: boolean;
  /** The organizer can tick "Pagado" by hand. */
  canMarkPaid: boolean;
}

/**
 * Tickets that actually exist for the buyer. A quantity-1 order that is still unpaid carries a
 * pre-issue mirror ticket (D4); it is bookkeeping, not an issued ticket, so views skip it. The
 * same goes for the cancelled mirror of an order that was cancelled without ever being paid.
 */
export function issuedTickets<T extends { status: TicketStatus }>(
  tickets: T[],
  order?: { status: OrderStatus; paidAt: Date | null },
): T[] {
  // Cancelled before ever being paid: its mirror ticket was never issued, so there is nothing to show.
  if (order && order.status === "CANCELLED" && order.paidAt === null) return [];
  return tickets.filter((t) => !PRE_ISSUE_STATUSES.includes(t.status));
}

function describeAnswer(value: unknown): string {
  if (Array.isArray(value)) return value.map(String).join(", ");
  if (typeof value === "boolean") return value ? "Sí" : "No";
  return value === null || value === undefined ? "" : String(value);
}

function toAnswerEntries(answers: unknown): Array<{ label: string; value: string }> {
  if (typeof answers !== "object" || answers === null) return [];
  return Object.values(answers as Record<string, { label?: unknown; value?: unknown }>)
    .filter((a) => a && typeof a === "object" && typeof a.label === "string")
    .map((a) => ({ label: a.label as string, value: describeAnswer(a.value) }));
}

export function toOrderRow(order: OrderRowInput): OrderRow {
  const latest = [...order.receipts].sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime())[0];
  const tickets = issuedTickets(order.tickets, order)
    .sort((a, b) => a.seq - b.seq)
    .map((t) => ({
      id: t.id,
      code: formatShortCode(t.code),
      position: `${t.seq} de ${order.quantity}`,
      status: t.status,
      checkedInAt: t.checkedInAt ? formatMx(t.checkedInAt) : null,
      checkedInBy: t.checkedInBy,
      // An unpaid cash ticket is cancelled through its order (the amount due belongs to the whole order).
      canCancel: canCancel(t.status) && t.status !== "PENDING_CASH",
    }));
  return {
    id: order.id,
    name: order.name,
    email: order.email,
    code: formatShortCode(order.code),
    quantity: order.quantity,
    amount: formatMxn(order.amountCents),
    status: order.status,
    paymentMethod: order.paymentMethod,
    createdAt: formatMx(order.createdAt),
    paid: order.paidAt !== null,
    answers: toAnswerEntries(order.answers),
    rejectionReason: order.rejectionReason,
    receipt: latest ? { id: latest.id, mimeType: latest.mimeType, purged: latest.purgedAt !== null } : null,
    tickets,
    canReview: canApprove(order.status),
    canCancel: canTransitionOrder(order.status, "CANCELLED"),
    canResend: resendKindFor(order.status) !== null && order.email !== null,
    canMarkPaid: canMarkPaid(order.status),
  };
}
