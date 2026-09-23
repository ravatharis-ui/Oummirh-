import { Palmtree } from "lucide-react";

import type { AppModule } from "@/core/modules";

import { congesEventHandlers } from "./server/handlers";

function text(payload: unknown, key: string, fallback: string): string {
  if (typeof payload !== "object" || payload === null) return fallback;
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "string" ? value : fallback;
}

function days(payload: unknown): string {
  if (typeof payload !== "object" || payload === null) return "";
  const value = (payload as { days?: unknown }).days;
  if (typeof value !== "number") return "";
  return `${value.toLocaleString("fr-FR")} ${Math.abs(value) <= 1 ? "jour" : "jours"}`;
}

/** "21/12/2026" à partir de "2026-12-21", sans importer date-fns dans un manifeste. */
function frDate(value: string): string {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function range(payload: unknown): string {
  const from = text(payload, "start_date", "");
  const to = text(payload, "end_date", "");
  if (!from) return "";
  return from === to ? `le ${frDate(from)}` : `du ${frDate(from)} au ${frDate(to)}`;
}

/**
 * Congés.
 *
 * Le module décide ; le planning et les notifications en tirent les
 * conséquences. Il ne connaît ni l'un ni les autres.
 */
export const congesModule: AppModule = {
  key: "conges",
  name: "Congés",
  enabled: true,
  description:
    "Les demandes de congés, le décompte et les soldes. L'acquisition mensuelle continue même module éteint.",
  nav: {
    collab: [{ label: "Congés", href: "/conges", icon: Palmtree, roles: ["employee"] }],
    admin: [{ label: "Congés", href: "/admin/conges", icon: Palmtree, roles: ["admin"] }],
  },
  notificationTypes: [
    {
      type: "conges.request_submitted",
      title: (payload) => `${text(payload, "display_name", "Une collaboratrice")} demande un congé`,
      body: (payload) => `${range(payload)} — ${days(payload)} à décompter.`,
      href: () => "/admin/conges",
      email: false,
    },
    {
      type: "conges.request_approved",
      title: () => "Ton congé est validé",
      body: (payload) => `C'est accordé ${range(payload)}. Bon repos.`,
      href: () => "/conges",
      email: true,
    },
    {
      type: "conges.request_refused",
      title: () => "Ta demande de congé a été refusée",
      body: (payload) => {
        const comment = text(payload, "comment", "");
        const base = `La demande ${range(payload)} n'a pas été retenue.`;
        return comment ? `${base} « ${comment} »` : `${base} Parles-en à la direction.`;
      },
      href: () => "/conges",
      email: true,
    },
    {
      type: "conges.request_cancelled",
      title: () => "Un congé validé a été annulé",
      body: (payload) =>
        `Le congé ${range(payload)} a été annulé par la direction. Tes jours t'ont été recrédités.`,
      href: () => "/conges",
      email: true,
    },
  ],
  eventHandlers: congesEventHandlers,
};
