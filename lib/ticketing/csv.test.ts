import { describe, expect, it } from "vitest";
import { buildAttendeesCsv, escapeCell, type CsvTicket } from "./csv";
import type { FormSchema } from "./form-schema";

const schema: FormSchema = {
  version: 1,
  fields: [
    { id: "f1", type: "text", label: "Empresa", required: false },
    { id: "f2", type: "checkbox", label: "Vegetariano", required: false },
  ],
};

const base: CsvTicket = {
  code: "7K3Q9M",
  name: "Ana",
  email: "ana@x.com",
  status: "PAID",
  paymentMethod: "SPEI",
  amountCents: 10000,
  createdAt: new Date("2026-10-09T18:30:00Z"),
  checkedInAt: null,
  checkedInBy: null,
  answers: {},
};

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
    const csv = buildAttendeesCsv([base], schema);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv.split("\r\n")).toHaveLength(3); // header, row, trailing empty
  });

  it("has a stable column order with form field columns last", () => {
    const [header] = buildAttendeesCsv([], schema).slice(1).split("\r\n");
    expect(header).toBe(
      "Código,Nombre,Email,Estado,Método de pago,Monto,Registrado,Ingresó,Registró en puerta,Empresa,Vegetariano,Otras respuestas",
    );
  });

  it("formats a row with Spanish labels, pesos amount and Mexico City times", () => {
    const row = buildAttendeesCsv(
      [{ ...base, checkedInAt: new Date("2026-10-09T20:05:00Z"), checkedInBy: "Luis", status: "CHECKED_IN" }],
      schema,
    ).split("\r\n")[1];
    expect(row).toBe("7K3-Q9M,Ana,ana@x.com,Ingresó,SPEI,100.00,09/10/2026 12:30,09/10/2026 14:05,Luis,,,");
  });

  it("maps answers by field id and puts removed-field answers in Otras respuestas", () => {
    const row = buildAttendeesCsv(
      [
        {
          ...base,
          email: null,
          answers: {
            f1: { label: "Empresa", value: "Acme, Inc" },
            f2: { label: "Vegetariano", value: true },
            old: { label: "Talla", value: "M" },
          },
        },
      ],
      schema,
    ).split("\r\n")[1];
    expect(row).toContain(',"Acme, Inc",Sí,Talla: M');
    expect(row).toContain("Ana,,Pagado");
  });

  it("guards injected names", () => {
    const row = buildAttendeesCsv([{ ...base, name: "=HYPERLINK(1)" }], schema).split("\r\n")[1];
    expect(row).toContain(",'=HYPERLINK(1),");
  });
});
