import { z } from "zod";

import { parseTimeToMinutes } from "@/core/time";

const TIME = /^\d{2}:\d{2}(:\d{2})?$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function minutesOf(time: string): number {
  try {
    return parseTimeToMinutes(time);
  } catch {
    return Number.NaN;
  }
}

/** Les trois étapes du formulaire aboutissent à ceci, et rien d'autre. */
export const replacementSchema = z
  .object({
    boutiqueId: z.string().uuid("Choisissez le point de vente qui a besoin de renfort."),
    date: z.string().regex(DATE, "Date invalide."),
    employeeId: z.string().uuid("Choisissez une collaboratrice."),
    startTime: z.string().regex(TIME, "L'heure de début doit être au format HH:MM."),
    endTime: z.string().regex(TIME, "L'heure de fin doit être au format HH:MM."),
    breakStart: z.string().regex(TIME).nullable().optional(),
    breakEnd: z.string().regex(TIME).nullable().optional(),
    note: z.string().trim().max(500, "La note est trop longue.").nullable().optional(),
  })
  .refine((value) => minutesOf(value.endTime) > minutesOf(value.startTime), {
    message: "L'heure de fin doit être après l'heure de début.",
    path: ["endTime"],
  })
  .refine((value) => Boolean(value.breakStart) === Boolean(value.breakEnd), {
    message: "Indiquez le début et la fin de la pause, ou aucun des deux.",
    path: ["breakEnd"],
  });

export type ReplacementInput = z.infer<typeof replacementSchema>;
