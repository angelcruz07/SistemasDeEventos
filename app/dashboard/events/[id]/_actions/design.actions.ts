"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@/app/generated/prisma/client";
import prisma from "@/app/lib/prisma";
import { getOwnedEvent } from "@/lib/server/guards";
import { parseTicketDesign } from "@/lib/ticketing/ticket-design";

export type DesignResult = { success: true } | { success: false; error: string };

export async function updateTicketDesign(eventId: string, input: unknown): Promise<DesignResult> {
  try {
    const owned = await getOwnedEvent(eventId);
    if (!owned) return { success: false, error: "Evento no encontrado." };

    // Normalize server-side: the client value is never stored as-is.
    const design = parseTicketDesign(input);
    await prisma.event.update({
      where: { id: owned.event.id },
      data: { ticketDesign: design as unknown as Prisma.InputJsonValue },
    });
    revalidatePath(`/dashboard/events/${owned.event.id}/design`);
    return { success: true };
  } catch (error) {
    console.error("Error updating ticket design:", error);
    return { success: false, error: "No se pudo guardar el diseño." };
  }
}
