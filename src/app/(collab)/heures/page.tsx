import type { Metadata } from "next";

import { getMyHoursState, MyHours } from "@/modules/heures";

export const metadata: Metadata = { title: "Heures" };
export const dynamic = "force-dynamic";

export default async function CollabHoursPage() {
  const state = await getMyHoursState();

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <h1 className="text-2xl font-semibold">Mes heures</h1>
      <MyHours state={state} />
    </div>
  );
}
