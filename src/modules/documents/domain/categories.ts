/** Les catégories du coffre-fort. La liste est close : elle décide du classement. */
export const DOCUMENT_CATEGORIES = [
  "payslip",
  "contract",
  "amendment",
  "certificate",
  "other",
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export function isDocumentCategory(value: string): value is DocumentCategory {
  return (DOCUMENT_CATEGORIES as readonly string[]).includes(value);
}

export interface CategoryMeta {
  label: string;
  /** Au pluriel, pour les titres de section. */
  plural: string;
  /** Une fiche de paie sans période ne se retrouve pas : la base l'exige aussi. */
  needsPeriod: boolean;
}

export const DOCUMENT_CATEGORY_META: Record<DocumentCategory, CategoryMeta> = {
  payslip: { label: "Fiche de paie", plural: "Fiches de paie", needsPeriod: true },
  contract: { label: "Contrat", plural: "Contrats", needsPeriod: false },
  amendment: { label: "Avenant", plural: "Avenants", needsPeriod: false },
  certificate: { label: "Attestation", plural: "Attestations", needsPeriod: false },
  other: { label: "Autre document", plural: "Autres documents", needsPeriod: false },
};

export function categoryMeta(value: string): CategoryMeta {
  return isDocumentCategory(value) ? DOCUMENT_CATEGORY_META[value] : DOCUMENT_CATEGORY_META.other;
}

/** "septembre 2026" à partir de "2026-09-01". */
export function periodLabel(period: string | null): string {
  if (!period) return "";

  const [year, month] = period.split("-");
  const names = [
    "janvier",
    "février",
    "mars",
    "avril",
    "mai",
    "juin",
    "juillet",
    "août",
    "septembre",
    "octobre",
    "novembre",
    "décembre",
  ];

  const index = Number(month) - 1;
  return names[index] && year ? `${names[index]} ${year}` : period;
}
