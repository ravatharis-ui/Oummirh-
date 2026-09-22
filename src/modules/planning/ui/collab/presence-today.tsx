import { Users } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/core/ui/card";

import type { PresentColleague } from "../../types";

/**
 * Who else is on the floor today.
 *
 * Only the people present are listed. Absences are not shown, and their reason
 * least of all: whether a colleague is off sick is between her and the direction.
 */
export function PresenceToday({ colleagues }: { colleagues: PresentColleague[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="size-5" aria-hidden />
          Avec toi aujourd&apos;hui
        </CardTitle>
      </CardHeader>
      <CardContent>
        {colleagues.length === 0 ? (
          <p className="text-muted-foreground text-base">
            Personne d&apos;autre n&apos;est prévu dans ta boutique aujourd&apos;hui.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {colleagues.map((colleague) => (
              <li key={colleague.employeeId} className="flex items-center justify-between gap-3">
                <span className="text-base">{colleague.displayName}</span>
                {colleague.startTime && colleague.endTime ? (
                  <span className="text-muted-foreground text-base tabular-nums">
                    {colleague.startTime.slice(0, 5)} – {colleague.endTime.slice(0, 5)}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
