import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/core/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/core/ui/card";

export const metadata: Metadata = { title: "Connexion" };

/** Placeholder: the PIN login flow (boutique → prénom → pavé PIN) is built in Phase 2. */
export default function EmployeeLoginPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Espace collaboratrice</CardTitle>
        <CardDescription>La connexion par prénom et code PIN arrive en Phase 2.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Button asChild className="w-full">
          <Link href="/accueil">Voir l&apos;aperçu de l&apos;espace</Link>
        </Button>
        <Button asChild variant="outline" className="w-full">
          <Link href="/">Retour à l&apos;accueil</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
