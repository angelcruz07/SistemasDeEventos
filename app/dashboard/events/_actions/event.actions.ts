"use server";

import prisma from "@/app/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

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
  const session = await auth.api.getSession({
    headers: await headers(),
  });

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
        : message,
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
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al obtener los eventos",
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
    if (isEventDateTimeInPast(data.date, data.time)) {
      return {
        success: false,
        error: "No puedes usar una fecha u hora pasada. Elige una fecha y hora futuras.",
      };
    }
    const { id, isCancelled, ...rest } = data;
    const slug = generateSlug(rest.title);

    const event = await prisma.event.update({
      where: { id },
      data: {
        ...rest,
        date: new Date(rest.date),
        slug,
        ...(typeof isCancelled === "boolean" && { isCancelled }),
      },
    });

    revalidatePath("/dashboard/events");
    revalidatePath("/dashboard");
    return { success: true, data: event };
  } catch (error) {
    console.error("Error updating event:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al actualizar el evento",
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

    await prisma.confirmation.deleteMany({ where: { eventId: id } });
    await prisma.attendance.deleteMany({ where: { eventId: id } });

    await prisma.event.delete({
      where: { id },
    });

    revalidatePath("/dashboard/events");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Error deleting event:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al eliminar el evento",
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
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al obtener el evento",
    };
  }
}

export type AttendanceForEvent = {
  id: string;
  guestName: string;
  guestEmail: string;
  numberOfGuests: number;
  responseType: string;
  confirmedAt: Date;
};

export async function getAttendancesForEvent(eventId: string) {
  try {
    const user = await getAuthenticatedUser();
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { userId: true, title: true },
    });
    if (!event) {
      return { success: false, error: "Evento no encontrado." };
    }
    if (event.userId !== user.id) {
      return { success: false, error: "No tienes permiso para ver los asistentes de este evento." };
    }
    const attendances = await prisma.attendance.findMany({
      where: { eventId },
      orderBy: { confirmedAt: "desc" },
      select: {
        id: true,
        guestName: true,
        guestEmail: true,
        numberOfGuests: true,
        responseType: true,
        confirmedAt: true,
      },
    });
    return { success: true, data: { eventTitle: event.title, attendances } };
  } catch (error) {
    console.error("Error fetching attendances:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al obtener los asistentes",
    };
  }
}

export async function getEventBySlug(slug: string) {
  try {
    const event = await prisma.event.findUnique({
      where: { slug },
    });
    return { success: true, data: event };
  } catch (error) {
    console.error("Error fetching event by slug:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al obtener el evento",
    };
  }
}

export async function getEventBySlugWithAttendanceCount(slug: string) {
  try {
    const event = await prisma.event.findUnique({
      where: { slug },
      include: {
        _count: { select: { attendances: true } },
      },
    });
    if (!event) return { success: true, data: null };
    const attendanceCount = event._count.attendances;
    const { _count, ...eventData } = event;
    void _count;
    return {
      success: true,
      data: { event: eventData, attendanceCount },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isConnectionError =
      message.includes("Can't reach") ||
      message.includes("connection") ||
      message.includes("ECONNREFUSED") ||
      message.includes("connect");
    console.error("Error fetching event by slug:", error);
    return {
      success: false,
      error: isConnectionError
        ? "No se puede conectar a la base de datos. Comprueba que PostgreSQL esté en ejecución y DATABASE_URL en .env."
        : message,
    };
  }
}

export type AttendanceResponseType = "confirmed" | "maybe" | "declined";

export interface ConfirmAttendanceInput {
  guestName: string;
  guestEmail: string;
  numberOfGuests?: number;
  responseType?: AttendanceResponseType;
}

export async function confirmAttendance(slug: string, data: ConfirmAttendanceInput) {
  try {
    const event = await prisma.event.findUnique({
      where: { slug },
    });
    if (!event) {
      return { success: false, error: "Evento no encontrado." };
    }

    const numGuests = Math.max(1, Math.min(Number(data.numberOfGuests) || 1, 50));
    const name = data.guestName?.trim();
    const email = data.guestEmail?.trim().toLowerCase();
    const responseType =
      data.responseType === "maybe"
        ? "maybe"
        : data.responseType === "declined"
          ? "declined"
          : "confirmed";

    if (!name || name.length < 2) {
      return { success: false, error: "El nombre debe tener al menos 2 caracteres." };
    }
    if (!email) {
      return { success: false, error: "El correo electrónico es obligatorio." };
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { success: false, error: "Introduce un correo electrónico válido." };
    }

    await prisma.attendance.create({
      data: {
        eventId: event.id,
        guestName: name,
        guestEmail: email,
        numberOfGuests: numGuests,
        responseType,
      },
    });

    revalidatePath(`/event/${slug}`);
    return { success: true };
  } catch (error) {
    console.error("Error confirming attendance:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al confirmar la asistencia.",
    };
  }
}
