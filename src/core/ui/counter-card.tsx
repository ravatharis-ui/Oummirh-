import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";

import { Card, CardContent } from "@/core/ui/card";
import { cn } from "@/core/ui/utils";

export interface CounterFigure {
  /** Sous le chiffre, en petites capitales. Court : « JOURS ACQUIS ». */
  label: string;
  /** Déjà formaté — jours, heures, ce que le module sait dire. */
  value: string;
  /** Rouge quand la valeur est négative et que ça compte. */
  tone?: "neutral" | "negative";
}

/**
 * Un compteur, en trois chiffres.
 *
 * Acquis, disponible, utilisé. Les trois côte à côte parce qu'un seul solde ne
 * répond pas à la question qu'on se pose vraiment : « j'en ai eu combien, il
 * m'en reste combien, j'en ai pris combien ». Et parce que les trois ne se
 * déduisent pas l'un de l'autre — un report de l'année précédente entre dans le
 * solde sans avoir été acquis cette année.
 *
 * Purement présentationnel : il ne sait ni ce qu'est un congé, ni ce qu'est une
 * heure. Les deux modules qui l'utilisent formatent leurs propres valeurs.
 */
export function CounterCard({
  title,
  period,
  figures,
  previous,
  next,
}: {
  title: string;
  period?: string;
  figures: readonly CounterFigure[];
  /** Période précédente. Des liens, pas des boutons : la navigation marche
      sans JavaScript et chaque période a son adresse. */
  previous?: Route;
  next?: Route;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between gap-2">
          <PeriodArrow href={previous} direction="previous" />

          <div className="text-center">
            <p className="text-base font-medium">{title}</p>
            {period ? <p className="text-muted-foreground text-sm">{period}</p> : null}
          </div>

          <PeriodArrow href={next} direction="next" />
        </div>

        <dl className="grid grid-cols-3 gap-2">
          {figures.map((figure) => (
            <div key={figure.label} className="flex flex-col items-center gap-1 text-center">
              <dd
                className={cn(
                  "text-2xl font-semibold tabular-nums",
                  figure.tone === "negative" && "text-destructive",
                )}
              >
                {figure.value}
              </dd>
              {/* Le libellé sous le chiffre : on lit d'abord le nombre. */}
              <dt className="text-muted-foreground text-xs leading-tight uppercase">
                {figure.label}
              </dt>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

/**
 * Une flèche de période, ou un vide de la même largeur.
 *
 * Le vide compte : sans lui, le titre se décale quand une seule flèche est
 * proposée, et l'œil croit que l'écran a changé.
 */
function PeriodArrow({ href, direction }: { href?: Route; direction: "previous" | "next" }) {
  const label = direction === "previous" ? "Période précédente" : "Période suivante";
  const Icon = direction === "previous" ? ChevronLeft : ChevronRight;

  if (!href) return <span className="size-11" aria-hidden />;

  return (
    <Link
      href={href}
      aria-label={label}
      className="hover:bg-secondary flex size-11 items-center justify-center rounded-full"
    >
      <Icon className="size-5" aria-hidden />
    </Link>
  );
}
