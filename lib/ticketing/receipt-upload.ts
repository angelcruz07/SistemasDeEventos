import type { TicketStatus } from "@/app/generated/prisma/enums";
import { hasSpot } from "./capacity";
import { MAX_RECEIPT_BYTES } from "./receipt-file";

/** Receipt limit plus multipart overhead; anything larger is refused before reading the body. */
export const MAX_REQUEST_BYTES = MAX_RECEIPT_BYTES + 512 * 1024;

/** A missing Content-Length is allowed here (the real size is enforced after reading); a malformed one is not. */
export function isBodyTooLarge(contentLength: string | null): boolean {
  if (contentLength === null) return false;
  if (!/^\d+$/.test(contentLength)) return true;
  return Number(contentLength) > MAX_REQUEST_BYTES;
}

export type UploadRefusal = "status" | "full" | "cancelled";

export type UploadDecision = { kind: "accept" } | { kind: "refused"; reason: UploadRefusal };

/**
 * Decision taken inside the event-row lock. Moving to PENDING_VALIDATION makes the
 * ticket hold a spot, so capacity is re-checked here. `held` never includes this
 * ticket (PENDING_RECEIPT/REJECTED do not hold); a capacity lowered below the held
 * count simply counts as full.
 */
export function decideReceiptUpload(input: {
  status: TicketStatus;
  event: { isCancelled: boolean; capacity: number | null };
  held: number;
}): UploadDecision {
  if (input.event.isCancelled) return { kind: "refused", reason: "cancelled" };
  if (input.status !== "PENDING_RECEIPT" && input.status !== "REJECTED") return { kind: "refused", reason: "status" };
  if (!hasSpot(input.held, input.event.capacity)) return { kind: "refused", reason: "full" };
  return { kind: "accept" };
}
