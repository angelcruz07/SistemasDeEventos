"use server";

import prisma from "@/app/lib/prisma";

export async function getDashboardStats() {
  try {
    const [eventCount, attendanceCount, upcomingEventCount] = await Promise.all([
      prisma.event.count(),
      prisma.attendance.count(),
      prisma.event.count({
        where: { date: { gte: new Date() } },
      }),
    ]);

    const recentEvents = await prisma.event.findMany({
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
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al obtener estadísticas",
    };
  }
}
