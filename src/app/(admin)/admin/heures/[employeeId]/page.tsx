import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { formatBalance, getEmployeeHoursDetail, HoursDetailList } from "@/modules/heures";
import { Button } from "@/core/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/ui/card";

export const metadata: Metadata = { title: "Compteur d'heures" };
export const dynamic = "force-dynamic";

export default async function EmployeeHoursPage({
  params,
}: PageProps<"/admin/heures/[employeeId]">) {
  const { employeeId } = await params;
  const detail = await getEmployeeHoursDetail(employeeId);

  if (!detail) notFound();

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{detail.displayName}</h1>
          <p className="text-muted-foreground text-sm">{detail.boutiqueName}</p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/heures">
            <ArrowLeft className="size-4" aria-hidden />
            Retour aux heures
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Solde cumulé</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-semibold tabular-nums">
            {formatBalance(detail.balanceMinutes)}
          </p>
          <p className="text-muted-foreground mt-2 text-sm">
            C&apos;est exactement ce qu&apos;elle voit sur son téléphone, mouvement par mouvement.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Détail</CardTitle>
        </CardHeader>
        <CardContent>
          <HoursDetailList rows={detail.rows} />
        </CardContent>
      </Card>
    </div>
  );
}
