import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Users, Sparkles } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
          <Link href="/" className="font-semibold text-base sm:text-lg tracking-tight truncate min-w-0">
            Sistema de Eventos
          </Link>
          <nav className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Button variant="ghost" size="sm" className="text-sm sm:text-base" asChild>
              <Link href="/login">Iniciar sesión</Link>
            </Button>
            <Button size="sm" className="text-sm sm:text-base" asChild>
              <Link href="/register">Registrarse</Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-10 sm:py-16 text-center">
        <div className="max-w-2xl mx-auto space-y-6 sm:space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border bg-muted/50 px-3 sm:px-4 py-1.5 text-xs sm:text-sm text-muted-foreground">
            <Sparkles className="size-3.5 sm:size-4" />
            Ingeniería de Software 2
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            Gestiona tus eventos de forma simple
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground">
            Crea, edita y organiza eventos. Mantén todo en un solo lugar y comparte la información con tu equipo o invitados.
          </p>
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-center gap-3 sm:gap-4 pt-2 sm:pt-4">
            <Button size="lg" className="w-full sm:w-auto min-h-11" asChild>
              <Link href="/dashboard">Ir al dashboard</Link>
            </Button>
            <Button size="lg" variant="outline" className="w-full sm:w-auto min-h-11" asChild>
              <Link href="/register">Crear cuenta</Link>
            </Button>
          </div>
        </div>

        {/* Features */}
        <section className="w-full max-w-4xl mx-auto mt-16 sm:mt-24 px-0 grid gap-4 sm:gap-8 grid-cols-1 sm:grid-cols-3">
          <div className="rounded-xl border bg-card p-4 sm:p-6 text-left">
            <div className="mb-3 inline-flex rounded-lg bg-primary/10 p-2">
              <Calendar className="size-5 sm:size-6 text-primary" />
            </div>
            <h2 className="font-semibold text-base sm:text-lg mb-1">Crear eventos</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Registra título, fecha, hora y descripción de cada evento en segundos.
            </p>
          </div>
          <div className="rounded-xl border bg-card p-4 sm:p-6 text-left">
            <div className="mb-3 inline-flex rounded-lg bg-primary/10 p-2">
              <MapPin className="size-5 sm:size-6 text-primary" />
            </div>
            <h2 className="font-semibold text-base sm:text-lg mb-1">Ubicación e imagen</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Añade lugar e imagen para que todos sepan dónde y cómo es el evento.
            </p>
          </div>
          <div className="rounded-xl border bg-card p-4 sm:p-6 text-left">
            <div className="mb-3 inline-flex rounded-lg bg-primary/10 p-2">
              <Users className="size-5 sm:size-6 text-primary" />
            </div>
            <h2 className="font-semibold text-base sm:text-lg mb-1">Todo en un lugar</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Lista de eventos programados con opciones para editar o eliminar cuando quieras.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-4 sm:py-6 text-center text-xs sm:text-sm text-muted-foreground px-4">
        <div className="container mx-auto px-4 sm:px-6">
          Sistema de Gestión de Eventos — Ingeniería de Software 2
        </div>
      </footer>
    </div>
  );
}
