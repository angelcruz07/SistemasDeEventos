import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireEventOwner } from "@/lib/server/guards";
import { EventHubTabs } from "./_components/EventHubTabs";

export default async function EventHubLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { event } = await requireEventOwner(id);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div>
        <Link
          href="/dashboard/events"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Eventos
        </Link>
        <h1 className="mt-2 text-xl sm:text-2xl font-bold tracking-tight">{event.title}</h1>
      </div>
      <EventHubTabs eventId={event.id} />
      {children}
    </div>
  );
}
