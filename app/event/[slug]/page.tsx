import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { getEventBySlug } from "@/app/dashboard/events/_actions/event.actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, MapPin, Clock, ArrowLeft, QrCode } from "lucide-react";
import Image from "next/image";

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

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
  if (!event) notFound();

  // URL base: variable de entorno en producción; headers en desarrollo sin env
  const baseUrlFromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  let baseUrl: string;
  if (baseUrlFromEnv) {
    baseUrl = baseUrlFromEnv.replace(/\/$/, "");
  } else {
    const headersList = await headers();
    const host = headersList.get("host") ?? "localhost:3000";
    const protocol = headersList.get("x-forwarded-proto") ?? "http";
    baseUrl = `${protocol}://${host}`;
  }
  const eventUrl = `${baseUrl}/event/${event.slug}`;

  const qrDataUrl = await QRCode.toDataURL(eventUrl, {
    width: 280,
    margin: 2,
    color: { dark: "#0a0a0a", light: "#ffffff" },
  });

  const imageUrl = event.imageUrl?.trim();
  const hasValidImage =
    imageUrl &&
    (imageUrl.startsWith("http://") || imageUrl.startsWith("https://"));

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <Button variant="ghost" size="sm" className="min-h-10 -ml-2" asChild>
            <Link href="/dashboard/events" className="flex items-center gap-2">
              <ArrowLeft className="size-4 shrink-0" />
              <span className="truncate">Volver a eventos</span>
            </Link>
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-4xl">
        <div className="grid gap-6 sm:gap-8 grid-cols-1 md:grid-cols-[1fr,minmax(240px,280px)]">
          <div className="space-y-4 sm:space-y-6 min-w-0">
            <div className="aspect-video rounded-lg overflow-hidden bg-muted flex items-center justify-center">
              {hasValidImage ? (
                <Image
                  src={imageUrl}
                  alt={event.title}
                  width={800}
                  height={450}
                  className="object-cover w-full h-full"
                />
              ) : (
                <Calendar className="size-16 sm:size-20 text-muted-foreground/50" />
              )}
            </div>

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
                  <span className="break-words">{formatDate(event.date)}</span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground min-w-0">
                  <Clock className="size-4 sm:size-5 shrink-0" />
                  <span className="break-words">{event.time}</span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground min-w-0">
                  <MapPin className="size-4 sm:size-5 shrink-0" />
                  <span className="break-words">{event.location || "Sin ubicación"}</span>
                </div>
              </CardContent>
            </Card>

          </div>

          <div className="space-y-4">
            <Card className="p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-2 sm:mb-3">
                <QrCode className="size-4 sm:size-5 text-muted-foreground shrink-0" />
                <h2 className="font-semibold text-sm sm:text-base">Compartir evento</h2>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4">
                Escanea el código para abrir esta página en tu móvil.
              </p>
              <div className="bg-white p-2 sm:p-3 rounded-lg inline-block w-full max-w-[200px] sm:max-w-none">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrDataUrl}
                  alt={`Código QR para ${event.title}`}
                  width={256}
                  height={256}
                  className="w-full aspect-square max-w-[180px] sm:max-w-[256px] mx-auto"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-3 break-all">
                {eventUrl}
              </p>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
