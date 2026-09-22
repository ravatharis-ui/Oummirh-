import type { Metadata } from "next";

import { getPlanningWeek, PrintWeek } from "@/modules/planning";

export const metadata: Metadata = { title: "Planning à imprimer" };
export const dynamic = "force-dynamic";

function asString(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

/**
 * The printable week.
 *
 * A route of its own rather than a print stylesheet on the main screen: the
 * direction opens it in a tab, checks what will come out, and prints. No risk of
 * the side panel or the toolbar ending up on paper.
 */
export default async function PlanningPrintPage({
  searchParams,
}: PageProps<"/admin/planning/impression">) {
  const params = await searchParams;
  const week = await getPlanningWeek(asString(params.week), asString(params.boutique));

  return <PrintWeek week={week} />;
}
