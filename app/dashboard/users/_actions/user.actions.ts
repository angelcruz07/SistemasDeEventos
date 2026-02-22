"use server";

import prisma from "@/app/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("No autenticado");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (user?.role !== "admin") {
    throw new Error("No autorizado: se requiere rol de administrador");
  }

  return session;
}

export async function getUsers() {
  try {
    await requireAdmin();

    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        _count: { select: { events: true } },
      },
    });

    return {
      success: true,
      data: users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        createdAt: u.createdAt,
        eventCount: u._count.events,
      })),
    };
  } catch (error) {
    console.error("Error fetching users:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al obtener usuarios",
    };
  }
}

export async function updateUserRole(userId: string, newRole: string) {
  try {
    const session = await requireAdmin();

    if (session.user.id === userId) {
      return { success: false, error: "No puedes cambiar tu propio rol" };
    }

    if (!["admin", "user"].includes(newRole)) {
      return { success: false, error: "Rol no válido" };
    }

    await prisma.user.update({
      where: { id: userId },
      data: { role: newRole },
    });

    revalidatePath("/dashboard/users");
    return { success: true };
  } catch (error) {
    console.error("Error updating user role:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al actualizar rol",
    };
  }
}
