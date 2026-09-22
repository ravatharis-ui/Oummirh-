import type { Metadata } from "next";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/core/ui/card";

export const metadata: Metadata = { title: "Démo" };

export default function CollabDemoPage() {
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <h1 className="text-2xl font-semibold">Module de démonstration</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pourquoi cet écran existe</CardTitle>
          <CardDescription>
            Il prouve qu&apos;une fonctionnalité s&apos;ajoute en créant un dossier.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground text-base">
          L&apos;onglet « Démo » de la barre du bas n&apos;a été écrit dans aucun menu : il vient du
          manifeste du module, lu par le registre.
        </CardContent>
      </Card>
    </div>
  );
}
