import { EventsList } from "./_components/EventsList";

export default function EventosPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
          Gestión de Eventos
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Crea, edita y administra tus eventos
        </p>
      </div>
      <EventsList />
    </div>
  );
}
