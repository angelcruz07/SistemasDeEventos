import type { TicketStatus } from "@/app/generated/prisma/enums";
import { formatMx } from "@/lib/datetime";
import { STATUS_LABELS } from "./attendees";
import { CODE_ALPHABET, CODE_LENGTH, normalizeShortCode } from "./short-code";
import { verifyTicketToken } from "./token";

const MAX_SCAN_LENGTH = 500;
const MAX_QUERY_LENGTH = 100;
const MIN_QUERY_LENGTH = 2;
const MAX_NAME = 100;
const MAX_EMAIL = 254;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+()\-\s]{7,20}$/;

export type ScanInput = { kind: "ticket"; ticketId: string } | { kind: "code"; code: string } | { kind: "invalid" };

/** A scanned QR (signed token) or a manually typed short code. Anything else is invalid. */
export function parseScanInput(raw: string, secret: string): ScanInput {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value || value.length > MAX_SCAN_LENGTH) return { kind: "invalid" };
  if (value.includes(".")) {
    const ticketId = verifyTicketToken(value, secret);
    return ticketId ? { kind: "ticket", ticketId } : { kind: "invalid" };
  }
  const code = normalizeShortCode(value);
  if (code.length === CODE_LENGTH && [...code].every((c) => CODE_ALPHABET.includes(c))) {
    return { kind: "code", code };
  }
  return { kind: "invalid" };
}

/** Search text for name/code lookups; null when too short to search. */
export function parseSearchQuery(raw: string): { text: string; code: string } | null {
  const text = (typeof raw === "string" ? raw.trim() : "").slice(0, MAX_QUERY_LENGTH);
  if (text.length < MIN_QUERY_LENGTH) return null;
  return { text, code: normalizeShortCode(text) };
}

export type CheckInDecision =
  | { kind: "allow" }
  | { kind: "already"; message: string }
  | { kind: "denied"; message: string };

export function checkInDecision(
  ticket: { eventId: string; status: string; checkedInAt: Date | null; checkedInBy: string | null },
  sessionEventId: string,
): CheckInDecision {
  if (ticket.eventId !== sessionEventId) return { kind: "denied", message: "Boleto de otro evento" };
  switch (ticket.status) {
    case "PAID":
      return { kind: "allow" };
    case "CHECKED_IN": {
      const time = ticket.checkedInAt ? formatMx(ticket.checkedInAt).slice(-5) : null;
      const at = time ? ` a las ${time}` : "";
      const by = ticket.checkedInBy ? ` por ${ticket.checkedInBy}` : "";
      return { kind: "already", message: `Ya ingresó${at}${by}` };
    }
    case "CANCELLED":
      return { kind: "denied", message: "Cancelado" };
    default: {
      const label = STATUS_LABELS[ticket.status as TicketStatus] ?? ticket.status;
      return { kind: "denied", message: `Pago no confirmado: ${label}` };
    }
  }
}

export interface WalkInData {
  name: string;
  email: string | null;
  phone: string | null;
}

export type WalkInParse =
  | { data: WalkInData; errors?: undefined }
  | { errors: Partial<Record<"name" | "email" | "phone", string>>; data?: undefined };

/** Minimal door registration: name required, email and phone optional. */
export function parseWalkIn(input: unknown): WalkInParse {
  const raw = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const name = str(raw.name);
  const email = str(raw.email).toLowerCase();
  const phone = str(raw.phone);

  const errors: Partial<Record<"name" | "email" | "phone", string>> = {};
  if (!name || name.length > MAX_NAME) errors.name = "Ingresa el nombre";
  if (email && (email.length > MAX_EMAIL || !EMAIL_RE.test(email))) errors.email = "Ingresa un correo válido";
  if (phone && !PHONE_RE.test(phone)) errors.phone = "Ingresa un teléfono válido";
  if (Object.keys(errors).length > 0) return { errors };
  return { data: { name, email: email || null, phone: phone || null } };
}

/** True when the same value was already handled less than `windowMs` ago (camera re-reads the same QR). */
export function isRepeatScan(
  last: { value: string; at: number } | null,
  value: string,
  now: number,
  windowMs: number,
): boolean {
  return last !== null && last.value === value && now - last.at < windowMs;
}
