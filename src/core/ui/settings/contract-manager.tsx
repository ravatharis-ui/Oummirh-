"use client";

import { Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { saveContractType } from "@/core/settings/actions";
import type { ContractTypeRow } from "@/core/settings/queries";

import { Badge } from "../badge";
import { Button } from "../button";
import { Input } from "../input";
import { Label } from "../label";
import { Select } from "../select";
import { Modal } from "../modal";

/**
 * Les types de contrat.
 *
 * Stockés en table et non en énumération Postgres, précisément pour ça : la
 * liste s'allonge sans migration. `is_apprenticeship` sert aux jours d'école du
 * planning.
 */
export function ContractManager({ contracts }: { contracts: ContractTypeRow[] }) {
  const [editing, setEditing] = useState<ContractTypeRow | "new" | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {contracts.map((contract) => (
          <li
            key={contract.id}
            className="flex items-center justify-between gap-3 rounded-xl border p-3"
          >
            <div>
              <p className="flex items-center gap-2 font-medium">
                {contract.label}
                {contract.isApprenticeship ? <Badge variant="default">Alternance</Badge> : null}
              </p>
              <p className="text-muted-foreground text-sm">{contract.code}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setEditing(contract)}>
              Modifier
            </Button>
          </li>
        ))}
      </ul>

      <Button
        variant="secondary"
        size="sm"
        className="self-start"
        onClick={() => setEditing("new")}
      >
        <Plus className="size-4" aria-hidden />
        Ajouter un type de contrat
      </Button>

      {editing ? (
        <ContractDialog
          contract={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}

function ContractDialog({
  contract,
  onClose,
}: {
  contract: ContractTypeRow | null;
  onClose: () => void;
}) {
  const [label, setLabel] = useState(contract?.label ?? "");
  const [code, setCode] = useState(contract?.code ?? "");
  const [apprenticeship, setApprenticeship] = useState(contract?.isApprenticeship ?? false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function submit(): void {
    setError(null);
    startTransition(async () => {
      const result = await saveContractType({
        id: contract?.id ?? null,
        code,
        label,
        isApprenticeship: apprenticeship,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      onClose();
      router.refresh();
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={contract ? `Modifier — ${contract.label}` : "Nouveau type de contrat"}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="contract-label">Libellé</Label>
          <Input
            id="contract-label"
            value={label}
            placeholder="CDI temps partiel"
            onChange={(event) => setLabel(event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="contract-code">Code court</Label>
          <Input
            id="contract-code"
            value={code}
            placeholder="CDI_TP"
            onChange={(event) => setCode(event.target.value.toUpperCase())}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="contract-apprenticeship">Alternance</Label>
          <Select
            id="contract-apprenticeship"
            value={apprenticeship ? "true" : "false"}
            onChange={(event) => setApprenticeship(event.target.value === "true")}
          >
            <option value="false">Non</option>
            <option value="true">Oui — jours d&apos;école dans le planning</option>
          </Select>
        </div>

        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={isPending}>
            Enregistrer
          </Button>
        </div>
      </div>
    </Modal>
  );
}
