import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/core/ui/badge";
import { Button } from "@/core/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/core/ui/card";
import {
  ArchiveToggle,
  EmployeeForm,
  getEmployee,
  getReferenceData,
  PinResetButton,
  type EmployeeFormValues,
} from "@/modules/employees";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/admin/collaboratrices/[id]">): Promise<Metadata> {
  const { id } = await params;
  const employee = await getEmployee(id);
  return { title: employee ? `${employee.lastName} ${employee.firstName}` : "Collaboratrice" };
}

export default async function EmployeePage({ params }: PageProps<"/admin/collaboratrices/[id]">) {
  const { id } = await params;
  const [employee, reference] = await Promise.all([getEmployee(id), getReferenceData()]);

  if (!employee) notFound();

  const defaultValues: EmployeeFormValues = {
    lastName: employee.lastName,
    firstName: employee.firstName,
    displayName: employee.displayName,
    boutiqueId: employee.boutiqueId,
    contractTypeId: employee.contractTypeId,
    email: employee.email ?? "",
    phone: employee.phone ?? "",
    weeklyContractHours: employee.weeklyContractHours?.toString() ?? "",
    defaultStart: employee.defaultStart.slice(0, 5),
    defaultEnd: employee.defaultEnd.slice(0, 5),
    defaultBreakStart: employee.defaultBreakStart?.slice(0, 5) ?? "",
    defaultBreakEnd: employee.defaultBreakEnd?.slice(0, 5) ?? "",
    workDays: employee.workDays,
    hireDate: employee.hireDate ?? "",
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button asChild variant="ghost" className="-ml-2 px-2">
          <Link href="/admin/collaboratrices">
            <ChevronLeft className="size-5" aria-hidden /> Collaboratrices
          </Link>
        </Button>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">
            {employee.lastName} {employee.firstName}
          </h1>
          <Badge variant="outline">{employee.contractLabel}</Badge>
          {employee.isActive ? null : <Badge variant="warning">Archivée</Badge>}
        </div>
        <p className="text-muted-foreground">{employee.boutiqueName}</p>
      </div>

      <EmployeeForm
        employeeId={employee.id}
        defaultValues={defaultValues}
        boutiques={reference.boutiques}
        contractTypes={reference.contractTypes}
      />

      <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Code PIN</CardTitle>
            <CardDescription>
              Le code n&apos;est jamais consultable. En cas d&apos;oubli, générez-en un nouveau.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PinResetButton employeeId={employee.id} employeeName={employee.displayName} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Statut</CardTitle>
            <CardDescription>
              Une collaboratrice archivée ne peut plus se connecter, mais son historique est
              conservé.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ArchiveToggle employeeId={employee.id} isActive={employee.isActive} />
          </CardContent>
        </Card>
      </div>

      <p className="text-muted-foreground text-sm">
        Planning type, soldes, pointages et documents apparaîtront ici au fil des phases suivantes.
      </p>
    </div>
  );
}
