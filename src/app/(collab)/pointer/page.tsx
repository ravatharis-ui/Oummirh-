import type { Metadata } from "next";

import { ClockScreen, getClockState } from "@/modules/pointage";

export const metadata: Metadata = { title: "Pointer" };
export const dynamic = "force-dynamic";

export default async function ClockPage() {
  const state = await getClockState();

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <h1 className="sr-only">Pointer</h1>
      <ClockScreen state={state} />
    </div>
  );
}
