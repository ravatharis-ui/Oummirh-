import type { Metadata } from "next";

import { addDays, todayInReunion } from "@/core/time";
import { DocumentManager, getMatchableEmployees, listEmployeeDocuments } from "@/modules/documents";

export const metadata: Metadata = { title: "Documents" };
export const dynamic = "force-dynamic";

export default async function AdminDocumentsPage() {
  const [coffres, employees] = await Promise.all([
    listEmployeeDocuments(),
    getMatchableEmployees(),
  ]);

  // Les fiches de paie se déposent après coup : le mois proposé est le précédent.
  const previousMonth = `${addDays(`${todayInReunion().slice(0, 7)}-01`, -1).slice(0, 7)}-01`;

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Documents</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          PDF uniquement, 10 Mo maximum. Chaque collaboratrice ne voit que son propre coffre.
        </p>
      </div>

      <DocumentManager coffres={coffres} employees={employees} defaultMonth={previousMonth} />
    </div>
  );
}
