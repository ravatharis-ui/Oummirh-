import { Users } from "lucide-react";

import type { AppModule } from "@/core/modules";

export const employeesModule: AppModule = {
  key: "employees",
  name: "Collaboratrices",
  enabled: true,
  description:
    "Les fiches des collaboratrices, leurs horaires habituels et leurs codes PIN de connexion.",
  required: true,
  nav: {
    admin: [
      { label: "Collaboratrices", href: "/admin/collaboratrices", icon: Users, roles: ["admin"] },
    ],
  },
};
