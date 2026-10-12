"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteEvent } from "../_actions/event.actions";
import type { EventWithImages as Event } from "../interfaces/event.interface";
import { DeleteEventDialog } from "./DeleteEventDialog";
import { EventCard } from "./EventCard";
import { QrCodeModal } from "./QrCodeModal";

function CreateEventLink() {
  return (
    <Button asChild className="w-full sm:w-auto min-h-10">
      <Link href="/dashboard/events/new">
        <Plus className="size-4 mr-2 shrink-0" />
        Crear evento
      </Link>
    </Button>
  );
}

export function EventsList({ events }: { events: Event[] }) {
  const router = useRouter();
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);
  const [eventForQr, setEventForQr] = useState<Event | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteConfirm = async () => {
    if (!eventToDelete) return;
    setDeleting(true);
    const result = await deleteEvent(eventToDelete.id);
    setDeleting(false);
    setEventToDelete(null);
    if (result.success) router.refresh();
    else alert(result.error ?? "Error al eliminar");
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-base sm:text-lg font-semibold">Eventos programados</h2>
        <CreateEventLink />
      </div>

      {events.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 sm:p-8 text-center text-muted-foreground">
          <p className="text-sm sm:text-base">No hay eventos creados aún.</p>
          <p className="text-xs sm:text-sm mt-1 mb-4">Crea tu primer evento para comenzar.</p>
          <CreateEventLink />
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <EventCard key={event.id} event={event} onDelete={setEventToDelete} onShowQr={setEventForQr} />
          ))}
        </div>
      )}

      <DeleteEventDialog
        open={!!eventToDelete}
        eventTitle={eventToDelete?.title}
        onConfirm={handleDeleteConfirm}
        onCancel={() => !deleting && setEventToDelete(null)}
        loading={deleting}
      />

      <QrCodeModal open={!!eventForQr} event={eventForQr} onClose={() => setEventForQr(null)} />
    </div>
  );
}
