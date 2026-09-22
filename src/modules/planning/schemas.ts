import { z } from "zod";

import { parseTimeToMinutes } from "@/core/time";

import { PLANNING_STATUSES } from "./domain/status";

const TIME = /^\d{2}:\d{2}(:\d{2})?$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function minutesOf(time: string): number {
  try {
    return parseTimeToMinutes(time);
  } catch {
    return Number.NaN;
  }
}

const optionalTime = z
  .string()
  .regex(TIME, "L'heure doit être au format HH:MM.")
  .nullable()
  .optional();

/**
 * A single day of planning.
 *
 * The same rules as the `check` constraints in SQL, said once here so the form
 * and the server action cannot drift apart. The database still refuses a bad row
 * on its own: this is a courtesy to the person filling the form, not the barrier.
 */
export const planningEntrySchema = z
  .object({
    employeeId: z.string().uuid("Collaboratrice inconnue."),
    date: z.string().regex(DATE, "Date invalide."),
    status: z.enum(PLANNING_STATUSES, { message: "Choisissez ce que représente cette journée." }),
    startTime: optionalTime,
    endTime: optionalTime,
    breakStart: optionalTime,
    breakEnd: optionalTime,
    boutiqueId: z.string().uuid("Point de vente inconnu.").nullable().optional(),
    note: z.string().trim().max(500, "La note est trop longue.").nullable().optional(),
  })
  .superRefine((value, ctx) => {
    const needsHours = value.status === "work" || value.status === "replacement";

    if (needsHours && (!value.startTime || !value.endTime)) {
      ctx.addIssue({
        code: "custom",
        path: ["startTime"],
        message: "Une journée travaillée a besoin d'une heure de début et d'une heure de fin.",
      });
      return;
    }

    if (
      value.startTime &&
      value.endTime &&
      minutesOf(value.endTime) <= minutesOf(value.startTime)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["endTime"],
        message: "L'heure de fin doit être après l'heure de début.",
      });
    }

    const hasStart = Boolean(value.breakStart);
    const hasEnd = Boolean(value.breakEnd);

    if (hasStart !== hasEnd) {
      ctx.addIssue({
        code: "custom",
        path: ["breakEnd"],
        message: "Indiquez le début et la fin de la pause, ou aucun des deux.",
      });
      return;
    }

    if (
      value.breakStart &&
      value.breakEnd &&
      minutesOf(value.breakEnd) <= minutesOf(value.breakStart)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["breakEnd"],
        message: "La fin de pause doit être après son début.",
      });
    }
  });

export type PlanningEntryInput = z.infer<typeof planningEntrySchema>;

export const planningDaySchema = z.object({
  employeeId: z.string().uuid("Collaboratrice inconnue."),
  date: z.string().regex(DATE, "Date invalide."),
});

export const duplicateWeekSchema = z
  .object({
    sourceMonday: z.string().regex(DATE, "Semaine source invalide."),
    targetMonday: z.string().regex(DATE, "Semaine cible invalide."),
    employeeIds: z.array(z.string().uuid()).nullable().optional(),
  })
  .refine((value) => value.sourceMonday !== value.targetMonday, {
    message: "La semaine cible ne peut pas être la semaine source.",
    path: ["targetMonday"],
  });

export const applyTemplateSchema = z.object({
  employeeId: z.string().uuid("Collaboratrice inconnue."),
  weekStart: z.string().regex(DATE, "Semaine invalide."),
  overwrite: z.boolean().default(false),
});

export const weekQuerySchema = z.object({
  week: z.string().regex(DATE).optional(),
  boutique: z.string().uuid().optional(),
});
