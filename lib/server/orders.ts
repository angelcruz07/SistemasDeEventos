import type { Prisma } from "@/app/generated/prisma/client";

/** Serializes registrations, uploads and reviews of one event. Must be the first statement of the transaction. */
export async function lockEvent(tx: Prisma.TransactionClient, eventId: string): Promise<void> {
  await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${eventId} FOR UPDATE`;
}
