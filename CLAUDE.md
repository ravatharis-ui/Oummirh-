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

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

- **Phases 4 et 5** (planning puis pointage — l'ordre compte : le planning fournit les heures
  attendues que le pointage compare) :
  - **`reunion_today()`** : toute règle métier qui dépend d'« aujourd'hui » passe par cette
    fonction SQL. Ni l'horloge du téléphone, ni celle du serveur d'application.
  - **`planning_entries.source`** dit qui a posé la ligne. `leave`, `replacement` et `swap` sont
    **protégées** : une duplication de semaine et une semaine type ne les copient ni ne les
    écrasent. `planning_protected_sources()` est la liste, en un seul endroit.
  - **Un seul événement `planning.entry_changed`**, avec un tableau `dates`. Sept journées
    modifiées font une notification, pas sept. Et **rien n'est annoncé pour une date passée** :
    corriger le planning d'avant-hier n'a personne à prévenir.
  - **Une saisie manuelle de la direction écrase tout, congé compris.** Le contraire ferait du
    module congés l'arbitre du planning. La saisie détache alors la journée de sa demande
    d'origine, et l'interface le dit avant de laisser cliquer.
  - **`my_boutique_presence(date)`** ne renvoie que les collègues **présentes**. Le motif d'une
    absence — maladie surtout — ne regarde pas les collègues, et la fonction est écrite pour
    qu'il soit impossible de le déduire par soustraction.
  - **`time_clocks` n'a aucune politique d'insert, d'update ni de delete, pour personne.** Tout
    passe par `clock_event` ou `admin_correct_time_clock`. Une correction est une **nouvelle
    ligne** ; l'originale n'est jamais réécrite. `effective_time_clocks` montre le dernier mot
    (`distinct on … order by created_at desc`), la table garde toute la conversation.
  - **Un selfie ne sert qu'une fois** : index unique partiel `time_clocks_photo_once`, en plus
    de la vérification dans la fonction. Un index, et pas seulement un `if exists`, parce que
    deux appels simultanés passeraient la vérification ensemble.
  - **Journée de travail et non journée calendaire** : `local_date` reste celle qui s'est
    ouverte, pour qu'un départ pointé après minuit ne bascule pas au lendemain. Mais une
    journée laissée ouverte plus de vingt-quatre heures n'absorbe pas l'arrivée du surlendemain.
  - **`pointage_run_checks(p_at)`** accepte un instant. Ce n'est pas une heure venue d'un client
    — la fonction n'est appelable que par `service_role` — mais sans lui, un test des alertes ne
    passerait qu'entre 7 h et 20 h, heure de La Réunion.
  - **`pointage_alerts`** (clé primaire `(employee_id, local_date, kind)`) est ce qui fait qu'une
    tâche qui tourne toutes les dix minutes n'alerte qu'une fois. Les alertes vont à la
    direction, jamais à la collaboratrice : dire à quelqu'un qu'il est en retard est une
    conversation, pas une notification.
  - **La purge des selfies est en deux temps** : Postgres ne sait pas supprimer un fichier du
    stockage. `selfies_to_purge()` dit quoi supprimer, la route cron appelle l'API Storage, puis
    `mark_selfies_purged()` oublie les chemins. Interrompue au milieu, la passe suivante reprend
    le même travail. Le pointage, lui, n'est jamais supprimé.
  - **Le bucket `selfies` et ses politiques sont créés dans un bloc `exception when
insufficient_privilege`.** Sur un projet hébergé, `storage.objects` n'appartient pas toujours
    au rôle qui applique les migrations, et un refus ferait échouer `db push` en entier — donc le
    seul chemin de mise à jour de la base dont dispose le propriétaire.
  - **Pas de pointage différé hors réseau.** L'écran le dit et invite à prévenir la direction.
    Mettre un pointage en file d'attente reviendrait à accepter une heure du client.
  - **La photo vient de `getUserMedia`, jamais d'un `<input type="file">`**, qui ouvrirait la
    galerie. Réduite à 720 px et compressée à 0,7 dans le navigateur, avant tout envoi.
  - **Les filtres et la navigation de semaine passent par des formulaires GET et des `UrlObject`**
    plutôt que par des chaînes : `typedRoutes` vérifie le chemin, et le filtre fonctionne même si
    le JavaScript ne charge jamais.
  - Le banc d'essai hors ligne émule désormais `storage.buckets`, `storage.objects` et
    `storage.foldername()` : une migration qui touche au stockage doit être vérifiable sans
    Supabase.
  - **Trois découvertes faites par les tests sur le projet réel, après la Phase 5.** Elles
    confirment que seule l'exécution sur le vrai projet trouve ce genre de chose :
    - **La plateforme réaccorde des droits à `anon`, rétroactivement.** Après la création des
      tables du planning et du pointage, `anon` avait des droits sur **les quatorze tables** du
      schéma public — les dix d'origine comprises, dont les révocations dataient de la Phase 1.
      La RLS tenait toujours, mais le principe « deux barrières » était tombé à une. Réponse :
      `revoke_anon_table_privileges()`, appelée maintenant, plus
      `alter default privileges ... revoke all on tables from anon` pour que les futures tables
      naissent fermées. Le pendant de ce qu'avait fait `core_function_grants` pour les fonctions.
    - **`public.rls_auto_enable`**, fonction de la plateforme que nous n'avons pas écrite, est
      apparue appelable par `anon`. Révoquée dans un bloc défensif : elle ne nous appartient pas
      forcément, et un refus de privilège ne doit jamais faire échouer `db push`.
    - **`storage.protect_delete`** : Supabase refuse tout `delete` SQL sur `storage.objects`
      (« Use the Storage API instead »), et il a raison — effacer la ligne sans effacer le
      fichier laisserait un octet que plus rien ne référence, donc que plus rien ne pourrait
      supprimer. `mark_selfies_purged` ne fait plus qu'oublier le chemin ; le fichier part par
      l'API Storage, depuis la route cron. Le banc d'essai émule maintenant ce trigger.
  - **Une émulation qui lève un autre code d'erreur est pire que pas d'émulation.**
    Le simulateur de `storage.protect_delete` levait `P0001` là où Supabase lève `42501` :
    le test passait hors ligne et échouait sur le projet. Les deux disent désormais `42501`.
  - **Un test qui échoue doit nommer le coupable.** « Attendu 0, obtenu 14 » a coûté un
    aller-retour avec le propriétaire. Les assertions de cloisonnement utilisent désormais
    `set_eq` contre un ensemble vide, qui liste les tables ou les fonctions fautives.

- **Phases 6 et 7** (congés puis heures — les deux sont des ledgers, et les deux ajustent le
  planning par le même mécanisme) :
  - **Un solde n'est jamais un nombre stocké.** `leave_ledger` et `hours_ledger` ne contiennent
    que des mouvements horodatés ; le solde est leur somme. Corriger un solde, c'est **ajouter**
    une ligne qui dit pourquoi. Aucune des deux tables n'a la moindre politique d'écriture RLS,
    pour personne : tout passe par des fonctions `security definer`.
  - **Le décompte des congés est recalculé à la validation**, pas seulement à la demande. Entre
    les deux, le planning a pu changer et un jour férié a pu être ajouté ; c'est le jour de la
    décision qui fait foi.
  - **Le décompte existe deux fois, volontairement** : `count_leave_days()` en SQL fait autorité,
    `domain/count.ts` alimente l'aperçu affiché pendant qu'elle choisit ses dates. Les deux
    suivent la même règle et sont éprouvés sur les mêmes cas (26 tests Vitest, 41 assertions
    pgTAP). Le seul moyen d'éviter la duplication aurait été un aller-retour serveur à chaque
    clic de calendrier.
  - **Ne comptent pas** : les jours hors semaine de travail (samedi selon le mode), les fériés de
    La Réunion — dont le 20 décembre —, et les journées déjà planifiées en `rest` ou `school`.
    Poser un congé sur son jour de repos ne coûte rien.
  - **Règle d'acquisition** : `ouvrables` par défaut (2,5 j/mois, 30 j/an). Le mode `ouvres`
    (2,08 j/mois, 25 j/an) existe et se change dans les réglages. La V1 annonçait « 25 jours à
    2,5 j/mois », ce qui est arithmétiquement impossible.
  - **Les tâches planifiées sont idempotentes par index unique**, pas par calendrier : acquisition
    (`employee_id, occurred_on`), report et expiration (`employee_id, period_start`), écart
    quotidien (`employee_id, local_date`). Les routes cron tournent donc **tous les jours** plutôt
    qu'une fois par mois — une journée où la plateforme hoquette ne fait perdre les congés de
    personne, et le lendemain rattrape.
  - **Une journée sans départ pointé n'écrit aucun écart d'heures.** Ce n'est pas une journée à
    zéro heure, c'est une journée dont on ne sait rien. Écrire « −7 h » ferait porter à la
    collaboratrice le prix d'un téléphone déchargé, et la direction a déjà une alerte pour ça.
  - **Le plafond d'une récupération est le solde moins les demandes en attente.** Sans cette
    soustraction, trois demandes de deux heures passeraient toutes les trois avec un solde de
    deux heures.
  - **`apply_planning_recovery` repart de l'horaire d'origine**, jamais de l'horaire courant :
    rejouer l'événement ne décale pas la journée deux fois. Ce qui est stocké n'est pas « moins
    une heure » mais « commence à 10 h ».
  - **`recovery` est devenue une quatrième source protégée** du planning. Sans cela, une
    duplication de semaine effacerait une récupération accordée, et la collaboratrice serait
    attendue à 9 h un jour où la direction lui a dit d'arriver à 11 h.
  - **Le module heures n'écrit jamais dans `planning_entries`**, et le module congés non plus.
    Tous deux annoncent leur décision ; le planning en tire les conséquences. C'est la règle
    d'architecture, et c'est aussi ce qui permet de désactiver un module sans casser l'autre.
  - **`now()` est l'heure de début de transaction.** Une originale et sa correction écrites dans
    la même transaction portent le même `created_at`, et `effective_time_clocks` tranchait alors
    au hasard — une migration sans rapport a suffi à retourner l'assertion. La vue dit désormais
    explicitement qu'**une correction l'emporte toujours sur une originale**, ce que le mot
    « correction » voulait dire depuis le début.
  - **`set local` survit à `reset role`.** Dans un test pgTAP, revenir au rôle superutilisateur ne
    remet pas les claims JWT : les assertions « côté serveur » héritaient de la session de la
    collaboratrice testée juste avant. Les suites remettent maintenant `request.jwt.claims` à vide
    en même temps que le rôle.
  - **Un garde de lecture doit laisser passer le serveur.** `leave_balance` et `hours_balance`
    refusent le solde d'autrui à une _session_ ; sans session (`auth.uid()` nul), l'appelant est
    la tâche planifiée ou un test, et la question ne se pose pas.
  - **L'export CSV est en point-virgule, décimales à la virgule, avec un BOM.** C'est ce qu'Excel
    en français attend : un fichier qui s'ouvre en une seule colonne, ou qui affiche « AurÃ©lie »,
    n'est pas un export.

- **Paramétrage par la direction** (intercalé après la Phase 7, à la demande du propriétaire :
  « tant que ça reste modifiable depuis l'espace admin ») :
  - **Les quatre tables de référence ne sont plus écrites depuis le navigateur.** `settings`,
    `boutiques`, `contract_types` et `public_holidays` avaient une politique RLS qui autorisait
    la direction à écrire en direct. La politique reste — elle documente l'intention — mais le
    `grant` est retiré : PostgreSQL refuse désormais la requête avant même de la regarder. Tout
    passe par des fonctions `security definer` qui journalisent l'avant et l'après. Sans ça,
    personne ne saurait six mois plus tard qui a changé la règle d'acquisition, ni quelle était
    la valeur précédente.
  - **Le registre des réglages** (`src/core/settings/registry.ts`) est la pièce qui rend l'écran
    durable. Chaque réglage y est décrit une fois — libellé, aide, groupe, forme du champ,
    conséquence du changement — et `/admin/parametres` se construit à partir de cette liste.
    Ajouter un réglage plus tard = **une entrée + une migration** qui pose sa valeur par défaut.
    Aucune page à retoucher, aucun composant à écrire.
  - **`admin_set_setting` refuse une clé qui n'existe pas déjà.** Créer un réglage est une
    décision de code — il faut bien que quelque chose le lise — donc une migration. La fonction
    ne sert qu'à changer une valeur, et une faute de frappe ne peut pas créer un réglage fantôme
    que plus rien ne lit.
  - **Chaque réglage s'enregistre seul**, pas à travers un bouton « Tout enregistrer ». Plus de
    clics, beaucoup moins d'accidents : on change la tolérance de retard sans toucher, sans le
    vouloir, à la durée de conservation des photos.
  - **Le mode de congés porte son nombre de jours.** Le formulaire ne propose pas les deux
    séparément : `ouvrables` impose 2,5 j/mois, `ouvres` impose 2,08. Laisser quelqu'un saisir
    « ouvrés, 2,5 j/mois » serait lui laisser recréer l'incohérence de la V1.
  - **Un point de vente ne se supprime pas, il se ferme.** Des plannings et des pointages le
    référencent. La fermeture est refusée tant que des collaboratrices actives y sont rattachées,
    et le dernier point de vente actif ne peut pas être fermé.
  - **Les jours fériés se tiennent à jour depuis l'écran.** Pâques et l'Ascension bougent chaque
    année ; sans ça, il faudrait un développeur chaque mois de janvier pour que le décompte des
    congés tombe juste. Retirer un férié change les congés **à venir** ; un congé déjà validé
    garde le décompte arrêté le jour de la décision, parce que sa ligne de ledger est écrite.
  - **`AppModule` gagne `description` et `required`.** Un gérant sur le point d'éteindre un module
    a le droit de savoir ce qu'il fait ; et un module dont l'application ne peut pas se passer
    n'est pas proposé à l'extinction. Éteindre conserve les données : elles reviennent intactes.
  - **Un test Vitest fait l'aller-retour formulaire pour chaque réglage du registre.** La valeur
    par défaut part vers le formulaire, revient, et doit être acceptée — ce qui garantit qu'un
    gérant peut rouvrir un écran et réenregistrer sans rien casser. Un réglage ajouté plus tard
    sans traduction correcte fera échouer ce test avant d'atteindre l'écran.

- **Phases 8 et 9** (remplacements directs puis échanges de créneaux) :
  - **`planning_snapshots` : avant d'écraser une journée, on garde ce qu'elle contenait.**
    Un manque révélé par la Phase 8, qui frappait déjà la Phase 6 sans qu'on l'ait vu : annuler
    un congé effaçait la ligne de congé et laissait un **trou** là où il y avait une journée de
    travail. Deux subtilités décident de tout : le cliché est pris `on conflict do nothing` —
    rejouer un événement ne doit pas remplacer le cliché d'origine par la ligne déjà appliquée —
    et on ne restaure **que si la journée appartient encore** à la demande qui l'avait posée. Une
    saisie manuelle de la direction depuis est une décision plus récente, et on ne défait pas une
    décision plus récente.
  - **La liste des candidates n'est pas filtrée, elle est qualifiée.** « Déjà ailleurs ce jour-là »
    n'est pas un refus — c'est parfois exactement la personne à déplacer, et l'écran prévient que
    l'autre point de vente se retrouvera sans elle. Seul un congé, une maladie ou un jour d'école
    bloque, parce qu'il faudrait d'abord revenir sur cette décision.
  - **La double validation va dans cet ordre : la collègue, puis la direction.** Demander à la
    direction d'arbitrer un échange que l'intéressée refusera est une perte de temps pour tout le
    monde. Et **un échange validé ne s'annule plus** : les deux plannings ont changé, deux
    personnes ont organisé leur semaine autour.
  - **`swappable_days()` ne renvoie que l'échangeable** — travail, remplacement, repos. Un congé,
    un arrêt maladie ou un jour d'école n'y figurent pas, et sont donc indistinguables d'une
    journée sans planning. Même règle que `my_boutique_presence` : on dit qui est là, jamais
    pourquoi quelqu'un ne l'est pas.
  - **Un échange échange, il ne pose pas.** `apply_planning_swap` fait changer les deux lignes de
    propriétaire ; les journées libérées deviennent du repos, sauf quand les deux dates sont la
    même — deux personnes qui permutent leurs horaires d'une journée n'ont rien à libérer. La
    marque `swap` sur les lignes rend l'opération idempotente, et `swap` est une source protégée.
  - **Le banc d'essai rejouait les migrations sur la base de test, et c'était faux.** Un fichier
    qui s'arrête sur « relation existe déjà » n'exécute pas ce qui suit : une fonction redéfinie
    par une migration plus récente se retrouvait **rétablie dans sa version d'avant**, et les tests
    éprouvaient un état que le projet réel n'aura jamais. Un test a échoué sur exactement ça. Le
    rejeu se fait désormais sur une base à part ; la base de test ne connaît qu'une seule passe,
    dans l'ordre.
  - **Le critère d'acceptation Playwright de la Phase 9 (parcours à trois acteurs) est couvert par
    la suite pgTAP `0011`**, qui joue les trois sessions — demandeuse, collègue, direction — à la
    couche où vivent les règles. Playwright tourne ici sans base de données ; un vrai parcours à
    trois exigerait un projet de test et des sessions préparées, ce qui relève de la Phase 11.

- **Demi-journées de congé sur le planning** (correction d'un écart signalé en Phase 6) :
  - Le décompte savait compter 0,5 jour ; le planning affichait « Congé » sur la journée entière.
    Le solde était juste et l'écran mentait — la direction ne voyait pas qu'il restait une
    matinée à couvrir. `apply_planning_leave` **raccourcit** la journée de bord au lieu de la
    remplacer, et le milieu de journée est pris sur `settings.default_schedule.break_start` :
    le gérant le déplace depuis l'écran des paramètres, sans toucher au code.
  - Une demi-journée ne se dessine que s'il y avait une journée de travail à raccourcir. Sinon
    « Congé » reste la description la plus honnête.
  - Sur une journée unique, `start_half` tranche : « je pars l'après-midi » veut dire qu'elle
    travaille le matin.
- **Phase 10** (coffre-fort numérique) :
  - **Trois barrières, pas une.** Le critère d'acceptation — « même en devinant le chemin » —
    demande mieux qu'une vérification applicative : RLS sur la table (deviner un identifiant ne
    fait rien apparaître), politique de stockage sur le chemin (`<son id>/…`), et URL signée à
    soixante secondes, demandée au clic et jamais stockée. Il n'existe aucun lien à recopier.
  - **Le PDF ne passe pas par le serveur d'application.** Il va du navigateur de la direction
    directement au bucket : dix mégaoctets n'ont rien à faire dans la mémoire d'une server action,
    et la politique du bucket réserve déjà l'écriture à la direction. Seule la ligne passe par le
    serveur, et `prepareDocumentPath` construit le chemin côté serveur — la fonction SQL le
    revérifie ensuite.
  - **Un envoi réussi dont l'enregistrement échoue est rattrapé** : le fichier est retiré, sinon
    le stockage garderait un orphelin que plus rien ne référence — donc que plus rien ne pourrait
    supprimer.
  - **La reconnaissance par nom de fichier est délibérément timide.** Deux homonymes sans prénom,
    un nom noyé dans un mot (« PAYETTE » n'est pas « PAYET »), un nom trop court : elle ne propose
    rien et laisse associer à la main. Attribuer la fiche de paie de quelqu'un à une autre
    personne est l'erreur la plus grave que ce module puisse commettre, et l'envoi reste bloqué
    tant qu'un fichier n'est pas associé.
  - **`first_viewed_at` est écrit par la base**, jamais par le navigateur : une collaboratrice ne
    peut ni prétendre n'avoir rien vu, ni marquer ce qu'elle n'a pas ouvert. Et seule la première
    ouverture est retenue — combien de fois elle relit son bulletin ne regarde personne.

- **Phase 11** (finitions et mise en production) :
  - **`src/middleware.ts` est devenu `src/proxy.ts`.** Next 16 a renommé la convention, et
    l'ancien nom imprimait un avertissement de dépréciation à chaque build. Même comportement,
    même position dans la requête, un nom d'export différent.
  - **La CSP est construite dans une fonction pure** (`src/core/security/csp.ts`), pas dans le
    proxy. C'est la seule pièce de l'application qui peut casser **toutes** les pages à la fois :
    elle mérite d'être testable sans navigateur, et elle l'est (9 tests Vitest).
  - **`style-src` garde `'unsafe-inline'` sans nonce, délibérément.** Avec un nonce, les
    navigateurs ignorent `'unsafe-inline'` — y compris pour les attributs `style=""` que React et
    plusieurs composants posent en permanence. Une feuille de style injectée n'exécute pas de
    code : échanger une protection marginale contre un risque d'écran blanc serait un mauvais
    marché. Le nonce et `'strict-dynamic'` protègent là où ça compte, sur `script-src`.
  - **`CSP_REPORT_ONLY=1` est la sortie de secours du propriétaire.** Une politique trop stricte
    serait un site mort sans personne pour le réparer depuis un navigateur. Une variable dans
    Vercel, un redéploiement, et l'application refonctionne pendant qu'on regarde.
  - **Quatre tests Playwright prouvent que la CSP ne bloque rien** : en-tête présent, nonce
    différent à chaque visite, aucune violation en console, et une navigation client qui
    fonctionne — parce qu'une page rendue sans scripts s'affiche très bien et ne répond à rien.
  - **Un vrai manquement d'accessibilité trouvé et corrigé.** Le texte blanc des boutons
    principaux était à 3,75:1 sur la terracotta d'origine, sous le 4,5:1 de WCAG AA. `axe-core`
    l'a mesuré ; la couleur d'accent est passée de `oklch(0.62 …)` à `oklch(0.55 …)`, soit
    5,05:1. Un seul jeton changé, toute l'application avec. C'est exactement ce que la note en
    tête de `globals.css` promettait.
  - **L'audit RLS (`0013`) est écrit par énumération, pas par liste.** Une table ajoutée demain
    sans protection fera échouer ce fichier sans que personne ait à y penser : c'est ce qu'on
    attend d'un audit, qu'il continue à travailler après le départ de son auteur.
  - **L'audit a trouvé une porte restée ouverte** : `planning_entries` et `planning_templates`
    étaient encore écrites directement depuis le navigateur. Pas une faille — la RLS tenait —
    mais une écriture directe contourne le journal d'audit, l'annonce à la collaboratrice et la
    protection des journées posées par un congé. Autrement dit, tout ce qui fait qu'un planning
    est autre chose qu'un tableau.
  - **Une capacité sans porte d'entrée n'est pas une fonctionnalité.** `admin_apply_planning_
template` savait appliquer une semaine type que rien ne savait créer. La fermeture des
    écritures directes a rendu le manque visible ; `admin_set_planning_template` et l'écran qui
    s'ouvre en cliquant un prénom dans la matrice le comblent.
  - **La page de confidentialité est hors de tout espace protégé**, et lisible avant connexion :
    on ne peut pas demander d'accepter quelque chose qu'on n'a pas pu lire. Les durées affichées
    sont lues dans les réglages, donc elles suivent ce que la direction a vraiment configuré.
  - **Pas de service worker, volontairement.** La PWA sert à installer l'application sur un écran
    d'accueil, pas à fonctionner hors ligne : un pointage mis en file d'attente reviendrait à
    accepter une heure venue du téléphone. À noter pour le jour où les notifications push en
    imposeront un — il ne devra rien mettre en cache qui ressemble à un pointage.
  - **Toute l'application est rendue à la requête** (`dynamic = "force-dynamic"` sur la mise en
    page racine). Ce n'est pas un réglage de performance : Next pose le nonce pendant le rendu
    serveur, à partir de l'en-tête de la requête. Une page fabriquée à la construction n'a pas de
    requête, donc pas de nonce, et ses scripts sont bloqués par la politique que le proxy pose
    quand même. L'accueil, la connexion et la confidentialité étaient statiques : en production,
    elles s'affichaient et ne répondaient à rien. Personne ne pouvait se connecter.
  - **La CI construit et sert l'application ; `npm run test:e2e` la sert en mode développement.**
    Les deux ne prouvent pas la même chose, et c'est ce trou qui a laissé passer le défaut
    ci-dessus : les 74 tests passaient ici et échouaient sur GitHub. `npm run test:e2e:prod`
    reproduit les conditions de la CI et **c'est lui qui fait foi avant une livraison**. Troisième
    occurrence de la même règle : un test qui ne s'exécute pas dans les conditions réelles ne
    prouve rien.
  - **`docs/EVOLUTIONS.md` répond à PROMPT.md §10.** Deux points de friction réels : le rôle
    `manager` (une migration par module, purement additive, à faire avant que les politiques RLS
    grossissent encore) et le multi-entreprises (à traiter par un projet Supabase par marque,
    pas par une colonne `company_id` partout).
  - **Le parcours Playwright à trois acteurs reste couvert par pgTAP `0011`.** Un vrai parcours
    navigateur demanderait un projet de test et des sessions préparées ; écrire un test qui ne
    peut pas s'exécuter contredirait la règle que ce projet s'est donnée après deux incidents —
    un fichier de test jamais exécuté est un fichier de test faux.

- **Santé des tâches planifiées** (après l'audit d'avant mise en production) :
  - **Cinq tâches tournent sans que personne clique, et rien ne disait qu'une s'était arrêtée.**
    On l'aurait découvert en mars, en constatant que personne n'acquiert de congés depuis
    janvier ; ou en trouvant une photo de décembre que la page de confidentialité promettait
    effacée. `job_runs` porte le dernier passage de chaque tâche, et le tableau de bord le lit.
  - **Une ligne par tâche, jamais un journal.** Le distributeur d'événements passe toutes les
    minutes : garder son histoire ferait cinquante mille lignes par mois pour répondre à une
    question qui ne porte que sur le dernier passage. `last_ok_at` est tenu à part de
    `last_run_at` exprès — un échec ne doit pas effacer la trace du dernier succès, qui est ce
    qui dit **depuis quand** ça dure.
  - **L'enregistrement est dans l'enveloppe, pas dans chaque route.** `scheduledRoute()` porte
    l'authentification, l'exécution et l'enregistrement. Une tâche dont l'auteur oublierait de
    signaler son passage s'afficherait comme en panne, et un écran de santé qui crie au loup est
    pire que pas d'écran de santé : ici, c'est impossible à oublier. Au passage, les cinq routes
    cron ne dupliquent plus la comparaison de secret en temps constant.
  - **Un appel non autorisé n'enregistre rien.** Quelqu'un qui frappe à la porte n'est pas un
    passage, et le compter en échec laisserait n'importe qui peindre le voyant en rouge.
  - **`jamais lancée` n'est pas `en panne`.** Sur une installation neuve c'est normal pendant
    quelques heures, et un voyant rouge injustifié apprend à ne plus regarder les voyants. De
    même, les tâches de nuit tolèrent **36 heures** : une nuit sautée est rattrapée par la
    suivante — c'est écrit ainsi —, deux ne le sont pas.
  - **Le simulateur pgTAP hors ligne a gagné `isnt`**, avec exactement la sémantique de pgTAP
    (`is distinct from`, donc deux `null` sont égaux et l'assertion échoue). Écrire l'assertion
    avec `ok(... is not null)` aurait été plus court et aurait laissé le banc d'essai en retard
    sur le projet réel — la leçon de `storage.protect_delete`.

- **Détail du compteur d'heures** (question du propriétaire : « est-ce qu'il y a un décompte par
  personne qui montre les heures faites en plus et en moins ? ») :
  - **Le calcul existait depuis la Phase 7 ; personne ne pouvait le lire.** Les deux écrans
    n'affichaient que des totaux — un solde chez la collaboratrice, un tableau mensuel chez la
    direction. `getMyHoursState` chargeait déjà les mouvements jour par jour et l'écran ne les
    rendait jamais. Même oubli que les selfies enregistrés que rien n'ouvrait : une donnée qu'on
    calcule sans jamais la montrer n'est pas une fonctionnalité.
  - **`plannedMinutes` est déduit, pas relu** : l'écart d'une journée **est** réel − prévu, donc
    prévu = réel − écart. Une seconde lecture du planning pourrait diverger de ce que le ledger a
    figé — le planning a pu changer depuis, et c'est le jour du calcul qui fait foi.
  - **Le même composant des deux côtés.** Quand la direction et la collaboratrice regardent le
    même chiffre, la conversation porte sur la journée en cause et non sur l'écran qui aurait
    tort.
  - **Une journée dit ce qui était prévu et ce qui a été fait**, pas seulement l'écart :
    « −15 min » sans « prévu 7 h, réel 6 h 45 » n'est pas vérifiable, et un compteur qu'on ne
    peut pas recompter soi-même est un compteur qu'il faut croire sur parole.
  - **Une récupération ou un ajustement n'affiche ni prévu ni réel.** Ce ne sont pas des
    journées ; écrire « prévu 0 h » laisserait croire qu'elle n'était pas attendue ce jour-là.
  - **L'écart porte sur la journée entière**, donc arriver un quart d'heure en retard puis partir
    un quart d'heure plus tard fait zéro. La ponctualité se lit ailleurs — l'écart d'arrivée, dans
    Pointage → Historique. Deux questions différentes, deux écrans.
  - **Quatrième porte rouverte par la plateforme**, trouvée par l'audit `0013` sur le projet
    réel : `authenticated` avait insert, update et delete sur `effective_time_clocks` et
    `daily_worked_time`. Nos migrations ne leur accordaient que `select` — mais
    `alter default privileges ... grant all on tables` s'applique aussi aux **vues**, que
    PostgreSQL range parmi les tables. Réponse : `revoke_view_write_privileges()`, à rappeler en
    fin de toute migration créant une vue.
  - **Le banc d'essai hors ligne n'accordait les droits par défaut que sur les fonctions.** Il le
    fait désormais aussi sur les tables, et il reproduit l'échec avant la correction : **un banc
    d'essai moins permissif que la plateforme valide des migrations qui ne referment rien.**
  - **« Le dernier pointage » doit être une question qui a une seule réponse.**
    Cinq assertions du pointage se sont retournées sur le projet réel après une migration qui ne
    touchait qu'aux droits des vues. Cause : `now()` est l'heure de début de transaction, donc
    plusieurs pointages écrits dans la même transaction portent le **même** `occurred_at`, et
    `order by occurred_at desc limit 1` en rend un **au hasard**. `clock_event` a laissé pointer
    un départ alors qu'une pause était ouverte.
    C'est le défaut déjà corrigé en Phase 7 — sur la vue `effective_time_clocks`, pas dans la
    fonction, où la même ambiguïté est restée. La colonne `time_clocks.seq` départage désormais
    ce que l'horloge ne peut pas départager ; `occurred_at` reste la clé de tri principale.
    En service réel chaque pointage est sa propre transaction, donc personne n'a jamais été gêné
    — mais une règle métier dont le résultat dépend du plan choisi par Postgres n'est pas une
    règle, et une suite de tests qui se retourne toute seule ne prouve plus rien.
  - **Une assertion ajoutée après coup doit échouer sans le correctif**, sinon elle ne prouve
    rien. Les trois nouvelles assertions de `0006` ont été vérifiées en désactivant la colonne
    `seq` : le fichier s'arrête sur « column "seq" does not exist ». Le corollaire de la règle du
    fichier de test jamais exécuté.
  - **Une vue recréée renaît écrivable.** Toute migration qui touche à une vue se termine par
    `select public.revoke_view_write_privileges();` — la plateforme réapplique ses droits par
    défaut à chaque `create or replace view`.

- **Le guetteur des tâches planifiées** (suite de la carte : « préviens-moi sans que j'aie à
  regarder ») :
  - **Le guetteur n'a pas sa propre tâche planifiée, et c'est le cœur de l'affaire.** Une tâche
    chargée de surveiller les tâches serait sujette au silence même qu'elle doit détecter, et
    rien ne la surveillerait. `checkJobsAndAlert()` s'exécute donc **à la fin de chaque passage**,
    quel qu'il soit : le distributeur tournant toutes les minutes, le guetteur tourne toutes les
    minutes, et il survit à l'arrêt de n'importe laquelle des autres.
  - **Sa limite est assumée et écrite** : si toutes les tâches s'arrêtent ensemble, plus personne
    ne passe donc plus personne ne guette. Ce cas reste visible sur le tableau de bord, jamais par
    notification — aucune alerte ne part d'une machine éteinte.
  - **`alerted_at` fait qu'une alerte part une fois**, pas à chaque minute : une panne de week-end
    ferait sinon trois mille notifications. Elle repart au bout de 24 h, parce qu'une panne qu'on
    a laissée courir une journée mérite un rappel. Un passage réussi la remet à `null`.
  - **`mark_job_alerted` ne crée jamais de ligne.** La première version le faisait, et une tâche
    jamais lancée se serait affichée « en échec à l'instant » : un écran de santé qui ment est
    pire que pas d'écran. C'est la même raison qui fait que **`never` n'alerte pas**.
  - **Le guetteur appelle `notify_user` directement**, sans passer par `createNotifier` et le
    registre des modules. `core/jobs` n'est pas un module et ne peut pas déclarer de
    `notificationType` ; comme le titre et le corps sont **stockés** dans la ligne, la cloche les
    affiche sans rien chercher. Le registre des tâches porte donc la formulation de sa propre
    alerte, exactement comme un manifeste de module porte la sienne.
  - **Le message dit ce qu'on perd**, pas « erreur technique » : « Crédite les jours acquis chaque
    mois… Sans elle, les soldes ne montent plus. » Le gérant doit pouvoir décider s'il appelle
    tout de suite ou lundi sans savoir ce qu'est une tâche planifiée.

- **Compteurs en trois chiffres** (le propriétaire a montré l'écran « Absences » d'une autre
  application : acquis / disponible / utilisé côte à côte) :
  - **Les trois ne se déduisent pas l'un de l'autre, et c'est la raison d'être de l'écran.**
    `disponible` n'est pas `acquis − utilisé` : un report de la période précédente entre dans le
    solde sans avoir été acquis cette année. Les afficher séparément évite la question
    « pourquoi ça ne tombe pas juste ? », qui finit toujours par arriver.
  - **`available` vient toujours de la base, jamais d'une somme des mouvements affichés.** La
    liste est bornée par la requête ; la recalculer depuis elle donnerait un solde tronqué, et un
    compteur faux vaut moins que pas de compteur.
  - **Les jours pris et les heures reprises s'affichent en positif.** Le registre les écrit en
    négatif — c'est sa nature —, mais « jours pris : −3 » ne veut rien dire pour la personne qui
    lit.
  - **Une expiration n'est ni acquise ni prise.** Des jours perdus au changement de période
    laisseraient croire, comptés en « utilisés », qu'elle en a profité.
  - **`CounterCard` est dans `core/ui` et ne sait rien du métier** : ni ce qu'est un congé, ni ce
    qu'est une heure. Chaque module formate ses propres valeurs et passe des chaînes. C'est ce qui
    permet aux deux compteurs d'avoir la même forme sans qu'un module dépende de l'autre.
