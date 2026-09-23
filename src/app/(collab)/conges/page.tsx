import type { Metadata, Route } from "next";

import { CounterCard } from "@/core/ui/counter-card";
import {
  formatLeaveDays,
  getMyLeaveState,
  leaveCounters,
  LeaveForm,
  MyLeave,
  periodLabel,
  shiftPeriod,
} from "@/modules/conges";

export const metadata: Metadata = { title: "Congés" };
export const dynamic = "force-dynamic";

const PERIOD = /^\d{4}-\d{2}-\d{2}$/;

function asPeriod(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && PERIOD.test(value) ? value : undefined;
}

export default async function CollabLeavePage({ searchParams }: PageProps<"/conges">) {
  const params = await searchParams;
  const state = await getMyLeaveState(asPeriod(params.periode));

  const counters = leaveCounters(state.movements, state.selectedPeriod, state.balance);
  const isCurrent = state.selectedPeriod === state.periodStart;

  const link = (start: string): Route => `/conges?periode=${start}` as Route;
  const previous = shiftPeriod(state.selectedPeriod, -1);
  const next = shiftPeriod(state.selectedPeriod, 1);

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <h1 className="text-2xl font-semibold">Mes congés</h1>

      <CounterCard
        title="Congés payés"
        period={periodLabel(state.selectedPeriod)}
        previous={link(previous)}
        // Pas de flèche au-delà de la période en cours : les congés d'une année
        // qui n'a pas commencé ne veulent rien dire.
        {...(isCurrent ? {} : { next: link(next) })}
        figures={[
          { label: "Jours acquis", value: formatLeaveDays(counters.earned) },
          // Le solde est celui d'aujourd'hui, pas celui de la période affichée :
          // il n'existe qu'un solde, et le dire évite de laisser croire qu'on
          // pourrait encore poser des congés sur une année passée.
          {
            label: isCurrent ? "Jours disponibles" : "Solde aujourd'hui",
            value: formatLeaveDays(counters.available),
            tone: counters.available < 0 ? "negative" : "neutral",
          },
          { label: "Jours pris", value: formatLeaveDays(counters.used) },
        ]}
      />

      {isCurrent ? (
        <>
          <LeaveForm
            balance={state.balance}
            holidays={state.holidays}
            nonWorkingDays={state.nonWorkingDays}
          />

          <MyLeave requests={state.requests} />
        </>
      ) : (
        <p className="text-muted-foreground rounded-xl border border-dashed p-6 text-center text-base">
          Vous regardez une période passée. Revenez à la période en cours pour demander un congé.
        </p>
      )}
    </div>
  );
}
