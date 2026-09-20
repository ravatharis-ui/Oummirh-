# CLAUDE.md — Oummi RH

Résumé opérationnel de `PROMPT.md` (sections 2, 3, 4, 12). En cas de doute, `PROMPT.md` fait foi.
Mettre ce fichier à jour à chaque décision d'architecture.

## Contexte

Application RH de production pour **Oummi Dressing** (5 points de vente à La Réunion, fuseau
`Indian/Reunion`, UTC+4, pas d'heure d'été). Deux espaces : **Collaboratrice** (mobile, PWA,
connexion prénom + PIN 4 chiffres) et **Direction / Admin** (desktop, email + mot de passe).
Le propriétaire n'est pas développeur : il teste, il ne relit pas le code.

## Méthode de travail

- **Une phase à la fois** (PROMPT.md §9) : plan → code + tests → `npm run check` vert → commit →
  résumé (fait / comment tester à la main / décisions à valider) → **STOP**.
- Aucun secret dans le code ni dans Git (`.env.local` gitignoré, `.env.example` documenté).
- Jamais de suppression de données ni de migration existante : toute évolution = nouvelle migration.
- Ambiguïté métier → option la plus prudente, configurable si possible, listée dans « Décisions à valider ».
- Tests écrits en même temps que le code.
- **Langue** : code, variables, commentaires techniques en anglais ; UI, erreurs, emails, docs
  utilisateur en français.

## Stack (imposée, dernières versions stables — vérifier la doc officielle avant d'utiliser une API)

| Couche            | Outil                                                                                         |
| ----------------- | --------------------------------------------------------------------------------------------- |
| Framework         | Next.js 16 (App Router, Server Components, Server Actions, Route Handlers), TypeScript strict |
| UI                | Tailwind CSS v4 + shadcn/ui (composants dans `src/core/ui`) + lucide-react                    |
| Formulaires       | react-hook-form + Zod (schémas Zod = source de vérité des entrées)                            |
| Données client    | TanStack Query (cache + invalidation après Realtime)                                          |
| BDD               | Supabase Postgres, migrations SQL versionnées (Supabase CLI)                                  |
| Auth              | Supabase Auth (admin email/mdp ; collaboratrices : flux PIN custom serveur)                   |
| Fichiers          | Supabase Storage, buckets privés, URLs signées ≤ 60 s                                         |
| Temps réel        | Supabase Realtime                                                                             |
| Tâches planifiées | pg_cron + Vercel Cron (dispatcher d'événements)                                               |
| Emails            | Resend + React Email                                                                          |
| Dates             | date-fns + date-fns-tz, fuseau `Indian/Reunion` partout                                       |
| Tests             | Vitest (domain), Playwright (parcours mobile + desktop), pgTAP (`supabase test db`)           |
| Qualité           | ESLint 9 + eslint-plugin-boundaries, Prettier, `tsc --noEmit`, GitHub Actions                 |
| Types DB          | `npm run db:types` → `src/core/db/database.types.ts` (après chaque migration)                 |

**Interdits** : Firebase/Firestore, serveur Express séparé, cache JSON local, `any`, clé
`service_role` côté client, heures calculées avec l'horloge du téléphone.

> Note environnement : `ui.shadcn.com` peut être inaccessible depuis certains réseaux ; les
> composants shadcn sont alors écrits à la main dans `src/core/ui` (mêmes API que shadcn).

## Architecture modulaire

**Ajouter une fonctionnalité = ajouter un dossier** `src/modules/<key>/` et l'inscrire dans
`src/app/modules.ts` (`ALL_MODULES`). Rien d'autre ne change.

```
src/
├── app/            # routes Next : (auth), (collab), (admin), api/ ; modules.ts = liste des manifestes
├── core/           # socle partagé, n'importe JAMAIS modules/
│   ├── auth/ db/ events/ notifications/ time/ ui/ settings/
│   └── modules/    # types.ts (contrat AppModule) + registry.ts (buildRegistry)
└── modules/<key>/
    ├── index.ts    # SEULE API publique (manifeste + types publics)
    ├── manifest.ts schemas.ts types.ts
    ├── domain/     # logique métier PURE (pas de Supabase/React/Next) → Vitest
    ├── server/     # server actions, requêtes DB, handlers d'événements
    ├── ui/collab/  ui/admin/  emails/  __tests__/
    └── README.md   # rôle, tables, événements émis/écoutés, écrans
```

Règles de dépendance (appliquées par ESLint `boundaries`, `npm run lint` échoue sinon) :

- `core/` n'importe jamais `modules/`.
- Un module n'importe jamais l'intérieur d'un autre module (seulement son `index.ts`).
- `app/` importe `core/` et les `index.ts` des modules.
- `domain/` et `core/time` : aucun import Supabase, React ou Next.
- **Les modules communiquent par événements** (`emitEvent`, table `domain_events`, pattern outbox,
  handlers idempotents, ≤ 5 tentatives), jamais par appels directs.
- Les tables d'un module ne sont écrites que par ce module (lecture via vues SQL documentées).
- **Ledgers** : soldes de congés et d'heures = somme de mouvements horodatés, jamais un nombre modifiable.

Le contrat `AppModule` (clé, nom, `enabled`, `nav`, `notificationTypes`, `eventHandlers`,
`dashboardWidgets`) est dans `src/core/modules/types.ts`. Les layouts et tableaux de bord se
construisent **uniquement** depuis `buildRegistry(ALL_MODULES, { disabledKeys })`.

## Sécurité et conformité

- RLS sur **toutes** les tables, politiques explicites testées en pgTAP (employee : ses lignes ;
  manager : ses boutiques ; admin : tout).
- Écritures sensibles via RPC `security definer` qui revérifient droits et règles métier
  (jamais d'insert client direct dans `time_clocks`, `leave_ledger`, `hours_ledger`).
- Horodatage : toujours `now()` Postgres ; aucune heure acceptée du client.
- PIN : bcrypt (`pgcrypto`), jamais en clair ni journalisé ; verrouillage 5 échecs / 15 min ;
  les PIN de la V1 sont compromis et ne sont jamais réutilisés.
- Fichiers : buckets privés, URLs signées ≤ 60 s, chemins cloisonnés par `employee_id`.
- `audit_log` pour toute action admin (avant/après).
- RGPD selfies : aucune biométrie, rétention `settings.selfie_retention_days` (défaut 60),
  purge pg_cron, page confidentialité, compression client.
- Headers de sécurité dans `next.config.ts` (CSP nonce en Phase 11), cookies httpOnly/secure/lax.
- Rate limiting sur `/api/auth/pin` et RPC de pointage.

## Conventions de code

- TypeScript `strict` + `noUncheckedIndexedAccess`, aucun `any`, aucun `!` non justifié.
- Server Components par défaut ; `"use client"` uniquement si nécessaire.
- Server action : `requireX()` → validation Zod → RPC/requête → `revalidatePath` →
  `{ ok: true, data } | { ok: false, error: string }` (erreur en français compréhensible).
- Pas de logique métier dans les composants React : elle vit dans `domain/`.
- Fichiers `kebab-case`, composants `PascalCase`.
- Migrations : jamais modifiées après commit, préfixées `NNNN_<module>_...sql`, types régénérés.
- Commits conventionnels : `feat(pointage): ...`, `fix(conges): ...`, `chore: ...`.
- Formats : dates `fr-FR`, heures 24 h (`09:30`), durées `7 h 30`, fuseau `Indian/Reunion`.
- Mobile : cibles ≥ 48 px, texte ≥ 16 px, contraste AA ; chaque écran gère chargement/vide/erreur.

## Commandes

```
npm run dev          # serveur de dev
npm run check        # lint + prettier + tsc + vitest (à lancer avant chaque commit)
npm run test:e2e     # Playwright (mobile + desktop) ; PLAYWRIGHT_CHROMIUM_PATH=... pour réutiliser un Chromium existant
npm run db:start     # Supabase local (Docker requis)
npm run db:reset     # rejoue migrations + seed.sql
npm run db:types     # régénère src/core/db/database.types.ts
npm run test:db      # tests pgTAP
```

## Journal des décisions d'architecture

- **Phase 0** : Next 16 / React 19 / Tailwind v4 / ESLint 9 flat config. shadcn configuré avec
  alias `@/core/ui`. `src/app/modules.ts` est le seul point d'enregistrement des modules
  (garde `core/` indépendant des modules). CSP différée en Phase 11.
