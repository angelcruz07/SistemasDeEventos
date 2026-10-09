"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/app/lib/prisma";
import { getTicketingEnv } from "@/lib/env";
import { getOwnedEvent } from "@/lib/server/guards";
import { generateDoorKey, generatePin, hashDoorKey, hashPin } from "@/lib/ticketing/door-pin";

export type DoorCredentialsResult =
  | { success: true; url: string; pin: string }
  | { success: false; error: string };
export type DoorRevokeResult = { success: true } | { success: false; error: string };

const NOT_FOUND = { success: false, error: "Evento no encontrado." } as const;

/**
 * Creates the door access, or regenerates it: new link key, new PIN and a bumped
 * sessionVersion, so every staff phone that was unlocked is signed out. The raw
 * key and PIN are returned once and never stored.
 */
export async function generateDoorAccess(eventId: string): Promise<DoorCredentialsResult> {
  try {
    const owned = await getOwnedEvent(eventId);
    if (!owned) return NOT_FOUND;

    const key = generateDoorKey();
    const pin = generatePin();
    const fresh = { keyHash: hashDoorKey(key), pinHash: await hashPin(pin), failedAttempts: 0, lockedUntil: null, revokedAt: null };
    await prisma.doorAccess.upsert({
      where: { eventId: owned.event.id },
      create: { eventId: owned.event.id, ...fresh },
      update: { ...fresh, sessionVersion: { increment: 1 }, createdAt: new Date() },
    });
    revalidatePath(`/dashboard/events/${owned.event.id}/door`);
    return { success: true, url: `${getTicketingEnv().appUrl}/door/${key}`, pin };
  } catch (error) {
    console.error("Error generating door access:", error);
    return { success: false, error: "No se pudo generar el acceso." };
  }
}

export async function revokeDoorAccess(eventId: string): Promise<DoorRevokeResult> {
  try {
    const owned = await getOwnedEvent(eventId);
    if (!owned) return NOT_FOUND;

    await prisma.doorAccess.updateMany({
      where: { eventId: owned.event.id, revokedAt: null },
      data: { revokedAt: new Date(), sessionVersion: { increment: 1 } },
    });
    revalidatePath(`/dashboard/events/${owned.event.id}/door`);
    return { success: true };
  } catch (error) {
    console.error("Error revoking door access:", error);
    return { success: false, error: "No se pudo revocar el acceso." };
  }
}
