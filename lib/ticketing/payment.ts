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

export function policyFor(channel: "public" | "door", priceCents: number): PaymentMethodPolicy {
  if (channel === "door") return CASH_POLICY;
  return priceCents === 0 ? FREE_POLICY : SPEI_POLICY;
}
