# Module `heures`

Le suivi des heures et la récupération.

> ⚠️ **Ce module tient un compteur de récupération interne.** Il ne calcule aucune majoration
> légale et ne produit aucune paie. L'écran de la direction le dit, et ce README aussi.

## Le principe

Comme les congés : le solde est la somme des mouvements de `hours_ledger`, jamais un nombre qu'on
rectifie. Trois natures seulement :

| Nature        | D'où elle vient                                                 |
| ------------- | --------------------------------------------------------------- |
| `daily_delta` | Une journée close : réel − planifié.                            |
| `recovery`    | Des heures reprises, en arrivant plus tard ou partant plus tôt. |
| `adjustment`  | Une correction de la direction, motivée et tracée.              |

## Le calcul quotidien

`compute_daily_hours(date)` écrit **une seule ligne par collaboratrice et par journée** (index
unique) : un recalcul met à jour celle-là au lieu d'en ajouter une, sinon une correction de
pointage compterait deux fois la même journée.

**Une journée sans départ pointé n'écrit rien.** Ce n'est pas une journée à zéro heure, c'est une
journée dont on ne sait rien ; écrire « −7 h » ferait porter à la collaboratrice le prix d'un
téléphone déchargé. La direction a déjà une alerte pour ça.

Le calcul tourne à chaud (sur `pointage.clock_recorded` avec `clock_out`, et sur
`pointage.corrected`) et en filet, une fois par nuit sur aujourd'hui **et** hier — un départ
pointé à minuit vingt doit finir par être compté.

## La récupération

`request_recovery()` : un jour **à venir** où elle travaille, arriver plus tard ou partir plus
tôt, par paliers de **quinze minutes**.

Le plafond n'est pas le solde mais le solde **moins ce qui est déjà demandé et pas encore
tranché** — sans cette soustraction, trois demandes de deux heures passeraient toutes les trois
avec un solde de deux heures.

À la validation, `admin_decide_recovery()` écrit le débit et émet `heures.recovery_approved`. Le
déplacement de la journée appartient au planning, qui écoute : ce module n'écrit jamais dans
`planning_entries`.

## Événements

**Émis** : `heures.recovery_requested`, `heures.recovery_approved`, `heures.recovery_refused`.

**Écoutés** : `pointage.clock_recorded`, `pointage.corrected` (recalcul), et les siens pour les
notifications.

Côté planning, `apply_planning_recovery()` repart de l'horaire d'origine et marque la journée
`source = 'recovery'` — une source **protégée**, qu'une duplication de semaine ne peut pas
écraser. Sans cela, la collaboratrice serait attendue à 9 h un jour où la direction lui a dit
d'arriver à 11 h.

## Écrans

| Route                  | Espace          |
| ---------------------- | --------------- |
| `/heures`              | Collaboratrice  |
| `/admin/heures`        | Direction       |
| `/admin/heures/export` | Direction (CSV) |

L'export est en point-virgule, décimales à la virgule, avec un BOM : c'est ce qu'Excel en
français attend, et un fichier qui s'ouvre en une seule colonne n'est pas un export.
