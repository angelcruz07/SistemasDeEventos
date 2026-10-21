"use client";

import { useState } from "react";
import { AlertCircle, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { TicketingConfigInput } from "@/lib/ticketing/ticketing-config";
import { updateTicketingConfig } from "../_actions/ticketing.actions";

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-sm text-destructive">{message}</p> : null;
}

function Toggle({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="flex items-start gap-3 cursor-pointer">
      <input
        id={id}
        type="checkbox"
        className="mt-1 size-4"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="text-sm">
        <span className="font-medium">{label}</span>
        {hint && <span className="block text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );
}

export function TicketingForm({ eventId, initial }: { eventId: string; initial: TicketingConfigInput }) {
  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const set = <K extends keyof TicketingConfigInput>(key: K, value: TicketingConfigInput[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setFieldErrors({});
    const result = await updateTicketingConfig(eventId, values);
    if (result.success) {
      setSaved(true);
    } else {
      setError(result.error);
      setFieldErrors(result.fieldErrors ?? {});
    }
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Precio y métodos de pago</CardTitle>
          <CardDescription>Con precio 0 el boleto es gratuito y no hay paso de pago.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="price">Precio por boleto (MXN)</Label>
            <Input
              id="price"
              inputMode="decimal"
              value={values.price}
              onChange={(e) => set("price", e.target.value)}
              placeholder="350.00"
            />
            <FieldError message={fieldErrors.price} />
          </div>
          <Toggle
            id="allowSpei"
            label="Transferencia SPEI"
            hint="Visible para el público; el asistente sube su comprobante."
            checked={values.allowSpei}
            onChange={(v) => set("allowSpei", v)}
          />
          <Toggle
            id="allowCash"
            label="Efectivo en puerta (no visible al público)"
            hint="Solo se usa para registros en la entrada del evento."
            checked={values.allowCash}
            onChange={(v) => set("allowCash", v)}
          />
          <Toggle
            id="allowCashPrereg"
            label="Efectivo con pre-registro en línea"
            hint="El asistente se registra en la página del evento, recibe su QR por correo y paga en efectivo en la entrada. El staff cobra al escanear el QR (activa el acceso de puerta)."
            checked={values.allowCashPrereg}
            onChange={(v) => set("allowCashPrereg", v)}
          />
          <FieldError message={fieldErrors.methods} />
        </CardContent>
      </Card>

      {values.allowSpei && (
        <Card>
          <CardHeader>
            <CardTitle>Datos para SPEI</CardTitle>
            <CardDescription>
              Obligatorios si el evento tiene precio. El concepto de la transferencia será el código del boleto.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="speiClabe">CLABE</Label>
              <Input
                id="speiClabe"
                inputMode="numeric"
                value={values.speiClabe}
                onChange={(e) => set("speiClabe", e.target.value)}
                placeholder="18 dígitos"
              />
              <FieldError message={fieldErrors.speiClabe} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="speiBank">Banco</Label>
              <Input id="speiBank" value={values.speiBank} onChange={(e) => set("speiBank", e.target.value)} />
              <FieldError message={fieldErrors.speiBank} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="speiBeneficiary">Beneficiario</Label>
              <Input
                id="speiBeneficiary"
                value={values.speiBeneficiary}
                onChange={(e) => set("speiBeneficiary", e.target.value)}
              />
              <FieldError message={fieldErrors.speiBeneficiary} />
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Cupo y registro</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="capacity">Cupo interno (nunca se muestra al público)</Label>
            <Input
              id="capacity"
              inputMode="numeric"
              value={values.capacity}
              onChange={(e) => set("capacity", e.target.value)}
              placeholder="Sin límite"
            />
            <FieldError message={fieldErrors.capacity} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="displayCapacity">Número público de lugares (opcional)</Label>
            <Input
              id="displayCapacity"
              inputMode="numeric"
              value={values.displayCapacity}
              onChange={(e) => set("displayCapacity", e.target.value)}
              placeholder="No mostrar"
            />
            <FieldError message={fieldErrors.displayCapacity} />
          </div>
          <Toggle
            id="registrationOpen"
            label="Registro abierto"
            hint="Si lo desactivas, nadie nuevo podrá registrarse."
            checked={values.registrationOpen}
            onChange={(v) => set("registrationOpen", v)}
          />
        </CardContent>
      </Card>

      {error && (
        <p className="flex items-center gap-2 text-sm text-destructive" role="alert">
          <AlertCircle className="size-4" />
          {error}
        </p>
      )}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          Guardar cambios
        </Button>
        {saved && (
          <span className="flex items-center gap-1 text-sm text-green-600">
            <Check className="size-4" />
            Guardado
          </span>
        )}
      </div>
    </form>
  );
}
