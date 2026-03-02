"use client";

import { useState, useEffect } from "react";
import { EventCard } from "./EventCard";
import { CreateEventModal } from "./CreateEventModal";
import { EditEventModal } from "./EditEventModal";
import { DeleteEventDialog } from "./DeleteEventDialog";
import { EventAttendeesModal } from "./EventAttendeesModal";
import { QrCodeModal } from "./QrCodeModal";
import { GoogleMapsScript } from "./GoogleMapsScript";
import { getEvents, deleteEvent } from "../_actions/event.actions";
import type { Event } from "@/app/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export function EventsList() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);
  const [eventAttendees, setEventAttendees] = useState<Event | null>(null);
  const [eventForQr, setEventForQr] = useState<Event | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadEvents = async () => {
    setLoading(true);
    const result = await getEvents();
    if (result.success && result.data) {
      setEvents(result.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const handleEdit = (event: Event) => {
    setEditingEvent(event);
  };

  const handleDeleteClick = (event: Event) => {
    setEventToDelete(event);
  };

  const handleDeleteConfirm = async () => {
    if (!eventToDelete) return;
    const idToDelete = eventToDelete.id;
    setDeleting(true);
    const result = await deleteEvent(idToDelete);
    setDeleting(false);
    setEventToDelete(null);
    if (result.success) {
      await loadEvents();
      if (editingEvent?.id === idToDelete) {
        setEditingEvent(null);
      }
    } else {
      alert(result.error ?? "Error al eliminar");
    }
  };

  const handleDeleteCancel = () => {
    if (!deleting) setEventToDelete(null);
  };

  const handleCreateModalSuccess = async () => {
    await loadEvents();
    setShowCreateModal(false);
  };

  const handleEditModalSuccess = async () => {
    await loadEvents();
    setEditingEvent(null);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <GoogleMapsScript />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-base sm:text-lg font-semibold">Eventos programados</h2>
        <Button
          onClick={() => setShowCreateModal(true)}
          className="w-full sm:w-auto min-h-10"
        >
          <Plus className="size-4 mr-2 shrink-0" />
          Crear evento
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm sm:text-base">Cargando eventos...</p>
      ) : events.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 sm:p-8 text-center text-muted-foreground">
          <p className="text-sm sm:text-base">No hay eventos creados aún.</p>
          <p className="text-xs sm:text-sm mt-1 mb-4">
            Crea tu primer evento para comenzar.
          </p>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="w-full sm:w-auto min-h-10"
          >
            <Plus className="size-4 mr-2 shrink-0" />
            Crear evento
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onEdit={handleEdit}
                onDelete={handleDeleteClick}
                onViewAttendees={(e) => setEventAttendees(e)}
                onShowQr={(e) => setEventForQr(e)}
              />
            ))}
        </div>
      )}

      <CreateEventModal
        open={showCreateModal}
        onSuccess={handleCreateModalSuccess}
        onClose={() => setShowCreateModal(false)}
      />

      <EditEventModal
        open={!!editingEvent}
        event={editingEvent}
        onSuccess={handleEditModalSuccess}
        onClose={() => setEditingEvent(null)}
      />

      <DeleteEventDialog
        open={!!eventToDelete}
        eventTitle={eventToDelete?.title}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        loading={deleting}
      />

      <EventAttendeesModal
        open={!!eventAttendees}
        event={eventAttendees}
        onClose={() => setEventAttendees(null)}
      />

      <QrCodeModal
        open={!!eventForQr}
        event={eventForQr}
        onClose={() => setEventForQr(null)}
      />
    </div>
  );
}
