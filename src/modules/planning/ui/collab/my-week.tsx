import { GraduationCap } from "lucide-react";

import { Badge } from "@/core/ui/badge";
import { Card, CardContent } from "@/core/ui/card";
import { formatDuration, formatFrDate, todayInReunion, type DateString } from "@/core/time";
import { cn } from "@/core/ui/utils";

import { statusMeta } from "../../domain/status";
import type { PlanningEntry } from "../../types";

interface MyWeekProps {
  dates: DateString[];
  entries: Record<DateString, PlanningEntry>;
  plannedMinutes: number;
  today?: DateString;
}

/**
 * The collaboratrice's week, as a vertical list.
 *
 * Not a grid: a seven-column table on a phone means pinching and scrolling
 * sideways to read your own Thursday. One card per day reads at a glance, thumb
 * on the screen.
 */
export function MyWeek({ dates, entries, plannedMinutes, today }: MyWeekProps) {
  const currentDay = today ?? todayInReunion();

  return (
    <div className="flex flex-col gap-3">
      {dates.map((date) => {
        const entry = entries[date];
        const meta = entry ? statusMeta(entry.status) : null;
        const isToday = date === currentDay;

        return (
          <Card
            key={date}
            className={cn(isToday && "ring-primary ring-2", meta ? meta.cell : undefined)}
          >
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="text-base font-medium capitalize">
                  {formatFrDate(date)}
                  {isToday ? (
                    <span className="ml-2 text-sm font-normal">(aujourd&apos;hui)</span>
                  ) : null}
                </p>
                {entry?.note ? <p className="mt-1 text-sm">{entry.note}</p> : null}
              </div>

              <div className="text-right">
                {entry && meta ? (
                  <>
                    <Badge variant="outline" className="border-current">
                      {entry.status === "school" ? (
                        <GraduationCap className="size-3.5" aria-hidden />
                      ) : null}
                      {meta.label}
                    </Badge>
                    {entry.startTime && entry.endTime ? (
                      <p className="mt-1 text-base font-medium tabular-nums">
                        {entry.startTime.slice(0, 5)} – {entry.endTime.slice(0, 5)}
                      </p>
                    ) : null}
                  </>
                ) : (
                  <span className="text-muted-foreground text-sm">Non renseigné</span>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

      <p className="text-muted-foreground text-sm">
        Total prévu cette semaine : <strong>{formatDuration(plannedMinutes)}</strong>
      </p>
    </div>
  );
}
