/* eslint-disable @next/next/no-img-element -- QR is a dynamic same-origin PNG; design images come from the Cloudinary CDN */
import { CheckCircle2 } from "lucide-react";
import type { TicketDesign } from "@/lib/ticketing/ticket-design";

interface TicketCardProps {
  design: TicketDesign;
  eventTitle: string;
  attendeeName: string;
  code: string;
  checkedIn: boolean;
  /** Same-origin QR image; omitted in the owner preview, which shows a placeholder. */
  qrSrc?: string;
}

/** Shared by the attendee page and the owner's live preview. Colors come only from the parsed design. */
export function TicketCard({ design, eventTitle, attendeeName, code, checkedIn, qrSrc }: TicketCardProps) {
  const dark = design.template === "dark";
  return (
    <section
      aria-label="Tu boleto"
      className="overflow-hidden rounded-lg border text-center"
      style={{
        backgroundColor: design.backgroundColor,
        color: design.textColor,
        borderColor: design.accentColor,
        borderWidth: dark ? 2 : 1,
      }}
    >
      {design.template === "image" && design.headerImageUrl && (
        <img src={design.headerImageUrl} alt="" className="h-32 w-full object-cover" />
      )}
      <div className="space-y-3 p-4">
        {design.logoUrl && <img src={design.logoUrl} alt="" className="mx-auto max-h-12 w-auto object-contain" />}
        <h2 className="text-lg font-bold break-words" style={{ color: design.accentColor }}>
          {eventTitle}
        </h2>
        <div>
          <p className="font-medium break-words">{attendeeName}</p>
          <p className="font-mono text-lg tracking-widest">{code}</p>
        </div>
        {checkedIn ? (
          <p
            className="flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium"
            style={{ borderColor: design.accentColor }}
          >
            <CheckCircle2 className="size-4" /> Ya ingresó
          </p>
        ) : (
          <p className="text-sm opacity-80">Muestra este código QR en la entrada.</p>
        )}
        {qrSrc ? (
          <img
            src={qrSrc}
            alt="Código QR de tu boleto"
            width={256}
            height={256}
            className={`mx-auto size-64 max-w-full rounded-md bg-white p-2 ${checkedIn ? "opacity-50" : ""}`}
          />
        ) : (
          <div
            aria-label="Vista previa del código QR"
            className="mx-auto flex size-40 max-w-full items-center justify-center rounded-md bg-white text-sm text-neutral-500"
          >
            QR
          </div>
        )}
        {design.footerText && <p className="text-sm break-words whitespace-pre-line opacity-80">{design.footerText}</p>}
      </div>
    </section>
  );
}
