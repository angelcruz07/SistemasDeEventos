"use client";

import { useState } from "react";
import { AlertCircle, ArrowDown, ArrowUp, Loader2, X } from "lucide-react";
import { moveItem } from "@/lib/ticketing/form-builder";
import { MAX_EVENT_IMAGES } from "@/lib/ticketing/event-images";

const UPLOAD_ENDPOINT = "/api/upload/cloudinary";

interface EventImagesFieldProps {
  images: string[];
  onChange: (images: string[]) => void;
}

async function uploadOne(file: File): Promise<string> {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch(UPLOAD_ENDPOINT, { method: "POST", body });
  const data = await res.json();
  if (!res.ok || !data.url) throw new Error(data.error ?? "Error al subir la imagen");
  return data.url as string;
}

export function EventImagesField({ images, onChange }: EventImagesFieldProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setError(null);
    setUploading(true);
    const room = MAX_EVENT_IMAGES - images.length;
    if (files.length > room) setError(`Máximo ${MAX_EVENT_IMAGES} imágenes por evento.`);
    const uploaded: string[] = [];
    try {
      // One request per file, sequentially, to keep the upload route's limits simple.
      for (const file of files.slice(0, Math.max(room, 0))) {
        uploaded.push(await uploadOne(file));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de conexión al subir la imagen");
    } finally {
      if (uploaded.length > 0) onChange([...images, ...uploaded]);
      setUploading(false);
    }
  };

  const iconButton =
    "inline-flex size-7 items-center justify-center rounded-md border border-input bg-background text-foreground hover:bg-accent disabled:opacity-40";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex cursor-pointer">
          <input
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            disabled={uploading || images.length >= MAX_EVENT_IMAGES}
            onChange={handleFiles}
          />
          <span className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground">
            {uploading ? (
              <>
                <Loader2 className="size-4 shrink-0 animate-spin" />
                Subiendo...
              </>
            ) : (
              "Subir imágenes"
            )}
          </span>
        </label>
        <span className="text-xs text-muted-foreground">
          JPEG, PNG, WebP o GIF. Máx. 4 MB c/u, hasta {MAX_EVENT_IMAGES}. La primera es la portada.
        </span>
      </div>
      {error && (
        <p className="flex items-center gap-1 text-xs text-destructive">
          <AlertCircle className="size-3.5 shrink-0" />
          {error}
        </p>
      )}
      {images.length > 0 && (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {images.map((url, i) => (
            <li key={url} className="space-y-1">
              <div className="relative aspect-video overflow-hidden rounded-lg border border-border bg-muted/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Imagen ${i + 1}`} className="h-full w-full object-cover" />
                {i === 0 && (
                  <span className="absolute left-1 top-1 rounded bg-background/90 px-1.5 py-0.5 text-[10px] font-medium text-foreground">
                    Portada
                  </span>
                )}
              </div>
              <div className="flex gap-1">
                <button type="button" className={iconButton} aria-label={`Mover imagen ${i + 1} antes`} disabled={i === 0} onClick={() => onChange(moveItem(images, i, i - 1))}>
                  <ArrowUp className="size-3.5" />
                </button>
                <button type="button" className={iconButton} aria-label={`Mover imagen ${i + 1} después`} disabled={i === images.length - 1} onClick={() => onChange(moveItem(images, i, i + 1))}>
                  <ArrowDown className="size-3.5" />
                </button>
                <button type="button" className={iconButton} aria-label={`Quitar imagen ${i + 1}`} onClick={() => onChange(images.filter((_, j) => j !== i))}>
                  <X className="size-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
