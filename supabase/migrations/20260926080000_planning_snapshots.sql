-- =============================================================================
-- 20260926080000_planning_snapshots — rendre ce qu'on a déplacé
--
-- Un manque révélé par la Phase 8 : quand un congé pose « Congé » sur une
-- journée, la journée de travail qui s'y trouvait est perdue. À l'annulation,
-- `clear_planning_from_event` efface la ligne de congé — et laisse un trou. La
-- collaboratrice se retrouve sans planning un jour où elle devait travailler,
-- et la direction doit le ressaisir de mémoire.
--
-- Le même défaut aurait frappé les remplacements, où l'annulation doit
-- « restaurer le planning initial » (PROMPT §6.5). La réponse vaut pour les
-- deux, et pour les échanges : avant d'écraser une journée, on garde ce qu'elle
-- contenait.
--
-- Deux subtilités qui décident de tout :
--   1. le cliché est pris `on conflict do nothing` — **rejouer** un événement ne
--      doit pas remplacer le cliché d'origine par la ligne déjà appliquée ;
--   2. on ne restaure que si la journée appartient **encore** à la demande qui
--      l'avait posée. Une saisie manuelle de la direction depuis est une
--      décision plus récente, et on ne défait pas une décision plus récente.
-- =============================================================================

create table public.planning_snapshots (
  source      text not null,
  source_ref  uuid not null,
  employee_id uuid not null references public.employees (id) on delete cascade,
  date        date not null,

  -- NULL signifie « il n'y avait rien ce jour-là », ce qui est une information
  -- aussi utile que le contraire : restaurer veut alors dire effacer.
  entry       jsonb,

  created_at  timestamptz not null default now(),

  primary key (source, source_ref, employee_id, date)
);

comment on table public.planning_snapshots is
  'Ce qu''une journée de planning contenait avant d''être écrasée par un congé, un remplacement ou un échange.';

alter table public.planning_snapshots enable row level security;

-- Personne ne lit cette table depuis une session : c'est de la mécanique
-- interne, qui ne s'affiche nulle part.
revoke all on public.planning_snapshots from anon, authenticated;
grant all on public.planning_snapshots to service_role;

-- -----------------------------------------------------------------------------
-- Poser des journées, en gardant ce qu'elles contenaient
-- -----------------------------------------------------------------------------
create or replace function public.apply_planning_from_event(
  p_employee_id uuid,
  p_from        date,
  p_to          date,
  p_status      text,
  p_source      text,
  p_source_ref  uuid,
  p_boutique_id uuid default null,
  p_start_time  time default null,
  p_end_time    time default null,
  p_break_start time default null,
  p_break_end   time default null
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_boutique uuid;
  v_count    integer;
  v_dates    date[];
begin
  if not (p_source = any (public.planning_protected_sources())) then
    raise exception 'Origine « % » réservée aux saisies de la direction.', p_source
      using errcode = '22023';
  end if;

  select coalesce(p_boutique_id, e.boutique_id),
         coalesce(p_start_time, e.default_start),
         coalesce(p_end_time, e.default_end)
    into v_boutique, p_start_time, p_end_time
    from public.employees e where e.id = p_employee_id;

  if v_boutique is null then
    raise exception 'Collaboratrice introuvable.' using errcode = '23503';
  end if;

  -- Le cliché, avant d'écrire. `do nothing` : un rejeu ne doit pas photographier
  -- la ligne que le premier passage a posée.
  insert into public.planning_snapshots (source, source_ref, employee_id, date, entry)
  select p_source, p_source_ref, p_employee_id, d.day::date,
         (select to_jsonb(pe) from public.planning_entries pe
           where pe.employee_id = p_employee_id and pe.date = d.day::date)
    from generate_series(p_from, p_to, interval '1 day') as d(day)
  on conflict do nothing;

  with days as (
    select generate_series(p_from, p_to, interval '1 day')::date as d
  ),
  written as (
    insert into public.planning_entries (
      employee_id, boutique_id, date, status,
      start_time, end_time, break_start, break_end, source, source_ref
    )
    select p_employee_id, v_boutique, days.d, p_status,
           case when p_status in ('work', 'replacement') then p_start_time end,
           case when p_status in ('work', 'replacement') then p_end_time end,
           case when p_status in ('work', 'replacement') then p_break_start end,
           case when p_status in ('work', 'replacement') then p_break_end end,
           p_source, p_source_ref
      from days
    on conflict (employee_id, date) do update set
      boutique_id = excluded.boutique_id,
      status      = excluded.status,
      start_time  = excluded.start_time,
      end_time    = excluded.end_time,
      break_start = excluded.break_start,
      break_end   = excluded.break_end,
      source      = excluded.source,
      source_ref  = excluded.source_ref
    returning planning_entries.date
  )
  select count(*)::integer, array_agg(w.date order by w.date)
    into v_count, v_dates
    from written w;

  if v_dates is not null then
    perform public.planning_announce(p_employee_id, v_dates);
  end if;

  return v_count;
end;
$$;

comment on function public.apply_planning_from_event is
  'Pose des journées pour le compte d''un autre module, en gardant un cliché de ce qu''elles contenaient. Idempotente.';

revoke all on function public.apply_planning_from_event from public, anon, authenticated;
grant execute on function public.apply_planning_from_event to service_role;

-- -----------------------------------------------------------------------------
-- Libérer des journées, en rendant ce qu'elles contenaient
-- -----------------------------------------------------------------------------
create or replace function public.clear_planning_from_event(p_source text, p_source_ref uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_count   integer := 0;
  v_snap    record;
  v_touched record;
  v_changed jsonb := '[]'::jsonb;
begin
  if p_source_ref is null then
    raise exception 'Référence d''origine obligatoire.' using errcode = '22023';
  end if;

  for v_snap in
    select s.employee_id, s.date, s.entry
      from public.planning_snapshots s
     where s.source = p_source and s.source_ref = p_source_ref
  loop
    -- La journée a-t-elle encore été posée par cette demande ? Si la direction
    -- l'a reprise à la main depuis, sa décision est plus récente que celle-ci.
    if not exists (
      select 1 from public.planning_entries p
       where p.employee_id = v_snap.employee_id and p.date = v_snap.date
         and p.source = p_source and p.source_ref = p_source_ref
    ) then
      continue;
    end if;

    if v_snap.entry is null then
      delete from public.planning_entries p
       where p.employee_id = v_snap.employee_id and p.date = v_snap.date;
    else
      update public.planning_entries p
         set boutique_id = (v_snap.entry ->> 'boutique_id')::uuid,
             status      = v_snap.entry ->> 'status',
             start_time  = (v_snap.entry ->> 'start_time')::time,
             end_time    = (v_snap.entry ->> 'end_time')::time,
             break_start = (v_snap.entry ->> 'break_start')::time,
             break_end   = (v_snap.entry ->> 'break_end')::time,
             note        = v_snap.entry ->> 'note',
             source      = v_snap.entry ->> 'source',
             source_ref  = (v_snap.entry ->> 'source_ref')::uuid
       where p.employee_id = v_snap.employee_id and p.date = v_snap.date;
    end if;

    v_count := v_count + 1;
    v_changed := v_changed || jsonb_build_object('e', v_snap.employee_id, 'd', v_snap.date);
  end loop;

  -- Les journées posées sans cliché — celles d'avant cette migration — sont
  -- simplement libérées, comme le faisait la version précédente.
  with removed as (
    delete from public.planning_entries p
     where p.source = p_source and p.source_ref = p_source_ref
    returning p.employee_id, p.date
  )
  select v_count + count(*)::integer,
         v_changed || coalesce(
           jsonb_agg(jsonb_build_object('e', r.employee_id, 'd', r.date)), '[]'::jsonb)
    into v_count, v_changed
    from removed r;

  delete from public.planning_snapshots s
   where s.source = p_source and s.source_ref = p_source_ref;

  for v_touched in
    select (x ->> 'e')::uuid as employee_id,
           array_agg((x ->> 'd')::date order by (x ->> 'd')::date) as dates
      from jsonb_array_elements(v_changed) as x
     group by 1
  loop
    perform public.planning_announce(v_touched.employee_id, v_touched.dates);
  end loop;

  return v_count;
end;
$$;

comment on function public.clear_planning_from_event(text, uuid) is
  'Rend aux journées ce qu''elles contenaient avant la demande. Ne défait jamais une saisie manuelle plus récente.';

revoke all on function public.clear_planning_from_event(text, uuid) from public, anon, authenticated;
grant execute on function public.clear_planning_from_event(text, uuid) to service_role;

select public.revoke_anon_table_privileges();
