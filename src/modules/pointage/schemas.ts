import { z } from "zod";

import { CLOCK_EVENTS } from "./domain/sequence";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A selfie path is `<employee_id>/<uuid>.jpg`.
 *
 * Checked here and again by the database, which compares the first folder with
 * the caller's own identifier. This one only catches an obviously malformed
 * value before it costs a round trip.
 */
export const photoPathSchema = z
  .string()
  .regex(/^[0-9a-f-]{36}\/[0-9a-z-]+\.jpe?g$/i, "Chemin de photo invalide.");

export const clockEventSchema = z.object({
  eventType: z.enum(CLOCK_EVENTS, { message: "Type de pointage inconnu." }),
  photoPath: photoPathSchema.nullable().optional(),
});

export const correctionSchema = z.object({
  employeeId: z.string().uuid("Collaboratrice inconnue."),
  localDate: z.string().regex(DATE, "Date invalide."),
  eventType: z.enum(CLOCK_EVENTS, { message: "Type de pointage inconnu." }),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Heure invalide (HH:MM)."),
  reason: z
    .string()
    .trim()
    .min(5, "Expliquez la correction en quelques mots.")
    .max(500, "Le motif est trop long."),
});

export type CorrectionInput = z.infer<typeof correctionSchema>;

export const historyFiltersSchema = z.object({
  from: z.string().regex(DATE).optional(),
  to: z.string().regex(DATE).optional(),
  employeeId: z.string().uuid().optional(),
  boutiqueId: z.string().uuid().optional(),
});

export type HistoryFilters = z.infer<typeof historyFiltersSchema>;
