import { getSession } from "@/lib/auth-server";
import { redirect } from "next/navigation";
import { DashboardShell } from "./_components/DashboardShell";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const user = {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: (session.user as Record<string, unknown>).role as string | undefined,
    image: session.user.image,
  };

  return <DashboardShell user={user}>{children}</DashboardShell>;
}
