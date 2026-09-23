import type { Metadata } from "next";

import {
  getPlanningTemplate,
  getPlanningWeek,
  PlanningGrid,
  WeekToolbar,
  type TemplateDay,
} from "@/modules/planning";

export const metadata: Metadata = { title: "Planning" };
export const dynamic = "force-dynamic";

function asString(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

export default async function AdminPlanningPage({ searchParams }: PageProps<"/admin/planning">) {
  const params = await searchParams;
  const week = await getPlanningWeek(asString(params.week), asString(params.boutique));

  // Les semaines types partent avec la page : la matrice les ouvre d'un clic sur
  // un prénom, et un aller-retour par ligne serait une attente pour rien.
  const templates = Object.fromEntries(
    await Promise.all(
      week.rows.map(async (row): Promise<[string, TemplateDay[]]> => [
        row.employeeId,
        await getPlanningTemplate(row.employeeId),
      ]),
    ),
  );

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Planning</h1>
      <WeekToolbar week={week} />
      <PlanningGrid week={week} templates={templates} />
    </div>
  );
}
