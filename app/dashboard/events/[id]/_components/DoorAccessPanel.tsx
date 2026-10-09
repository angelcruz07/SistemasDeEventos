"use client";

import { useState } from "react";
import { Check, Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { generateDoorAccess, revokeDoorAccess } from "../_actions/door.actions";

export interface DoorStatus {
  state: "none" | "active" | "revoked";
  createdAt: string | null;
  lockedUntil: string | null;
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 break-all rounded-md border bg-muted px-2 py-1.5 text-sm">{value}</code>
        <Button type="button" variant="outline" size="sm" onClick={copy} aria-label={`Copiar ${label}`}>
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </Button>
      </div>
    </div>
  );
}

const STATE_LABEL = { none: "Sin generar", active: "Activo", revoked: "Revocado" } as const;

export function DoorAccessPanel({ eventId, status }: { eventId: string; status: DoorStatus }) {
  const [creds, setCreds] = useState<{ url: string; pin: string } | null>(null);
  const [busy, setBusy] = useState<"generate" | "revoke" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    if (
      status.state === "active" &&
      !confirm("Se generará un enlace y un PIN nuevos. El personal con sesión abierta tendrá que volver a entrar. ¿Continuar?")
    ) {
      return;
    }
    setBusy("generate");
    setError(null);
    const result = await generateDoorAccess(eventId);
    if (result.success) setCreds({ url: result.url, pin: result.pin });
    else setError(result.error);
    setBusy(null);
  };

  const revoke = async () => {
    if (!confirm("El enlace y el PIN dejarán de funcionar y se cerrarán todas las sesiones. ¿Revocar?")) return;
    setBusy("revoke");
    setError(null);
    const result = await revokeDoorAccess(eventId);
    if (result.success) setCreds(null);
    else setError(result.error);
    setBusy(null);
  };

  const locked = status.lockedUntil && new Date(status.lockedUntil) > new Date();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Acceso de puerta</CardTitle>
        <CardDescription>
          Comparte el enlace y el PIN con tu personal. Solo podrán escanear y registrar ingresos; no ven comprobantes ni
          montos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-1 text-sm">
          <li>
            Estado: <span className="font-medium">{STATE_LABEL[status.state]}</span>
          </li>
          {status.createdAt && (
            <li>
              Generado:{" "}
              {new Date(status.createdAt).toLocaleString("es-MX", { timeZone: "America/Mexico_City" })}
            </li>
          )}
          {status.state === "active" && locked && (
            <li className="text-destructive">Bloqueado por intentos fallidos. Se libera solo o al regenerar.</li>
          )}
        </ul>

        {creds && (
          <div className="space-y-3 rounded-md border border-amber-500/50 bg-amber-500/10 p-3">
            <p className="text-sm font-medium">Guárdalo, no se volverá a mostrar.</p>
            <CopyRow label="Enlace" value={creds.url} />
            <CopyRow label="PIN" value={creds.pin} />
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={generate} disabled={busy !== null}>
            {busy === "generate" && <Loader2 className="size-4 animate-spin" />}
            {status.state === "none" ? "Generar acceso" : "Regenerar enlace y PIN"}
          </Button>
          {status.state === "active" && (
            <Button type="button" variant="outline" onClick={revoke} disabled={busy !== null}>
              {busy === "revoke" && <Loader2 className="size-4 animate-spin" />} Revocar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
