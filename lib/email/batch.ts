import type { EmailMessage, SendResult } from "./email-sender";

/** Resend's batch endpoint accepts at most 100 emails per call. */
export const MAX_BATCH_SIZE = 100;

export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (!Number.isInteger(size) || size < 1) throw new Error("chunk size must be a positive integer");
  const groups: T[][] = [];
  for (let i = 0; i < items.length; i += size) groups.push(items.slice(i, i + size));
  return groups;
}

/**
 * Sends `messages` in groups of MAX_BATCH_SIZE through `sendChunk` and returns one result per
 * message, in input order. A group whose call throws (or answers with the wrong number of
 * results) fails as a whole; the other groups still go out. Never throws.
 */
export async function sendInChunks(
  messages: readonly EmailMessage[],
  sendChunk: (batch: EmailMessage[]) => Promise<SendResult[]>,
): Promise<SendResult[]> {
  const results: SendResult[] = [];
  for (const group of chunk(messages, MAX_BATCH_SIZE)) {
    try {
      const sent = await sendChunk(group);
      if (sent.length !== group.length) throw new Error("Batch result count mismatch");
      results.push(...sent);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Unknown batch error";
      results.push(...group.map((): SendResult => ({ ok: false, error: reason })));
    }
  }
  return results;
}
