/**
 * Les états d'un échange.
 *
 * L'ordre est celui du parcours : la collègue d'abord, la direction ensuite.
 * Demander à la direction d'arbitrer un échange que l'intéressée refusera est
 * une perte de temps pour tout le monde.
 */
export const SWAP_STATUSES = [
  "pending_partner",
  "pending_admin",
  "approved",
  "refused_partner",
  "refused_admin",
  "cancelled",
] as const;

export type SwapStatus = (typeof SWAP_STATUSES)[number];

export function isSwapStatus(value: string): value is SwapStatus {
  return (SWAP_STATUSES as readonly string[]).includes(value);
}

export interface SwapStatusMeta {
  /** Ce que la demandeuse lit. */
  requesterLabel: string;
  /** Ce que la collègue lit. */
  partnerLabel: string;
  /** Ce que la direction lit. */
  adminLabel: string;
  badge: "default" | "success" | "warning" | "outline" | "danger";
  /** Un échange encore vivant : il attend une réponse de quelqu'un. */
  live: boolean;
}

export const SWAP_STATUS_META: Record<SwapStatus, SwapStatusMeta> = {
  pending_partner: {
    requesterLabel: "En attente de ta collègue",
    partnerLabel: "À toi de répondre",
    adminLabel: "En attente de la collègue",
    badge: "warning",
    live: true,
  },
  pending_admin: {
    requesterLabel: "Acceptée, en attente de la direction",
    partnerLabel: "Tu as accepté, en attente de la direction",
    adminLabel: "À valider",
    badge: "default",
    live: true,
  },
  approved: {
    requesterLabel: "Échange validé",
    partnerLabel: "Échange validé",
    adminLabel: "Validé",
    badge: "success",
    live: false,
  },
  refused_partner: {
    requesterLabel: "Ta collègue a refusé",
    partnerLabel: "Tu as refusé",
    adminLabel: "Refusé par la collègue",
    badge: "outline",
    live: false,
  },
  refused_admin: {
    requesterLabel: "La direction a refusé",
    partnerLabel: "La direction a refusé",
    adminLabel: "Refusé",
    badge: "danger",
    live: false,
  },
  cancelled: {
    requesterLabel: "Tu as annulé",
    partnerLabel: "Demande annulée",
    adminLabel: "Annulé",
    badge: "outline",
    live: false,
  },
};

export function swapStatusMeta(value: string): SwapStatusMeta {
  return isSwapStatus(value) ? SWAP_STATUS_META[value] : SWAP_STATUS_META.cancelled;
}

/** Qui peut faire quoi, à cet instant. Mêmes règles que les fonctions SQL. */
export function canPartnerAnswer(status: string): boolean {
  return status === "pending_partner";
}

export function canAdminDecide(status: string): boolean {
  return status === "pending_admin";
}

/**
 * Une fois validé, un échange ne s'annule plus : les deux plannings ont changé
 * et deux personnes ont organisé leur semaine autour.
 */
export function canCancel(status: string): boolean {
  return status === "pending_partner" || status === "pending_admin";
}

/** Les statuts de journée qu'un échange ne peut pas toucher. */
const LOCKED_DAY_STATUSES: readonly string[] = ["leave", "sick", "school"];

export function isDaySwappable(plannedStatus: string | null): boolean {
  return plannedStatus === null || !LOCKED_DAY_STATUSES.includes(plannedStatus);
}
