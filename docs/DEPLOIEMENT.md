# Mettre Oummi RH en ligne

Guide pour une personne **non développeuse**. Tout se fait depuis le navigateur : rien à installer
sur votre ordinateur, aucune ligne de commande.

Trois services, chacun avec un rôle :

| Service      | Rôle                                                  | Compte nécessaire |
| ------------ | ----------------------------------------------------- | ----------------- |
| **GitHub**   | garde le code et applique les mises à jour de la base | déjà créé         |
| **Supabase** | la base de données, les comptes et les fichiers       | déjà créé         |
| **Vercel**   | héberge l'application que vos collaboratrices ouvrent | à créer, gratuit  |

---

## Étape 1 — Récupérer vos informations Supabase

Ouvrez le tableau de bord de votre projet Supabase et notez quatre valeurs.

1. `Project Settings` → `General` : la **Reference ID** du projet. C'est une suite de lettres,
   la même que dans l'adresse de votre projet.
2. `Project Settings` → `API` : l'**URL du projet**, la clé **`anon`** (parfois appelée
   « publishable ») et la clé **`service_role`** (parfois appelée « secret »).
3. `Project Settings` → `Database` : le **mot de passe de la base**. Si vous ne l'avez plus,
   le bouton de réinitialisation en crée un nouveau, à noter immédiatement.

⚠️ La clé `service_role` et le mot de passe de la base donnent un accès total. Ils se collent
uniquement dans les écrans décrits ci-dessous. Jamais dans un message, un email ou un ticket.

---

## Étape 2 — Donner ses accès à GitHub

GitHub va créer et mettre à jour les tables à votre place.

### ⚠️ Ne pas confondre les trois identifiants Supabase

Ils se ressemblent et servent à des choses totalement différentes.

| Identifiant                            | Où le trouver                                                                                       | À quoi il sert                                        | Il commence par            |
| -------------------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | -------------------------- |
| **Jeton d'accès personnel**            | votre **compte**, pas le projet : avatar en haut à droite → `Account Preferences` → `Access Tokens` | piloter le projet depuis GitHub                       | `sbp_`                     |
| **Clé `anon`** (ou « publishable »)    | le **projet** : `Project Settings` → `API`                                                          | le navigateur parle à la base, protections appliquées | `eyJ` ou `sb_publishable_` |
| **Clé `service_role`** (ou « secret ») | le **projet** : `Project Settings` → `API`                                                          | le serveur, sans aucune protection                    | `eyJ` ou `sb_secret_`      |

Le jeton personnel va dans **GitHub** uniquement, jamais dans Vercel.
Les deux clés du projet vont dans **Vercel** (étape 4) et, à partir de l'étape 6, également dans
GitHub : c'est GitHub qui créera vos comptes pour vous.

### Créer les secrets

1. Créez le jeton personnel : avatar Supabase en haut à droite → `Account Preferences` →
   `Access Tokens` → `Generate new token`. Nommez-le « GitHub Actions ».
   **Copiez-le tout de suite**, il ne s'affiche qu'une seule fois.
2. Dans votre dépôt GitHub : `Settings` → `Secrets and variables` → `Actions` →
   `New repository secret`.
3. Créez ces trois secrets, un par un :

| Nom du secret           | Valeur à coller               | Exemple de forme        |
| ----------------------- | ----------------------------- | ----------------------- |
| `SUPABASE_ACCESS_TOKEN` | le jeton personnel du point 1 | `sbp_a1b2c3...`         |
| `SUPABASE_PROJECT_REF`  | la Reference ID du projet     | `hujjyzheggsnqtjflilw`  |
| `SUPABASE_DB_PASSWORD`  | le mot de passe de la base    | ce que vous avez choisi |

> La Reference ID est aussi lisible dans l'adresse de votre projet : dans
> `https://hujjyzheggsnqtjflilw.supabase.co`, c'est la partie avant `.supabase.co`.

Si vous collez une clé `anon` ou `service_role` dans `SUPABASE_ACCESS_TOKEN`, le workflow de
l'étape 3 échouera avec un message d'authentification refusée. Recréez simplement le secret avec
le bon jeton.

---

## Étape 3 — Créer les tables

1. Dans votre dépôt GitHub, onglet **`Actions`**.
2. Dans la colonne de gauche, cliquez sur **« Base de données »**.
3. Bouton **`Run workflow`** à droite, puis **`Run workflow`** dans le petit panneau.

Décochez « Lancer les tests de sécurité » pour ce premier passage : les tests demandent une
extension que vous installerez à l'étape 5.

Comptez une à deux minutes. Une coche verte signifie que c'est fait. En cas de croix rouge,
cliquez dessus : le message d'erreur indique lequel des trois secrets pose problème.

**Vérification** : dans Supabase, `Table Editor` doit maintenant afficher 9 tables. Ouvrez
`boutiques` : vos 5 points de vente y sont. Ouvrez `public_holidays` : 24 jours fériés,
dont le 20 décembre.

> Vous pouvez relancer ce bouton autant de fois que vous voulez. Il n'applique que ce qui manque,
> ne crée jamais de doublon et n'efface aucune donnée.

---

## Étape 4 — Mettre l'application en ligne

1. Créez un compte sur <https://vercel.com> en choisissant **« Continue with GitHub »**.
2. `Add New…` → `Project`, puis importez le dépôt **oummirh**.
3. Vercel reconnaît Next.js tout seul. Ne touchez pas aux réglages de build.
4. Dépliez **`Environment Variables`** et ajoutez ces quatre lignes :

| Nom                             | Valeur                                                                 |
| ------------------------------- | ---------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | l'URL du projet Supabase                                               |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | la clé `anon`                                                          |
| `SUPABASE_SERVICE_ROLE_KEY`     | la clé `service_role`                                                  |
| `APP_URL`                       | `https://oummirh.vercel.app` (à corriger après le premier déploiement) |

5. **Important — le type de chaque variable.** Vercel propose `Secret` ou `Config` :

| Variable                        | Type à choisir | Pourquoi                                                                                                                                               |
| ------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`      | **Config**     | les variables `NEXT_PUBLIC_` doivent être lisibles pendant la construction du site ; en `Secret` elles sont invisibles et l'application tombe en panne |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Config**     | idem. Cette clé part de toute façon dans le navigateur : la marquer secrète ne protège rien                                                            |
| `SUPABASE_SERVICE_ROLE_KEY`     | **Secret**     | ne doit jamais sortir du serveur                                                                                                                       |
| `APP_URL`                       | **Config**     | simple adresse publique                                                                                                                                |

Une variable déjà enregistrée en `Secret` ne peut pas être convertie : supprimez-la et
recréez-la en `Config`.

6. Cliquez sur **`Deploy`**, puis patientez.

Vercel vous donne une adresse du type `https://oummirh.vercel.app`. Revenez dans
`Settings` → `Environment Variables` pour corriger `APP_URL` avec l'adresse réelle, puis
redéployez depuis l'onglet `Deployments`.

**Choix de la région** : dans `Settings` → `Functions`, sélectionnez la région la plus proche de
votre projet Supabase (indiquée dans `Project Settings` → `General`). L'application répondra plus
vite à La Réunion.

À partir de maintenant, **chaque modification du code redéploie l'application toute seule**, en
une minute environ.

---

## Étape 5 — Activer les tests de sécurité

Ces tests prouvent qu'une collaboratrice ne peut pas voir les données d'une autre. Ils demandent
une extension à installer une seule fois.

1. Dans Supabase, ouvrez **`SQL Editor`** → `New query`.
2. Collez ceci et cliquez sur `Run` :

   ```sql
   create extension if not exists pgtap with schema extensions;
   ```

3. Relancez le bouton de l'étape 3 en laissant « Lancer les tests de sécurité » coché.

---

## Étape 6 — Créer la direction et les collaboratrices

1. Ajoutez cinq secrets de plus dans GitHub, au même endroit qu'à l'étape 2 :

| Nom du secret                   | Valeur                                                        |
| ------------------------------- | ------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | l'URL du projet                                               |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | la clé `anon` / publishable                                   |
| `SUPABASE_SERVICE_ROLE_KEY`     | la clé `service_role` / secret                                |
| `ADMIN_EMAIL`                   | **votre** adresse email, pour vous connecter à la direction   |
| `ADMIN_PASSWORD`                | un mot de passe d'au moins 12 caractères, que vous choisissez |

2. `Actions` → `Base de données` → `Run workflow`, en cochant
   **« Créer le compte de direction et les 10 collaboratrices »**.

Vous pouvez relancer ce bouton sans risque : une collaboratrice déjà créée est laissée
telle quelle, et aucun code en service n'est modifié.

### Obtenir les codes PIN

Les codes tirés à la création sont aléatoires et **connus de personne**, pas même du
programme qui les a créés : seule leur empreinte chiffrée est enregistrée. C'est voulu, et
c'est ce qui les rend sûrs.

Pour donner son code à chacune :

1. Connectez-vous à l'espace direction, à l'adresse `/admin/connexion`, avec l'email et le
   mot de passe de l'étape 6.
2. Ouvrez `Collaboratrices`, puis la fiche de la personne.
3. Cliquez sur **« Réinitialiser le code PIN »**. Le code apparaît une seule fois.
4. Transmettez-le de vive voix, puis passez à la suivante.

Si un code est perdu plus tard, c'est exactement la même manipulation.

---

## Ce qui se passe ensuite

À chaque phase terminée, le déroulé est toujours le même :

1. Le code arrive sur GitHub.
2. Vercel redéploie l'application automatiquement.
3. Si la phase ajoute des tables, vous cliquez sur le bouton de l'étape 3.
4. Vous testez sur votre téléphone, à l'adresse Vercel.

Aucune autre manipulation n'est nécessaire.

---

## En cas de problème

**La page affiche une erreur de configuration Supabase.** Une des variables de l'étape 4 est
absente ou mal copiée. Corrigez-la dans Vercel, puis redéployez.

**Le bouton « Base de données » échoue.** Ouvrez le détail dans `Actions` : le premier message
rouge nomme le secret en cause. Un jeton Supabase expiré se recrée à l'étape 2.

**L'application est en ligne mais vide.** Normal tant que les tables ne sont pas créées :
faites l'étape 3.

**Passer en production propre.** L'adresse `*.vercel.app` convient pour tester. Pour une mise en
service réelle, on branchera votre nom de domaine et on créera un second projet Supabase réservé
aux vraies données, en Phase 11.
