/**
 * The scheduled tasks, described once.
 *
 * Same idea as the settings registry: one entry per task, and every screen that
 * talks about scheduled work is built from this list. Adding a task later means
 * adding an entry and wrapping its route — no screen to touch.
 *
 * `maxAgeMinutes` is what turns "last run at 3 a.m." into a verdict. It is
 * deliberately generous: all five tasks are idempotent and written so that a
 * missed pass is caught by the next one, so one skipped night is not worth
 * alarming a shop owner. Two is.
 */
export interface JobDefinition {
  /** Stable key, written in `job_runs.job`. Never translated. */
  key: string;
  /** What the direction sees. */
  label: string;
  /** One line saying what stops happening if this task stops. */
  description: string;
  /** How stale the last run may get before the screen calls it late. */
  maxAgeMinutes: number;
}

const HOUR = 60;

export const JOB_DEFINITIONS: readonly JobDefinition[] = [
  {
    key: "events.dispatch",
    label: "Notifications",
    description:
      "Distribue les événements : c'est elle qui fait apparaître les notifications et qui applique au planning un congé validé.",
    maxAgeMinutes: 15,
  },
  {
    key: "pointage.checks",
    label: "Alertes de retard",
    description: "Signale à la direction une arrivée attendue qui n'a pas été pointée.",
    maxAgeMinutes: HOUR,
  },
  {
    key: "heures.daily",
    label: "Calcul des heures",
    description:
      "Recalcule les heures de la veille. Filet de sécurité : le calcul se fait déjà au pointage du départ.",
    maxAgeMinutes: 36 * HOUR,
  },
  {
    key: "conges.accrual",
    label: "Acquisition des congés",
    description:
      "Crédite les jours acquis chaque mois et clôture la période au 1er juin. Sans elle, les soldes ne montent plus.",
    maxAgeMinutes: 36 * HOUR,
  },
  {
    key: "selfies.purge",
    label: "Purge des photos",
    description:
      "Efface les photos de pointage au-delà de la durée de conservation. C'est l'engagement de la page de confidentialité.",
    maxAgeMinutes: 36 * HOUR,
  },
] as const;

export function jobDefinition(key: string): JobDefinition | undefined {
  return JOB_DEFINITIONS.find((definition) => definition.key === key);
}
