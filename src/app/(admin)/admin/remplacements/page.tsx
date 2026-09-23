import type { Metadata } from "next";

import { createServerSupabaseClient } from "@/core/db/server";
import { getSettings } from "@/core/settings";
import { listReplacements, ReplacementList } from "@/modules/remplacements";

export const metadata: Metadata = { title: "Remplacements" };
export const dynamic = "force-dynamic";

export default async function ReplacementsPage() {
  const [replacements, settings, supabase] = await Promise.all([
    listReplacements(),
    getSettings(),
    createServerSupabaseClient(),
  ]);

  const { data: boutiques } = await supabase
    .from("boutiques")
    .select("id, name")
    .eq("is_active", true)
    .order("sort_order");

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Remplacements directs</h1>

      <ReplacementList
        replacements={replacements}
        boutiques={boutiques ?? []}
        defaultStart={settings.default_schedule.start.slice(0, 5)}
        defaultEnd={settings.default_schedule.end.slice(0, 5)}
      />
    </div>
  );
}
