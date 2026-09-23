import { FolderLock } from "lucide-react";

import type { AppModule } from "@/core/modules";

import { documentsEventHandlers } from "./server/handlers";

function text(payload: unknown, key: string, fallback: string): string {
  if (typeof payload !== "object" || payload === null) return fallback;
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "string" ? value : fallback;
}

const MONTHS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

/** "septembre 2026", sans importer `@/core/time` : un manifeste part au navigateur. */
function period(value: string): string {
  const [year, month] = value.split("-");
  const index = Number(month) - 1;
  return MONTHS[index] && year ? `${MONTHS[index]} ${year}` : "";
}

/**
 * Coffre-fort numérique.
 *
 * Le seul endroit où une collaboratrice retrouvera son bulletin de septembre
 * dans deux ans.
 */
export const documentsModule: AppModule = {
  key: "documents",
  name: "Documents",
  enabled: true,
  description:
    "Fiches de paie, contrats et attestations, déposés par la direction et consultables par la seule intéressée. La direction voit qui a ouvert quoi.",
  nav: {
    collab: [{ label: "Documents", href: "/documents", icon: FolderLock, roles: ["employee"] }],
    admin: [{ label: "Documents", href: "/admin/documents", icon: FolderLock, roles: ["admin"] }],
  },
  notificationTypes: [
    {
      type: "documents.added",
      title: (payload) =>
        text(payload, "category", "other") === "payslip"
          ? "Ta fiche de paie est disponible"
          : "Un document t'attend",
      body: (payload) => {
        const when = period(text(payload, "period_month", ""));
        const title = text(payload, "title", "Un document");
        return when ? `${title} — ${when}.` : `${title} est disponible dans ton coffre.`;
      },
      href: () => "/documents",
      email: true,
    },
  ],
  eventHandlers: documentsEventHandlers,
};
