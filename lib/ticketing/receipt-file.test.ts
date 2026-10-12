import { describe, expect, it } from "vitest";
import { MAX_RECEIPT_BYTES, sniffReceiptMime, validateReceiptFile } from "./receipt-file";

const bytes = (...b: number[]) => new Uint8Array([...b, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const WEBP = new Uint8Array([...ascii("RIFF"), 1, 2, 3, 4, ...ascii("WEBP"), 0]);
const PDF = new Uint8Array([...ascii("%PDF-1.7"), 0]);
const EXE = new Uint8Array([...ascii("MZ"), 0x90, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

describe("sniffReceiptMime", () => {
  it("detects the four allowed types", () => {
    expect(sniffReceiptMime(JPEG)).toBe("image/jpeg");
    expect(sniffReceiptMime(PNG)).toBe("image/png");
    expect(sniffReceiptMime(WEBP)).toBe("image/webp");
    expect(sniffReceiptMime(PDF)).toBe("application/pdf");
  });
  it("rejects executables, RIFF that is not WebP, and tiny input", () => {
    expect(sniffReceiptMime(EXE)).toBeNull();
    expect(sniffReceiptMime(new Uint8Array([...ascii("RIFF"), 1, 2, 3, 4, ...ascii("WAVE")]))).toBeNull();
    expect(sniffReceiptMime(new Uint8Array([0xff, 0xd8]))).toBeNull();
    expect(sniffReceiptMime(new Uint8Array())).toBeNull();
  });
});

describe("validateReceiptFile", () => {
  it("accepts a valid file and reports the sniffed mime", () => {
    expect(validateReceiptFile(PNG)).toEqual({ ok: true, mimeType: "image/png", sizeBytes: PNG.length });
  });
  it("ignores any declared name: a spoofed .exe renamed .png is rejected", () => {
    expect(validateReceiptFile(EXE)).toEqual({ ok: false, error: "type" });
  });
  it("rejects empty files", () => {
    expect(validateReceiptFile(new Uint8Array())).toEqual({ ok: false, error: "empty" });
  });
  it("enforces 4 MiB inclusive", () => {
    expect(MAX_RECEIPT_BYTES).toBe(4 * 1024 * 1024);
    const atLimit = new Uint8Array(MAX_RECEIPT_BYTES);
    atLimit.set(PNG);
    expect(validateReceiptFile(atLimit).ok).toBe(true);
    const over = new Uint8Array(MAX_RECEIPT_BYTES + 1);
    over.set(PNG);
    expect(validateReceiptFile(over)).toEqual({ ok: false, error: "size" });
  });
});
