"use client";

import { useState } from "react";
import { AlertCircle, Check, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TicketCard } from "@/app/ticket/[token]/_components/TicketCard";
import {
  FOOTER_MAX,
  TEMPLATE_PRESETS,
  TICKET_TEMPLATES,
  hasLowContrast,
  type TicketDesign,
  type TicketTemplate,
} from "@/lib/ticketing/ticket-design";
import { updateTicketDesign } from "../_actions/design.actions";

const UPLOAD_ENDPOINT = "/api/upload/cloudinary";
const TEMPLATE_LABELS: Record<TicketTemplate, string> = { minimal: "Minimalista", dark: "Oscuro", image: "Con imagen" };
const HEX = /^#[0-9a-fA-F]{6}$/;
const flyerLinkClass =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-md border bg-background px-3 text-sm font-medium shadow-xs";

function ColorField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} (selector)`}
          value={HEX.test(value) ? value : "#000000"}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-10 w-12 shrink-0 cursor-pointer rounded border bg-transparent p-1"
        />
        <Input id={id} value={value} maxLength={7} onChange={(e) => onChange(e.target.value)} className="font-mono" />
      </div>
      {!HEX.test(value) && <p className="text-sm text-destructive">Usa el formato #RRGGBB.</p>}
    </div>
  );
}

function ImageField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (url: string | null) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(UPLOAD_ENDPOINT, { method: "POST", body });
      const data = await res.json();
      if (!res.ok || !data.url) setError(data.error ?? "Error al subir la imagen");
      else onChange(data.url);
    } catch {
      setError("Error de conexión al subir la imagen");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex flex-wrap items-center gap-2">
        <Input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleFile} disabled={uploading} />
        {uploading && <Loader2 className="size-4 animate-spin" />}
        {value && (
          <Button type="button" variant="outline" size="sm" onClick={() => onChange(null)}>
            Quitar
          </Button>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

export function DesignEditor({
  eventId,
  eventTitle,
  slug,
  initial,
}: {
  eventId: string;
  eventTitle: string;
  slug: string;
  initial: TicketDesign;
}) {
  const [design, setDesign] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Bumped on save so the flyer preview (cached for minutes) reloads with the new design.
  const [flyerVersion, setFlyerVersion] = useState(0);

  const flyerPath = `/api/events/${encodeURIComponent(slug)}/flyer`;

  const set = <K extends keyof TicketDesign>(key: K, value: TicketDesign[K]) => {
    setDesign((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const pickTemplate = (template: TicketTemplate) => {
    setDesign((prev) => ({ ...prev, template, ...TEMPLATE_PRESETS[template] }));
    setSaved(false);
  };

  // Preview falls back to a safe value while a color is mid-edit.
  const preview: TicketDesign = {
    ...design,
    backgroundColor: HEX.test(design.backgroundColor) ? design.backgroundColor : "#FFFFFF",
    textColor: HEX.test(design.textColor) ? design.textColor : "#111111",
    accentColor: HEX.test(design.accentColor) ? design.accentColor : "#2563EB",
  };
  const lowContrast = hasLowContrast(preview.textColor, preview.backgroundColor);
  const colorsValid = [design.backgroundColor, design.textColor, design.accentColor].every((c) => HEX.test(c));

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const result = await updateTicketDesign(eventId, design);
    setSaving(false);
    if (result.success) {
      setSaved(true);
      setFlyerVersion((v) => v + 1);
    }
    else setError(result.error);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Diseño del evento</CardTitle>
          <CardDescription>
            Estos colores, logo e imagen se aplican a la página del evento, al boleto y al PDF que descargan tus asistentes.{" "}
            <a
              href={`/event/${encodeURIComponent(slug)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline underline-offset-4"
            >
              Ver página del evento
            </a>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Plantilla</legend>
            <div className="grid grid-cols-3 gap-2">
              {TICKET_TEMPLATES.map((t) => (
                <Button
                  key={t}
                  type="button"
                  variant={design.template === t ? "default" : "outline"}
                  aria-pressed={design.template === t}
                  className="min-h-10"
                  onClick={() => pickTemplate(t)}
                >
                  {TEMPLATE_LABELS[t]}
                </Button>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            <ColorField id="bg" label="Fondo" value={design.backgroundColor} onChange={(v) => set("backgroundColor", v)} />
            <ColorField id="text" label="Texto" value={design.textColor} onChange={(v) => set("textColor", v)} />
            <ColorField id="accent" label="Acento" value={design.accentColor} onChange={(v) => set("accentColor", v)} />
          </div>
          {lowContrast && (
            <p role="alert" className="flex items-start gap-2 text-sm text-amber-700">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              El contraste entre el texto y el fondo es bajo; podría ser difícil de leer. Puedes guardar de todos modos.
            </p>
          )}

          <ImageField label="Logo" value={design.logoUrl} onChange={(u) => set("logoUrl", u)} />
          {design.template === "image" && (
            <ImageField label="Imagen de encabezado" value={design.headerImageUrl} onChange={(u) => set("headerImageUrl", u)} />
          )}

          <div className="space-y-1.5">
            <Label htmlFor="footer">
              Texto al pie ({design.footerText.length}/{FOOTER_MAX})
            </Label>
            <Input
              id="footer"
              value={design.footerText}
              maxLength={FOOTER_MAX}
              onChange={(e) => set("footerText", e.target.value)}
            />
          </div>

          {error && (
            <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="size-4" /> {error}
            </p>
          )}
          <Button type="button" className="min-h-10 w-full sm:w-auto" onClick={handleSave} disabled={saving || !colorsValid}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : saved ? <Check className="size-4" /> : null}
            {saved ? "Guardado" : "Guardar diseño"}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">Vista previa</h2>
        <div className="mx-auto max-w-sm">
          <TicketCard
            design={preview}
            eventTitle={eventTitle}
            attendeeName="Nombre del asistente"
            code="ABCD-1234"
            checkedIn={false}
          />
        </div>

        <Card className="mx-auto max-w-sm">
          <CardHeader>
            <CardTitle>Flyer</CardTitle>
            <CardDescription>
              Imagen lista para publicar en redes, con el código QR de tu página del evento. Refleja el diseño guardado.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- dynamic same-origin PNG generated on demand */}
            <img
              src={`${flyerPath}?v=${flyerVersion}`}
              alt="Vista previa del flyer del evento"
              className="mx-auto w-full max-w-[280px] rounded-md border"
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <a href={`${flyerPath}?download=1`} download className={flyerLinkClass}>
                <Download className="size-4" /> Descargar flyer (post)
              </a>
              <a href={`${flyerPath}?format=story&download=1`} download className={flyerLinkClass}>
                <Download className="size-4" /> Descargar historia
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
