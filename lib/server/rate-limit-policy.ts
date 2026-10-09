/** Opportunistic cleanup: roughly 1% of hits also delete expired buckets. */
export const PURGE_PROBABILITY = 0.01;

export function shouldPurge(random: number, probability = PURGE_PROBABILITY): boolean {
  return random < probability;
}

/** Buckets whose window started before this instant can never count again. */
export function purgeCutoff(now: Date, maxWindowMs: number): Date {
  return new Date(now.getTime() - maxWindowMs);
}
