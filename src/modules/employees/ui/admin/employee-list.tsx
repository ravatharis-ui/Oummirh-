import { Plus, UserRound } from "lucide-react";
import Link from "next/link";

import { formatTime } from "@/core/time";
import { Badge } from "@/core/ui/badge";
import { Button } from "@/core/ui/button";
import { Select } from "@/core/ui/select";

import type { EmployeeFilters } from "../../schemas";
import type { EmployeeSummary } from "../../types";

interface EmployeeListProps {
  employees: EmployeeSummary[];
  filters: EmployeeFilters;
  boutiques: { id: string; name: string }[];
  contractTypes: { id: string; label: string }[];
}

/** Filters go through a plain GET form, so the URL stays shareable and no JavaScript is needed. */
export function EmployeeList({ employees, filters, boutiques, contractTypes }: EmployeeListProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Collaboratrices</h1>
        <Button asChild>
          <Link href="/admin/collaboratrices/nouvelle">
            <Plus className="size-5" aria-hidden /> Nouvelle collaboratrice
          </Link>
        </Button>
      </div>

      <form className="flex flex-wrap items-end gap-3" role="search">
        <div className="flex min-w-44 flex-1 flex-col gap-1.5">
          <label htmlFor="boutiqueId" className="text-sm font-medium">
            Point de vente
          </label>
          <Select id="boutiqueId" name="boutiqueId" defaultValue={filters.boutiqueId ?? ""}>
            <option value="">Tous</option>
            {boutiques.map((boutique) => (
              <option key={boutique.id} value={boutique.id}>
                {boutique.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex min-w-44 flex-1 flex-col gap-1.5">
          <label htmlFor="contractTypeId" className="text-sm font-medium">
            Contrat
          </label>
          <Select
            id="contractTypeId"
            name="contractTypeId"
            defaultValue={filters.contractTypeId ?? ""}
          >
            <option value="">Tous</option>
            {contractTypes.map((contract) => (
              <option key={contract.id} value={contract.id}>
                {contract.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex min-w-36 flex-col gap-1.5">
          <label htmlFor="status" className="text-sm font-medium">
            Statut
          </label>
          <Select id="status" name="status" defaultValue={filters.status}>
            <option value="active">En poste</option>
            <option value="archived">Archivées</option>
            <option value="all">Toutes</option>
          </Select>
        </div>

        <Button type="submit" variant="outline">
          Filtrer
        </Button>
      </form>

      {employees.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed py-12 text-center">
          <UserRound className="text-muted-foreground size-10" aria-hidden />
          <p className="text-muted-foreground text-base">
            Aucune collaboratrice ne correspond à ces critères.
          </p>
          <Button asChild variant="outline">
            <Link href="/admin/collaboratrices/nouvelle">Créer la première</Link>
          </Button>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {employees.map((employee) => (
            <li key={employee.id}>
              <Link
                href={`/admin/collaboratrices/${employee.id}`}
                className="hover:bg-secondary/60 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border p-4 transition-colors"
              >
                <span className="bg-secondary flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
                  {employee.firstName.slice(0, 1)}
                  {employee.lastName.slice(0, 1)}
                </span>

                <span className="flex min-w-48 flex-1 flex-col">
                  <span className="font-medium">
                    {employee.lastName} {employee.firstName}
                  </span>
                  <span className="text-muted-foreground text-sm">{employee.boutiqueName}</span>
                </span>

                <Badge variant="outline">{employee.contractLabel}</Badge>

                <span className="text-muted-foreground text-sm">
                  {formatTime(employee.defaultStart)} – {formatTime(employee.defaultEnd)}
                </span>

                {employee.isActive ? null : <Badge variant="warning">Archivée</Badge>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
