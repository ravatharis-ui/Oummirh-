import type { Metadata } from "next";

import { Card, CardContent, CardHeader, CardTitle } from "@/core/ui/card";
import {
  formatLeaveDays,
  getMyLeaveState,
  LeaveForm,
  MyLeave,
  periodLabel,
} from "@/modules/conges";

export const metadata: Metadata = { title: "Congés" };
export const dynamic = "force-dynamic";

export default async function CollabLeavePage() {
  const state = await getMyLeaveState();

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <h1 className="text-2xl font-semibold">Mes congés</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mon solde</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-semibold">{formatLeaveDays(state.balance)}</p>
          <p className="text-muted-foreground mt-1 text-base">
            Période {periodLabel(state.periodStart)}
          </p>
        </CardContent>
      </Card>

      <LeaveForm
        balance={state.balance}
        holidays={state.holidays}
        nonWorkingDays={state.nonWorkingDays}
      />

      <MyLeave requests={state.requests} />
    </div>
  );
}
