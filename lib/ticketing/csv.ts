import type { PaymentMethod, TicketStatus } from "@/app/generated/prisma/enums";
import { formatMx } from "@/lib/datetime";
import { PAYMENT_METHOD_LABELS, STATUS_LABELS } from "./attendees";
import type { FormSchema } from "./form-schema";
import { formatShortCode } from "./short-code";

export interface CsvTicket {
  code: string;
  name: string;
  email: string | null;
  status: TicketStatus;
  paymentMethod: PaymentMethod;
  amountCents: number;
  createdAt: Date;
  checkedInAt: Date | null;
  checkedInBy: string | null;
  answers: unknown;
}

const BOM = "﻿";
const EOL = "\r\n";
const FORMULA_START = /^[=+\-@\t\r]/;
const FIXED_HEADERS = [
  "Código",
  "Nombre",
  "Email",
  "Estado",
  "Método de pago",
  "Monto",
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

export function buildAttendeesCsv(tickets: CsvTicket[], schema: FormSchema): string {
  const fieldIds = new Set(schema.fields.map((f) => f.id));
  const header = [...FIXED_HEADERS, ...schema.fields.map((f) => f.label), "Otras respuestas"];
  const lines = [header.map(escapeCell).join(",")];

  for (const t of tickets) {
    const answers = toAnswers(t.answers);
    const others = Object.entries(answers)
      .filter(([id, a]) => !fieldIds.has(id) && a && typeof a.label === "string")
      .map(([, a]) => `${a.label}: ${describeValue(a.value)}`)
      .join("; ");
    const cells = [
      formatShortCode(t.code),
      t.name,
      t.email ?? "",
      STATUS_LABELS[t.status],
      PAYMENT_METHOD_LABELS[t.paymentMethod],
      pesos(t.amountCents),
      formatMx(t.createdAt),
      t.checkedInAt ? formatMx(t.checkedInAt) : "",
      t.checkedInBy ?? "",
      ...schema.fields.map((f) => describeValue(answers[f.id]?.value)),
      others,
    ];
    lines.push(cells.map(escapeCell).join(","));
  }
  return BOM + lines.join(EOL) + EOL;
}
