import { describe, expect, it, vi } from "vitest";
import { MAX_BATCH_SIZE, chunk, sendInChunks } from "./batch";
import type { EmailMessage, SendResult } from "./email-sender";

const msg = (n: number): EmailMessage => ({ to: `u${n}@x.com`, subject: `s${n}`, html: "h", text: "t" });
const many = (n: number) => Array.from({ length: n }, (_, i) => msg(i));

describe("chunk", () => {
  it("splits into groups of at most `size`, keeping order", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
  it("returns no groups for an empty list", () => {
    expect(chunk([], 100)).toEqual([]);
  });
  it("rejects a non-positive size", () => {
    expect(() => chunk([1], 0)).toThrow();
  });
});

describe("sendInChunks", () => {
  it("calls the sender once per 100 messages", async () => {
    const send = vi.fn(async (batch: EmailMessage[]): Promise<SendResult[]> => batch.map(() => ({ ok: true, id: "x" })));
    const results = await sendInChunks(many(250), send);
    expect(MAX_BATCH_SIZE).toBe(100);
    expect(send.mock.calls.map(([b]) => b.length)).toEqual([100, 100, 50]);
    expect(results).toHaveLength(250);
  });

  it("keeps results aligned with the input order", async () => {
    const send = async (batch: EmailMessage[]): Promise<SendResult[]> =>
      batch.map((m) => ({ ok: true as const, id: m.to }));
    const results = await sendInChunks(many(3), send);
    expect(results.map((r) => (r.ok ? r.id : ""))).toEqual(["u0@x.com", "u1@x.com", "u2@x.com"]);
  });

  it("fails only the chunk whose call throws and still sends the rest", async () => {
    let call = 0;
    const send = async (batch: EmailMessage[]): Promise<SendResult[]> => {
      call += 1;
      if (call === 1) throw new Error("boom");
      return batch.map(() => ({ ok: true as const, id: "x" }));
    };
    const results = await sendInChunks(many(150), send);
    expect(results.slice(0, 100).every((r) => !r.ok)).toBe(true);
    expect(results.slice(100).every((r) => r.ok)).toBe(true);
  });

  it("marks a chunk failed when the sender returns the wrong number of results", async () => {
    const results = await sendInChunks(many(3), async () => [{ ok: true, id: "x" }]);
    expect(results.every((r) => !r.ok)).toBe(true);
  });

  it("returns an empty list without calling the sender", async () => {
    const send = vi.fn();
    expect(await sendInChunks([], send)).toEqual([]);
    expect(send).not.toHaveBeenCalled();
  });
});
