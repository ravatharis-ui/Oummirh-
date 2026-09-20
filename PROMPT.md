# PROMPT MAÎTRE — Reconstruction de « Oummi RH » avec Claude Code

> **Mode d'emploi (pour Haris, à ne pas coller)**
>
> 1. Crée un dossier vide `oummi-rh`, ouvre-le dans Claude Code, sélectionne le modèle Fable.
> 2. Enregistre ce fichier à la racine sous `PROMPT.md`.
> 3. Écris simplement : **« Lis PROMPT.md en entier, puis exécute la Phase 0. Passe en mode plan avant d'écrire du code. »**
> 4. À la fin de chaque phase, Claude Code s'arrête : tu testes, tu valides, puis tu écris « Phase suivante ».
> 5. Tout ce qui est sous la ligne ci-dessous s'adresse à Claude Code.

---

## 0. TON RÔLE ET TA MÉTHODE DE TRAVAIL

Tu es un développeur full-stack senior (TypeScript, Next.js, Postgres/Supabase). Tu construis une application RH de production pour une vraie entreprise, utilisée par des vendeuses sur smartphone et par la direction sur ordinateur. Le propriétaire du projet n'est pas développeur : il teste l'app, il ne relit pas le code. La qualité, la sécurité et la lisibilité reposent donc entièrement sur toi.

**Règles de travail non négociables :**

1. **Phase par phase.** Tu exécutes UNE phase (section 9), tu vérifies les critères d'acceptation, tu fais un commit, puis tu t'ARRÊTES et tu résumes : ce qui a été fait, comment le tester à la main (étapes cliquables), ce qui reste ouvert. Tu n'enchaînes jamais sur la phase suivante sans validation.
2. **Mode plan d'abord.** Au début de chaque phase, présente ton plan (fichiers créés/modifiés, migrations, risques) avant de coder.
3. **Crée un `CLAUDE.md`** à la racine dès la Phase 0, qui résume les sections 2, 3, 4 et 12 de ce document (stack, architecture, règles de modularité, conventions). Tu le mets à jour quand une décision d'architecture change.
4. **Aucun secret dans le code ni dans Git.** Tout passe par `.env.local` (gitignoré) et un `.env.example` documenté.
5. **Tu ne supprimes jamais de données ni de migration existante.** Toute évolution de base = nouvelle migration.
6. **En cas d'ambiguïté métier**, tu choisis l'option la plus prudente, tu la rends configurable si possible, et tu la listes dans ton résumé de fin de phase sous « Décisions à valider ».
7. **Tu écris les tests en même temps que le code** (section 11), pas après.
8. **Langue** : code, noms de variables et commentaires techniques en anglais ; toute l'interface, les messages d'erreur, les emails et la documentation utilisateur en **français**.

---

## 1. CONTEXTE MÉTIER

**Oummi Dressing** est un réseau de prêt-à-porter féminin à **La Réunion** (fuseau horaire `Indian/Reunion`, UTC+4, pas d'heure d'été). L'application **Oummi RH** remplace une V1 (Express + Firestore) devenue trop complexe à maintenir.

**Deux espaces :**

- **Espace Collaboratrice** : sur smartphone, installable comme une app (PWA), connexion par **sélection de son nom + code PIN à 4 chiffres**. Usage : pointer, voir son planning, demander congés / récupérations / échanges, recevoir des notifications, télécharger ses documents.
- **Espace Direction (Admin)** : sur ordinateur (responsive aussi), connexion par **email + mot de passe**. Usage : supervision multi-boutiques en temps réel, plannings, validations, heures, documents.

**Points de vente (5) :**

| Code       | Nom                         | Type                         |
| ---------- | --------------------------- | ---------------------------- |
| `STDENIS`  | Oummi Dressing Saint-Denis  | Boutique physique (Nord)     |
| `STLOUIS`  | Oummi Dressing Saint-Louis  | Boutique physique (Sud)      |
| `STPAUL`   | Oummi Dressing Saint-Paul   | Boutique physique (Ouest)    |
| `STPIERRE` | Oummi Dressing Saint-Pierre | Boutique physique (Sud)      |
| `ONLINE`   | Boutique en ligne           | Pôle e-commerce & logistique |

**Types de contrat** : CDI, CDD, Temps partiel, Alternance (liste extensible : stockée en table, pas en dur).

**Horaires par défaut** : 09:00–17:30, pause déjeuner 12:30–14:00 (1h30 déduite automatiquement) → 7h travaillées/jour. Chaque collaboratrice peut avoir ses propres horaires par défaut.

**Collaboratrices à importer (seed) :**

| Nom      | Prénom  | Boutique | Contrat       | Horaires    | Pause       |
| -------- | ------- | -------- | ------------- | ----------- | ----------- |
| ADAM     | Loubna  | STDENIS  | CDI           | 09:30–18:00 | 12:30–14:00 |
| ADAM     | Chamyma | STDENIS  | CDD           | 09:30–18:00 | 12:30–14:00 |
| BLUKER   | Yolaine | STPAUL   | CDI           | 09:00–17:30 | 12:30–14:00 |
| MESSINE  | Annie   | STPAUL   | CDI           | 09:00–17:30 | 12:30–14:00 |
| MURAT    | Carinne | STPIERRE | CDI           | 09:00–17:30 | 12:30–14:00 |
| AGATHE   | Elisa   | STPIERRE | CDD           | 09:00–17:30 | 12:30–14:00 |
| ZITTE    | Maëva   | STPIERRE | Temps partiel | 09:00–17:30 | 12:30–14:00 |
| HODGI    | Laurine | STLOUIS  | CDD           | 09:00–17:30 | 12:30–14:00 |
| CHAMBAUD | Léna    | STLOUIS  | Temps partiel | 09:00–17:30 | 12:30–14:00 |
| HOARAU   | Zoé     | ONLINE   | Temps partiel | 09:00–17:30 | 12:30–14:00 |

⚠️ **Les anciens PIN et l'ancien mot de passe admin de la V1 sont compromis et ne doivent JAMAIS être réutilisés.** Le script de seed génère des PIN aléatoires (en excluant les suites triviales : 0000, 1111, 1234, 4321, etc.) et les écrit une seule fois dans `seed-output/pins.csv` (gitignoré). Le compte admin est créé à partir de `ADMIN_EMAIL` / `ADMIN_PASSWORD` fournis en variables d'environnement.

---

## 2. STACK TECHNIQUE (imposée)

Utilise les **dernières versions stables** au moment de l'installation et vérifie la documentation officielle à jour avant d'utiliser une API (ne te fie pas à ta mémoire pour les signatures).

| Couche                   | Outil                                                                                                           |
| ------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Framework                | **Next.js** (App Router, Server Components, Server Actions, Route Handlers) + **TypeScript strict**             |
| UI                       | **Tailwind CSS** + **shadcn/ui** + **lucide-react** ; animations légères avec `motion` uniquement si utile      |
| Formulaires / validation | **react-hook-form** + **Zod** (les schémas Zod sont la source de vérité des entrées)                            |
| Données client           | **TanStack Query** pour le cache client et l'invalidation après Realtime                                        |
| Base de données          | **Supabase Postgres** (migrations SQL versionnées via Supabase CLI)                                             |
| Auth                     | **Supabase Auth** (admin : email/mot de passe ; collaboratrices : flux PIN custom, section 6.1)                 |
| Fichiers                 | **Supabase Storage** (buckets privés, URLs signées courtes)                                                     |
| Temps réel               | **Supabase Realtime** (notifications, tableau de présence)                                                      |
| Tâches planifiées        | **pg_cron** (dans Postgres) + **Vercel Cron** pour le dispatcher d'événements                                   |
| Emails                   | **Resend** + **React Email** (templates en TSX)                                                                 |
| Hébergement              | **Vercel**                                                                                                      |
| Dates                    | **date-fns** + **date-fns-tz**, fuseau `Indian/Reunion` partout                                                 |
| Tests                    | **Vitest** (logique métier), **Playwright** (parcours), **pgTAP** via `supabase test db` (RLS et fonctions SQL) |
| Qualité                  | ESLint (+ `eslint-plugin-boundaries`), Prettier, `tsc --noEmit`, GitHub Actions                                 |
| Types DB                 | `supabase gen types typescript` → `src/core/db/database.types.ts` (régénéré après chaque migration)             |

**Interdits** : Firebase/Firestore, un serveur Express séparé, un cache JSON local synchronisé, du `any` TypeScript, des clés `service_role` côté client, des heures calculées avec l'horloge du téléphone.

---

## 3. ARCHITECTURE MODULAIRE (le point le plus important)

L'objectif : **ajouter une fonctionnalité = ajouter un dossier**, sans modifier les modules existants.

### 3.1 Arborescence

```
oummi-rh/
├── CLAUDE.md
├── PROMPT.md
├── .env.example
├── supabase/
│   ├── config.toml
│   ├── migrations/            # 1 fichier par changement, préfixé par le module
│   ├── seed.sql               # données de référence (boutiques, contrats, jours fériés)
│   └── tests/                 # tests pgTAP (RLS, fonctions)
├── scripts/
│   └── seed-employees.ts      # crée comptes + PIN aléatoires → seed-output/pins.csv
├── emails/                    # templates React Email partagés (layout)
├── src/
│   ├── app/
│   │   ├── (auth)/            # /connexion, /admin/connexion
│   │   ├── (collab)/          # espace collaboratrice, layout mobile
│   │   ├── (admin)/           # espace direction, layout desktop
│   │   └── api/
│   │       ├── auth/pin/route.ts
│   │       └── events/dispatch/route.ts
│   ├── core/                  # socle partagé, ne dépend d'AUCUN module
│   │   ├── auth/              # session, rôles, guards (requireAdmin, requireEmployee)
│   │   ├── db/                # clients Supabase (browser, server, admin), types générés
│   │   ├── events/            # emitEvent(), registre des handlers, dispatcher
│   │   ├── notifications/     # notify(), cloche, Realtime, envoi Resend
│   │   ├── time/              # helpers fuseau Réunion, calcul de durées, jours fériés
│   │   ├── ui/                # composants shadcn + composants génériques
│   │   ├── settings/          # lecture typée de la table settings
│   │   └── modules/
│   │       ├── types.ts       # contrat AppModule
│   │       └── registry.ts    # liste des modules actifs
│   └── modules/
│       ├── employees/
│       ├── pointage/
│       ├── planning/
│       ├── conges/
│       ├── heures/
│       ├── remplacements/
│       ├── swaps/
│       └── documents/
```

### 3.2 Structure interne d'un module (identique pour tous)

```
src/modules/<nom>/
├── index.ts          # SEULE API publique : export du manifeste AppModule + types publics
├── manifest.ts       # déclaration pour le registre (routes, menu, notifs, handlers)
├── schemas.ts        # schémas Zod des entrées
├── types.ts
├── domain/           # logique métier PURE (aucun import Supabase/React) → testée par Vitest
├── server/           # server actions, requêtes DB, handlers d'événements
├── ui/
│   ├── collab/       # écrans espace collaboratrice
│   └── admin/        # écrans espace direction
├── emails/           # templates React Email propres au module
└── __tests__/
```

### 3.3 Le contrat `AppModule`

```ts
// src/core/modules/types.ts
export type Role = "employee" | "admin" | "manager";

export interface NavItem {
  label: string; // en français
  href: string;
  icon: LucideIcon;
  roles: Role[];
  badgeQuery?: () => Promise<number>; // compteur optionnel (ex. demandes en attente)
}

export interface NotificationTypeDef {
  type: string; // ex. 'conges.request_approved'
  title: (payload: any) => string;
  body: (payload: any) => string;
  href?: (payload: any) => string;
  email?: boolean; // envoyer aussi par email si le destinataire a un email
}

export interface AppModule {
  key: string; // 'conges'
  name: string; // 'Congés'
  enabled: boolean; // lu aussi depuis settings.modules_enabled
  nav: { collab?: NavItem[]; admin?: NavItem[] };
  notificationTypes?: NotificationTypeDef[];
  eventHandlers?: Record<string, (event: DomainEvent) => Promise<void>>;
  dashboardWidgets?: { collab?: ComponentType[]; admin?: ComponentType[] };
}
```

`registry.ts` importe les manifestes, filtre ceux qui sont désactivés dans `settings`, et expose : le menu, les widgets du tableau de bord, les types de notification et la table de routage des événements. Les layouts `(collab)` et `(admin)` construisent leur menu et leur tableau de bord **uniquement** à partir du registre.

### 3.4 Règles de dépendance (appliquées par `eslint-plugin-boundaries`)

- `core/` n'importe jamais `modules/`.
- Un module n'importe jamais l'intérieur d'un autre module. Il peut seulement importer son `index.ts` (types publics).
- **Les modules communiquent par événements**, jamais par appels directs. Exemple : quand un congé est approuvé, `conges` émet `conges.request_approved` ; c'est le handler de `planning` qui pose le statut CONGÉ sur les jours concernés, et `core/notifications` qui prévient la collaboratrice.
- Les tables d'un module ne sont écrites que par ce module. Les autres peuvent les **lire** via des vues SQL publiques documentées si nécessaire.

### 3.5 Bus d'événements (pattern outbox)

- Table `domain_events` (section 5). `emitEvent(type, payload, actorId)` insère une ligne **dans la même transaction** que l'action métier (via une fonction SQL `emit_event()` appelée par les RPC).
- Le dispatcher (`/api/events/dispatch`) lit les événements non traités, appelle chaque handler déclaré dans le registre, marque `processed_at`, incrémente `attempts` et enregistre `last_error` en cas d'échec (max 5 tentatives).
- Déclenchement : un **Database Webhook Supabase** sur insert dans `domain_events` appelle le dispatcher immédiatement ; **Vercel Cron** toutes les minutes rattrape ce qui a échoué. La route est protégée par un secret (`EVENTS_DISPATCH_SECRET`).
- Les handlers sont **idempotents** (un événement rejoué ne crée pas de doublon).

### 3.6 Les « ledgers » (grands livres)

Les soldes de **congés** et d'**heures** ne sont jamais stockés comme un simple nombre modifiable. Ils sont la **somme de mouvements** horodatés et justifiés (acquisition mensuelle, prise de congé, ajustement manuel, heures en plus, récupération…). Cela donne un historique complet, des corrections traçables, et permet d'ajouter de nouveaux types de mouvements sans migration de logique.

---

## 4. SÉCURITÉ ET CONFORMITÉ

1. **RLS activée sur toutes les tables**, sans exception. Politiques écrites explicitement et testées en pgTAP :
   - `employee` : lecture de ses propres lignes uniquement (pointages, planning de sa boutique, ses demandes, ses documents, ses notifications) ; écriture uniquement via RPC.
   - `manager` (prévu pour plus tard, responsable de boutique) : lecture/écriture limitées à sa ou ses boutiques.
   - `admin` : accès complet.
2. **Écritures sensibles via fonctions SQL `security definer`** (RPC) qui revérifient les droits et les règles métier. Le client n'insère jamais directement dans `time_clocks`, `leave_ledger` ou `hours_ledger`.
3. **Horodatage** : toujours `now()` côté Postgres. Aucune date/heure de pointage n'est acceptée depuis le client.
4. **PIN** : hachés avec bcrypt (`pgcrypto` `crypt()` + `gen_salt('bf')`), jamais stockés ni journalisés en clair. Verrouillage après 5 échecs pendant 15 minutes (table `login_attempts`), délai artificiel sur échec. L'admin peut réinitialiser un PIN (nouveau PIN affiché une seule fois).
5. **Fichiers** : buckets privés, URLs signées de 60 s maximum, chemins cloisonnés par `employee_id`.
6. **Journal d'audit** (`audit_log`) : toute action admin (validation, refus, modification de planning, ajustement de solde, réinitialisation PIN, dépôt de document) est tracée avec auteur, date, avant/après.
7. **RGPD / CNIL — selfies de pointage** :
   - Aucune reconnaissance faciale, aucune donnée biométrique extraite. La photo sert uniquement de contrôle visuel.
   - Durée de conservation configurable (`settings.selfie_retention_days`, défaut **60 jours**), purge automatique par pg_cron (fichier + chemin).
   - Page « Informations & confidentialité » dans l'espace collaboratrice expliquant la finalité, la durée de conservation et les droits.
   - Photos compressées côté client (JPEG, ~720 px de large, qualité 0.7) avant envoi.
8. **Headers de sécurité** Next.js (CSP, `Permissions-Policy: camera=(self)`), cookies `httpOnly` `secure` `sameSite=lax`.
9. **Rate limiting** sur `/api/auth/pin` et sur les RPC de pointage.

---

## 5. SCHÉMA DE BASE DE DONNÉES

Crée les migrations dans cet ordre, une par module, préfixées (`0001_core_...sql`, `0002_employees_...sql`, etc.). Toutes les tables ont `id uuid primary key default gen_random_uuid()`, `created_at timestamptz default now()`, `updated_at` avec trigger quand pertinent. Utilise des tables de référence ou des `check` plutôt que des `enum` Postgres rigides quand la liste peut grandir.

### 5.1 Core

```sql
boutiques(id, code text unique, name, kind text check (kind in ('physical','online')),
          address, is_active bool default true, sort_order int)

contract_types(id, code text unique, label, is_apprenticeship bool default false,
               sort_order int)            -- CDI, CDD, TEMPS_PARTIEL, ALTERNANCE

user_roles(user_id uuid references auth.users, role text check (role in ('employee','admin','manager')),
           boutique_id uuid null references boutiques, primary key(user_id, role, boutique_id))

settings(key text primary key, value jsonb, updated_at, updated_by)
  -- clés : company_name, timezone, default_schedule, leave_rules, late_tolerance_minutes,
  --        selfie_retention_days, modules_enabled, overtime_recovery_min_step_minutes, ...

public_holidays(date date primary key, label, region text default 'REUNION')
  -- seed : jours fériés nationaux + 20 décembre (abolition de l'esclavage à La Réunion),
  --        pour l'année en cours et la suivante

domain_events(id, type text, payload jsonb, actor_id uuid null, created_at,
              processed_at timestamptz null, attempts int default 0, last_error text null)

notifications(id, recipient_user_id uuid, type text, title, body, href, payload jsonb,
              read_at timestamptz null, emailed_at timestamptz null, created_at)
  -- Realtime activé sur cette table

audit_log(id, actor_id, action text, entity text, entity_id uuid, before jsonb, after jsonb, created_at)

login_attempts(id, employee_id uuid, success bool, ip inet, created_at)
```

### 5.2 Module `employees`

```sql
employees(id, auth_user_id uuid unique references auth.users,
          last_name, first_name, display_name,
          boutique_id references boutiques, contract_type_id references contract_types,
          email text null, phone text null,
          pin_hash text not null,
          weekly_contract_hours numeric(5,2),   -- ex. 35, 24...
          default_start time, default_end time,
          default_break_start time, default_break_end time,
          work_days int[] default '{1,2,3,4,5,6}', -- 1=lundi ... 7=dimanche (ISO)
          hire_date date, end_date date null,
          is_active bool default true,
          avatar_path text null)
```

### 5.3 Module `planning`

```sql
planning_entries(id, employee_id, boutique_id,  -- boutique où elle travaille CE jour-là
                 date date,
                 status text check (status in ('work','rest','leave','school','replacement','sick','other')),
                 start_time time null, end_time time null,
                 break_start time null, break_end time null,
                 note text null,
                 source text check (source in ('manual','template','leave','replacement','swap')),
                 source_ref uuid null,
                 unique(employee_id, date))

planning_templates(id, employee_id, weekday int, status, start_time, end_time, break_start, break_end)
  -- semaine type par collaboratrice (ex. jours d'école fixes pour l'alternance)
```

### 5.4 Module `pointage`

```sql
time_clocks(id, employee_id, boutique_id,
            event_type text check (event_type in ('clock_in','break_start','break_end','clock_out')),
            occurred_at timestamptz not null default now(),   -- JAMAIS fourni par le client
            local_date date not null,                          -- date Réunion calculée en SQL
            photo_path text unique,
            planned_time time null,                            -- heure prévue au planning
            delta_minutes int null,                            -- écart (positif = retard / départ tardif)
            is_correction bool default false,
            corrected_by uuid null, correction_reason text null)

-- vue daily_worked_time(employee_id, local_date, worked_minutes, planned_minutes, delta_minutes, anomalies[])
```

### 5.5 Module `conges`

```sql
leave_requests(id, employee_id, type text check (type in ('paid','unpaid','sick','family','other')),
               start_date, end_date, half_day_start bool, half_day_end bool,
               days_count numeric(4,1),      -- calculé côté serveur selon leave_rules
               reason text null, attachment_path text null,
               status text check (status in ('pending','approved','rejected','cancelled')),
               decided_by uuid null, decided_at timestamptz null, decision_note text null)

leave_ledger(id, employee_id, period_start date,   -- début de période de référence (1er juin)
             kind text check (kind in ('accrual','taken','adjustment','carry_over','expiry')),
             days numeric(5,2),                    -- positif = acquis, négatif = consommé
             ref_id uuid null, note text, created_by uuid null, created_at)
-- vue leave_balances(employee_id, period_start, acquired, taken, balance)
```

### 5.6 Module `heures`

```sql
hours_ledger(id, employee_id, local_date date null,
             kind text check (kind in ('daily_delta','recovery','adjustment','payout')),
             minutes int,                          -- positif = crédit, négatif = débit
             ref_id uuid null, note text, created_by uuid null, created_at)

overtime_recovery_requests(id, employee_id, date date,
             mode text check (mode in ('arrive_later','leave_earlier')),
             minutes int check (minutes > 0),
             status text check (status in ('pending','approved','rejected','cancelled')),
             decided_by, decided_at, decision_note)
-- vue hours_balances(employee_id, balance_minutes, month_delta_minutes)
```

### 5.7 Module `remplacements`

```sql
direct_replacements(id, employee_id, from_boutique_id, to_boutique_id, date date,
                    start_time, end_time, break_start, break_end,
                    reason text, created_by uuid, cancelled_at timestamptz null)
```

### 5.8 Module `swaps`

```sql
shift_swaps(id, requester_id, target_id,
            requester_date date, target_date date,   -- les deux jours échangés
            message text null,
            status text check (status in ('pending_colleague','pending_admin','approved',
                                          'rejected_colleague','rejected_admin','cancelled')),
            colleague_decided_at, admin_decided_by, admin_decided_at, decision_note)
```

### 5.9 Module `documents`

```sql
employee_documents(id, employee_id, category text check (category in ('payslip','contract','amendment','certificate','other')),
                   title, period date null,   -- ex. mois de la fiche de paie
                   storage_path text, size_bytes int, mime_type,
                   uploaded_by uuid, first_viewed_at timestamptz null)
```

### 5.10 Buckets Storage

- `selfies` (privé) : `{employee_id}/{YYYY-MM-DD}/{event_type}-{uuid}.jpg` ; une collaboratrice ne peut qu'**ajouter** dans son dossier, jamais lire ni supprimer ; l'admin lit.
- `documents` (privé) : `{employee_id}/{category}/{uuid}.pdf` ; la collaboratrice lit son dossier, l'admin lit/écrit.
- `leave-attachments` (privé) : justificatifs de congés.

---

## 6. SPÉCIFICATIONS FONCTIONNELLES PAR MODULE

### 6.1 Socle — Authentification

**Collaboratrice (PIN)** :

1. Écran `/connexion` : choix de la boutique → liste des prénoms (grosses tuiles avec initiales/avatar) → pavé numérique géant à 4 chiffres (pas de clavier système).
2. Sur le téléphone personnel, la dernière collaboratrice connectée est mémorisée (cookie non sensible contenant l'`employee_id`) : à l'ouverture suivante, on affiche directement son pavé PIN avec un lien « Ce n'est pas moi ».
3. `POST /api/auth/pin` (Route Handler serveur, clé `service_role` côté serveur uniquement) : vérifie le verrouillage, compare le PIN au hash, journalise la tentative ; en cas de succès, crée la session Supabase de l'utilisateur lié (chaque collaboratrice a un compte `auth.users` avec un email technique non routable, ex. `{employee_id}@staff.oummi.invalid`, et la session est ouverte via `auth.admin.generateLink({ type: 'magiclink' })` puis `verifyOtp({ token_hash })` côté serveur). Vérifie dans la doc Supabase à jour que ce flux est toujours supporté ; sinon propose l'alternative la plus sûre avant de coder.
4. Session longue (30 jours) sur mobile, déconnexion manuelle possible.

**Admin** : `/admin/connexion`, email + mot de passe Supabase, « mot de passe oublié » via email Resend. Rôle vérifié via `user_roles`.

**Guards** : `requireEmployee()` et `requireAdmin()` dans les layouts et dans chaque server action.

### 6.2 Module `employees` (admin)

- Liste filtrable par boutique / contrat / statut, fiche détaillée (onglets : Infos, Planning type, Soldes, Pointages, Documents, Historique).
- Création / modification / archivage (jamais de suppression dure).
- Réinitialisation du PIN : génère un PIN aléatoire non trivial, l'affiche **une seule fois** dans une modale, trace dans `audit_log`.
- Changement de boutique d'affectation avec date d'effet.

### 6.3 Module `pointage` — Selfie & horodatage certifié

**Côté collaboratrice (écran d'accueil)** :

- Un **seul gros bouton** qui affiche la prochaine action logique selon l'état du jour : « Pointer mon arrivée » → « Partir en pause » → « Retour de pause » → « Fin de journée ». Sous le bouton : heure prévue au planning et heures déjà travaillées aujourd'hui.
- Au clic : ouverture de la caméra frontale en plein écran via `navigator.mediaDevices.getUserMedia` (**aucun `<input type="file">`, aucune galerie**), capture sur `<canvas>`, aperçu, bouton « Valider ».
- Envoi : upload de la photo dans `selfies/` puis appel RPC `clock_event(p_event_type, p_photo_path)`.
- La RPC : vérifie que l'utilisateur est une collaboratrice active, que l'événement respecte la séquence (`clock_in` → `break_start` → `break_end` → `clock_out` ; la pause est facultative ; pas de double `clock_in`), que la photo existe dans son dossier et n'a jamais servi, calcule `local_date` en `Indian/Reunion`, récupère l'heure prévue au planning, calcule `delta_minutes`, insère avec `now()`, émet `pointage.clock_recorded`.
- Confirmation plein écran avec l'**heure serveur retournée** (pas l'heure du téléphone) et une vibration (`navigator.vibrate`).
- Si la caméra est refusée : message d'aide clair expliquant comment l'autoriser (iOS Safari et Android Chrome).
- Hors ligne : afficher un message clair « Pas de connexion, le pointage n'a pas été enregistré ». **Pas de pointage différé** en V1 (l'heure doit être celle du serveur).

**Côté direction** :

- **Tableau de présence en direct** (Realtime) par boutique : qui est arrivée, en pause, partie, absente, avec vignette selfie cliquable (URL signée).
- Historique des pointages filtrable, affichage des écarts en couleur (vert à l'heure, orange retard ≤ tolérance, rouge au-delà).
- **Correction manuelle** d'un pointage oublié : crée une ligne `is_correction = true` avec motif obligatoire, sans photo, tracée dans l'audit. Les pointages d'origine ne sont jamais modifiés.
- **Alertes automatiques** (pg_cron toutes les 10 min, entre 07:00 et 20:00 heure Réunion) : collaboratrice attendue (statut `work` ou `replacement`) sans `clock_in` après `late_tolerance_minutes` (défaut 10) → notification admin `pointage.missing_clock_in`. **Aucune alerte** pour les statuts `school`, `rest`, `leave`, `sick`. Pas de `clock_out` 1h après la fin prévue → alerte « oubli de pointage de sortie ».

### 6.4 Module `planning` — Plannings multi-boutiques

- **Vue admin** : matrice hebdomadaire (lignes = collaboratrices, colonnes = lundi → dimanche), filtre par boutique ou « toutes ». Navigation semaine précédente/suivante, sélecteur de date.
- Chaque cellule : statut + horaires. Couleurs et badges :
  - Travail : neutre, horaires affichés
  - **ÉCOLE** : **badge violet + icône `GraduationCap`**
  - Repos : gris
  - Congé : bleu
  - Remplacement : orange avec le nom de la boutique d'accueil
  - Maladie / Autre : rouge pâle
- Édition au clic (panneau latéral) avec **boutons rapides** : « Journée standard » (horaires par défaut de la collaboratrice, pause incluse), « Matin », « Après-midi », « Repos », « École », + saisie libre. Calcul en direct des heures de la journée pause déduite.
- **Dupliquer la semaine** vers la ou les semaines suivantes (avec aperçu et confirmation, ne remplace pas les congés/remplacements déjà posés).
- **Appliquer la semaine type** (`planning_templates`) sur une période : utile pour les jours d'école fixes des alternantes.
- Totaux par ligne : heures planifiées de la semaine vs `weekly_contract_hours`, écart surligné.
- **Impression / PDF** : version imprimable A4 paysage via une route `/admin/planning/print?week=...&boutique=...` avec CSS `@media print` (logo, semaine, boutique, légende).
- **Vue collaboratrice** : sa semaine en liste verticale (aujourd'hui en premier), avec ses collègues de la même boutique le même jour.
- Toute modification d'un jour futur émet `planning.entry_changed` → notification à la collaboratrice concernée.
- Handlers : écoute `conges.request_approved` (pose `leave`), `remplacements.created` (pose `replacement`), `swaps.approved` (échange les deux jours), `conges.request_cancelled` (restaure depuis la semaine type).

### 6.5 Module `remplacements` — « + Remplacement direct »

- Bouton **« + Remplacement direct »** dans le planning admin et sur le tableau de bord.
- Formulaire en 3 étapes : boutique qui a besoin de renfort + date + horaires → liste des collaboratrices **disponibles** (pas en congé, pas en école, et on indique si elles travaillent déjà ailleurs ce jour-là) → confirmation.
- Enregistrement dans `direct_replacements`, émission de `remplacements.created` : le planning est mis à jour instantanément (Realtime), la collaboratrice reçoit une notification in-app + email si elle en a un (« Tu es attendue demain à Oummi Dressing Saint-Pierre de 09:00 à 17:30 »).
- Annulation possible, qui notifie à nouveau et restaure le planning initial.
- Historique consultable.

### 6.6 Module `heures` — Suivi des heures & « ⚡ Prendre mes heures supp »

- **Calcul quotidien** (pg_cron à 23:30 heure Réunion + recalcul à chaque correction) : minutes réellement travaillées (pointages, pauses déduites) − minutes planifiées → écriture `daily_delta` dans `hours_ledger` (idempotent : une seule ligne par employée et par jour, mise à jour si recalcul).
- **Côté direction** : tableau par collaboratrice et par mois : heures contractuelles, planifiées, réelles, écart du mois, **solde net cumulé**. Ajustement manuel du solde (motif obligatoire, audit). Export CSV.
- **Côté collaboratrice** : carte « Mon solde d'heures » (ex. « +3 h 45 ») et bouton **« ⚡ Prendre mes heures supp »** :
  - choix : « Arriver plus tard » ou « Partir plus tôt », un jour futur où elle travaille, durée par paliers de 15 min (raccourcis 30 min / 1 h), plafonnée au solde disponible ;
  - statut `pending` → notification admin → validation ou refus **en un clic** depuis la notification ou la liste des demandes ;
  - si validé : ligne `recovery` négative dans le ledger, planning du jour ajusté automatiquement (handler `planning`), notification à la collaboratrice.
- ⚠️ Ce module suit un **solde de récupération interne**. Il ne calcule ni majorations légales ni paie : afficher une mention en ce sens dans l'écran admin.

### 6.7 Module `swaps` — Bourse d'échange de créneaux

- La collaboratrice choisit l'un de ses jours (travail ou repos) et une collègue (même boutique par défaut, autres boutiques possibles), puis le jour de la collègue à récupérer en échange.
- Contrôles : les deux jours sont dans le futur, pas en congé/école, et l'échange ne crée pas de double affectation.
- **Double validation** : la collègue accepte/refuse (notification) → si acceptée, la direction valide/refuse → si validée, le planning des deux est échangé (handler `planning`) et les deux sont notifiées.
- Annulation possible par la demandeuse tant que ce n'est pas validé par la direction.

### 6.8 Module `conges` — Congés & période légale (juin → mai)

- **Période de référence** : du 1er juin au 31 mai (configurable).
- **Règle d'acquisition configurable** dans `settings.leave_rules` — ⚠️ décision à faire valider par le propriétaire :
  - mode `ouvrables` : 2,5 jours ouvrables / mois (30 jours/an, lundi → samedi hors fériés) ;
  - mode `ouvres` : 2,08 jours ouvrés / mois (25 jours/an, lundi → vendredi hors fériés).
  - La V1 annonçait « 25 jours (2,5 j/mois) », ce qui est incohérent (2,5 × 12 = 30). Implémente les deux modes, **défaut `ouvrables`**, et signale-le dans le résumé de phase.
- **Acquisition mensuelle** automatique (pg_cron le 1er de chaque mois) : ligne `accrual` dans `leave_ledger` pour chaque collaboratrice active (proratisée en cas d'embauche en cours de mois).
- **Clôture de période** le 1er juin : report (`carry_over`) ou expiration configurable.
- **Demande** (collaboratrice) : calendrier de sélection de dates, demi-journées possibles, décompte calculé côté serveur (jours ouvrables ou ouvrés selon le mode, jours fériés Réunion exclus, jours de repos planifiés exclus), affichage du solde **avant/après**, justificatif optionnel (photo/PDF), motif.
- **Chevauchement** : alerte à l'admin si une autre collaboratrice de la même boutique est déjà en congé sur les mêmes dates.
- **Validation** (admin) : liste des demandes en attente, validation/refus avec commentaire. À la validation : ligne `taken` négative dans le ledger, émission de `conges.request_approved` (planning + notification + email).
- Annulation par la collaboratrice si `pending` ; par l'admin si `approved` (recrédite le ledger, émet `conges.request_cancelled`).
- Vue admin **calendrier des absences** par mois et par boutique.

### 6.9 Module `documents` — Coffre-fort numérique

- **Admin** : dépôt de PDF par collaboratrice, par catégorie (fiche de paie, contrat, avenant, attestation, autre) et par période ; **dépôt en lot** des fiches de paie du mois (glisser-déposer plusieurs fichiers, association automatique si le nom de fichier contient le nom de famille, sinon association manuelle avant validation).
- À chaque dépôt : notification + email « Ta fiche de paie de septembre est disponible ».
- **Collaboratrice** : liste par catégorie et par année, téléchargement via URL signée (60 s), marquage `first_viewed_at` (l'admin voit qui a consulté).
- Limites : PDF uniquement, 10 Mo maximum.

### 6.10 Notifications (dans `core`)

- `notify(recipientUserId, type, payload)` : insère dans `notifications` ; si le type a `email: true` et que le destinataire a un email, envoi via Resend avec un template React Email aux couleurs d'Oummi.
- **Cloche** dans l'en-tête des deux espaces : compteur de non-lues (Realtime), panneau déroulant, clic = marque comme lue + navigation vers `href`, bouton « Tout marquer comme lu ».
- Les demandes à valider (congés, récupérations, échanges) sont **actionnables directement depuis la notification** côté admin (boutons Valider / Refuser).
- Préparer (sans l'activer) l'emplacement pour les **notifications push web** dans un futur module, via le même `notify()`.

### 6.11 Paramètres (admin)

Page `/admin/parametres` : informations entreprise, boutiques (ajout/désactivation), types de contrat, horaires par défaut, règles de congés, tolérance de retard, durée de conservation des selfies, jours fériés (ajout manuel), **activation/désactivation des modules**, gestion des comptes admin.

---

## 7. INTERFACE ET EXPÉRIENCE

**Espace collaboratrice (mobile first, 360–430 px)** :

- Barre de navigation en bas : Accueil, Planning, Demandes, Documents, Profil (générée par le registre).
- Accueil : bouton de pointage géant, carte « Aujourd'hui » (horaires, boutique, collègues présentes), carte soldes (congés + heures), dernières notifications.
- Cibles tactiles ≥ 48 px, texte ≥ 16 px, contraste AA, formulaires courts, retours visuels immédiats (toasts).
- **PWA** : `manifest.webmanifest` (nom « Oummi RH », icônes, `display: standalone`, couleur de thème), service worker minimal (cache de l'interface uniquement, jamais des données RH), écran « Ajouter à l'écran d'accueil » expliqué pour iPhone et Android.

**Espace direction (desktop first, responsive)** :

- Barre latérale générée par le registre, avec badges de compteurs (demandes en attente).
- Tableau de bord : présence en direct par boutique, alertes du jour, demandes à traiter, soldes d'heures extrêmes, prochains congés.

**Identité visuelle** : sobre, élégante, mode féminine. Palette neutre (blanc cassé, noir doux, beige/sable) avec une couleur d'accent unique définie en variable CSS (facile à remplacer). Typographie sans empattement lisible. Mode sombre non requis en V1.

**Formats** : dates `fr-FR` (« lundi 21 septembre »), heures en 24 h (« 09:30 »), durées « 7 h 30 », fuseau `Indian/Reunion` pour tout affichage et tout calcul de date locale.

**États** : chaque écran gère chargement (skeletons), vide (message + action), erreur (message humain + réessayer).

---

## 8. VARIABLES D'ENVIRONNEMENT (`.env.example`)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # serveur uniquement
RESEND_API_KEY=
EMAIL_FROM="Oummi RH <rh@votredomaine.re>"
EVENTS_DISPATCH_SECRET=
CRON_SECRET=
APP_URL=http://localhost:3000
ADMIN_EMAIL=                        # utilisé par le script de seed uniquement
ADMIN_PASSWORD=                     # utilisé par le script de seed uniquement
```

---

## 9. PLAN DE CONSTRUCTION PAR PHASES

Chaque phase se termine par : tests verts, `tsc` et lint verts, commit, résumé + guide de test manuel, **arrêt**.

**Phase 0 — Fondations**
Initialisation Next.js + TS strict + Tailwind + shadcn, Supabase CLI en local (`supabase init`, `supabase start`), structure de dossiers de la section 3, ESLint boundaries, Prettier, Vitest, Playwright, GitHub Actions (lint + typecheck + tests), `.env.example`, `CLAUDE.md`, `README.md` (installation pas à pas pour un non-développeur).
✅ `npm run dev` affiche une page d'accueil ; CI verte ; une règle boundaries volontairement violée fait échouer le lint (puis retirée).

**Phase 1 — Socle core**
Migration core (boutiques, contrats, rôles, settings, jours fériés, events, notifications, audit, login_attempts) + RLS + seed ; clients Supabase ; registre de modules ; layouts collab/admin générés par le registre ; helpers de temps Réunion (testés).
✅ Tests pgTAP RLS verts ; un module factice ajouté au registre apparaît dans le menu sans autre modification.

**Phase 2 — Auth & collaboratrices**
Module `employees`, script `seed-employees.ts` (10 collaboratrices, PIN aléatoires → `seed-output/pins.csv`, compte admin), flux PIN complet avec verrouillage, connexion admin, guards, CRUD admin, réinitialisation PIN.
✅ Connexion PIN sur mobile (émulation Playwright) ; 5 mauvais PIN = verrouillage ; une collaboratrice ne voit pas les données d'une autre (test RLS).

**Phase 3 — Événements & notifications**
`emit_event()`, dispatcher, webhook + cron de rattrapage, `notify()`, cloche Realtime, templates React Email, envoi Resend (mode test en local).
✅ Un événement factice déclenche une notification in-app visible en temps réel et un email de test ; un handler en échec est rejoué puis abandonné après 5 tentatives.

**Phase 4 — Pointage**
Capture caméra, upload, RPC `clock_event`, écran d'accueil collaboratrice, présence en direct admin, corrections, alertes pg_cron, purge des selfies.
✅ Séquence complète d'une journée ; impossible d'envoyer une image de la galerie ; impossible de fournir une heure ; double `clock_in` refusé ; pas d'alerte le jour d'école.

**Phase 5 — Planning**
Matrice, édition, boutons rapides, statuts dont ÉCOLE violet, semaine type, duplication, totaux, impression, vue collaboratrice, notification de changement.
✅ Dupliquer une semaine ne touche pas aux congés ; l'impression tient sur une page A4 paysage pour une boutique.

**Phase 6 — Congés**
Ledger, acquisition mensuelle, décompte serveur (2 modes), demande, validation, annulation, calendrier des absences, handlers planning.
✅ Tests Vitest du décompte (week-ends, jours fériés dont le 20 décembre, demi-journées, période juin→mai, prorata d'embauche).

**Phase 7 — Heures & récupération**
Calcul quotidien, tableau admin, ajustements, export CSV, bouton « ⚡ Prendre mes heures supp », validation en un clic, ajustement planning.
✅ Tests Vitest des calculs ; impossible de demander plus que son solde.

**Phase 8 — Remplacements directs**
Formulaire 3 étapes, disponibilités, mise à jour planning en temps réel, notifications, annulation.
✅ La collaboratrice remplaçante voit le changement sur son téléphone sans recharger la page.

**Phase 9 — Échanges de créneaux**
Flux complet avec double validation et contrôles.
✅ Test Playwright du parcours complet à 3 acteurs (2 collaboratrices + admin).

**Phase 10 — Documents**
Buckets, dépôt unitaire et en lot, notifications, consultation, suivi de lecture.
✅ Une collaboratrice ne peut pas télécharger le document d'une autre, même en devinant le chemin.

**Phase 11 — Finitions & mise en production**
Paramètres admin, PWA, page confidentialité, audit des accès RLS table par table, Lighthouse mobile ≥ 90 (performance et accessibilité), guide de déploiement pas à pas (projet Supabase de production, `supabase db push`, variables Vercel, domaine Resend vérifié, webhook, crons), guide utilisateur court pour les vendeuses (1 page) et pour la direction.
✅ Déploiement sur Vercel fonctionnel ; checklist de mise en production cochée.

---

## 10. ÉVOLUTIONS FUTURES À RENDRE POSSIBLES (ne pas coder, mais ne pas bloquer)

L'architecture doit permettre d'ajouter plus tard, **par un simple nouveau dossier de module** :

- rôle `manager` (responsable de boutique avec droits limités à sa boutique) ;
- notifications push web ;
- messagerie interne / annonces de la direction ;
- objectifs de vente par vendeuse (lien avec Shopify POS) ;
- export vers le logiciel de paie / le comptable ;
- entretiens annuels, formations, onboarding ;
- tableau de bord multi-entreprises (autres marques du groupe).

Vérifie à la fin de la Phase 11 que chacune de ces évolutions serait faisable sans modifier les modules existants, et liste les éventuels points de friction.

---

## 11. STRATÉGIE DE TESTS

- **Vitest** : toute la logique de `domain/` (calculs d'heures, décompte de congés, séquence de pointage, disponibilités de remplacement, validité d'un échange). Viser 90 % de couverture sur `domain/`.
- **pgTAP** : pour chaque table, un test prouvant qu'une collaboratrice ne lit/écrit pas les données d'une autre et qu'elle ne peut pas écrire directement dans les tables protégées ; tests des RPC (séquence de pointage, horodatage serveur).
- **Playwright** : parcours clés en viewport mobile (connexion PIN, pointage avec caméra simulée via `--use-fake-device-for-media-stream`, demande de congé) et desktop (validation admin, remplacement direct).
- Données de test isolées, jamais les vraies collaboratrices.

---

## 12. CONVENTIONS DE CODE

- TypeScript `strict`, aucun `any`, aucune assertion `!` non justifiée.
- Server Components par défaut ; `"use client"` uniquement quand nécessaire.
- Toute server action : `requireX()` → validation Zod → appel RPC/requête → `revalidatePath`/invalidation → retour typé `{ ok: true, data } | { ok: false, error: string }` (message d'erreur en français, compréhensible par une vendeuse).
- Pas de logique métier dans les composants React : elle vit dans `domain/`.
- Noms de fichiers en `kebab-case`, composants en `PascalCase`.
- Migrations : jamais modifiées après commit ; toujours accompagnées de la régénération des types.
- Commits conventionnels (`feat(pointage): ...`, `fix(conges): ...`).
- Chaque module a un court `README.md` : rôle, tables, événements émis, événements écoutés, écrans.

---

## 13. DÉFINITION DE « TERMINÉ »

L'application est terminée quand :

1. Les 10 collaboratrices peuvent se connecter par PIN sur leur téléphone et pointer avec selfie, et l'heure enregistrée est celle du serveur.
2. La direction voit la présence en direct des 5 points de vente, gère les plannings (dont ÉCOLE, remplacements, échanges), valide congés et récupérations en un clic, et dépose les fiches de paie.
3. Toutes les notifications arrivent en temps réel dans l'app, et par email quand une adresse existe.
4. Tous les tests sont verts, la RLS est prouvée sur chaque table, aucun secret n'est dans le dépôt.
5. Un nouveau module peut être ajouté sans modifier le code des modules existants (démontré par le module factice de la Phase 1).
6. Le README permet à une personne non développeuse de redéployer l'application.

**Commence maintenant par la Phase 0, en mode plan.**
