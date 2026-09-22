-- =============================================================================
-- 20260924080000_conges_schema — congés payés
--
-- Le solde de congés n'est **jamais** un nombre stocké quelque part qu'on
-- modifierait. C'est la somme de mouvements horodatés : acquisition mensuelle,
-- congé pris, report de période, ajustement de la direction. Un solde faux se
-- corrige alors en ajoutant une ligne qui dit pourquoi, jamais en réécrivant un
-- chiffre — et l'historique reste lisible un an plus tard, quand il faut
-- expliquer à quelqu'un d'où vient son solde.
--
-- Période de référence : 1er juin → 31 mai, configurable dans
-- `settings.leave_rules`.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Les règles, lues une fois, avec des valeurs de repli.
--
-- Comme `getSettings()` côté application : une base qui ne répond pas ou une
-- ligne malformée ne doit pas empêcher quelqu'un de poser ses congés.
-- -----------------------------------------------------------------------------
create or replace function public.leave_rules()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select s.value from public.settings s where s.key = 'leave_rules'),
    '{}'::jsonb
  ) || '{}'::jsonb;
$$;

revoke all on function public.leave_rules() from public, anon, authenticated;
grant execute on function public.leave_rules() to service_role;

-- Le 1er juin qui ouvre la période contenant `p_date`.
create or replace function public.leave_period_start(p_date date default null)
returns date
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_rules jsonb := public.leave_rules();
  v_month integer := coalesce((v_rules ->> 'period_start_month')::integer, 6);
  v_day   integer := coalesce((v_rules ->> 'period_start_day')::integer, 1);
  v_date  date := coalesce(p_date, public.reunion_today());
  v_start date;
begin
  v_start := make_date(extract(year from v_date)::integer, v_month, v_day);
  if v_date < v_start then
    v_start := v_start - interval '1 year';
  end if;
  return v_start;
end;
$$;

comment on function public.leave_period_start(date) is
  'Début de la période de référence (1er juin par défaut) contenant la date donnée.';

revoke all on function public.leave_period_start(date) from public, anon;
grant execute on function public.leave_period_start(date) to authenticated, service_role;

-- =============================================================================
-- leave_ledger — le solde, et rien d'autre
-- =============================================================================
create table public.leave_ledger (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid not null references public.employees (id) on delete cascade,

  kind         text not null check (
    kind in ('accrual', 'taken', 'adjustment', 'carry_over', 'expiry')
  ),

  -- Positif pour un crédit, négatif pour un débit. Jamais de valeur absolue :
  -- le signe porte le sens, et la somme est le solde.
  days         numeric(6, 2) not null,

  period_start date not null,
  occurred_on  date not null,
  source_ref   uuid,
  note         text,
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now()
);

-- Une acquisition par collaboratrice et par mois, quoi qu'il arrive. La tâche
-- planifiée peut être rejouée, relancée à la main, ou tourner deux fois : elle
-- ne créditera jamais deux fois le même mois.
create unique index leave_ledger_accrual_once
  on public.leave_ledger (employee_id, occurred_on) where kind = 'accrual';

create unique index leave_ledger_carry_over_once
  on public.leave_ledger (employee_id, period_start) where kind = 'carry_over';

-- Même raison : la clôture est appelée par une tâche quotidienne, et une
-- expiration écrite deux fois retirerait deux fois le même solde.
create unique index leave_ledger_expiry_once
  on public.leave_ledger (employee_id, period_start) where kind = 'expiry';

create index leave_ledger_employee_idx
  on public.leave_ledger (employee_id, period_start, occurred_on);

comment on table public.leave_ledger is
  'Mouvements de congés. Le solde est leur somme, jamais un nombre modifiable.';

-- =============================================================================
-- leave_requests
-- =============================================================================
create table public.leave_requests (
  id                 uuid primary key default gen_random_uuid(),
  employee_id        uuid not null references public.employees (id) on delete cascade,

  start_date         date not null,
  end_date           date not null,

  -- NULL = journée entière. `pm` sur le premier jour = elle part l'après-midi ;
  -- `am` sur le dernier = elle revient l'après-midi.
  start_half         text check (start_half in ('am', 'pm')),
  end_half           text check (end_half in ('am', 'pm')),

  -- Décompte au moment de la demande, recalculé à la validation.
  days               numeric(6, 2) not null check (days > 0),

  status             text not null default 'pending' check (
    status in ('pending', 'approved', 'refused', 'cancelled')
  ),

  reason             text,
  justification_path text,
  admin_comment      text,

  decided_by         uuid references auth.users (id) on delete set null,
  decided_at         timestamptz,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint leave_requests_order check (end_date >= start_date)
);

create index leave_requests_employee_idx
  on public.leave_requests (employee_id, start_date desc);
create index leave_requests_pending_idx
  on public.leave_requests (status, start_date) where status = 'pending';

create trigger leave_requests_set_updated_at
  before update on public.leave_requests
  for each row execute function public.set_updated_at();

comment on table public.leave_requests is 'Demandes de congés, de la demande à la décision.';

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.leave_ledger enable row level security;
alter table public.leave_requests enable row level security;

create policy "congés: chacune voit ses mouvements"
  on public.leave_ledger for select to authenticated
  using (employee_id = (select public.current_employee_id()));

create policy "congés: la direction voit tous les mouvements"
  on public.leave_ledger for select to authenticated
  using ((select public.is_admin()));

create policy "congés: chacune voit ses demandes"
  on public.leave_requests for select to authenticated
  using (employee_id = (select public.current_employee_id()));

create policy "congés: la direction voit toutes les demandes"
  on public.leave_requests for select to authenticated
  using ((select public.is_admin()));

-- Aucune politique d'écriture, pour personne : un solde ne se modifie pas
-- depuis un navigateur. Tout passe par les fonctions ci-dessous.
revoke all on public.leave_ledger, public.leave_requests from anon, authenticated;
grant select on public.leave_ledger, public.leave_requests to authenticated;
grant all on public.leave_ledger, public.leave_requests to service_role;

-- =============================================================================
-- Le décompte — la seule autorité
--
-- Ne comptent pas : les jours hors semaine de travail (samedi inclus en mode
-- `ouvrables`, exclu en mode `ouvres`), les jours fériés de La Réunion — dont le
-- 20 décembre —, et les journées déjà planifiées comme repos ou comme école.
-- Poser un congé sur son jour de repos ne doit rien coûter.
-- =============================================================================
create or replace function public.count_leave_days(
  p_employee_id uuid,
  p_from        date,
  p_to          date,
  p_start_half  text default null,
  p_end_half    text default null
)
returns numeric
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_mode     text := coalesce(public.leave_rules() ->> 'mode', 'ouvrables');
  v_last_day integer := case when v_mode = 'ouvres' then 5 else 6 end;
  v_total    numeric := 0;
  v_first_counts boolean := false;
  v_last_counts  boolean := false;
begin
  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'Période invalide.' using errcode = '22023';
  end if;

  select count(*)::numeric into v_total
    from generate_series(p_from, p_to, interval '1 day') as d(day)
   where extract(isodow from d.day) <= v_last_day
     and not exists (
       select 1 from public.public_holidays h where h.date = d.day::date
     )
     and not exists (
       select 1 from public.planning_entries p
        where p.employee_id = p_employee_id
          and p.date = d.day::date
          and p.status in ('rest', 'school')
     );

  if v_total = 0 then
    return 0;
  end if;

  -- Les demi-journées ne s'appliquent qu'à un jour qui comptait déjà.
  select count(*) > 0 into v_first_counts
    from generate_series(p_from, p_from, interval '1 day') as d(day)
   where extract(isodow from d.day) <= v_last_day
     and not exists (select 1 from public.public_holidays h where h.date = d.day::date)
     and not exists (
       select 1 from public.planning_entries p
        where p.employee_id = p_employee_id and p.date = d.day::date
          and p.status in ('rest', 'school')
     );

  select count(*) > 0 into v_last_counts
    from generate_series(p_to, p_to, interval '1 day') as d(day)
   where extract(isodow from d.day) <= v_last_day
     and not exists (select 1 from public.public_holidays h where h.date = d.day::date)
     and not exists (
       select 1 from public.planning_entries p
        where p.employee_id = p_employee_id and p.date = d.day::date
          and p.status in ('rest', 'school')
     );

  -- Un seul jour, une seule demi-journée : le maximum retiré est 0,5.
  if p_from = p_to then
    if (p_start_half is not null or p_end_half is not null) and v_first_counts then
      v_total := v_total - 0.5;
    end if;
    return greatest(v_total, 0);
  end if;

  if p_start_half = 'pm' and v_first_counts then
    v_total := v_total - 0.5;
  end if;

  if p_end_half = 'am' and v_last_counts then
    v_total := v_total - 0.5;
  end if;

  return greatest(v_total, 0);
end;
$$;

comment on function public.count_leave_days(uuid, date, date, text, text) is
  'Décompte officiel d''une période de congés. Exclut week-ends selon le mode, jours fériés et jours de repos ou d''école planifiés.';

revoke all on function public.count_leave_days(uuid, date, date, text, text) from public, anon;
grant execute on function public.count_leave_days(uuid, date, date, text, text)
  to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Le solde : une somme, rien de plus.
-- -----------------------------------------------------------------------------
create or replace function public.leave_balance(
  p_employee_id uuid default null,
  p_period_start date default null
)
returns numeric
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_employee uuid := coalesce(p_employee_id, public.current_employee_id());
  v_period   date := coalesce(p_period_start, public.leave_period_start(null));
begin
  if v_employee is null then
    return 0;
  end if;

  -- Une collaboratrice ne consulte que son propre solde ; la direction, tous.
  -- Sans session (`auth.uid()` nul), l'appelant est le serveur lui-même — la
  -- tâche planifiée, un test — et la question ne se pose pas.
  if (select auth.uid()) is not null
     and v_employee is distinct from public.current_employee_id()
     and not public.is_admin() then
    raise exception 'Solde non consultable.' using errcode = '42501';
  end if;

  return coalesce(
    (select sum(l.days) from public.leave_ledger l
      where l.employee_id = v_employee and l.period_start = v_period),
    0
  );
end;
$$;

comment on function public.leave_balance(uuid, date) is
  'Solde de congés d''une période : la somme des mouvements, jamais un nombre stocké.';

revoke all on function public.leave_balance(uuid, date) from public, anon;
grant execute on function public.leave_balance(uuid, date) to authenticated, service_role;
