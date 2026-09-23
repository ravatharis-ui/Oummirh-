-- Minimal emulation of the objects a hosted Supabase project already provides,
-- so that migrations can be applied and RLS exercised against a plain Postgres.
create schema if not exists extensions;
create schema if not exists auth;

do $$
begin
  if not exists (select 1 from pg_roles where rolname='anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end;
$$;

grant usage on schema public     to anon, authenticated, service_role;
grant usage on schema extensions to anon, authenticated, service_role;
grant usage on schema auth       to anon, authenticated, service_role;

create table auth.users (
  id         uuid primary key default gen_random_uuid(),
  email      text unique,
  created_at timestamptz not null default now()
);

create or replace function auth.uid() returns uuid
language sql stable as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid;
$$;

create or replace function auth.role() returns text
language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role';
$$;

grant execute on all functions in schema auth to anon, authenticated, service_role;

-- Supabase grants execute on every new function in `public` to the API roles.
-- Reproducing it here is what makes this harness able to catch an over-permissive
-- function: without it, a `revoke ... from public` looks sufficient when it is not.
alter default privileges for role postgres in schema public
  grant all on functions to anon, authenticated, service_role;

-- Et sur les tables — **vues comprises**, que PostgreSQL range dans la même
-- catégorie. C'est ce que fait réellement Supabase, et ne pas l'imiter a coûté
-- une exécution de l'audit sur le projet : `effective_time_clocks` et
-- `daily_worked_time` étaient écrivables depuis un navigateur là-bas, et pas
-- ici. Le banc d'essai doit être au moins aussi permissif que la plateforme,
-- sinon il valide des migrations qui ne referment rien.
alter default privileges for role postgres in schema public
  grant all on tables to anon, authenticated, service_role;

-- Storage. Only what a migration touches: the bucket registry, the object table
-- the policies are written against, and the folder helper Supabase ships.
create schema if not exists storage;
grant usage on schema storage to anon, authenticated, service_role;

create table storage.buckets (
  id         text primary key,
  name       text not null,
  public     boolean not null default false,
  created_at timestamptz not null default now()
);

create table storage.objects (
  id         uuid primary key default gen_random_uuid(),
  bucket_id  text not null references storage.buckets (id),
  name       text not null,
  owner      uuid,
  metadata   jsonb,
  created_at timestamptz not null default now(),
  unique (bucket_id, name)
);

alter table storage.objects enable row level security;

create or replace function storage.foldername(name text)
returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1 : array_length(string_to_array(name, '/'), 1) - 1];
$$;

grant all on storage.buckets, storage.objects to service_role;
grant select, insert, update, delete on storage.objects to authenticated;
grant select on storage.buckets to authenticated;
grant execute on all functions in schema storage to anon, authenticated, service_role;

-- Supabase refuses any SQL DELETE on its storage tables: removing the row without
-- removing the file would leave an orphaned byte that nothing references any more,
-- so nothing could ever delete it. Reproduced here because a retention purge that
-- deletes in SQL passes every offline check and then fails on the real project.
create or replace function storage.protect_delete()
returns trigger language plpgsql as $$
begin
  -- Same SQLSTATE as the hosted project: 42501, insufficient_privilege. An
  -- emulation that raises a different code makes a test pass here and fail there,
  -- which is worse than no emulation at all.
  raise exception 'Direct deletion from storage tables is not allowed. Use the Storage API instead.'
    using errcode = '42501',
          hint = 'This prevents accidental data loss from orphaned objects.';
end;
$$;

create trigger protect_delete_objects
  before delete on storage.objects
  for each row execute function storage.protect_delete();
