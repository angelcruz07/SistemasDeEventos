"use client";

import { Button } from "@/components/ui/button";
import { EventForm } from "./EventForm";
import { X, CalendarPlus } from "lucide-react";
import { cn } from "@/lib/utils";

interface CreateEventModalProps {
  open: boolean;
  onSuccess: () => void;
  onClose: () => void;
}

export function CreateEventModal({
  open,
  onSuccess,
  onClose,
}: CreateEventModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-event-modal-title"
      onClick={onClose}
    >
      <div
        className={cn(
          "bg-card text-card-foreground w-full flex flex-col overflow-hidden",
          "max-h-[90vh] sm:max-h-[88vh]",
          "rounded-t-2xl sm:rounded-2xl border border-b-0 sm:border shadow-2xl sm:shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]",
          "sm:max-w-[480px] sm:border-border/80",
          "pb-[env(safe-area-inset-bottom,0px)]",
          "animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 flex items-center justify-between gap-4 px-5 sm:px-8 pt-6 pb-5 border-b border-border/60 bg-muted/30">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CalendarPlus className="size-5" />
            </div>
            <div className="min-w-0">
              <h2 id="create-event-modal-title" className="font-semibold text-lg text-foreground truncate">
                Crear evento
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Completa los datos para publicar tu evento
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
        <div className="overflow-y-auto overscroll-contain flex-1 px-5 sm:px-8 py-6">
          <EventForm
            event={null}
            onSuccess={onSuccess}
            onCancel={onClose}
            variant="inline"
            formIdPrefix="create-modal"
          />
        </div>
      </div>
    </div>
  );
}
