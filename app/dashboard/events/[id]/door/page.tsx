import prisma from "@/app/lib/prisma";
import { requireEventOwner } from "@/lib/server/guards";
import { DoorAccessPanel, type DoorStatus } from "../_components/DoorAccessPanel";

export default async function DoorAccessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { event } = await requireEventOwner(id);

  // Explicit select: the key and PIN hashes never leave the server.
  const access = await prisma.doorAccess.findUnique({
    where: { eventId: event.id },
    select: { revokedAt: true, createdAt: true, lockedUntil: true },
  });
  const status: DoorStatus = access
    ? {
        state: access.revokedAt ? "revoked" : "active",
        createdAt: access.createdAt.toISOString(),
        lockedUntil: access.lockedUntil?.toISOString() ?? null,
      }
    : { state: "none", createdAt: null, lockedUntil: null };

  return <DoorAccessPanel eventId={event.id} status={status} />;
}
