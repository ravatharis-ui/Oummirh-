import type { Metadata } from "next";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/core/ui/card";

export const metadata: Metadata = { title: "Démo" };

export default function AdminDemoPage() {
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <h1 className="text-2xl font-semibold">Module de démonstration</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ajouter une fonctionnalité</CardTitle>
          <CardDescription>Un dossier, une ligne, rien d&apos;autre.</CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-2 text-sm">
          <p>
            1. Créer <code className="font-mono">src/modules/mon-module/</code> avec un
            <code className="font-mono"> manifest.ts</code> et un{" "}
            <code className="font-mono">index.ts</code>.
          </p>
          <p>
            2. Ajouter son manifeste à <code className="font-mono">src/app/modules.ts</code>.
          </p>
          <p>
            Les menus des deux espaces, les cartes de tableau de bord, les types de notification et
            le routage des événements suivent automatiquement.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
