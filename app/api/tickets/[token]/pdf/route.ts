import { renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";
import prisma from "@/app/lib/prisma";
import { formatEventDate } from "@/lib/datetime";
import { getTicketingEnv } from "@/lib/env";
import { TicketDocument } from "@/lib/pdf/TicketDocument";
import { formatShortCode } from "@/lib/ticketing/short-code";
import { readBodyLimited } from "@/lib/ticketing/read-limited";
import { IMAGE_HOST, parseTicketDesign } from "@/lib/ticketing/ticket-design";
import { ticketViewFor } from "@/lib/ticketing/ticket-view";
import { verifyTicketToken } from "@/lib/ticketing/token";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const notFound = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

/** Fetches a design image as a data URL; react-pdf only decodes PNG/JPEG. Any failure yields null. */
async function fetchImageDataUrl(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.hostname !== IMAGE_HOST) return null;
    const res = await fetch(parsed, { redirect: "error", signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const declared = Number(res.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > MAX_IMAGE_BYTES) return null;
    // Counting reader; the fetch signal also covers the body read.
    const read = await readBodyLimited(res.body, MAX_IMAGE_BYTES);
    if (!read.ok || read.bytes.length === 0) return null;
    const bytes = Buffer.from(read.bytes);
    const isPng = bytes.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
    if (!isPng && !isJpeg) return null;
    return `data:${isPng ? "image/png" : "image/jpeg"};base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ticketId = verifyTicketToken(token, getTicketingEnv().signingSecret);
  if (!ticketId) return notFound();

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      name: true,
      code: true,
      status: true,
      rejectionReason: true,
      event: { select: { title: true, date: true, time: true, location: true, isCancelled: true, ticketDesign: true } },
    },
  });
  if (!ticket) return notFound();
  // Same rule as the ticket page: only an issued ticket on a non-cancelled event.
  const view = ticketViewFor({ ...ticket, eventCancelled: ticket.event.isCancelled });
  if (view.kind !== "ticket") return notFound();

  const { event } = ticket;
  const design = parseTicketDesign(event.ticketDesign, process.env.CLOUDINARY_CLOUD_NAME);
  const code = formatShortCode(ticket.code);

  try {
    // Same payload as /qr.png: the raw signed token.
    const [qrDataUrl, logoDataUrl, headerDataUrl] = await Promise.all([
      QRCode.toDataURL(token, { errorCorrectionLevel: "M", margin: 2, width: 512 }),
      fetchImageDataUrl(design.logoUrl),
      design.template === "image" ? fetchImageDataUrl(design.headerImageUrl) : Promise.resolve(null),
    ]);

    const pdf = await renderToBuffer(
      TicketDocument({
        design,
        eventTitle: event.title,
        dateLabel: formatEventDate(event.date),
        time: event.time,
        location: event.location,
        attendeeName: ticket.name,
        code,
        qrDataUrl,
        logoDataUrl,
        headerDataUrl,
      }),
    );

    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="boleto-${ticket.code}.pdf"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (error) {
    console.error("Error rendering ticket PDF:", error);
    return new Response("No se pudo generar el PDF", { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
