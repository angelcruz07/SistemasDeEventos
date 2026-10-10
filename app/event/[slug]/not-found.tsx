import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function EventNotFound() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center px-6">
      <h1 className="text-2xl font-bold mb-2">Evento no encontrado</h1>
      <p className="text-muted-foreground mb-6 text-center">
        El evento que buscas no existe o el enlace no es válido.
      </p>
      <Button asChild>
        <Link href="/dashboard/events">Volver a eventos</Link>
      </Button>
    </div>
  );
}
