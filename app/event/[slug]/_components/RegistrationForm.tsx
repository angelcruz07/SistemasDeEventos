"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FormField, FormSchema } from "@/lib/ticketing/form-schema";
import { registerForEvent } from "../_actions/registration.actions";

type Values = Record<string, string | boolean>;

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-sm text-destructive">{message}</p> : null;
}

function DynamicField({
  field,
  value,
  error,
  onChange,
}: {
  field: FormField;
  value: string | boolean;
  error?: string;
  onChange: (value: string | boolean) => void;
}) {
  const id = `field-${field.id}`;
  const label = field.required ? field.label : `${field.label} (opcional)`;

  if (field.type === "checkbox") {
    return (
      <div className="space-y-1">
        <label htmlFor={id} className="flex items-start gap-3 cursor-pointer text-sm">
          <input
            id={id}
            type="checkbox"
            className="mt-1 size-4"
            checked={value === true}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span>{label}</span>
        </label>
        <FieldError message={error} />
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {field.type === "textarea" ? (
        <textarea
          id={id}
          rows={3}
          className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : field.type === "select" ? (
        <select
          id={id}
          className="w-full rounded-md border bg-transparent px-3 py-2 text-sm min-h-10"
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Selecciona una opción</option>
          {field.options?.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <Input
          id={id}
          type={field.type === "number" ? "number" : field.type === "phone" ? "tel" : "text"}
          inputMode={field.type === "number" ? "decimal" : undefined}
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      <FieldError message={error} />
    </div>
  );
}

export function RegistrationForm({
  slug,
  schema,
  priceLabel,
  accent,
}: {
  slug: string;
  schema: FormSchema;
  priceLabel: string;
  /** Organizer accent for the submit button (already contrast-checked). */
  accent?: { background: string; color: string };
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [fields, setFields] = useState<Values>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    const result = await registerForEvent(slug, { name, email, fields });
    if (result.success) {
      setDone(true);
    } else {
      setError(result.error);
      setFieldErrors(result.fieldErrors ?? {});
    }
    setSubmitting(false);
  };

  if (done) {
    return (
      <div role="status" className="space-y-2 text-center py-4">
        <CheckCircle2 className="size-10 text-green-600 mx-auto" />
        <h2 className="font-semibold">Revisa tu correo</h2>
        <p className="text-sm text-muted-foreground">
          Te enviamos un mensaje con los siguientes pasos y el enlace de tu boleto. Si no lo ves, revisa tu carpeta de
          spam.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <p className="text-lg font-semibold">{priceLabel}</p>

      <div className="space-y-1.5">
        <Label htmlFor="reg-name">Nombre completo</Label>
        <Input id="reg-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
        <FieldError message={fieldErrors.name} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="reg-email">Correo electrónico</Label>
        <Input
          id="reg-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <FieldError message={fieldErrors.email} />
      </div>

      {schema.fields.map((field) => (
        <DynamicField
          key={field.id}
          field={field}
          value={fields[field.id] ?? (field.type === "checkbox" ? false : "")}
          error={fieldErrors[field.id]}
          onChange={(value) => setFields((prev) => ({ ...prev, [field.id]: value }))}
        />
      ))}

      {error && (
        <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </p>
      )}

      <Button
        type="submit"
        className="w-full min-h-10"
        disabled={submitting}
        style={accent ? { backgroundColor: accent.background, color: accent.color } : undefined}
      >
        {submitting && <Loader2 className="size-4 animate-spin" />}
        Registrarme
      </Button>
    </form>
  );
}
