import { Clock } from "lucide-react";

import type { AppModule } from "@/core/modules";

import { pointageEventHandlers } from "./server/handlers";

function name(payload: unknown): string {
  if (typeof payload !== "object" || payload === null) return "Une collaboratrice";
  const value = (payload as { display_name?: unknown }).display_name;
  return typeof value === "string" ? value : "Une collaboratrice";
}

function minutes(payload: unknown): number | null {
  if (typeof payload !== "object" || payload === null) return null;
  const value = (payload as { minutes_late?: unknown }).minutes_late;
  return typeof value === "number" ? value : null;
}

/**
 * Pointage.
 *
 * The only module that writes the hours actually worked. Everything else —
 * balances, overtime, payroll exports — reads what it records and never the
 * other way round.
 */
export const pointageModule: AppModule = {
  key: "pointage",
  name: "Pointage",
  enabled: true,
  description:
    "La pointeuse : arrivée, pause, départ, avec selfie à l'arrivée. C'est elle qui alimente le suivi des heures.",
  nav: {
    collab: [{ label: "Pointer", href: "/pointer", icon: Clock, roles: ["employee"] }],
    admin: [{ label: "Pointage", href: "/admin/pointage", icon: Clock, roles: ["admin"] }],
  },
  notificationTypes: [
    {
      type: "pointage.late",
      title: (payload) => `${name(payload)} n'a pas encore pointé`,
      body: (payload) => {
        const late = minutes(payload);
        return late === null
          ? "Son arrivée était prévue et n'a pas été pointée."
          : `Son arrivée était prévue il y a ${late} minutes et n'a pas été pointée.`;
      },
      href: () => "/admin/pointage",
      email: false,
    },
    {
      type: "pointage.missing_clock_out",
      title: (payload) => `${name(payload)} n'a pas pointé son départ`,
      body: () =>
        "Sa journée est restée ouverte une heure après l'heure de fin prévue. Une correction peut être saisie depuis l'historique.",
      href: () => "/admin/pointage/historique",
      email: false,
    },
  ],
  eventHandlers: pointageEventHandlers,
};
