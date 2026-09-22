import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { getSettings } from "@/core/settings";
import { Button } from "@/core/ui/button";
import { EmployeeForm, getReferenceData, type EmployeeFormValues } from "@/modules/employees";

export const metadata: Metadata = { title: "Nouvelle collaboratrice" };
export const dynamic = "force-dynamic";

export default async function NewEmployeePage() {
  const [reference, settings] = await Promise.all([getReferenceData(), getSettings()]);
  const schedule = settings.default_schedule;

  const defaultValues: EmployeeFormValues = {
    lastName: "",
    firstName: "",
    displayName: "",
    boutiqueId: reference.boutiques[0]?.id ?? "",
    contractTypeId: reference.contractTypes[0]?.id ?? "",
    email: "",
    phone: "",
    weeklyContractHours: "35",
    defaultStart: schedule.start,
    defaultEnd: schedule.end,
    defaultBreakStart: schedule.break_start,
    defaultBreakEnd: schedule.break_end,
    workDays: [1, 2, 3, 4, 5, 6],
    hireDate: "",
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button asChild variant="ghost" className="-ml-2 px-2">
          <Link href="/admin/collaboratrices">
            <ChevronLeft className="size-5" aria-hidden /> Collaboratrices
          </Link>
        </Button>
        <h1 className="mt-2 text-2xl font-semibold">Nouvelle collaboratrice</h1>
        <p className="text-muted-foreground">
          Un code PIN sera généré automatiquement et affiché une seule fois.
        </p>
      </div>

      <EmployeeForm
        defaultValues={defaultValues}
        boutiques={reference.boutiques}
        contractTypes={reference.contractTypes}
      />
    </div>
  );
}
