/** PDF uniquement, dix mégaoctets au maximum. */
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_MIME = "application/pdf";

export interface FileCheck {
  ok: boolean;
  /** Message en français, prêt à afficher. Vide quand le fichier convient. */
  error: string;
}

/**
 * Ce qu'on accepte dans le coffre-fort.
 *
 * Le type déclaré par le navigateur ne prouve rien — il vient du système de
 * fichiers — donc l'extension est vérifiée aussi. Ce n'est pas une garantie
 * cryptographique : c'est ce qui évite qu'un document Word finisse dans un
 * coffre que personne ne pourra ouvrir sur son téléphone.
 */
export function checkDocumentFile(file: { name: string; size: number; type: string }): FileCheck {
  const isPdf = file.type === ACCEPTED_MIME || file.name.toLowerCase().trim().endsWith(".pdf");

  if (!isPdf) {
    return { ok: false, error: "Seuls les fichiers PDF sont acceptés." };
  }

  if (file.size <= 0) {
    return { ok: false, error: "Ce fichier est vide." };
  }

  if (file.size > MAX_DOCUMENT_BYTES) {
    return { ok: false, error: "Ce fichier dépasse 10 Mo." };
  }

  return { ok: true, error: "" };
}

/** "84 ko", "2,1 Mo" — la taille telle qu'on la lit, pas telle qu'on la stocke. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} ko`;
  return `${(bytes / (1024 * 1024)).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`;
}
