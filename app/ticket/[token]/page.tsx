import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Calendar, Clock, MapPin } from "lucide-react";
import prisma from "@/app/lib/prisma";
import { formatEventDate } from "@/lib/datetime";
import { getTicketingEnv } from "@/lib/env";
import { formatShortCode } from "@/lib/ticketing/short-code";
import { ticketViewFor } from "@/lib/ticketing/ticket-view";
import { verifyTicketToken } from "@/lib/ticketing/token";
import { ReceiptUpload } from "./_components/ReceiptUpload";
import { SpeiInstructions } from "./_components/SpeiInstructions";
import { TicketCard } from "./_components/TicketCard";

// The token is in the URL: keep it out of Referer headers and search indexes.
export const metadata: Metadata = {
  title: "Tu boleto",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default async function TicketPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ticketId = verifyTicketToken(token, getTicketingEnv().signingSecret);
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
      event: {
        select: {
          title: true,
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

  const view = ticketViewFor({ ...ticket, eventCancelled: ticket.event.isCancelled });
  const code = formatShortCode(ticket.code);
  const { event } = ticket;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-6 px-4 py-8">
      <header className="space-y-3">
        <h1 className="text-2xl font-bold break-words">{event.title}</h1>
        <ul className="space-y-1.5 text-sm text-muted-foreground">
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
        <div className="rounded-md border p-3">
          <p className="text-sm text-muted-foreground">Asistente</p>
          <p className="font-medium break-words">{ticket.name}</p>
          <p className="mt-1 font-mono text-lg tracking-widest">{code}</p>
        </div>
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
      {view.kind === "ticket" && <TicketCard token={token} checkedIn={view.checkedIn} />}
      {view.kind === "cancelled" && (
        <section className="rounded-md border border-destructive/40 p-4 text-center">
          <p className="font-medium">Este boleto fue cancelado</p>
        </section>
      )}
    </main>
  );
}
