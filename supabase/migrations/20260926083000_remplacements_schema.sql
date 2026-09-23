-- =============================================================================
-- 20260926083000_remplacements_schema — « + Remplacement direct »
--
-- Une boutique manque de bras un jour donné : la direction envoie quelqu'un.
-- C'est la fonctionnalité la plus simple de l'application et celle qui sert le
-- plus souvent — d'où le bouton en trois étapes, et d'où le soin mis à ce que
-- l'annulation rende exactement ce qu'elle a pris.
-- =============================================================================

create table public.direct_replacements (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid not null references public.employees (id) on delete cascade,

  -- Où elle est attendue ce jour-là. Souvent pas sa boutique habituelle : c'est
  -- tout l'objet du remplacement.
  boutique_id  uuid not null references public.boutiques (id),

  date         date not null,
  start_time   time not null,
  end_time     time not null,
  break_start  time,
  break_end    time,
  note         text,

  status       text not null default 'active' check (status in ('active', 'cancelled')),

  created_by   uuid references auth.users (id) on delete set null,
  cancelled_by uuid references auth.users (id) on delete set null,
  cancelled_at timestamptz,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint direct_replacements_order check (end_time > start_time),
  constraint direct_replacements_break_order check (
    (break_start is null and break_end is null)
    or (break_start is not null and break_end is not null and break_end > break_start)
  )
);

-- Une seule affectation vivante par collaboratrice et par jour. Deux boutiques
-- ne peuvent pas l'attendre le même matin.
create unique index direct_replacements_one_live_per_day
  on public.direct_replacements (employee_id, date) where status = 'active';

create index direct_replacements_day_idx on public.direct_replacements (date, boutique_id);

create trigger direct_replacements_set_updated_at
  before update on public.direct_replacements
  for each row execute function public.set_updated_at();

comment on table public.direct_replacements is
  'Renforts ponctuels décidés par la direction. L''annulation restaure le planning d''origine.';

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.direct_replacements enable row level security;

create policy "remplacements: chacune voit les siens"
  on public.direct_replacements for select to authenticated
  using (employee_id = (select public.current_employee_id()));

create policy "remplacements: la direction voit tout"
  on public.direct_replacements for select to authenticated
  using ((select public.is_admin()));

revoke all on public.direct_replacements from anon, authenticated;
grant select on public.direct_replacements to authenticated;
grant all on public.direct_replacements to service_role;

-- =============================================================================
-- Qui est disponible ce jour-là
--
-- La deuxième étape du formulaire. Elle ne filtre pas la liste : elle la
-- qualifie. « Déjà à Saint-Pierre ce jour-là » n'est pas un refus — c'est
-- parfois exactement la personne à déplacer — alors qu'un congé en est un.
-- Réservée à la direction, qui est la seule à avoir besoin de savoir pourquoi
-- quelqu'un n'est pas disponible.
-- =============================================================================
create or replace function public.admin_replacement_candidates(
  p_date        date,
  p_boutique_id uuid default null
)
returns table (
  employee_id     uuid,
  display_name    text,
  home_boutique   text,
  availability    text,
  planned_status  text,
  planned_start   time,
  planned_end     time,
  planned_shop    text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Réservé à la direction.' using errcode = '42501';
  end if;

  return query
  select e.id,
         e.display_name,
         home.name,
         case
           when p.status in ('leave', 'sick', 'school') then 'unavailable'
           when p.status in ('work', 'replacement')
                and (p_boutique_id is null or p.boutique_id is distinct from p_boutique_id)
             then 'working_elsewhere'
           when p.status in ('work', 'replacement') then 'working_here'
           else 'free'
         end,
         p.status,
         p.start_time,
         p.end_time,
         shop.name
    from public.employees e
    join public.boutiques home on home.id = e.boutique_id
    left join public.planning_entries p on p.employee_id = e.id and p.date = p_date
    left join public.boutiques shop on shop.id = p.boutique_id
   where e.is_active
   order by
     case
       when p.status in ('leave', 'sick', 'school') then 3
       when p.status in ('work', 'replacement') then 2
       else 1
     end,
     e.display_name;
end;
$$;

comment on function public.admin_replacement_candidates(date, uuid) is
  'Qualifie chaque collaboratrice pour une date : libre, déjà en poste, ou indisponible.';

revoke all on function public.admin_replacement_candidates(date, uuid) from public, anon;
grant execute on function public.admin_replacement_candidates(date, uuid)
  to authenticated, service_role;

-- =============================================================================
-- Créer un remplacement
-- =============================================================================
create or replace function public.admin_create_replacement(
  p_employee_id uuid,
  p_boutique_id uuid,
  p_date        date,
  p_start_time  time,
  p_end_time    time,
  p_break_start time default null,
  p_break_end   time default null,
  p_note        text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id      uuid;
  v_status  text;
  v_active  boolean;
begin
  if not public.is_admin() then
    raise exception 'Seule la direction organise un remplacement.' using errcode = '42501';
  end if;

  if p_date < public.reunion_today() then
    raise exception 'On n''organise pas un remplacement pour une date déjà passée.'
      using errcode = '22023';
  end if;

  select e.is_active into v_active from public.employees e where e.id = p_employee_id;
  if not coalesce(v_active, false) then
    raise exception 'Collaboratrice introuvable ou inactive.' using errcode = '23503';
  end if;

  -- Un congé validé ou un jour d'école ne se contourne pas par un remplacement :
  -- il faut d'abord annuler le congé, ce qui est une décision, pas un effet de bord.
  select p.status into v_status
    from public.planning_entries p
   where p.employee_id = p_employee_id and p.date = p_date;

  if v_status in ('leave', 'sick', 'school') then
    raise exception 'Cette collaboratrice n''est pas disponible ce jour-là (%).', v_status
      using errcode = '22023';
  end if;

  if exists (
    select 1 from public.direct_replacements r
     where r.employee_id = p_employee_id and r.date = p_date and r.status = 'active'
  ) then
    raise exception 'Elle a déjà un remplacement ce jour-là.' using errcode = '23505';
  end if;

  insert into public.direct_replacements (
    employee_id, boutique_id, date, start_time, end_time,
    break_start, break_end, note, created_by
  ) values (
    p_employee_id, p_boutique_id, p_date, p_start_time, p_end_time,
    p_break_start, p_break_end, p_note, (select auth.uid())
  )
  returning id into v_id;

  insert into public.audit_log (actor_id, action, entity, entity_id, after)
  values ((select auth.uid()), 'remplacement.created', 'direct_replacements', v_id,
          jsonb_build_object('employee_id', p_employee_id, 'boutique_id', p_boutique_id,
                             'date', p_date, 'start_time', p_start_time, 'end_time', p_end_time));

  perform public.emit_event(
    'remplacements.created',
    jsonb_build_object(
      'id', v_id, 'employee_id', p_employee_id, 'boutique_id', p_boutique_id,
      'start_date', p_date, 'end_date', p_date,
      'start_time', p_start_time, 'end_time', p_end_time,
      'break_start', p_break_start, 'break_end', p_break_end
    )
  );

  return v_id;
end;
$$;

revoke all on function public.admin_create_replacement from public, anon;
grant execute on function public.admin_create_replacement to authenticated, service_role;

-- =============================================================================
-- Annuler — et rendre au planning ce qu'on lui avait pris
-- =============================================================================
create or replace function public.admin_cancel_replacement(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_before public.direct_replacements;
begin
  if not public.is_admin() then
    raise exception 'Seule la direction annule un remplacement.' using errcode = '42501';
  end if;

  select * into v_before from public.direct_replacements where id = p_id for update;

  if v_before.id is null then
    raise exception 'Remplacement introuvable.' using errcode = '23503';
  end if;

  if v_before.status = 'cancelled' then
    return;
  end if;

  update public.direct_replacements
     set status = 'cancelled', cancelled_by = (select auth.uid()), cancelled_at = now()
   where id = p_id;

  insert into public.audit_log (actor_id, action, entity, entity_id, before, after)
  values ((select auth.uid()), 'remplacement.cancelled', 'direct_replacements', p_id,
          to_jsonb(v_before), jsonb_build_object('status', 'cancelled'));

  perform public.emit_event(
    'remplacements.cancelled',
    jsonb_build_object('id', p_id, 'employee_id', v_before.employee_id,
                       'boutique_id', v_before.boutique_id, 'start_date', v_before.date,
                       'end_date', v_before.date)
  );
end;
$$;

revoke all on function public.admin_cancel_replacement(uuid) from public, anon;
grant execute on function public.admin_cancel_replacement(uuid) to authenticated, service_role;

select public.revoke_anon_table_privileges();
