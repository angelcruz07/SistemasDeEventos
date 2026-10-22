import type { TicketStatus } from "@/app/generated/prisma/enums";
import { canTransition } from "./status";

export const MAX_REASON_LENGTH = 300;

export function canApprove(status: TicketStatus): boolean {
  return status === "PENDING_VALIDATION";
}

export function canCancel(status: TicketStatus): boolean {
  return canTransition(status, "CANCELLED");
}

export type ReasonValidation = { ok: true; reason: string } | { ok: false; error: string };

export function validateRejectReason(input: string): ReasonValidation {
  const reason = typeof input === "string" ? input.trim() : "";
  if (!reason) return { ok: false, error: "Indica el motivo del rechazo." };
  if (reason.length > MAX_REASON_LENGTH) {
    return { ok: false, error: `El motivo no puede superar ${MAX_REASON_LENGTH} caracteres.` };
  }
  return { ok: true, reason };
}

/** Which email to re-send for a status; null when nothing sensible can be sent. */
export function resendKindFor(status: TicketStatus): "received" | "ticket" | "cash" | null {
  if (status === "PENDING_RECEIPT" || status === "REJECTED") return "received";
  if (status === "PENDING_CASH") return "cash";
  if (status === "PAID") return "ticket";
  return null;
}
