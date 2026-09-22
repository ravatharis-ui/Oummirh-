-- =============================================================================
-- 20260923080000_planning_schema — plannings multi-boutiques
--
-- Une ligne par collaboratrice et par jour. La contrainte d'unicité est ce qui
-- garantit qu'un congé, un remplacement et une saisie manuelle ne peuvent pas
-- coexister sur la même journée : le dernier écrit gagne, et `source` dit qui.
-- =============================================================================

-- Today, in Réunion. Used everywhere a business rule depends on "today", and
-- never computed from the caller's clock.
create or replace function public.reunion_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Indian/Reunion')::date;
$$;

comment on function public.reunion_today() is
  'Date du jour à La Réunion. Jamais l''horloge de l''appelant.';

revoke all on function public.reunion_today() from public, anon;
grant execute on function public.reunion_today() to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- planning_entries
-- -----------------------------------------------------------------------------
create table public.planning_entries (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid not null references public.employees (id) on delete cascade,
  -- Where she works THAT day: a replacement sends her elsewhere for one day
  -- without touching her home boutique.
  boutique_id  uuid not null references public.boutiques (id),
  date         date not null,

  status       text not null check (
    status in ('work', 'rest', 'leave', 'school', 'replacement', 'sick', 'other')
  ),

  start_time   time,
  end_time     time,
  break_start  time,
  break_end    time,
  note         text,

  -- Who put this row here. A duplicated week must not overwrite an approved
  -- leave, and this column is how that is decided.
  source       text not null default 'manual' check (
    source in ('manual', 'template', 'leave', 'replacement', 'swap')
  ),
  source_ref   uuid,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint planning_entries_unique unique (employee_id, date),

  -- A working day needs hours; a day off must not carry any.
  constraint planning_entries_hours_match_status check (
    (status in ('work', 'replacement') and start_time is not null and end_time is not null)
    or (status not in ('work', 'replacement'))
  ),
  constraint planning_entries_order check (
    start_time is null or end_time is null or end_time > start_time
  ),
  constraint planning_entries_break_order check (
    (break_start is null and break_end is null)
    or (break_start is not null and break_end is not null and break_end > break_start)
  )
);

create index planning_entries_date_idx on public.planning_entries (date, boutique_id);
create index planning_entries_employee_date_idx on public.planning_entries (employee_id, date);

create trigger planning_entries_set_updated_at
  before update on public.planning_entries
  for each row execute function public.set_updated_at();

comment on table public.planning_entries is 'Planning : une ligne par collaboratrice et par jour.';
comment on column public.planning_entries.source is
  'Origine de la ligne. Une duplication de semaine ne réécrit jamais une ligne posée par un congé, un remplacement ou un échange.';

-- -----------------------------------------------------------------------------
-- planning_templates — semaine type, utile surtout pour les jours d'école fixes
-- -----------------------------------------------------------------------------
create table public.planning_templates (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid not null references public.employees (id) on delete cascade,
  -- ISO: 1 = lundi … 7 = dimanche.
  weekday      integer not null check (weekday between 1 and 7),

  status       text not null check (
    status in ('work', 'rest', 'leave', 'school', 'replacement', 'sick', 'other')
  ),
  start_time   time,
  end_time     time,
  break_start  time,
  break_end    time,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint planning_templates_unique unique (employee_id, weekday),
  constraint planning_templates_hours_match_status check (
    (status in ('work', 'replacement') and start_time is not null and end_time is not null)
    or (status not in ('work', 'replacement'))
  ),
  constraint planning_templates_order check (
    start_time is null or end_time is null or end_time > start_time
  )
);

create trigger planning_templates_set_updated_at
  before update on public.planning_templates
  for each row execute function public.set_updated_at();

comment on table public.planning_templates is
  'Semaine type par collaboratrice, par exemple les jours d''école d''une alternante.';

-- =============================================================================
-- Row Level Security
--
-- Une collaboratrice lit son propre planning, et rien d'autre. Savoir qui
-- travaille aujourd'hui dans sa boutique passe par une fonction dédiée qui ne
-- renvoie que les personnes présentes : le motif d'une absence, maladie comprise,
-- ne regarde pas les collègues.
-- =============================================================================
alter table public.planning_entries enable row level security;
alter table public.planning_templates enable row level security;

create policy "planning: chacune voit le sien"
  on public.planning_entries for select to authenticated
  using (employee_id = (select public.current_employee_id()));

create policy "planning: la direction voit et gère tout"
  on public.planning_entries for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "semaine type: chacune voit la sienne"
  on public.planning_templates for select to authenticated
  using (employee_id = (select public.current_employee_id()));

create policy "semaine type: la direction voit et gère tout"
  on public.planning_templates for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

revoke all on public.planning_entries, public.planning_templates from anon, authenticated;
grant select, insert, update, delete on public.planning_entries to authenticated;
grant select, insert, update, delete on public.planning_templates to authenticated;
grant all on public.planning_entries, public.planning_templates to service_role;

-- =============================================================================
-- Qui travaille avec moi aujourd'hui
-- =============================================================================
create or replace function public.my_boutique_presence(p_date date)
returns table (employee_id uuid, display_name text, start_time time, end_time time)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.display_name, p.start_time, p.end_time
  from public.planning_entries p
  join public.employees e on e.id = p.employee_id
  where p.date = p_date
    and p.status in ('work', 'replacement')
    and e.is_active
    -- Same boutique that day, which a replacement can change.
    and p.boutique_id = (
      select pe.boutique_id
      from public.planning_entries pe
      where pe.employee_id = (select public.current_employee_id())
        and pe.date = p_date
    )
  order by p.start_time, e.display_name;
$$;

comment on function public.my_boutique_presence(date) is
  'Collègues présentes le même jour dans la même boutique. N''expose aucun motif d''absence.';

revoke all on function public.my_boutique_presence(date) from public, anon;
grant execute on function public.my_boutique_presence(date) to authenticated, service_role;
