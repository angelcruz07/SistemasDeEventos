import { getTicketingEnv } from "@/lib/env";
import { receiptFail, uploadOrderReceipt } from "@/lib/server/order-receipt";
import { verifyOrderToken } from "@/lib/ticketing/token";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const orderId = verifyOrderToken(token, getTicketingEnv().signingSecret);
  if (!orderId) return receiptFail("Pedido no encontrado.", 404);
  return uploadOrderReceipt(request, { kind: "order", id: orderId });
}
