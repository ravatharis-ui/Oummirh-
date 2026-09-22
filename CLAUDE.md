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
npm run dev            # serveur de dev
npm run check          # lint + prettier + tsc + vitest (à lancer avant chaque commit)
npm run test:e2e       # Playwright (mobile + desktop) ; PLAYWRIGHT_CHROMIUM_PATH=... réutilise un Chromium existant
npm run db:link        # relie le dépôt au projet Supabase hébergé
npm run db:push        # applique les migrations au projet relié
npm run db:types       # régénère src/core/db/database.types.ts depuis le projet relié
npm run test:db        # tests pgTAP sur le projet relié (extension pgtap requise)
npm run db:start       # variante locale, Docker requis (db:reset, db:types:local, test:db:local)

./scripts/offline-db-check/run.sh   # rejoue migrations + suite pgTAP sur un Postgres local jetable
```

**Avant de livrer une migration ou un test SQL**, lancer `scripts/offline-db-check/run.sh`.
Il applique les migrations, vérifie que les données de référence ne se dupliquent pas au rejeu,
et exécute la suite pgTAP via un simulateur minimal — sans Docker, sans Supabase, sans l'extension
pgtap. Un fichier de test SQL jamais exécuté est un fichier de test faux : deux bugs
(`--password` refusé par `supabase test db`, CTE modifiante imbriquée) ont atteint le propriétaire
avant que ce banc d'essai existe.

Le projet est **entièrement hébergé** : Supabase pour la base, Vercel pour l'application, GitHub
Actions pour les migrations. Le propriétaire ne fait rien tourner en local. Les commandes `db:*`
utilisent `--linked` ; les variantes `:local` restent disponibles pour qui a Docker.

Côté propriétaire, tout passe par le navigateur : le workflow **« Base de données »**
(`.github/workflows/database.yml`, déclenchable depuis l'onglet Actions) relie le projet, applique
les migrations, régénère `database.types.ts` et le committe, puis lance les tests pgTAP. Voir
`docs/DEPLOIEMENT.md`.

**Conséquence pour le développement** : ne jamais demander au propriétaire d'installer Docker,
Node ou la CLI. Toute étape manuelle doit être réalisable depuis le tableau de bord Supabase,
l'onglet Actions de GitHub, ou l'interface Vercel.

## Journal des décisions d'architecture

- **Phase 0** : Next 16 / React 19 / Tailwind v4 / ESLint 9 flat config. shadcn configuré avec
  alias `@/core/ui`. `src/app/modules.ts` est le seul point d'enregistrement des modules
  (garde `core/` indépendant des modules). CSP différée en Phase 11.
- **Phase 1** :
  - `user_roles` : la clé primaire `(user_id, role, boutique_id)` de PROMPT.md est invalide en
    Postgres (une colonne de PK ne peut pas être nullable). Remplacée par
    `unique nulls not distinct`, avec un `check` : `manager` est rattaché à une boutique,
    `employee` et `admin` sont globaux.
  - **Données de référence dans une migration** (la seconde migration), pas dans
    `seed.sql` : `supabase db push` n'exécute pas `seed.sql`, et `db reset` détruirait les données
    d'un projet hébergé. Toutes les insertions sont idempotentes (`on conflict do nothing`).
  - `anon` n'a **aucun droit** sur le schéma public. Les écrans d'avant-connexion (liste des
    boutiques et des prénoms) passeront par des RPC `security definer` en Phase 2.
  - `notifications` : la seule écriture cliente autorisée est `read_at`, via un `grant update
(read_at)`. Le texte d'une notification n'est donc pas réécrivable depuis le navigateur.
  - `is_admin()` et `has_role()` sont `security definer` avec `search_path = ''` : une politique
    RLS sur `user_roles` qui interrogerait `user_roles` provoquerait une récursion infinie.
  - **Dates** : les jours sont des chaînes `AAAA-MM-JJ` (jamais des `Date`), ancrées à 12:00 UTC
    en interne. Une chaîne ne peut pas glisser d'un jour à cause d'un fuseau.
  - **Réglages non bloquants** : `getSettings()` retombe sur les valeurs par défaut si la base est
    injoignable. Les réglages pilotent l'affichage, jamais les droits (qui sont dans la RLS).
  - **Routes typées** (`typedRoutes`) : `NavItem.href` est de type `Route`, donc une entrée de menu
    pointant vers une page inexistante casse le typecheck. `npm run typecheck` lance
    `next typegen` au préalable.
  - **Passage serveur → client** : les layouts rendent l'icône et attendent le compteur avant de
    transmettre les entrées de menu aux shells clients (une référence de composant et une fonction
    ne traversent pas la frontière).
  - Le middleware de rafraîchissement de session est reporté en Phase 2, avec l'authentification.
  - **Nommage des migrations** : format horodaté `AAAAMMJJHHMMSS_<module>_...sql`, celui que
    `supabase migration new` génère, au lieu du `NNNN_` de PROMPT.md. Le préfixe numérique court
    n'est pas garanti par la CLI, et un `db push` refusé bloquerait le seul chemin de mise à jour
    de la base dont dispose le propriétaire.
  - **Zéro local** : les migrations sont appliquées par GitHub Actions, pas depuis un poste. Le
    workflow régénère aussi `database.types.ts` depuis la base réelle et le committe, puis relance
    `typecheck` : une dérive entre le code et la base casse le workflow au lieu de passer inaperçue.
  - Les secrets ne sont jamais interpolés dans un `run:` de workflow ; ils transitent par `env`.
- **Phase 2** :
  - **`pin_hash` n'est accordé à aucun rôle**, direction comprise. Seules les fonctions
    `security definer` le lisent. Conséquence pratique : **jamais de `select *` sur `employees`**,
    Postgres refuse la requête entière. Un test pgTAP verrouille ce comportement.
  - **Deux emails distincts** : `employees.email` est l'adresse réelle, facultative, pour les
    notifications ; le compte de connexion porte une adresse technique en `@staff.oummi.invalid`
    (domaine réservé RFC 2606, qui ne peut jamais recevoir de courrier).
  - **Verrouillage** : 5 échecs en 15 minutes, compteur remis à zéro par une connexion réussie.
    Les tentatives faites pendant le verrouillage ne sont pas journalisées, pour que marteler la
    porte ne prolonge pas le blocage.
  - **Session PIN** : `auth.admin.generateLink({ type: 'magiclink' })` puis `verifyOtp` côté
    serveur. Le lien n'est jamais envoyé ; seul son jeton haché sert à ouvrir la session.
  - Les écrans d'avant-connexion passent par des RPC `security definer` qui ne renvoient que des
    prénoms. `anon` n'a toujours aucun droit sur la moindre table.
  - **Les gardes ne plantent jamais** : sans configuration Supabase, `getCurrentUser()` renvoie
    `null` et la garde redirige vers la connexion, au lieu d'une erreur 500. Les réglages font
    déjà de même. Prouvé par des tests Playwright qui tournent sans base.
  - Formulaires : `employeeFormSchema` normalise les champs bruts du DOM puis les passe
    (`.pipe()`) à `employeeInputSchema`, qui porte les règles. Une seule source de messages pour
    le navigateur et pour la server action, qui revalide toujours.
  - `useWatch` et non `watch` dans les formulaires : seul le premier est compréhensible par le
    compilateur React.
  - **Les codes PIN créés par le script de seed sont jetés.** La direction tire chaque code depuis
    `/admin/collaboratrices`, où il s'affiche une fois. Un fichier de codes est une charge, pas un
    service. `WRITE_PINS_CSV=1` reste possible en local.
  - Avant toute livraison SQL : `./scripts/offline-db-check/run.sh`.
  - **Sur Vercel, les variables `NEXT_PUBLIC_` doivent être de type `Config`, jamais `Secret`.**
    Next les inline à la construction ; une variable `Secret` n'est pas lisible à ce moment-là,
    et l'application se déploie sans savoir joindre Supabase.
  - **Le middleware ne doit jamais lever d'exception** : il s'exécute avant chaque route, donc un
    throw n'est pas une page cassée mais tout le site en erreur. Son corps entier est sous
    `try/catch`, et rafraîchir un jeton reste un confort.
  - `error.tsx` et `global-error.tsx` remplacent la page d'erreur de la plateforme par un message
    en français et la référence technique, seule piste vers le journal serveur.
  - **Toute nouvelle fonction SQL naît appelable par `anon`.** Supabase applique
    `alter default privileges ... grant all on functions to anon, authenticated`, et un
    `revoke ... from public` ne défait pas une autorisation accordée nommément à un rôle.
    `verify_employee_pin` s'est retrouvée joignable sans session. La migration
    `20260922140000_core_function_grants` ferme la porte et inverse le défaut : une fonction
    est désormais privée tant qu'une migration ne l'a pas explicitement ouverte. Le test
    `0003_function_grants_test.sql` fige la liste des fonctions ouvertes à `anon`.
  - **Un test qui ne passe que sur une base vide ne prouve rien.** Les suites pgTAP s'exécutent
    sur la base réelle, qui contient de vraies personnes. Elles ne comptent donc jamais toutes
    les lignes d'une table : le cloisonnement s'affirme par l'absence (« aucune ligne qui ne
    m'appartienne »), et les fixtures vivent dans un point de vente créé pour l'occasion. Le banc
    d'essai peuple délibérément la base avant de lancer les tests, pour que cette erreur se voie
    hors ligne.
- **Phase 3** :
  - **Le contrat d'un gestionnaire a gagné un contexte** : `(event, context)`. `context.notify`
    est déjà relié au registre, donc un gestionnaire dit _quoi est arrivé et à qui_, jamais
    comment c'est formulé. Les phases suivantes enrichissent ce contexte, pas la signature.
  - **`attempts` est incrémenté à la réservation**, pas à l'échec. Un événement qui fait tomber
    le distributeur compte quand même sa tentative, sinon il tournerait en boucle indéfiniment.
  - `claim_domain_events` utilise `for update skip locked` : le webhook et la tâche planifiée
    peuvent tourner en même temps sans jamais traiter le même événement.
  - **L'email est un confort, la cloche fait foi.** Une clé Resend absente ou une panne du
    service produit un avertissement, pas un échec : faire échouer un événement métier pour un
    email non parti serait un mauvais échange.
  - Une adresse en `.invalid` n'est jamais notifiée par email (RFC 2606). Le test porte sur le
    suffixe réservé, pas sur un domaine codé en dur.
  - `notify_user` et non `notify` : `NOTIFY` est un mot-clé de Postgres.
  - **Le cache de requêtes est créé dans un état React**, jamais au niveau module : sur le serveur
    une instance partagée livrerait les données d'un visiteur au suivant.
  - `formatDistanceStrict` et non `formatDistanceToNowStrict` : la seconde lit l'horloge réelle
    et ignorerait silencieusement le `now` injecté. Un test l'a attrapée.
  - **Un module ne remonte jamais vers `app/`.** Le bouton « Traiter la file » a besoin du
    registre, que seule la couche application sait construire : l'action est donc définie dans
    `app/` et passée au composant du module en propriété. ESLint a refusé la première version.
  - Emails rangés dans `src/core/notifications/emails/` plutôt qu'à la racine comme le prévoit
    PROMPT.md §3.1 : tout reste sous `src/`, donc sous les règles d'architecture et l'alias `@/`,
    et cohérent avec les emails propres aux modules.
