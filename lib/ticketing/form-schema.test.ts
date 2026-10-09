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

describe("prototype safety and id format", () => {
  const field = (id: string) => ({ id, type: "text", label: "x", required: true });
  const withIds = (...ids: string[]) => ({ version: 1, fields: ids.map(field) });

  it("rejects unsafe or malformed field ids", () => {
    for (const id of ["__proto__", "Constructor", "1a", "a-b", "", "a".repeat(42), "toString"]) {
      expect(parseFormSchema(withIds(id)), id).toBeNull();
    }
    expect(parseFormSchema(withIds("a", "a_1", "a".repeat(41)))).not.toBeNull();
  });

  it("does not read inherited properties as answers", () => {
    const s = parseFormSchema(withIds("constructor"))!;
    const result = validateAnswers(s, { name: "A", email: "a@b.co", fields: {} });
    expect(result).toEqual({ errors: { constructor: "Este campo es obligatorio" } });
  });

  it("ignores own __proto__/constructor keys that are not schema fields", () => {
    const fields = JSON.parse('{"__proto__":"x","constructor":"y","f1":"ACME","f3":true}');
    const result = validateAnswers(schema, { ...base, fields });
    expect(result).toMatchObject({ data: { answers: { f1: { value: "ACME" } } } });
    if (!("data" in result)) throw new Error("expected data");
    expect(Object.keys(result.data.answers).sort()).toEqual(["f1", "f3"]);
    expect(Object.getPrototypeOf(result.data.answers)).toBeNull();
  });

  it("still reports a missing required field", () => {
    const fields = JSON.parse('{"__proto__":"x","f3":true}');
    expect(validateAnswers(schema, { ...base, fields })).toMatchObject({
      errors: { f1: expect.any(String) },
    });
  });
});

describe("limits and number format", () => {
  const f = (over: object) => ({ id: "a", type: "text", label: "x", required: false, ...over });
  const one = (field: object) => ({ version: 1, fields: [field] });

  it("caps fields, labels and options", () => {
    const many = (n: number) => ({
      version: 1,
      fields: Array.from({ length: n }, (_, i) => f({ id: `f${i}` })),
    });
    expect(parseFormSchema(many(50))).not.toBeNull();
    expect(parseFormSchema(many(51))).toBeNull();
    expect(parseFormSchema(one(f({ label: "x".repeat(200) })))).not.toBeNull();
    expect(parseFormSchema(one(f({ label: "x".repeat(201) })))).toBeNull();
    const sel = (options: string[]) => one(f({ type: "select", options }));
    expect(parseFormSchema(sel(Array(50).fill("o")))).not.toBeNull();
    expect(parseFormSchema(sel(Array(51).fill("o")))).toBeNull();
    expect(parseFormSchema(sel(["o".repeat(201)]))).toBeNull();
  });

  it("caps text answers at 2000 chars", () => {
    const s = parseFormSchema(one(f({})))!;
    const run = (v: string) => validateAnswers(s, { name: "A", email: "a@b.co", fields: { a: v } });
    expect(run("x".repeat(2000))).toHaveProperty("data");
    expect(run("x".repeat(2001))).toHaveProperty("errors.a");
  });

  it("accepts only plain decimal numbers", () => {
    const s = parseFormSchema(one(f({ type: "number" })))!;
    const run = (v: string) => validateAnswers(s, { name: "A", email: "a@b.co", fields: { a: v } });
    for (const ok of ["0", "-5", "3.14", "007"]) expect(run(ok), ok).toHaveProperty("data");
    for (const bad of ["0x10", "1e308", "Infinity", "1.", ".5", "1,5"]) {
      expect(run(bad), bad).toHaveProperty("errors.a");
    }
  });

  it("rejects over-long emails", () => {
    const email = `${"a".repeat(250)}@b.co`;
    expect(validateAnswers(schema, { ...base, email })).toMatchObject({ errors: { email: expect.any(String) } });
  });
});
