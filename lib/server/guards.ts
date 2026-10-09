import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import prisma from "@/app/lib/prisma";
import { getSession } from "@/lib/auth-server";

/**
 * Loads an event only when the current session owns it. Cached per request so
 * the hub layout and its pages share one query. Returns null for a missing
 * event AND for a foreign one so callers cannot tell them apart.
 */
export const getOwnedEvent = cache(async (eventId: string) => {
  const session = await getSession();
  if (!session) return null;
  const event = await prisma.event.findFirst({
    where: { id: eventId, userId: session.user.id },
  });
  return event ? { user: session.user, event } : null;
});

/** Page/layout guard: redirects anonymous users, 404s for non-owners. */
export async function requireEventOwner(eventId: string) {
  const session = await getSession();
  if (!session) redirect("/login");
  const owned = await getOwnedEvent(eventId);
  if (!owned) notFound();
  return owned;
}
