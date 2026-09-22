import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/core/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/core/ui/card";

import { AdminLoginForm } from "./login-form";

export const metadata: Metadata = { title: "Connexion direction" };
export const dynamic = "force-dynamic";

export default function AdminLoginPage() {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Espace direction</CardTitle>
          <CardDescription>Connectez-vous avec votre adresse email.</CardDescription>
        </CardHeader>
        <CardContent>
          <AdminLoginForm />
        </CardContent>
      </Card>

      <Button asChild variant="ghost" className="mx-auto">
        <Link href="/connexion">Je suis collaboratrice</Link>
      </Button>
    </div>
  );
}
