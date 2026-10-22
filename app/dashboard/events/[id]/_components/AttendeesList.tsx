"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { SquareCheck, Trash2 } from "lucide-react";
import type { TicketStatus } from "@/app/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import type { OrderRow } from "@/lib/ticketing/attendee-rows";
import { ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS, STATUS_LABELS } from "@/lib/ticketing/attendees";
import {
  cancelOrder,
  cancelTicket,
  deleteOrder,
  markOrderPaid,
  resendOrder,
  type ReviewResult,
} from "../_actions/review.actions";
import { ConfirmDialog, type ConfirmTone } from "./ConfirmDialog";
import { ReceiptDialog } from "./ReceiptDialog";

export type { OrderRow };

const BADGE: Record<TicketStatus, string> = {
  PENDING_RECEIPT: "bg-muted text-muted-foreground",
  PENDING_VALIDATION: "bg-amber-100 text-amber-900",
  PAID: "bg-green-100 text-green-900",
  CHECKED_IN: "bg-blue-100 text-blue-900",
  REJECTED: "bg-red-100 text-red-900",
  CANCELLED: "bg-muted text-muted-foreground line-through",
  PENDING_CASH: "bg-orange-100 text-orange-900",
};

const ticketsLabel = (n: number) => `${n} ${n === 1 ? "boleto" : "boletos"}`;

/** A confirmation the modal shows before running a destructive or money-related action. */
interface PendingConfirm {
  key: string;
  title: string;
  description: React.ReactNode;
  details?: Array<{ label: string; value: string }>;
  confirmLabel: string;
  pendingLabel: string;
  tone: ConfirmTone;
  success: string;
  action: () => Promise<ReviewResult>;
}

const orderDetails = (row: OrderRow) => [
  { label: "Asistente", value: row.name },
  { label: "Código", value: row.code },
  { label: "Boletos", value: ticketsLabel(row.quantity) },
  { label: "Monto", value: `${row.amount} · ${PAYMENT_METHOD_LABELS[row.paymentMethod]}` },
];

function markPaidConfirm(eventId: string, row: OrderRow): PendingConfirm {
  const cash = row.status === "PENDING_CASH";
  return {
    key: row.id,
    title: "¿Marcar como pagada?",
    description: cash
      ? `Se registran ${row.amount} en efectivo en el corte de caja y sus boletos quedan pagados. No se envía correo: ya tiene su QR.`
      : `Se emiten ${row.quantity === 1 ? "su boleto" : "sus boletos"} y se ${row.quantity === 1 ? "le envía" : "le envían"} por correo.`,
    details: orderDetails(row),
    confirmLabel: "Marcar como pagada",
    pendingLabel: "Guardando…",
    tone: "success",
    success: `${row.name} quedó marcado como pagado.`,
    action: () => markOrderPaid(eventId, row.id),
  };
}

function cancelOrderConfirm(eventId: string, row: OrderRow): PendingConfirm {
  return {
    key: row.id,
    title: "¿Cancelar la compra?",
    description: row.paid
      ? "Los boletos de esta compra dejarán de ser válidos. El dinero cobrado no se reembolsa automáticamente y se mantiene en el corte."
      : "Se cancelarán todos sus boletos y se liberan sus lugares.",
    details: orderDetails(row),
    confirmLabel: "Cancelar compra",
    pendingLabel: "Cancelando…",
    tone: "destructive",
    success: `Se canceló la compra de ${row.name}.`,
    action: () => cancelOrder(eventId, row.id),
  };
}

function deleteConfirm(eventId: string, row: OrderRow): PendingConfirm {
  return {
    key: row.id,
    title: "¿Borrar asistente?",
    description: (
      <>
        Se eliminan su compra y {ticketsLabel(row.quantity)} de forma permanente; sus QR dejarán de funcionar.
        {row.paid && <> Los {row.amount} cobrados dejarán de contar en el corte de caja.</>}{" "}
        <span className="font-medium text-foreground">Esto no se puede deshacer.</span>
      </>
    ),
    details: orderDetails(row),
    confirmLabel: "Borrar",
    pendingLabel: "Borrando…",
    tone: "destructive",
    success: `Se borró a ${row.name}.`,
    action: () => deleteOrder(eventId, row.id),
  };
}

function cancelTicketConfirm(eventId: string, row: OrderRow, ticket: OrderRow["tickets"][number]): PendingConfirm {
  return {
    key: ticket.id,
    title: "¿Cancelar este boleto?",
    description: "El QR de este boleto dejará de funcionar en la puerta. Los demás boletos de la compra siguen válidos.",
    details: [
      { label: "Asistente", value: row.name },
      { label: "Boleto", value: `${ticket.code} · ${ticket.position}` },
    ],
    confirmLabel: "Cancelar boleto",
    pendingLabel: "Cancelando…",
    tone: "destructive",
    success: `Se canceló el boleto ${ticket.code}.`,
    action: () => cancelTicket(eventId, ticket.id),
  };
}

export function AttendeesList({ eventId, rows }: { eventId: string; rows: OrderRow[] }) {
  const router = useRouter();
  const [reviewing, setReviewing] = useState<OrderRow | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [confirm, setConfirm] = useState<PendingConfirm | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  function ask(request: PendingConfirm) {
    setConfirmError(null);
    setConfirm(request);
  }

  const closeConfirm = useCallback(() => {
    setConfirm(null);
    setConfirmError(null);
  }, []);

  async function confirmAndRun() {
    if (!confirm) return;
    setBusy(confirm.key);
    setConfirmError(null);
    const result = await confirm.action();
    setBusy(null);
    if (!result.success) {
      setConfirmError(result.error); // keep the modal open so they can retry or go back
      return;
    }
    setMessage(confirm.success);
    setConfirm(null);
    // Re-fetch the server list so a status filter in the URL keeps the rows honest.
    router.refresh();
  }

  /** Actions that need no confirmation (re-sending an email). */
  async function run(key: string, action: () => Promise<ReviewResult>, success: string) {
    setBusy(key);
    const result = await action();
    setBusy(null);
    setMessage(result.success ? success : result.error);
    if (result.success) router.refresh();
  }

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (rows.length === 0) {
    return <p className="rounded-lg border p-6 text-center text-sm text-muted-foreground">No hay compras.</p>;
  }

  return (
    <>
      {message && (
        <p role="status" className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
          {message}
        </p>
      )}
      <ul className="divide-y rounded-lg border bg-card">
        {rows.map((row) => {
          const open = expanded.has(row.id);
          const panelId = `tickets-${row.id}`;
          return (
            <li key={row.id} className="p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate font-medium">{row.name}</p>
                  <p className="truncate text-sm text-muted-foreground">{row.email ?? "Sin correo"}</p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-mono">{row.code}</span> · {ticketsLabel(row.quantity)} · {row.amount} ·{" "}
                    {PAYMENT_METHOD_LABELS[row.paymentMethod]} · {row.createdAt}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {row.paid ? (
                    <span className="inline-flex h-8 items-center gap-2 rounded-md border border-green-600/40 bg-green-50 px-2.5 text-sm text-green-900 dark:bg-green-950/40 dark:text-green-200">
                      <SquareCheck className="size-4 text-green-600" aria-hidden />
                      Pagado
                    </span>
                  ) : (
                    row.canMarkPaid && (
                      <label
                        className={`inline-flex h-8 items-center gap-2 rounded-md border px-2.5 text-sm ${
                          busy === row.id ? "opacity-60" : "cursor-pointer hover:bg-accent"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="size-4 accent-green-600"
                          checked={false}
                          disabled={busy === row.id}
                          onChange={() => ask(markPaidConfirm(eventId, row))}
                        />
                        Pagado
                      </label>
                    )
                  )}
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${BADGE[row.status]}`}>
                    {ORDER_STATUS_LABELS[row.status]}
                  </span>
                  {row.canReview && (
                    <Button size="sm" onClick={() => setReviewing(row)}>
                      Revisar
                    </Button>
                  )}
                  {row.canResend && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy === row.id}
                      onClick={() => run(row.id, () => resendOrder(eventId, row.id), `Se reenvió el correo a ${row.name}.`)}
                    >
                      Reenviar correo
                    </Button>
                  )}
                  {row.canCancel && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy === row.id}
                      onClick={() => ask(cancelOrderConfirm(eventId, row))}
                    >
                      Cancelar
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    disabled={busy === row.id}
                    aria-label={`Borrar a ${row.name}`}
                    title="Borrar"
                    onClick={() => ask(deleteConfirm(eventId, row))}
                  >
                    <Trash2 />
                    <span className="sm:sr-only">Borrar</span>
                  </Button>
                  {row.tickets.length > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-expanded={open}
                      aria-controls={panelId}
                      onClick={() => toggle(row.id)}
                    >
                      {open ? "Ocultar boletos" : "Ver boletos"}
                    </Button>
                  )}
                </div>
              </div>

              {open && (
                <ul id={panelId} className="mt-3 divide-y rounded-md border bg-background">
                  {row.tickets.map((ticket) => (
                    <li
                      key={ticket.id}
                      className="flex flex-col gap-2 p-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p>
                          <span className="font-mono">{ticket.code}</span>{" "}
                          <span className="text-muted-foreground">· {ticket.position}</span>
                        </p>
                        {ticket.checkedInAt && (
                          <p className="text-xs text-muted-foreground">
                            Ingresó {ticket.checkedInAt}
                            {ticket.checkedInBy ? ` · ${ticket.checkedInBy}` : ""}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${BADGE[ticket.status]}`}>
                          {STATUS_LABELS[ticket.status]}
                        </span>
                        {ticket.canCancel && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy === ticket.id}
                            onClick={() => ask(cancelTicketConfirm(eventId, row, ticket))}
                          >
                            Cancelar boleto
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.title ?? ""}
        description={confirm?.description}
        details={confirm?.details}
        confirmLabel={confirm?.confirmLabel ?? ""}
        pendingLabel={confirm?.pendingLabel}
        tone={confirm?.tone}
        pending={confirm !== null && busy === confirm.key}
        error={confirmError}
        onConfirm={confirmAndRun}
        onCancel={closeConfirm}
      />
      {reviewing && <ReceiptDialog eventId={eventId} row={reviewing} onClose={() => setReviewing(null)} />}
    </>
  );
}
