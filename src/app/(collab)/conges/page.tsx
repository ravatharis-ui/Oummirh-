import type { Metadata } from "next";

import { CounterCard } from "@/core/ui/counter-card";
import {
  formatLeaveDays,
  getMyLeaveState,
  leaveCounters,
  LeaveForm,
  MyLeave,
  periodLabel,
} from "@/modules/conges";

export const metadata: Metadata = { title: "Congés" };
export const dynamic = "force-dynamic";

export default async function CollabLeavePage() {
  const state = await getMyLeaveState();
  const counters = leaveCounters(state.movements, state.periodStart, state.balance);

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <h1 className="text-2xl font-semibold">Mes congés</h1>

      <CounterCard
        title="Congés payés"
        period={periodLabel(state.periodStart)}
        figures={[
          { label: "Jours acquis", value: formatLeaveDays(counters.earned) },
          {
            label: "Jours disponibles",
            value: formatLeaveDays(counters.available),
            tone: counters.available < 0 ? "negative" : "neutral",
          },
          { label: "Jours pris", value: formatLeaveDays(counters.used) },
        ]}
      />

      <LeaveForm
        balance={state.balance}
        holidays={state.holidays}
        nonWorkingDays={state.nonWorkingDays}
      />

      <MyLeave requests={state.requests} />
    </div>
  );
}
