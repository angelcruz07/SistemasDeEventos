// 4 MiB keeps the whole multipart request under Vercel's 4.5 MB body limit.
export const MAX_RECEIPT_BYTES = 4 * 1024 * 1024;

export type ReceiptMime = "image/jpeg" | "image/png" | "image/webp" | "application/pdf";

const startsWith = (bytes: Uint8Array, signature: readonly number[], offset = 0) =>
  bytes.length >= offset + signature.length && signature.every((b, i) => bytes[offset + i] === b);

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const RIFF = [0x52, 0x49, 0x46, 0x46];
const WEBP = [0x57, 0x45, 0x42, 0x50];
const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d];

/** Detects the real type from magic bytes. File names and declared MIME types are never trusted. */
export function sniffReceiptMime(bytes: Uint8Array): ReceiptMime | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, PNG)) return "image/png";
  if (startsWith(bytes, RIFF) && startsWith(bytes, WEBP, 8)) return "image/webp";
  if (startsWith(bytes, PDF)) return "application/pdf";
  return null;
}

export type ReceiptValidation =
  | { ok: true; mimeType: ReceiptMime; sizeBytes: number }
  | { ok: false; error: "empty" | "size" | "type" };

export function validateReceiptFile(bytes: Uint8Array): ReceiptValidation {
  if (bytes.length === 0) return { ok: false, error: "empty" };
  if (bytes.length > MAX_RECEIPT_BYTES) return { ok: false, error: "size" };
  const mimeType = sniffReceiptMime(bytes);
  if (!mimeType) return { ok: false, error: "type" };
  return { ok: true, mimeType, sizeBytes: bytes.length };
}
