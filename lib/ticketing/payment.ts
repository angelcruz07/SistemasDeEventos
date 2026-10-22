import type { PaymentMethod, TicketStatus } from "@/app/generated/prisma/enums";
import { initialStatus } from "./status";

export interface PaymentMethodPolicy {
  method: PaymentMethod;
  channel: "public" | "door";
  initialStatus(priceCents: number): TicketStatus;
}

function policy(method: PaymentMethod, channel: "public" | "door"): PaymentMethodPolicy {
  return {
    method,
    channel,
    initialStatus: (priceCents) => initialStatus({ method, priceCents, channel }),
  };
}

export const SPEI_POLICY = policy("SPEI", "public");
export const FREE_POLICY = policy("FREE", "public");
export const CASH_POLICY = policy("CASH", "door");
/** Online pre-registration paid in cash at the door. */
export const CASH_PREREG_POLICY = policy("CASH", "public");

/** Methods a buyer may pick on the public form. */
export type PublicPaymentChoice = "SPEI" | "CASH";

/**
 * `choice` only matters for a paid public order: "CASH" is the cash pre-registration,
 * anything else (or nothing) keeps the historical SPEI behaviour. Whether the event
 * actually accepts that method is decided by `decideOrder`.
 */
export function policyFor(
  channel: "public" | "door",
  priceCents: number,
  choice?: PublicPaymentChoice,
): PaymentMethodPolicy {
  if (!Number.isInteger(priceCents) || priceCents < 0) throw new Error("priceCents must be a non-negative integer");
  if (channel === "door") return CASH_POLICY;
  if (priceCents === 0) return FREE_POLICY;
  return choice === "CASH" ? CASH_PREREG_POLICY : SPEI_POLICY;
}
