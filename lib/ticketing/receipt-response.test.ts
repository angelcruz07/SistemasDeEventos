import { describe, expect, it } from "vitest";
import { receiptHeaders } from "./receipt-response";

describe("receiptHeaders", () => {
  it("serves images inline in a sandbox with nosniff and no caching", () => {
    const h = receiptHeaders("image/png");
    expect(h["Content-Type"]).toBe("image/png");
    expect(h["Content-Disposition"]).toBe("inline");
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["Content-Security-Policy"]).toBe("sandbox");
    expect(h["Cache-Control"]).toBe("private, no-store");
  });

  it("forces PDFs to download", () => {
    expect(receiptHeaders("application/pdf")["Content-Disposition"]).toBe('attachment; filename="comprobante.pdf"');
  });

  it("forces anything unknown to download as octet-stream", () => {
    const h = receiptHeaders("text/html");
    expect(h["Content-Type"]).toBe("application/octet-stream");
    expect(h["Content-Disposition"]).toBe('attachment; filename="comprobante"');
  });
});
