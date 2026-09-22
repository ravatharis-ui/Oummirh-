import type { Metadata } from "next";

import { getPlanningWeek, PlanningGrid, WeekToolbar } from "@/modules/planning";

export const metadata: Metadata = { title: "Planning" };
export const dynamic = "force-dynamic";

function asString(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

export default async function AdminPlanningPage({ searchParams }: PageProps<"/admin/planning">) {
  const params = await searchParams;
  const week = await getPlanningWeek(asString(params.week), asString(params.boutique));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Planning</h1>
      <WeekToolbar week={week} />
      <PlanningGrid week={week} />
    </div>
  );
}
