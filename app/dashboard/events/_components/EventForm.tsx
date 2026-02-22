"use client";

import { useState, useEffect } from "react";
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
import { createEvent, updateEvent, type CreateEventInput } from "../_actions/event.actions";
import type { Event } from "@/app/generated/prisma/client";
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

const emptyForm: CreateEventInput = {
  title: "",
  description: "",
  date: "",
  time: "",
  location: "",
  imageUrl: "",
  createdBy: "Usuario Demo",
};

function eventToFormData(event: Event): CreateEventInput {
  const d = new Date(event.date);
  const dateStr = d.toISOString().split("T")[0];
  return {
    title: event.title,
    description: event.description,
    date: dateStr,
    time: event.time,
    location: event.location,
    imageUrl: event.imageUrl ?? "",
    createdBy: event.createdBy,
  };
}

const id = (prefix: string, name: string) => (prefix ? `${prefix}-${name}` : name);

export function EventForm({ event, onSuccess, onCancel, variant = "card", formIdPrefix = "" }: EventFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<CreateEventInput>(() =>
    event ? eventToFormData(event) : { ...emptyForm }
  );

  const isEditing = !!event;

  // Sincronizar formulario cuando se selecciona otro evento para editar
  useEffect(() => {
    if (event) {
      setFormData(eventToFormData(event));
    } else {
      setFormData({ ...emptyForm });
    }
    setError(null);
  }, [event?.id]);

  const handleChange = (field: keyof CreateEventInput, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!formData.title.trim()) {
      setError("El título es obligatorio");
      setLoading(false);
      return;
    }
    if (!formData.date || !formData.time) {
      setError("La fecha y hora son obligatorias");
      setLoading(false);
      return;
    }

    const result = isEditing
      ? await updateEvent({ ...formData, id: event.id })
      : await createEvent(formData);

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

          <section className="space-y-4 pb-2 border-t border-border/60 pt-6">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Ubicación e imagen
            </h3>
            <div className="space-y-2">
              <Label htmlFor={id(formIdPrefix, "location")} className="text-sm font-medium flex items-center gap-2">
                <MapPin className="size-3.5 text-muted-foreground" />
                Ubicación
              </Label>
              <Input
                id={id(formIdPrefix, "location")}
                placeholder="Lugar del evento"
                value={formData.location}
                onChange={(e) => handleChange("location", e.target.value)}
                className="h-10 rounded-lg border-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={id(formIdPrefix, "imageUrl")} className="text-sm font-medium flex items-center gap-2">
                <ImageIcon className="size-3.5 text-muted-foreground" />
                URL de imagen
              </Label>
              <Input
                id={id(formIdPrefix, "imageUrl")}
                type="url"
                placeholder="https://ejemplo.com/imagen.jpg"
                value={formData.imageUrl}
                onChange={(e) => handleChange("imageUrl", e.target.value)}
                className="h-10 rounded-lg border-input font-mono text-sm"
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
              <Input
                id={id(formIdPrefix, "description")}
                placeholder="Breve descripción del evento"
                value={formData.description}
                onChange={(e) => handleChange("description", e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor={id(formIdPrefix, "date")}>Fecha</Label>
                <Input
                  id={id(formIdPrefix, "date")}
                  type="date"
                  value={formData.date}
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
            <div className="space-y-2">
              <Label htmlFor={id(formIdPrefix, "location")}>Ubicación</Label>
              <Input
                id={id(formIdPrefix, "location")}
                placeholder="Lugar del evento"
                value={formData.location}
                onChange={(e) => handleChange("location", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={id(formIdPrefix, "imageUrl")}>URL de imagen</Label>
              <Input
                id={id(formIdPrefix, "imageUrl")}
                placeholder="https://..."
                value={formData.imageUrl}
                onChange={(e) => handleChange("imageUrl", e.target.value)}
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
