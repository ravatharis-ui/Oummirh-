-- =============================================================================
-- 20260922070000_core_schema — Oummi RH core foundation
--
-- Creates the shared tables every module builds on: sales outlets, contract
-- types, roles, settings, public holidays, the domain-event outbox, in-app
-- notifications, the audit trail and login attempts.
--
-- Security model (see CLAUDE.md, "Sécurité et conformité"):
--   * RLS is enabled on EVERY table, with explicit policies.
--   * `anon` gets no access at all. Pre-login screens go through dedicated
--     `security definer` RPCs added in Phase 2, never through direct table reads.
--   * `authenticated` reads reference data and its own rows only.
--   * `admin` (via public.user_roles) reads everything; writes go through
--     policies here and, for sensitive ledgers, through RPCs in later phases.
--   * `service_role` bypasses RLS and is used server-side only.
--
-- Timestamps are always produced by Postgres `now()`, never by a client.
-- =============================================================================

-- pgcrypto lives in the `extensions` schema on Supabase. It is required from
-- Phase 2 onwards to hash employee PINs with bcrypt (crypt / gen_salt).
create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- Shared trigger: keep `updated_at` honest.
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Trigger helper: stamps updated_at with the server clock on every UPDATE.';

-- -----------------------------------------------------------------------------
-- boutiques — the five sales outlets (four shops + the online store).
-- -----------------------------------------------------------------------------
create table public.boutiques (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  kind        text not null check (kind in ('physical', 'online')),
  address     text,
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger boutiques_set_updated_at
  before update on public.boutiques
  for each row execute function public.set_updated_at();

comment on table public.boutiques is 'Points de vente (boutiques physiques et pôle en ligne).';

-- -----------------------------------------------------------------------------
-- contract_types — extensible list (CDI, CDD, temps partiel, alternance, ...).
-- Stored as a table, never as a Postgres enum, so the list can grow.
-- -----------------------------------------------------------------------------
create table public.contract_types (
  id                 uuid primary key default gen_random_uuid(),
  code               text not null unique,
  label              text not null,
  is_apprenticeship  boolean not null default false,
  sort_order         integer not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create trigger contract_types_set_updated_at
  before update on public.contract_types
  for each row execute function public.set_updated_at();

comment on table public.contract_types is 'Types de contrat, liste extensible.';
comment on column public.contract_types.is_apprenticeship is
  'Alternance : ouvre les jours ÉCOLE dans le planning.';

-- -----------------------------------------------------------------------------
-- user_roles — who is an employee, an admin, or (later) a shop manager.
--
-- NOTE: the specification used `primary key (user_id, role, boutique_id)` with a
-- nullable boutique_id, which Postgres rejects (PK columns are NOT NULL).
-- We use UNIQUE NULLS NOT DISTINCT instead, which gives the same guarantee:
-- one row per (user, role, boutique), and a single row per global role.
-- -----------------------------------------------------------------------------
create table public.user_roles (
  user_id      uuid not null references auth.users (id) on delete cascade,
  role         text not null check (role in ('employee', 'admin', 'manager')),
  boutique_id  uuid references public.boutiques (id) on delete cascade,
  created_at   timestamptz not null default now(),
  constraint user_roles_unique unique nulls not distinct (user_id, role, boutique_id),
  -- `manager` is always scoped to one shop; `employee` and `admin` are global.
  -- An employee's shop lives on public.employees.boutique_id (Phase 2).
  constraint user_roles_boutique_scope check (
    (role = 'manager' and boutique_id is not null)
    or (role <> 'manager' and boutique_id is null)
  )
);

create index user_roles_user_id_idx on public.user_roles (user_id);

comment on table public.user_roles is 'Rôles applicatifs rattachés aux comptes auth.users.';

-- -----------------------------------------------------------------------------
-- settings — one row per configuration key, value as JSON.
-- -----------------------------------------------------------------------------
create table public.settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users (id) on delete set null
);

create trigger settings_set_updated_at
  before update on public.settings
  for each row execute function public.set_updated_at();

comment on table public.settings is
  'Réglages applicatifs (horaires par défaut, règles de congés, modules actifs, ...).';

-- -----------------------------------------------------------------------------
-- public_holidays — national holidays plus Réunion-specific ones (20 December).
-- -----------------------------------------------------------------------------
create table public.public_holidays (
  date        date primary key,
  label       text not null,
  region      text not null default 'REUNION',
  created_at  timestamptz not null default now()
);

comment on table public.public_holidays is
  'Jours fériés applicables à La Réunion, utilisés par le décompte des congés.';

-- -----------------------------------------------------------------------------
-- domain_events — transactional outbox. Modules never call each other directly;
-- they emit an event here inside the same transaction as the business write.
-- The dispatcher (Phase 3) picks rows up, runs handlers, and retries ≤ 5 times.
-- -----------------------------------------------------------------------------
create table public.domain_events (
  id            uuid primary key default gen_random_uuid(),
  type          text not null,
  payload       jsonb not null default '{}'::jsonb,
  actor_id      uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  processed_at  timestamptz,
  attempts      integer not null default 0 check (attempts >= 0),
  last_error    text
);

-- The dispatcher only ever scans the unprocessed tail.
create index domain_events_pending_idx
  on public.domain_events (created_at)
  where processed_at is null;

comment on table public.domain_events is
  'Bus d''événements (pattern outbox) : seule voie de communication entre modules.';

-- -----------------------------------------------------------------------------
-- notifications — in-app bell. Realtime is enabled at the bottom of this file.
-- -----------------------------------------------------------------------------
create table public.notifications (
  id                 uuid primary key default gen_random_uuid(),
  recipient_user_id  uuid not null references auth.users (id) on delete cascade,
  type               text not null,
  title              text not null,
  body               text not null,
  href               text,
  payload            jsonb not null default '{}'::jsonb,
  read_at            timestamptz,
  emailed_at         timestamptz,
  created_at         timestamptz not null default now()
);

create index notifications_recipient_unread_idx
  on public.notifications (recipient_user_id, created_at desc)
  where read_at is null;

comment on table public.notifications is 'Notifications in-app, diffusées en temps réel.';

-- -----------------------------------------------------------------------------
-- audit_log — every admin action, with before/after snapshots.
-- -----------------------------------------------------------------------------
create table public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references auth.users (id) on delete set null,
  action      text not null,
  entity      text not null,
  entity_id   uuid,
  before      jsonb,
  after       jsonb,
  created_at  timestamptz not null default now()
);

create index audit_log_entity_idx on public.audit_log (entity, entity_id, created_at desc);

comment on table public.audit_log is 'Journal d''audit des actions de la direction.';

-- -----------------------------------------------------------------------------
-- login_attempts — PIN brute-force protection (5 failures / 15 minutes).
-- The employee_id foreign key is added in Phase 2, with the employees table.
-- -----------------------------------------------------------------------------
create table public.login_attempts (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid,
  success      boolean not null,
  ip           inet,
  created_at   timestamptz not null default now()
);

create index login_attempts_employee_idx
  on public.login_attempts (employee_id, created_at desc);

comment on table public.login_attempts is
  'Tentatives de connexion par PIN. Aucun PIN, en clair ou haché, n''est stocké ici.';

-- =============================================================================
-- Role helpers
--
-- These are `security definer` on purpose: an RLS policy on public.user_roles
-- that queried public.user_roles directly would recurse. Running as the owner
-- with an empty search_path breaks the cycle safely.
-- =============================================================================
create or replace function public.has_role(p_role text, p_boutique_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role = p_role
      and (p_boutique_id is null or ur.boutique_id = p_boutique_id)
  );
$$;

comment on function public.has_role(text, uuid) is
  'Vrai si l''utilisateur courant possède ce rôle (optionnellement sur cette boutique).';

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role = 'admin'
  );
$$;

comment on function public.is_admin() is 'Vrai si l''utilisateur courant est administrateur.';

revoke all on function public.has_role(text, uuid) from public;
revoke all on function public.is_admin() from public;
grant execute on function public.has_role(text, uuid) to authenticated, service_role;
grant execute on function public.is_admin() to authenticated, service_role;

-- =============================================================================
-- Row Level Security
--
-- Enabled on every table. The API roles (anon, authenticated) are never table
-- owners, so ENABLE is enough to subject them to the policies below.
-- `service_role` holds BYPASSRLS and is deliberately exempt: it is used only
-- server-side, from code that has already checked permissions itself.
-- =============================================================================
alter table public.boutiques        enable row level security;
alter table public.contract_types   enable row level security;
alter table public.user_roles       enable row level security;
alter table public.settings         enable row level security;
alter table public.public_holidays  enable row level security;
alter table public.domain_events    enable row level security;
alter table public.notifications    enable row level security;
alter table public.audit_log        enable row level security;
alter table public.login_attempts   enable row level security;

-- --- boutiques --------------------------------------------------------------
create policy "boutiques: lecture par les utilisateurs connectés"
  on public.boutiques for select to authenticated
  using (true);

create policy "boutiques: écriture réservée à la direction"
  on public.boutiques for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- --- contract_types ---------------------------------------------------------
create policy "contrats: lecture par les utilisateurs connectés"
  on public.contract_types for select to authenticated
  using (true);

create policy "contrats: écriture réservée à la direction"
  on public.contract_types for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- --- user_roles -------------------------------------------------------------
create policy "rôles: chacun voit les siens"
  on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()));

create policy "rôles: la direction voit et gère tout"
  on public.user_roles for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- --- settings ---------------------------------------------------------------
create policy "réglages: lecture par les utilisateurs connectés"
  on public.settings for select to authenticated
  using (true);

create policy "réglages: écriture réservée à la direction"
  on public.settings for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- --- public_holidays --------------------------------------------------------
create policy "jours fériés: lecture par les utilisateurs connectés"
  on public.public_holidays for select to authenticated
  using (true);

create policy "jours fériés: écriture réservée à la direction"
  on public.public_holidays for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- --- domain_events ----------------------------------------------------------
-- Written only by security definer RPCs (Phase 3) and read by the dispatcher
-- through service_role. The direction may read it for troubleshooting.
create policy "événements: lecture par la direction"
  on public.domain_events for select to authenticated
  using ((select public.is_admin()));

-- --- notifications ----------------------------------------------------------
create policy "notifications: chacune voit les siennes"
  on public.notifications for select to authenticated
  using (recipient_user_id = (select auth.uid()));

-- Marking as read is the only client-side write. Column-level grants below
-- restrict the UPDATE to read_at, so no one can rewrite a notification's text.
create policy "notifications: marquer les siennes comme lues"
  on public.notifications for update to authenticated
  using (recipient_user_id = (select auth.uid()))
  with check (recipient_user_id = (select auth.uid()));

create policy "notifications: lecture par la direction"
  on public.notifications for select to authenticated
  using ((select public.is_admin()));

-- --- audit_log --------------------------------------------------------------
create policy "audit: lecture par la direction"
  on public.audit_log for select to authenticated
  using ((select public.is_admin()));

-- --- login_attempts ---------------------------------------------------------
create policy "connexions: lecture par la direction"
  on public.login_attempts for select to authenticated
  using ((select public.is_admin()));

-- =============================================================================
-- Grants
--
-- Explicit and minimal. `anon` is granted nothing anywhere: the pre-login
-- screens go through security definer RPCs added in Phase 2.
-- =============================================================================
revoke all on public.boutiques, public.contract_types, public.user_roles,
              public.settings, public.public_holidays, public.domain_events,
              public.notifications, public.audit_log, public.login_attempts
  from anon, authenticated;

grant select on public.boutiques, public.contract_types, public.settings,
                public.public_holidays
  to authenticated;

-- Reference data is maintained by the direction from /admin/parametres.
grant insert, update, delete on public.boutiques, public.contract_types,
                                public.settings, public.public_holidays
  to authenticated;

grant select on public.user_roles, public.domain_events, public.audit_log,
                public.login_attempts
  to authenticated;
grant insert, update, delete on public.user_roles to authenticated;

grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

grant all on public.boutiques, public.contract_types, public.user_roles,
             public.settings, public.public_holidays, public.domain_events,
             public.notifications, public.audit_log, public.login_attempts
  to service_role;

-- =============================================================================
-- Realtime — the notification bell subscribes to inserts on notifications.
-- =============================================================================
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;
