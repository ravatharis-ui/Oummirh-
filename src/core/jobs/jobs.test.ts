import { describe, expect, it } from "vitest";

import {
  alertBody,
  alertTitle,
  formatJobAge,
  hasJobTrouble,
  jobHealth,
  shouldAlert,
  type JobRun,
} from "./health";
import { JOB_DEFINITIONS, jobDefinition, type JobDefinition } from "./registry";

const daily = jobDefinition("conges.accrual");
const minutely = jobDefinition("events.dispatch");

if (!daily || !minutely) throw new Error("Registre des tâches incomplet.");

// Réaffectés sans « undefined » : une fonction déclarée plus bas ne conserve pas
// l'affinement du garde ci-dessus.
const DAILY: JobDefinition = daily;
const MINUTELY: JobDefinition = minutely;

const NOW = new Date("2026-09-23T08:00:00.000Z");

function run(overrides: Partial<JobRun> = {}): JobRun {
  return {
    job: "conges.accrual",
    lastRunAt: "2026-09-23T07:00:00.000Z",
    lastOkAt: "2026-09-23T07:00:00.000Z",
    ok: true,
    error: null,
    consecutiveFailures: 0,
    ...overrides,
  };
}

describe("santé des tâches planifiées", () => {
  it("une tâche qui vient de passer est à jour", () => {
    const health = jobHealth(DAILY, run(), NOW);
    expect(health.status).toBe("ok");
    expect(health.ageMinutes).toBe(60);
  });

  it("une tâche qui n'a jamais tourné se distingue d'une tâche en panne", () => {
    // Sur une installation neuve, c'est normal pendant quelques heures : dire
    // « en panne » serait un mensonge, et un voyant rouge injustifié apprend à
    // ne plus regarder les voyants.
    expect(jobHealth(DAILY, null, NOW).status).toBe("never");
  });

  it("une nuit sautée ne déclenche rien, deux oui", () => {
    const oneNight = run({ lastRunAt: "2026-09-22T07:00:00.000Z" }); // 25 h
    expect(jobHealth(DAILY, oneNight, NOW).status).toBe("ok");

    const twoNights = run({ lastRunAt: "2026-09-21T07:00:00.000Z" }); // 49 h
    expect(jobHealth(DAILY, twoNights, NOW).status).toBe("late");
  });

  it("le distributeur d'événements est jugé à la minute, pas à la nuit", () => {
    const anHourAgo = run({ job: "events.dispatch", lastRunAt: "2026-09-23T07:00:00.000Z" });
    expect(jobHealth(MINUTELY, anHourAgo, NOW).status).toBe("late");
  });

  it("une tâche fraîche mais en erreur est en échec, jamais « à jour »", () => {
    const broken = run({ ok: false, error: "boom", consecutiveFailures: 3 });
    const health = jobHealth(DAILY, broken, NOW);

    expect(health.status).toBe("failing");
    // Elle a tourné il y a une heure : « en retard » serait le mauvais mot.
    expect(health.ageMinutes).toBe(60);
  });

  it("une horloge en avance ne produit jamais un âge négatif", () => {
    const future = run({ lastRunAt: "2026-09-23T09:00:00.000Z" });
    expect(jobHealth(DAILY, future, NOW).ageMinutes).toBe(0);
  });

  it("le signal global ne s'allume que pour un vrai problème", () => {
    // Un passage à la minute : même la tâche la plus exigeante est à jour.
    const justNow = run({ lastRunAt: "2026-09-23T07:59:00.000Z" });
    const fine = JOB_DEFINITIONS.map((definition) => jobHealth(definition, justNow, NOW));
    expect(hasJobTrouble(fine)).toBe(false);

    const never = JOB_DEFINITIONS.map((definition) => jobHealth(definition, null, NOW));
    expect(hasJobTrouble(never)).toBe(false);

    const broken = [jobHealth(DAILY, run({ ok: false }), NOW)];
    expect(hasJobTrouble(broken)).toBe(true);
  });

  it("chaque tâche du registre a un libellé, une conséquence et un délai", () => {
    for (const definition of JOB_DEFINITIONS) {
      expect(definition.label.length).toBeGreaterThan(0);
      expect(definition.description.length).toBeGreaterThan(20);
      expect(definition.maxAgeMinutes).toBeGreaterThan(0);
    }

    const keys = JOB_DEFINITIONS.map((definition) => definition.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("formatJobAge", () => {
  it("dit le temps comme on le dirait à voix haute", () => {
    expect(formatJobAge(null)).toBe("jamais");
    expect(formatJobAge(0)).toBe("à l'instant");
    expect(formatJobAge(3)).toBe("il y a 3 min");
    expect(formatJobAge(59)).toBe("il y a 59 min");
    expect(formatJobAge(60)).toBe("il y a 1 h");
    expect(formatJobAge(23 * 60)).toBe("il y a 23 h");
    expect(formatJobAge(25 * 60)).toBe("hier");
    expect(formatJobAge(72 * 60)).toBe("il y a 3 jours");
  });
});

describe("quand prévenir la direction", () => {
  function health(status: "ok" | "late" | "failing" | "never", alertedAt: string | null = null) {
    const run =
      status === "never"
        ? null
        : {
            ...runFor(status),
            alertedAt,
          };

    return jobHealth(DAILY, run, NOW);
  }

  function runFor(status: "ok" | "late" | "failing"): JobRun {
    if (status === "failing") return run({ ok: false, error: "boom" });
    if (status === "late") return run({ lastRunAt: "2026-09-21T07:00:00.000Z" });
    return run();
  }

  it("une tâche à jour ne dérange personne", () => {
    expect(shouldAlert(health("ok"), NOW)).toBe(false);
  });

  it("une tâche jamais lancée ne dérange personne non plus", () => {
    // Sur une installation neuve c'est l'état normal des tâches de nuit.
    expect(shouldAlert(health("never"), NOW)).toBe(false);
  });

  it("une tâche en retard ou en échec alerte", () => {
    expect(shouldAlert(health("late"), NOW)).toBe(true);
    expect(shouldAlert(health("failing"), NOW)).toBe(true);
  });

  it("une alerte déjà envoyée ne repart pas à chaque passage", () => {
    // Le guetteur passe toutes les minutes : sans ce frein, une panne de
    // week-end ferait trois mille notifications.
    const alerted = health("failing", "2026-09-23T07:30:00.000Z"); // 30 min plus tôt
    expect(shouldAlert(alerted, NOW)).toBe(false);
  });

  it("mais elle repart au bout de vingt-quatre heures", () => {
    const old = health("failing", "2026-09-22T07:00:00.000Z"); // 25 h plus tôt
    expect(shouldAlert(old, NOW)).toBe(true);
  });

  it("le message dit ce qu'on perd, pas « erreur technique »", () => {
    const broken = health("failing");

    expect(alertTitle(broken)).toContain(DAILY.label);
    // La conséquence métier, telle que le registre la décrit.
    expect(alertBody(broken)).toContain("soldes ne montent plus");
    expect(alertBody(broken)).toContain("boom");
  });

  it("une tâche muette dit depuis combien de temps", () => {
    expect(alertTitle(health("late"))).toContain("il y a 2 jours");
  });
});
