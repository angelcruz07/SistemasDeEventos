"use client";

import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Clock, Pencil, Trash2, QrCode, Users } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import type { Event } from "@/app/generated/prisma/client";

interface EventCardProps {
  event: Event;
  onEdit: (event: Event) => void;
  onDelete: (event: Event) => void;
  onViewAttendees?: (event: Event) => void;
  onShowQr?: (event: Event) => void;
}

type EventStatus = "cancelado" | "finalizado" | "próximo";

/** Obtiene la fecha/hora del evento combinando date y time (formato "HH:mm"). */
function getEventDateTime(event: Event): Date | null {
  const d = new Date(event.date);
  const timeStr = (event.time ?? "").trim();
  if (!timeStr) return d;
  const parts = timeStr.split(":").map(Number);
  if (parts.length < 2 || parts.some(Number.isNaN)) return d;
  const [hours, minutes] = parts;
  const combined = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hours, minutes ?? 0, 0, 0);
  return Number.isNaN(combined.getTime()) ? d : combined;
}

function getEventStatus(event: Event): EventStatus {
  const eventWithCancelled = event as Event & { isCancelled?: boolean };
  if (eventWithCancelled.isCancelled === true) return "cancelado";
  const eventDt = getEventDateTime(event);
  if (!eventDt) return "próximo";
  return eventDt.getTime() < Date.now() ? "finalizado" : "próximo";
}

const statusConfig: Record<
  EventStatus,
  { label: string; className: string }
> = {
  cancelado: {
    label: "Cancelado",
    className: "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300",
  },
  finalizado: {
    label: "Finalizado",
    className: "bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  },
  próximo: {
    label: "Próximo",
    className: "bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300",
  },
};

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function EventCard({ event, onEdit, onDelete, onViewAttendees, onShowQr }: EventCardProps) {
  const imageUrl = event.imageUrl?.trim();
  const hasValidImage = imageUrl && (imageUrl.startsWith("http://") || imageUrl.startsWith("https://"));
  const status = getEventStatus(event);
  const { label: statusLabel, className: statusClassName } = statusConfig[status];

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-md flex flex-col min-w-0 group">
      <Link
        href={`/event/${event.slug}`}
        className="flex flex-col flex-1 min-w-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-t-lg"
        aria-label={`Ir a la página de ${event.title}`}
      >
        <div className="relative aspect-video bg-muted flex items-center justify-center overflow-hidden shrink-0">
          {hasValidImage ? (
            <Image
              src={imageUrl}
              alt={event.title}
              width={400}
              height={225}
              className="object-cover w-full h-full"
            />
          ) : (
            <Calendar className="size-10 sm:size-12 text-muted-foreground/50" />
          )}
          <span
            className={cn(
              "absolute top-2 right-2 rounded-full px-2.5 py-0.5 text-xs font-medium shadow-sm",
              statusClassName
            )}
          >
            {statusLabel}
          </span>
        </div>
        <CardHeader className="pb-2 px-4 sm:px-6 pt-3 sm:pt-4">
          <CardTitle className="text-sm sm:text-base line-clamp-2 group-hover:text-primary transition-colors">{event.title}</CardTitle>
          <CardDescription className="line-clamp-2 text-xs sm:text-sm">{event.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm px-4 sm:px-6">
          <div className="flex items-center gap-2 text-muted-foreground min-w-0">
            <Calendar className="size-3.5 sm:size-4 shrink-0" />
            <span className="truncate">{formatDate(event.date)}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground min-w-0">
            <Clock className="size-3.5 sm:size-4 shrink-0" />
            <span className="truncate">{event.time}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground min-w-0">
            <MapPin className="size-3.5 sm:size-4 shrink-0" />
            <span className="truncate">{event.location}</span>
          </div>
        </CardContent>
      </Link>
      <CardFooter className="flex flex-col sm:flex-row flex-wrap gap-2 px-4 sm:px-6 pb-4">
        {onShowQr && (
          <Button
            variant="outline"
            size="sm"
            className="w-full sm:w-auto min-h-9"
            onClick={(e) => {
              e.preventDefault();
              onShowQr(event);
            }}
            title="Ver código QR"
            aria-label="Ver código QR"
          >
            <QrCode className="size-4 sm:mr-1.5 shrink-0" />
            <span className="truncate hidden sm:inline">Ver QR</span>
          </Button>
        )}
        {onViewAttendees && (
          <Button variant="outline" size="sm" className="w-full sm:w-auto min-h-9 shrink-0" onClick={() => onViewAttendees(event)}>
            <Users className="size-4 mr-1 shrink-0" />
            Ver asistentes
          </Button>
        )}
        <Button variant="outline" size="sm" className="w-full sm:w-auto min-h-9 shrink-0" onClick={() => onEdit(event)}>
          <Pencil className="size-4 mr-1 shrink-0" />
          Editar
        </Button>
        <Button variant="destructive" size="sm" className="w-full sm:w-auto min-h-9 shrink-0" onClick={() => onDelete(event)}>
          <Trash2 className="size-4 mr-1 shrink-0" />
          Eliminar
        </Button>
      </CardFooter>
    </Card>
  );
}
