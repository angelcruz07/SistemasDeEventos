import { requireEventOwner } from "@/lib/server/guards";
import { parseTicketDesign } from "@/lib/ticketing/ticket-design";
import { DesignEditor } from "../_components/DesignEditor";

export default async function DesignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { event } = await requireEventOwner(id);
  return (
    <DesignEditor
      eventId={event.id}
      eventTitle={event.title}
      slug={event.slug}
      initial={parseTicketDesign(event.ticketDesign, process.env.CLOUDINARY_CLOUD_NAME)}
    />
  );
}
