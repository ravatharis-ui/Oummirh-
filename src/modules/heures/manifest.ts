import { Timer } from "lucide-react";

import type { AppModule } from "@/core/modules";

import { heuresEventHandlers } from "./server/handlers";

function text(payload: unknown, key: string, fallback: string): string {
  if (typeof payload !== "object" || payload === null) return fallback;
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "string" ? value : fallback;
}

function minutes(payload: unknown): number {
  if (typeof payload !== "object" || payload === null) return 0;
  const value = (payload as { minutes?: unknown }).minutes;
  return typeof value === "number" ? value : 0;
}

/** "1 h 30" sans importer `@/core/time` : un manifeste part aussi au navigateur. */
function duration(total: number): string {
  const hours = Math.floor(Math.abs(total) / 60);
  const rest = Math.abs(total) % 60;
  if (hours === 0) return `${rest} min`;
  if (rest === 0) return `${hours} h`;
  return `${hours} h ${String(rest).padStart(2, "0")}`;
}

function frDate(value: string): string {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function modeLabel(payload: unknown): string {
  return text(payload, "mode", "later") === "earlier" ? "partir plus tôt" : "arriver plus tard";
}

/**
 * Heures & récupération.
 *
 * Il écoute le pointage pour calculer, et annonce ses décisions au planning.
 * Il ne connaît ni l'un ni l'autre.
 */
export const heuresModule: AppModule = {
  key: "heures",
  name: "Heures",
  enabled: true,
  nav: {
    collab: [{ label: "Heures", href: "/heures", icon: Timer, roles: ["employee"] }],
    admin: [{ label: "Heures", href: "/admin/heures", icon: Timer, roles: ["admin"] }],
  },
  notificationTypes: [
    {
      type: "heures.recovery_requested",
      title: (payload) =>
        `${text(payload, "display_name", "Une collaboratrice")} veut prendre ses heures`,
      body: (payload) =>
        `${duration(minutes(payload))} pour ${modeLabel(payload)} le ${frDate(
          text(payload, "date", ""),
        )}.`,
      href: () => "/admin/heures",
      email: false,
    },
    {
      type: "heures.recovery_approved",
      title: () => "Ta récupération est accordée",
      body: (payload) =>
        `Le ${frDate(text(payload, "date", ""))}, tu peux ${modeLabel(payload)} de ${duration(
          minutes(payload),
        )}. Ton planning est déjà à jour.`,
      href: () => "/planning",
      email: true,
    },
    {
      type: "heures.recovery_refused",
      title: () => "Ta récupération a été refusée",
      body: (payload) => {
        const comment = text(payload, "comment", "");
        const base = `La demande du ${frDate(text(payload, "date", ""))} n'a pas été retenue.`;
        return comment ? `${base} « ${comment} »` : `${base} Tes heures restent à ton solde.`;
      },
      href: () => "/heures",
      email: false,
    },
  ],
  eventHandlers: heuresEventHandlers,
};
