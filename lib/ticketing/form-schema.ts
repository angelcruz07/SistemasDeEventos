export const FIELD_TYPES = ["text", "textarea", "select", "checkbox", "number", "phone"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  required: boolean;
  options?: string[];
}

export interface FormSchema {
  version: 1;
  fields: FormField[];
}

export type AnswerValue = string | number | boolean;

export interface RegistrationInput {
  name: string;
  email: string;
  /** Raw values keyed by field id. */
  fields: Record<string, unknown>;
}

export type ValidatedRegistration =
  | {
      data: {
        name: string;
        email: string;
        answers: Record<string, { label: string; value: AnswerValue }>;
      };
    }
  | { errors: Record<string, string> };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_TEXT = 500;
const MAX_TEXTAREA = 2000;

function isField(value: unknown): value is FormField {
  if (typeof value !== "object" || value === null) return false;
  const f = value as Record<string, unknown>;
  if (typeof f.id !== "string" || !f.id) return false;
  if (typeof f.label !== "string" || !f.label.trim()) return false;
  if (typeof f.required !== "boolean") return false;
  if (!FIELD_TYPES.includes(f.type as FieldType)) return false;
  if (f.type === "select") {
    return (
      Array.isArray(f.options) &&
      f.options.length > 0 &&
      f.options.every((o) => typeof o === "string" && o.trim())
    );
  }
  return f.options === undefined;
}

/** Returns the schema when `json` is well formed, otherwise null. */
export function parseFormSchema(json: unknown): FormSchema | null {
  if (typeof json !== "object" || json === null) return null;
  const s = json as Record<string, unknown>;
  if (s.version !== 1 || !Array.isArray(s.fields) || !s.fields.every(isField)) return null;
  const ids = s.fields.map((f: FormField) => f.id);
  if (new Set(ids).size !== ids.length) return null;
  return { version: 1, fields: s.fields as FormField[] };
}

function validateField(field: FormField, raw: unknown): { value?: AnswerValue; error?: string } {
  const empty = raw === undefined || raw === null || raw === "" || raw === false;
  if (field.type === "checkbox") {
    const checked = raw === true || raw === "on" || raw === "true";
    return field.required && !checked ? { error: "Este campo es obligatorio" } : { value: checked };
  }
  if (empty) return field.required ? { error: "Este campo es obligatorio" } : {};
  if (typeof raw !== "string" && typeof raw !== "number") return { error: "Valor no valido" };
  const text = String(raw).trim();
  if (!text) return field.required ? { error: "Este campo es obligatorio" } : {};

  switch (field.type) {
    case "select":
      return field.options?.includes(text) ? { value: text } : { error: "Selecciona una opcion valida" };
    case "number": {
      const n = Number(text);
      return Number.isFinite(n) ? { value: n } : { error: "Ingresa un numero valido" };
    }
    case "phone": {
      const digits = text.replace(/\D/g, "");
      const valid = /^\+?[\d\s()-]+$/.test(text) && digits.length >= 10 && digits.length <= 15;
      return valid ? { value: text } : { error: "Ingresa un telefono valido" };
    }
    case "textarea":
      return text.length <= MAX_TEXTAREA ? { value: text } : { error: "Texto demasiado largo" };
    default:
      return text.length <= MAX_TEXT ? { value: text } : { error: "Texto demasiado largo" };
  }
}

export function validateAnswers(schema: FormSchema, input: RegistrationInput): ValidatedRegistration {
  const errors: Record<string, string> = {};
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name) errors.name = "El nombre es obligatorio";
  else if (name.length > 120) errors.name = "El nombre es demasiado largo";
  if (!EMAIL_RE.test(email) || email.length > 254) errors.email = "Ingresa un correo valido";

  const answers: Record<string, { label: string; value: AnswerValue }> = {};
  for (const field of schema.fields) {
    const result = validateField(field, input.fields[field.id]);
    if (result.error) errors[field.id] = result.error;
    else if (result.value !== undefined) answers[field.id] = { label: field.label, value: result.value };
  }
  return Object.keys(errors).length > 0 ? { errors } : { data: { name, email, answers } };
}

export type SchemaEditResult = { ok: true } | { ok: false; error: string };

/**
 * Fields may be added and relabelled freely. A field that already has answers
 * cannot be deleted or change type. `answeredFieldIds` comes from existing tickets.
 */
export function validateSchemaEdit(
  current: FormSchema,
  next: FormSchema,
  answeredFieldIds: ReadonlySet<string>,
): SchemaEditResult {
  const nextById = new Map(next.fields.map((f) => [f.id, f]));
  for (const field of current.fields) {
    if (!answeredFieldIds.has(field.id)) continue;
    const updated = nextById.get(field.id);
    if (!updated) {
      return { ok: false, error: `No puedes eliminar "${field.label}": ya tiene respuestas` };
    }
    if (updated.type !== field.type) {
      return { ok: false, error: `No puedes cambiar el tipo de "${field.label}": ya tiene respuestas` };
    }
  }
  return { ok: true };
}
