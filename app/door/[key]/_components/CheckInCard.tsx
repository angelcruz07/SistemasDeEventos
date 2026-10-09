"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TicketStatus } from "@/app/generated/prisma/enums";
import { STATUS_LABELS } from "@/lib/ticketing/attendees";
import type { CheckInDecision } from "@/lib/ticketing/checkin";
import type { DoorTicketView } from "@/lib/ticketing/door-view";
import { formatShortCode } from "@/lib/ticketing/short-code";
import { checkIn } from "../_actions/door.actions";

type Outcome = { tone: "ok" | "warn" | "deny"; title: string; detail?: string };

const TONES = {
  ok: "border-green-600 bg-green-50 text-green-900",
  warn: "border-amber-500 bg-amber-50 text-amber-900",
  deny: "border-red-600 bg-red-50 text-red-900",
} as const;

function initialOutcome(decision: CheckInDecision): Outcome | null {
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
  const [loading, setLoading] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(initialOutcome(decision));
  const [done, setDone] = useState(false);

  const handleCheckIn = async () => {
    setLoading(true);
    const result = await checkIn(doorKey, ticket.id);
    setLoading(false);
    setDone(true);
    if (result.success) setOutcome({ tone: "ok", title: "ACCESO PERMITIDO" });
    else if (result.decision?.kind === "already") setOutcome({ tone: "warn", title: "YA INGRESÓ", detail: result.error });
    else setOutcome({ tone: "deny", title: "ACCESO DENEGADO", detail: result.error });
  };

  const status = STATUS_LABELS[ticket.status as TicketStatus] ?? ticket.status;
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
      {decision.kind === "allow" && !done && (
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
