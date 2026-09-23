import { z } from "zod";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const swapRequestSchema = z.object({
  partnerId: z.string().uuid("Choisissez une collègue."),
  requesterDate: z.string().regex(DATE, "Choisissez la journée que tu proposes."),
  partnerDate: z.string().regex(DATE, "Choisissez la journée que tu veux récupérer."),
  message: z.string().trim().max(500, "Le message est trop long.").nullable().optional(),
});

export type SwapRequestInput = z.infer<typeof swapRequestSchema>;

export const swapDecisionSchema = z.object({
  swapId: z.string().uuid("Échange inconnu."),
  approve: z.boolean(),
  comment: z.string().trim().max(500, "Le commentaire est trop long.").nullable().optional(),
});
