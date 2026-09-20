import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/core/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/core/ui/card";

export const metadata: Metadata = { title: "Connexion direction" };

/** Placeholder: the admin email/password login is built in Phase 2. */
export default function AdminLoginPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Espace direction</CardTitle>
        <CardDescription>La connexion par email et mot de passe arrive en Phase 2.</CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild variant="outline" className="w-full">
          <Link href="/">Retour à l&apos;accueil</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
