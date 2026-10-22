import prisma from "@/app/lib/prisma";
import { formatEventDate } from "@/lib/datetime";
import { sendEmail, sendEmails } from "@/lib/email/email-sender";
import { buildOrderEmail } from "@/lib/email/order-email";
import { redactEmails } from "@/lib/email/redact";
import { renderCashPreregistration, renderTicketIssued } from "@/lib/email/templates";
import { getTicketingEnv } from "@/lib/env";
import { formatMxn } from "@/lib/ticketing/money";
import { ticketLabel } from "@/lib/ticketing/order-view";
import { formatShortCode } from "@/lib/ticketing/short-code";
import { signOrderToken, signTicketToken } from "@/lib/ticketing/token";

export interface TicketEmailTicket {
  id: string;
  name: string;
  email: string;
  code: string;
}

export interface OrderEmailTarget {
  id: string;
  name: string;
  email: string;
  code: string;
  amountCents: number;
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

/**
 * Sends the ticket email (one per ticket) and records the sent-at timestamp on
 * success only. Never throws: email problems must not fail the caller.
 * Returns whether the email was sent.
 */
export async function sendTicketEmail(ticket: TicketEmailTicket, event: TicketEmailEvent): Promise<boolean> {
  try {
    const { signingSecret, appUrl } = getTicketingEnv();
    const token = signTicketToken(ticket.id, signingSecret);
    const rendered = renderTicketIssued({
      name: ticket.name,
      eventTitle: event.title,
      shortCode: formatShortCode(ticket.code),
      ticketUrl: `${appUrl}/ticket/${token}`,
      qrUrl: `${appUrl}/api/tickets/${token}/qr.png`,
      dateText: formatEventDate(event.date),
      time: event.time,
      location: event.location,
    });

    const result = await sendEmail({ ...rendered, to: ticket.email });
    if (!result.ok) {
      console.error(`Ticket email failed (ticket=${ticket.id}): ${redactEmails(result.error)}`);
      return false;
    }
    await prisma.ticket.update({ where: { id: ticket.id }, data: { ticketEmailSentAt: new Date() } });
    return true;
  } catch (error) {
    const message = error instanceof Error ? redactEmails(error.message) : "unknown error";
    console.error(`Ticket email crashed (ticket=${ticket.id}): ${message}`);
    return false;
  }
}

/**
 * Sends one ticket email per ticket through the batch endpoint (design D9) and records
 * ticketEmailSentAt for the ones that went out. Never throws. Returns how many were sent.
 */
export async function sendTicketEmails(tickets: readonly TicketEmailTicket[], event: TicketEmailEvent): Promise<number> {
  if (tickets.length === 0) return 0;
  try {
    const { signingSecret, appUrl } = getTicketingEnv();
    const messages = tickets.map((ticket) => {
      const token = signTicketToken(ticket.id, signingSecret);
      const rendered = renderTicketIssued({
        name: ticket.name,
        eventTitle: event.title,
        shortCode: formatShortCode(ticket.code),
        ticketUrl: `${appUrl}/ticket/${token}`,
        qrUrl: `${appUrl}/api/tickets/${token}/qr.png`,
        dateText: formatEventDate(event.date),
        time: event.time,
        location: event.location,
      });
      return { ...rendered, to: ticket.email };
    });

    const results = await sendEmails(messages);
    const sentIds: string[] = [];
    results.forEach((result, i) => {
      if (result.ok) sentIds.push(tickets[i].id);
      else console.error(`Ticket email failed (ticket=${tickets[i].id}): ${redactEmails(result.error)}`);
    });
    if (sentIds.length > 0) {
      await prisma.ticket.updateMany({ where: { id: { in: sentIds } }, data: { ticketEmailSentAt: new Date() } });
    }
    return sentIds.length;
  } catch (error) {
    const message = error instanceof Error ? redactEmails(error.message) : "unknown error";
    console.error(`Ticket batch email crashed (tickets=${tickets.length}): ${message}`);
    return 0;
  }
}

/**
 * Sends the "received" or "rejected" email of an order that is not paid yet. Amount and
 * concept come from the order. The link is always the order page (/order/[token]), whatever
 * the quantity; links already emailed for quantity-1 orders keep working through the
 * mirror ticket. Never throws.
 */
export async function sendOrderEmail(
  kind: "received" | "rejected",
  order: OrderEmailTarget,
  event: TicketEmailEvent,
  reason = "",
): Promise<boolean> {
  try {
    const { signingSecret, appUrl } = getTicketingEnv();
    const link = `${appUrl}/order/${signOrderToken(order.id, signingSecret)}`;
    const rendered = buildOrderEmail(kind, { order, event, link, reason });

    const result = await sendEmail({ ...rendered, to: order.email });
    if (!result.ok) {
      console.error(`Order email failed (kind=${kind}, order=${order.id}): ${redactEmails(result.error)}`);
      return false;
    }
    if (kind === "received") {
      const sentAt = new Date();
      await prisma.order.updateMany({ where: { id: order.id }, data: { registrationEmailSentAt: sentAt } });
      // The mirror ticket (same id) keeps the legacy timestamp for old code and rollback.
      await prisma.ticket.updateMany({ where: { id: order.id }, data: { registrationEmailSentAt: sentAt } });
    }
    return true;
  } catch (error) {
    const message = error instanceof Error ? redactEmails(error.message) : "unknown error";
    console.error(`Order email crashed (kind=${kind}, order=${order.id}): ${message}`);
    return false;
  }
}

/**
 * Pre-registration email of a cash order (PENDING_CASH): the amount to pay at the door and one
 * QR per ticket. Tickets are read here so a re-send always matches what the door will scan.
 * Records registrationEmailSentAt on success. Never throws.
 */
export async function sendCashPreregistrationEmail(order: OrderEmailTarget, event: TicketEmailEvent): Promise<boolean> {
  try {
    const { signingSecret, appUrl } = getTicketingEnv();
    const tickets = await prisma.ticket.findMany({
      where: { orderId: order.id, status: "PENDING_CASH" },
      orderBy: { seq: "asc" },
      select: { id: true, code: true, seq: true },
    });
    if (tickets.length === 0) return false;

    const rendered = renderCashPreregistration({
      name: order.name,
      eventTitle: event.title,
      shortCode: formatShortCode(order.code),
      amount: formatMxn(order.amountCents),
      orderUrl: `${appUrl}/order/${signOrderToken(order.id, signingSecret)}`,
      dateText: formatEventDate(event.date),
      time: event.time,
      location: event.location,
      tickets: tickets.map((t) => {
        const token = signTicketToken(t.id, signingSecret);
        return {
          label: tickets.length > 1 ? ticketLabel(t.seq, tickets.length) : "",
          shortCode: formatShortCode(t.code),
          qrUrl: `${appUrl}/api/tickets/${token}/qr.png`,
          ticketUrl: `${appUrl}/ticket/${token}`,
        };
      }),
    });

    const result = await sendEmail({ ...rendered, to: order.email });
    if (!result.ok) {
      console.error(`Cash pre-registration email failed (order=${order.id}): ${redactEmails(result.error)}`);
      return false;
    }
    const sentAt = new Date();
    await prisma.order.updateMany({ where: { id: order.id }, data: { registrationEmailSentAt: sentAt } });
    await prisma.ticket.updateMany({ where: { orderId: order.id }, data: { registrationEmailSentAt: sentAt } });
    return true;
  } catch (error) {
    const message = error instanceof Error ? redactEmails(error.message) : "unknown error";
    console.error(`Cash pre-registration email crashed (order=${order.id}): ${message}`);
    return false;
  }
}
