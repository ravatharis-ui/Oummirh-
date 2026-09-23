"use client";

import { Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { saveBoutique, setBoutiqueActive } from "@/core/settings/actions";
import type { BoutiqueRow } from "@/core/settings/queries";

import { Badge } from "../badge";
import { Button } from "../button";
import { Input } from "../input";
import { Label } from "../label";
import { Modal } from "../modal";
import { Select } from "../select";

/**
 * Les points de vente.
 *
 * Cinq aujourd'hui, peut-être sept demain : c'est exactement le genre de chose
 * qui ne doit pas demander un développeur. Un point de vente ne se supprime
 * jamais — des plannings et des pointages le référencent — il se ferme, et se
 * rouvre.
 */
export function BoutiqueManager({ boutiques }: { boutiques: BoutiqueRow[] }) {
  const [editing, setEditing] = useState<BoutiqueRow | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function toggle(boutique: BoutiqueRow): void {
    setError(null);
    startTransition(async () => {
      const result = await setBoutiqueActive(boutique.id, !boutique.isActive);
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}

      <ul className="flex flex-col gap-2">
        {boutiques.map((boutique) => (
          <li
            key={boutique.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"
          >
            <div>
              <p className="font-medium">
                {boutique.name}{" "}
                <span className="text-muted-foreground font-normal">({boutique.code})</span>
              </p>
              <p className="text-muted-foreground text-sm">
                {boutique.kind === "online" ? "Vente en ligne" : "Boutique"}
                {boutique.address ? ` · ${boutique.address}` : ""}
                {boutique.activeStaff > 0
                  ? ` · ${boutique.activeStaff} collaboratrice${boutique.activeStaff > 1 ? "s" : ""}`
                  : " · personne pour l'instant"}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {boutique.isActive ? null : <Badge variant="outline">Fermé</Badge>}
              <Button variant="ghost" size="sm" onClick={() => setEditing(boutique)}>
                Modifier
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={isPending}
                onClick={() => toggle(boutique)}
              >
                {boutique.isActive ? "Fermer" : "Rouvrir"}
              </Button>
            </div>
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
        Ajouter un point de vente
      </Button>

      {editing ? (
        <BoutiqueDialog
          boutique={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}

function BoutiqueDialog({
  boutique,
  onClose,
}: {
  boutique: BoutiqueRow | null;
  onClose: () => void;
}) {
  const [name, setName] = useState(boutique?.name ?? "");
  const [code, setCode] = useState(boutique?.code ?? "");
  const [kind, setKind] = useState(boutique?.kind ?? "physical");
  const [address, setAddress] = useState(boutique?.address ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function submit(): void {
    setError(null);
    startTransition(async () => {
      const result = await saveBoutique({
        id: boutique?.id ?? null,
        code,
        name,
        kind,
        address: address.trim() ? address.trim() : null,
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
      title={boutique ? `Modifier — ${boutique.name}` : "Nouveau point de vente"}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="boutique-name">Nom</Label>
          <Input
            id="boutique-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="boutique-code">Code court</Label>
          <Input
            id="boutique-code"
            value={code}
            placeholder="SAINT_DENIS"
            onChange={(event) => setCode(event.target.value.toUpperCase())}
          />
          <p className="text-muted-foreground text-sm">
            Majuscules, chiffres et tirets bas. Il sert de repère interne et ne s&apos;affiche pas
            aux collaboratrices.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="boutique-kind">Type</Label>
          <Select id="boutique-kind" value={kind} onChange={(event) => setKind(event.target.value)}>
            <option value="physical">Boutique</option>
            <option value="online">Vente en ligne</option>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="boutique-address">Adresse (facultative)</Label>
          <Input
            id="boutique-address"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
          />
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
