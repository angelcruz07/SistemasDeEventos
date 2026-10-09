/* eslint-disable @next/next/no-img-element -- the QR is a dynamic same-origin PNG; next/image adds nothing */
import { CheckCircle2 } from "lucide-react";

export function TicketCard({ token, checkedIn }: { token: string; checkedIn: boolean }) {
  return (
    <section aria-label="Tu boleto" className="space-y-3 text-center">
      {checkedIn ? (
        <p className="flex items-center justify-center gap-2 rounded-md bg-secondary px-3 py-2 text-sm font-medium">
          <CheckCircle2 className="size-4" /> Ya ingresó
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">Muestra este código QR en la entrada.</p>
      )}
      <img
        src={`/api/tickets/${encodeURIComponent(token)}/qr.png`}
        alt="Código QR de tu boleto"
        width={256}
        height={256}
        className={`mx-auto size-64 max-w-full rounded-md border bg-white p-2 ${checkedIn ? "opacity-50" : ""}`}
      />
    </section>
  );
}
