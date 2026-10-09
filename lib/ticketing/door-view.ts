/**
 * Staff-safe projections. They are explicit whitelists: anything not listed here
 * (receipts, amounts, SPEI data, email, settings) can never reach a door page.
 */

export interface DoorAnswer {
  label: string;
  value: string;
}

export interface DoorTicketView {
  id: string;
  code: string;
  name: string;
  status: string;
  paymentMethod: string;
  answers: DoorAnswer[];
  checkedInAt: Date | null;
  checkedInBy: string | null;
}

export interface DoorEventView {
  id: string;
  title: string;
  date: Date;
  time: string;
  location: string;
}

function toAnswers(raw: unknown): DoorAnswer[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const out: DoorAnswer[] = [];
  for (const entry of Object.values(raw)) {
    if (!entry || typeof entry !== "object") continue;
    const { label, value } = entry as Record<string, unknown>;
    if (typeof label !== "string") continue;
    const text = Array.isArray(value) ? value.map(String).join(", ") : value == null ? "" : String(value);
    out.push({ label, value: text });
  }
  return out;
}

export function toDoorTicketView(ticket: {
  id: string;
  code: string;
  name: string;
  status: string;
  paymentMethod: string;
  answers: unknown;
  checkedInAt: Date | null;
  checkedInBy: string | null;
}): DoorTicketView {
  return {
    id: ticket.id,
    code: ticket.code,
    name: ticket.name,
    status: ticket.status,
    paymentMethod: ticket.paymentMethod,
    answers: toAnswers(ticket.answers),
    checkedInAt: ticket.checkedInAt,
    checkedInBy: ticket.checkedInBy,
  };
}

export function toDoorEventView(event: {
  id: string;
  title: string;
  date: Date;
  time: string;
  location: string;
}): DoorEventView {
  return { id: event.id, title: event.title, date: event.date, time: event.time, location: event.location };
}
