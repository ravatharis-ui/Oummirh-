# Oummi RH

Application RH d'**Oummi Dressing** (La Réunion) : pointage avec selfie, plannings multi-boutiques,
congés, heures, remplacements, échanges de créneaux, documents. Espace collaboratrice sur
smartphone (PIN) et espace direction sur ordinateur.

> Ce guide est écrit pour une personne **non développeuse**. Suivez les étapes dans l'ordre.
> Pour les développeurs : voir `CLAUDE.md` (architecture, règles) et `PROMPT.md` (cahier des charges).

## 1. Installer les outils (une seule fois)

1. **Node.js 22** (ou plus récent) : <https://nodejs.org> → bouton « LTS ». Vérifiez dans un
   terminal : `node -v` doit afficher `v22…`.
2. **Git** : <https://git-scm.com/downloads>.

Docker n'est **pas** nécessaire : le projet travaille directement sur votre base Supabase hébergée.

## 2. Récupérer le projet

```bash
git clone <adresse-du-dépôt> oummi-rh
cd oummi-rh
npm install
```

## 3. Connecter votre projet Supabase

L'application a besoin de trois valeurs pour parler à votre base.

1. Ouvrez le tableau de bord Supabase, puis `Project Settings` → `API`. Notez l'URL du projet,
   la clé `anon` et la clé `service_role`.
2. Copiez le fichier modèle : `cp .env.example .env.local` (sous Windows : dupliquez le fichier
   et renommez-le `.env.local`).
3. Collez les trois valeurs dans `.env.local`.

⚠️ La clé `service_role` ignore toutes les règles de sécurité de la base. Elle reste dans
`.env.local` et dans les variables d'environnement de Vercel. Elle ne se colle jamais dans un
message, un ticket, ou un fichier suivi par Git. `.env.local` est ignoré par Git.

## 4. Créer les tables

Deux façons, au choix.

**Avec la ligne de commande** (recommandé, rejouable) :

```bash
npm run db:link     # choisissez votre projet dans la liste, puis saisissez le mot de passe de la base
npm run db:push     # applique les migrations de supabase/migrations/
npm run db:types    # régénère les types TypeScript à partir de la base réelle
```

**Depuis le navigateur**, si vous préférez éviter le terminal : ouvrez l'éditeur SQL du tableau
de bord Supabase, puis copiez-collez et exécutez, dans l'ordre, le contenu de
`supabase/migrations/0001_core_schema.sql` puis `supabase/migrations/0002_core_reference_data.sql`.

Les deux fichiers sont **rejouables sans risque** : les relancer ne crée pas de doublon et
n'écrase aucune donnée existante.

Pour vérifier : dans `Table Editor`, vous devez voir 9 tables, dont `boutiques` avec vos
5 points de vente et `public_holidays` avec 24 jours fériés.

## 5. Lancer l'application

```bash
npm run dev
```

Ouvrez <http://localhost:3000>. Pour arrêter : `Ctrl + C`.

## 6. Vérifier que tout va bien

```bash
npm run check      # formatage, règles d'architecture, types, tests unitaires
npm run test:e2e   # parcours automatisés dans un navigateur (mobile + ordinateur)
npm run test:db    # tests de sécurité (RLS) sur votre projet Supabase
```

`npm run test:db` demande l'extension pgTAP, à installer une seule fois depuis l'éditeur SQL :

```sql
create extension if not exists pgtap with schema extensions;
```

Ces contrôles tournent aussi automatiquement sur GitHub à chaque envoi de code (onglet « Actions »).

## 7. État d'avancement

| Phase | Contenu                                               | État |
| ----- | ----------------------------------------------------- | ---- |
| 0     | Fondations (projet, qualité, CI, structure modulaire) | ✅   |
| 1     | Socle base de données, registre de modules, layouts   | ⏳   |
| 2     | Authentification (PIN, admin), collaboratrices        | ⏳   |
| 3     | Événements et notifications                           | ⏳   |
| 4     | Pointage selfie                                       | ⏳   |
| 5     | Planning                                              | ⏳   |
| 6     | Congés                                                | ⏳   |
| 7     | Heures et récupération                                | ⏳   |
| 8     | Remplacements directs                                 | ⏳   |
| 9     | Échanges de créneaux                                  | ⏳   |
| 10    | Documents                                             | ⏳   |
| 11    | Finitions et mise en production                       | ⏳   |

## 8. Déploiement en production

Guide complet rédigé en Phase 11 (projet Supabase de production, Vercel, Resend, webhooks, crons).
