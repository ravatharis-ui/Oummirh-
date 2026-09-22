import { formatDuration } from "@/core/time";

export type DeltaTone = "onTime" | "late" | "early" | "unknown";

/**
 * How an arrival compares with what the planning expected.
 *
 * The tolerance comes from `settings.late_tolerance_minutes` (10 by default):
 * being three minutes late is not being late, and a screen that says otherwise
 * teaches people to ignore it.
 */
export function deltaTone(minutes: number | null, toleranceMinutes = 10): DeltaTone {
  if (minutes === null) return "unknown";
  if (minutes > toleranceMinutes) return "late";
  if (minutes < -toleranceMinutes) return "early";
  return "onTime";
}

/** "8 min de retard", "à l'heure", "15 min d'avance". */
export function formatDelta(minutes: number | null, toleranceMinutes = 10): string {
  if (minutes === null) return "heure non prévue";

  const tone = deltaTone(minutes, toleranceMinutes);
  if (tone === "onTime") return "à l'heure";
  if (tone === "late") return `${formatDuration(minutes)} de retard`;
  return `${formatDuration(Math.abs(minutes))} d'avance`;
}

/** Tailwind classes, paired with the wording above rather than replacing it. */
export const DELTA_TONE_CLASS: Record<DeltaTone, string> = {
  onTime: "text-emerald-700",
  late: "text-amber-700",
  early: "text-sky-700",
  unknown: "text-muted-foreground",
};
