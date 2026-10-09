"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// The design tab is added by a later change.
const TABS = [
  { segment: "ticketing", label: "Boletos y pagos" },
  { segment: "attendees", label: "Asistentes" },
  { segment: "form", label: "Formulario" },
  { segment: "door", label: "Puerta" },
];

export function EventHubTabs({ eventId }: { eventId: string }) {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 border-b overflow-x-auto" aria-label="Secciones del evento">
      {TABS.map((tab) => {
        const href = `/dashboard/events/${eventId}/${tab.segment}`;
        const active = pathname === href;
        return (
          <Link
            key={tab.segment}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "px-3 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
