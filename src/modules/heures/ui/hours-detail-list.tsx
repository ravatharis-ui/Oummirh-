import { formatDuration, formatFrDateShort } from "@/core/time";
import { cn } from "@/core/ui/utils";

import { detailTotal, type HoursDetailRow } from "../domain/detail";
import { BALANCE_TONE_CLASS, balanceTone, formatBalance } from "../domain/recovery";

/**
 * Le compteur d'heures, mouvement par mouvement.
 *
 * Le même composant des deux côtés : la collaboratrice et la direction doivent
 * voir exactement la même chose, sinon la conversation porte sur l'écran qui a
 * tort plutôt que sur la journée en cause.
 *
 * Chaque journée travaillée dit **ce qui était prévu et ce qui a été fait**,
 * pas seulement l'écart. « −15 min » sans « prévu 9 h – 17 h, réel 9 h 15 –
 * 17 h » n'est pas vérifiable, et un compteur qu'on ne peut pas recompter
 * soi-même est un compteur qu'il faut croire sur parole.
 */
export function HoursDetailList({ rows }: { rows: readonly HoursDetailRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground rounded-xl border border-dashed p-6 text-center text-base">
        Aucun mouvement pour le moment. Le compteur se remplit à chaque départ pointé.
      </p>
    );
  }

  const total = detailTotal(rows);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-sm">
        {rows.length} mouvement{rows.length > 1 ? "s" : ""}, total{" "}
        <span className={cn("font-medium tabular-nums", BALANCE_TONE_CLASS[balanceTone(total)])}>
          {formatBalance(total)}
        </span>
        .
      </p>

      <ul className="flex flex-col">
        {rows.map((row) => (
          <DetailLine key={row.id} row={row} />
        ))}
      </ul>
    </div>
  );
}

function DetailLine({ row }: { row: HoursDetailRow }) {
  const tone = balanceTone(row.minutes);

  return (
    <li className="flex items-start justify-between gap-3 border-b py-3 last:border-b-0">
      <div className="flex flex-col gap-0.5">
        <span className="text-base font-medium">{formatFrDateShort(row.date)}</span>
        <span className="text-muted-foreground text-sm">{row.label}</span>

        {row.plannedMinutes !== null && row.workedMinutes !== null ? (
          <span className="text-muted-foreground text-sm tabular-nums">
            Prévu {formatDuration(row.plannedMinutes)} · Réel {formatDuration(row.workedMinutes)}
          </span>
        ) : row.note ? (
          <span className="text-muted-foreground text-sm">{row.note}</span>
        ) : null}
      </div>

      <span className={cn("text-base font-semibold tabular-nums", BALANCE_TONE_CLASS[tone])}>
        {formatBalance(row.minutes)}
      </span>
    </li>
  );
}
