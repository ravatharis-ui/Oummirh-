import type { DateString } from "@/core/time";

import type { LeaveMovement } from "../types";

import { periodEnd } from "./period";

/**
 * Les trois chiffres d'un compteur de congés.
 *
 * Ils ne se déduisent pas l'un de l'autre, et c'est le point : `available` n'est
 * pas `earned - used`, parce qu'un report de la période précédente entre dans le
 * solde sans avoir été acquis cette année. Les afficher séparément évite la
 * question « pourquoi ça ne tombe pas juste ? » — qui, elle, finit toujours par
 * arriver.
 */
export interface LeaveCounters {
  /** Acquis sur la période : l'acquisition mensuelle et le report entrant. */
  earned: number;
  /** Le solde réel, aujourd'hui, toutes périodes confondues. */
  available: number;
  /** Pris sur la période, validé. Toujours positif à l'affichage. */
  used: number;
}

/** La période juin → mai qui contient ce jour-là. */
function inPeriod(occurredOn: DateString, start: DateString): boolean {
  return occurredOn >= start && occurredOn < periodEnd(start);
}

/**
 * @param balance Le solde du jour, tel que la base le calcule. Il n'est jamais
 *   recalculé ici : la somme des mouvements affichés serait tronquée par la
 *   limite de la requête, et un compteur faux vaut moins que pas de compteur.
 */
export function leaveCounters(
  movements: readonly LeaveMovement[],
  periodStart: DateString,
  balance: number,
): LeaveCounters {
  const period = movements.filter((movement) => inPeriod(movement.occurredOn, periodStart));

  const sum = (kinds: readonly string[]): number =>
    period
      .filter((movement) => kinds.includes(movement.kind))
      .reduce((total, movement) => total + movement.days, 0);

  return {
    earned: sum(["accrual", "carry_over"]),
    available: balance,
    // `taken` est négatif dans le registre : on l'affiche en positif, parce que
    // « jours utilisés : −12 » ne veut rien dire.
    used: Math.abs(sum(["taken"])),
  };
}
