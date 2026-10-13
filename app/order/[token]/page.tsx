import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Calendar, Clock, MapPin } from "lucide-react";
import prisma from "@/app/lib/prisma";
import { formatEventDate } from "@/lib/datetime";
import { getTicketingEnv } from "@/lib/env";
import { formatMxn } from "@/lib/ticketing/money";
import { orderViewFor, ticketLabel } from "@/lib/ticketing/order-view";
import { formatShortCode } from "@/lib/ticketing/short-code";
import { parseTicketDesign } from "@/lib/ticketing/ticket-design";
import { signTicketToken, verifyOrderToken } from "@/lib/ticketing/token";
import { ReceiptUpload } from "@/app/ticket/[token]/_components/ReceiptUpload";
import { SpeiInstructions } from "@/app/ticket/[token]/_components/SpeiInstructions";

// The token is in the URL: keep it out of Referer headers and search indexes.
export const metadata: Metadata = {
  title: "Tu pedido",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default async function OrderPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { signingSecret } = getTicketingEnv();
  const orderId = verifyOrderToken(token, signingSecret);
  if (!orderId) notFound();

  // Explicit columns: receipt bytes and other buyers' data are never loaded here.
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      name: true,
      code: true,
      status: true,
      quantity: true,
      amountCents: true,
      rejectionReason: true,
      event: {
        select: {
          title: true,
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
      tickets: { orderBy: { seq: "asc" }, select: { id: true, seq: true, code: true, status: true } },
    },
  });
  if (!order) notFound();

  const { event } = order;
  const view = orderViewFor({ ...order, eventCancelled: event.isCancelled });
  const code = formatShortCode(order.code);
  const design = parseTicketDesign(event.ticketDesign, process.env.CLOUDINARY_CLOUD_NAME);
  const issued = order.tickets.filter((t) => t.status === "PAID" || t.status === "CHECKED_IN" || t.status === "CANCELLED");
  const total = order.amountCents > 0 ? formatMxn(order.amountCents) : "Gratis";

  return (
    <div className="min-h-screen bg-background text-foreground">
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
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-md border p-3 text-sm">
            <div className="col-span-2 min-w-0">
              <dt className="text-muted-foreground">Comprador</dt>
              <dd className="break-words font-medium">{order.name}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Boletos</dt>
              <dd className="font-medium">{order.quantity}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Total</dt>
              <dd className="font-medium">{total}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-muted-foreground">Pedido</dt>
              <dd className="font-mono text-lg tracking-widest">{code}</dd>
            </div>
          </dl>
        </header>

        {view.kind === "upload" && (
          <>
            <SpeiInstructions
              clabe={event.speiClabe}
              bank={event.speiBank}
              beneficiary={event.speiBeneficiary}
              amountCents={order.amountCents}
              concept={code}
            />
            <ReceiptUpload token={token} rejectionReason={view.rejectionReason} scope="orders" />
          </>
        )}
        {view.kind === "review" && (
          <section className="rounded-md border p-4 text-center">
            <p className="font-medium">Comprobante recibido, en revisión</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Te enviaremos tus boletos por correo en cuanto validemos tu pago.
            </p>
          </section>
        )}
        {view.kind === "tickets" && (
          <section aria-labelledby="tickets-title" className="space-y-3">
            <h2 id="tickets-title" className="text-base font-semibold">
              Tus boletos
            </h2>
            <ul className="space-y-2">
              {issued.map((ticket) => (
                <li
                  key={ticket.id}
                  className="flex items-center justify-between gap-3 rounded-md border p-3"
                  style={{ borderColor: design.accentColor }}
                >
                  <div className="min-w-0">
                    <p className="font-medium">{ticketLabel(ticket.seq, order.quantity)}</p>
                    <p className="font-mono text-sm tracking-widest text-muted-foreground">
                      {formatShortCode(ticket.code)}
                      {ticket.status === "CHECKED_IN" ? " - Ya ingresó" : ""}
                      {ticket.status === "CANCELLED" ? " - Cancelado" : ""}
                    </p>
                  </div>
                  {ticket.status !== "CANCELLED" && (
                    <Link
                      href={`/ticket/${signTicketToken(ticket.id, signingSecret)}`}
                      className="inline-flex min-h-10 shrink-0 items-center rounded-md border px-3 text-sm font-medium"
                    >
                      Ver boleto
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
        {view.kind === "cancelled" && (
          <section className="rounded-md border border-destructive/40 p-4 text-center">
            <p className="font-medium">Este pedido fue cancelado</p>
          </section>
        )}
      </main>
    </div>
  );
}
