import type { DateString } from "@/core/time";

/** Un mouvement du ledger, réduit à ce dont les totaux ont besoin. */
export interface HoursMovement {
  kind: string;
  minutes: number;
  localDate: DateString;
}

export interface MonthlyTotals {
  /** Ce que les journées ont réellement produit, en écart au planning. */
  dailyMinutes: number;
  /** Ce qui a été repris en arrivant plus tard ou en partant plus tôt. */
  recoveryMinutes: number;
  /** Les corrections de la direction. */
  adjustmentMinutes: number;
  /** La somme des trois : ce que le mois a changé au solde. */
  monthMinutes: number;
}

/**
 * Les totaux d'un mois.
 *
 * Séparés par nature, parce que « −2 h ce mois-ci » ne veut pas dire la même
 * chose selon qu'elle a moins travaillé ou qu'elle a pris ses heures.
 */
export function monthlyTotals(movements: readonly HoursMovement[], month: string): MonthlyTotals {
  const prefix = month.slice(0, 7);
  const inMonth = movements.filter((movement) => movement.localDate.startsWith(prefix));

  const sum = (kind: string): number =>
    inMonth
      .filter((movement) => movement.kind === kind)
      .reduce((total, movement) => total + movement.minutes, 0);

  const dailyMinutes = sum("daily_delta");
  const recoveryMinutes = sum("recovery");
  const adjustmentMinutes = sum("adjustment");

  return {
    dailyMinutes,
    recoveryMinutes,
    adjustmentMinutes,
    monthMinutes: dailyMinutes + recoveryMinutes + adjustmentMinutes,
  };
}

/** Le solde cumulé : tout, depuis le début. */
export function cumulativeMinutes(movements: readonly HoursMovement[]): number {
  return movements.reduce((total, movement) => total + movement.minutes, 0);
}

/**
 * Une ligne CSV, séparateur point-virgule et décimales à la virgule.
 *
 * Excel en français ouvre un CSV à la virgule en mettant tout dans une colonne ;
 * le point-virgule est ce qu'il attend.
 */
export function toCsv(rows: readonly (readonly (string | number)[])[]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const text = typeof cell === "number" ? cell.toLocaleString("fr-FR") : cell;
          return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
        })
        .join(";"),
    )
    .join("\r\n");
}
