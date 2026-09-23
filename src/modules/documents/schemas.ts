import { z } from "zod";

import { DOCUMENT_CATEGORIES } from "./domain/categories";
import { MAX_DOCUMENT_BYTES } from "./domain/file";

const MONTH = /^\d{4}-\d{2}-01$/;

/**
 * L'enregistrement d'un document déjà déposé dans le stockage.
 *
 * Le fichier ne passe pas par ici : il va du navigateur de la direction
 * directement au bucket. Ce schéma ne décrit que la ligne à écrire.
 */
export const documentSchema = z
  .object({
    employeeId: z.string().uuid("Choisissez une collaboratrice."),
    category: z.enum(DOCUMENT_CATEGORIES, { message: "Choisissez une catégorie." }),
    title: z
      .string()
      .trim()
      .min(1, "Le document doit porter un titre.")
      .max(200, "Le titre est trop long."),
    periodMonth: z.string().regex(MONTH, "Période invalide.").nullable().optional(),
    storagePath: z.string().min(1).max(400),
    sizeBytes: z
      .number()
      .int()
      .positive("Ce fichier est vide.")
      .max(MAX_DOCUMENT_BYTES, "Ce fichier dépasse 10 Mo."),
  })
  .refine((value) => value.category !== "payslip" || Boolean(value.periodMonth), {
    message: "Une fiche de paie doit porter son mois, sinon on ne la retrouve pas.",
    path: ["periodMonth"],
  });

export type DocumentInput = z.infer<typeof documentSchema>;
