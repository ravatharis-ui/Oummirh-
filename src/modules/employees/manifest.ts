import { Users } from "lucide-react";

import type { AppModule } from "@/core/modules";

export const employeesModule: AppModule = {
  key: "employees",
  name: "Collaboratrices",
  enabled: true,
  nav: {
    admin: [
      { label: "Collaboratrices", href: "/admin/collaboratrices", icon: Users, roles: ["admin"] },
    ],
  },
};
