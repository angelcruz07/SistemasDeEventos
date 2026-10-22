import prisma from "@/app/lib/prisma";
import type { PaymentMethod } from "@/app/generated/prisma/enums";
import { formatMx } from "@/lib/datetime";
import { requireEventOwner } from "@/lib/server/guards";
import { ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS } from "@/lib/ticketing/attendees";
import { computeCashUp } from "@/lib/ticketing/cash-up";
import {
  checkInTimeline,
  computeEventKpis,
  formatNumber,
  formatPercent,
  mxDayKey,
  ratio,
  registrationTimeline,
  summarizeForm,
  type StatsOrder,
} from "@/lib/ticketing/event-stats";
import { parseFormSchema } from "@/lib/ticketing/form-schema";
import { formatMxn } from "@/lib/ticketing/money";
import { ORDER_STATUSES } from "@/lib/ticketing/order";
import { FormResponses, type ResponseScope } from "../_components/FormResponses";
import { BarList, ChartCard, ColumnChart, EmptyChart, StatTile } from "../_components/StatsCharts";

const METHODS: readonly PaymentMethod[] = ["SPEI", "CASH", "FREE"];
const tickets = (n: number) => `${formatNumber(n)} ${n === 1 ? "boleto" : "boletos"}`;
const orders = (n: number) => `${formatNumber(n)} ${n === 1 ? "compra" : "compras"}`;

export default async function EventStatsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const { event } = await requireEventOwner(id);
  const scope: ResponseScope = (await searchParams).scope === "paid" ? "paid" : "all";

  const [orderRows, ticketRows] = await Promise.all([
    prisma.order.findMany({
      where: { eventId: event.id },
      orderBy: { createdAt: "asc" },
      select: {
        status: true,
        paymentMethod: true,
        quantity: true,
        amountCents: true,
        paidAt: true,
        createdAt: true,
        email: true,
        answers: true,
      },
    }),
    prisma.ticket.findMany({
      where: { eventId: event.id },
      select: { status: true, paymentMethod: true, checkedInAt: true },
    }),
  ]);

  // Emails stay here: the stats only need to know whether the order came from the door.
  const statsOrders: StatsOrder[] = orderRows.map(({ email, ...o }) => ({ ...o, isWalkIn: email === null }));
  const k = computeEventKpis({
    orders: statsOrders,
    tickets: ticketRows,
    capacity: event.capacity,
    eventDate: event.date,
  });
  const cashUp = computeCashUp(statsOrders, ticketRows);
  const timeline = registrationTimeline(statsOrders);
  const checkIns = checkInTimeline(ticketRows);

  const schema = parseFormSchema(event.formSchema) ?? { version: 1 as const, fields: [] };
  const responders = statsOrders.filter((o) => !o.isWalkIn && (scope === "all" || o.paidAt !== null));
  const summaries = summarizeForm(schema, responders);

  const isPaidEvent = event.priceCents > 0;
  const eventPassed = mxDayKey(new Date()) > event.date.toISOString().slice(0, 10);
  const attendeesHref = (status?: string) =>
    `/dashboard/events/${event.id}/attendees${status ? `?status=${status}` : ""}`;

  // ---- KPI tiles
  const tiles: Array<React.ComponentProps<typeof StatTile> & { key: string }> = [
    {
      key: "issued",
      label: "Boletos emitidos",
      value: formatNumber(k.issuedTickets),
      hint:
        k.occupancy !== null
          ? `${formatPercent(k.occupancy)} de ${formatNumber(event.capacity!)} lugares`
          : `${tickets(k.requestedTickets)} solicitados`,
    },
    {
      key: "checkin",
      label: "Asistencia",
      value: formatPercent(k.attendanceRate),
      hint: `${formatNumber(k.checkedIn)} de ${tickets(k.issuedTickets)} ingresaron`,
    },
    {
      key: "registrations",
      label: "Registros en línea",
      value: formatNumber(k.registrations),
      hint: k.walkIns > 0 ? `+ ${formatNumber(k.walkIns)} en puerta` : "Compras desde la página del evento",
    },
    isPaidEvent
      ? {
          key: "revenue",
          label: "Total cobrado",
          value: cashUp.formatted.total,
          hint: k.issuedTickets > 0 ? `${formatMxn(Math.round(cashUp.totalCents / k.issuedTickets))} por boleto` : undefined,
        }
      : {
          key: "free",
          label: "Boletos por compra",
          value: k.avgTicketsPerOrder === null ? "—" : formatNumber(k.avgTicketsPerOrder),
          hint: "Promedio en registros en línea",
        },
  ];
  if (isPaidEvent) {
    tiles.push(
      {
        key: "conversion",
        label: "Conversión a pago",
        value: formatPercent(k.paymentConversion),
        hint: "Registros en línea que pagaron",
      },
      {
        key: "pending",
        label: "Por validar",
        value: formatNumber(k.pendingValidationOrders),
        hint: `${orders(k.pendingReceiptOrders)} sin comprobante`,
        href: attendeesHref("PENDING_VALIDATION"),
      },
    );
    if (k.pendingCashTickets > 0 || event.allowCashPrereg) {
      tiles.push({
        key: "cash",
        label: "Por cobrar en puerta",
        value: formatNumber(k.pendingCashTickets),
        hint: "Boletos pre-registrados en efectivo",
        href: attendeesHref("PENDING_CASH"),
      });
    }
    tiles.push({
      key: "avg",
      label: "Boletos por compra",
      value: k.avgTicketsPerOrder === null ? "—" : formatNumber(k.avgTicketsPerOrder),
      hint: "Promedio en registros en línea",
    });
  }
  tiles.push({
    key: "lead",
    label: "Anticipación",
    value: k.medianLeadDays === null ? "—" : `${formatNumber(k.medianLeadDays)} ${k.medianLeadDays === 1 ? "día" : "días"}`,
    hint: "Mediana entre el registro y el evento",
  });
  if (eventPassed) {
    tiles.push({
      key: "noshow",
      label: "No asistieron",
      value: formatNumber(k.notCheckedIn),
      hint: `${formatPercent(ratio(k.notCheckedIn, k.issuedTickets))} de los boletos emitidos`,
    });
  }

  // ---- funnel, methods, statuses
  const funnelBase = k.requestedTickets;
  const funnel = [
    { label: "Solicitados", count: k.requestedTickets },
    { label: "Pagados / emitidos", count: k.issuedTickets },
    { label: "Ingresaron", count: k.checkedIn },
  ].map((s) => ({ ...s, share: funnelBase > 0 ? s.count / funnelBase : 0 }));

  const methodItems = METHODS.filter((m) => m !== "FREE" || cashUp.byMethod.FREE.count > 0 || !isPaidEvent).map((m) => ({
    label: PAYMENT_METHOD_LABELS[m],
    count: cashUp.byMethod[m].count,
    share: cashUp.paidTotal > 0 ? cashUp.byMethod[m].count / cashUp.paidTotal : 0,
    hint: m === "FREE" ? undefined : cashUp.formatted[m],
  }));

  const statusCounts = Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0])) as Record<(typeof ORDER_STATUSES)[number], number>;
  for (const o of statsOrders) statusCounts[o.status]++;
  const statusItems = ORDER_STATUSES.filter((s) => statusCounts[s] > 0 || s === "PAID").map((s) => ({
    label: ORDER_STATUS_LABELS[s],
    count: statusCounts[s],
    share: statsOrders.length > 0 ? statusCounts[s] / statsOrders.length : 0,
  }));

  const unit = timeline.granularity === "week" ? "semana" : "día";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">Resumen del evento</h2>
          <p className="text-xs text-muted-foreground">Datos al {formatMx(new Date())} (hora del centro de México)</p>
        </div>
        <a
          href={`/dashboard/events/${event.id}/attendees/export`}
          className="w-fit rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
          download
        >
          Exportar CSV
        </a>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        {tiles.map(({ key, ...t }) => (
          <StatTile key={key} {...t} />
        ))}
      </div>

      <ChartCard
        title={`Boletos solicitados por ${unit}`}
        description={`${tickets(k.requestedTickets)} en ${orders(statsOrders.length)} · incluye compras pendientes y en puerta`}
      >
        {timeline.points.length === 0 ? (
          <EmptyChart>Todavía no hay registros.</EmptyChart>
        ) : (
          <ColumnChart
            valueLabel={`Boletos por ${unit}`}
            points={timeline.points.map((p) => ({
              key: p.key,
              label: p.label,
              value: p.tickets,
              tooltip: [p.fullLabel, tickets(p.tickets), orders(p.orders), `Acumulado: ${formatNumber(p.cumulativeTickets)}`],
            }))}
            tableHeaders={[timeline.granularity === "week" ? "Semana" : "Día", "Boletos", "Compras", "Acumulado"]}
            tableRows={timeline.points.map((p) => [p.fullLabel, p.tickets, p.orders, p.cumulativeTickets])}
          />
        )}
      </ChartCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Embudo de boletos" description="De lo solicitado a lo que entró por la puerta">
          {funnelBase === 0 ? <EmptyChart>Todavía no hay boletos.</EmptyChart> : <BarList items={funnel} />}
        </ChartCard>

        <ChartCard title="Método de pago" description="Boletos emitidos y dinero cobrado por método">
          {cashUp.paidTotal === 0 && cashUp.totalCents === 0 ? (
            <EmptyChart>Aún no hay boletos pagados.</EmptyChart>
          ) : (
            <BarList items={methodItems} />
          )}
        </ChartCard>

        <ChartCard
          title="Estado de las compras"
          description={orders(statsOrders.length)}
          action={
            <a href={attendeesHref()} className="shrink-0 text-xs underline text-muted-foreground hover:text-foreground">
              Ver asistentes
            </a>
          }
        >
          {statsOrders.length === 0 ? <EmptyChart>Todavía no hay compras.</EmptyChart> : <BarList items={statusItems} />}
        </ChartCard>

        <ChartCard
          title={checkIns.granularity === "day" ? "Ingresos por día" : "Ingresos por hora"}
          description={`${tickets(k.checkedIn)} escaneados en puerta`}
        >
          {checkIns.points.length === 0 ? (
            <EmptyChart>Nadie ha ingresado todavía. Aquí verás a qué hora llega la gente.</EmptyChart>
          ) : (
            <ColumnChart
              valueLabel="Ingresos"
              points={checkIns.points.map((p) => ({
                key: p.key,
                label: p.label,
                value: p.count,
                tooltip: [p.fullLabel, `${formatNumber(p.count)} ${p.count === 1 ? "ingreso" : "ingresos"}`],
              }))}
              tableHeaders={[checkIns.granularity === "day" ? "Día" : "Hora", "Ingresos"]}
              tableRows={checkIns.points.map((p) => [p.fullLabel, p.count])}
            />
          )}
        </ChartCard>
      </div>

      <FormResponses eventId={event.id} summaries={summaries} scope={scope} totalResponses={responders.length} />
    </div>
  );
}
