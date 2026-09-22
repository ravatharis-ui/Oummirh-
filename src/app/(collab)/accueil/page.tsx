import type { Metadata } from "next";
import Link from "next/link";

import { requireEmployee } from "@/core/auth";
import { createServerSupabaseClient } from "@/core/db/server";

import { Button } from "@/core/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/core/ui/card";

import { getRegistry } from "../../registry";

export const metadata: Metadata = { title: "Accueil" };

export default async function CollabHomePage() {
  await requireEmployee();

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.from("employees").select("display_name").maybeSingle();

  const registry = await getRegistry();
  const widgets = registry.widgets("collab");

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <h1 className="text-2xl font-semibold">
        Bonjour{data?.display_name ? ` ${data.display_name}` : ""}
      </h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ta journée</CardTitle>
          <CardDescription>Pointe ton arrivée, ta pause et ton départ.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button size="lg" asChild>
            <Link href="/pointer">Pointer</Link>
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link href="/planning">Voir mon planning</Link>
          </Button>
        </CardContent>
      </Card>

      {widgets.map((Widget, index) => (
        <Widget key={index} />
      ))}
    </div>
  );
}
