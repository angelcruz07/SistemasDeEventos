import prisma from "@/app/lib/prisma";
import { formatEventDate } from "@/lib/datetime";
import { sendEmail } from "@/lib/email/email-sender";
import { renderRegistrationReceived, renderTicketIssued, type RenderedEmail } from "@/lib/email/templates";
import { getTicketingEnv } from "@/lib/env";
import { formatMxn } from "@/lib/ticketing/money";
import { formatShortCode } from "@/lib/ticketing/short-code";
import { signTicketToken } from "@/lib/ticketing/token";

export interface TicketEmailTicket {
  id: string;
  name: string;
  email: string;
  code: string;
}

export interface TicketEmailEvent {
  title: string;
  date: Date;
  time: string;
  location: string;
  priceCents: number;
  speiClabe: string | null;
  speiBank: string | null;
  speiBeneficiary: string | null;
}

/** Provider errors can echo the recipient; never log addresses. */
function redact(message: string): string {
  return message.replace(/[^\s@<>"']+@[^\s@<>"']+/g, "[email]");
}

/**
 * Sends the registration-received or ticket email for a ticket and records the
 * sent-at timestamp on success only. Never throws: email problems must not fail
 * the caller. Returns whether the email was sent.
 */
export async function sendTicketEmail(
  kind: "received" | "ticket",
  ticket: TicketEmailTicket,
  event: TicketEmailEvent,
): Promise<boolean> {
  try {
    const { signingSecret, appUrl } = getTicketingEnv();
    const token = signTicketToken(ticket.id, signingSecret);
    const base = {
      name: ticket.name,
      eventTitle: event.title,
      shortCode: formatShortCode(ticket.code),
      ticketUrl: `${appUrl}/ticket/${token}`,
    };

    let rendered: RenderedEmail;
    if (kind === "ticket") {
      rendered = renderTicketIssued({
        ...base,
        qrUrl: `${appUrl}/api/tickets/${token}/qr.png`,
        dateText: formatEventDate(event.date),
        time: event.time,
        location: event.location,
      });
    } else {
      const hasSpei = event.priceCents > 0 && event.speiClabe && event.speiBank && event.speiBeneficiary;
      rendered = renderRegistrationReceived({
        ...base,
        spei: hasSpei
          ? {
              clabe: event.speiClabe!,
              bank: event.speiBank!,
              beneficiary: event.speiBeneficiary!,
              amount: formatMxn(event.priceCents),
              concept: base.shortCode,
            }
          : undefined,
      });
    }

    const result = await sendEmail({ ...rendered, to: ticket.email });
    if (!result.ok) {
      console.error(`Ticket email failed (kind=${kind}, ticket=${ticket.id}): ${redact(result.error)}`);
      return false;
    }

    await prisma.ticket.update({
      where: { id: ticket.id },
      data: kind === "ticket" ? { ticketEmailSentAt: new Date() } : { registrationEmailSentAt: new Date() },
    });
    return true;
  } catch (error) {
    const message = error instanceof Error ? redact(error.message) : "unknown error";
    console.error(`Ticket email crashed (kind=${kind}, ticket=${ticket.id}): ${message}`);
    return false;
  }
}
