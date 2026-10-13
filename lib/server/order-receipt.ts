import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import type { Prisma } from "@/app/generated/prisma/client";
import prisma from "@/app/lib/prisma";
import { countHeld } from "@/lib/server/held";
import { lockEvent } from "@/lib/server/orders";
import { hitRateLimit } from "@/lib/server/rate-limit";
import { getClientIp, rateLimitKey } from "@/lib/server/request-keys";
import { PRE_ISSUE_STATUSES } from "@/lib/ticketing/order";
import { validateReceiptFile } from "@/lib/ticketing/receipt-file";
import { readBodyLimited } from "@/lib/ticketing/read-limited";
import { decideReceiptUpload, isBodyTooLarge, MAX_REQUEST_BYTES, type UploadRefusal } from "@/lib/ticketing/receipt-upload";

/**
 * What the verified token pointed at. A legacy ticket may not have an order yet (written
 * by pre-order code); its order is created lazily inside the transaction.
 */
export type ReceiptTarget = { kind: "order"; id: string } | { kind: "ticket"; id: string };

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_IP = 20;
const MAX_PER_ORDER = 20;
const TX_OPTIONS = { maxWait: 5000, timeout: 10000 };

class StatusChanged extends Error {}

export const receiptFail = (error: string, status: number) =>
  NextResponse.json({ success: false, error }, { status, headers: { "Cache-Control": "no-store" } });

const REFUSALS: Record<UploadRefusal, { error: string; status: number }> = {
  full: { error: "El cupo del evento está lleno. No pudimos registrar tu comprobante.", status: 409 },
  status: { error: "Este boleto ya no admite un comprobante nuevo.", status: 409 },
  cancelled: { error: "Este evento fue cancelado.", status: 409 },
};
const FILE_ERRORS = {
  empty: "El archivo está vacío.",
  size: "El archivo supera el límite de 4 MB.",
  type: "Formato no válido. Sube una imagen (JPG, PNG, WebP) o un PDF.",
} as const;

/** Shared receipt upload for `/api/orders/[token]/receipt` and the legacy ticket adapter. */
export async function uploadOrderReceipt(request: Request, target: ReceiptTarget): Promise<Response> {
  try {
    const contentLength = request.headers.get("content-length");
    if (isBodyTooLarge(contentLength)) return receiptFail(FILE_ERRORS.size, 413);

    const ip = getClientIp(request.headers);
    // No trustworthy IP: skip the per-IP limit (a shared bucket would lock everyone out); per-order still applies.
    if (ip && !(await hitRateLimit(rateLimitKey("receipt:ip", ip), MAX_PER_IP, WINDOW_MS)).allowed) {
      return receiptFail("Demasiados intentos. Inténtalo más tarde.", 429);
    }
    // A legacy order shares its id with its ticket, so both entry points hit the same bucket.
    if (!(await hitRateLimit(rateLimitKey("receipt:order", target.id), MAX_PER_ORDER, WINDOW_MS)).allowed) {
      return receiptFail("Demasiados intentos. Inténtalo más tarde.", 429);
    }

    // Bounded read: a missing or lying Content-Length can never make us buffer more than the limit.
    const body = await readBodyLimited(request.body, MAX_REQUEST_BYTES);
    if (!body.ok) return receiptFail(FILE_ERRORS.size, 413);
    const form = await new Response(body.bytes as Uint8Array<ArrayBuffer>, {
      headers: { "content-type": request.headers.get("content-type") ?? "" },
    })
      .formData()
      .catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return receiptFail("Selecciona un archivo.", 400);

    // The sniffed type decides; the client MIME type and file name are ignored.
    const bytes = new Uint8Array(await file.arrayBuffer());
    const validation = validateReceiptFile(bytes);
    if (!validation.ok) return receiptFail(FILE_ERRORS[validation.error], validation.error === "size" ? 413 : 400);

    // Both kinds resolve to the owning order; a ticket always has one.
    const found =
      target.kind === "order"
        ? await prisma.order.findUnique({ where: { id: target.id }, select: { eventId: true } }).then((o) => o && { ...o, orderId: target.id })
        : await prisma.ticket.findUnique({ where: { id: target.id }, select: { eventId: true, orderId: true } });
    if (!found) return receiptFail("Boleto no encontrado.", 404);

    const refusal = await prisma.$transaction(async (tx) => {
      // Same lock as registration: serializes per event so capacity cannot be oversold.
      await lockEvent(tx, found.eventId);
      const order = await tx.order.findUnique({
        where: { id: found.orderId },
        select: { id: true, status: true, quantity: true },
      });
      if (!order) return "status" as const;
      const event = await tx.event.findUniqueOrThrow({
        where: { id: found.eventId },
        select: { isCancelled: true, capacity: true },
      });
      // `held` never includes this order: PENDING_RECEIPT and REJECTED do not hold a spot.
      const held = await countHeld(tx, found.eventId);
      const decision = decideReceiptUpload({ status: order.status, event, held, quantity: order.quantity });
      if (decision.kind === "refused") return decision.reason;

      await tx.receipt.create({
        data: {
          orderId: order.id,
          bytes: bytes as Uint8Array<ArrayBuffer>,
          mimeType: validation.mimeType,
          sizeBytes: validation.sizeBytes,
          sha256: createHash("sha256").update(bytes).digest("hex"),
        },
      });
      // Conditional on the status read under the lock; never overwrites a concurrent change.
      const reset = { status: "PENDING_VALIDATION", rejectionReason: null, reviewedAt: null } as const;
      const moved = await tx.order.updateMany({
        where: { id: order.id, status: order.status },
        data: reset satisfies Prisma.OrderUpdateManyMutationInput,
      });
      // Changed concurrently (e.g. cancelled by the organizer): roll back the receipt insert.
      if (moved.count !== 1) throw new StatusChanged();
      await tx.ticket.updateMany({
        where: { orderId: order.id, status: { in: [...PRE_ISSUE_STATUSES] } },
        data: reset satisfies Prisma.TicketUpdateManyMutationInput,
      });
      return null;
    }, TX_OPTIONS).catch((error: unknown) => {
      if (error instanceof StatusChanged) return "status" as const;
      throw error;
    });

    if (refusal) return receiptFail(REFUSALS[refusal].error, REFUSALS[refusal].status);
    return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code = typeof error === "object" && error !== null ? (error as { code?: unknown }).code : undefined;
    console.error("receipt upload failed:", error instanceof Error ? error.name : "unknown", code ?? "");
    return receiptFail("No se pudo subir el comprobante. Inténtalo de nuevo.", 500);
  }
}
