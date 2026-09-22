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
