# Module `conges`

Les congés payés, de la demande au solde.

## Le principe

**Le solde n'est jamais un nombre stocké.** C'est la somme des mouvements de `leave_ledger` :
acquisition mensuelle, congé pris, report, ajustement. Un solde faux se corrige en **ajoutant**
une ligne qui dit pourquoi, jamais en réécrivant un chiffre — et l'historique reste lisible un an
plus tard, quand il faut expliquer à quelqu'un d'où vient son solde.

## Tables

| Table            | Rôle                                       |
| ---------------- | ------------------------------------------ |
| `leave_ledger`   | Les mouvements. Le solde est leur somme.   |
| `leave_requests` | Les demandes, de la demande à la décision. |

Aucune politique d'écriture RLS, pour personne. Tout passe par les fonctions.

## Période et règle d'acquisition

Période **1er juin → 31 mai**, configurable (`settings.leave_rules`). Deux modes :

- **`ouvrables`** (défaut) : 2,5 j/mois, **30 j/an**, lundi → samedi hors fériés ;
- **`ouvres`** : 2,08 j/mois, **25 j/an**, lundi → vendredi hors fériés.

La V1 annonçait « 25 jours à 2,5 j/mois », ce qui est incohérent (2,5 × 12 = 30). Les deux modes
existent ; le défaut est `ouvrables`.

## Le décompte

`count_leave_days()` est **l'autorité**. Elle est appelée à la demande, **puis à nouveau à la
validation** : entre les deux, le planning a pu changer.

Ne comptent pas : les jours hors semaine de travail (samedi selon le mode), les jours fériés de
La Réunion — **dont le 20 décembre** —, et les journées déjà planifiées en `rest` ou `school`.
Poser un congé sur son jour de repos ne coûte rien.

`domain/count.ts` fait le même calcul en TypeScript. Ce n'est **pas** la source de vérité : c'est
l'aperçu affiché pendant qu'elle choisit ses dates. Les deux suivent la même règle, et les deux
sont testés sur les mêmes cas — 26 tests Vitest, 41 assertions pgTAP.

## Fonctions

| Fonction               | Appelée par            | Effet                                           |
| ---------------------- | ---------------------- | ----------------------------------------------- |
| `request_leave`        | Collaboratrice         | Dépose une demande, décompte calculé côté base. |
| `admin_decide_leave`   | Direction              | Valide (recalcule, écrit le débit) ou refuse.   |
| `cancel_leave_request` | Les deux, selon statut | En attente : elle. Validé : la direction seule. |
| `admin_adjust_leave`   | Direction              | Ajustement motivé, tracé dans `audit_log`.      |
| `accrue_monthly_leave` | Tâche planifiée        | Acquisition du mois, proratisée à l'embauche.   |
| `close_leave_period`   | Tâche planifiée        | Report ou expiration au 1er juin.               |
| `admin_leave_overlaps` | Direction              | Qui d'autre est absent aux mêmes dates.         |

Les deux tâches sont **idempotentes** : index uniques sur l'acquisition, le report et
l'expiration. La route `/api/cron/conges` les appelle tous les jours plutôt qu'une fois le 1er —
ainsi une journée où la plateforme hoquette ne fait perdre les congés de personne.

## Événements

**Émis** : `conges.request_submitted`, `conges.request_approved`, `conges.request_refused`,
`conges.request_cancelled`. Tous portent `{ id, employee_id, start_date, end_date }` — ce que le
planning attend pour poser ou libérer les journées.

**Écoutés** : les siens, pour les notifications. Une demande va à la direction ; une décision
revient à la collaboratrice. Une annulation n'est notifiée que si elle vient de la direction :
s'annuler soi-même et recevoir une notification pour se l'apprendre n'aiderait personne.

## Écrans

| Route           | Espace         |
| --------------- | -------------- |
| `/conges`       | Collaboratrice |
| `/admin/conges` | Direction      |
