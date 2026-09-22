"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { formatFrDateShort } from "@/core/time";
import { Badge } from "@/core/ui/badge";
import { Button } from "@/core/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/ui/card";

import { formatLeaveDays, LEAVE_STATUS_LABELS } from "../../domain/count";
import { cancelLeaveRequest } from "../../server/actions";
import type { LeaveRequestRow } from "../../types";

const STATUS_VARIANT = {
  pending: "warning",
  approved: "success",
  refused: "danger",
  cancelled: "outline",
} as const;

export function MyLeave({ requests }: { requests: LeaveRequestRow[] }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function cancel(id: string): void {
    setError(null);
    startTransition(async () => {
      const result = await cancelLeaveRequest(id);
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Mes demandes</CardTitle>
      </CardHeader>
      <CardContent>
        {error ? (
          <p role="alert" className="text-destructive mb-3 text-base">
            {error}
          </p>
        ) : null}

        {requests.length === 0 ? (
          <p className="text-muted-foreground text-base">
            Tu n&apos;as encore déposé aucune demande.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {requests.map((request) => (
              <li key={request.id} className="flex flex-col gap-1 border-b pb-3 last:border-b-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-base font-medium">
                    {formatFrDateShort(request.startDate)} → {formatFrDateShort(request.endDate)}
                  </span>
                  <Badge variant={STATUS_VARIANT[request.status]}>
                    {LEAVE_STATUS_LABELS[request.status]}
                  </Badge>
                </div>

                <span className="text-muted-foreground text-base">
                  {formatLeaveDays(request.days)}
                  {request.reason ? ` · ${request.reason}` : ""}
                </span>

                {request.adminComment ? (
                  <span className="text-base italic">« {request.adminComment} »</span>
                ) : null}

                {request.status === "pending" ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="self-start"
                    disabled={isPending}
                    onClick={() => cancel(request.id)}
                  >
                    Annuler ma demande
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
