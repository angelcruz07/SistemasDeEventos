import { describe, expect, it } from "vitest";
import { buildAttendeesCsv, escapeCell, type CsvOrder } from "./csv";
import type { FormSchema } from "./form-schema";

const schema: FormSchema = {
  version: 1,
  fields: [
    { id: "f1", type: "text", label: "Empresa", required: false },
    { id: "f2", type: "checkbox", label: "Vegetariano", required: false },
  ],
};

const ticket = (seq: number, extra: Partial<CsvOrder["tickets"][number]> = {}): CsvOrder["tickets"][number] => ({
  code: `AAAA0${seq}`,
  seq,
  status: "PAID",
  amountCents: 10000,
  checkedInAt: null,
  checkedInBy: null,
  ...extra,
});

const base: CsvOrder = {
  code: "7K3Q9M",
  name: "Ana",
  email: "ana@x.com",
  status: "PAID",
  paymentMethod: "SPEI",
  quantity: 2,
  amountCents: 20000,
  createdAt: new Date("2026-10-09T18:30:00Z"),
  answers: {},
  paidAt: new Date("2026-10-09T19:00:00Z"),
  tickets: [ticket(1), ticket(2)],
};

const lines = (csv: string) => csv.split("\r\n");

describe("escapeCell", () => {
  it("quotes commas, quotes and newlines (RFC 4180)", () => {
    expect(escapeCell("a,b")).toBe('"a,b"');
    expect(escapeCell('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCell("a\nb")).toBe('"a\nb"');
    expect(escapeCell("plain")).toBe("plain");
  });
  it("neutralizes formula injection", () => {
    for (const c of ["=1+1", "+1", "-1", "@SUM(A1)", "\tx", "\rx"]) {
      expect(escapeCell(c).replace(/^"/, "").startsWith("'")).toBe(true);
    }
  });
});

describe("buildAttendeesCsv", () => {
  it("starts with a UTF-8 BOM and uses CRLF", () => {
    const csv = buildAttendeesCsv([{ ...base, tickets: [ticket(1)], quantity: 1 }], schema);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(lines(csv)).toHaveLength(3); // header, row, trailing empty
  });

  it("has a stable column order with form field columns last", () => {
    const [header] = lines(buildAttendeesCsv([], schema).slice(1));
    expect(header).toBe(
      "Orden,Boleto,Boleto n de N,Nombre,Email,Estado de la orden,Estado del boleto,Método de pago,Monto del boleto,Total de la orden,Registrado,Ingresó,Registró en puerta,Empresa,Vegetariano,Otras respuestas",
    );
  });

  it("writes one row per ticket and the order total only on the first row of each order", () => {
    const rows = lines(buildAttendeesCsv([base], schema)).slice(1, 3);
    expect(rows[0]).toBe("7K3-Q9M,AAA-A01,1 de 2,Ana,ana@x.com,Pagado,Pagado,SPEI,100.00,200.00,09/10/2026 12:30,,,,,");
    expect(rows[1]).toBe("7K3-Q9M,AAA-A02,2 de 2,Ana,ana@x.com,Pagado,Pagado,SPEI,100.00,,09/10/2026 12:30,,,,,");
  });

  it("orders tickets by seq regardless of input order", () => {
    const rows = lines(buildAttendeesCsv([{ ...base, tickets: [ticket(2), ticket(1)] }], schema));
    expect(rows[1]).toContain("1 de 2");
    expect(rows[2]).toContain("2 de 2");
  });

  it("adds an order-only row with empty ticket columns when the order has no tickets yet", () => {
    const pending: CsvOrder = { ...base, status: "PENDING_VALIDATION", tickets: [] };
    const row = lines(buildAttendeesCsv([pending], schema))[1];
    expect(row).toBe("7K3-Q9M,,,Ana,ana@x.com,Pendiente de validar,,SPEI,,200.00,09/10/2026 12:30,,,,,");
  });

  it("formats check-in time and staff with Mexico City times", () => {
    const row = lines(
      buildAttendeesCsv(
        [
          {
            ...base,
            quantity: 1,
            amountCents: 10000,
            tickets: [ticket(1, { status: "CHECKED_IN", checkedInAt: new Date("2026-10-09T20:05:00Z"), checkedInBy: "Luis" })],
          },
        ],
        schema,
      ),
    )[1];
    expect(row).toBe(
      "7K3-Q9M,AAA-A01,1 de 1,Ana,ana@x.com,Pagado,Ingresó,SPEI,100.00,100.00,09/10/2026 12:30,09/10/2026 14:05,Luis,,,",
    );
  });

  it("repeats the order answers on every ticket row, mapped by field id, with removed fields in Otras respuestas", () => {
    const answered: CsvOrder = {
      ...base,
      email: null,
      answers: {
        f1: { label: "Empresa", value: "Acme, Inc" },
        f2: { label: "Vegetariano", value: true },
        old: { label: "Talla", value: "M" },
      },
    };
    const [first, second] = lines(buildAttendeesCsv([answered], schema)).slice(1, 3);
    for (const row of [first, second]) {
      expect(row).toContain(',"Acme, Inc",Sí,Talla: M');
      expect(row).toContain("Ana,,Pagado");
    }
  });

  it("guards injected names", () => {
    const row = lines(buildAttendeesCsv([{ ...base, name: "=HYPERLINK(1)" }], schema))[1];
    expect(row).toContain(",'=HYPERLINK(1),");
  });

  it("writes no ticket row for an order cancelled without ever being paid", () => {
    const o: CsvOrder = { ...base, status: "CANCELLED", paidAt: null, quantity: 1, tickets: [ticket(1, { status: "CANCELLED" })] };
    const rows = lines(buildAttendeesCsv([o], schema)).filter(Boolean);
    expect(rows).toHaveLength(2);
    expect(rows[1]).not.toContain("AAA-A01");
  });
});
