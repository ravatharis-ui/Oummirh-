import { UserPlus } from "lucide-react";

import type { AppModule } from "@/core/modules";

import { remplacementsEventHandlers } from "./server/handlers";

function text(payload: unknown, key: string, fallback: string): string {
  if (typeof payload !== "object" || payload === null) return fallback;
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "string" ? value : fallback;
}

function frDate(value: string): string {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function hhmm(value: string): string {
  return value.slice(0, 5);
}

/**
 * Remplacements directs.
 *
 * Le module le plus simple de l'application, et celui qui sert le plus souvent.
 * Il annonce ; le planning applique et l'annulation rend ce qui avait été pris.
 */
export const remplacementsModule: AppModule = {
  key: "remplacements",
  name: "Remplacements",
  enabled: true,
  description:
    "Envoyer quelqu'un en renfort dans un autre point de vente pour une journée. L'annulation rend au planning ce qu'elle avait déplacé.",
  nav: {
    admin: [
      { label: "Remplacements", href: "/admin/remplacements", icon: UserPlus, roles: ["admin"] },
    ],
  },
  notificationTypes: [
    {
      type: "remplacements.created",
      title: () => "Tu es attendue en renfort",
      body: (payload) =>
        `Le ${frDate(text(payload, "start_date", ""))} à ${text(
          payload,
          "boutique_name",
          "un autre point de vente",
        )}, de ${hhmm(text(payload, "start_time", ""))} à ${hhmm(text(payload, "end_time", ""))}.`,
      href: () => "/planning",
      // Le seul message de l'application qui change le lendemain de quelqu'un :
      // il part aussi par email quand elle a une adresse.
      email: true,
    },
    {
      type: "remplacements.cancelled",
      title: () => "Ton remplacement est annulé",
      body: (payload) =>
        `Le renfort du ${frDate(
          text(payload, "start_date", ""),
        )} n'a plus lieu d'être. Ton planning d'origine est rétabli.`,
      href: () => "/planning",
      email: true,
    },
  ],
  eventHandlers: remplacementsEventHandlers,
};
