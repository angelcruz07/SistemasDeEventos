import { requireEventOwner } from "@/lib/server/guards";
import { TicketingForm } from "../_components/TicketingForm";

export default async function TicketingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { event } = await requireEventOwner(id);

  return (
    <TicketingForm
      eventId={event.id}
      initial={{
        price: event.priceCents === 0 ? "0" : (event.priceCents / 100).toFixed(2),
        allowSpei: event.allowSpei,
        allowCash: event.allowCash,
        speiClabe: event.speiClabe ?? "",
        speiBank: event.speiBank ?? "",
        speiBeneficiary: event.speiBeneficiary ?? "",
        capacity: event.capacity?.toString() ?? "",
        displayCapacity: event.displayCapacity?.toString() ?? "",
        registrationOpen: event.registrationOpen,
      }}
    />
  );
}
