-- =============================================================================
-- 20260922120000_employees_auth — collaboratrices et authentification par PIN
--
-- Security model:
--   * `pin_hash` is granted to NO ONE. Only the `security definer` functions
--     below ever read it, so a compromised session cannot exfiltrate hashes.
--   * The pre-login screens (boutique list, first names) go through two
--     `security definer` functions callable by `anon`, exposing the strict
--     minimum: no surname, no email, no phone.
--   * PIN verification is `service_role` only: the browser can never call it.
--   * Lockout, hashing and attempt logging all happen inside one transaction,
--     so a race cannot buy extra attempts.
-- =============================================================================

create table public.employees (
  id                    uuid primary key default gen_random_uuid(),
  auth_user_id          uuid unique references auth.users (id) on delete restrict,

  last_name             text not null,
  first_name            text not null,
  -- What the collaboratrice sees on the login tiles. First name by default.
  display_name          text not null,

  boutique_id           uuid not null references public.boutiques (id),
  contract_type_id      uuid not null references public.contract_types (id),

  email                 text,
  phone                 text,

  -- bcrypt, never the PIN itself. Never granted to any role.
  pin_hash              text not null,

  weekly_contract_hours numeric(5, 2) check (weekly_contract_hours > 0),

  default_start         time not null default '09:00',
  default_end           time not null default '17:30',
  default_break_start   time,
  default_break_end     time,

  -- ISO weekdays: 1 = lundi … 7 = dimanche.
  work_days             integer[] not null default '{1,2,3,4,5,6}',

  hire_date             date,
  end_date              date,
  is_active             boolean not null default true,
  avatar_path           text,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint employees_schedule_order check (default_end > default_start),
  constraint employees_break_order check (
    (default_break_start is null and default_break_end is null)
    or (default_break_start is not null and default_break_end is not null
        and default_break_end > default_break_start)
  ),
  constraint employees_end_after_hire check (end_date is null or hire_date is null or end_date >= hire_date),
  constraint employees_work_days_valid check (
    work_days <@ array[1, 2, 3, 4, 5, 6, 7] and array_length(work_days, 1) between 1 and 7
  )
);

create index employees_boutique_idx on public.employees (boutique_id) where is_active;
create index employees_auth_user_idx on public.employees (auth_user_id);

create trigger employees_set_updated_at
  before update on public.employees
  for each row execute function public.set_updated_at();

comment on table public.employees is 'Collaboratrices d''Oummi Dressing.';
comment on column public.employees.pin_hash is
  'Hachage bcrypt du code PIN. Aucun rôle n''a le droit de lire cette colonne.';

-- The Phase 1 table could not reference employees yet.
alter table public.login_attempts
  add constraint login_attempts_employee_fkey
  foreign key (employee_id) references public.employees (id) on delete cascade;

-- =============================================================================
-- Helpers
-- =============================================================================

-- Used by every later module's RLS policies to scope rows to the caller.
create or replace function public.current_employee_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select e.id
  from public.employees e
  where e.auth_user_id = (select auth.uid())
    and e.is_active;
$$;

comment on function public.current_employee_id() is
  'Identifiant de la collaboratrice connectée, ou NULL.';

revoke all on function public.current_employee_id() from public;
grant execute on function public.current_employee_id() to authenticated, service_role;

-- A PIN must be exactly four digits. Trivial codes are rejected here as well as
-- in the generator, so a hand-typed reset cannot weaken an account.
create or replace function public.is_acceptable_pin(p_pin text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_pin ~ '^[0-9]{4}$'
     and p_pin not in ('0000','1111','2222','3333','4444','5555','6666','7777','8888','9999',
                       '1234','2345','3456','4567','5678','6789','0123',
                       '9876','8765','7654','6543','5432','4321','3210',
                       '1122','2211','1212','2121','1010','0101');
$$;

comment on function public.is_acceptable_pin(text) is
  'Rejette les PIN non numériques et les suites triviales.';

-- =============================================================================
-- Pre-login lookups — callable by `anon`, minimal columns only.
-- =============================================================================

create or replace function public.login_boutiques()
returns table (id uuid, code text, name text)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, b.code, b.name
  from public.boutiques b
  where b.is_active
    and exists (
      select 1 from public.employees e
      where e.boutique_id = b.id and e.is_active and e.auth_user_id is not null
    )
  order by b.sort_order, b.name;
$$;

comment on function public.login_boutiques() is
  'Points de vente proposés sur l''écran de connexion.';

create or replace function public.login_employees(p_boutique_id uuid)
returns table (id uuid, display_name text, avatar_path text)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.display_name, e.avatar_path
  from public.employees e
  where e.boutique_id = p_boutique_id
    and e.is_active
    and e.auth_user_id is not null
  order by e.display_name;
$$;

comment on function public.login_employees(uuid) is
  'Prénoms proposés pour une boutique. N''expose ni nom, ni email, ni téléphone.';

-- Used when the phone already remembers who signed in last: the cookie holds an
-- employee id but not her boutique, so the tile cannot be rebuilt from the list.
create or replace function public.login_employee(p_employee_id uuid)
returns table (id uuid, display_name text, avatar_path text, boutique_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.display_name, e.avatar_path, e.boutique_id
  from public.employees e
  where e.id = p_employee_id
    and e.is_active
    and e.auth_user_id is not null;
$$;

comment on function public.login_employee(uuid) is
  'Une collaboratrice par identifiant, pour l''écran de connexion mémorisé.';

revoke all on function public.login_employee(uuid) from public;
grant execute on function public.login_employee(uuid) to anon, authenticated, service_role;

revoke all on function public.login_boutiques() from public;
revoke all on function public.login_employees(uuid) from public;
grant execute on function public.login_boutiques() to anon, authenticated, service_role;
grant execute on function public.login_employees(uuid) to anon, authenticated, service_role;

-- =============================================================================
-- PIN verification — service_role only.
-- =============================================================================

create or replace function public.verify_employee_pin(
  p_employee_id uuid,
  p_pin text,
  p_ip inet default null
)
returns table (
  status        text,   -- 'ok' | 'invalid_pin' | 'locked' | 'unknown_employee'
  auth_user_id  uuid,
  -- The technical address of the auth account ({employee_id}@staff.oummi.invalid),
  -- needed to open the session. NOT employees.email, which is the optional real
  -- address used for notifications and may well be empty.
  auth_email    text,
  locked_until  timestamptz,
  attempts_left integer
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_max_attempts constant integer := 5;
  v_window       constant interval := interval '15 minutes';
  v_employee     public.employees%rowtype;
  v_auth_email   text;
  v_last_success timestamptz;
  v_failures     integer;
  v_oldest_fail  timestamptz;
  v_matches      boolean;
begin
  select * into v_employee
  from public.employees e
  where e.id = p_employee_id and e.is_active and e.auth_user_id is not null;

  if not found then
    return query select 'unknown_employee'::text, null::uuid, null::text, null::timestamptz, null::integer;
    return;
  end if;

  -- Failures are counted since the last success, inside the sliding window, so a
  -- correct PIN clears the slate and old failures age out on their own.
  select max(la.created_at) into v_last_success
  from public.login_attempts la
  where la.employee_id = p_employee_id and la.success;

  select count(*), min(la.created_at) into v_failures, v_oldest_fail
  from public.login_attempts la
  where la.employee_id = p_employee_id
    and not la.success
    and la.created_at > now() - v_window
    -- `>=` and not `>`: two attempts can share a timestamp, and counting one
    -- failure too many is far safer than letting one slip past the lockout.
    and la.created_at >= coalesce(v_last_success, '-infinity'::timestamptz);

  if v_failures >= v_max_attempts then
    return query select 'locked'::text, null::uuid, null::text, v_oldest_fail + v_window, 0;
    return;
  end if;

  select u.email into v_auth_email from auth.users u where u.id = v_employee.auth_user_id;

  v_matches := v_employee.pin_hash = extensions.crypt(p_pin, v_employee.pin_hash);

  insert into public.login_attempts (employee_id, success, ip)
  values (p_employee_id, v_matches, p_ip);

  if v_matches then
    return query select 'ok'::text, v_employee.auth_user_id, v_auth_email,
                        null::timestamptz, v_max_attempts;
  else
    return query select 'invalid_pin'::text, null::uuid, null::text, null::timestamptz,
                        v_max_attempts - v_failures - 1;
  end if;
end;
$$;

comment on function public.verify_employee_pin(uuid, text, inet) is
  'Vérifie un PIN, journalise la tentative et applique le verrouillage. service_role uniquement.';

revoke all on function public.verify_employee_pin(uuid, text, inet) from public;
grant execute on function public.verify_employee_pin(uuid, text, inet) to service_role;

-- =============================================================================
-- PIN reset — direction only, traced.
-- =============================================================================

create or replace function public.reset_employee_pin(p_employee_id uuid, p_new_pin text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_display text;
begin
  if not public.is_admin() then
    raise exception 'Seule la direction peut réinitialiser un code PIN.'
      using errcode = '42501';
  end if;

  if not public.is_acceptable_pin(p_new_pin) then
    raise exception 'Code PIN refusé : il doit comporter 4 chiffres et ne pas être une suite évidente.'
      using errcode = '22023';
  end if;

  update public.employees
     set pin_hash = extensions.crypt(p_new_pin, extensions.gen_salt('bf'))
   where id = p_employee_id and is_active
  returning display_name into v_display;

  if v_display is null then
    raise exception 'Collaboratrice introuvable ou archivée.' using errcode = 'P0002';
  end if;

  -- The PIN itself is never written to the audit trail.
  insert into public.audit_log (actor_id, action, entity, entity_id, after)
  values ((select auth.uid()), 'pin.reset', 'employees', p_employee_id,
          jsonb_build_object('display_name', v_display));

  -- A reset clears the lockout so the collaboratrice can use her new code at once.
  delete from public.login_attempts where employee_id = p_employee_id and not success;
end;
$$;

comment on function public.reset_employee_pin(uuid, text) is
  'Remplace le PIN d''une collaboratrice. Trace dans audit_log, jamais le PIN lui-même.';

revoke all on function public.reset_employee_pin(uuid, text) from public;
grant execute on function public.reset_employee_pin(uuid, text) to authenticated, service_role;

-- =============================================================================
-- Creation — direction only.
--
-- A plain INSERT cannot work: `pin_hash` is granted to no one, on purpose. This
-- function is the only way in, so every collaboratrice is created with a hashed
-- code and a trace in the audit log.
-- =============================================================================

create or replace function public.admin_create_employee(
  p_auth_user_id          uuid,
  p_last_name             text,
  p_first_name            text,
  p_display_name          text,
  p_boutique_id           uuid,
  p_contract_type_id      uuid,
  p_pin                   text,
  p_email                 text default null,
  p_phone                 text default null,
  p_weekly_contract_hours numeric default null,
  p_default_start         time default '09:00',
  p_default_end           time default '17:30',
  p_default_break_start   time default '12:30',
  p_default_break_end     time default '14:00',
  p_work_days             integer[] default '{1,2,3,4,5,6}',
  p_hire_date             date default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Seule la direction peut créer une collaboratrice.' using errcode = '42501';
  end if;

  if not public.is_acceptable_pin(p_pin) then
    raise exception 'Code PIN refusé : il doit comporter 4 chiffres et ne pas être une suite évidente.'
      using errcode = '22023';
  end if;

  insert into public.employees (
    auth_user_id, last_name, first_name, display_name, boutique_id, contract_type_id,
    pin_hash, email, phone, weekly_contract_hours, default_start, default_end,
    default_break_start, default_break_end, work_days, hire_date
  ) values (
    p_auth_user_id, p_last_name, p_first_name, p_display_name, p_boutique_id, p_contract_type_id,
    extensions.crypt(p_pin, extensions.gen_salt('bf')), p_email, p_phone, p_weekly_contract_hours,
    p_default_start, p_default_end, p_default_break_start, p_default_break_end,
    p_work_days, p_hire_date
  )
  returning id into v_id;

  -- Granting the role here, in the same transaction, means a collaboratrice can
  -- never exist without the role that lets her sign in.
  if p_auth_user_id is not null then
    insert into public.user_roles (user_id, role, boutique_id)
    values (p_auth_user_id, 'employee', null)
    on conflict do nothing;
  end if;

  -- The code itself is never written to the trail.
  insert into public.audit_log (actor_id, action, entity, entity_id, after)
  values ((select auth.uid()), 'employee.created', 'employees', v_id,
          jsonb_build_object('display_name', p_display_name, 'boutique_id', p_boutique_id));

  return v_id;
end;
$$;

comment on function public.admin_create_employee is
  'Crée une collaboratrice avec un PIN haché. Seule voie possible, car pin_hash n''est accessible à personne.';

revoke all on function public.admin_create_employee from public;
grant execute on function public.admin_create_employee to authenticated, service_role;

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.employees enable row level security;

create policy "collaboratrices: chacune voit sa fiche"
  on public.employees for select to authenticated
  using (auth_user_id = (select auth.uid()));

create policy "collaboratrices: la direction voit et gère tout"
  on public.employees for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- `pin_hash` is deliberately absent from every grant below: no session, admin
-- included, can read a hash. Only the security definer functions above can.
revoke all on public.employees from anon, authenticated;

grant select (
  id, auth_user_id, last_name, first_name, display_name, boutique_id,
  contract_type_id, email, phone, weekly_contract_hours, default_start,
  default_end, default_break_start, default_break_end, work_days, hire_date,
  end_date, is_active, avatar_path, created_at, updated_at
) on public.employees to authenticated;

grant insert (
  auth_user_id, last_name, first_name, display_name, boutique_id,
  contract_type_id, email, phone, weekly_contract_hours, default_start,
  default_end, default_break_start, default_break_end, work_days, hire_date,
  end_date, is_active, avatar_path
) on public.employees to authenticated;

grant update (
  last_name, first_name, display_name, boutique_id, contract_type_id, email,
  phone, weekly_contract_hours, default_start, default_end, default_break_start,
  default_break_end, work_days, hire_date, end_date, is_active, avatar_path
) on public.employees to authenticated;

grant all on public.employees to service_role;
