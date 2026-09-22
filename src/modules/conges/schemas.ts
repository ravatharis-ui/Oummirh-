import { z } from "zod";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

const half = z.enum(["am", "pm"]).nullable().optional();

/**
 * Une demande de congé.
 *
 * Le nombre de jours n'est **pas** dans ce schéma, volontairement : il est
 * calculé par la base, à la demande puis à la validation. Accepter un décompte
 * venu du navigateur reviendrait à laisser quelqu'un choisir son propre solde.
 */
export const leaveRequestSchema = z
  .object({
    startDate: z.string().regex(DATE, "Date de début invalide."),
    endDate: z.string().regex(DATE, "Date de fin invalide."),
    startHalf: half,
    endHalf: half,
    reason: z.string().trim().max(500, "Le motif est trop long.").nullable().optional(),
    justificationPath: z.string().max(400).nullable().optional(),
  })
  .refine((value) => value.endDate >= value.startDate, {
    message: "La date de fin doit être après la date de début.",
    path: ["endDate"],
  });

export type LeaveRequestInput = z.infer<typeof leaveRequestSchema>;

export const leaveDecisionSchema = z.object({
  requestId: z.string().uuid("Demande inconnue."),
  approve: z.boolean(),
  comment: z.string().trim().max(500, "Le commentaire est trop long.").nullable().optional(),
});

export const leaveAdjustmentSchema = z.object({
  employeeId: z.string().uuid("Collaboratrice inconnue."),
  days: z
    .number()
    .refine((value) => value !== 0, "Un ajustement de zéro jour n'a pas de sens.")
    .refine((value) => Math.abs(value) <= 60, "Ajustement trop important."),
  note: z
    .string()
    .trim()
    .min(5, "Expliquez l'ajustement en quelques mots.")
    .max(500, "Le motif est trop long."),
});

export type LeaveAdjustmentInput = z.infer<typeof leaveAdjustmentSchema>;
