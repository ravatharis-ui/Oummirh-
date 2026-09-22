# core/time

Logique de temps pure (aucun import Supabase, React ou Next), testée par Vitest.

- Les **dates** sont des chaînes `AAAA-MM-JJ` interprétées à La Réunion, jamais des objets `Date` :
  une chaîne ne peut pas glisser d'un jour à cause d'un fuseau. En interne chaque date est ancrée
  à 12:00 UTC, ce qui garde le jour stable sous tous les décalages réels.
- Les **heures** sont des chaînes `HH:MM` (les valeurs `HH:MM:SS` de Postgres sont acceptées).
- Les **durées** sont des minutes, affichées en français : `7 h 30`, `45 min`, `+3 h 45`.
- La Réunion est à UTC+4 toute l'année, sans heure d'été : aucune heure locale n'est ambiguë.
