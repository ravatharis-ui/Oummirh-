# Oummi RH

Application RH d'**Oummi Dressing** (La Réunion) : pointage avec selfie, plannings multi-boutiques,
congés, heures, remplacements, échanges de créneaux, documents. Espace collaboratrice sur
smartphone (PIN) et espace direction sur ordinateur.

> Ce guide est écrit pour une personne **non développeuse**. Suivez les étapes dans l'ordre.
> Pour les développeurs : voir `CLAUDE.md` (architecture, règles) et `PROMPT.md` (cahier des charges).

## 1. Installer les outils (une seule fois)

1. **Node.js 22** (ou plus récent) : <https://nodejs.org> → bouton « LTS ». Vérifiez dans un
   terminal : `node -v` doit afficher `v22…`.
2. **Docker Desktop** (nécessaire pour la base de données locale Supabase) :
   <https://www.docker.com/products/docker-desktop/>. Lancez-le et attendez « Docker is running ».
3. **Git** : <https://git-scm.com/downloads>.

## 2. Récupérer le projet

```bash
git clone <adresse-du-dépôt> oummi-rh
cd oummi-rh
npm install
```

## 3. Configurer les variables d'environnement

1. Copiez le fichier modèle : `cp .env.example .env.local` (sous Windows : copiez-collez le
   fichier et renommez-le `.env.local`).
2. Démarrez la base locale : `npm run db:start` (la première fois, Docker télécharge des images,
   comptez quelques minutes). À la fin, la commande affiche `API URL`, `anon key` et
   `service_role key`.
3. Ouvrez `.env.local` et collez ces valeurs dans `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY`.
4. Les autres variables (Resend, secrets, admin) seront expliquées à la phase où elles servent.

⚠️ `.env.local` contient des secrets : il n'est **jamais** envoyé sur Git (il est ignoré).

## 4. Lancer l'application

```bash
npm run dev
```

Ouvrez <http://localhost:3000> : la page d'accueil « Oummi RH » s'affiche.

Pour arrêter : `Ctrl + C` dans le terminal, puis `npm run db:stop` pour arrêter la base.

## 5. Vérifier que tout va bien (contrôle qualité)

```bash
npm run check      # lint, formatage, types, tests unitaires
npm run test:e2e   # parcours automatisés dans un navigateur (mobile + ordinateur)
```

Ces mêmes contrôles tournent automatiquement sur GitHub à chaque envoi de code (onglet « Actions »).

## 6. État d'avancement

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

## 7. Déploiement en production

Guide complet rédigé en Phase 11 (projet Supabase de production, Vercel, Resend, webhooks, crons).
