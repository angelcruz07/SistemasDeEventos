import { EventsList } from "./_components/EventsList";

export default function EventosPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex flex-col gap-2 sm:gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">
                Gestión de Eventos
              </h1>
              <p className="text-muted-foreground mt-0.5 sm:mt-1 text-sm sm:text-base truncate">
                Sistema de Gestión de Eventos - Ingeniería de Software 2
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <EventsList />
      </main>
    </div>
  );
}
