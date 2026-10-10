import type { PaymentMethod, TicketStatus } from "@/app/generated/prisma/enums";
import { formatMxn } from "./money";

export interface CashUpTicket {
  paymentMethod: PaymentMethod;
  status: TicketStatus;
  amountCents: number;
}

export interface MethodTotal {
  count: number;
  totalCents: number;
}

const METHODS: readonly PaymentMethod[] = ["SPEI", "CASH", "FREE"];

/** Only PAID and CHECKED_IN tickets count as collected; FREE never adds money. */
export function computeCashUp(tickets: CashUpTicket[]) {
  const byMethod = Object.fromEntries(METHODS.map((m) => [m, { count: 0, totalCents: 0 }])) as Record<
    PaymentMethod,
    MethodTotal
  >;
  let checkedIn = 0;
  let paidNotIn = 0;
  for (const t of tickets) {
    if (t.status !== "PAID" && t.status !== "CHECKED_IN") continue;
    if (t.status === "CHECKED_IN") checkedIn++;
    else paidNotIn++;
    byMethod[t.paymentMethod].count++;
    byMethod[t.paymentMethod].totalCents += t.paymentMethod === "FREE" ? 0 : t.amountCents;
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
