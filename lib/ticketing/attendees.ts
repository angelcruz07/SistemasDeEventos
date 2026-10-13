import type { OrderStatus, PaymentMethod, TicketStatus } from "@/app/generated/prisma/enums";
import { ORDER_STATUSES } from "./order";
import { normalizeShortCode } from "./short-code";

export const PAGE_SIZE = 25;
/** Keeps `skip` far below the Int32 limit Prisma/Postgres accept. */
export const MAX_PAGE = 10000;
const MAX_QUERY_LENGTH = 100;
const MIN_CODE_QUERY = 2;

export const STATUS_LABELS: Record<TicketStatus, string> = {
  PENDING_RECEIPT: "Pendiente de comprobante",
  PENDING_VALIDATION: "Pendiente de validar",
  PAID: "Pagado",
  CHECKED_IN: "Ingresó",
  REJECTED: "Rechazado",
  CANCELLED: "Cancelado",
};

/** Order-level labels: the attendees list and the CSV are order-centric. */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING_RECEIPT: STATUS_LABELS.PENDING_RECEIPT,
  PENDING_VALIDATION: STATUS_LABELS.PENDING_VALIDATION,
  PAID: STATUS_LABELS.PAID,
  REJECTED: STATUS_LABELS.REJECTED,
  CANCELLED: STATUS_LABELS.CANCELLED,
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = { SPEI: "SPEI", CASH: "Efectivo", FREE: "Gratis" };

export interface AttendeeFilter {
  status?: OrderStatus;
  q: string;
  page: number;
}

type RawParam = string | string[] | undefined;

const first = (value: RawParam): string | undefined => (Array.isArray(value) ? value[0] : value);

export function parseAttendeeFilter(params: Record<string, RawParam>): AttendeeFilter {
  const rawStatus = first(params.status);
  const status = ORDER_STATUSES.find((s) => s === rawStatus);
  const q = (first(params.q) ?? "").trim().slice(0, MAX_QUERY_LENGTH);
  const rawPage = first(params.page);
  const page = rawPage && /^\d+$/.test(rawPage) ? Math.min(MAX_PAGE, Math.max(1, Number(rawPage))) : 1;
  return { status, q, page };
}

export interface AttendeeWhere {
  eventId: string;
  status?: OrderStatus;
  OR?: Array<
    | { name: { contains: string; mode: "insensitive" } }
    | { email: { contains: string; mode: "insensitive" } }
    | { code: { contains: string } }
    | { tickets: { some: { code: { contains: string } } } }
  >;
}

/**
 * Where clause over ORDERS. The status filter is the order status; search matches buyer
 * name, email and (normalized, so "7k3-q9m" works) the order code or any of its ticket codes.
 */
export function buildAttendeeWhere(eventId: string, filter: AttendeeFilter): AttendeeWhere {
  const where: AttendeeWhere = { eventId };
  if (filter.status) where.status = filter.status;
  if (filter.q) {
    where.OR = [
      { name: { contains: filter.q, mode: "insensitive" } },
      { email: { contains: filter.q, mode: "insensitive" } },
    ];
    const code = normalizeShortCode(filter.q);
    if (code.length >= MIN_CODE_QUERY) {
      where.OR.push({ code: { contains: code } }, { tickets: { some: { code: { contains: code } } } });
    }
  }
  return where;
}

export function countByStatus(groups: Array<{ status: OrderStatus; _count: { _all: number } }>) {
  const counts = Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0])) as Record<OrderStatus, number>;
  for (const g of groups) counts[g.status] = g._count._all;
  return counts;
}
