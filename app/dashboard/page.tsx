import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth-server"
import { DashboardContent } from "./_components/dashboard-content"

export default async function DashboardPage() {
  const session = await getSession()

  if (!session) {
    redirect("/login")
  }

  return <DashboardContent user={session.user} />
}
