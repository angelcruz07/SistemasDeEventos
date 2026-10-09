import { describe, expect, it } from "vitest";
import {
  parseFormSchema,
  validateAnswers,
  validateSchemaEdit,
  type FormSchema,
} from "./form-schema";

const schema: FormSchema = {
  version: 1,
  fields: [
    { id: "f1", type: "text", label: "Empresa", required: true },
    { id: "f2", type: "select", label: "Talla", required: false, options: ["S", "M"] },
    { id: "f3", type: "checkbox", label: "Acepto", required: true },
    { id: "f4", type: "number", label: "Edad", required: false },
    { id: "f5", type: "phone", label: "Telefono", required: false },
  ],
};

const base = { name: "Ana Lopez", email: "Ana@Example.COM", fields: { f1: "ACME", f3: true } };

describe("parseFormSchema", () => {
  it("accepts a valid schema", () => {
    expect(parseFormSchema(schema)).toEqual(schema);
  });
  it("accepts the default empty schema", () => {
    expect(parseFormSchema({ version: 1, fields: [] })).toEqual({ version: 1, fields: [] });
  });
  it("rejects bad shapes", () => {
    expect(parseFormSchema(null)).toBeNull();
    expect(parseFormSchema({ version: 2, fields: [] })).toBeNull();
    expect(parseFormSchema({ version: 1, fields: [{ id: "a", type: "date", label: "x", required: false }] })).toBeNull();
    expect(parseFormSchema({ version: 1, fields: [{ id: "a", type: "select", label: "x", required: false }] })).toBeNull();
  });
  it("rejects duplicate ids", () => {
    const dup = { version: 1, fields: [schema.fields[0], schema.fields[0]] };
    expect(parseFormSchema(dup)).toBeNull();
  });
});

describe("validateAnswers", () => {
  it("returns normalized data with label snapshots", () => {
    const result = validateAnswers(schema, base);
    expect(result).toEqual({
      data: {
        name: "Ana Lopez",
        email: "ana@example.com",
        answers: { f1: { label: "Empresa", value: "ACME" }, f3: { label: "Acepto", value: true } },
      },
    });
  });
  it("rejects an invalid email", () => {
    expect(validateAnswers(schema, { ...base, email: "abc" })).toMatchObject({
      errors: { email: expect.any(String) },
    });
  });
  it("requires name", () => {
    expect(validateAnswers(schema, { ...base, name: "  " })).toMatchObject({ errors: { name: expect.any(String) } });
  });
  it("reports missing required fields per field id", () => {
    const result = validateAnswers(schema, { ...base, fields: { f3: false } });
    expect(result).toMatchObject({ errors: { f1: expect.any(String), f3: expect.any(String) } });
  });
  it("validates select options, numbers and phone", () => {
    const result = validateAnswers(schema, {
      ...base,
      fields: { f1: "x", f3: true, f2: "XL", f4: "abc", f5: "12" },
    });
    expect(result).toMatchObject({
      errors: { f2: expect.any(String), f4: expect.any(String), f5: expect.any(String) },
    });
  });
  it("accepts valid optional values and coerces numeric strings", () => {
    const result = validateAnswers(schema, {
      ...base,
      fields: { f1: "x", f3: "on", f2: "M", f4: "30", f5: "+52 (55) 1234-5678" },
    });
    expect(result).toMatchObject({
      data: { answers: { f2: { value: "M" }, f4: { value: 30 }, f5: { value: "+52 (55) 1234-5678" } } },
    });
  });
  it("ignores unknown field ids", () => {
    const result = validateAnswers(schema, { ...base, fields: { ...base.fields, evil: "x" } });
    expect("data" in result && "evil" in result.data.answers).toBe(false);
  });
});

describe("validateSchemaEdit", () => {
  const answered = new Set(["f1"]);
  it("allows adding fields and editing labels", () => {
    const next: FormSchema = {
      version: 1,
      fields: [
        { ...schema.fields[0], label: "Organizacion" },
        ...schema.fields.slice(1),
        { id: "f6", type: "text", label: "Nuevo", required: false },
      ],
    };
    expect(validateSchemaEdit(schema, next, answered)).toEqual({ ok: true });
  });
  it("refuses deleting a field that has answers", () => {
    const next = { ...schema, fields: schema.fields.slice(1) };
    expect(validateSchemaEdit(schema, next, answered)).toMatchObject({ ok: false });
  });
  it("allows deleting a field without answers", () => {
    const next = { ...schema, fields: schema.fields.filter((f) => f.id !== "f2") };
    expect(validateSchemaEdit(schema, next, answered)).toEqual({ ok: true });
  });
  it("refuses changing the type of an answered field", () => {
    const next = {
      ...schema,
      fields: [{ ...schema.fields[0], type: "number" as const }, ...schema.fields.slice(1)],
    };
    expect(validateSchemaEdit(schema, next, answered)).toMatchObject({ ok: false });
  });
  it("allows anything valid when there are no answers", () => {
    expect(validateSchemaEdit(schema, { version: 1, fields: [] }, new Set())).toEqual({ ok: true });
  });
});
