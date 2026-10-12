import prisma from "@/app/lib/prisma";
import { getSession } from "@/lib/auth-server";
import { receiptHeaders } from "@/lib/ticketing/receipt-response";

export const runtime = "nodejs";

const notFound = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

/** Serves a receipt to the owner of its event only; everyone else gets 404. */
export async function GET(_request: Request, { params }: { params: Promise<{ receiptId: string }> }) {
  const { receiptId } = await params;
  const session = await getSession();
  if (!session) return notFound();

  const receipt = await prisma.receipt.findFirst({
    where: {
      id: receiptId,
      OR: [
        { order: { event: { userId: session.user.id } } },
        { ticket: { event: { userId: session.user.id } } },
      ],
    },
    select: { bytes: true, mimeType: true },
  });
  if (!receipt) return notFound();
  if (!receipt.bytes) return new Response("Gone", { status: 410, headers: { "Cache-Control": "no-store" } });

  return new Response(new Uint8Array(receipt.bytes), { headers: receiptHeaders(receipt.mimeType) });
}
