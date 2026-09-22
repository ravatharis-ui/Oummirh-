import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import { Label } from "@/core/ui/label";
import { getHoursMonth, getRecoveryRequests, HoursTable, RecoveryList } from "@/modules/heures";

export const metadata: Metadata = { title: "Heures" };
export const dynamic = "force-dynamic";

function asString(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

export default async function AdminHoursPage({ searchParams }: PageProps<"/admin/heures">) {
  const params = await searchParams;
  const requestedMonth = asString(params.month);

  const [{ month, rows }, pending] = await Promise.all([
    getHoursMonth(requestedMonth),
    getRecoveryRequests("pending"),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Heures</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">
          Demandes de récupération {pending.length > 0 ? `(${pending.length})` : ""}
        </h2>
        <RecoveryList requests={pending} />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-lg font-medium">Tableau du mois</h2>

          {/* Formulaire GET : le mois choisi survit à un rechargement. */}
          <form action="/admin/heures" method="get" className="flex items-end gap-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="month">Mois</Label>
              <Input id="month" name="month" type="month" defaultValue={month} className="w-44" />
            </div>
            <Button type="submit" variant="secondary" size="sm">
              Afficher
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={{ pathname: "/admin/heures/export", query: { month } }}>Export CSV</Link>
            </Button>
          </form>
        </div>

        <HoursTable rows={rows} />
      </section>
    </div>
  );
}
