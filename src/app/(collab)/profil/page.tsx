import { LogOut, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { signOut } from "@/core/auth/actions";
import { requireEmployee } from "@/core/auth";
import { createServerSupabaseClient } from "@/core/db/server";
import { formatTime } from "@/core/time";
import { Button } from "@/core/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/core/ui/card";

export const metadata: Metadata = { title: "Profil" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  await requireEmployee();
  const supabase = await createServerSupabaseClient();

  // Explicit columns: `select *` is refused on this table, since `pin_hash` is
  // readable by no one.
  const { data } = await supabase
    .from("employees")
    .select("display_name, last_name, first_name, default_start, default_end, boutiques(name)")
    .maybeSingle();

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <h1 className="text-2xl font-semibold">Mon profil</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {data ? `${data.first_name} ${data.last_name}` : "Mes informations"}
          </CardTitle>
          <CardDescription>{data?.boutiques?.name}</CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground text-base">
          {data
            ? `Horaires habituels : ${formatTime(data.default_start)} – ${formatTime(data.default_end)}`
            : "Informations indisponibles pour le moment."}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="size-5" aria-hidden /> Mon code PIN
          </CardTitle>
          <CardDescription>
            Votre code n&apos;est stocké nulle part en clair. Si vous l&apos;oubliez, la direction
            vous en génère un nouveau.
          </CardDescription>
        </CardHeader>
      </Card>

      <form
        action={async () => {
          "use server";
          await signOut("collab");
        }}
      >
        <Button type="submit" variant="outline" className="w-full" size="lg">
          <LogOut className="size-5" aria-hidden /> Se déconnecter
        </Button>
      </form>

      <p className="text-muted-foreground text-center text-base">
        <Link href="/confidentialite" className="underline underline-offset-4">
          Ce que l&apos;application enregistre
        </Link>
      </p>
    </div>
  );
}
