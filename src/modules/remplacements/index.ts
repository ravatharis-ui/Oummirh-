/**
 * API publique du module `remplacements`.
 *
 * Les autres modules n'importent jamais ce fichier : ils écoutent
 * `remplacements.created` et `remplacements.cancelled`.
 */
export { remplacementsModule } from "./manifest";

export {
  availabilityMeta,
  availabilityRank,
  AVAILABILITY_KINDS,
  AVAILABILITY_META,
  isAvailability,
  isReplacementStatus,
  REPLACEMENT_STATUS_LABELS,
  type Availability,
  type ReplacementStatus,
} from "./domain/availability";

export { replacementSchema, type ReplacementInput } from "./schemas";
export type { Candidate, ReplacementRow } from "./types";

export { getCandidates, getMyReplacements, listReplacements } from "./server/queries";
export { cancelReplacement, createReplacement } from "./server/actions";

export { ReplacementWizard } from "./ui/admin/replacement-wizard";
export { ReplacementList } from "./ui/admin/replacement-list";
