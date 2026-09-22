import { z } from "zod";

import { RECOVERY_MODES, RECOVERY_STEP_MINUTES } from "./domain/recovery";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const recoveryRequestSchema = z.object({
  date: z.string().regex(DATE, "Date invalide."),
  mode: z.enum(RECOVERY_MODES, { message: "Choisis d'arriver plus tard ou de partir plus tôt." }),
  minutes: z
    .number()
    .int()
    .positive("Choisis une durée.")
    .max(8 * 60, "Une récupération ne peut pas dépasser une journée.")
    .refine(
      (value) => value % RECOVERY_STEP_MINUTES === 0,
      "La durée se choisit par tranches de quinze minutes.",
    ),
});

export type RecoveryRequestInput = z.infer<typeof recoveryRequestSchema>;

export const recoveryDecisionSchema = z.object({
  requestId: z.string().uuid("Demande inconnue."),
  approve: z.boolean(),
  comment: z.string().trim().max(500, "Le commentaire est trop long.").nullable().optional(),
});

export const hoursAdjustmentSchema = z.object({
  employeeId: z.string().uuid("Collaboratrice inconnue."),
  minutes: z
    .number()
    .int("Indiquez un nombre entier de minutes.")
    .refine((value) => value !== 0, "Un ajustement de zéro minute n'a pas de sens.")
    .refine((value) => Math.abs(value) <= 100 * 60, "Ajustement trop important."),
  note: z
    .string()
    .trim()
    .min(5, "Expliquez l'ajustement en quelques mots.")
    .max(500, "Le motif est trop long."),
});

export type HoursAdjustmentInput = z.infer<typeof hoursAdjustmentSchema>;

export const monthQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
  boutique: z.string().uuid().optional(),
});
