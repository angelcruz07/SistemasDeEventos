"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { TicketStatus } from "@/app/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import type { OrderRow } from "@/lib/ticketing/attendee-rows";
import { ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS, STATUS_LABELS } from "@/lib/ticketing/attendees";
import { cancelOrder, cancelTicket, resendOrder, type ReviewResult } from "../_actions/review.actions";
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

export function AttendeesList({ eventId, rows }: { eventId: string; rows: OrderRow[] }) {
  const router = useRouter();
  const [reviewing, setReviewing] = useState<OrderRow | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function run(key: string, action: () => Promise<ReviewResult>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(key);
    const result = await action();
    setBusy(null);
    setMessage(result.success ? "Listo." : result.error);
    // Re-fetch the server list so a status filter in the URL keeps the rows honest.
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
        <p role="status" className="text-sm text-muted-foreground">
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
                      onClick={() => run(row.id, () => resendOrder(eventId, row.id))}
                    >
                      Reenviar correo
                    </Button>
                  )}
                  {row.canCancel && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy === row.id}
                      onClick={() =>
                        run(
                          row.id,
                          () => cancelOrder(eventId, row.id),
                          row.paid
                            ? `¿Cancelar la compra de ${row.name}? Los boletos de esta compra dejarán de ser válidos. El dinero cobrado no se reembolsa automáticamente.`
                            : `¿Cancelar la compra de ${row.name}? Se cancelarán todos sus boletos.`,
                        )
                      }
                    >
                      Cancelar
                    </Button>
                  )}
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
                            onClick={() =>
                              run(
                                ticket.id,
                                () => cancelTicket(eventId, ticket.id),
                                `¿Cancelar el boleto ${ticket.code} (${ticket.position})?`,
                              )
                            }
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
      {reviewing && <ReceiptDialog eventId={eventId} row={reviewing} onClose={() => setReviewing(null)} />}
    </>
  );
}
