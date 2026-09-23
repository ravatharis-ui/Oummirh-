/**
 * Associer un fichier à une collaboratrice, par son nom.
 *
 * Le dépôt en lot des fiches de paie est la seule opération du mois où la
 * direction manipule vingt fichiers d'un coup. Les associer un par un serait
 * long et donc mal fait — d'où cette reconnaissance automatique.
 *
 * Elle est délibérément **timide** : au moindre doute, elle ne propose rien et
 * laisse associer à la main. Attribuer la fiche de paie de quelqu'un à une autre
 * personne est l'erreur la plus grave que ce module puisse commettre.
 */

export interface MatchableEmployee {
  employeeId: string;
  lastName: string;
  firstName: string;
  displayName: string;
}

export interface FileMatch {
  fileName: string;
  /** `null` quand le nom ne désigne personne, ou désigne plusieurs personnes. */
  employeeId: string | null;
  reason: "matched" | "no-match" | "ambiguous";
}

/**
 * Enlève les accents, la casse et la ponctuation.
 *
 * « Aurélie_Hoarau-09.2026.pdf » et « HOARAU AURELIE 09 2026.pdf » doivent
 * donner le même résultat : c'est le même fichier envoyé par deux comptables.
 */
export function normalise(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

/** Un nom est reconnu s'il apparaît comme mot entier dans le nom du fichier. */
function contains(haystack: string, needle: string): boolean {
  if (needle.length < 3) return false;
  return new RegExp(`(^| )${needle}( |$)`).test(haystack);
}

export function matchFile(fileName: string, employees: readonly MatchableEmployee[]): FileMatch {
  const haystack = normalise(fileName);

  const byLastName = employees.filter((employee) =>
    contains(haystack, normalise(employee.lastName)),
  );

  if (byLastName.length === 1) {
    const found = byLastName[0];
    return found
      ? { fileName, employeeId: found.employeeId, reason: "matched" }
      : { fileName, employeeId: null, reason: "no-match" };
  }

  // Deux sœurs, deux fiches de paie : le nom de famille ne suffit plus, mais le
  // prénom tranche.
  if (byLastName.length > 1) {
    const byBoth = byLastName.filter((employee) =>
      contains(haystack, normalise(employee.firstName)),
    );

    if (byBoth.length === 1) {
      const found = byBoth[0];
      return found
        ? { fileName, employeeId: found.employeeId, reason: "matched" }
        : { fileName, employeeId: null, reason: "ambiguous" };
    }

    return { fileName, employeeId: null, reason: "ambiguous" };
  }

  // Rien sur le nom de famille : un prénom seul peut suffire s'il ne désigne
  // qu'une personne.
  const byFirstName = employees.filter((employee) =>
    contains(haystack, normalise(employee.firstName)),
  );

  if (byFirstName.length === 1) {
    const found = byFirstName[0];
    return found
      ? { fileName, employeeId: found.employeeId, reason: "matched" }
      : { fileName, employeeId: null, reason: "no-match" };
  }

  return {
    fileName,
    employeeId: null,
    reason: byFirstName.length > 1 ? "ambiguous" : "no-match",
  };
}

export function matchFiles(
  fileNames: readonly string[],
  employees: readonly MatchableEmployee[],
): FileMatch[] {
  return fileNames.map((fileName) => matchFile(fileName, employees));
}

/** Combien restent à associer à la main. Le bouton d'envoi s'en sert. */
export function unmatchedCount(matches: readonly FileMatch[]): number {
  return matches.filter((match) => match.employeeId === null).length;
}

/**
 * Deux fichiers pour la même personne dans un même lot : presque toujours une
 * erreur d'association, jamais une intention.
 */
export function duplicateAssignments(matches: readonly FileMatch[]): string[] {
  const seen = new Map<string, number>();

  for (const match of matches) {
    if (!match.employeeId) continue;
    seen.set(match.employeeId, (seen.get(match.employeeId) ?? 0) + 1);
  }

  return [...seen.entries()].filter(([, count]) => count > 1).map(([employeeId]) => employeeId);
}
