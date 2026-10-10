export const TICKET_TEMPLATES = ["minimal", "dark", "image"] as const;
export type TicketTemplate = (typeof TICKET_TEMPLATES)[number];

export interface TicketDesign {
  template: TicketTemplate;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  logoUrl: string | null;
  headerImageUrl: string | null;
  footerText: string;
}

export const FOOTER_MAX = 140;
export const IMAGE_HOST = "res.cloudinary.com";

export const DEFAULT_TICKET_DESIGN: TicketDesign = {
  template: "minimal",
  backgroundColor: "#FFFFFF",
  textColor: "#111111",
  accentColor: "#2563EB",
  logoUrl: null,
  headerImageUrl: null,
  footerText: "",
};

const HEX = /^#[0-9a-fA-F]{6}$/;

function color(value: unknown, fallback: string): string {
  return typeof value === "string" && HEX.test(value) ? value : fallback;
}

/** Only https URLs served from the Cloudinary CDN, without credentials or custom ports. */
export function sanitizeImageUrl(value: unknown, cloudName?: string | null): string | null {
  if (typeof value !== "string" || value.length > 500) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== IMAGE_HOST) return null;
    if (url.username || url.password || url.port) return null;
    // When the cloud is known, only that account's assets are allowed.
    if (cloudName && !url.pathname.startsWith(`/${cloudName}/`)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Stored JSON is never trusted: always normalize on read and before saving. */
export function parseTicketDesign(raw: unknown, cloudName?: string | null): TicketDesign {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return { ...DEFAULT_TICKET_DESIGN };
  const r = raw as Record<string, unknown>;
  const footer = typeof r.footerText === "string" ? r.footerText.trim() : "";
  return {
    template: TICKET_TEMPLATES.find((t) => t === r.template) ?? DEFAULT_TICKET_DESIGN.template,
    backgroundColor: color(r.backgroundColor, DEFAULT_TICKET_DESIGN.backgroundColor),
    textColor: color(r.textColor, DEFAULT_TICKET_DESIGN.textColor),
    accentColor: color(r.accentColor, DEFAULT_TICKET_DESIGN.accentColor),
    logoUrl: sanitizeImageUrl(r.logoUrl, cloudName),
    headerImageUrl: sanitizeImageUrl(r.headerImageUrl, cloudName),
    footerText: footer.length <= FOOTER_MAX ? footer : "",
  };
}

function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** WCAG AA for normal text. A warning only; the owner can still save. */
export function hasLowContrast(text: string, background: string): boolean {
  return contrastRatio(text, background) < 4.5;
}

/** Template presets used as starting colors in the editor. */
export const TEMPLATE_PRESETS: Record<TicketTemplate, Pick<TicketDesign, "backgroundColor" | "textColor" | "accentColor">> = {
  minimal: { backgroundColor: "#FFFFFF", textColor: "#111111", accentColor: "#2563EB" },
  dark: { backgroundColor: "#111827", textColor: "#F9FAFB", accentColor: "#F59E0B" },
  image: { backgroundColor: "#FFFFFF", textColor: "#111111", accentColor: "#DB2777" },
};
