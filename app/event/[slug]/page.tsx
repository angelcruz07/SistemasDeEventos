/* eslint-disable @next/next/no-img-element -- logo comes from the Cloudinary CDN (sanitized) and has unknown dimensions */
import Image from "next/image";
import { notFound } from "next/navigation";
import { Calendar, Clock, MapPin, Users } from "lucide-react";
import { getEventBySlug } from "@/app/dashboard/events/_actions/event.actions";
import { Card } from "@/components/ui/card";
import { formatEventDate } from "@/lib/datetime";
import { deriveEventTheme, normalizeMultiline } from "@/lib/ticketing/event-theme";
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
  const { design } = event;
  const theme = deriveEventTheme(design);
  const priceLabel = event.priceCents > 0 ? formatMxn(event.priceCents) : "Gratis";
  const description = normalizeMultiline(event.description ?? "");
  // The "image" template promotes its header image to a hero only when there is no gallery.
  const heroImage = design.template === "image" && event.images.length === 0 ? design.headerImageUrl : null;

  const title = (
    <h1
      className="text-xl sm:text-3xl font-bold break-words"
      style={heroImage ? { color: "#FFFFFF" } : { color: theme.text }}
    >
      {event.title}
    </h1>
  );

  return (
    <div className="min-h-screen" style={{ backgroundColor: theme.background, color: theme.text }}>
      <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-4xl">
        <div className="grid gap-6 sm:gap-8 grid-cols-1 md:grid-cols-[1fr,minmax(260px,320px)]">
          <div className="space-y-4 sm:space-y-6 min-w-0">
            {heroImage ? (
              <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
                <Image src={heroImage} alt="" fill priority sizes="(min-width: 768px) 560px, 100vw" className="object-cover" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent px-4 pb-4 pt-16 sm:px-6">
                  {title}
                </div>
              </div>
            ) : (
              <ImageCarousel images={event.images} alt={event.title} />
            )}

            <section
              aria-label="Detalles del evento"
              className="space-y-4 rounded-lg border p-4 sm:p-6"
              style={{ borderColor: theme.accentOnBackground }}
            >
              {design.logoUrl && <img src={design.logoUrl} alt="" className="max-h-12 w-auto object-contain" />}
              {!heroImage && title}
              <p className="whitespace-pre-line break-words text-sm sm:text-base opacity-90">
                {description || "Sin descripción"}
              </p>
              <ul className="space-y-3 sm:space-y-4">
                <li className="flex items-center gap-3 min-w-0">
                  <Calendar className="size-4 sm:size-5 shrink-0" style={{ color: theme.accentOnBackground }} />
                  <span className="break-words">{formatEventDate(event.date)}</span>
                </li>
                <li className="flex items-center gap-3 min-w-0">
                  <Clock className="size-4 sm:size-5 shrink-0" style={{ color: theme.accentOnBackground }} />
                  <span className="break-words">{event.time}</span>
                </li>
                <li className="flex items-center gap-3 min-w-0">
                  <MapPin className="size-4 sm:size-5 shrink-0" style={{ color: theme.accentOnBackground }} />
                  <span className="break-words">{event.location || "Sin ubicación"}</span>
                </li>
                {event.displayCapacity ? (
                  <li className="flex items-center gap-3 min-w-0">
                    <Users className="size-4 sm:size-5 shrink-0" style={{ color: theme.accentOnBackground }} />
                    <span>{event.displayCapacity} lugares</span>
                  </li>
                ) : null}
              </ul>
              <p
                className="inline-block rounded-full px-3 py-1 text-sm font-semibold"
                style={{ backgroundColor: theme.accent, color: theme.accentText }}
              >
                {priceLabel}
              </p>
            </section>

            {design.footerText && (
              <p className="whitespace-pre-line break-words text-sm opacity-80">{normalizeMultiline(design.footerText)}</p>
            )}
          </div>

          <div className="space-y-4">
            {/* The form keeps a neutral surface so inputs stay readable whatever the organizer picked. */}
            <Card className="p-4 sm:p-5">
              <h2 className="font-semibold mb-3">Registro</h2>
              {event.availability === "open" ? (
                <RegistrationForm
                  slug={event.slug}
                  schema={event.formSchema}
                  priceLabel={priceLabel}
                  priceCents={event.priceCents}
                  paymentMethods={event.paymentMethods}
                  accent={{ background: theme.accent, color: theme.accentText }}
                />
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
