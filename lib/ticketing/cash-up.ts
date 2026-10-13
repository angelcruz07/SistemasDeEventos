import type { OrderStatus, PaymentMethod, TicketStatus } from "@/app/generated/prisma/enums";
import { formatMxn } from "./money";

export interface CashUpOrder {
  paymentMethod: PaymentMethod;
  status: OrderStatus;
  amountCents: number;
}

export interface CashUpTicket {
  paymentMethod: PaymentMethod;
  status: TicketStatus;
}

export interface MethodTotal {
  count: number;
  totalCents: number;
}

const METHODS: readonly PaymentMethod[] = ["SPEI", "CASH", "FREE"];

/**
 * Money comes from PAID orders (FREE never adds money); counts come from issued
 * (PAID/CHECKED_IN) tickets. An order keeps its full amount when some of its tickets are
 * cancelled later: there are no refunds, so the cash collected does not change.
 */
export function computeCashUp(orders: CashUpOrder[], tickets: CashUpTicket[]) {
  const byMethod = Object.fromEntries(METHODS.map((m) => [m, { count: 0, totalCents: 0 }])) as Record<
    PaymentMethod,
    MethodTotal
  >;
  for (const o of orders) {
    if (o.status !== "PAID" || o.paymentMethod === "FREE") continue;
    byMethod[o.paymentMethod].totalCents += o.amountCents;
  }
  let checkedIn = 0;
  let paidNotIn = 0;
  for (const t of tickets) {
    if (t.status !== "PAID" && t.status !== "CHECKED_IN") continue;
    if (t.status === "CHECKED_IN") checkedIn++;
    else paidNotIn++;
    byMethod[t.paymentMethod].count++;
  }
  const totalCents = METHODS.reduce((sum, m) => sum + byMethod[m].totalCents, 0);
  return {
    byMethod,
    totalCents,
    checkedIn,
    paidNotIn,
    paidTotal: checkedIn + paidNotIn,
    formatted: {
      SPEI: formatMxn(byMethod.SPEI.totalCents),
      CASH: formatMxn(byMethod.CASH.totalCents),
      FREE: formatMxn(byMethod.FREE.totalCents),
      total: formatMxn(totalCents),
    },
  };
}
