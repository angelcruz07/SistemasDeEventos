import { contrastRatio, type TicketDesign } from "./ticket-design";

const LIGHT = "#FFFFFF";
const DARK = "#111111";
const BODY_MIN_CONTRAST = 4.5;
const ACCENT_MIN_CONTRAST = 3;

export interface EventTheme {
  background: string;
  /** Body text: the organizer's color, or a readable fallback when contrast is low. */
  text: string;
  /** Fill for buttons and badges. */
  accent: string;
  /** Readable text on top of `accent`. */
  accentText: string;
  /** Accent used as text/borders on the page background; falls back to `text` if it would vanish. */
  accentOnBackground: string;
}

/** White or near-black, whichever reads better on `background`. */
export function readableOn(background: string): string {
  return contrastRatio(LIGHT, background) >= contrastRatio(DARK, background) ? LIGHT : DARK;
}

/** Colors come from a parsed (validated) design, so every value is a #RRGGBB string. */
export function deriveEventTheme(design: TicketDesign): EventTheme {
  const { backgroundColor: background, textColor, accentColor } = design;
  const text = contrastRatio(textColor, background) >= BODY_MIN_CONTRAST ? textColor : readableOn(background);
  return {
    background,
    text,
    accent: accentColor,
    accentText: readableOn(accentColor),
    accentOnBackground: contrastRatio(accentColor, background) >= ACCENT_MIN_CONTRAST ? accentColor : text,
  };
}

/** Organizer text keeps its line breaks (render with `whitespace-pre-line`): normalize CRLF and cap blank runs at one. */
export function normalizeMultiline(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
