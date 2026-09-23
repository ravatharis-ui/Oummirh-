# Module `remplacements`

« + Remplacement direct » : envoyer quelqu'un en renfort pour une journée.

## Rôle

Le module le plus simple de l'application, et celui qui sert le plus souvent. La direction
choisit un point de vente et un jour, voit qui est disponible, confirme. La collaboratrice reçoit
une notification et un email.

## Le formulaire en trois étapes

1. **Où et quand** — point de vente qui a besoin de renfort, date, horaires.
2. **Qui** — la liste n'est pas filtrée, elle est **qualifiée** :

   | État                | Sélectionnable | Pourquoi                                                  |
   | ------------------- | -------------- | --------------------------------------------------------- |
   | Libre               | oui            | Rien de prévu ce jour-là.                                 |
   | Déjà sur place      | oui            | Elle travaille déjà dans ce point de vente.               |
   | Ailleurs ce jour-là | oui            | La déplacer laissera un trou ailleurs — l'écran le dit.   |
   | Indisponible        | **non**        | Congé, maladie ou école : il faut d'abord revenir dessus. |

3. **Relire** — parce que l'étape suivante est une notification sur le téléphone de quelqu'un, et
   qu'une notification ne se rattrape pas.

## Table

`direct_replacements`, avec un index unique sur `(employee_id, date)` pour les lignes actives :
deux boutiques ne peuvent pas l'attendre le même matin.

## Événements

**Émis** : `remplacements.created`, `remplacements.cancelled` — tous deux portent
`{ id, employee_id, boutique_id, start_date, end_date, start_time, end_time }`.

**Écoutés** : les siens, pour notifier la personne concernée. C'est la notification la plus utile
de toute l'application : elle change son lendemain. Elle part donc **aussi par email**.

## L'annulation rend ce qu'elle avait pris

C'est le point qui a coûté le plus de soin. `apply_planning_from_event` prend un **cliché** de la
journée avant de l'écraser (`planning_snapshots`), et `clear_planning_from_event` la restaure.

Deux subtilités décident de tout :

- le cliché est pris `on conflict do nothing` — **rejouer** un événement ne doit pas remplacer le
  cliché d'origine par la ligne déjà appliquée ;
- on ne restaure que si la journée appartient **encore** à la demande qui l'avait posée. Une
  saisie manuelle de la direction depuis est une décision plus récente, et on ne défait pas une
  décision plus récente.

Le même mécanisme répare l'annulation d'un congé, qui laissait jusque-là un trou dans le planning.

## Écran

| Route                  | Espace    |
| ---------------------- | --------- |
| `/admin/remplacements` | Direction |

Côté collaboratrice, un remplacement apparaît directement dans son planning.
