import type { Metadata } from "next";

import { getSwapsForAdmin, SwapList } from "@/modules/swaps";

export const metadata: Metadata = { title: "Échanges" };
export const dynamic = "force-dynamic";

export default async function AdminSwapsPage() {
  const [pending, recent] = await Promise.all([
    getSwapsForAdmin("pending_admin"),
    getSwapsForAdmin(),
  ]);

  const others = recent.filter((swap) => swap.status !== "pending_admin");

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <h1 className="text-2xl font-semibold">Échanges de créneaux</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">
          À valider {pending.length > 0 ? `(${pending.length})` : ""}
        </h2>
        <SwapList swaps={pending} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Historique</h2>
        <SwapList swaps={others} />
      </section>
    </div>
  );
}
