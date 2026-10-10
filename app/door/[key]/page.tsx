import type { Metadata } from "next";
import { notFound } from "next/navigation";
import prisma from "@/app/lib/prisma";
import { Button } from "@/components/ui/button";
import { formatEventDate } from "@/lib/datetime";
import { findActiveDoorAccess, getDoorSession } from "@/lib/server/door-session";
import { logoutDoor } from "./_actions/door.actions";
import { DoorConsole } from "./_components/DoorConsole";
import { PinForm } from "./_components/PinForm";

// The key is in the URL: keep it out of Referer headers and search indexes.
export const metadata: Metadata = {
  title: "Acceso de puerta",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default async function DoorPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  // Unknown and revoked keys are the same 404.
  if (!(await findActiveDoorAccess(key))) notFound();

  const session = await getDoorSession(key);

  if (!session) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-6 px-4 py-8">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold">Acceso de puerta</h1>
          <p className="text-sm text-muted-foreground">Ingresa tu nombre y el PIN que te dio el organizador.</p>
        </header>
        <PinForm doorKey={key} />
      </main>
    );
  }

  // The staff-safe session view omits settings; only this boolean is read to show the cash walk-in form.
  // The action re-reads it server-side.
  const cash = await prisma.event.findUnique({ where: { id: session.access.eventId }, select: { allowCash: true } });

  const logout = logoutDoor.bind(null, key);
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-6 px-4 py-8">
      <header className="space-y-1">
        <p className="text-sm text-muted-foreground">Sesión de {session.staffName}</p>
        <h1 className="text-2xl font-bold break-words">{session.event.title}</h1>
        <p className="text-sm text-muted-foreground">
          {formatEventDate(session.event.date)} · {session.event.time} · {session.event.location}
        </p>
      </header>
      {session.eventCancelled ? (
        <p role="alert" className="rounded-lg border-2 border-red-600 bg-red-50 p-4 text-center font-semibold text-red-900">
          Evento cancelado
        </p>
      ) : (
        <DoorConsole doorKey={key} allowCash={cash?.allowCash ?? false} />
      )}
      <form action={logout}>
        <Button type="submit" variant="outline" className="w-full">
          Salir
        </Button>
      </form>
    </main>
  );
}
