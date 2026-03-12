"use server";

import prisma from "@/app/lib/prisma";
import { getSession } from "@/lib/auth-server";
import { serverErrorToSpanish } from "@/lib/error-messages";

export async function getDashboardStats() {
  try {
    const session = await getSession();

    if (!session) {
      return {
        success: false,
        error: "No autenticado",
      };
    }

    const userId = session.user.id;

    const [eventCount, attendanceCount, upcomingEventCount] = await Promise.all([
      prisma.event.count({ where: { userId } }),
      prisma.attendance.count({
        where: { event: { userId } },
      }),
      prisma.event.count({
        where: { userId, date: { gte: new Date() } },
      }),
    ]);

    const recentEvents = await prisma.event.findMany({
      where: { userId },
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { attendances: true } },
        user: { select: { name: true } },
      },
    });

    return {
      success: true,
      data: {
        eventCount,
        attendanceCount,
        upcomingEventCount,
        recentEvents: recentEvents.map((e) => ({
          id: e.id,
          title: e.title,
          date: e.date,
          time: e.time,
          location: e.location,
          slug: e.slug,
          attendanceCount: e._count.attendances,
          createdBy: e.user.name,
        })),
      },
    };
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: serverErrorToSpanish(message, "Error al obtener estadísticas"),
    };
  }
}
