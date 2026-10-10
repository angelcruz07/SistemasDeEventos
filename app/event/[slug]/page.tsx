import { notFound } from "next/navigation";
import { Calendar, Clock, MapPin, Users } from "lucide-react";
import { getEventBySlug } from "@/app/dashboard/events/_actions/event.actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatEventDate } from "@/lib/datetime";
import { formatMxn } from "@/lib/ticketing/money";
import { RegistrationForm } from "./_components/RegistrationForm";
import { ImageCarousel } from "./_components/ImageCarousel";
import { ShareEventButton } from "./_components/ShareEventButton";

const CLOSED_MESSAGES = {
  closed: "Las inscripciones para este evento están cerradas.",
  full: "Este evento ya no tiene lugares disponibles.",
} as const;

export default async function EventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const result = await getEventBySlug(slug);

  if (!result.success || !result.data) {
    notFound();
  }

  const event = result.data;
  const priceLabel = event.priceCents > 0 ? formatMxn(event.priceCents) : "Gratis";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-4xl">
        <div className="grid gap-6 sm:gap-8 grid-cols-1 md:grid-cols-[1fr,minmax(260px,320px)]">
          <div className="space-y-4 sm:space-y-6 min-w-0">
            <ImageCarousel images={event.images} alt={event.title} />

            <Card>
              <CardHeader className="px-4 sm:px-6">
                <CardTitle className="text-xl sm:text-2xl break-words">{event.title}</CardTitle>
                <CardDescription className="text-sm sm:text-base break-words">
                  {event.description || "Sin descripción"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4 px-4 sm:px-6">
                <div className="flex items-center gap-3 text-muted-foreground min-w-0">
                  <Calendar className="size-4 sm:size-5 shrink-0" />
                  <span className="break-words">{formatEventDate(event.date)}</span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground min-w-0">
                  <Clock className="size-4 sm:size-5 shrink-0" />
                  <span className="break-words">{event.time}</span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground min-w-0">
                  <MapPin className="size-4 sm:size-5 shrink-0" />
                  <span className="break-words">{event.location || "Sin ubicación"}</span>
                </div>
                {event.displayCapacity ? (
                  <div className="flex items-center gap-3 text-muted-foreground min-w-0">
                    <Users className="size-4 sm:size-5 shrink-0" />
                    <span>{event.displayCapacity} lugares</span>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="p-4 sm:p-5">
              <h2 className="font-semibold mb-3">Registro</h2>
              {event.availability === "open" ? (
                <RegistrationForm slug={event.slug} schema={event.formSchema} priceLabel={priceLabel} />
              ) : (
                <div className="space-y-2">
                  <p className="text-lg font-semibold">{priceLabel}</p>
                  <p role="status" className="text-sm text-muted-foreground">
                    {CLOSED_MESSAGES[event.availability]}
                  </p>
                </div>
              )}
            </Card>
            <ShareEventButton title={event.title} />
          </div>
        </div>
      </main>
    </div>
  );
}
