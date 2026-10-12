"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { createEvent, updateEvent } from "../_actions/event.actions";
import { EventImagesField } from "./EventImagesField";

/** Plain, serializable event values (never the full DB row, which carries payment details). */
export interface EventFormValues {
  id: string;
  title: string;
  description: string;
  /** YYYY-MM-DD */
  date: string;
  time: string;
  location: string;
  images: string[];
  isCancelled: boolean;
}

type FormState = Omit<EventFormValues, "id">;

const emptyForm: FormState = {
  title: "",
  description: "",
  date: "",
  time: "",
  location: "",
  images: [],
  isCancelled: false,
};

function isInPast(dateStr: string, timeStr: string): boolean {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [h, min] = timeStr.split(":").map(Number);
  if ([y, m, d, h, min].some((n) => Number.isNaN(n))) return false;
  return new Date(y, m - 1, d, h, min).getTime() <= Date.now();
}

const textareaClass =
  "border-input bg-transparent text-foreground rounded-md border px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] placeholder:text-muted-foreground disabled:opacity-50 w-full min-w-0 min-h-32 resize-y";

/** Full-page event form. Without `event` it creates one; with it, it edits in place. */
export function EventForm({ event }: { event?: EventFormValues }) {
  const router = useRouter();
  const isEditing = !!event;
  const [form, setForm] = useState<FormState>(event ?? emptyForm);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const change = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError(null);
    setSaved(false);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSaved(false);

    if (!form.title.trim()) return setError("El título es obligatorio");
    if (!form.date || !form.time) return setError("La fecha y hora son obligatorias");
    if (!isEditing && isInPast(form.date, form.time)) {
      return setError("No puedes usar una fecha u hora pasada. Elige una fecha y hora futuras.");
    }

    setLoading(true);
    const result = event ? await updateEvent({ ...form, id: event.id }) : await createEvent(form);
    setLoading(false);

    if (!result.success) return setError(result.error ?? "Error al guardar");
    if (event) {
      setSaved(true);
      router.refresh();
    } else if (result.data) {
      router.push(`/dashboard/events/${result.data.id}/details`);
    }
  };

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle>{isEditing ? "Detalles del evento" : "Nuevo evento"}</CardTitle>
        <CardDescription>
          {isEditing
            ? "Estos datos se muestran en la página pública del evento."
            : "Completa los datos básicos. Después podrás configurar boletos, formulario y diseño."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <div className="space-y-2">
            <Label htmlFor="event-title">Título del evento</Label>
            <Input
              id="event-title"
              placeholder="Ej: Conferencia de Tecnología"
              value={form.title}
              onChange={(e) => change("title", e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="event-description">Descripción</Label>
            <textarea
              id="event-description"
              rows={6}
              placeholder="Describe el evento. Los saltos de línea se respetan en la página pública."
              value={form.description}
              onChange={(e) => change("description", e.target.value)}
              className={cn(textareaClass)}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="event-date">Fecha</Label>
              <Input
                id="event-date"
                type="date"
                value={form.date}
                min={isEditing ? undefined : new Date().toISOString().split("T")[0]}
                onChange={(e) => change("date", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-time">Hora</Label>
              <Input
                id="event-time"
                type="time"
                value={form.time}
                onChange={(e) => change("time", e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="event-location">Ubicación</Label>
            <Input
              id="event-location"
              placeholder="Ej: Sala de conferencias, dirección..."
              value={form.location}
              onChange={(e) => change("location", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Imágenes del evento</Label>
            <EventImagesField images={form.images} onChange={(images) => change("images", images)} />
          </div>

          {isEditing && (
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={form.isCancelled}
                onChange={(e) => change("isCancelled", e.target.checked)}
                className="size-4 rounded border-input"
              />
              Evento cancelado
            </label>
          )}

          {error && (
            <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" /> {error}
            </p>
          )}
          {saved && (
            <p role="status" className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
              <Check className="size-4 shrink-0" /> Cambios guardados.
            </p>
          )}

          <Button type="submit" className="min-h-10 w-full sm:w-auto" disabled={loading}>
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : isEditing ? (
              <Check className="size-4" />
            ) : (
              <Plus className="size-4" />
            )}
            {loading ? "Guardando..." : isEditing ? "Guardar cambios" : "Crear evento"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
