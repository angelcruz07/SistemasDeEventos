"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { EventWithImages as Event } from "../interfaces/event.interface";
import { X, QrCode, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface QrCodeModalProps {
  open: boolean;
  event: Event | null;
  onClose: () => void;
}

export function QrCodeModal({ open, event, onClose }: QrCodeModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !event?.slug) {
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    const baseUrl =
      typeof window !== "undefined"
        ? window.location.origin
        : "";
    const eventUrl = `${baseUrl}/event/${event.slug}`;

    import("qrcode")
      .then((QRCode) =>
        QRCode.default.toDataURL(eventUrl, {
          width: 280,
          margin: 2,
          color: { dark: "#0a0a0a", light: "#ffffff" },
        })
      )
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open, event?.slug]);

  if (!open || !event) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-modal-title"
      onClick={onClose}
    >
      <div
        className={cn(
          "bg-card text-card-foreground w-full flex flex-col overflow-hidden",
          "max-h-[90vh] sm:max-h-[88vh]",
          "rounded-t-2xl sm:rounded-2xl border border-b-0 sm:border shadow-2xl sm:shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]",
          "sm:max-w-[400px] sm:border-border/80",
          "pb-[env(safe-area-inset-bottom,0px)]",
          "animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 flex items-center justify-between gap-4 px-5 sm:px-8 pt-6 pb-5 border-b border-border/60 bg-muted/30">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <QrCode className="size-5" />
            </div>
            <div className="min-w-0">
              <h2
                id="qr-modal-title"
                className="font-semibold text-lg text-foreground truncate"
              >
                Código QR
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 truncate">
                {event.title}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-background/80"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X className="size-5" />
          </Button>
        </div>
        <div className="overflow-y-auto overscroll-contain flex-1 px-5 sm:px-8 py-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            Escanea el código para abrir la página del evento en otro dispositivo.
          </p>
          <div className="bg-white p-3 rounded-lg w-full max-w-[280px] mx-auto flex justify-center">
            {qrDataUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={qrDataUrl}
                alt={`Código QR para ${event.title}`}
                width={256}
                height={256}
                className="w-full aspect-square max-w-[256px]"
              />
            ) : (
              <div className="aspect-square w-[256px] flex items-center justify-center text-muted-foreground text-sm">
                Generando código…
              </div>
            )}
          </div>
          <Button className="w-full" asChild>
            <Link
              href={`/event/${event.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2"
            >
              <ExternalLink className="size-4 shrink-0" />
              Abrir página del evento
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
