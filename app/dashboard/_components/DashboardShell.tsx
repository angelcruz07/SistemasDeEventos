"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Calendar,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { label: "Panel principal", href: "/dashboard", icon: LayoutDashboard },
  { label: "Eventos", href: "/dashboard/events", icon: Calendar },
  { label: "Usuarios", href: "/dashboard/users", icon: Users, adminOnly: true },
  { label: "Configuración", href: "/dashboard/settings", icon: Settings },
];

interface DashboardShellProps {
  user: {
    id: string;
    name: string;
    email: string;
    role?: string;
    image?: string | null;
  };
  children: React.ReactNode;
}

export function DashboardShell({ user, children }: DashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const isAdmin = user.role === "admin";

  const visibleNavItems = navItems.filter(
    (item) => !item.adminOnly || isAdmin
  );

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => router.push("/login"),
      },
    });
  };

  const userInitial = user.name?.charAt(0)?.toUpperCase() ?? "U";

  const sidebarContent = (
    <>
      <div className="shrink-0 flex items-center gap-3 px-5 h-16 border-b border-border/60">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
          SE
        </div>
        <span className="font-semibold text-sm tracking-tight truncate">
          Sistema de Eventos
        </span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <p className="px-3 mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Menú
        </p>
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="truncate">{item.label}</span>
              {active && <ChevronRight className="size-3.5 ml-auto shrink-0" />}
            </Link>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-border/60 p-3 space-y-2">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">
            {userInitial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{user.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground hover:text-destructive"
          onClick={handleSignOut}
          disabled={signingOut}
        >
          <LogOut className="size-4 mr-2" />
          {signingOut ? "Cerrando sesión..." : "Cerrar sesión"}
        </Button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:border-r bg-card shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-64 h-full bg-card border-r flex flex-col shadow-xl animate-in slide-in-from-left duration-200">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-3 right-3 h-8 w-8 z-10"
              onClick={() => setMobileOpen(false)}
            >
              <X className="size-4" />
            </Button>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center gap-3 border-b bg-card px-4 h-14 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="size-5" />
          </Button>
          <span className="font-semibold text-sm truncate">
            Sistema de Eventos
          </span>
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
