import { ChevronLeft, Store } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { cookies } from "next/headers";

import { tryCreateServerSupabaseClient } from "@/core/db/server";
import { Button } from "@/core/ui/button";

import { PinPad } from "./pin-pad";

export const metadata: Metadata = { title: "Connexion" };
// The keypad and the remembered employee are per-request, never cached.
export const dynamic = "force-dynamic";

const LAST_EMPLOYEE_COOKIE = "oummi_last_employee";

function initials(name: string): string {
  return name.trim().slice(0, 2).toUpperCase();
}

function Tile({ href, label, sub }: { href: Route; label: string; sub?: string }) {
  return (
    <Button asChild variant="secondary" className="h-auto w-full justify-start px-4 py-4">
      <Link href={href}>
        <span className="bg-background flex size-12 shrink-0 items-center justify-center rounded-full text-base font-semibold">
          {initials(label)}
        </span>
        <span className="flex min-w-0 flex-col items-start">
          <span className="truncate text-lg font-medium">{label}</span>
          {sub ? <span className="text-muted-foreground truncate text-sm">{sub}</span> : null}
        </span>
      </Link>
    </Button>
  );
}

/**
 * Employee login, in three steps: boutique, then first name, then keypad.
 *
 * The first two steps are plain links and server rendering, so they work before
 * any JavaScript loads. Only the keypad needs the browser.
 *
 * Every read here goes through `security definer` functions that return first
 * names and nothing else: no surname, no email, no phone. The `employees` table
 * itself stays unreadable to an anonymous visitor.
 */
export default async function EmployeeLoginPage({ searchParams }: PageProps<"/connexion">) {
  const params = await searchParams;
  const asString = (value: string | string[] | undefined) =>
    typeof value === "string" ? value : undefined;

  const forcePicker = asString(params.choisir) === "1";
  const boutiqueId = asString(params.boutique);
  const employeeParam = asString(params.employee);

  const supabase = await tryCreateServerSupabaseClient();

  if (!supabase) {
    // The link to the direction stays reachable on purpose: whoever can fix the
    // configuration needs a way in, even when nothing else loads.
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">Où travaillez-vous ?</h1>
        <p className="text-destructive text-base">
          L&apos;application n&apos;est pas encore reliée à sa base de données. Prévenez la
          direction : il manque la configuration Supabase.
        </p>
        <Button asChild variant="ghost" className="mx-auto">
          <Link href="/admin/connexion">Je suis la direction</Link>
        </Button>
      </div>
    );
  }

  const rememberedId = forcePicker
    ? undefined
    : ((await cookies()).get(LAST_EMPLOYEE_COOKIE)?.value ?? undefined);
  const targetEmployeeId = employeeParam ?? rememberedId;

  // --- Step 3: the keypad -----------------------------------------------------
  if (targetEmployeeId) {
    const { data } = await supabase.rpc("login_employee", { p_employee_id: targetEmployeeId });
    const employee = Array.isArray(data) ? data[0] : null;

    if (employee) {
      return (
        <div className="flex flex-col gap-8 py-4">
          <PinPad employeeId={employee.id} displayName={employee.display_name} />
          <Button asChild variant="ghost" className="mx-auto">
            <Link href="/connexion?choisir=1">Ce n&apos;est pas moi</Link>
          </Button>
        </div>
      );
    }
    // Archived or unknown: fall through to the picker rather than dead-end.
  }

  // --- Step 2: first names of one boutique ------------------------------------
  if (boutiqueId) {
    const [{ data: employees }, { data: boutiques }] = await Promise.all([
      supabase.rpc("login_employees", { p_boutique_id: boutiqueId }),
      supabase.rpc("login_boutiques"),
    ]);
    const boutique = (boutiques ?? []).find((item) => item.id === boutiqueId);

    return (
      <div className="flex flex-col gap-6">
        <div>
          <Button asChild variant="ghost" className="-ml-2 px-2">
            <Link href="/connexion?choisir=1">
              <ChevronLeft className="size-5" aria-hidden /> Changer de boutique
            </Link>
          </Button>
          <h1 className="mt-2 text-2xl font-semibold">Qui êtes-vous ?</h1>
          {boutique ? <p className="text-muted-foreground">{boutique.name}</p> : null}
        </div>

        {employees && employees.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {employees.map((employee) => (
              <li key={employee.id}>
                <Tile
                  href={`/connexion?boutique=${boutiqueId}&employee=${employee.id}`}
                  label={employee.display_name}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-base">
            Aucune collaboratrice n&apos;est encore rattachée à ce point de vente.
          </p>
        )}
      </div>
    );
  }

  // --- Step 1: the boutique ---------------------------------------------------
  const { data: boutiques, error } = await supabase.rpc("login_boutiques");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-muted-foreground text-sm tracking-[0.3em] uppercase">Oummi Dressing</p>
        <h1 className="mt-1 text-2xl font-semibold">Où travaillez-vous ?</h1>
      </div>

      {error ? (
        <p className="text-destructive text-base">
          Impossible de charger les points de vente. Vérifiez votre connexion et réessayez.
        </p>
      ) : boutiques && boutiques.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {boutiques.map((boutique) => (
            <li key={boutique.id}>
              <Tile href={`/connexion?boutique=${boutique.id}`} label={boutique.name} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <Store className="text-muted-foreground size-10" aria-hidden />
          <p className="text-muted-foreground text-base">
            Aucun point de vente n&apos;a encore de collaboratrice. La direction doit les créer.
          </p>
        </div>
      )}

      <Button asChild variant="ghost" className="mx-auto">
        <Link href="/admin/connexion">Je suis la direction</Link>
      </Button>
    </div>
  );
}
