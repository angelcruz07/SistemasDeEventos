const INLINE_IMAGES = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Response headers for serving a stored receipt. The MIME is the one sniffed at
 * upload. Images render inline inside a CSP sandbox; everything else downloads.
 */
export function receiptHeaders(mimeType: string): Record<string, string> {
  const base = {
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "sandbox",
  };
  if (INLINE_IMAGES.has(mimeType)) {
    return { ...base, "Content-Type": mimeType, "Content-Disposition": "inline" };
  }
  if (mimeType === "application/pdf") {
    return { ...base, "Content-Type": mimeType, "Content-Disposition": 'attachment; filename="comprobante.pdf"' };
  }
  return {
    ...base,
    "Content-Type": "application/octet-stream",
    "Content-Disposition": 'attachment; filename="comprobante"',
  };
}
