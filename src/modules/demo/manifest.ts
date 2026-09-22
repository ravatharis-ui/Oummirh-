import { Sparkles } from "lucide-react";

import type { AppModule } from "@/core/modules";

import { DemoAdminWidget } from "./ui/admin/demo-widget";
import { DemoCollabWidget } from "./ui/collab/demo-widget";

/**
 * Reference module.
 *
 * It exists to prove the architecture claim: adding a feature means adding a folder
 * and listing its manifest in `src/app/modules.ts`. Nothing else in the codebase
 * knows this module exists, yet it contributes a menu entry to both spaces, a
 * dashboard widget to each, and a notification type.
 *
 * Copy this folder as the starting point for a real module.
 */
export const demoModule: AppModule = {
  key: "demo",
  name: "Démo",
  enabled: true,
  nav: {
    collab: [{ label: "Démo", href: "/demo", icon: Sparkles, roles: ["employee"] }],
    admin: [{ label: "Démo", href: "/admin/demo", icon: Sparkles, roles: ["admin"] }],
  },
  notificationTypes: [
    {
      type: "demo.hello",
      title: () => "Notification de démonstration",
      body: () => "Envoyée par le module de démonstration.",
      href: () => "/demo",
    },
  ],
  dashboardWidgets: {
    collab: [DemoCollabWidget],
    admin: [DemoAdminWidget],
  },
};
