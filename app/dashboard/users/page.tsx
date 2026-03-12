import { getSession } from "@/lib/auth-server";
import { redirect } from "next/navigation";
import prisma from "@/app/lib/prisma";
import { UsersTable } from "./_components/UsersTable";

export default async function UsersPage() {
  const session = await getSession();

  if (!session) redirect("/login");

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (currentUser?.role !== "admin") {
    redirect("/dashboard");
  }

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

  const usersData = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    createdAt: u.createdAt.toISOString(),
    eventCount: u._count.events,
  }));

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
          Gestión de Usuarios
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Administra los usuarios y sus roles
        </p>
      </div>
      <UsersTable users={usersData} currentUserId={session.user.id} />
    </div>
  );
}
