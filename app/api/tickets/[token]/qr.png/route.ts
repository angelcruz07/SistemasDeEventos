import QRCode from "qrcode";
import prisma from "@/app/lib/prisma";
import { getTicketingEnv } from "@/lib/env";
import { verifyTicketToken } from "@/lib/ticketing/token";

export const runtime = "nodejs";

const notFound = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

/**
 * QR image for a ticket. The QR encodes the signed ticket token itself (the same
 * value as in /ticket/{token}); door staff verify it with verifyTicketToken and
 * check-in still requires status PAID, so a leaked image of an unpaid ticket is useless.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ticketId = verifyTicketToken(token, getTicketingEnv().signingSecret);
  if (!ticketId) return notFound();

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { status: true } });
  if (!ticket || (ticket.status !== "PAID" && ticket.status !== "CHECKED_IN")) return notFound();

  const png = await QRCode.toBuffer(token, { type: "png", errorCorrectionLevel: "M", margin: 2, width: 512 });
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}
