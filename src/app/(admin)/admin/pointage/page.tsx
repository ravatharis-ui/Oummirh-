import type { Metadata } from "next";
import Link from "next/link";

import { todayInReunion } from "@/core/time";
import { Button } from "@/core/ui/button";
import { getPresenceBoard, PresenceBoard } from "@/modules/pointage";

export const metadata: Metadata = { title: "Pointage" };
export const dynamic = "force-dynamic";

function asString(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

export default async function AdminPointagePage({ searchParams }: PageProps<"/admin/pointage">) {
  const params = await searchParams;
  const date = asString(params.date) ?? todayInReunion();
  const rows = await getPresenceBoard(date);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Présence du jour</h1>
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/pointage/historique">Historique et corrections</Link>
        </Button>
      </div>

      <PresenceBoard rows={rows} date={date} />
    </div>
  );
}
