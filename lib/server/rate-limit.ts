import prisma from "@/app/lib/prisma";
import { purgeCutoff, shouldPurge } from "./rate-limit-policy";

export interface RateLimitResult {
  allowed: boolean;
  count: number;
}

/** Largest window used anywhere (upload limits are per hour); older buckets are dead. */
const MAX_WINDOW_MS = 60 * 60 * 1000;

/**
 * DB-backed fixed-window counter. One atomic upsert per hit: if the stored
 * window is older than `windowMs` it restarts at 1, otherwise it increments.
 * Works across instances and restarts. Errors propagate so callers fail closed.
 * About 1% of hits also purge expired buckets so the table stays bounded.
 */
export async function hitRateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - windowMs);
  // ISO strings cast to timestamp: the column is stored as UTC without zone.
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimitBucket" ("key", "windowStart", "count")
    VALUES (${key}, ${now.toISOString()}::timestamp, 1)
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimitBucket"."windowStart" <= ${cutoff.toISOString()}::timestamp
                     THEN 1 ELSE "RateLimitBucket"."count" + 1 END,
      "windowStart" = CASE WHEN "RateLimitBucket"."windowStart" <= ${cutoff.toISOString()}::timestamp
                           THEN ${now.toISOString()}::timestamp ELSE "RateLimitBucket"."windowStart" END
    RETURNING "count"`;

  if (shouldPurge(Math.random())) {
    const expired = purgeCutoff(now, Math.max(MAX_WINDOW_MS, windowMs));
    // Best effort: a failed cleanup must not affect the request.
    await prisma.$executeRaw`DELETE FROM "RateLimitBucket" WHERE "windowStart" < ${expired.toISOString()}::timestamp`.catch(
      () => undefined,
    );
  }

  const count = Number(rows[0]?.count ?? 0);
  return { allowed: count <= limit, count };
}
