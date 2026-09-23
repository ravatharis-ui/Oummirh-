import type { Metadata } from "next";

import { JobHealthCard } from "@/core/ui/jobs/job-health-card";

import { getRegistry } from "../../registry";

export const metadata: Metadata = { title: "Tableau de bord" };

export default async function AdminDashboardPage() {
  const registry = await getRegistry();
  const widgets = registry.widgets("admin");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Tableau de bord</h1>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <JobHealthCard />
        {widgets.map((Widget, index) => (
          <Widget key={index} />
        ))}
      </div>

      <p className="text-muted-foreground text-sm">
        Modules actifs : {registry.modules.map((m) => m.name).join(", ") || "aucun"}.
      </p>
    </div>
  );
}
