import { Sparkles } from "lucide-react";

import { Card, CardDescription, CardHeader, CardTitle } from "@/core/ui/card";

/** Dashboard widget contributed to the employee home screen by the registry. */
export function DemoCollabWidget() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-5" aria-hidden /> Module de démonstration
        </CardTitle>
        <CardDescription>
          Cette carte et l&apos;onglet « Démo » viennent d&apos;un dossier de module, pas de
          l&apos;écran d&apos;accueil.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
