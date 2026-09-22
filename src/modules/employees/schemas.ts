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

/**
 * The authoritative rules, in their final shape.
 *
 * A server action is a public HTTP endpoint, so it revalidates whatever the
 * browser sent rather than trusting it. These rules are also the ones the form
 * shows, through `employeeFormSchema` below, so the two can never disagree.
 */
export const employeeInputSchema = z
  .object({
    lastName: z.string().trim().min(1, "Le nom est obligatoire.").max(100, "Le nom est trop long."),
    firstName: z
      .string()
      .trim()
      .min(1, "Le prénom est obligatoire.")
      .max(100, "Le prénom est trop long."),
    displayName: z
      .string()
      .trim()
      .min(1, "Le prénom affiché est obligatoire.")
      .max(60, "Le prénom affiché est trop long."),

    boutiqueId: z.string().uuid("Choisissez un point de vente."),
    contractTypeId: z.string().uuid("Choisissez un type de contrat."),

    email: z.string().email("Adresse email invalide.").nullable(),
    phone: z.string().trim().max(30, "Numéro de téléphone trop long.").nullable(),

    weeklyContractHours: z
      .number()
      .positive("Les heures hebdomadaires doivent être supérieures à zéro.")
      .max(60, "Les heures hebdomadaires dépassent le maximum autorisé.")
      .nullable(),

    defaultStart: z.string().regex(TIME, "L'heure de début doit être au format HH:MM."),
    defaultEnd: z.string().regex(TIME, "L'heure de fin doit être au format HH:MM."),
    defaultBreakStart: z
      .string()
      .regex(TIME, "Le début de pause doit être au format HH:MM.")
      .nullable(),
    defaultBreakEnd: z
      .string()
      .regex(TIME, "La fin de pause doit être au format HH:MM.")
      .nullable(),

    workDays: z
      .array(z.number().int().min(1).max(7))
      .min(1, "Sélectionnez au moins un jour travaillé.")
      .max(7),

    hireDate: z.string().regex(DATE, "Date d'embauche invalide.").nullable(),
  })
  .refine((value) => minutesOf(value.defaultEnd) > minutesOf(value.defaultStart), {
    message: "L'heure de fin doit être après l'heure de début.",
    path: ["defaultEnd"],
  })
  .refine((value) => (value.defaultBreakStart === null) === (value.defaultBreakEnd === null), {
    message: "Indiquez le début et la fin de la pause, ou laissez les deux vides.",
    path: ["defaultBreakEnd"],
  })
  .refine(
    (value) =>
      value.defaultBreakStart === null ||
      value.defaultBreakEnd === null ||
      minutesOf(value.defaultBreakEnd) > minutesOf(value.defaultBreakStart),
    { message: "La fin de pause doit être après son début.", path: ["defaultBreakEnd"] },
  );

export type EmployeeInput = z.infer<typeof employeeInputSchema>;

/** What the DOM actually produces: every field is a string, except the day toggles. */
const rawFormSchema = z.object({
  lastName: z.string(),
  firstName: z.string(),
  displayName: z.string(),
  boutiqueId: z.string(),
  contractTypeId: z.string(),
  email: z.string(),
  phone: z.string(),
  weeklyContractHours: z.string(),
  defaultStart: z.string(),
  defaultEnd: z.string(),
  defaultBreakStart: z.string(),
  defaultBreakEnd: z.string(),
  workDays: z.array(z.number()),
  hireDate: z.string(),
});

const blankToNull = (value: string) => (value.trim() === "" ? null : value.trim());

/**
 * Normalises the raw fields, then hands them to the rules above.
 *
 * `.pipe()` keeps every message in one place: the form and the server action
 * reject the same values, with the same wording, without the rules being written
 * twice.
 */
export const employeeFormSchema = rawFormSchema
  .transform((value) => ({
    ...value,
    email: blankToNull(value.email),
    phone: blankToNull(value.phone),
    hireDate: blankToNull(value.hireDate),
    defaultBreakStart: blankToNull(value.defaultBreakStart),
    defaultBreakEnd: blankToNull(value.defaultBreakEnd),
    weeklyContractHours:
      value.weeklyContractHours.trim() === "" ? null : Number(value.weeklyContractHours),
  }))
  .pipe(employeeInputSchema);

export type EmployeeFormValues = z.input<typeof employeeFormSchema>;

export const employeeIdSchema = z.string().uuid("Collaboratrice inconnue.");

export const employeeFiltersSchema = z.object({
  boutiqueId: z.string().uuid().optional(),
  contractTypeId: z.string().uuid().optional(),
  status: z.enum(["active", "archived", "all"]).default("active"),
});

export type EmployeeFilters = z.infer<typeof employeeFiltersSchema>;

export const WEEKDAYS: readonly { value: number; label: string; short: string }[] = [
  { value: 1, label: "Lundi", short: "L" },
  { value: 2, label: "Mardi", short: "M" },
  { value: 3, label: "Mercredi", short: "M" },
  { value: 4, label: "Jeudi", short: "J" },
  { value: 5, label: "Vendredi", short: "V" },
  { value: 6, label: "Samedi", short: "S" },
  { value: 7, label: "Dimanche", short: "D" },
];
