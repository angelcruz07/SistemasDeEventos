"use client";

import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Clock, Pencil, Trash2, QrCode } from "lucide-react";
import Image from "next/image";
import type { Event } from "@/app/generated/prisma/client";

interface EventCardProps {
  event: Event;
  onEdit: (event: Event) => void;
  onDelete: (event: Event) => void;
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function EventCard({ event, onEdit, onDelete }: EventCardProps) {
  const imageUrl = event.imageUrl?.trim();
  const hasValidImage = imageUrl && (imageUrl.startsWith("http://") || imageUrl.startsWith("https://"));

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-md flex flex-col min-w-0">
      <div className="aspect-video bg-muted flex items-center justify-center overflow-hidden shrink-0">
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
      </div>
      <CardHeader className="pb-2 px-4 sm:px-6 pt-3 sm:pt-4">
        <CardTitle className="text-sm sm:text-base line-clamp-2">{event.title}</CardTitle>
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
      <CardFooter className="flex flex-col sm:flex-row flex-wrap gap-2 px-4 sm:px-6 pb-4">
        <Button variant="outline" size="sm" className="w-full sm:w-auto min-h-9" asChild>
          <Link href={`/event/${event.slug}`} className="inline-flex items-center justify-center">
            <QrCode className="size-4 mr-1 shrink-0" />
            <span className="truncate">Ver página / QR</span>
          </Link>
        </Button>
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
