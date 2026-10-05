import { getDashboardStats } from "./_actions/dashboard.actions";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  Users,
  CalendarCheck,
  Clock,
  MapPin,
  ArrowRight,
  Plus,
} from "lucide-react";
import Link from "next/link";

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function DashboardPage() {
  const result = await getDashboardStats();

  const stats = result.success ? result.data : null;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            Panel principal
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Resumen general del sistema de eventos
          </p>
        </div>
        <Button asChild className="w-full sm:w-auto">
          <Link href="/dashboard/events">
            <Plus className="size-4" />
            Crear evento
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Calendar className="size-4" />
              Total de eventos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats?.eventCount ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Users className="size-4" />
              Boletos pagados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats?.paidTicketCount ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Clock className="size-4" />
              Pendientes de validar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats?.pendingTicketCount ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <CalendarCheck className="size-4" />
              Eventos próximos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats?.upcomingEventCount ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Events */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Eventos recientes</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/events">
                Ver todos
                <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!stats || stats.recentEvents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="size-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No hay eventos creados aún</p>
              <Button variant="outline" size="sm" className="mt-3" asChild>
                <Link href="/dashboard/events">
                  <Plus className="size-3.5" />
                  Crear primer evento
                </Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {stats.recentEvents.map((event) => (
                <Link
                  key={event.id}
                  href={`/event/${event.slug}`}
                  className="flex items-center gap-4 rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Calendar className="size-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{event.title}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        {formatDate(event.date)} · {event.time}
                      </span>
                      <span className="flex items-center gap-1 truncate">
                        <MapPin className="size-3 shrink-0" />
                        {event.location}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-medium">{event.paidTicketCount}</p>
                    <p className="text-xs text-muted-foreground">boletos pagados</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
