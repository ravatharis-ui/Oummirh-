import type { Metadata } from "next";

import { todayInReunion } from "@/core/time";
import {
  AbsenceCalendar,
  BalanceTable,
  getAbsenceCalendar,
  getLeaveBalances,
  getLeaveOverlaps,
  getLeaveRequests,
  periodLabel,
  periodStart,
  RequestList,
  type LeaveOverlap,
} from "@/modules/conges";

export const metadata: Metadata = { title: "Congés" };
export const dynamic = "force-dynamic";

function asString(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

export default async function AdminLeavePage({ searchParams }: PageProps<"/admin/conges">) {
  const params = await searchParams;
  const today = todayInReunion();
  const month = asString(params.month) ?? today;

  const [pending, balances, absences] = await Promise.all([
    getLeaveRequests("pending"),
    getLeaveBalances(),
    getAbsenceCalendar(month),
  ]);

  // Les chevauchements sont résolus ici, côté serveur : la liste les affiche
  // avec chaque demande plutôt que de les faire chercher.
  const overlapEntries = await Promise.all(
    pending.map(async (request): Promise<[string, LeaveOverlap[]]> => [
      request.id,
      await getLeaveOverlaps(request.employeeId, request.startDate, request.endDate),
    ]),
  );

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Congés</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Période {periodLabel(periodStart(today))}
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">
          Demandes en attente {pending.length > 0 ? `(${pending.length})` : ""}
        </h2>
        <RequestList requests={pending} overlaps={Object.fromEntries(overlapEntries)} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Soldes</h2>
        <BalanceTable rows={balances} periodLabel={periodLabel(periodStart(today))} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Calendrier des absences</h2>
        <AbsenceCalendar month={month} absences={absences} />
      </section>
    </div>
  );
}
