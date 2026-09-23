import type { DateString } from "@/core/time";

import type { DocumentCategory } from "./domain/categories";

export interface DocumentRow {
  id: string;
  employeeId: string;
  displayName: string;
  category: DocumentCategory;
  title: string;
  periodMonth: DateString | null;
  sizeBytes: number;
  firstViewedAt: string | null;
  createdAt: string;
}

/** Une collaboratrice et son coffre, vus par la direction. */
export interface EmployeeDocuments {
  employeeId: string;
  displayName: string;
  lastName: string;
  firstName: string;
  documents: DocumentRow[];
  /** Combien elle n'a jamais ouverts. C'est ce que la direction regarde. */
  neverOpened: number;
}

export type { ActionResult } from "@/core/actions";
