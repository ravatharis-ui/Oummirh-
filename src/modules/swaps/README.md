# Module `swaps`

La bourse d'échange de créneaux.

## Le parcours

Le seul flux à **double validation** de l'application, et l'ordre compte :

```
demandeuse → la collègue accepte ou refuse → la direction valide ou refuse → les deux plannings changent
```

La collègue d'abord, parce que demander à la direction d'arbitrer un échange que l'intéressée
refusera est une perte de temps pour tout le monde.

| Statut                                            | Qui attend-on         |
| ------------------------------------------------- | --------------------- |
| `pending_partner`                                 | la collègue           |
| `pending_admin`                                   | la direction          |
| `approved`                                        | personne — c'est fait |
| `refused_partner` / `refused_admin` / `cancelled` | personne              |

**Une fois validé, un échange ne s'annule plus** : les deux plannings ont changé et deux personnes
ont organisé leur semaine autour.

## Les contrôles

À la demande, `request_swap` refuse : la même personne des deux côtés, une journée passée, une
journée en congé / maladie / école, une journée déjà engagée dans un autre échange vivant, et la
**double affectation** — si ta collègue travaille déjà le jour que tu lui cèdes, l'échange lui
ferait perdre son créneau.

Le cas des deux mêmes dates est traité à part : c'est l'échange le plus banal — deux personnes qui
permutent leurs horaires d'une même journée — et il ne pose aucun de ces problèmes.

## Ce que le module ne montre pas

Une collaboratrice ne lit pas le planning d'une collègue. `swappable_days()` ne renvoie **que** les
journées échangeables — travail, remplacement, repos. Un congé, un arrêt maladie ou un jour
d'école n'y figurent pas, et sont donc indistinguables d'une journée sans planning. Même règle que
`my_boutique_presence` : on dit qui est là, jamais pourquoi quelqu'un ne l'est pas.

`swap_colleagues()` renvoie un prénom et un point de vente. De quoi choisir dans une liste, pas de
quoi reconstituer l'annuaire du personnel.

## L'échange lui-même

`apply_planning_swap()` : les deux lignes changent de propriétaire. Ce que la demandeuse faisait
ce jour-là, sa collègue le fera, et réciproquement. Les journées libérées deviennent du repos —
sauf quand les deux dates sont la même, où il n'y a rien à libérer.

Idempotente : les lignes portent la marque `swap` de cette demande, donc rejouer l'événement ne
réinverse pas l'échange. Et `swap` est une **source protégée** : une duplication de semaine ne
l'écrase pas.

## Événements

**Émis** : `swaps.requested`, `swaps.accepted_by_partner`, `swaps.refused_by_partner`,
`swaps.approved`, `swaps.refused_by_admin`, `swaps.cancelled`.

**Écoutés** : les siens. Chaque événement ne prévient que la personne dont c'est le tour — sauf
`swaps.approved`, qui concerne les deux.

## Écrans

| Route             | Espace         |
| ----------------- | -------------- |
| `/echanges`       | Collaboratrice |
| `/admin/echanges` | Direction      |
