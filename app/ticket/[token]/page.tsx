import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Calendar, Clock, MapPin } from "lucide-react";
import prisma from "@/app/lib/prisma";
import { formatEventDate } from "@/lib/datetime";
import { getTicketingEnv } from "@/lib/env";
import { ticketLabel, ticketRedirectsToOrder } from "@/lib/ticketing/order-view";
import { formatShortCode } from "@/lib/ticketing/short-code";
import { ticketViewFor } from "@/lib/ticketing/ticket-view";
import { signOrderToken, verifyTicketToken } from "@/lib/ticketing/token";
import { ReceiptUpload } from "./_components/ReceiptUpload";
import { SpeiInstructions } from "./_components/SpeiInstructions";
import { parseTicketDesign } from "@/lib/ticketing/ticket-design";
import { TicketActions } from "./_components/TicketActions";
import { TicketCard } from "./_components/TicketCard";

// The token is in the URL: keep it out of Referer headers and search indexes.
export const metadata: Metadata = {
  title: "Tu boleto",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default async function TicketPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { signingSecret } = getTicketingEnv();
  const ticketId = verifyTicketToken(token, signingSecret);
  if (!ticketId) notFound();

  // Explicit columns: receipt bytes and other tickets' data are never loaded here.
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      name: true,
      code: true,
      status: true,
      rejectionReason: true,
      amountCents: true,
      orderId: true,
      seq: true,
      order: { select: { quantity: true } },
      event: {
        select: {
          title: true,
          slug: true,
          ticketDesign: true,
          isCancelled: true,
          date: true,
          time: true,
          location: true,
          speiClabe: true,
          speiBank: true,
          speiBeneficiary: true,
        },
      },
    },
  });
  if (!ticket) notFound();

  // A ticket that only mirrors an unpaid order has no QR: the order page is where the buyer pays.
  if (ticketRedirectsToOrder(ticket.status) && !ticket.event.isCancelled) {
    redirect(`/order/${signOrderToken(ticket.orderId, signingSecret)}`);
  }

  const view = ticketViewFor({ ...ticket, eventCancelled: ticket.event.isCancelled });
  const code = formatShortCode(ticket.code);
  const { event } = ticket;

  const isCard = view.kind === "ticket";
  const design = parseTicketDesign(event.ticketDesign, process.env.CLOUDINARY_CLOUD_NAME);

  return (
    // Theme tokens on the wrapper keep every state readable; the card view adopts the design background.
    <div
      className="min-h-screen bg-background text-foreground"
      style={isCard ? { backgroundColor: design.backgroundColor } : undefined}
    >
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-6 px-4 py-8">
      <header className="space-y-3">
        {/* The designed card already shows the title visibly; keep one h1 for assistive tech. */}
        <h1 className={isCard ? "sr-only" : "text-2xl font-bold break-words"}>
          {event.title}
        </h1>
        <ul
          className={`space-y-1.5 text-sm ${isCard ? "" : "text-muted-foreground"}`}
          style={isCard ? { color: design.textColor } : undefined}
        >
          <li className="flex items-center gap-2">
            <Calendar className="size-4 shrink-0" /> {formatEventDate(event.date)}
          </li>
          <li className="flex items-center gap-2">
            <Clock className="size-4 shrink-0" /> {event.time}
          </li>
          <li className="flex items-start gap-2">
            <MapPin className="mt-0.5 size-4 shrink-0" /> <span className="break-words">{event.location}</span>
          </li>
        </ul>
        {!isCard && (
          <div className="rounded-md border p-3">
            <p className="text-sm text-muted-foreground">Asistente</p>
            <p className="font-medium break-words">{ticket.name}</p>
            <p className="mt-1 font-mono text-lg tracking-widest">{code}</p>
          </div>
        )}
      </header>

      {view.kind === "upload" && (
        <>
          <SpeiInstructions
            clabe={event.speiClabe}
            bank={event.speiBank}
            beneficiary={event.speiBeneficiary}
            amountCents={ticket.amountCents}
            concept={code}
          />
          <ReceiptUpload token={token} rejectionReason={view.rejectionReason} />
        </>
      )}
      {view.kind === "review" && (
        <section className="rounded-md border p-4 text-center">
          <p className="font-medium">Comprobante recibido, en revisión</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Te enviaremos tu boleto por correo en cuanto validemos tu pago.
          </p>
        </section>
      )}
      {view.kind === "ticket" && (
        <>
          <TicketCard
            design={design}
            eventTitle={event.title}
            attendeeName={ticket.name}
            code={code}
            label={ticket.order.quantity > 1 ? ticketLabel(ticket.seq, ticket.order.quantity) : undefined}
            checkedIn={view.checkedIn}
            qrSrc={`/api/tickets/${encodeURIComponent(token)}/qr.png`}
          />
          <TicketActions token={token} eventTitle={event.title} slug={event.slug} />
        </>
      )}
      {view.kind === "cancelled" && (
        <section className="rounded-md border border-destructive/40 p-4 text-center">
          <p className="font-medium">Este boleto fue cancelado</p>
        </section>
      )}
    </main>
    </div>
  );
}
