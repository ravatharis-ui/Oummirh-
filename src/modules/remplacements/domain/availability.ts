/**
 * Ce qu'on peut dire d'une collaboratrice pour une journée donnée.
 *
 * La deuxième étape du formulaire ne filtre pas la liste, elle la **qualifie** :
 * « déjà à Saint-Pierre ce jour-là » n'est pas un refus — c'est parfois
 * exactement la personne à déplacer — alors qu'un congé en est un.
 */
export const AVAILABILITY_KINDS = [
  "free",
  "working_here",
  "working_elsewhere",
  "unavailable",
] as const;

export type Availability = (typeof AVAILABILITY_KINDS)[number];

export function isAvailability(value: string): value is Availability {
  return (AVAILABILITY_KINDS as readonly string[]).includes(value);
}

export interface AvailabilityMeta {
  label: string;
  /** Ce que ça veut dire, pour quelqu'un qui hésite entre deux personnes. */
  hint: string;
  /** Le formulaire laisse choisir, mais prévient. Seul `unavailable` bloque. */
  selectable: boolean;
  badge: "success" | "warning" | "outline" | "default";
}

export const AVAILABILITY_META: Record<Availability, AvailabilityMeta> = {
  free: {
    label: "Libre",
    hint: "Rien de prévu ce jour-là.",
    selectable: true,
    badge: "success",
  },
  working_here: {
    label: "Déjà sur place",
    hint: "Elle travaille déjà dans ce point de vente ce jour-là.",
    selectable: true,
    badge: "default",
  },
  working_elsewhere: {
    label: "Ailleurs ce jour-là",
    hint: "La déplacer laissera un trou dans l'autre point de vente.",
    selectable: true,
    badge: "warning",
  },
  unavailable: {
    label: "Indisponible",
    hint: "Congé, maladie ou jour d'école : il faudrait d'abord revenir sur cette décision.",
    selectable: false,
    badge: "outline",
  },
};

export function availabilityMeta(value: string): AvailabilityMeta {
  return isAvailability(value) ? AVAILABILITY_META[value] : AVAILABILITY_META.unavailable;
}

/**
 * L'ordre d'affichage : les plus faciles à solliciter d'abord.
 *
 * Quelqu'un qui cherche un renfort dans l'urgence ne doit pas avoir à lire
 * toute la liste pour trouver qui est libre.
 */
const RANK: Record<Availability, number> = {
  free: 0,
  working_here: 1,
  working_elsewhere: 2,
  unavailable: 3,
};

export function availabilityRank(value: string): number {
  return isAvailability(value) ? RANK[value] : RANK.unavailable;
}

export const REPLACEMENT_STATUS_LABELS = {
  active: "Confirmé",
  cancelled: "Annulé",
} as const;

export type ReplacementStatus = keyof typeof REPLACEMENT_STATUS_LABELS;

export function isReplacementStatus(value: string): value is ReplacementStatus {
  return value in REPLACEMENT_STATUS_LABELS;
}
