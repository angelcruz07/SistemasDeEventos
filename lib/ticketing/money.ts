/** Parses "350.50" pesos into integer cents. Returns null on invalid input. */
export function parsePesosToCents(input: string): number | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(input.trim());
  if (!match) return null;
  const cents = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}

/** Locale-independent MXN formatting, e.g. 123456 -> "$1,234.56". */
export function formatMxn(cents: number): string {
  if (!Number.isInteger(cents) || cents < 0) throw new Error("cents must be a non-negative integer");
  const pesos = Math.floor(cents / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `$${pesos}.${(cents % 100).toString().padStart(2, "0")}`;
}
