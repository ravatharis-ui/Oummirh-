import { AlertTriangle, CheckCircle2, CircleDashed, Clock } from "lucide-react";

import {
  formatJobAge,
  getJobHealth,
  hasJobTrouble,
  type JobHealth,
  type JobStatus,
} from "@/core/jobs";
import { Badge } from "@/core/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/core/ui/card";

/**
 * Le tableau de bord de ce qui tourne tout seul.
 *
 * Cinq tâches s'exécutent sans que personne clique, et jusqu'ici rien ne disait
 * qu'une s'était arrêtée : on l'aurait découvert en mars, en constatant que
 * personne n'acquiert de congés depuis janvier. Un voyant, un coup d'œil.
 *
 * Écrite pour être lue en deux secondes par quelqu'un qui a un commerce à
 * faire tourner : la ligne dit ce qui se passe, et le détail de ce qu'on perd
 * n'apparaît que sur la tâche qui va mal.
 */
const TONE: Record<
  JobStatus,
  { label: string; variant: "success" | "warning" | "danger" | "outline" }
> = {
  ok: { label: "à jour", variant: "success" },
  late: { label: "en retard", variant: "danger" },
  failing: { label: "en échec", variant: "danger" },
  never: { label: "jamais lancée", variant: "outline" },
};

function StatusIcon({ status }: { status: JobStatus }) {
  if (status === "ok") return <CheckCircle2 className="size-5 text-emerald-600" aria-hidden />;
  if (status === "never")
    return <CircleDashed className="text-muted-foreground size-5" aria-hidden />;
  return <AlertTriangle className="text-destructive size-5" aria-hidden />;
}

export async function JobHealthCard() {
  const health = await getJobHealth();
  const trouble = hasJobTrouble(health);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="size-5" aria-hidden /> Tâches automatiques
        </CardTitle>
        <CardDescription>
          {trouble
            ? "Une tâche ne fait plus son travail. Le détail est ci-dessous."
            : "Tout ce qui doit tourner sans intervention tourne."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ul className="flex flex-col gap-3">
          {health.map((item) => (
            <JobLine key={item.definition.key} item={item} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function JobLine({ item }: { item: JobHealth }) {
  const tone = TONE[item.status];
  const worrying = item.status === "late" || item.status === "failing";

  return (
    <li className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-medium">
          <StatusIcon status={item.status} />
          {item.definition.label}
        </span>
        <span className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm tabular-nums">
            {formatJobAge(item.ageMinutes)}
          </span>
          <Badge variant={tone.variant}>{tone.label}</Badge>
        </span>
      </div>

      {/* Ce qu'on perd n'intéresse que si on est en train de le perdre. */}
      {worrying ? (
        <p className="text-muted-foreground pl-7 text-sm">
          {item.definition.description}
          {item.run?.error ? (
            <span className="text-destructive block">Dernière erreur : {item.run.error}</span>
          ) : null}
        </p>
      ) : null}

      {item.status === "never" ? (
        <p className="text-muted-foreground pl-7 text-sm">
          Normal tant que son heure de passage n&apos;est pas arrivée depuis la mise en ligne.
        </p>
      ) : null}
    </li>
  );
}
