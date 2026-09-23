/**
 * API publique du module `documents`.
 *
 * Les autres modules n'importent jamais ce fichier : ils écoutent
 * `documents.added` s'ils en ont besoin.
 */
export { documentsModule } from "./manifest";

export {
  categoryMeta,
  DOCUMENT_CATEGORIES,
  DOCUMENT_CATEGORY_META,
  isDocumentCategory,
  periodLabel,
  type DocumentCategory,
} from "./domain/categories";

export {
  ACCEPTED_MIME,
  checkDocumentFile,
  formatFileSize,
  MAX_DOCUMENT_BYTES,
} from "./domain/file";

export {
  duplicateAssignments,
  matchFile,
  matchFiles,
  normalise,
  unmatchedCount,
  type FileMatch,
  type MatchableEmployee,
} from "./domain/matching";

export { documentSchema, type DocumentInput } from "./schemas";
export type { DocumentRow, EmployeeDocuments } from "./types";

export { getMatchableEmployees, getMyDocuments, listEmployeeDocuments } from "./server/queries";

export {
  openDocument,
  prepareDocumentPath,
  recordDocument,
  removeDocument,
} from "./server/actions";

export { MyDocuments } from "./ui/collab/my-documents";
export { DocumentManager } from "./ui/admin/document-manager";
