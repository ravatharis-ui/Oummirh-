import type { HoursMovement } from "./monthly";

/**
 * Les trois chiffres du compteur d'heures.
 *
 * Même logique que les congés : `available` est le solde réel et non une
 * soustraction, parce que le compteur ne repart pas de zéro chaque année.
 */
export interface HoursCounters {
  /** Ce que les journées ont produit, plus les ajustements de la direction. */
  earned: number;
  /** Le solde réel, en minutes. */
  available: number;
  /** Ce qui a été repris en récupération. Toujours positif à l'affichage. */
  used: number;
}

export function hoursCounters(movements: readonly HoursMovement[], balance: number): HoursCounters {
  const sum = (kinds: readonly string[]): number =>
    movements
      .filter((movement) => kinds.includes(movement.kind))
      .reduce((total, movement) => total + movement.minutes, 0);

  return {
    earned: sum(["daily_delta", "adjustment"]),
    available: balance,
    used: Math.abs(sum(["recovery"])),
  };
}
