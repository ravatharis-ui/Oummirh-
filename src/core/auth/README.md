# core/auth

Session, rôles et gardes d'accès.

- `getCurrentUser()` s'appuie sur `getUser()`, qui valide le jeton auprès du serveur Supabase.
  `getSession()` n'est jamais utilisé pour une décision d'autorisation : son contenu vient du
  cookie, donc du navigateur.
- `requireEmployee()` et `requireAdmin()` redirigent vers l'écran de connexion correspondant.
- `getCurrentEmployeeId()` passe par la fonction SQL `current_employee_id()` et non par la table
  `employees`, pour que `core/` dépende d'un contrat documenté plutôt que du schéma d'un module.

⚠️ Les gardes sont un confort, pas la frontière de sécurité. C'est la RLS qui empêche une
collaboratrice de lire les lignes d'une autre, et elle s'applique même si une garde est oubliée.
