export type LimitedRead = { ok: true; bytes: Uint8Array } | { ok: false };

/** Reads a body into memory, aborting as soon as more than `maxBytes` arrive. */
export async function readBodyLimited(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<LimitedRead> {
  if (!body) return { ok: true, bytes: new Uint8Array(0) };
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return { ok: false };
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return { ok: true, bytes };
}
