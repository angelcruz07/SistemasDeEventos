import { formatMxn } from "@/lib/ticketing/money";
import { formatShortCode } from "@/lib/ticketing/short-code";
import { renderRegistrationReceived, renderTicketRejected, type RenderedEmail } from "./templates";

export interface OrderEmailOrder {
  name: string;
  code: string;
  amountCents: number;
}

export interface OrderEmailEvent {
  title: string;
  priceCents: number;
  speiClabe: string | null;
  speiBank: string | null;
  speiBeneficiary: string | null;
}

/**
 * Buyer email for an order that is not paid yet. Money and payment concept come from the
 * ORDER (amount, order code), never from the event's unit price.
 */
export function buildOrderEmail(
  kind: "received" | "rejected",
  input: { order: OrderEmailOrder; event: OrderEmailEvent; link: string; reason?: string },
): RenderedEmail {
  const { order, event, link } = input;
  const base = {
    name: order.name,
    eventTitle: event.title,
    shortCode: formatShortCode(order.code),
    ticketUrl: link,
  };
  if (kind === "rejected") return renderTicketRejected({ ...base, reason: input.reason ?? "" });

  const hasSpei = event.priceCents > 0 && event.speiClabe && event.speiBank && event.speiBeneficiary;
  return renderRegistrationReceived({
    ...base,
    spei: hasSpei
      ? {
          clabe: event.speiClabe!,
          bank: event.speiBank!,
          beneficiary: event.speiBeneficiary!,
          amount: formatMxn(order.amountCents),
          concept: base.shortCode,
        }
      : undefined,
  });
}
