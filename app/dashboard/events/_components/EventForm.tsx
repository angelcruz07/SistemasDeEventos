"use client";

import { useState, useEffect, useRef } from "react";
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

interface FormData {
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  imageUrl: string;
  isCancelled?: boolean;
}

const emptyForm: FormData = {
  title: "",
  description: "",
  date: "",
  time: "",
  location: "",
  imageUrl: "",
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
    imageUrl: event.imageUrl ?? "",
    isCancelled: eventWithCancelled.isCancelled ?? false,
  };
}

const id = (prefix: string, name: string) => (prefix ? `${prefix}-${name}` : name);

const UPLOAD_ENDPOINT = "/api/upload/cloudinary";

export function EventForm({ event, onSuccess, onCancel, variant = "card", formIdPrefix = "" }: EventFormProps) {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>(() =>
    event ? eventToFormData(event) : { ...emptyForm }
  );
  const locationInputRef = useRef<HTMLInputElement>(null);
  const autocompleteInitialized = useRef(false);

  const isEditing = !!event;

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append("file", file);
      const res = await fetch(UPLOAD_ENDPOINT, {
        method: "POST",
        body: formDataUpload,
      });
      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error ?? "Error al subir la imagen");
        return;
      }
      if (data.url) {
        setFormData((prev) => ({ ...prev, imageUrl: data.url }));
      }
    } catch {
      setUploadError("Error de conexión al subir la imagen");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  // Sincronizar formulario cuando se selecciona otro evento para editar
  useEffect(() => {
    if (event) {
      setFormData(eventToFormData(event));
    } else {
      setFormData({ ...emptyForm });
    }
    setError(null);
  }, [event?.id]);

  // Inicializar Google Places Autocomplete en el campo ubicación cuando el script esté cargado
  useEffect(() => {
    if (autocompleteInitialized.current) return;
    let attempts = 0;
    const maxAttempts = 40; // ~12 s
    const id = setInterval(() => {
      attempts++;
      if (attempts > maxAttempts) {
        clearInterval(id);
        return;
      }
      if (!locationInputRef.current) return;
      const g = (window as unknown as { google?: { maps?: { places?: { Autocomplete: new (input: HTMLInputElement, opts?: { types?: string[]; language?: string }) => { addListener: (event: string, fn: () => void) => void; getPlace: () => { formatted_address?: string; name?: string } } } } } }).google;
      if (!g?.maps?.places) return;
      clearInterval(id);
      const input = locationInputRef.current;
      if (!input || autocompleteInitialized.current) return;
      const autocomplete = new g.maps.places.Autocomplete(input, {
        types: ["establishment", "geocode"],
        language: "es",
      });
      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        const address = place.formatted_address || place.name || "";
        if (address) setFormData((prev) => ({ ...prev, location: address }));
      });
      autocompleteInitialized.current = true;
    }, 300);
    return () => clearInterval(id);
  }, []);

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
    if (isEventDateInPast(dateValue, timeValue)) {
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
                  min={today}
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
              Ubicación e imagen
            </h3>
            <div className="space-y-2">
              <Label htmlFor={id(formIdPrefix, "location")} className="text-sm font-medium flex items-center gap-2">
                <MapPin className="size-3.5 text-muted-foreground" />
                Ubicación
              </Label>
              <input
                ref={locationInputRef}
                id={id(formIdPrefix, "location")}
                type="text"
                placeholder="Buscar dirección o lugar en Google Maps"
                value={formData.location}
                onChange={(e) => handleChange("location", e.target.value)}
                autoComplete="off"
                className={cn(inputBase, "h-10 rounded-lg border-input")}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <ImageIcon className="size-3.5 text-muted-foreground" />
                Imagen del evento
              </Label>
              <div className="flex flex-col gap-2">
                <div className="flex gap-2 flex-wrap items-center">
                  <label className="cursor-pointer inline-flex">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="sr-only"
                      disabled={uploading}
                      onChange={handleImageUpload}
                    />
                    <span className="inline-flex items-center justify-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium h-9 hover:bg-accent hover:text-accent-foreground">
                      {uploading ? (
                        <>
                          <Loader2 className="size-4 animate-spin shrink-0" />
                          Subiendo...
                        </>
                      ) : (
                        "Subir imagen"
                      )}
                    </span>
                  </label>
                  <span className="text-xs text-muted-foreground">JPEG, PNG, WebP o GIF. Máx. 5 MB</span>
                </div>
                {uploadError && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="size-3.5 shrink-0" />
                    {uploadError}
                  </p>
                )}
                {formData.imageUrl ? (
                  <div className="relative rounded-lg border border-border overflow-hidden bg-muted/30 w-full max-w-[280px] aspect-video">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={formData.imageUrl}
                      alt="Vista previa"
                      className="object-cover w-full h-full"
                    />
                  </div>
                ) : null}
              </div>
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
                  min={today}
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
                ref={locationInputRef}
                id={id(formIdPrefix, "location")}
                type="text"
                placeholder="Buscar dirección o lugar en Google Maps"
                value={formData.location}
                onChange={(e) => handleChange("location", e.target.value)}
                autoComplete="off"
                className={cn(inputBase, "rounded-md")}
              />
            </div>
            <div className="space-y-2">
              <Label>Imagen del evento</Label>
              <div className="space-y-2">
                <label className="inline-flex cursor-pointer">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="sr-only"
                    disabled={uploading}
                    onChange={handleImageUpload}
                  />
                  <span className="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground">
                    {uploading ? (
                      <>
                        <Loader2 className="size-4 animate-spin shrink-0" />
                        Subiendo...
                      </>
                    ) : (
                      "Subir imagen"
                    )}
                  </span>
                </label>
                {uploadError && (
                  <p className="text-sm text-destructive">{uploadError}</p>
                )}
                {formData.imageUrl && (
                  <div className="relative rounded border overflow-hidden max-w-[240px] aspect-video bg-muted/30">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={formData.imageUrl} alt="Vista previa" className="object-cover w-full h-full" />
                  </div>
                )}
              </div>
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
