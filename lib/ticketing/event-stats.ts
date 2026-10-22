import type { OrderStatus, PaymentMethod, TicketStatus } from "@/app/generated/prisma/enums";
import type { FormField, FormSchema } from "./form-schema";

/**
 * Pure statistics for one event's dashboard. Everything here works on plain rows so the
 * page does the queries and this module stays testable. Days and hours are Mexico City time.
 */

const MX_TIME_ZONE = "America/Mexico_City";
const DAY_MS = 86_400_000;
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** Past this many days the registrations chart switches from daily to weekly buckets. */
export const MAX_DAILY_POINTS = 60;
/** Past this many hours the check-in chart switches from hourly to daily buckets. */
export const MAX_HOURLY_POINTS = 36;
/** Most recent free-text answers listed per question. */
export const MAX_TEXT_RESPONSES = 30;
/** Repeated free-text answers shown as bars (e.g. "¿Cómo te enteraste?"). */
export const MAX_TOP_TEXT = 8;
const NUMBER_BINS = 6;
const MAX_DISTINCT_NUMBERS = 10;

export interface StatsOrder {
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  quantity: number;
  amountCents: number;
  paidAt: Date | null;
  createdAt: Date;
  /** Door walk-ins have no email and never filled the public form. */
  isWalkIn: boolean;
  answers: unknown;
}

export interface StatsTicket {
  status: TicketStatus;
  paymentMethod: PaymentMethod;
  checkedInAt: Date | null;
}

// ---------------------------------------------------------------- dates

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: MX_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const hourFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: MX_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
});

/** `YYYY-MM-DD` of an instant in Mexico City. */
export function mxDayKey(date: Date): string {
  return dayFormatter.format(date);
}

/** `YYYY-MM-DDTHH` of an instant in Mexico City. */
export function mxHourKey(date: Date): string {
  const p = Object.fromEntries(hourFormatter.formatToParts(date).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}`;
}

/** Day number (days since epoch) of a `YYYY-MM-DD` key; calendar arithmetic, no time zone. */
function dayIndex(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}

function keyFromIndex(index: number): string {
  return new Date(index * DAY_MS).toISOString().slice(0, 10);
}

/** "12 oct" for a `YYYY-MM-DD` key. */
export function shortDayLabel(key: string): string {
  const [, m, d] = key.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

/** Event.date is a calendar day stored as UTC midnight. */
function eventDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------- numbers

/** Ratio or null when the denominator is zero, so the UI can show "—" instead of NaN. */
export function ratio(part: number, whole: number): number | null {
  return whole > 0 ? part / whole : null;
}

/** "45%", "<1%" for tiny non-zero shares, "—" when undefined. */
export function formatPercent(value: number | null): string {
  if (value === null) return "—";
  if (value > 0 && value < 0.005) return "<1%";
  return `${Math.round(value * 100)}%`;
}

/** Integers as-is, otherwise up to two decimals without trailing zeros. */
export function formatNumber(value: number): string {
  if (Number.isInteger(value)) return value.toLocaleString("en-US");
  return Number(value.toFixed(2)).toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// ---------------------------------------------------------------- KPIs

export interface EventKpis {
  /** Public registrations (orders placed through the event page). */
  registrations: number;
  walkIns: number;
  /** Tickets asked for across every order, whatever happened to it. */
  requestedTickets: number;
  /** PAID + CHECKED_IN tickets. */
  issuedTickets: number;
  checkedIn: number;
  /** Issued but not yet scanned. */
  notCheckedIn: number;
  /** Cash pre-registrations still to be collected at the door. */
  pendingCashTickets: number;
  pendingValidationOrders: number;
  pendingReceiptOrders: number;
  rejectedOrders: number;
  cancelledOrders: number;
  /** Orders that were ever paid (cancelling never un-pays). */
  paidOrders: number;
  /** Public orders that got paid / public orders. */
  paymentConversion: number | null;
  /** Checked in / issued. */
  attendanceRate: number | null;
  /** Issued / capacity, when the event has a capacity. */
  occupancy: number | null;
  avgTicketsPerOrder: number | null;
  /** Median days between a public registration and the event day. */
  medianLeadDays: number | null;
}

export function computeEventKpis(input: {
  orders: StatsOrder[];
  tickets: StatsTicket[];
  capacity: number | null;
  eventDate: Date;
}): EventKpis {
  const { orders, tickets, capacity, eventDate } = input;
  const publicOrders = orders.filter((o) => !o.isWalkIn);

  let issuedTickets = 0;
  let checkedIn = 0;
  let pendingCashTickets = 0;
  for (const t of tickets) {
    if (t.status === "CHECKED_IN") checkedIn++;
    if (t.status === "PAID" || t.status === "CHECKED_IN") issuedTickets++;
    if (t.status === "PENDING_CASH") pendingCashTickets++;
  }

  const count = (status: OrderStatus) => orders.filter((o) => o.status === status).length;
  const publicPaid = publicOrders.filter((o) => o.paidAt !== null).length;
  const publicTickets = publicOrders.reduce((sum, o) => sum + o.quantity, 0);

  const eventDay = dayIndex(eventDayKey(eventDate));
  const leadDays = publicOrders
    .map((o) => eventDay - dayIndex(mxDayKey(o.createdAt)))
    .filter((d) => d >= 0);

  return {
    registrations: publicOrders.length,
    walkIns: orders.length - publicOrders.length,
    requestedTickets: orders.reduce((sum, o) => sum + o.quantity, 0),
    issuedTickets,
    checkedIn,
    notCheckedIn: issuedTickets - checkedIn,
    pendingCashTickets,
    pendingValidationOrders: count("PENDING_VALIDATION"),
    pendingReceiptOrders: count("PENDING_RECEIPT"),
    rejectedOrders: count("REJECTED"),
    cancelledOrders: count("CANCELLED"),
    paidOrders: orders.filter((o) => o.paidAt !== null).length,
    paymentConversion: ratio(publicPaid, publicOrders.length),
    attendanceRate: ratio(checkedIn, issuedTickets),
    occupancy: capacity && capacity > 0 ? issuedTickets / capacity : null,
    avgTicketsPerOrder: ratio(publicTickets, publicOrders.length),
    medianLeadDays: median(leadDays),
  };
}

// ---------------------------------------------------------------- time series

export interface TimePoint {
  key: string;
  label: string;
  /** Long label for tooltips and the table view. */
  fullLabel: string;
  orders: number;
  tickets: number;
  cumulativeTickets: number;
}

export interface Timeline {
  granularity: "day" | "week";
  points: TimePoint[];
}

/**
 * Tickets and orders per Mexico City day, gaps filled with zeros so quiet days show.
 * Long registration windows are grouped by week (Monday start) to keep the chart readable.
 */
export function registrationTimeline(orders: Pick<StatsOrder, "createdAt" | "quantity">[]): Timeline {
  if (orders.length === 0) return { granularity: "day", points: [] };

  const byDay = new Map<number, { orders: number; tickets: number }>();
  for (const o of orders) {
    const idx = dayIndex(mxDayKey(o.createdAt));
    const cur = byDay.get(idx) ?? { orders: 0, tickets: 0 };
    cur.orders++;
    cur.tickets += o.quantity;
    byDay.set(idx, cur);
  }
  const first = Math.min(...byDay.keys());
  const last = Math.max(...byDay.keys());
  const weekly = last - first + 1 > MAX_DAILY_POINTS;

  // 1970-01-01 was a Thursday: shifting by 3 makes buckets start on Monday.
  const bucketOf = (idx: number) => (weekly ? idx - ((idx + 3) % 7) : idx);
  const step = weekly ? 7 : 1;

  const points: TimePoint[] = [];
  let cumulative = 0;
  for (let b = bucketOf(first); b <= last; b += step) {
    let ordersInBucket = 0;
    let ticketsInBucket = 0;
    for (let d = b; d < b + step; d++) {
      const v = byDay.get(d);
      if (v) {
        ordersInBucket += v.orders;
        ticketsInBucket += v.tickets;
      }
    }
    cumulative += ticketsInBucket;
    const key = keyFromIndex(b);
    points.push({
      key,
      label: shortDayLabel(key),
      fullLabel: weekly ? `Semana del ${shortDayLabel(key)}` : shortDayLabel(key),
      orders: ordersInBucket,
      tickets: ticketsInBucket,
      cumulativeTickets: cumulative,
    });
  }
  return { granularity: weekly ? "week" : "day", points };
}

export interface CheckInPoint {
  key: string;
  label: string;
  fullLabel: string;
  count: number;
}

/** Check-ins per Mexico City hour (gaps filled); per day when the scans span too long. */
export function checkInTimeline(tickets: Pick<StatsTicket, "status" | "checkedInAt">[]): {
  granularity: "hour" | "day";
  points: CheckInPoint[];
} {
  const scans = tickets.filter((t) => t.status === "CHECKED_IN" && t.checkedInAt !== null).map((t) => t.checkedInAt!);
  if (scans.length === 0) return { granularity: "hour", points: [] };

  const hourIndex = (key: string) => dayIndex(key.slice(0, 10)) * 24 + Number(key.slice(11, 13));
  const counts = new Map<number, number>();
  for (const s of scans) {
    const h = hourIndex(mxHourKey(s));
    counts.set(h, (counts.get(h) ?? 0) + 1);
  }
  const first = Math.min(...counts.keys());
  const last = Math.max(...counts.keys());

  if (last - first + 1 > MAX_HOURLY_POINTS) {
    const days = registrationTimeline(scans.map((createdAt) => ({ createdAt, quantity: 1 })));
    return {
      granularity: "day",
      points: days.points.map((p) => ({ key: p.key, label: p.label, fullLabel: p.fullLabel, count: p.tickets })),
    };
  }

  const multiDay = Math.floor(first / 24) !== Math.floor(last / 24);
  const points: CheckInPoint[] = [];
  for (let h = first; h <= last; h++) {
    const day = keyFromIndex(Math.floor(h / 24));
    const hour = String(h % 24).padStart(2, "0");
    points.push({
      key: `${day}T${hour}`,
      label: `${hour}:00`,
      fullLabel: multiDay ? `${shortDayLabel(day)}, ${hour}:00–${hour}:59` : `${hour}:00–${hour}:59`,
      count: counts.get(h) ?? 0,
    });
  }
  return { granularity: "hour", points };
}

// ---------------------------------------------------------------- form answers

export interface BarItem {
  label: string;
  count: number;
  /** Share of the question's responses (0..1). */
  share: number;
}

interface SummaryBase {
  field: FormField;
  responses: number;
}

export type FieldSummary =
  | (SummaryBase & { kind: "choice"; items: BarItem[] })
  | (SummaryBase & {
      kind: "number";
      min: number | null;
      max: number | null;
      mean: number | null;
      median: number | null;
      items: BarItem[];
    })
  | (SummaryBase & { kind: "text"; top: BarItem[]; recent: string[] })
  | (SummaryBase & { kind: "count" });

/** Reads `answers[fieldId].value` defensively from the stored JSON. */
export function answerValue(answers: unknown, fieldId: string): unknown {
  if (typeof answers !== "object" || answers === null || !Object.hasOwn(answers, fieldId)) return undefined;
  const entry = (answers as Record<string, unknown>)[fieldId];
  if (typeof entry !== "object" || entry === null) return undefined;
  return (entry as { value?: unknown }).value;
}

function toBars(entries: Array<[string, number]>, total: number): BarItem[] {
  return entries.map(([label, count]) => ({ label, count, share: total > 0 ? count / total : 0 }));
}

function summarizeChoice(field: FormField, values: unknown[]): FieldSummary {
  const counts = new Map<string, number>();
  if (field.type === "checkbox") {
    counts.set("Sí", 0);
    counts.set("No", 0);
  } else {
    for (const o of field.options ?? []) counts.set(o, 0);
  }
  let responses = 0;
  for (const v of values) {
    const label = field.type === "checkbox" ? (v === true ? "Sí" : v === false ? "No" : null) : typeof v === "string" ? v : null;
    if (label === null) continue;
    responses++;
    // A value no longer among the options (relabelled) still counts, as its own bar.
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return { kind: "choice", field, responses, items: toBars([...counts], responses) };
}

function binLabel(lo: number, hi: number): string {
  return `${formatNumber(lo)}–${formatNumber(hi)}`;
}

function summarizeNumber(field: FormField, values: unknown[]): FieldSummary {
  const nums = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const n = nums.length;
  if (n === 0) return { kind: "number", field, responses: 0, min: null, max: null, mean: null, median: null, items: [] };

  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const mean = nums.reduce((a, b) => a + b, 0) / n;
  const distinct = [...new Set(nums)].sort((a, b) => a - b);

  let entries: Array<[string, number]>;
  if (distinct.length <= MAX_DISTINCT_NUMBERS) {
    entries = distinct.map((d) => [formatNumber(d), nums.filter((x) => x === d).length]);
  } else if (nums.every(Number.isInteger)) {
    // Whole numbers (ages, people...) get whole-number ranges: "18–22", "23–27".
    const width = Math.ceil((max - min + 1) / NUMBER_BINS);
    const count = Math.ceil((max - min + 1) / width);
    const bins = Array.from({ length: count }, () => 0);
    for (const x of nums) bins[Math.floor((x - min) / width)]++;
    entries = bins.map((c, i) => {
      const lo = min + i * width;
      return [binLabel(lo, Math.min(max, lo + width - 1)), c];
    });
  } else {
    const width = (max - min) / NUMBER_BINS;
    const bins = Array.from({ length: NUMBER_BINS }, () => 0);
    for (const x of nums) bins[Math.min(NUMBER_BINS - 1, Math.floor((x - min) / width))]++;
    entries = bins.map((c, i) => [binLabel(min + i * width, i === NUMBER_BINS - 1 ? max : min + (i + 1) * width), c]);
  }
  return { kind: "number", field, responses: n, min, max, mean, median: median(nums), items: toBars(entries, n) };
}

function summarizeText(field: FormField, values: unknown[]): FieldSummary {
  const texts = values
    .filter((v): v is string | number => (typeof v === "string" || typeof v === "number") && String(v).trim() !== "")
    .map((v) => String(v).trim().replace(/\s+/g, " "));
  if (field.type === "phone") return { kind: "count", field, responses: texts.length };

  // Group case-insensitively; show the first (= most recent) spelling seen.
  const groups = new Map<string, { label: string; count: number }>();
  for (const t of texts) {
    const key = t.toLocaleLowerCase("es");
    const g = groups.get(key);
    if (g) g.count++;
    else groups.set(key, { label: t, count: 1 });
  }
  const repeated = [...groups.values()]
    .filter((g) => g.count > 1)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "es"))
    .slice(0, MAX_TOP_TEXT);

  return {
    kind: "text",
    field,
    responses: texts.length,
    top: toBars(
      repeated.map((g) => [g.label, g.count]),
      texts.length,
    ),
    recent: texts.slice(0, MAX_TEXT_RESPONSES),
  };
}

/**
 * Google-Forms-style summary of every question in the schema, in schema order.
 * `orders` should exclude walk-ins; they are sorted newest first for the text lists.
 */
export function summarizeForm(schema: FormSchema, orders: Pick<StatsOrder, "answers" | "createdAt">[]): FieldSummary[] {
  const newestFirst = [...orders].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return schema.fields.map((field) => {
    const values = newestFirst.map((o) => answerValue(o.answers, field.id)).filter((v) => v !== undefined);
    switch (field.type) {
      case "select":
      case "checkbox":
        return summarizeChoice(field, values);
      case "number":
        return summarizeNumber(field, values);
      default:
        return summarizeText(field, values);
    }
  });
}
