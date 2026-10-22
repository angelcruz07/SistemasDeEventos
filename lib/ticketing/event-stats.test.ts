import { describe, expect, it } from "vitest";
import type { FormSchema } from "./form-schema";
import {
  answerValue,
  checkInTimeline,
  computeEventKpis,
  formatPercent,
  mxDayKey,
  registrationTimeline,
  summarizeForm,
  type StatsOrder,
  type StatsTicket,
} from "./event-stats";

const EVENT_DATE = new Date("2026-11-20T00:00:00Z"); // calendar day, UTC midnight

function order(over: Partial<StatsOrder> = {}): StatsOrder {
  return {
    status: "PAID",
    paymentMethod: "SPEI",
    quantity: 1,
    amountCents: 10000,
    paidAt: new Date("2026-11-10T18:00:00Z"),
    createdAt: new Date("2026-11-10T18:00:00Z"),
    isWalkIn: false,
    answers: {},
    ...over,
  };
}

const ticket = (status: StatsTicket["status"], checkedInAt: Date | null = null): StatsTicket => ({
  status,
  paymentMethod: "SPEI",
  checkedInAt,
});

describe("mxDayKey", () => {
  it("uses Mexico City time, not UTC", () => {
    // 03:00 UTC is still the previous evening in Mexico City (UTC-6).
    expect(mxDayKey(new Date("2026-11-11T03:00:00Z"))).toBe("2026-11-10");
  });
});

describe("computeEventKpis", () => {
  it("counts registrations, walk-ins, issued and checked-in tickets", () => {
    const k = computeEventKpis({
      orders: [
        order({ quantity: 2 }),
        order({ status: "PENDING_VALIDATION", paidAt: null }),
        order({ status: "PENDING_RECEIPT", paidAt: null }),
        order({ isWalkIn: true, paymentMethod: "CASH", createdAt: new Date("2026-11-21T02:00:00Z") }),
      ],
      tickets: [ticket("PAID"), ticket("CHECKED_IN"), ticket("CHECKED_IN"), ticket("PENDING_VALIDATION"), ticket("PENDING_CASH")],
      capacity: 10,
      eventDate: EVENT_DATE,
    });
    expect(k.registrations).toBe(3);
    expect(k.walkIns).toBe(1);
    expect(k.requestedTickets).toBe(5);
    expect(k.issuedTickets).toBe(3);
    expect(k.checkedIn).toBe(2);
    expect(k.notCheckedIn).toBe(1);
    expect(k.pendingCashTickets).toBe(1);
    expect(k.pendingValidationOrders).toBe(1);
    expect(k.pendingReceiptOrders).toBe(1);
    expect(k.paidOrders).toBe(2);
    expect(k.paymentConversion).toBeCloseTo(1 / 3);
    expect(k.attendanceRate).toBeCloseTo(2 / 3);
    expect(k.occupancy).toBeCloseTo(0.3);
    expect(k.avgTicketsPerOrder).toBeCloseTo(4 / 3);
  });

  it("returns null rates instead of NaN for an empty event", () => {
    const k = computeEventKpis({ orders: [], tickets: [], capacity: null, eventDate: EVENT_DATE });
    expect(k.paymentConversion).toBeNull();
    expect(k.attendanceRate).toBeNull();
    expect(k.occupancy).toBeNull();
    expect(k.avgTicketsPerOrder).toBeNull();
    expect(k.medianLeadDays).toBeNull();
  });

  it("measures lead time in Mexico City calendar days before the event", () => {
    const k = computeEventKpis({
      orders: [
        order({ createdAt: new Date("2026-11-10T18:00:00Z") }), // 10 days
        order({ createdAt: new Date("2026-11-18T18:00:00Z") }), // 2 days
        order({ createdAt: new Date("2026-11-20T05:00:00Z") }), // 19 nov 23:00 MX -> 1 day
      ],
      tickets: [],
      capacity: null,
      eventDate: EVENT_DATE,
    });
    expect(k.medianLeadDays).toBe(2);
  });

  it("keeps a paid-then-cancelled order as paid (no refunds)", () => {
    const k = computeEventKpis({
      orders: [order({ status: "CANCELLED" })],
      tickets: [],
      capacity: null,
      eventDate: EVENT_DATE,
    });
    expect(k.paidOrders).toBe(1);
    expect(k.cancelledOrders).toBe(1);
  });
});

describe("registrationTimeline", () => {
  it("fills empty days with zeros and accumulates tickets", () => {
    const t = registrationTimeline([
      { createdAt: new Date("2026-11-01T18:00:00Z"), quantity: 2 },
      { createdAt: new Date("2026-11-03T18:00:00Z"), quantity: 1 },
      { createdAt: new Date("2026-11-03T20:00:00Z"), quantity: 3 },
    ]);
    expect(t.granularity).toBe("day");
    expect(t.points.map((p) => [p.key, p.orders, p.tickets, p.cumulativeTickets])).toEqual([
      ["2026-11-01", 1, 2, 2],
      ["2026-11-02", 0, 0, 2],
      ["2026-11-03", 2, 4, 6],
    ]);
    expect(t.points[0].label).toBe("1 nov");
  });

  it("switches to Monday-based weeks for long windows", () => {
    const t = registrationTimeline([
      { createdAt: new Date("2026-08-05T18:00:00Z"), quantity: 1 }, // Wed
      { createdAt: new Date("2026-11-03T18:00:00Z"), quantity: 1 },
    ]);
    expect(t.granularity).toBe("week");
    expect(t.points[0].key).toBe("2026-08-03"); // Monday of that week
    expect(t.points.at(-1)!.cumulativeTickets).toBe(2);
    expect(t.points.reduce((s, p) => s + p.tickets, 0)).toBe(2);
  });

  it("is empty without orders", () => {
    expect(registrationTimeline([]).points).toEqual([]);
  });
});

describe("checkInTimeline", () => {
  it("buckets scans per Mexico City hour with gaps filled", () => {
    const t = checkInTimeline([
      ticket("CHECKED_IN", new Date("2026-11-21T01:10:00Z")), // 19:10 MX
      ticket("CHECKED_IN", new Date("2026-11-21T01:50:00Z")),
      ticket("CHECKED_IN", new Date("2026-11-21T03:05:00Z")), // 21:05 MX
      ticket("PAID"),
    ]);
    expect(t.granularity).toBe("hour");
    expect(t.points.map((p) => [p.label, p.count])).toEqual([
      ["19:00", 2],
      ["20:00", 0],
      ["21:00", 1],
    ]);
  });
});

describe("summarizeForm", () => {
  const schema: FormSchema = {
    version: 1,
    fields: [
      { id: "nivel", type: "select", label: "Nivel de inglés", required: true, options: ["Básico", "Intermedio", "Avanzado"] },
      { id: "primera", type: "checkbox", label: "¿Primera vez?", required: false },
      { id: "edad", type: "number", label: "Edad", required: false },
      { id: "fuente", type: "text", label: "¿Cómo te enteraste?", required: false },
      { id: "tel", type: "phone", label: "Teléfono", required: false },
    ],
  };
  const a = (answers: Record<string, unknown>, minute: number) => ({
    createdAt: new Date(Date.UTC(2026, 10, 1, 12, minute)),
    answers: Object.fromEntries(Object.entries(answers).map(([k, v]) => [k, { label: k, value: v }])),
  });
  const orders = [
    a({ nivel: "Básico", primera: true, edad: 20, fuente: "Instagram", tel: "7221234567" }, 1),
    a({ nivel: "Básico", primera: false, edad: 30, fuente: "instagram " }, 2),
    a({ nivel: "Avanzado", primera: true, fuente: "Un amigo" }, 3),
    a({ nivel: "Experto" }, 4), // option removed later
  ];
  const [nivel, primera, edad, fuente, tel] = summarizeForm(schema, orders);

  it("lists every option in order, zeros included, plus stray values", () => {
    expect(nivel.kind).toBe("choice");
    if (nivel.kind !== "choice") return;
    expect(nivel.responses).toBe(4);
    expect(nivel.items.map((i) => [i.label, i.count])).toEqual([
      ["Básico", 2],
      ["Intermedio", 0],
      ["Avanzado", 1],
      ["Experto", 1],
    ]);
    expect(nivel.items[0].share).toBe(0.5);
  });

  it("summarizes checkboxes as Sí / No over answered orders only", () => {
    if (primera.kind !== "choice") throw new Error("expected choice");
    expect(primera.responses).toBe(3);
    expect(primera.items.map((i) => [i.label, i.count])).toEqual([
      ["Sí", 2],
      ["No", 1],
    ]);
  });

  it("gives numeric stats", () => {
    if (edad.kind !== "number") throw new Error("expected number");
    expect([edad.responses, edad.min, edad.max, edad.mean, edad.median]).toEqual([2, 20, 30, 25, 25]);
    expect(edad.items.map((i) => i.label)).toEqual(["20", "30"]);
  });

  it("bins numbers with many distinct values", () => {
    const many = Array.from({ length: 30 }, (_, i) => a({ edad: 18 + i }, i));
    const [, , s] = summarizeForm(schema, many);
    if (s.kind !== "number") throw new Error("expected number");
    expect(s.items.map((i) => i.label)).toEqual(["18–22", "23–27", "28–32", "33–37", "38–42", "43–47"]);
    expect(s.items.reduce((sum, i) => sum + i.count, 0)).toBe(30);
  });

  it("bins decimals into equal-width ranges", () => {
    const many = Array.from({ length: 12 }, (_, i) => a({ edad: i + 0.5 }, i));
    const [, , s] = summarizeForm(schema, many);
    if (s.kind !== "number") throw new Error("expected number");
    expect(s.items).toHaveLength(6);
    expect(s.items.reduce((sum, i) => sum + i.count, 0)).toBe(12);
  });

  it("groups repeated text case-insensitively and lists newest first", () => {
    if (fuente.kind !== "text") throw new Error("expected text");
    expect(fuente.responses).toBe(3);
    expect(fuente.top.map((t) => [t.label, t.count])).toEqual([["instagram", 2]]);
    expect(fuente.recent).toEqual(["Un amigo", "instagram", "Instagram"]);
  });

  it("only counts phone answers (no list of numbers)", () => {
    expect(tel).toMatchObject({ kind: "count", responses: 1 });
  });
});

describe("helpers", () => {
  it("reads answers defensively", () => {
    expect(answerValue(null, "x")).toBeUndefined();
    expect(answerValue({ x: "bad" }, "x")).toBeUndefined();
    expect(answerValue({ x: { label: "X", value: 3 } }, "x")).toBe(3);
    expect(answerValue({}, "constructor")).toBeUndefined();
  });

  it("formats percentages", () => {
    expect(formatPercent(null)).toBe("—");
    expect(formatPercent(0)).toBe("0%");
    expect(formatPercent(0.001)).toBe("<1%");
    expect(formatPercent(0.456)).toBe("46%");
  });
});
