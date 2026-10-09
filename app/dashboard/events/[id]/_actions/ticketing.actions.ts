"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@/app/generated/prisma/client";
import prisma from "@/app/lib/prisma";
import { getOwnedEvent } from "@/lib/server/guards";
import { parseFormSchema, validateSchemaEdit, type FormSchema } from "@/lib/ticketing/form-schema";
import {
  collectAnsweredFieldIds,
  parseTicketingConfig,
  type TicketingConfigInput,
} from "@/lib/ticketing/ticketing-config";

export type ActionResult =
  | { success: true }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

const NOT_FOUND: ActionResult = { success: false, error: "Evento no encontrado." };

export async function updateTicketingConfig(
  eventId: string,
  input: TicketingConfigInput,
): Promise<ActionResult> {
  try {
    const owned = await getOwnedEvent(eventId);
    if (!owned) return NOT_FOUND;

    const parsed = parseTicketingConfig(input);
    if ("errors" in parsed) {
      return { success: false, error: "Revisa los campos marcados.", fieldErrors: parsed.errors };
    }

    await prisma.event.update({ where: { id: owned.event.id }, data: parsed.data });
    revalidatePath(`/dashboard/events/${owned.event.id}/ticketing`);
    return { success: true };
  } catch (error) {
    console.error("Error updating ticketing config:", error);
    return { success: false, error: "No se pudo guardar la configuración." };
  }
}

export async function updateFormSchema(eventId: string, nextSchema: unknown): Promise<ActionResult> {
  try {
    const owned = await getOwnedEvent(eventId);
    if (!owned) return NOT_FOUND;

    const next = parseFormSchema(nextSchema);
    if (!next) {
      return {
        success: false,
        error: "El formulario no es válido. Revisa que todos los campos tengan etiqueta y que las listas tengan opciones.",
      };
    }

    const current: FormSchema = parseFormSchema(owned.event.formSchema) ?? { version: 1, fields: [] };
    const tickets = await prisma.ticket.findMany({
      where: { eventId: owned.event.id },
      select: { answers: true },
    });
    const check = validateSchemaEdit(current, next, collectAnsweredFieldIds(tickets.map((t) => t.answers)));
    if (!check.ok) return { success: false, error: check.error };

    await prisma.event.update({
      where: { id: owned.event.id },
      data: { formSchema: next as unknown as Prisma.InputJsonValue },
    });
    revalidatePath(`/dashboard/events/${owned.event.id}/form`);
    return { success: true };
  } catch (error) {
    console.error("Error updating form schema:", error);
    return { success: false, error: "No se pudo guardar el formulario." };
  }
}
