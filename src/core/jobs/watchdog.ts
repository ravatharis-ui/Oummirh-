import "server-only";

import { createAdminSupabaseClient } from "@/core/db/admin";

import { alertBody, alertTitle, jobHealth, shouldAlert, type JobRun } from "./health";
import { JOB_DEFINITIONS } from "./registry";

const NOTIFICATION_TYPE = "jobs.stalled";

/**
 * Le guetteur des tâches planifiées.
 *
 * Il n'a pas sa propre tâche, et c'est voulu : une tâche chargée de surveiller
 * les tâches serait elle-même sujette au silence qu'elle est censée détecter, et
 * rien ne la surveillerait. Il s'exécute donc **à la fin de chaque passage**,
 * quel qu'il soit. Le distributeur d'événements tournant toutes les minutes, le
 * guetteur tourne toutes les minutes.
 *
 * Sa limite, qu'il faut connaître : si **toutes** les tâches s'arrêtent en même
 * temps — la plateforme entière tombe, les tâches planifiées sont désactivées —
 * plus personne ne passe, donc plus personne ne guette. Ce cas-là reste visible
 * sur le tableau de bord, jamais par notification. Aucune alerte ne peut
 * s'envoyer depuis une machine éteinte.
 *
 * Il n'écrit jamais dans la notification autre chose que ce que le registre
 * déclare, et il ne fait jamais échouer le passage qui l'appelle : prévenir est
 * un service rendu, pas une étape du travail.
 */
export async function checkJobsAndAlert(now: Date = new Date()): Promise<void> {
  try {
    const admin = createAdminSupabaseClient();

    const { data, error } = await admin
      .from("job_runs")
      .select("job, last_run_at, last_ok_at, ok, error, consecutive_failures, alerted_at");

    if (error) {
      console.warn("[jobs] Guetteur : lecture impossible", error.message);
      return;
    }

    const runs = new Map<string, JobRun>(
      (data ?? []).map((row) => [
        row.job,
        {
          job: row.job,
          lastRunAt: row.last_run_at,
          lastOkAt: row.last_ok_at,
          ok: row.ok,
          error: row.error,
          consecutiveFailures: row.consecutive_failures,
          alertedAt: row.alerted_at,
        },
      ]),
    );

    const troubled = JOB_DEFINITIONS.map((definition) =>
      jobHealth(definition, runs.get(definition.key) ?? null, now),
    ).filter((health) => shouldAlert(health, now));

    if (troubled.length === 0) return;

    const { data: admins } = await admin.from("user_roles").select("user_id").eq("role", "admin");
    const recipients = (admins ?? []).map((row) => row.user_id);

    for (const health of troubled) {
      for (const recipient of recipients) {
        await admin.rpc("notify_user", {
          p_recipient_user_id: recipient,
          p_type: NOTIFICATION_TYPE,
          p_title: alertTitle(health),
          p_body: alertBody(health),
          p_href: "/admin",
          p_payload: { job: health.definition.key, status: health.status },
        });
      }

      // Marqué même sans destinataire : sans direction créée, réessayer chaque
      // minute n'enverrait rien et écrirait quand même.
      await admin.rpc("mark_job_alerted", { p_job: health.definition.key });
    }
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    console.warn("[jobs] Guetteur interrompu", message);
  }
}
