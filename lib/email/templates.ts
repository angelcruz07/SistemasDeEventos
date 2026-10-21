import type { EmailMessage } from "./email-sender";

export type RenderedEmail = Omit<EmailMessage, "to">;

export interface SpeiInstructions {
  clabe: string;
  bank: string;
  beneficiary: string;
  /** Pre-formatted, e.g. "$350.00". */
  amount: string;
  /** Formatted short code the attendee must put as payment concept. */
  concept: string;
}

interface BaseData {
  name: string;
  eventTitle: string;
  shortCode: string;
  ticketUrl: string;
}

export interface RegistrationReceivedData extends BaseData {
  spei?: SpeiInstructions;
}

export interface TicketIssuedData extends BaseData {
  qrUrl: string;
  dateText: string;
  time: string;
  location: string;
}

export interface TicketRejectedData extends BaseData {
  reason: string;
}

export interface CashPreregistrationTicket {
  /** e.g. "Boleto 1 de 2"; empty for a single ticket. */
  label: string;
  shortCode: string;
  qrUrl: string;
  ticketUrl: string;
}

export interface CashPreregistrationData {
  name: string;
  eventTitle: string;
  /** Formatted order code. */
  shortCode: string;
  /** Pre-formatted amount to pay in cash at the door, e.g. "$700.00". */
  amount: string;
  orderUrl: string;
  dateText: string;
  time: string;
  location: string;
  tickets: CashPreregistrationTicket[];
}

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

/** Subjects are headers: collapse any line break so values cannot inject headers. */
function subjectLine(value: string): string {
  return value.replace(/\s*[\r\n]+\s*/g, " ").trim();
}

function assertHttpUrl(url: string): string {
  if (!/^https?:\/\//i.test(url)) throw new Error("Email links must be http(s) URLs");
  return url;
}

function layout(title: string, bodyHtml: string): string {
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:16px;color:#111">
<h1 style="font-size:20px">${escapeHtml(title)}</h1>
${bodyHtml}
</div>`;
}

function button(url: string, label: string): string {
  return `<p><a href="${escapeHtml(assertHttpUrl(url))}" style="display:inline-block;background:#111;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none">${escapeHtml(label)}</a></p>`;
}

export function renderRegistrationReceived(data: RegistrationReceivedData): RenderedEmail {
  const { spei } = data;
  const speiHtml = spei
    ? `<p>Para completar tu registro, haz una transferencia SPEI con estos datos:</p>
<ul>
<li>CLABE: <strong>${escapeHtml(spei.clabe)}</strong></li>
<li>Banco: ${escapeHtml(spei.bank)}</li>
<li>Beneficiario: ${escapeHtml(spei.beneficiary)}</li>
<li>Monto: <strong>${escapeHtml(spei.amount)}</strong></li>
<li>Concepto: <strong>${escapeHtml(spei.concept)}</strong></li>
</ul>
<p>Después sube tu comprobante en el siguiente enlace.</p>`
    : "";
  const speiText = spei
    ? `Para completar tu registro, haz una transferencia SPEI con estos datos:
CLABE: ${spei.clabe}
Banco: ${spei.bank}
Beneficiario: ${spei.beneficiary}
Monto: ${spei.amount}
Concepto: ${spei.concept}

Después sube tu comprobante aquí:`
    : "Revisa el estado de tu registro aquí:";

  return {
    subject: subjectLine(`Recibimos tu registro: ${data.eventTitle}`),
    html: layout(
      "Recibimos tu registro",
      `<p>Hola ${escapeHtml(data.name)}, registramos tu lugar en <strong>${escapeHtml(data.eventTitle)}</strong>. Tu código es <strong>${escapeHtml(data.shortCode)}</strong>.</p>
${speiHtml}
${button(data.ticketUrl, "Ver mi registro")}`,
    ),
    text: `Hola ${data.name}, registramos tu lugar en ${data.eventTitle}. Tu código es ${data.shortCode}.

${speiText}
${data.ticketUrl}`,
  };
}

export function renderTicketIssued(data: TicketIssuedData): RenderedEmail {
  return {
    subject: subjectLine(`Tu boleto: ${data.eventTitle}`),
    html: layout(
      "Tu boleto está listo",
      `<p>Hola ${escapeHtml(data.name)}, este es tu boleto para <strong>${escapeHtml(data.eventTitle)}</strong>.</p>
<p>${escapeHtml(data.dateText)}, ${escapeHtml(data.time)}<br>${escapeHtml(data.location)}</p>
<p>Código: <strong>${escapeHtml(data.shortCode)}</strong></p>
<p><img src="${escapeHtml(assertHttpUrl(data.qrUrl))}" alt="Código QR de tu boleto" width="220" height="220"></p>
${button(data.ticketUrl, "Abrir mi boleto")}`,
    ),
    text: `Hola ${data.name}, este es tu boleto para ${data.eventTitle}.
${data.dateText}, ${data.time}
${data.location}
Código: ${data.shortCode}

Abre tu boleto y muestra el código QR en la entrada:
${data.ticketUrl}`,
  };
}

/**
 * Pre-registration paid in cash: the QR codes are already valid for the door, where staff
 * collect the amount before letting the attendee in.
 */
export function renderCashPreregistration(data: CashPreregistrationData): RenderedEmail {
  const ticketsHtml = data.tickets
    .map(
      (t) => `<div style="margin:16px 0;padding:12px;border:1px solid #ddd;border-radius:8px">
${t.label ? `<p style="margin:0 0 4px"><strong>${escapeHtml(t.label)}</strong></p>` : ""}<p style="margin:0">Código: <strong>${escapeHtml(t.shortCode)}</strong></p>
<p><img src="${escapeHtml(assertHttpUrl(t.qrUrl))}" alt="Código QR de tu pre-registro" width="200" height="200"></p>
<p style="margin:0"><a href="${escapeHtml(assertHttpUrl(t.ticketUrl))}">Abrir este boleto</a></p>
</div>`,
    )
    .join("\n");
  const ticketsText = data.tickets
    .map((t) => `${t.label ? `${t.label}: ` : ""}${t.shortCode}\n${t.ticketUrl}`)
    .join("\n\n");

  return {
    subject: subjectLine(`Tu pre-registro: ${data.eventTitle}`),
    html: layout(
      "Tu pre-registro está listo",
      `<p>Hola ${escapeHtml(data.name)}, apartamos tu lugar en <strong>${escapeHtml(data.eventTitle)}</strong>.</p>
<p>${escapeHtml(data.dateText)}, ${escapeHtml(data.time)}<br>${escapeHtml(data.location)}</p>
<p style="padding:12px;background:#fff7ed;border:1px solid #fdba74;border-radius:8px">Paga <strong>${escapeHtml(data.amount)}</strong> en efectivo en la entrada y muestra tu código QR. Tu pedido es <strong>${escapeHtml(data.shortCode)}</strong>.</p>
${ticketsHtml}
${button(data.orderUrl, "Ver mi pre-registro")}`,
    ),
    text: `Hola ${data.name}, apartamos tu lugar en ${data.eventTitle}.
${data.dateText}, ${data.time}
${data.location}

Paga ${data.amount} en efectivo en la entrada y muestra tu código QR. Tu pedido es ${data.shortCode}.

${ticketsText}

Tu pre-registro:
${data.orderUrl}`,
  };
}

export function renderTicketRejected(data: TicketRejectedData): RenderedEmail {
  return {
    subject: subjectLine(`No pudimos validar tu pago: ${data.eventTitle}`),
    html: layout(
      "No pudimos validar tu pago",
      `<p>Hola ${escapeHtml(data.name)}, revisamos tu comprobante para <strong>${escapeHtml(data.eventTitle)}</strong> y no pudimos validarlo.</p>
<p>Motivo: ${escapeHtml(data.reason)}</p>
<p>Puedes subir un nuevo comprobante en el siguiente enlace.</p>
${button(data.ticketUrl, "Subir otro comprobante")}`,
    ),
    text: `Hola ${data.name}, revisamos tu comprobante para ${data.eventTitle} y no pudimos validarlo.
Motivo: ${data.reason}

Sube otro comprobante aquí:
${data.ticketUrl}`,
  };
}
