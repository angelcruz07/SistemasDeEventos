import { formatMxn } from "./money";
import { orderAmount, parseQuantity } from "./order";

/** Quantity typed in the buyer form, forced into [1, max]. Display-only; the server revalidates. */
export function clampQuantity(raw: unknown, max: number): number {
  const parsed = parseQuantity(raw) ?? 1;
  return Math.max(1, Math.min(parsed, max));
}

/** Live total shown next to the quantity: "Gratis", a peso amount, or null when it cannot be charged. */
export function orderTotalLabel(unitPriceCents: number, quantity: number): string | null {
  if (unitPriceCents === 0) return "Gratis";
  const amount = orderAmount(unitPriceCents, quantity);
  return amount === null ? null : formatMxn(amount);
}

/** Text typed in the quantity field: digits only, at most 3 characters. */
export function sanitizeQuantityText(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 3);
}
