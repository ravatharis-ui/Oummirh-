import type { JobDefinition } from "./registry";

/** The last recorded pass of one task, as the database keeps it. */
export interface JobRun {
  job: string;
  lastRunAt: string;
  lastOkAt: string | null;
  ok: boolean;
  error: string | null;
  consecutiveFailures: number;
  /** Dernière alerte envoyée à la direction, `null` si aucune en cours. */
  alertedAt?: string | null;
}

export type JobStatus = "ok" | "late" | "failing" | "never";

export interface JobHealth {
  definition: JobDefinition;
  status: JobStatus;
  run: JobRun | null;
  /** Minutes since the last pass, whatever its outcome. `null` if it never ran. */
  ageMinutes: number | null;
}

const MINUTE = 60_000;

/**
 * The verdict for one task.
 *
 * `failing` comes before `late` on purpose: a task that runs on time and errors
 * every time is fresh and broken, and "à l'heure" would be the wrong word for
 * it. A task that has never run at all is its own case — on a new installation
 * that is normal for a few hours, and saying "en panne" would be a lie.
 */
export function jobHealth(
  definition: JobDefinition,
  run: JobRun | null,
  now: Date = new Date(),
): JobHealth {
  if (run === null) {
    return { definition, status: "never", run: null, ageMinutes: null };
  }

  const ageMinutes = Math.max(0, Math.floor((now.getTime() - Date.parse(run.lastRunAt)) / MINUTE));

  if (!run.ok) return { definition, status: "failing", run, ageMinutes };
  if (ageMinutes > definition.maxAgeMinutes) {
    return { definition, status: "late", run, ageMinutes };
  }

  return { definition, status: "ok", run, ageMinutes };
}

/** True when at least one task needs a human. Drives the badge on the card. */
export function hasJobTrouble(health: readonly JobHealth[]): boolean {
  return health.some((item) => item.status === "late" || item.status === "failing");
}

/**
 * "il y a 3 minutes", "hier à 23 h 30".
 *
 * Written here rather than with date-fns because the phrasing has to stay short
 * enough for a dashboard card, and because a task that ran seconds ago should
 * read "à l'instant" rather than "il y a 0 minute".
 */
export function formatJobAge(ageMinutes: number | null): string {
  if (ageMinutes === null) return "jamais";
  if (ageMinutes < 1) return "à l'instant";
  if (ageMinutes < 60) return `il y a ${ageMinutes} min`;

  const hours = Math.floor(ageMinutes / 60);
  if (hours < 24) return `il y a ${hours} h`;

  const days = Math.floor(hours / 24);
  return days === 1 ? "hier" : `il y a ${days} jours`;
}

/** Une alerte n'est pas répétée avant ce délai, même si la panne dure. */
export const ALERT_COOLDOWN_HOURS = 24;

/**
 * Faut-il prévenir la direction pour cette tâche ?
 *
 * Trois refus délibérés :
 *   - **`never` n'alerte pas.** Sur une installation neuve, une tâche de nuit
 *     n'a pas encore tourné et c'est normal ; un voyant rouge injustifié apprend
 *     à ne plus regarder les voyants.
 *   - **une alerte déjà envoyée ne repart pas**, tant que la panne dure. Le
 *     guetteur passe toutes les minutes ; sans ce frein, une panne de week-end
 *     ferait trois mille notifications.
 *   - **mais elle repart au bout de 24 h.** Une panne qu'on a laissée courir une
 *     journée mérite un second rappel, sinon la première notification se perd
 *     sous les autres.
 */
export function shouldAlert(health: JobHealth, now: Date = new Date()): boolean {
  if (health.status !== "late" && health.status !== "failing") return false;

  const alertedAt = health.run?.alertedAt;
  if (!alertedAt) return true;

  const hours = (now.getTime() - Date.parse(alertedAt)) / 3_600_000;
  return hours >= ALERT_COOLDOWN_HOURS;
}

/**
 * Ce que la direction lit dans sa cloche.
 *
 * Le libellé dit quelle tâche, la phrase dit **ce qu'on est en train de
 * perdre** — pas « erreur technique ». Le gérant doit pouvoir décider s'il
 * m'appelle tout de suite ou lundi sans avoir à comprendre ce qu'est un cron.
 */
export function alertTitle(health: JobHealth): string {
  return health.status === "failing"
    ? `${health.definition.label} : en échec`
    : `${health.definition.label} : plus rien depuis ${formatJobAge(health.ageMinutes)}`;
}

export function alertBody(health: JobHealth): string {
  const consequence = health.definition.description;

  return health.status === "failing"
    ? `${consequence} La tâche s'est lancée mais a échoué${
        health.run?.error ? ` : ${health.run.error}` : "."
      } Prévenez votre développeur.`
    : `${consequence} Elle aurait dû se relancer depuis longtemps. Prévenez votre développeur.`;
}
