import { Download, QrCode } from "lucide-react";
import { ShareEventButton } from "@/app/event/[slug]/_components/ShareEventButton";

export function TicketActions({ token, eventTitle, slug }: { token: string; eventTitle: string; slug: string }) {
  return (
    <div className="grid gap-2">
      <a
        href={`/api/tickets/${encodeURIComponent(token)}/pdf`}
        className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
      >
        <Download className="size-4" /> Descargar PDF
      </a>
      <a
        href={`/api/tickets/${encodeURIComponent(token)}/qr.png?download=1`}
        download
        className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md border px-4 text-sm font-medium"
      >
        <QrCode className="size-4" /> Descargar QR
      </a>
      <ShareEventButton title={eventTitle} path={`/event/${encodeURIComponent(slug)}`} />
    </div>
  );
}
