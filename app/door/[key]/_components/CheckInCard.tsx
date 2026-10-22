"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TicketStatus } from "@/app/generated/prisma/enums";
import { STATUS_LABELS } from "@/lib/ticketing/attendees";
import type { CheckInDecision } from "@/lib/ticketing/checkin";
import type { DoorTicketView } from "@/lib/ticketing/door-view";
import { formatShortCode } from "@/lib/ticketing/short-code";
import { checkIn, collectCashAndCheckIn } from "../_actions/door.actions";

type Outcome = { tone: "ok" | "warn" | "deny"; title: string; detail?: string };

const TONES = {
  ok: "border-green-600 bg-green-50 text-green-900",
  warn: "border-amber-500 bg-amber-50 text-amber-900",
  deny: "border-red-600 bg-red-50 text-red-900",
} as const;

function initialOutcome(decision: CheckInDecision): Outcome | null {
  if (decision.kind === "collect") return { tone: "warn", title: "COBRAR EN EFECTIVO", detail: decision.message };
  if (decision.kind === "already") return { tone: "warn", title: "YA INGRESÓ", detail: decision.message };
  if (decision.kind === "denied") return { tone: "deny", title: "ACCESO DENEGADO", detail: decision.message };
  return null;
}

export function CheckInCard({
  doorKey,
  ticket,
  decision,
  onDone,
}: {
  doorKey: string;
  ticket: DoorTicketView;
  decision: CheckInDecision;
  onDone: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(initialOutcome(decision));
  const [done, setDone] = useState(false);
  // Status shown on the card; refreshed after collecting cash so it never reads "pendiente" once paid.
  const [shown, setShown] = useState(ticket);

  const handleCheckIn = async () => {
    setLoading(true);
    const result = await checkIn(doorKey, ticket.id);
    setLoading(false);
    setDone(true);
    if (!result.success && result.code === "SESSION_EXPIRED") router.refresh();
    if (result.success) setOutcome({ tone: "ok", title: "ACCESO PERMITIDO" });
    else if (result.decision?.kind === "already") setOutcome({ tone: "warn", title: "YA INGRESÓ", detail: result.error });
    else setOutcome({ tone: "deny", title: "ACCESO DENEGADO", detail: result.error });
  };

  const handleCollect = async (amount: string) => {
    if (!window.confirm(`¿Ya recibiste ${amount} en efectivo?`)) return;
    setLoading(true);
    const result = await collectCashAndCheckIn(doorKey, ticket.id);
    setLoading(false);
    if (!result.success && result.code === "SESSION_EXPIRED") router.refresh();
    if (result.success) {
      setDone(true);
      setShown(result.ticket);
      const others =
        result.otherTickets === 1
          ? " El otro boleto del pedido quedó pagado: escanéalo para darle acceso."
          : result.otherTickets > 1
            ? ` Los otros ${result.otherTickets} boletos del pedido quedaron pagados: escanéalos para darles acceso.`
            : "";
      setOutcome({ tone: "ok", title: "PAGO REGISTRADO · ACCESO PERMITIDO", detail: `Cobrado: ${result.amount}.${others}` });
    } else if (result.decision?.kind === "allow") {
      if (result.ticket) setShown(result.ticket);
      // Someone else registered the payment first: this ticket is PAID and can still be let in.
      setOutcome({ tone: "warn", title: "YA PAGADO", detail: result.error });
    } else {
      setDone(true);
      setOutcome({ tone: "deny", title: "NO SE REGISTRÓ EL PAGO", detail: result.error });
    }
  };

  const status = STATUS_LABELS[shown.status as TicketStatus] ?? shown.status;
  return (
    <section className="space-y-4 rounded-xl border p-4" aria-live="polite">
      <div className="space-y-1">
        <p className="text-xl font-bold break-words">{ticket.name}</p>
        <p className="font-mono text-lg tracking-widest">{formatShortCode(ticket.code)}</p>
        <p className="text-sm text-muted-foreground">Estado: {status}</p>
      </div>
      {ticket.answers.length > 0 && (
        <dl className="space-y-1 text-sm">
          {ticket.answers.map((a, i) => (
            <div key={`${a.label}-${i}`}>
              <dt className="text-muted-foreground">{a.label}</dt>
              <dd className="break-words">{a.value || "—"}</dd>
            </div>
          ))}
        </dl>
      )}
      {outcome && (
        <div role="status" className={`rounded-lg border-2 p-4 text-center ${TONES[outcome.tone]}`}>
          <p className="text-2xl font-extrabold">{outcome.title}</p>
          {outcome.detail && <p className="mt-1 text-base">{outcome.detail}</p>}
        </div>
      )}
      {decision.kind === "collect" && !done && outcome?.title !== "YA PAGADO" && (
        <Button
          type="button"
          onClick={() => handleCollect(decision.amount)}
          disabled={loading}
          className="h-16 w-full text-xl"
        >
          {loading ? <Loader2 className="size-6 animate-spin" /> : `Cobré ${decision.amount} · Dar acceso`}
        </Button>
      )}
      {(decision.kind === "allow" || outcome?.title === "YA PAGADO") && !done && (
        <Button type="button" onClick={handleCheckIn} disabled={loading} className="h-16 w-full text-xl">
          {loading ? <Loader2 className="size-6 animate-spin" /> : "Dar acceso"}
        </Button>
      )}
      <Button type="button" variant="outline" onClick={onDone} className="h-12 w-full">
        Siguiente
      </Button>
    </section>
  );
}
