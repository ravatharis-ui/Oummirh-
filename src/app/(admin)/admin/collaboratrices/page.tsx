import type { Metadata } from "next";

import { employeeFiltersSchema } from "@/modules/employees";
import { EmployeeList, getReferenceData, listEmployees } from "@/modules/employees";

export const metadata: Metadata = { title: "Collaboratrices" };
export const dynamic = "force-dynamic";

export default async function EmployeesPage({ searchParams }: PageProps<"/admin/collaboratrices">) {
  const params = await searchParams;
  const asString = (value: string | string[] | undefined) =>
    typeof value === "string" && value !== "" ? value : undefined;

  const parsed = employeeFiltersSchema.safeParse({
    boutiqueId: asString(params.boutiqueId),
    contractTypeId: asString(params.contractTypeId),
    status: asString(params.status) ?? "active",
  });
  const filters = parsed.success ? parsed.data : { status: "active" as const };

  const [employees, reference] = await Promise.all([listEmployees(filters), getReferenceData()]);

  return (
    <EmployeeList
      employees={employees}
      filters={filters}
      boutiques={reference.boutiques}
      contractTypes={reference.contractTypes}
    />
  );
}
