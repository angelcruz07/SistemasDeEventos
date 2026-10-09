"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

/** Client pre-check is a convenience only; the server re-validates size and real file type. */
export function ReceiptUpload({ token, rejectionReason }: { token: string; rejectionReason: string | null }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function onSelect(selected: File | null) {
    setError(null);
    if (selected && selected.size > MAX_BYTES) {
      setFile(null);
      setError("El archivo supera el límite de 5 MB.");
      return;
    }
    if (selected && selected.type && !ALLOWED.includes(selected.type)) {
      setFile(null);
      setError("Formato no válido. Sube una imagen (JPG, PNG, WebP) o un PDF.");
      return;
    }
    setFile(selected);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return setError("Selecciona tu comprobante.");
    setLoading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(`/api/tickets/${encodeURIComponent(token)}/receipt`, { method: "POST", body });
      const data = (await res.json().catch(() => null)) as { success?: boolean; error?: string } | null;
      if (!res.ok || !data?.success) {
        setError(data?.error ?? "No se pudo subir el comprobante. Inténtalo de nuevo.");
        return;
      }
      router.refresh();
    } catch {
      setError("No se pudo subir el comprobante. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {rejectionReason && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
          <p className="font-medium">Tu comprobante fue rechazado</p>
          <p className="mt-1 break-words text-muted-foreground">Motivo: {rejectionReason}</p>
          <p className="mt-1">Sube un comprobante nuevo para continuar.</p>
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="receipt-file">Comprobante de pago (imagen o PDF, máx. 5 MB)</Label>
        <input
          id="receipt-file"
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm"
          onChange={(e) => onSelect(e.target.files?.[0] ?? null)}
        />
      </div>
      {error && (
        <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={loading || !file}>
        {loading ? <Loader2 className="animate-spin" /> : null}
        {loading ? "Subiendo..." : "Enviar comprobante"}
      </Button>
    </form>
  );
}
