import type { Metadata } from "next";

import { requireEmployee } from "@/core/auth";
import { createServerSupabaseClient } from "@/core/db/server";

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
          <CardTitle className="text-base">Pointage</CardTitle>
          <CardDescription>Le bouton de pointage arrive en Phase 4.</CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground text-base">
          Votre planning, vos soldes et vos demandes s&apos;afficheront ici.
        </CardContent>
      </Card>

      {widgets.map((Widget, index) => (
        <Widget key={index} />
      ))}
    </div>
  );
}
