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
      <CardContent>
        <Button asChild variant="outline" className="w-full">
          <Link href="/">Retour à l&apos;accueil</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
