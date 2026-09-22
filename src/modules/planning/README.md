# Module `planning`

Le planning de chaque collaboratrice, semaine par semaine.

## Rôle

- **Direction** : matrice hebdomadaire (lignes = collaboratrices, colonnes = lundi → dimanche),
  saisie journée par journée dans un panneau latéral, duplication de semaine, semaine type,
  totaux comparés aux heures contractuelles, version imprimable A4 paysage.
- **Collaboratrice** : sa semaine en liste verticale, et la liste des collègues présentes
  aujourd'hui dans sa boutique.

## Tables

| Table                | Rôle                                                        |
| -------------------- | ----------------------------------------------------------- |
| `planning_entries`   | Une ligne par collaboratrice et par jour (`unique`).        |
| `planning_templates` | Semaine type d'une collaboratrice (jours d'école fixes...). |

`planning_entries.source` dit qui a posé la ligne : `manual`, `template`, `leave`,
`replacement`, `swap`. **Les trois dernières ne sont jamais écrasées** par une duplication de
semaine ni par une semaine type — elles ont été décidées ailleurs, avec l'accord de quelqu'un.

## Écritures

Aucune écriture directe depuis le navigateur. Tout passe par des fonctions `security definer` :

| Fonction                        | Appelée par               | Effet                                                          |
| ------------------------------- | ------------------------- | -------------------------------------------------------------- |
| `admin_upsert_planning_entry`   | Direction                 | Pose ou remplace une journée (`source = manual`).              |
| `admin_delete_planning_entry`   | Direction                 | Vide une journée.                                              |
| `admin_duplicate_planning_week` | Direction                 | Copie une semaine, sans toucher aux sources protégées.         |
| `admin_apply_planning_template` | Direction                 | Applique la semaine type (journées vides par défaut).          |
| `apply_planning_from_event`     | Distributeur d'événements | Pose les journées d'un congé, d'un remplacement, d'un échange. |
| `clear_planning_from_event`     | Distributeur d'événements | Libère les journées d'une demande annulée.                     |

## Événements

**Émis**

- `planning.entry_changed` — `{ employee_id, dates[], first_date }`. Un seul événement par lot,
  et **uniquement pour des journées à venir** : corriger le planning d'avant-hier n'a personne à
  prévenir.

**Écoutés**

- `conges.request_approved` → journées `leave`
- `conges.request_cancelled` → journées libérées
- `remplacements.created` / `remplacements.cancelled` → journées `replacement`
- `swaps.approved` → journées `work`, source `swap`

Tous les gestionnaires sont idempotents : la clé `(source, source_ref)` fait qu'un rejeu réécrit
les mêmes lignes au lieu d'en ajouter.

## Écrans

| Route                        | Espace         |
| ---------------------------- | -------------- |
| `/admin/planning`            | Direction      |
| `/admin/planning/impression` | Direction      |
| `/planning`                  | Collaboratrice |

## Ce que le planning ne dit pas

`my_boutique_presence(date)` ne renvoie que les collègues **présentes**. Le motif d'une absence —
maladie, congé — ne regarde pas les collègues, et la fonction est écrite pour qu'il soit
impossible de le déduire.
