"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MAX_REASON_LENGTH } from "@/lib/ticketing/review";
import type { OrderRow } from "@/lib/ticketing/attendee-rows";
import { approveOrder, rejectOrder } from "../_actions/review.actions";

export function ReceiptDialog({
  eventId,
  row,
  onClose,
}: {
  eventId: string;
  row: OrderRow;
  onClose: () => void;
}) {
  const router = useRouter();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(action: () => ReturnType<typeof approveOrder>) {
    setPending(true);
    setError(null);
    const result = await action();
    setPending(false);
    if (result.success) {
      onClose();
      // Re-fetch the server list: with a status filter in the URL the row must update or disappear.
      router.refresh();
    } else setError(result.error);
  }

  const receipt = row.receipt;
  const isImage = receipt?.mimeType.startsWith("image/");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-dialog-title"
      onClick={pending ? undefined : onClose}
    >
      <div
        className="bg-card text-card-foreground max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-lg border p-4 shadow-lg sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 id="receipt-dialog-title" className="text-lg font-semibold">
            Revisar comprobante
          </h2>
          <p className="text-sm text-muted-foreground">
            {row.name} · <span className="font-mono">{row.code}</span>
          </p>
          <p className="mt-1 text-sm">
            {row.quantity} {row.quantity === 1 ? "boleto" : "boletos"} · Total a verificar:{" "}
            <span className="font-semibold">{row.amount}</span>
          </p>
        </div>

        {!receipt ? (
          <p className="text-sm text-muted-foreground">No hay comprobante.</p>
        ) : receipt.purged ? (
          <p className="text-sm text-muted-foreground">El comprobante ya fue eliminado por retención.</p>
        ) : isImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- authenticated, no-store route; next/image would cache it
          <img src={`/api/receipts/${receipt.id}`} alt={`Comprobante de ${row.name}`} className="max-h-96 w-full rounded border object-contain" />
        ) : (
          <a className="text-sm underline" href={`/api/receipts/${receipt.id}`} target="_blank" rel="noopener noreferrer">
            Descargar comprobante (PDF)
          </a>
        )}

        {row.answers.length > 0 && (
          <dl className="space-y-1 text-sm">
            {row.answers.map((a) => (
              <div key={a.label}>
                <dt className="text-muted-foreground">{a.label}</dt>
                <dd className="break-words">{a.value || "—"}</dd>
              </div>
            ))}
          </dl>
        )}

        {rejecting && (
          <div className="space-y-1">
            <label htmlFor="reject-reason" className="text-sm font-medium">
              Motivo del rechazo
            </label>
            <textarea
              id="reject-reason"
              className="w-full rounded-md border bg-background p-2 text-sm"
              rows={3}
              maxLength={MAX_REASON_LENGTH}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cerrar
          </Button>
          {rejecting ? (
            <Button
              variant="destructive"
              disabled={pending || !reason.trim()}
              onClick={() => submit(() => rejectOrder(eventId, row.id, reason))}
            >
              {pending ? "Rechazando..." : "Confirmar rechazo"}
            </Button>
          ) : (
            <>
              <Button variant="destructive" disabled={pending} onClick={() => setRejecting(true)}>
                Rechazar
              </Button>
              <Button disabled={pending} onClick={() => submit(() => approveOrder(eventId, row.id))}>
                {pending ? "Aprobando..." : "Aprobar"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
