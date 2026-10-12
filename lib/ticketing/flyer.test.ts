import { describe, expect, it } from "vitest";
import { cloudinaryJpegUrl, flyerFilename, flyerTitleFontSize, parseFlyerFormat, qrFilename, truncateText } from "./flyer";

describe("parseFlyerFormat", () => {
  it("defaults to post and accepts story", () => {
    expect(parseFlyerFormat(null)).toBe("post");
    expect(parseFlyerFormat("nope")).toBe("post");
    expect(parseFlyerFormat("story")).toBe("story");
  });
});

describe("truncateText", () => {
  it("collapses whitespace and leaves short text alone", () => {
    expect(truncateText("  Hola \n  mundo ", 50)).toBe("Hola mundo");
  });
  it("cuts long text with an ellipsis within the limit", () => {
    const out = truncateText("a".repeat(100), 20);
    expect(out).toHaveLength(20);
    expect(out.endsWith("…")).toBe(true);
  });
});

describe("flyerTitleFontSize", () => {
  it("shrinks as the title grows", () => {
    expect(flyerTitleFontSize(10)).toBeGreaterThan(flyerTitleFontSize(40));
    expect(flyerTitleFontSize(40)).toBeGreaterThan(flyerTitleFontSize(100));
  });
});

describe("filenames", () => {
  it("builds ascii-only flyer names", () => {
    expect(flyerFilename("fiesta-ñandú-2026", "post")).toBe("flyer-fiesta-nandu-2026.png");
    expect(flyerFilename("a", "story")).toBe("flyer-a-historia.png");
    expect(flyerFilename("???", "post")).toBe("flyer-evento.png");
  });
  it("builds QR names only from safe code characters", () => {
    expect(qrFilename("ABCD1234")).toBe("qr-ABCD1234.png");
    expect(qrFilename('AB"\r\nCD/..')).toBe("qr-ABCD.png");
    expect(qrFilename("")).toBe("qr-boleto.png");
  });
});

describe("cloudinaryJpegUrl", () => {
  it("fits the whole image over a blurred JPEG backdrop", () => {
    expect(cloudinaryJpegUrl("https://res.cloudinary.com/demo/image/upload/v1/a/b.webp", 1080, 640)).toBe(
      "https://res.cloudinary.com/demo/image/upload/f_jpg,c_pad,b_blurred:400:15,w_1080,h_640/v1/a/b.webp",
    );
  });
  it("leaves URLs without an /upload/ segment untouched", () => {
    const url = "https://res.cloudinary.com/demo/image/fetch/x.png";
    expect(cloudinaryJpegUrl(url, 100, 100)).toBe(url);
  });
});
