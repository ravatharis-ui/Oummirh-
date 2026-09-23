import type { Metadata } from "next";

import { ALL_MODULES } from "@/app/modules";
import { getSettings } from "@/core/settings";
import { listBoutiques, listContractTypes, listUpcomingHolidays } from "@/core/settings/queries";
import { definitionsOfGroup, SETTING_GROUPS, toFormFields } from "@/core/settings/registry";
import type { SettingsKey } from "@/core/settings/schemas";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/core/ui/card";
import { BoutiqueManager } from "@/core/ui/settings/boutique-manager";
import { ContractManager } from "@/core/ui/settings/contract-manager";
import { HolidayManager } from "@/core/ui/settings/holiday-manager";
import { ModuleManager, type ModuleRow } from "@/core/ui/settings/module-manager";
import { SettingCard } from "@/core/ui/settings/setting-card";

export const metadata: Metadata = { title: "Paramètres" };
export const dynamic = "force-dynamic";

/**
 * L'écran de paramétrage.
 *
 * Il ne connaît aucun réglage en particulier : il parcourt le registre et rend
 * ce qu'il y trouve. Ajouter un réglage plus tard, c'est ajouter une entrée au
 * registre et une migration qui pose sa valeur par défaut — cette page ne
 * changera pas.
 */
export default async function SettingsPage() {
  const [settings, boutiques, contracts, holidays] = await Promise.all([
    getSettings(),
    listBoutiques(),
    listContractTypes(),
    listUpcomingHolidays(),
  ]);

  const modules: ModuleRow[] = ALL_MODULES.map((module) => ({
    key: module.key,
    name: module.name,
    description: module.description ?? "",
    required: module.required ?? false,
    // Un module absent de `modules_enabled` est actif : le défaut est « allumé ».
    enabled: settings.modules_enabled[module.key] !== false,
  }));

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Paramètres</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Tout ce qui se règle ici se règle sans développeur. Chaque modification est enregistrée
          dans le journal d&apos;audit, avec son avant et son après.
        </p>
      </div>

      {SETTING_GROUPS.map((group) => {
        const definitions = definitionsOfGroup(group.key);
        if (definitions.length === 0) return null;

        return (
          <Card key={group.key}>
            <CardHeader>
              <CardTitle className="text-lg">{group.label}</CardTitle>
              <CardDescription>{group.help}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {definitions.map((definition) => (
                <SettingCard
                  key={definition.key}
                  definition={definition}
                  fields={toFormFields(definition.key as SettingsKey, settings)}
                />
              ))}
            </CardContent>
          </Card>
        );
      })}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Points de vente</CardTitle>
          <CardDescription>
            Ajouter, renommer ou fermer un point de vente. Un point de vente fermé garde tout son
            historique.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BoutiqueManager boutiques={boutiques} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Types de contrat</CardTitle>
          <CardDescription>
            La liste proposée à la création d&apos;une collaboratrice. Elle s&apos;allonge sans
            intervention technique.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ContractManager contracts={contracts} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Jours fériés</CardTitle>
          <CardDescription>
            Pâques et l&apos;Ascension changent de date chaque année : c&apos;est ici qu&apos;on les
            tient à jour.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <HolidayManager holidays={holidays} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Modules</CardTitle>
          <CardDescription>
            Allumer ou éteindre une partie de l&apos;application, sans rien perdre.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ModuleManager modules={modules} />
        </CardContent>
      </Card>
    </div>
  );
}
