import Link from "next/link";
import { after } from "next/server";
import prisma from "@/app/lib/prisma";
import { formatMx } from "@/lib/datetime";
import { purgeExpiredReceiptsThrottled } from "@/lib/server/receipts-purge";
import { requireEventOwner } from "@/lib/server/guards";
import {
  PAGE_SIZE,
  STATUS_LABELS,
  buildAttendeeWhere,
  countByStatus,
  parseAttendeeFilter,
} from "@/lib/ticketing/attendees";
import { computeCashUp } from "@/lib/ticketing/cash-up";
import { formatShortCode } from "@/lib/ticketing/short-code";
import { TICKET_STATUSES } from "@/lib/ticketing/status";
import { CashUpSummary } from "../_components/CashUpSummary";
import { AttendeesList, type AttendeeRow } from "../_components/AttendeesList";

function describeAnswer(value: unknown): string {
  if (Array.isArray(value)) return value.map(String).join(", ");
  if (typeof value === "boolean") return value ? "Sí" : "No";
  return value === null || value === undefined ? "" : String(value);
}

function toAnswerEntries(answers: unknown): Array<{ label: string; value: string }> {
  if (typeof answers !== "object" || answers === null) return [];
  return Object.values(answers as Record<string, { label?: unknown; value?: unknown }>)
    .filter((a) => a && typeof a.label === "string")
    .map((a) => ({ label: a.label as string, value: describeAnswer(a.value) }));
}

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
  const [groups, total, paidTickets, tickets] = await Promise.all([
    prisma.ticket.groupBy({ by: ["status"], where: { eventId: event.id }, _count: { _all: true } }),
    prisma.ticket.count({ where }),
    prisma.ticket.findMany({
      where: { eventId: event.id, status: { in: ["PAID", "CHECKED_IN"] } },
      select: { paymentMethod: true, status: true, amountCents: true },
    }),
    prisma.ticket.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (filter.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        email: true,
        code: true,
        status: true,
        paymentMethod: true,
        answers: true,
        rejectionReason: true,
        createdAt: true,
        // Latest upload of the order only, and never the bytes.
        order: {
          select: {
            receipts: {
              orderBy: { uploadedAt: "desc" },
              take: 1,
              select: { id: true, mimeType: true, purgedAt: true },
            },
          },
        },
      },
    }),
  ]);

  const counts = countByStatus(groups);
  const rows: AttendeeRow[] = tickets.map((t) => {
    const latest = t.order.receipts[0];
    return {
      id: t.id,
      name: t.name,
      email: t.email,
      code: formatShortCode(t.code),
      status: t.status,
      paymentMethod: t.paymentMethod,
      createdAt: formatMx(t.createdAt),
      answers: toAnswerEntries(t.answers),
      rejectionReason: t.rejectionReason,
      receipt: latest ? { id: latest.id, mimeType: latest.mimeType, purged: latest.purgedAt !== null } : null,
    };
  });

  const cashUp = computeCashUp(paidTickets);
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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {TICKET_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/dashboard/events/${event.id}/attendees?status=${s}`}
            className="rounded-lg border bg-card p-3 hover:bg-accent transition-colors"
          >
            <p className="text-2xl font-bold">{counts[s]}</p>
            <p className="text-xs text-muted-foreground">{STATUS_LABELS[s]}</p>
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
          aria-label="Buscar asistentes"
        />
        <select
          name="status"
          defaultValue={filter.status ?? ""}
          className="h-9 rounded-md border bg-background px-3 text-sm"
          aria-label="Filtrar por estado"
        >
          <option value="">Todos los estados</option>
          {TICKET_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
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
          {total} {total === 1 ? "resultado" : "resultados"} · Página {Math.min(filter.page, pages)} de {pages}
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
