"use server";

import prisma from "@/app/lib/prisma";
import { getSession } from "@/lib/auth-server";
import { serverErrorToSpanish } from "@/lib/error-messages";
import type { TicketStatus } from "@/app/generated/prisma/client";

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

    const [eventCount, ticketGroups, pendingOrderCount, upcomingEventCount] = await Promise.all([
      prisma.event.count({ where: { userId } }),
      prisma.ticket.groupBy({
        by: ["status"],
        where: { event: { userId } },
        _count: { _all: true },
      }),
      // Orders waiting for the organizer to validate a receipt (one per purchase, not per ticket).
      prisma.order.count({ where: { status: "PENDING_VALIDATION", event: { userId } } }),
      prisma.event.count({
        where: { userId, date: { gte: new Date() } },
      }),
    ]);

    // Issued tickets: paid or already checked in.
    const paidTicketCount = ticketGroups
      .filter((g) => (["PAID", "CHECKED_IN"] as TicketStatus[]).includes(g.status))
      .reduce((sum, g) => sum + g._count._all, 0);

    const recentEvents = await prisma.event.findMany({
      where: { userId },
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { tickets: { where: { status: { in: ["PAID", "CHECKED_IN"] } } } },
        },
        user: { select: { name: true } },
      },
    });

    return {
      success: true,
      data: {
        eventCount,
        paidTicketCount,
        pendingOrderCount,
        upcomingEventCount,
        recentEvents: recentEvents.map((e) => ({
          id: e.id,
          title: e.title,
          date: e.date,
          time: e.time,
          location: e.location,
          slug: e.slug,
          paidTicketCount: e._count.tickets,
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
