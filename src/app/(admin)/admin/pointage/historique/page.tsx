import type { Metadata } from "next";

import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import { Label } from "@/core/ui/label";
import { getClockHistory, historyFiltersSchema, HistoryTable } from "@/modules/pointage";

export const metadata: Metadata = { title: "Historique des pointages" };
export const dynamic = "force-dynamic";

function asString(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

export default async function ClockHistoryPage({
  searchParams,
}: PageProps<"/admin/pointage/historique">) {
  const params = await searchParams;

  const parsed = historyFiltersSchema.safeParse({
    from: asString(params.from),
    to: asString(params.to),
    employeeId: asString(params.employeeId),
    boutiqueId: asString(params.boutiqueId),
  });

  const filters = parsed.success ? parsed.data : {};
  const rows = await getClockHistory(filters);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Historique des pointages</h1>

      {/* A plain GET form: the filters survive a reload and can be bookmarked. */}
      <form
        action="/admin/pointage/historique"
        method="get"
        className="flex flex-wrap items-end gap-3"
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="from">Du</Label>
          <Input
            id="from"
            name="from"
            type="date"
            defaultValue={filters.from ?? ""}
            className="w-44"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="to">Au</Label>
          <Input id="to" name="to" type="date" defaultValue={filters.to ?? ""} className="w-44" />
        </div>
        <Button type="submit" variant="secondary">
          Filtrer
        </Button>
      </form>

      <HistoryTable rows={rows} />
    </div>
  );
}
