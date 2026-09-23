import type { Metadata } from "next";

import { getMySwapsState, SwapScreen } from "@/modules/swaps";

export const metadata: Metadata = { title: "Échanges" };
export const dynamic = "force-dynamic";

export default async function CollabSwapsPage() {
  const state = await getMySwapsState();

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <h1 className="text-2xl font-semibold">Échanger une journée</h1>
      <SwapScreen state={state} />
    </div>
  );
}
