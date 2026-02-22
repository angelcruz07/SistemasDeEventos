import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SettingsForm } from "./_components/SettingsForm";

export default async function SettingsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) redirect("/login");

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
          Configuración
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Administra tu cuenta y preferencias
        </p>
      </div>
      <div className="max-w-2xl space-y-6">
        <SettingsForm
          user={{
            name: session.user.name,
            email: session.user.email,
          }}
        />
      </div>
    </div>
  );
}
