import { isCronAuthorized } from "@/lib/server/cron-auth";
import { purgeExpiredReceipts } from "@/lib/server/receipts-purge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Optional scheduled purge. Disabled (404) unless CRON_SECRET is set. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new Response("Not found", { status: 404 });
  if (!isCronAuthorized(request.headers.get("authorization"), secret)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const purged = await purgeExpiredReceipts(new Date());
  return Response.json({ purged }, { headers: { "Cache-Control": "no-store" } });
}
