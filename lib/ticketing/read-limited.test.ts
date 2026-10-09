import { describe, expect, it } from "vitest";
import { readBodyLimited } from "./read-limited";

function streamOf(chunks: Uint8Array[], onPull?: () => void) {
  let i = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      onPull?.();
      if (i < chunks.length) controller.enqueue(chunks[i++]);
      else controller.close();
    },
  });
}

describe("readBodyLimited", () => {
  it("concatenates chunks within the limit", async () => {
    const r = await readBodyLimited(streamOf([new Uint8Array([1, 2]), new Uint8Array([3])]), 3);
    expect(r).toEqual({ ok: true, bytes: new Uint8Array([1, 2, 3]) });
  });
  it("returns empty bytes for a null body", async () => {
    expect(await readBodyLimited(null, 10)).toEqual({ ok: true, bytes: new Uint8Array(0) });
  });
  it("fails as soon as the limit is exceeded and stops reading", async () => {
    let pulls = 0;
    const chunks = Array.from({ length: 100 }, () => new Uint8Array(10));
    const r = await readBodyLimited(streamOf(chunks, () => pulls++), 25);
    expect(r).toEqual({ ok: false });
    expect(pulls).toBeLessThan(10);
  });
});
