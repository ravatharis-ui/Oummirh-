import { ArrowLeftRight } from "lucide-react";

import type { AppModule } from "@/core/modules";

import { swapsEventHandlers } from "./server/handlers";

function text(payload: unknown, key: string, fallback: string): string {
  if (typeof payload !== "object" || payload === null) return fallback;
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "string" ? value : fallback;
}

function frDate(value: string): string {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function pair(payload: unknown): string {
  return `${frDate(text(payload, "requester_date", ""))} ↔ ${frDate(
    text(payload, "partner_date", ""),
  )}`;
}

/**
 * Bourse d'échange de créneaux.
 *
 * Le seul flux à double validation de l'application. Chaque événement ne
 * prévient que la personne dont c'est le tour.
 */
export const swapsModule: AppModule = {
  key: "swaps",
  name: "Échanges",
  enabled: true,
  description:
    "Deux collaboratrices échangent une journée : la collègue accepte, puis la direction valide. Sans ce module, les échanges se font de vive voix et le planning ne suit pas.",
  nav: {
    collab: [{ label: "Échanges", href: "/echanges", icon: ArrowLeftRight, roles: ["employee"] }],
    admin: [{ label: "Échanges", href: "/admin/echanges", icon: ArrowLeftRight, roles: ["admin"] }],
  },
  notificationTypes: [
    {
      type: "swaps.requested",
      title: (payload) => `${text(payload, "other_name", "Une collègue")} te propose un échange`,
      body: (payload) => `Elle te propose ${pair(payload)}. À toi de répondre.`,
      href: () => "/echanges",
      email: false,
    },
    {
      type: "swaps.accepted_by_partner",
      title: (payload) => `${text(payload, "other_name", "Ta collègue")} a accepté`,
      body: () => "La direction doit encore valider l'échange.",
      href: () => "/echanges",
      email: false,
    },
    {
      type: "swaps.refused_by_partner",
      title: (payload) => `${text(payload, "other_name", "Ta collègue")} a refusé l'échange`,
      body: () => "Ton planning ne change pas. Tu peux proposer une autre journée.",
      href: () => "/echanges",
      email: false,
    },
    {
      type: "swaps.pending_admin",
      title: () => "Un échange attend votre validation",
      body: (payload) =>
        `${text(payload, "requester_name", "Une collaboratrice")} et ${text(
          payload,
          "partner_name",
          "une collègue",
        )} se sont mises d'accord : ${pair(payload)}.`,
      href: () => "/admin/echanges",
      email: false,
    },
    {
      type: "swaps.approved",
      title: () => "Ton échange est validé",
      body: (payload) => `${pair(payload)}. Ton planning est déjà à jour.`,
      href: () => "/planning",
      email: true,
    },
    {
      type: "swaps.refused_by_admin",
      title: () => "La direction a refusé l'échange",
      body: (payload) => {
        const comment = text(payload, "comment", "");
        const base = "Vos plannings ne changent pas.";
        return comment ? `${base} « ${comment} »` : base;
      },
      href: () => "/echanges",
      email: false,
    },
    {
      type: "swaps.cancelled",
      title: (payload) => `${text(payload, "other_name", "Une collègue")} a retiré sa demande`,
      body: () => "Tu n'as plus rien à répondre.",
      href: () => "/echanges",
      email: false,
    },
  ],
  eventHandlers: swapsEventHandlers,
};
