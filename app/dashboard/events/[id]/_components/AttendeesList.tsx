"use client";

import { useState } from "react";
import type { PaymentMethod, TicketStatus } from "@/app/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { STATUS_LABELS } from "@/lib/ticketing/attendees";
import { canApprove, canCancel, resendKindFor } from "@/lib/ticketing/review";
import { cancelTicket, resendTicketEmail } from "../_actions/review.actions";
import { ReceiptDialog } from "./ReceiptDialog";

export interface AttendeeRow {
  id: string;
  name: string;
  email: string | null;
  code: string;
  status: TicketStatus;
  paymentMethod: PaymentMethod;
  createdAt: string;
  answers: Array<{ label: string; value: string }>;
  rejectionReason: string | null;
  receipt: { id: string; mimeType: string; purged: boolean } | null;
}

const METHOD_LABELS: Record<PaymentMethod, string> = { SPEI: "SPEI", CASH: "Efectivo", FREE: "Gratis" };

const BADGE: Record<TicketStatus, string> = {
  PENDING_RECEIPT: "bg-muted text-muted-foreground",
  PENDING_VALIDATION: "bg-amber-100 text-amber-900",
  PAID: "bg-green-100 text-green-900",
  CHECKED_IN: "bg-blue-100 text-blue-900",
  REJECTED: "bg-red-100 text-red-900",
  CANCELLED: "bg-muted text-muted-foreground line-through",
};

export function AttendeesList({ eventId, rows }: { eventId: string; rows: AttendeeRow[] }) {
  const [reviewing, setReviewing] = useState<AttendeeRow | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function run(row: AttendeeRow, action: typeof cancelTicket, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(row.id);
    const result = await action(eventId, row.id);
    setBusy(null);
    setMessage(result.success ? "Listo." : result.error);
  }

  if (rows.length === 0) {
    return <p className="rounded-lg border p-6 text-center text-sm text-muted-foreground">No hay asistentes.</p>;
  }

  return (
    <>
      {message && (
        <p role="status" className="text-sm text-muted-foreground">
          {message}
        </p>
      )}
      <ul className="divide-y rounded-lg border bg-card">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="truncate font-medium">{row.name}</p>
              <p className="truncate text-sm text-muted-foreground">{row.email ?? "Sin correo"}</p>
              <p className="text-xs text-muted-foreground">
                <span className="font-mono">{row.code}</span> · {METHOD_LABELS[row.paymentMethod]} · {row.createdAt}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${BADGE[row.status]}`}>
                {STATUS_LABELS[row.status]}
              </span>
              {canApprove(row.status) && (
                <Button size="sm" onClick={() => setReviewing(row)}>
                  Revisar
                </Button>
              )}
              {resendKindFor(row.status) && row.email && (
                <Button size="sm" variant="outline" disabled={busy === row.id} onClick={() => run(row, resendTicketEmail)}>
                  Reenviar correo
                </Button>
              )}
              {canCancel(row.status) && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy === row.id}
                  onClick={() => run(row, cancelTicket, `¿Cancelar el boleto de ${row.name}?`)}
                >
                  Cancelar
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {reviewing && <ReceiptDialog eventId={eventId} row={reviewing} onClose={() => setReviewing(null)} />}
    </>
  );
}
