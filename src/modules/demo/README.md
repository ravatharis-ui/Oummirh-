# Module `demo` — Démonstration

_Implémenté en Phase 1._

- **Rôle** : prouver qu'ajouter une fonctionnalité = ajouter un dossier. Sert aussi de gabarit
  pour créer un vrai module.
- **Tables** : aucune.
- **Événements émis** : aucun.
- **Événements écoutés** : aucun.
- **Écrans** : `/demo` (collaboratrice) et `/admin/demo` (direction), plus une carte sur chaque
  tableau de bord.

## Ce qu'il démontre

Le fichier `manifest.ts` déclare une entrée de menu par espace, une carte de tableau de bord par
espace et un type de notification. Le seul autre endroit qui le mentionne est `src/app/modules.ts`.
Aucun layout, aucun menu, aucun autre module n'a été modifié pour l'accueillir.

Pour le désactiver sans toucher au code : passez `demo` à `false` dans le réglage
`modules_enabled` (table `settings`).
