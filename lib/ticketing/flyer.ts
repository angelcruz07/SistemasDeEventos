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

/** Inserts a Cloudinary transformation after /upload/. Expects an already sanitized Cloudinary URL. */
export function cloudinaryTransform(url: string, transformation: string): string {
  const marker = "/upload/";
  const at = url.indexOf(marker);
  if (at === -1) return url;
  const head = url.slice(0, at + marker.length);
  return `${head}${transformation}/${url.slice(head.length)}`;
}

/**
 * The whole image as a JPEG (never cropped; posters keep their edges), padded with
 * the design background. `b_blurred` is rejected (HTTP 400) on real accounts.
 */
export function cloudinaryJpegUrl(url: string, width: number, height: number, background = "#000000"): string {
  const rgb = /^#[0-9a-fA-F]{6}$/.test(background) ? background.slice(1) : "000000";
  return cloudinaryTransform(url, `f_jpg,c_pad,b_rgb:${rgb},w_${width},h_${height}`);
}
