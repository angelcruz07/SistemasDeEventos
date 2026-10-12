import { getTicketingEnv } from "@/lib/env";
import { receiptFail, uploadOrderReceipt } from "@/lib/server/order-receipt";
import { verifyTicketToken } from "@/lib/ticketing/token";

export const runtime = "nodejs";

/** Adapter for ticket links already emailed or open in a browser: ticket token -> its order. */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ticketId = verifyTicketToken(token, getTicketingEnv().signingSecret);
  if (!ticketId) return receiptFail("Boleto no encontrado.", 404);
  return uploadOrderReceipt(request, { kind: "ticket", id: ticketId });
}
