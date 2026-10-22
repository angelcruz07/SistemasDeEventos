import QRCode from "qrcode";
import prisma from "@/app/lib/prisma";
import { getTicketingEnv } from "@/lib/env";
import { qrFilename } from "@/lib/ticketing/flyer";
import { verifyTicketToken } from "@/lib/ticketing/token";

export const runtime = "nodejs";

const notFound = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

/**
 * QR image for a ticket. The QR encodes the signed ticket token itself (the same
 * value as in /ticket/{token}); door staff verify it with verifyTicketToken and
 * check-in still requires status PAID, so a leaked image of an unpaid ticket is useless.
 * A cash pre-registration (PENDING_CASH) also gets its QR: at the door it only lets staff
 * collect the amount due, never grants entry by itself.
 */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ticketId = verifyTicketToken(token, getTicketingEnv().signingSecret);
  if (!ticketId) return notFound();

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { status: true, code: true } });
  if (!ticket || (ticket.status !== "PAID" && ticket.status !== "CHECKED_IN" && ticket.status !== "PENDING_CASH")) {
    return notFound();
  }

  const png = await QRCode.toBuffer(token, { type: "png", errorCorrectionLevel: "M", margin: 2, width: 512 });
  // ?download=1 turns the image into an attachment; the filename comes only from the ticket code.
  const download = new URL(request.url).searchParams.get("download") === "1";
  return new Response(new Uint8Array(png), {
    headers: {
      ...(download && { "Content-Disposition": `attachment; filename="${qrFilename(ticket.code)}"` }),
      "Content-Type": "image/png",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}
