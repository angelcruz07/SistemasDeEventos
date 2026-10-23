import Link from "next/link";
import { after } from "next/server";
import prisma from "@/app/lib/prisma";
import { purgeExpiredReceiptsThrottled } from "@/lib/server/receipts-purge";
import { requireEventOwner } from "@/lib/server/guards";
import {
  ORDER_STATUS_LABELS,
  PAGE_SIZE,
  buildAttendeeWhere,
  countByStatus,
  parseAttendeeFilter,
} from "@/lib/ticketing/attendees";
import { toOrderRow } from "@/lib/ticketing/attendee-rows";
import { parseFormSchema } from "@/lib/ticketing/form-schema";
import { computeCashUp } from "@/lib/ticketing/cash-up";
import { ORDER_STATUSES } from "@/lib/ticketing/order";
import { CashUpSummary } from "../_components/CashUpSummary";
import { AttendeesList } from "../_components/AttendeesList";

export default async function AttendeesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const { event } = await requireEventOwner(id);
  const filter = parseAttendeeFilter(await searchParams);

  // Lazy retention: runs after the response so the page never waits on it.
  after(() => purgeExpiredReceiptsThrottled().catch((e) => console.error("Receipt purge failed:", e?.name ?? "unknown")));

  const where = buildAttendeeWhere(event.id, filter);
  const [groups, total, paidOrders, issuedTickets, orders] = await Promise.all([
    prisma.order.groupBy({ by: ["status"], where: { eventId: event.id }, _count: { _all: true } }),
    prisma.order.count({ where }),
    // Cash-up money comes from every order that was ever paid, cancelled ones included (no refunds).
    prisma.order.findMany({
      where: { eventId: event.id, paidAt: { not: null } },
      select: { paymentMethod: true, status: true, amountCents: true, paidAt: true },
    }),
    prisma.ticket.findMany({
      where: { eventId: event.id, status: { in: ["PAID", "CHECKED_IN"] } },
      select: { paymentMethod: true, status: true },
    }),
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (filter.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        email: true,
        code: true,
        quantity: true,
        amountCents: true,
        status: true,
        paymentMethod: true,
        answers: true,
        rejectionReason: true,
        createdAt: true,
        paidAt: true,
        // Latest upload only, and never the bytes.
        receipts: {
          orderBy: { uploadedAt: "desc" },
          take: 1,
          select: { id: true, mimeType: true, purgedAt: true, uploadedAt: true },
        },
        tickets: {
          orderBy: { seq: "asc" },
          select: { id: true, code: true, seq: true, status: true, checkedInAt: true, checkedInBy: true },
        },
      },
    }),
  ]);

  const counts = countByStatus(groups);
  const formFields = parseFormSchema(event.formSchema)?.fields ?? [];
  const rows = orders.map((order) => toOrderRow(order, formFields));
  const cashUp = computeCashUp(paidOrders, issuedTickets);

  const exportQs = new URLSearchParams();
  if (filter.status) exportQs.set("status", filter.status);
  if (filter.q) exportQs.set("q", filter.q);
  const exportHref = `/dashboard/events/${event.id}/attendees/export${exportQs.size ? `?${exportQs}` : ""}`;

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (page: number) => {
    const qs = new URLSearchParams();
    if (filter.status) qs.set("status", filter.status);
    if (filter.q) qs.set("q", filter.q);
    if (page > 1) qs.set("page", String(page));
    const s = qs.toString();
    return `/dashboard/events/${event.id}/attendees${s ? `?${s}` : ""}`;
  };

  return (
    <div className="space-y-4">
      <CashUpSummary summary={cashUp} exportHref={exportHref} />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {ORDER_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/dashboard/events/${event.id}/attendees?status=${s}`}
            className="rounded-lg border bg-card p-3 hover:bg-accent transition-colors"
          >
            <p className="text-2xl font-bold">{counts[s]}</p>
            <p className="text-xs text-muted-foreground">{ORDER_STATUS_LABELS[s]}</p>
          </Link>
        ))}
      </div>

      <form method="get" className="flex flex-col sm:flex-row gap-2">
        <input
          type="search"
          name="q"
          defaultValue={filter.q}
          placeholder="Buscar por nombre, correo o código"
          className="h-9 flex-1 rounded-md border bg-background px-3 text-sm"
          aria-label="Buscar compras"
        />
        <select
          name="status"
          defaultValue={filter.status ?? ""}
          className="h-9 rounded-md border bg-background px-3 text-sm"
          aria-label="Filtrar por estado de la compra"
        >
          <option value="">Todos los estados</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {ORDER_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <button type="submit" className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
          Filtrar
        </button>
      </form>

      <AttendeesList eventId={event.id} rows={rows} />

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {total} {total === 1 ? "compra" : "compras"} · Página {Math.min(filter.page, pages)} de {pages}
        </span>
        <div className="flex gap-2">
          {filter.page > 1 && (
            <Link className="underline" href={pageHref(filter.page - 1)}>
              Anterior
            </Link>
          )}
          {filter.page < pages && (
            <Link className="underline" href={pageHref(filter.page + 1)}>
              Siguiente
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
