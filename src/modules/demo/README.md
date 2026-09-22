# Module `demo` — Démonstration

_Implémenté en Phase 1, complété en Phase 3._

- **Rôle** : prouver qu'ajouter une fonctionnalité = ajouter un dossier, et donner de quoi
  vérifier la chaîne des événements de bout en bout. Sert aussi de gabarit.
- **Tables** : aucune.
- **Événements émis** : `demo.hello`, `demo.fail`.
- **Événements écoutés** : `demo.hello` (notifie l'auteur), `demo.fail` (échoue toujours).
- **Écrans** : `/demo` (collaboratrice), `/admin/demo` (direction, avec le panneau de vérification).

## Ce qu'il démontre

Le manifeste déclare une entrée de menu par espace, une carte de tableau de bord par espace,
un type de notification et deux gestionnaires d'événements. Le seul autre endroit qui mentionne
ce module est `src/app/modules.ts`.

Le panneau de la page `/admin/demo` permet de :

1. inscrire un événement qui aboutit à une notification, email compris ;
2. inscrire un événement dont le gestionnaire échoue toujours ;
3. lancer une passe du distributeur à la demande.

`demo.fail` existe pour une raison précise : c'est la seule façon honnête de vérifier qu'un
événement en échec est abandonné après cinq tentatives au lieu de tourner en boucle. Relancez
le traitement plusieurs fois et regardez le compteur monter, puis l'événement passer en
« abandonné » avec son motif.

## Une limite d'architecture illustrée

Le bouton « Traiter la file maintenant » ne vit **pas** dans ce module, mais dans
`src/app/(admin)/admin/demo/actions.ts`. Construire le registre suppose de connaître tous les
modules, et un module ne remonte jamais vers la couche application. L'action est donc passée au
composant en propriété. ESLint a attrapé la première version, qui violait cette règle.

## Désactivation

Passez `demo` à `false` dans le réglage `modules_enabled` : l'onglet, les cartes et les
gestionnaires disparaissent des deux espaces, sans toucher au code.
