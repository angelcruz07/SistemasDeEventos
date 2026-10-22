"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FormField, FormSchema } from "@/lib/ticketing/form-schema";
import { MAX_QUANTITY_UNCAPPED } from "@/lib/ticketing/order";
import { clampQuantity, orderTotalLabel, sanitizeQuantityText } from "@/lib/ticketing/quantity-input";
import { registerForEvent } from "../_actions/registration.actions";

type Values = Record<string, string | boolean>;
type PaymentChoice = "SPEI" | "CASH";

const METHOD_COPY: Record<PaymentChoice, { label: string; hint: string }> = {
  SPEI: { label: "Transferencia SPEI", hint: "Te enviamos los datos por correo y subes tu comprobante." },
  CASH: { label: "Efectivo en la entrada", hint: "Recibes tu QR por correo y pagas al llegar." },
};

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
  priceCents,
  paymentMethods = [],
  accent,
}: {
  slug: string;
  schema: FormSchema;
  priceLabel: string;
  priceCents: number;
  /** Public methods of a paid event (empty when free). The server re-checks the choice. */
  paymentMethods?: PaymentChoice[];
  /** The stepper never depends on capacity; the server enforces the real limit and answers generically. */
  /** Organizer accent for the submit button (already contrast-checked). */
  accent?: { background: string; color: string };
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [fields, setFields] = useState<Values>({});
  // Raw text so the buyer can clear the field while typing; clamped on blur and on submit.
  const [quantityText, setQuantityText] = useState("1");
  const [paymentMethod, setPaymentMethod] = useState<PaymentChoice | null>(paymentMethods[0] ?? null);
  const [doneMethod, setDoneMethod] = useState<PaymentChoice | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    const quantity = clampQuantity(quantityText, MAX_QUANTITY_UNCAPPED);
    setQuantityText(String(quantity));
    const result = await registerForEvent(slug, { name, email, fields, quantity, paymentMethod: paymentMethod ?? undefined });
    if (result.success) {
      setDoneMethod(paymentMethod);
      setDone(true);
    } else {
      setError(result.error);
      setFieldErrors(result.fieldErrors ?? {});
    }
    setSubmitting(false);
  };

  if (done && doneMethod === "CASH") {
    return (
      <div role="status" className="space-y-2 text-center py-4">
        <CheckCircle2 className="size-10 text-green-600 mx-auto" />
        <h2 className="font-semibold">¡Pre-registro listo!</h2>
        <p className="text-sm text-muted-foreground">
          Te enviamos tu código QR por correo. Paga en efectivo en la entrada y muéstralo al llegar. Si no lo ves, revisa
          tu carpeta de spam.
        </p>
      </div>
    );
  }

  if (done) {
    return (
      <div role="status" className="space-y-2 text-center py-4">
        <CheckCircle2 className="size-10 text-green-600 mx-auto" />
        <h2 className="font-semibold">Revisa tu correo</h2>
        <p className="text-sm text-muted-foreground">
          Te enviamos un mensaje con los siguientes pasos y el enlace de tu pedido. Si no lo ves, revisa tu carpeta de
          spam.
        </p>
      </div>
    );
  }

  const quantity = clampQuantity(quantityText, MAX_QUANTITY_UNCAPPED);
  const total = orderTotalLabel(priceCents, quantity);
  const setQuantity = (next: number) => setQuantityText(String(clampQuantity(next, MAX_QUANTITY_UNCAPPED)));

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

      <div className="space-y-1.5">
        <Label htmlFor="reg-quantity">Boletos</Label>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-10"
            aria-label="Quitar un boleto"
            disabled={quantity <= 1}
            onClick={() => setQuantity(quantity - 1)}
          >
            <Minus className="size-4" />
          </Button>
          <Input
            id="reg-quantity"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            className="w-16 text-center tabular-nums"
            value={quantityText}
            onChange={(e) => setQuantityText(sanitizeQuantityText(e.target.value))}
            onBlur={() => setQuantity(quantity)}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-10"
            aria-label="Agregar un boleto"
            disabled={quantity >= MAX_QUANTITY_UNCAPPED}
            onClick={() => setQuantity(quantity + 1)}
          >
            <Plus className="size-4" />
          </Button>
        </div>
        {quantity > 1 && total && (
          <p aria-live="polite" className="text-sm text-muted-foreground">
            {total === "Gratis" ? "Gratis" : `Total: ${total}`}
          </p>
        )}
      </div>

      {paymentMethods.length > 1 && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Forma de pago</legend>
          {paymentMethods.map((method) => (
            <label
              key={method}
              htmlFor={`pay-${method}`}
              className="flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm has-[:checked]:border-foreground"
            >
              <input
                id={`pay-${method}`}
                type="radio"
                name="paymentMethod"
                className="mt-1 size-4"
                checked={paymentMethod === method}
                onChange={() => setPaymentMethod(method)}
              />
              <span>
                <span className="font-medium">{METHOD_COPY[method].label}</span>
                <span className="block text-muted-foreground">{METHOD_COPY[method].hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
      )}
      {paymentMethods.length === 1 && paymentMethods[0] === "CASH" && (
        <p className="rounded-md border p-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Pago en efectivo en la entrada.</span> {METHOD_COPY.CASH.hint}
        </p>
      )}

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
        {paymentMethod === "CASH" ? "Pre-registrarme" : "Registrarme"}
      </Button>
    </form>
  );
}
