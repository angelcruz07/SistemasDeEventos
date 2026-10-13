import prisma from "@/app/lib/prisma";
import { getOwnedEvent } from "@/lib/server/guards";
import { buildAttendeeWhere, parseAttendeeFilter } from "@/lib/ticketing/attendees";
import { buildAttendeesCsv } from "@/lib/ticketing/csv";
import { parseFormSchema } from "@/lib/ticketing/form-schema";

export const runtime = "nodejs";

const MAX_ROWS = 10_000;

const notFound = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

/** Owner-only CSV export (one row per ticket, plus unpaid orders) honoring the attendees page filters. Never includes receipts. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owned = await getOwnedEvent(id);
  if (!owned) return notFound();
  const { event } = owned;

  const filter = parseAttendeeFilter(Object.fromEntries(new URL(request.url).searchParams));
  const orders = await prisma.order.findMany({
    where: buildAttendeeWhere(event.id, filter),
    orderBy: { createdAt: "asc" },
    take: MAX_ROWS,
    select: {
      code: true,
      name: true,
      email: true,
      status: true,
      paymentMethod: true,
      quantity: true,
      amountCents: true,
      createdAt: true,
      answers: true,
      tickets: {
        orderBy: { seq: "asc" },
        select: { code: true, seq: true, status: true, amountCents: true, checkedInAt: true, checkedInBy: true },
      },
    },
  });

  const schema = parseFormSchema(event.formSchema) ?? { version: 1 as const, fields: [] };
  const csv = buildAttendeesCsv(orders, schema);
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const slug = event.slug.replace(/[^a-z0-9-]/gi, "").slice(0, 60) || "evento";

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="asistentes-${slug}-${date}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
