import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import type { Prisma } from "@/app/generated/prisma/client";
import prisma from "@/app/lib/prisma";
import { getTicketingEnv } from "@/lib/env";
import { hitRateLimit } from "@/lib/server/rate-limit";
import { getClientIp, rateLimitKey } from "@/lib/server/request-keys";
import { HOLDING_STATUSES } from "@/lib/ticketing/capacity";
import { validateReceiptFile } from "@/lib/ticketing/receipt-file";
import { readBodyLimited } from "@/lib/ticketing/read-limited";
import { decideReceiptUpload, isBodyTooLarge, MAX_REQUEST_BYTES, type UploadRefusal } from "@/lib/ticketing/receipt-upload";
import { verifyTicketToken } from "@/lib/ticketing/token";

export const runtime = "nodejs";

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_IP = 20;
const MAX_PER_TICKET = 20;
const TX_OPTIONS = { maxWait: 5000, timeout: 10000 };

class StatusChanged extends Error {}

const fail = (error: string, status: number) =>
  NextResponse.json({ success: false, error }, { status, headers: { "Cache-Control": "no-store" } });

const REFUSALS: Record<UploadRefusal, { error: string; status: number }> = {
  full: { error: "El cupo del evento está lleno. No pudimos registrar tu comprobante.", status: 409 },
  status: { error: "Este boleto ya no admite un comprobante nuevo.", status: 409 },
  cancelled: { error: "Este evento fue cancelado.", status: 409 },
};
const FILE_ERRORS = {
  empty: "El archivo está vacío.",
  size: "El archivo supera el límite de 5 MB.",
  type: "Formato no válido. Sube una imagen (JPG, PNG, WebP) o un PDF.",
} as const;

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const ticketId = verifyTicketToken(token, getTicketingEnv().signingSecret);
    if (!ticketId) return fail("Boleto no encontrado.", 404);

    const contentLength = request.headers.get("content-length");
    if (isBodyTooLarge(contentLength)) return fail(FILE_ERRORS.size, 413);

    const ip = getClientIp(request.headers);
    // No trustworthy IP: skip the per-IP limit (a shared bucket would lock everyone out); per-ticket still applies.
    if (ip && !(await hitRateLimit(rateLimitKey("receipt:ip", ip), MAX_PER_IP, WINDOW_MS)).allowed) {
      return fail("Demasiados intentos. Inténtalo más tarde.", 429);
    }
    if (!(await hitRateLimit(rateLimitKey("receipt:ticket", ticketId), MAX_PER_TICKET, WINDOW_MS)).allowed) {
      return fail("Demasiados intentos. Inténtalo más tarde.", 429);
    }

    // Bounded read: a missing or lying Content-Length can never make us buffer more than the limit.
    const body = await readBodyLimited(request.body, MAX_REQUEST_BYTES);
    if (!body.ok) return fail(FILE_ERRORS.size, 413);
    const form = await new Response(body.bytes as Uint8Array<ArrayBuffer>, {
      headers: { "content-type": request.headers.get("content-type") ?? "" },
    })
      .formData()
      .catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return fail("Selecciona un archivo.", 400);

    // The sniffed type decides; the client MIME type and file name are ignored.
    const bytes = new Uint8Array(await file.arrayBuffer());
    const validation = validateReceiptFile(bytes);
    if (!validation.ok) return fail(FILE_ERRORS[validation.error], validation.error === "size" ? 413 : 400);

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { eventId: true } });
    if (!ticket) return fail("Boleto no encontrado.", 404);

    const refusal = await prisma.$transaction(async (tx) => {
      // Same lock as registration: serializes per event so capacity cannot be oversold.
      await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${ticket.eventId} FOR UPDATE`;
      const [current, event] = await Promise.all([
        tx.ticket.findUnique({ where: { id: ticketId }, select: { status: true } }),
        tx.event.findUniqueOrThrow({
          where: { id: ticket.eventId },
          select: { isCancelled: true, capacity: true },
        }),
      ]);
      if (!current) return "status" as const;
      const held = await tx.ticket.count({
        where: { eventId: ticket.eventId, status: { in: [...HOLDING_STATUSES] } },
      });
      const decision = decideReceiptUpload({ status: current.status, event, held });
      if (decision.kind === "refused") return decision.reason;

      await tx.receipt.create({
        data: {
          ticketId,
          bytes: bytes as Uint8Array<ArrayBuffer>,
          mimeType: validation.mimeType,
          sizeBytes: validation.sizeBytes,
          sha256: createHash("sha256").update(bytes).digest("hex"),
        },
      });
      // Conditional on the status read under the lock; never overwrites a concurrent change.
      const moved = await tx.ticket.updateMany({
        where: { id: ticketId, status: current.status },
        data: { status: "PENDING_VALIDATION", rejectionReason: null, reviewedAt: null } satisfies Prisma.TicketUpdateManyMutationInput,
      });
      // Changed concurrently (e.g. cancelled by the organizer): roll back the receipt insert.
      if (moved.count !== 1) throw new StatusChanged();
      return null;
    }, TX_OPTIONS).catch((error: unknown) => {
      if (error instanceof StatusChanged) return "status" as const;
      throw error;
    });

    if (refusal) return fail(REFUSALS[refusal].error, REFUSALS[refusal].status);
    return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code = typeof error === "object" && error !== null ? (error as { code?: unknown }).code : undefined;
    console.error("receipt upload failed:", error instanceof Error ? error.name : "unknown", code ?? "");
    return fail("No se pudo subir el comprobante. Inténtalo de nuevo.", 500);
  }
}
