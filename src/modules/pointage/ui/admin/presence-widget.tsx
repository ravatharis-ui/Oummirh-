import { Clock } from "lucide-react";
import Link from "next/link";

import { formatFrDate, todayInReunion } from "@/core/time";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/core/ui/card";

import { getPresenceBoard } from "../../server/queries";
import type { PresenceRow } from "../../types";

/** Only the days someone was expected to work say anything about presence. */
function isExpected(row: PresenceRow): boolean {
  return (
    row.plannedStatus === null ||
    row.plannedStatus === "work" ||
    row.plannedStatus === "replacement"
  );
}

/**
 * Today's presence, in four numbers.
 *
 * The dashboard answers one question — "is everyone where they should be right
 * now?" — and sends to `/admin/pointage` for the detail. It is deliberately not
 * a second copy of the board: one live table is enough to maintain.
 */
export async function PresenceWidget() {
  const date = todayInReunion();
  const rows = (await getPresenceBoard(date)).filter(isExpected);

  const present = rows.filter((row) => row.last === "clock_in" || row.last === "break_end").length;
  const onBreak = rows.filter((row) => row.last === "break_start").length;
  const left = rows.filter((row) => row.last === "clock_out").length;
  const notYet = rows.filter((row) => row.last === null).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="size-5" aria-hidden /> Présence en direct
        </CardTitle>
        <CardDescription className="capitalize">{formatFrDate(date)}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Personne n&apos;est attendue aujourd&apos;hui.
          </p>
        ) : (
          <dl className="grid grid-cols-2 gap-3">
            <Figure label="Présentes" value={present} />
            <Figure label="En pause" value={onBreak} />
            <Figure label="Pas encore arrivées" value={notYet} />
            <Figure label="Parties" value={left} />
          </dl>
        )}

        <Link href="/admin/pointage" className="text-sm font-medium underline underline-offset-4">
          Voir le détail par point de vente
        </Link>
      </CardContent>
    </Card>
  );
}

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
