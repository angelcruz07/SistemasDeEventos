import { isValidClabe } from "./clabe";
import { parsePesosToCents } from "./money";

export interface TicketingConfigInput {
  /** Pesos as typed by the organizer, e.g. "350.50". Empty means free. */
  price: string;
  allowSpei: boolean;
  allowCash: boolean;
  speiClabe: string;
  speiBank: string;
  speiBeneficiary: string;
  capacity: string;
  displayCapacity: string;
  registrationOpen: boolean;
}

export interface TicketingConfig {
  priceCents: number;
  allowSpei: boolean;
  allowCash: boolean;
  speiClabe: string | null;
  speiBank: string | null;
  speiBeneficiary: string | null;
  capacity: number | null;
  displayCapacity: number | null;
  registrationOpen: boolean;
}

export type ParsedTicketingConfig =
  | { data: TicketingConfig }
  | { errors: Record<string, string> };

const MAX_COUNT = 1_000_000;
const MAX_TEXT = 120;

function parseOptionalCount(raw: string): number | null | "invalid" {
  const text = raw.trim();
  if (!text) return null;
  if (!/^\d+$/.test(text)) return "invalid";
  const n = Number(text);
  return n >= 1 && n <= MAX_COUNT ? n : "invalid";
}

/**
 * Validates the organizer's ticketing form and converts it to DB values.
 * SPEI details are only required when SPEI can actually be used (price > 0).
 */
export function parseTicketingConfig(input: TicketingConfigInput): ParsedTicketingConfig {
  const errors: Record<string, string> = {};

  const priceCents = parsePesosToCents(input.price.trim() === "" ? "0" : input.price);
  if (priceCents === null) errors.price = "Ingresa un precio válido (por ejemplo 350 o 350.50)";

  if (priceCents !== null && priceCents > 0 && !input.allowSpei && !input.allowCash) {
    errors.methods = "Activa al menos un método de pago para un evento con precio";
  }

  const clabe = input.speiClabe.replace(/\s+/g, "");
  const bank = input.speiBank.trim();
  const beneficiary = input.speiBeneficiary.trim();
  if (priceCents !== null && priceCents > 0 && input.allowSpei) {
    if (!clabe) errors.speiClabe = "La CLABE es obligatoria para recibir SPEI";
    else if (!isValidClabe(clabe)) errors.speiClabe = "La CLABE no es válida (18 dígitos con dígito verificador)";
    if (!bank) errors.speiBank = "El banco es obligatorio para recibir SPEI";
    if (!beneficiary) errors.speiBeneficiary = "El beneficiario es obligatorio para recibir SPEI";
  }
  if (bank.length > MAX_TEXT) errors.speiBank = "El banco es demasiado largo";
  if (beneficiary.length > MAX_TEXT) errors.speiBeneficiary = "El beneficiario es demasiado largo";

  const capacity = parseOptionalCount(input.capacity);
  if (capacity === "invalid") errors.capacity = "El cupo debe ser un entero positivo o quedar vacío";
  const displayCapacity = parseOptionalCount(input.displayCapacity);
  if (displayCapacity === "invalid") {
    errors.displayCapacity = "El número público debe ser un entero positivo o quedar vacío";
  }

  if (Object.keys(errors).length > 0 || priceCents === null) return { errors };

  return {
    data: {
      priceCents,
      allowSpei: input.allowSpei,
      allowCash: input.allowCash,
      speiClabe: clabe || null,
      speiBank: bank || null,
      speiBeneficiary: beneficiary || null,
      capacity: capacity as number | null,
      displayCapacity: displayCapacity as number | null,
      registrationOpen: input.registrationOpen,
    },
  };
}

/** Field ids that have at least one stored answer across the given `Ticket.answers` values. */
export function collectAnsweredFieldIds(answersList: readonly unknown[]): Set<string> {
  const ids = new Set<string>();
  for (const answers of answersList) {
    if (typeof answers !== "object" || answers === null || Array.isArray(answers)) continue;
    for (const id of Object.keys(answers)) ids.add(id);
  }
  return ids;
}
