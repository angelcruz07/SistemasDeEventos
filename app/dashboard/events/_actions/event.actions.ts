"use server";

import prisma from "@/app/lib/prisma";
import { revalidatePath } from "next/cache";

// Usuario por defecto para demos (sin auth)
const DEFAULT_USER_EMAIL = "demo@sistemaeventos.com";

function generateSlug(title: string): string {
  const base = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${base}-${Date.now()}`;
}

async function getOrCreateDefaultUser() {
  let user = await prisma.user.findFirst({
    where: { email: DEFAULT_USER_EMAIL },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: DEFAULT_USER_EMAIL,
        password: "demo-password-hash",
        name: "Usuario Demo",
      },
    });
  }

  return user;
}

export interface CreateEventInput {
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  imageUrl: string;
  createdBy?: string;
}

export interface UpdateEventInput extends CreateEventInput {
  id: string;
}

export async function createEvent(data: CreateEventInput) {
  try {
    const user = await getOrCreateDefaultUser();

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
        createdBy: data.createdBy ?? user.name,
      },
    });

    revalidatePath("/dashboard/events");
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
    const events = await prisma.event.findMany({
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
    const { id, ...rest } = data;
    const slug = generateSlug(rest.title);

    const event = await prisma.event.update({
      where: { id },
      data: {
        ...rest,
        date: new Date(rest.date),
        slug,
      },
    });

    revalidatePath("/dashboard/events");
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
    await prisma.event.delete({
      where: { id },
    });

    revalidatePath("/dashboard/events");
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
    const event = await prisma.event.findUnique({
      where: { id },
    });
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
