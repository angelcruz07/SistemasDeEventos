import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-server";
import prisma from "@/app/lib/prisma";
import { EventsList } from "./_components/EventsList";
import { IMAGES_INCLUDE } from "./interfaces/event.interface";

export default async function EventosPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const events = await prisma.event.findMany({
    where: { userId: session.user.id },
    orderBy: { date: "asc" },
    include: IMAGES_INCLUDE,
  });

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
      <EventsList events={events} />
    </div>
  );
}
