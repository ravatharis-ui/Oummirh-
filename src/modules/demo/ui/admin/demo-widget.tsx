import { Sparkles } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/core/ui/card";

/** Dashboard widget contributed to the direction dashboard by the registry. */
export function DemoAdminWidget() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-5" aria-hidden /> Module de démonstration
        </CardTitle>
        <CardDescription>Preuve que le registre pilote menus et tableaux de bord.</CardDescription>
      </CardHeader>
      <CardContent className="text-muted-foreground text-sm">
        Désactivez la clé <code className="font-mono">demo</code> dans le réglage{" "}
        <code className="font-mono">modules_enabled</code> : l&apos;onglet et cette carte
        disparaissent des deux espaces.
      </CardContent>
    </Card>
  );
}
