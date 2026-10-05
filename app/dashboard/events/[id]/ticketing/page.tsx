import { notFound } from "next/navigation";
import { getEventById } from "@/app/dashboard/events/_actions/event.actions";

// Placeholder until the ticketing hub lands (owner-protected via getEventById).
export default async function TicketingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getEventById(id);

  if (!result.success || !result.data) {
    notFound();
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
        Boletos: {result.data.title}
      </h1>
      <p className="text-muted-foreground mt-2 text-sm">En construcción</p>
    </div>
  );
}
