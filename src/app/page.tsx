import { Building2, Smartphone } from "lucide-react";
import Link from "next/link";

import { Button } from "@/core/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/core/ui/card";

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-8 px-4 py-12">
      <div className="text-center">
        <p className="text-muted-foreground text-sm tracking-[0.3em] uppercase">Oummi Dressing</p>
        <h1 className="mt-2 text-4xl font-semibold">Oummi RH</h1>
        <p className="text-muted-foreground mt-3">Pointage, plannings, congés et documents.</p>
      </div>

      <div className="grid w-full gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone /> Espace collaboratrice
            </CardTitle>
            <CardDescription>
              Connexion par prénom et code PIN, sur votre téléphone.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full" size="lg">
              <Link href="/connexion">Espace collaboratrice</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 /> Espace direction
            </CardTitle>
            <CardDescription>Connexion par email et mot de passe.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full" size="lg">
              <Link href="/admin/connexion">Espace direction</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <p className="text-muted-foreground text-xs">
        Phase 0 — fondations. Les espaces arrivent en Phase 1 et 2.
      </p>
    </main>
  );
}
