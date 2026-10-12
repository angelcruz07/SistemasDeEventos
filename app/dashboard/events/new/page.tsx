import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getSession } from "@/lib/auth-server";
import { EventForm } from "../_components/EventForm";

export default async function NewEventPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div>
        <Link
          href="/dashboard/events"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Eventos
        </Link>
        <h1 className="mt-2 text-xl sm:text-2xl font-bold tracking-tight">Crear evento</h1>
      </div>
      <EventForm />
    </div>
  );
}
