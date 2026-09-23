import { CalendarDays } from "lucide-react";

import type { AppModule } from "@/core/modules";

import { planningEventHandlers } from "./server/handlers";

/**
 * Planning.
 *
 * It listens far more than it speaks: congés, remplacements and échanges all
 * land here as days. The one thing it announces is that a collaboratrice's
 * planning changed — and only for days still to come.
 */
export const planningModule: AppModule = {
  key: "planning",
  name: "Planning",
  enabled: true,
  description:
    "Les plannings hebdomadaires, la semaine type et la version imprimable. Les congés, remplacements et récupérations viennent s'y poser.",
  nav: {
    collab: [{ label: "Planning", href: "/planning", icon: CalendarDays, roles: ["employee"] }],
    admin: [{ label: "Planning", href: "/admin/planning", icon: CalendarDays, roles: ["admin"] }],
  },
  notificationTypes: [
    {
      type: "planning.entry_changed",
      title: () => "Ton planning a changé",
      body: (payload) => {
        const dates = readDates(payload);
        if (dates.length === 0) return "Consulte ton planning pour voir ce qui a changé.";
        if (dates.length === 1) return `La journée du ${frenchDay(dates[0])} a été modifiée.`;
        return `${dates.length} journées ont été modifiées, à partir du ${frenchDay(dates[0])}.`;
      },
      href: () => "/planning",
      email: false,
    },
  ],
  eventHandlers: planningEventHandlers,
};

function readDates(payload: unknown): string[] {
  if (typeof payload !== "object" || payload === null) return [];
  const dates = (payload as { dates?: unknown }).dates;
  return Array.isArray(dates)
    ? dates.filter((date): date is string => typeof date === "string")
    : [];
}

/**
 * Written without `@/core/time` on purpose: a manifest is imported by the client
 * shells, and a notification body is a sentence, not a date calculation.
 */
function frenchDay(date: string | undefined): string {
  if (!date) return "jour concerné";
  const [year, month, day] = date.split("-");
  return year && month && day ? `${day}/${month}/${year}` : date;
}
