import type { OrderStatus, PaymentMethod, TicketStatus } from "@/app/generated/prisma/enums";
import { formatMx } from "@/lib/datetime";
import { ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS, STATUS_LABELS } from "./attendees";
import { issuedTickets } from "./attendee-rows";
import type { FormSchema } from "./form-schema";
import { formatShortCode } from "./short-code";

export interface CsvOrderTicket {
  code: string;
  seq: number;
  status: TicketStatus;
  amountCents: number;
  checkedInAt: Date | null;
  checkedInBy: string | null;
}

export interface CsvOrder {
  code: string;
  name: string;
  email: string | null;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  quantity: number;
  amountCents: number;
  createdAt: Date;
  paidAt: Date | null;
  answers: unknown;
  tickets: CsvOrderTicket[];
}

const BOM = "﻿";
const EOL = "\r\n";
const FORMULA_START = /^[=+\-@\t\r]/;
const FIXED_HEADERS = [
  "Orden",
  "Boleto",
  "Boleto n de N",
  "Nombre",
  "Email",
  "Estado de la orden",
  "Estado del boleto",
  "Método de pago",
  "Monto del boleto",
  "Total de la orden",
  "Registrado",
  "Ingresó",
  "Registró en puerta",
];

/** RFC 4180 quoting plus a leading apostrophe so spreadsheets never evaluate user text. */
export function escapeCell(value: string): string {
  const safe = FORMULA_START.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function describeValue(value: unknown): string {
  if (Array.isArray(value)) return value.map(String).join(", ");
  if (typeof value === "boolean") return value ? "Sí" : "No";
  return value === null || value === undefined ? "" : String(value);
}

type Answers = Record<string, { label?: unknown; value?: unknown }>;

const toAnswers = (raw: unknown): Answers => (typeof raw === "object" && raw !== null ? (raw as Answers) : {});

/** Plain pesos ("100.00") so spreadsheets can sum the column. */
const pesos = (cents: number) => `${Math.floor(cents / 100)}.${(cents % 100).toString().padStart(2, "0")}`;

/**
 * One row per issued ticket, plus one ticket-less row for every order that has no issued
 * tickets yet (pending payment). "Total de la orden" is written only on the first row of each
 * order, so summing that column gives the sum of orders without double counting; "Monto del
 * boleto" is the per-ticket (unit) amount. Form answers belong to the order and repeat on
 * each of its rows.
 */
export function buildAttendeesCsv(orders: CsvOrder[], schema: FormSchema): string {
  const fieldIds = new Set(schema.fields.map((f) => f.id));
  const header = [...FIXED_HEADERS, ...schema.fields.map((f) => f.label), "Otras respuestas"];
  const lines = [header.map(escapeCell).join(",")];

  for (const order of orders) {
    const answers = toAnswers(order.answers);
    const others = Object.entries(answers)
      .filter(([id, a]) => !fieldIds.has(id) && a && typeof a.label === "string")
      .map(([, a]) => `${a.label}: ${describeValue(a.value)}`)
      .join("; ");
    const answerCells = [...schema.fields.map((f) => describeValue(answers[f.id]?.value)), others];
    const tickets = issuedTickets(order.tickets, order).sort((a, b) => a.seq - b.seq);

    const row = (ticket: CsvOrderTicket | null, first: boolean) => [
      formatShortCode(order.code),
      ticket ? formatShortCode(ticket.code) : "",
      ticket ? `${ticket.seq} de ${order.quantity}` : "",
      order.name,
      order.email ?? "",
      ORDER_STATUS_LABELS[order.status],
      ticket ? STATUS_LABELS[ticket.status] : "",
      PAYMENT_METHOD_LABELS[order.paymentMethod],
      ticket ? pesos(ticket.amountCents) : "",
      first ? pesos(order.amountCents) : "",
      formatMx(order.createdAt),
      ticket?.checkedInAt ? formatMx(ticket.checkedInAt) : "",
      ticket?.checkedInBy ?? "",
      ...answerCells,
    ];

    if (tickets.length === 0) lines.push(row(null, true).map(escapeCell).join(","));
    else tickets.forEach((t, i) => lines.push(row(t, i === 0).map(escapeCell).join(",")));
  }
  return BOM + lines.join(EOL) + EOL;
}
