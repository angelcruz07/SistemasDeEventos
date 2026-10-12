"use client";

import { useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createEvent, updateEvent } from "../_actions/event.actions";
import type { EventWithImages as Event } from "../interfaces/event.interface";
import { EventImagesField } from "./EventImagesField";
import { cn } from "@/lib/utils";
import {
  Type,
  FileText,
  CalendarDays,
  Clock,
  MapPin,
  ImageIcon,
  AlertCircle,
  Loader2,
  Plus,
  Check,
} from "lucide-react";

interface EventFormProps {
  event?: Event | null;
  onSuccess?: () => void;
  onCancel?: () => void;
  /** En modal no se muestra la Card, solo el contenido del formulario */
  variant?: "card" | "inline";
  /** Prefijo para los ids de los inputs (evita duplicados cuando hay otro formulario en la página) */
  formIdPrefix?: string;
}

interface FormData {
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  images: string[];
  isCancelled?: boolean;
}

const emptyForm: FormData = {
  title: "",
  description: "",
  date: "",
  time: "",
  location: "",
  images: [],
};

function eventToFormData(event: Event): FormData {
  const d = new Date(event.date);
  const dateStr = d.toISOString().split("T")[0];
  const eventWithCancelled = event as Event & { isCancelled?: boolean };
  return {
    title: event.title,
    description: event.description,
    date: dateStr,
    time: event.time,
    location: event.location,
    images: event.images.map((i) => i.url),
    isCancelled: eventWithCancelled.isCancelled ?? false,
  };
}

const id = (prefix: string, name: string) => (prefix ? `${prefix}-${name}` : name);

export function EventForm({ event, onSuccess, onCancel, variant = "card", formIdPrefix = "" }: EventFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>(() =>
    event ? eventToFormData(event) : { ...emptyForm }
  );

  const isEditing = !!event;

  // Reset the form when another event is selected for editing (adjust state during render).
  const [syncedEventId, setSyncedEventId] = useState(event?.id);
  if (syncedEventId !== event?.id) {
    setSyncedEventId(event?.id);
    setFormData(event ? eventToFormData(event) : { ...emptyForm });
    setError(null);
  }

  const handleChange = (field: keyof FormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const isEventDateInPast = (dateStr: string, timeStr: string): boolean => {
    if (!dateStr?.trim() || !timeStr?.trim()) return false;
    const dateParts = dateStr.trim().split("-").map(Number);
    const timeParts = timeStr.trim().split(":").map(Number);
    if (dateParts.length < 3 || timeParts.length < 2) return false;
    const [year, month, day] = dateParts;
    const [hours, minutes] = timeParts;
    if ([year, month, day, hours, minutes].some((n) => Number.isNaN(n))) return false;
    const eventDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
    if (Number.isNaN(eventDate.getTime())) return false;
    return eventDate.getTime() <= Date.now();
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const form = e.currentTarget;
    const dateValue = (form.elements.namedItem(id(formIdPrefix, "date")) as HTMLInputElement | null)?.value ?? formData.date;
    const timeValue = (form.elements.namedItem(id(formIdPrefix, "time")) as HTMLInputElement | null)?.value ?? formData.time;
    const titleValue = formData.title.trim();
    const payload = { ...formData, date: dateValue, time: timeValue };

    if (!titleValue) {
      setError("El título es obligatorio");
      setLoading(false);
      return;
    }
    if (!dateValue || !timeValue) {
      setError("La fecha y hora son obligatorias");
      setLoading(false);
      return;
    }
    if (!isEditing && isEventDateInPast(dateValue, timeValue)) {
      setError("No puedes usar una fecha u hora pasada. Elige una fecha y hora futuras.");
      setLoading(false);
      return;
    }

    const result = isEditing
      ? await updateEvent({ ...payload, id: event.id, isCancelled: formData.isCancelled })
      : await createEvent(payload);

    setLoading(false);

    if (result.success) {
      setFormData(emptyForm);
      onSuccess?.();
    } else {
      setError(result.error ?? "Error al guardar");
    }
  };

  const handleReset = () => {
    setFormData(event ? eventToFormData(event) : emptyForm);
    setError(null);
    onCancel?.();
  };

  const isInline = variant === "inline";
  const today = new Date().toISOString().split("T")[0];

  const inputBase =
    "border-input bg-transparent rounded-lg border px-3 py-2 text-sm shadow-sm transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] placeholder:text-muted-foreground disabled:opacity-50 h-10 w-full min-w-0";
  const textareaBase = cn(
    inputBase,
    "h-auto min-h-[88px] resize-y py-2.5"
  );

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-0">
      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {isInline && (
        <>
          <section className="space-y-4 pb-6">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Información del evento
            </h3>
            <div className="space-y-2">
              <Label htmlFor={id(formIdPrefix, "title")} className="text-sm font-medium flex items-center gap-2">
                <Type className="size-3.5 text-muted-foreground" />
                Título
              </Label>
              <Input
                id={id(formIdPrefix, "title")}
                placeholder="Ej: Conferencia de Tecnología"
                value={formData.title}
                onChange={(e) => handleChange("title", e.target.value)}
                required
                className="h-10 rounded-lg border-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={id(formIdPrefix, "description")} className="text-sm font-medium flex items-center gap-2">
                <FileText className="size-3.5 text-muted-foreground" />
                Descripción
              </Label>
              <textarea
                id={id(formIdPrefix, "description")}
                placeholder="Breve descripción del evento..."
                value={formData.description}
                onChange={(e) => handleChange("description", e.target.value)}
                rows={3}
                className={textareaBase}
              />
            </div>
          </section>

          <section className="space-y-4 pb-6 border-t border-border/60 pt-6">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Fecha y hora
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor={id(formIdPrefix, "date")} className="text-sm font-medium flex items-center gap-2">
                  <CalendarDays className="size-3.5 text-muted-foreground" />
                  Fecha
                </Label>
                <Input
                  id={id(formIdPrefix, "date")}
                  type="date"
                  value={formData.date}
                  min={isEditing ? undefined : today}
                  onChange={(e) => handleChange("date", e.target.value)}
                  required
                  className="h-10 rounded-lg border-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={id(formIdPrefix, "time")} className="text-sm font-medium flex items-center gap-2">
                  <Clock className="size-3.5 text-muted-foreground" />
                  Hora
                </Label>
                <Input
                  id={id(formIdPrefix, "time")}
                  type="time"
                  value={formData.time}
                  onChange={(e) => handleChange("time", e.target.value)}
                  required
                  className="h-10 rounded-lg border-input"
                />
              </div>
            </div>
          </section>

          {isEditing && (
            <section className="space-y-4 pb-2 border-t border-border/60 pt-6">
              <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Estado del evento
              </h3>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isCancelled ?? false}
                  onChange={(e) => handleChange("isCancelled", e.target.checked)}
                  className="rounded border-input size-4"
                />
                <span className="text-sm font-medium">Evento cancelado</span>
              </label>
            </section>
          )}

          <section className="space-y-4 pb-2 border-t border-border/60 pt-6">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Ubicación e imágenes
            </h3>
            <div className="space-y-2">
              <Label htmlFor={id(formIdPrefix, "location")} className="text-sm font-medium flex items-center gap-2">
                <MapPin className="size-3.5 text-muted-foreground" />
                Ubicación
              </Label>
              <input
                id={id(formIdPrefix, "location")}
                type="text"
                placeholder="Ej: Sala de conferencias, dirección..."
                value={formData.location}
                onChange={(e) => handleChange("location", e.target.value)}
                className={cn(inputBase, "h-10 rounded-lg border-input")}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <ImageIcon className="size-3.5 text-muted-foreground" />
                Imágenes del evento
              </Label>
              <EventImagesField
                images={formData.images}
                onChange={(images) => setFormData((prev) => ({ ...prev, images }))}
              />
            </div>
          </section>

          <div className="flex flex-col gap-3 pt-6">
            <Button
              type="submit"
              className="w-full h-11 rounded-lg font-medium shadow-sm"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin shrink-0" />
                  Guardando...
                </>
              ) : isEditing ? (
                <>
                  <Check className="size-4 shrink-0" />
                  Actualizar evento
                </>
              ) : (
                <>
                  <Plus className="size-4 shrink-0" />
                  Crear evento
                </>
              )}
            </Button>
            {isEditing && (
              <Button
                type="button"
                variant="outline"
                className="w-full h-10 rounded-lg"
                onClick={handleReset}
              >
                Cancelar
              </Button>
            )}
          </div>
        </>
      )}

      {!isInline && (
        <>
          <div className="space-y-4">
            {error && (
              <p className="text-sm text-destructive bg-destructive/10 p-2 rounded">{error}</p>
            )}
            <div className="space-y-2">
              <Label htmlFor={id(formIdPrefix, "title")}>Título del evento</Label>
              <Input
                id={id(formIdPrefix, "title")}
                placeholder="Ej: Conferencia de Tecnología"
                value={formData.title}
                onChange={(e) => handleChange("title", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={id(formIdPrefix, "description")}>Descripción</Label>
              <textarea
                id={id(formIdPrefix, "description")}
                placeholder="Breve descripción del evento"
                value={formData.description}
                onChange={(e) => handleChange("description", e.target.value)}
                rows={5}
                className={textareaBase}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor={id(formIdPrefix, "date")}>Fecha</Label>
                <Input
                  id={id(formIdPrefix, "date")}
                  type="date"
                  value={formData.date}
                  min={isEditing ? undefined : today}
                  onChange={(e) => handleChange("date", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={id(formIdPrefix, "time")}>Hora</Label>
                <Input
                  id={id(formIdPrefix, "time")}
                  type="time"
                  value={formData.time}
                  onChange={(e) => handleChange("time", e.target.value)}
                  required
                />
              </div>
            </div>
            {isEditing && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Estado del evento</Label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isCancelled ?? false}
                    onChange={(e) => handleChange("isCancelled", e.target.checked)}
                    className="rounded border-input size-4"
                  />
                  <span>Evento cancelado</span>
                </label>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor={id(formIdPrefix, "location")}>Ubicación</Label>
              <input
                id={id(formIdPrefix, "location")}
                type="text"
                placeholder="Ej: Sala de conferencias, dirección..."
                value={formData.location}
                onChange={(e) => handleChange("location", e.target.value)}
                className={cn(inputBase, "rounded-md")}
              />
            </div>
            <div className="space-y-2">
              <Label>Imágenes del evento</Label>
              <EventImagesField
                images={formData.images}
                onChange={(images) => setFormData((prev) => ({ ...prev, images }))}
              />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 mt-6">
            <Button type="submit" className="flex-1 w-full sm:w-auto min-h-10" disabled={loading}>
              {loading ? "Guardando..." : isEditing ? "Actualizar" : "Crear evento"}
            </Button>
            {isEditing && (
              <Button type="button" variant="outline" className="w-full sm:w-auto min-h-10" onClick={handleReset}>
                Cancelar
              </Button>
            )}
          </div>
        </>
      )}
    </form>
  );

  if (isInline) {
    return formContent;
  }

  return (
    <Card className="lg:col-span-1">
      <CardHeader>
        <CardTitle>{isEditing ? "Editar evento" : "Registrar evento"}</CardTitle>
        <CardDescription>
          {isEditing
            ? "Modifica los datos del evento"
            : "Completa el formulario para crear un nuevo evento"}
        </CardDescription>
      </CardHeader>
      <CardContent>{formContent}</CardContent>
    </Card>
  );
}
