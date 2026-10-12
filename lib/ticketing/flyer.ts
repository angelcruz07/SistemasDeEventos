export const FLYER_FORMATS = {
  post: { width: 1080, height: 1350 },
  story: { width: 1080, height: 1920 },
} as const;
export type FlyerFormat = keyof typeof FLYER_FORMATS;

export function parseFlyerFormat(value: string | null | undefined): FlyerFormat {
  return value === "story" ? "story" : "post";
}

/** Single-line text capped at `max` characters (ellipsis included). */
export function truncateText(value: string, max: number): string {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length <= max ? text : `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

/** Longer titles get smaller type so they wrap in at most a few lines. */
export function flyerTitleFontSize(titleLength: number): number {
  if (titleLength <= 20) return 96;
  if (titleLength <= 40) return 80;
  if (titleLength <= 70) return 64;
  return 52;
}

function asciiSlug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function flyerFilename(slug: string, format: FlyerFormat): string {
  const base = asciiSlug(slug) || "evento";
  return `flyer-${base}${format === "story" ? "-historia" : ""}.png`;
}

/** The filename is built only from the ticket code, never from other user input. */
export function qrFilename(code: string): string {
  return `qr-${code.replace(/[^A-Za-z0-9]/g, "") || "boleto"}.png`;
}
