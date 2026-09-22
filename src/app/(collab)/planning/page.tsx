import type { Metadata } from "next";

import { todayInReunion } from "@/core/time";
import { getMyWeek, getPresence, MyWeek, PresenceToday } from "@/modules/planning";

export const metadata: Metadata = { title: "Planning" };
export const dynamic = "force-dynamic";

function asString(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

export default async function CollabPlanningPage({ searchParams }: PageProps<"/planning">) {
  const params = await searchParams;
  const today = todayInReunion();

  const [week, colleagues] = await Promise.all([
    getMyWeek(asString(params.week)),
    getPresence(today),
  ]);

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <h1 className="text-2xl font-semibold">Mon planning</h1>
      <PresenceToday colleagues={colleagues} />
      <MyWeek
        dates={week.dates}
        entries={week.entries}
        plannedMinutes={week.plannedMinutes}
        today={today}
      />
    </div>
  );
}
