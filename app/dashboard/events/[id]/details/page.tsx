import prisma from "@/app/lib/prisma";
import { requireEventOwner } from "@/lib/server/guards";
import { EventForm } from "../../_components/EventForm";
import { IMAGES_INCLUDE } from "../../interfaces/event.interface";

export default async function DetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireEventOwner(id);
  const event = await prisma.event.findUnique({ where: { id }, include: IMAGES_INCLUDE });
  if (!event) return null;

  return (
    <EventForm
      // Re-mount after a save so the form always reflects the server state.
      key={event.updatedAt.toISOString()}
      event={{
        id: event.id,
        title: event.title,
        description: event.description,
        date: event.date.toISOString().split("T")[0],
        time: event.time,
        location: event.location,
        images: event.images.map((i) => i.url),
        isCancelled: event.isCancelled,
      }}
    />
  );
}
