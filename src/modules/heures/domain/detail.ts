import type { DateString } from "@/core/time";

import type { HoursMovement } from "./monthly";

/**
 * Ce qui a fait bouger le compteur, en français.
 *
 * `daily_delta` porte volontairement le mot « journée » et non « heures
 * supplémentaires » : un écart positif n'est pas une heure supplémentaire au
 * sens du droit du travail, c'est du temps que la direction peut rendre.
 */
export const HOURS_KIND_LABELS: Record<string, string> = {
  daily_delta: "Journée travaillée",
  recovery: "Récupération prise",
  adjustment: "Ajustement de la direction",
};

export function hoursKindLabel(kind: string): string {
  return HOURS_KIND_LABELS[kind] ?? "Mouvement";
}

/** Un mouvement du compteur, tel qu'il s'affiche. */
export interface HoursDetailRow {
  id: string;
  date: DateString;
  kind: string;
  label: string;
  /** Ce que ce mouvement ajoute ou retire au solde. */
  minutes: number;
  /** Le temps réellement travaillé, connu seulement pour une journée close. */
  workedMinutes: number | null;
  /** Ce qui était prévu ce jour-là. */
  plannedMinutes: number | null;
  note: string | null;
}

interface RawMovement extends HoursMovement {
  id: string;
  note: string | null;
}

/**
 * Le détail d'un compteur d'heures, mouvement par mouvement.
 *
 * `plannedMinutes` est déduit plutôt que relu : l'écart d'une journée **est**
 * réel − prévu, donc prévu = réel − écart. La soustraction ne peut pas diverger
 * de ce qui a été écrit dans le ledger, là où une seconde lecture du planning le
 * pourrait — le planning a pu changer depuis, et c'est le jour du calcul qui
 * fait foi.
 *
 * Seules les journées travaillées portent un prévu et un réel. Une récupération
 * ou un ajustement ne sont pas des journées : leur afficher « prévu 0 h »
 * laisserait croire qu'elle n'était pas attendue ce jour-là.
 */
export function buildHoursDetail(
  movements: readonly RawMovement[],
  workedByDate: ReadonlyMap<string, number>,
): HoursDetailRow[] {
  return movements.map((movement) => {
    const worked =
      movement.kind === "daily_delta" ? (workedByDate.get(movement.localDate) ?? null) : null;

    return {
      id: movement.id,
      date: movement.localDate,
      kind: movement.kind,
      label: hoursKindLabel(movement.kind),
      minutes: movement.minutes,
      workedMinutes: worked,
      plannedMinutes: worked === null ? null : worked - movement.minutes,
      note: movement.note,
    };
  });
}

/**
 * Ce que le détail affiché totalise.
 *
 * Affiché en tête de liste pour que la somme visible soit vérifiable : un
 * compteur qu'on ne peut pas recompter soi-même est un compteur qu'il faut
 * croire sur parole.
 */
export function detailTotal(rows: readonly HoursDetailRow[]): number {
  return rows.reduce((total, row) => total + row.minutes, 0);
}
