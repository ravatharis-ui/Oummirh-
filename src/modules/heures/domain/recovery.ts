import { formatDuration, formatSignedDuration } from "@/core/time";

/** Arriver plus tard, ou partir plus tôt. Il n'y a pas de troisième façon. */
export const RECOVERY_MODES = ["later", "earlier"] as const;
export type RecoveryMode = (typeof RECOVERY_MODES)[number];

export const RECOVERY_MODE_LABELS: Record<RecoveryMode, string> = {
  later: "Arriver plus tard",
  earlier: "Partir plus tôt",
};

export function isRecoveryMode(value: string): value is RecoveryMode {
  return (RECOVERY_MODES as readonly string[]).includes(value);
}

/** Les durées se choisissent par paliers de quinze minutes. */
export const RECOVERY_STEP_MINUTES = 15;

/** Raccourcis proposés à l'écran, dans l'ordre où on les utilise. */
export const RECOVERY_SHORTCUTS = [30, 60, 120] as const;

export const RECOVERY_STATUS_LABELS = {
  pending: "En attente",
  approved: "Accordée",
  refused: "Refusée",
  cancelled: "Annulée",
} as const;

export type RecoveryStatus = keyof typeof RECOVERY_STATUS_LABELS;

export function isRecoveryStatus(value: string): value is RecoveryStatus {
  return value in RECOVERY_STATUS_LABELS;
}

/**
 * Ce qu'elle peut réellement demander.
 *
 * Le solde moins ce qui est déjà demandé et pas encore tranché : sans cette
 * soustraction, trois demandes de deux heures passeraient toutes les trois avec
 * un solde de deux heures. La base applique la même règle, et c'est elle qui
 * tranche ; ici, c'est pour que l'écran ne propose pas l'impossible.
 */
export function availableMinutes(balanceMinutes: number, pendingMinutes: number): number {
  return Math.max(0, balanceMinutes - pendingMinutes);
}

/** Les durées proposables, jamais au-delà du solde disponible. */
export function offeredDurations(available: number): number[] {
  const steps: number[] = [];
  for (
    let minutes = RECOVERY_STEP_MINUTES;
    minutes <= available;
    minutes += RECOVERY_STEP_MINUTES
  ) {
    steps.push(minutes);
  }
  return steps;
}

export interface RecoveryCheck {
  ok: boolean;
  /** Message en français, prêt à afficher. Vide quand tout va bien. */
  error: string;
}

/**
 * Les mêmes refus que `request_recovery()` en SQL, dits avant l'aller-retour.
 *
 * La base reste l'autorité : elle revérifie tout, y compris ce qui a changé
 * entre l'affichage de l'écran et l'envoi.
 */
export function checkRecoveryRequest(minutes: number, available: number): RecoveryCheck {
  if (!Number.isInteger(minutes) || minutes <= 0) {
    return { ok: false, error: "Choisis une durée." };
  }

  if (minutes % RECOVERY_STEP_MINUTES !== 0) {
    return { ok: false, error: "La durée se choisit par tranches de quinze minutes." };
  }

  if (minutes > available) {
    return {
      ok: false,
      error: `Ton solde disponible est de ${formatDuration(available)}.`,
    };
  }

  return { ok: true, error: "" };
}

/** "+3 h 45", "-1 h 15", "0 h" — avec le signe, parce qu'un solde a un sens. */
export function formatBalance(minutes: number): string {
  return formatSignedDuration(minutes);
}

/** Le ton d'un solde : crédit, dette, ou rien à signaler. */
export function balanceTone(minutes: number): "credit" | "debt" | "neutral" {
  if (minutes > 0) return "credit";
  if (minutes < 0) return "debt";
  return "neutral";
}

export const BALANCE_TONE_CLASS: Record<ReturnType<typeof balanceTone>, string> = {
  credit: "text-emerald-700",
  debt: "text-amber-700",
  neutral: "text-muted-foreground",
};
