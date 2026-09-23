import { describe, expect, it } from "vitest";

import { categoryMeta, DOCUMENT_CATEGORIES, periodLabel } from "../domain/categories";
import { checkDocumentFile, formatFileSize, MAX_DOCUMENT_BYTES } from "../domain/file";
import {
  duplicateAssignments,
  matchFile,
  matchFiles,
  normalise,
  unmatchedCount,
  type MatchableEmployee,
} from "../domain/matching";

const EQUIPE: MatchableEmployee[] = [
  { employeeId: "1", lastName: "Hoarau", firstName: "Aurélie", displayName: "Aurélie" },
  { employeeId: "2", lastName: "Payet", firstName: "Marie", displayName: "Marie" },
  { employeeId: "3", lastName: "Payet", firstName: "Sophie", displayName: "Sophie" },
  { employeeId: "4", lastName: "Grondin", firstName: "Nadia", displayName: "Nadia" },
];

describe("normalise", () => {
  it("efface accents, casse et ponctuation", () => {
    expect(normalise("Aurélie_Hoarau-09.2026.pdf")).toBe("AURELIE HOARAU 09 2026 PDF");
  });

  it("rend deux écritures du même nom identiques", () => {
    expect(normalise("HOARAU AURELIE 09 2026.pdf")).toContain("HOARAU");
    expect(normalise("hoarau-aurelie.pdf")).toContain("HOARAU");
  });
});

describe("matchFile", () => {
  it("reconnaît un nom de famille sans ambiguïté", () => {
    expect(matchFile("HOARAU_Aurelie_092026.pdf", EQUIPE)).toEqual({
      fileName: "HOARAU_Aurelie_092026.pdf",
      employeeId: "1",
      reason: "matched",
    });
  });

  it("tranche entre deux homonymes grâce au prénom", () => {
    expect(matchFile("PAYET_Sophie.pdf", EQUIPE).employeeId).toBe("3");
  });

  it("refuse de choisir entre deux homonymes sans prénom", () => {
    // Attribuer la fiche de paie de quelqu'un à une autre personne est l'erreur
    // la plus grave que ce module puisse commettre.
    const result = matchFile("PAYET_092026.pdf", EQUIPE);
    expect(result.employeeId).toBeNull();
    expect(result.reason).toBe("ambiguous");
  });

  it("accepte un prénom seul s'il ne désigne qu'une personne", () => {
    expect(matchFile("nadia-septembre.pdf", EQUIPE).employeeId).toBe("4");
  });

  it("ne reconnaît rien dans un nom de fichier anonyme", () => {
    const result = matchFile("bulletin_0042.pdf", EQUIPE);
    expect(result.employeeId).toBeNull();
    expect(result.reason).toBe("no-match");
  });

  it("ne se laisse pas tromper par un nom noyé dans un mot", () => {
    // « PAYETTE » n'est pas « PAYET ».
    expect(matchFile("PAYETTE.pdf", EQUIPE).employeeId).toBeNull();
  });

  it("ignore les noms trop courts pour être fiables", () => {
    const courte: MatchableEmployee[] = [
      { employeeId: "9", lastName: "Li", firstName: "An", displayName: "An" },
    ];
    expect(matchFile("li-an-092026.pdf", courte).employeeId).toBeNull();
  });
});

describe("matchFiles", () => {
  it("compte ce qui reste à associer à la main", () => {
    const matches = matchFiles(["HOARAU_Aurelie.pdf", "PAYET.pdf", "bulletin_0042.pdf"], EQUIPE);
    expect(unmatchedCount(matches)).toBe(2);
  });

  it("repère deux fichiers attribués à la même personne", () => {
    const matches = matchFiles(["HOARAU_Aurelie.pdf", "hoarau-aurelie-bis.pdf"], EQUIPE);
    expect(duplicateAssignments(matches)).toEqual(["1"]);
  });

  it("ne signale rien quand chacune a son fichier", () => {
    const matches = matchFiles(["HOARAU_Aurelie.pdf", "GRONDIN_Nadia.pdf"], EQUIPE);
    expect(duplicateAssignments(matches)).toEqual([]);
    expect(unmatchedCount(matches)).toBe(0);
  });
});

describe("checkDocumentFile", () => {
  const pdf = { name: "paie.pdf", size: 84_000, type: "application/pdf" };

  it("accepte un PDF de taille raisonnable", () => {
    expect(checkDocumentFile(pdf).ok).toBe(true);
  });

  it("accepte un PDF dont le navigateur n'a pas reconnu le type", () => {
    expect(checkDocumentFile({ ...pdf, type: "" }).ok).toBe(true);
  });

  it("refuse ce qui n'est pas un PDF", () => {
    const result = checkDocumentFile({ name: "paie.docx", size: 1000, type: "application/msword" });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("PDF");
  });

  it("refuse un fichier vide", () => {
    expect(checkDocumentFile({ ...pdf, size: 0 }).ok).toBe(false);
  });

  it("refuse au-delà de dix mégaoctets", () => {
    const result = checkDocumentFile({ ...pdf, size: MAX_DOCUMENT_BYTES + 1 });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("10 Mo");
  });

  it("accepte exactement dix mégaoctets", () => {
    expect(checkDocumentFile({ ...pdf, size: MAX_DOCUMENT_BYTES }).ok).toBe(true);
  });
});

describe("formatFileSize", () => {
  it("écrit les tailles comme on les lit", () => {
    expect(formatFileSize(512)).toBe("512 o");
    expect(formatFileSize(84_000)).toBe("82 ko");
    expect(formatFileSize(2_200_000)).toBe("2,1 Mo");
  });
});

describe("les catégories", () => {
  it("n'exige une période que pour les fiches de paie", () => {
    // Un contrat n'a pas de mois ; une fiche de paie sans mois ne se retrouve pas.
    expect(categoryMeta("payslip").needsPeriod).toBe(true);
    for (const category of DOCUMENT_CATEGORIES.filter((c) => c !== "payslip")) {
      expect(categoryMeta(category).needsPeriod).toBe(false);
    }
  });

  it("retombe sur « Autre » pour une catégorie inconnue", () => {
    expect(categoryMeta("n'importe quoi").label).toBe("Autre document");
  });

  it("nomme une période en toutes lettres", () => {
    expect(periodLabel("2026-09-01")).toBe("septembre 2026");
    expect(periodLabel(null)).toBe("");
  });
});
