import { describe, expect, it } from "vitest";
import { contrastRatio, DEFAULT_TICKET_DESIGN, hasLowContrast, parseTicketDesign } from "./ticket-design";

const CDN = "https://res.cloudinary.com/demo/image/upload/logo.png";

describe("parseTicketDesign", () => {
  it("returns defaults for non-objects", () => {
    for (const raw of [null, undefined, "x", 5, [], {}]) {
      expect(parseTicketDesign(raw)).toEqual(DEFAULT_TICKET_DESIGN);
    }
  });

  it("accepts valid values", () => {
    const d = parseTicketDesign({
      template: "dark",
      backgroundColor: "#112233",
      textColor: "#FFFFFF",
      accentColor: "#ff00aa",
      logoUrl: CDN,
      headerImageUrl: CDN,
      footerText: "Gracias",
    });
    expect(d).toEqual({
      template: "dark",
      backgroundColor: "#112233",
      textColor: "#FFFFFF",
      accentColor: "#ff00aa",
      logoUrl: CDN,
      headerImageUrl: CDN,
      footerText: "Gracias",
    });
  });

  it("falls back on invalid template and colors", () => {
    const d = parseTicketDesign({
      template: "evil",
      backgroundColor: "red; background:url(x)",
      textColor: "#fff",
      accentColor: "#GGGGGG",
    });
    expect(d.template).toBe("minimal");
    expect(d.backgroundColor).toBe(DEFAULT_TICKET_DESIGN.backgroundColor);
    expect(d.textColor).toBe(DEFAULT_TICKET_DESIGN.textColor);
    expect(d.accentColor).toBe(DEFAULT_TICKET_DESIGN.accentColor);
  });

  it("rejects non-cloudinary or non-https image URLs", () => {
    for (const url of [
      "http://res.cloudinary.com/a.png",
      "https://evil.com/a.png",
      "https://res.cloudinary.com.evil.com/a.png",
      "https://user@res.cloudinary.com/a.png",
      "javascript:alert(1)",
      "not a url",
      42,
    ]) {
      const d = parseTicketDesign({ logoUrl: url, headerImageUrl: url });
      expect(d.logoUrl).toBeNull();
      expect(d.headerImageUrl).toBeNull();
    }
  });

  it("limits footer text to 140 chars and trims", () => {
    expect(parseTicketDesign({ footerText: "  hola  " }).footerText).toBe("hola");
    expect(parseTicketDesign({ footerText: "a".repeat(141) }).footerText).toBe("");
    expect(parseTicketDesign({ footerText: "a".repeat(140) }).footerText).toHaveLength(140);
    expect(parseTicketDesign({ footerText: 7 }).footerText).toBe("");
  });
});

describe("contrast", () => {
  it("computes WCAG ratios", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 0);
    expect(contrastRatio("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 5);
  });
  it("warns below 4.5 only", () => {
    expect(hasLowContrast("#777777", "#888888")).toBe(true);
    expect(hasLowContrast("#000000", "#FFFFFF")).toBe(false);
  });
});

describe("cloud name scoping", () => {
  const url = "https://res.cloudinary.com/mycloud/image/upload/logo.png";
  it("accepts matching cloud name", () => {
    expect(parseTicketDesign({ logoUrl: url }, "mycloud").logoUrl).toBe(url);
  });
  it("rejects other cloud names, including prefix lookalikes", () => {
    expect(parseTicketDesign({ logoUrl: url }, "other").logoUrl).toBeNull();
    expect(parseTicketDesign({ logoUrl: url }, "my").logoUrl).toBeNull();
    expect(parseTicketDesign({ headerImageUrl: url }, "other").headerImageUrl).toBeNull();
  });
  it("keeps current behavior when not configured", () => {
    expect(parseTicketDesign({ logoUrl: url }).logoUrl).toBe(url);
    expect(parseTicketDesign({ logoUrl: url }, null).logoUrl).toBe(url);
    expect(parseTicketDesign({ logoUrl: url }, "").logoUrl).toBe(url);
  });
});
