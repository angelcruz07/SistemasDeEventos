"use server";

import prisma from "@/app/lib/prisma";
import { getSession } from "@/lib/auth-server";
import { serverErrorToSpanish } from "@/lib/error-messages";
import { revalidatePath } from "next/cache";
import { HOLDING_STATUSES } from "@/lib/ticketing/capacity";
import { parseFormSchema } from "@/lib/ticketing/form-schema";
import { registrationAvailability } from "@/lib/ticketing/registration";

function generateSlug(title: string): string {
  const base = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${base}-${Date.now()}`;
}

async function getAuthenticatedUser() {
  const session = await getSession();

  if (!session) {
    throw new Error("No autenticado");
  }

  return session.user;
}

export interface CreateEventInput {
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  imageUrl: string;
}

export interface UpdateEventInput extends CreateEventInput {
  id: string;
  isCancelled?: boolean;
}

function isEventDateTimeInPast(dateStr: string, timeStr: string): boolean {
  if (!dateStr?.trim() || !timeStr?.trim()) return false;
  const [y, m, d] = dateStr.trim().split("-").map(Number);
  const [h, min] = timeStr.trim().split(":").map(Number);
  if ([y, m, d, h, min].some((n) => Number.isNaN(n))) return false;
  const eventDate = new Date(y, m - 1, d, h, min, 0, 0);
  return Number.isNaN(eventDate.getTime()) || eventDate.getTime() <= Date.now();
}

export async function createEvent(data: CreateEventInput) {
  try {
    const user = await getAuthenticatedUser();

    if (isEventDateTimeInPast(data.date, data.time)) {
      return {
        success: false,
        error: "No puedes crear un evento con fecha u hora pasada. Elige una fecha y hora futuras.",
      };
    }

    const slug = generateSlug(data.title);

    const event = await prisma.event.create({
      data: {
        userId: user.id,
        title: data.title,
        description: data.description,
        date: new Date(data.date),
        time: data.time,
        location: data.location,
        imageUrl: data.imageUrl || "",
        slug,
        createdBy: user.name,
      },
    });

    revalidatePath("/dashboard/events");
    revalidatePath("/dashboard");
    return { success: true, data: event };
  } catch (error) {
    console.error("Error creating event:", error);
    const message = error instanceof Error ? error.message : String(error);
    const isEnvError =
      !process.env.DATABASE_URL ||
      message.includes("DATABASE_URL") ||
      message.includes("Invalid") ||
      message.includes("invocation");
    return {
      success: false,
      error: isEnvError
        ? "Revisa que DATABASE_URL esté en .env y que la base de datos esté en ejecución."
        : serverErrorToSpanish(message, "Error al crear el evento"),
    };
  }
}

export async function getEvents() {
  try {
    const user = await getAuthenticatedUser();
    const events = await prisma.event.findMany({
      where: { userId: user.id },
      orderBy: { date: "asc" },
    });
    return { success: true, data: events };
  } catch (error) {
    console.error("Error fetching events:", error);
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: serverErrorToSpanish(message, "Error al obtener los eventos"),
    };
  }
}

export async function updateEvent(data: UpdateEventInput) {
  try {
    const user = await getAuthenticatedUser();
    const existing = await prisma.event.findUnique({
      where: { id: data.id },
      select: { userId: true },
    });
    if (!existing || existing.userId !== user.id) {
      return {
        success: false,
        error: "No tienes permiso para editar este evento.",
      };
    }
    const { id, isCancelled } = data;

    // Explicit whitelist: server actions are public endpoints, so never spread
    // client input (it could carry slug, userId, etc.).
    const event = await prisma.event.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        date: new Date(data.date),
        time: data.time,
        location: data.location,
        imageUrl: data.imageUrl || "",
        ...(typeof isCancelled === "boolean" && { isCancelled }),
      },
    });

    revalidatePath("/dashboard/events");
    revalidatePath("/dashboard");
    return { success: true, data: event };
  } catch (error) {
    console.error("Error updating event:", error);
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: serverErrorToSpanish(message, "Error al actualizar el evento"),
    };
  }
}

export async function deleteEvent(id: string) {
  try {
    const user = await getAuthenticatedUser();
    const existing = await prisma.event.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (!existing || existing.userId !== user.id) {
      return {
        success: false,
        error: "No tienes permiso para eliminar este evento.",
      };
    }

    await prisma.event.delete({
      where: { id },
    });

    revalidatePath("/dashboard/events");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Error deleting event:", error);
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: serverErrorToSpanish(message, "Error al eliminar el evento"),
    };
  }
}

export async function getEventById(id: string) {
  try {
    const user = await getAuthenticatedUser();
    const event = await prisma.event.findUnique({
      where: { id },
    });
    if (!event) {
      return { success: false, error: "Evento no encontrado." };
    }
    if (event.userId !== user.id) {
      return { success: false, error: "No tienes permiso para ver este evento." };
    }
    return { success: true, data: event };
  } catch (error) {
    console.error("Error fetching event:", error);
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: serverErrorToSpanish(message, "Error al obtener el evento"),
    };
  }
}

export async function getEventBySlug(slug: string) {
  try {
    // Public, unauthenticated lookup: whitelist fields so capacity and SPEI
    // bank details never reach the browser by accident.
    const event = await prisma.event.findFirst({
      where: { slug, isCancelled: false },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        date: true,
        time: true,
        location: true,
        imageUrl: true,
        priceCents: true,
        displayCapacity: true,
        formSchema: true,
        registrationOpen: true,
        allowSpei: true,
        // Used only to derive `availability`; never returned.
        capacity: true,
      },
    });
    if (!event) return { success: true, data: null };

    const held = await prisma.ticket.count({
      where: { eventId: event.id, status: { in: [...HOLDING_STATUSES] } },
    });
    const availability = registrationAvailability({ ...event, isCancelled: false }, held);
    return {
      success: true,
      data: {
        id: event.id,
        slug: event.slug,
        title: event.title,
        description: event.description,
        date: event.date,
        time: event.time,
        location: event.location,
        imageUrl: event.imageUrl,
        priceCents: event.priceCents,
        displayCapacity: event.displayCapacity,
        formSchema: parseFormSchema(event.formSchema) ?? { version: 1 as const, fields: [] },
        availability: availability.open ? ("open" as const) : availability.reason,
      },
    };
  } catch (error) {
    console.error("Error fetching event by slug:", error);
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: serverErrorToSpanish(message, "Error al obtener el evento"),
    };
  }
}
