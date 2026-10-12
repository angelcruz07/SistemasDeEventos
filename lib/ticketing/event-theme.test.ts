import { describe, expect, it } from "vitest";
import { contrastRatio, DEFAULT_TICKET_DESIGN } from "./ticket-design";
import { deriveEventTheme, normalizeMultiline, readableOn } from "./event-theme";

describe("readableOn", () => {
  it("picks white on dark and near-black on light", () => {
    expect(readableOn("#000000")).toBe("#FFFFFF");
    expect(readableOn("#FFFFFF")).toBe("#111111");
  });
});

describe("deriveEventTheme", () => {
  it("keeps the organizer colors when contrast is fine", () => {
    const theme = deriveEventTheme({ ...DEFAULT_TICKET_DESIGN, backgroundColor: "#111827", textColor: "#F9FAFB", accentColor: "#F59E0B" });
    expect(theme.background).toBe("#111827");
    expect(theme.text).toBe("#F9FAFB");
    expect(theme.accentOnBackground).toBe("#F59E0B");
    expect(theme.accentText).toBe("#111111");
  });

  it("falls back to a readable body color when contrast is low", () => {
    const theme = deriveEventTheme({ ...DEFAULT_TICKET_DESIGN, backgroundColor: "#FFFFFF", textColor: "#EEEEEE" });
    expect(theme.text).toBe("#111111");
    expect(contrastRatio(theme.text, theme.background)).toBeGreaterThanOrEqual(4.5);
  });

  it("uses the text color for accents that vanish on the background", () => {
    const theme = deriveEventTheme({ ...DEFAULT_TICKET_DESIGN, backgroundColor: "#FFFFFF", textColor: "#111111", accentColor: "#FFFF00" });
    expect(theme.accentOnBackground).toBe("#111111");
    expect(theme.accent).toBe("#FFFF00");
  });

  it("always yields readable button text on the accent", () => {
    for (const accent of ["#2563EB", "#FFFF00", "#000000", "#DB2777"]) {
      const theme = deriveEventTheme({ ...DEFAULT_TICKET_DESIGN, accentColor: accent });
      expect(contrastRatio(theme.accentText, accent)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("normalizeMultiline", () => {
  it("normalizes CRLF, trims line ends and caps blank runs at one", () => {
    expect(normalizeMultiline("  Hola  \r\nmundo\r\n\r\n\r\n\r\nFin \n")).toBe("Hola\nmundo\n\nFin");
  });
  it("returns an empty string for blank input", () => {
    expect(normalizeMultiline("  \n \n")).toBe("");
  });
});
