"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { getAttendancesForEvent, type AttendanceForEvent } from "../_actions/event.actions";
import type { Event } from "@/app/generated/prisma/client";
import { X, Users, Loader2, Mail, User, UsersRound } from "lucide-react";
import { cn } from "@/lib/utils";

interface EventAttendeesModalProps {
  open: boolean;
  event: Event | null;
  onClose: () => void;
}

export function EventAttendeesModal({
  open,
  event,
  onClose,
}: EventAttendeesModalProps) {
  const [attendances, setAttendances] = useState<AttendanceForEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !event) {
      setAttendances([]);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    getAttendancesForEvent(event.id).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (result.success && result.data) {
        setAttendances(result.data.attendances);
      } else {
        setError(result.error ?? "Error al cargar asistentes");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, event?.id]);

  if (!open || !event) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="attendees-modal-title"
      onClick={onClose}
    >
      <div
        className={cn(
          "bg-card text-card-foreground w-full flex flex-col overflow-hidden",
          "max-h-[90vh] sm:max-h-[85vh]",
          "rounded-t-2xl sm:rounded-2xl border border-b-0 sm:border shadow-2xl sm:shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]",
          "sm:max-w-[560px] sm:border-border/80",
          "pb-[env(safe-area-inset-bottom,0px)]",
          "animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 flex items-center justify-between gap-4 px-5 sm:px-6 pt-6 pb-4 border-b border-border/60 bg-muted/30">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Users className="size-5" />
            </div>
            <div className="min-w-0">
              <h2 id="attendees-modal-title" className="font-semibold text-lg text-foreground truncate">
                Asistentes al evento
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

        <div className="overflow-y-auto flex-1 px-5 sm:px-6 py-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
              <Loader2 className="size-8 animate-spin" />
              <p className="text-sm">Cargando asistentes...</p>
            </div>
          ) : error ? (
            <p className="text-sm text-destructive py-4">{error}</p>
          ) : attendances.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
              <Users className="size-12 opacity-50" />
              <p className="text-sm font-medium">Aún no hay asistentes</p>
              <p className="text-xs">Las confirmaciones aparecerán aquí cuando alguien se registre.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {attendances.length} {attendances.length === 1 ? "persona" : "personas"} registrada{attendances.length === 1 ? "" : "s"}
              </p>
              <ul className="space-y-2">
                {attendances.map((a) => (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border/80 bg-muted/20 p-3 text-sm"
                  >
                    <span className="flex items-center gap-2 min-w-0 font-medium">
                      <User className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{a.guestName}</span>
                    </span>
                    <span className="flex items-center gap-2 min-w-0 text-muted-foreground">
                      <Mail className="size-4 shrink-0" />
                      <span className="truncate">{a.guestEmail}</span>
                    </span>
                    <span className="flex items-center gap-2 shrink-0">
                      <UsersRound className="size-4 text-muted-foreground" />
                      <span>{a.numberOfGuests} {a.numberOfGuests === 1 ? "asistente" : "asistentes"}</span>
                    </span>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                        a.responseType === "maybe"
                          ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                          : a.responseType === "declined"
                            ? "bg-muted text-muted-foreground"
                            : "bg-green-500/15 text-green-700 dark:text-green-400"
                      )}
                    >
                      {a.responseType === "maybe" ? "Tal vez asista" : a.responseType === "declined" ? "No asistiré" : "Asistiré"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
