-- =============================================================================
-- 20260923083000_planning_functions — écritures du planning
--
-- Le navigateur n'écrit jamais dans `planning_entries` en direct. Tout passe par
-- une fonction qui revérifie le rôle, applique la règle métier, journalise et
-- émet l'événement. Les politiques RLS restent la frontière ; ces fonctions sont
-- la règle métier.
--
-- Une seule règle gouverne tout le fichier : une ligne posée par un congé, un
-- remplacement ou un échange n'est jamais écrasée par une duplication de semaine
-- ni par une semaine type. Ces trois sources-là ont été décidées ailleurs, avec
-- l'accord de quelqu'un ; une copie de planning n'a pas à les défaire.
-- =============================================================================

-- Sources qu'une opération en lot ne touche jamais.
create or replace function public.planning_protected_sources()
returns text[]
language sql
immutable
set search_path = ''
as $$ select array['leave', 'replacement', 'swap']::text[]; $$;

comment on function public.planning_protected_sources() is
  'Origines de ligne qu''une duplication ou une semaine type ne réécrit jamais.';

revoke all on function public.planning_protected_sources() from public, anon, authenticated;
grant execute on function public.planning_protected_sources() to service_role;

-- -----------------------------------------------------------------------------
-- Annonce d'un changement.
--
-- Un seul type d'événement, que le changement porte sur un jour ou sur une
-- semaine : `dates` est un tableau. La collaboratrice reçoit « ton planning a
-- changé », pas sept notifications d'affilée.
--
-- Rien n'est annoncé pour une date passée : corriger le planning d'avant-hier
-- est une écriture comptable, pas une nouvelle à annoncer.
-- -----------------------------------------------------------------------------
create or replace function public.planning_announce(p_employee_id uuid, p_dates date[])
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_future date[];
begin
  select array_agg(d order by d)
    into v_future
    from unnest(coalesce(p_dates, '{}'::date[])) as d
   where d >= public.reunion_today();

  if v_future is null or cardinality(v_future) = 0 then
    return;
  end if;

  perform public.emit_event(
    'planning.entry_changed',
    jsonb_build_object(
      'employee_id', p_employee_id,
      'dates', to_jsonb(v_future),
      'first_date', v_future[1]
    )
  );
end;
$$;

comment on function public.planning_announce(uuid, date[]) is
  'Émet planning.entry_changed pour les seules dates à venir. Un événement par lot, pas par jour.';

revoke all on function public.planning_announce(uuid, date[]) from public, anon, authenticated;
grant execute on function public.planning_announce(uuid, date[]) to service_role;

-- =============================================================================
-- Direction : saisie d'une journée
-- =============================================================================
create or replace function public.admin_upsert_planning_entry(
  p_employee_id  uuid,
  p_date         date,
  p_status       text,
  p_start_time   time default null,
  p_end_time     time default null,
  p_break_start  time default null,
  p_break_end    time default null,
  p_boutique_id  uuid default null,
  p_note         text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id       uuid;
  v_before   jsonb;
  v_boutique uuid;
begin
  if not public.is_admin() then
    raise exception 'Seule la direction peut modifier le planning.' using errcode = '42501';
  end if;

  select coalesce(p_boutique_id, e.boutique_id) into v_boutique
    from public.employees e where e.id = p_employee_id;

  if v_boutique is null then
    raise exception 'Collaboratrice introuvable.' using errcode = '23503';
  end if;

  -- A working day with no hours given falls back to her own defaults rather
  -- than to a shop-wide time she does not work.
  if p_status in ('work', 'replacement') and (p_start_time is null or p_end_time is null) then
    select e.default_start, e.default_end into p_start_time, p_end_time
      from public.employees e where e.id = p_employee_id;
  end if;

  select to_jsonb(p) into v_before
    from public.planning_entries p
   where p.employee_id = p_employee_id and p.date = p_date;

  insert into public.planning_entries (
    employee_id, boutique_id, date, status,
    start_time, end_time, break_start, break_end, note, source, source_ref
  ) values (
    p_employee_id, v_boutique, p_date, p_status,
    case when p_status in ('work', 'replacement') then p_start_time end,
    case when p_status in ('work', 'replacement') then p_end_time end,
    case when p_status in ('work', 'replacement') then p_break_start end,
    case when p_status in ('work', 'replacement') then p_break_end end,
    p_note, 'manual', null
  )
  on conflict (employee_id, date) do update set
    boutique_id = excluded.boutique_id,
    status      = excluded.status,
    start_time  = excluded.start_time,
    end_time    = excluded.end_time,
    break_start = excluded.break_start,
    break_end   = excluded.break_end,
    note        = excluded.note,
    source      = 'manual',
    source_ref  = null
  returning id into v_id;

  insert into public.audit_log (actor_id, action, entity, entity_id, before, after)
  values ((select auth.uid()), 'planning.entry_upserted', 'planning_entries', v_id, v_before,
          jsonb_build_object('employee_id', p_employee_id, 'date', p_date, 'status', p_status));

  perform public.planning_announce(p_employee_id, array[p_date]);

  return v_id;
end;
$$;

comment on function public.admin_upsert_planning_entry is
  'Pose ou remplace une journée de planning. Une saisie manuelle écrase tout, y compris un congé : la direction reste maîtresse du planning.';

revoke all on function public.admin_upsert_planning_entry from public, anon;
grant execute on function public.admin_upsert_planning_entry to authenticated, service_role;

-- =============================================================================
-- Direction : effacer une journée
-- =============================================================================
create or replace function public.admin_delete_planning_entry(p_employee_id uuid, p_date date)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_before jsonb;
begin
  if not public.is_admin() then
    raise exception 'Seule la direction peut modifier le planning.' using errcode = '42501';
  end if;

  delete from public.planning_entries p
   where p.employee_id = p_employee_id and p.date = p_date
  returning to_jsonb(p) into v_before;

  if v_before is null then
    return false;
  end if;

  insert into public.audit_log (actor_id, action, entity, entity_id, before)
  values ((select auth.uid()), 'planning.entry_deleted', 'planning_entries',
          (v_before ->> 'id')::uuid, v_before);

  perform public.planning_announce(p_employee_id, array[p_date]);

  return true;
end;
$$;

revoke all on function public.admin_delete_planning_entry(uuid, date) from public, anon;
grant execute on function public.admin_delete_planning_entry(uuid, date) to authenticated, service_role;

-- =============================================================================
-- Direction : dupliquer une semaine
--
-- Seules les lignes manuelles ou issues d'une semaine type sont copiées : le
-- congé de la semaine dernière n'a aucune raison de se reproduire cette semaine.
-- Et du côté cible, une ligne protégée n'est jamais écrasée.
-- =============================================================================
create or replace function public.admin_duplicate_planning_week(
  p_source_monday date,
  p_target_monday date,
  p_employee_ids  uuid[] default null
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_shift   integer;
  v_count   integer;
  v_written jsonb;
  v_touched record;
begin
  if not public.is_admin() then
    raise exception 'Seule la direction peut modifier le planning.' using errcode = '42501';
  end if;

  if p_source_monday is null or p_target_monday is null then
    raise exception 'Semaine source et semaine cible sont obligatoires.' using errcode = '22023';
  end if;

  if p_source_monday = p_target_monday then
    raise exception 'La semaine cible ne peut pas être la semaine source.' using errcode = '22023';
  end if;

  v_shift := p_target_monday - p_source_monday;

  with source_rows as (
    select p.employee_id, p.boutique_id, p.date, p.status,
           p.start_time, p.end_time, p.break_start, p.break_end, p.note
      from public.planning_entries p
     where p.date between p_source_monday and p_source_monday + 6
       and not (p.source = any (public.planning_protected_sources()))
       and (p_employee_ids is null or p.employee_id = any (p_employee_ids))
  ),
  written as (
    insert into public.planning_entries (
      employee_id, boutique_id, date, status,
      start_time, end_time, break_start, break_end, note, source, source_ref
    )
    select s.employee_id, s.boutique_id, s.date + v_shift, s.status,
           s.start_time, s.end_time, s.break_start, s.break_end, s.note, 'manual', null
      from source_rows s
    on conflict (employee_id, date) do update set
      boutique_id = excluded.boutique_id,
      status      = excluded.status,
      start_time  = excluded.start_time,
      end_time    = excluded.end_time,
      break_start = excluded.break_start,
      break_end   = excluded.break_end,
      note        = excluded.note,
      source      = 'manual',
      source_ref  = null
    -- The one line that makes this safe to run on a live week: a day already
    -- held by a leave, a replacement or a swap keeps its row.
    where not (planning_entries.source = any (public.planning_protected_sources()))
    returning planning_entries.employee_id, planning_entries.date
  )
  select count(*)::integer,
         coalesce(jsonb_agg(jsonb_build_object('e', w.employee_id, 'd', w.date)), '[]'::jsonb)
    into v_count, v_written
    from written w;

  -- One event per collaboratrice, listing only the days that actually moved.
  for v_touched in
    select (x ->> 'e')::uuid as employee_id,
           array_agg((x ->> 'd')::date order by (x ->> 'd')::date) as dates
      from jsonb_array_elements(v_written) as x
     group by 1
  loop
    perform public.planning_announce(v_touched.employee_id, v_touched.dates);
  end loop;

  insert into public.audit_log (actor_id, action, entity, entity_id, after)
  values ((select auth.uid()), 'planning.week_duplicated', 'planning_entries', null,
          jsonb_build_object('from', p_source_monday, 'to', p_target_monday, 'rows', v_count));

  return v_count;
end;
$$;

comment on function public.admin_duplicate_planning_week(date, date, uuid[]) is
  'Copie une semaine sur une autre. Ne copie ni n''écrase jamais une ligne posée par un congé, un remplacement ou un échange.';

revoke all on function public.admin_duplicate_planning_week(date, date, uuid[]) from public, anon;
grant execute on function public.admin_duplicate_planning_week(date, date, uuid[])
  to authenticated, service_role;

-- =============================================================================
-- Direction : appliquer la semaine type
--
-- Utile surtout pour les alternantes, dont les jours d'école ne bougent pas.
-- Par défaut la fonction ne remplit que les journées vides : appliquer une
-- semaine type ne doit pas effacer un planning déjà arbitré.
-- =============================================================================
create or replace function public.admin_apply_planning_template(
  p_employee_id uuid,
  p_week_start  date,
  p_overwrite   boolean default false
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
  if not public.is_admin() then
    raise exception 'Seule la direction peut modifier le planning.' using errcode = '42501';
  end if;

  select e.boutique_id into v_boutique from public.employees e where e.id = p_employee_id;
  if v_boutique is null then
    raise exception 'Collaboratrice introuvable.' using errcode = '23503';
  end if;

  with planned as (
    select t.status, t.start_time, t.end_time, t.break_start, t.break_end,
           p_week_start + (t.weekday - 1) as target_date
      from public.planning_templates t
     where t.employee_id = p_employee_id
  ),
  written as (
    insert into public.planning_entries (
      employee_id, boutique_id, date, status,
      start_time, end_time, break_start, break_end, source, source_ref
    )
    select p_employee_id, v_boutique, pl.target_date, pl.status,
           pl.start_time, pl.end_time, pl.break_start, pl.break_end, 'template', null
      from planned pl
    on conflict (employee_id, date) do update set
      boutique_id = excluded.boutique_id,
      status      = excluded.status,
      start_time  = excluded.start_time,
      end_time    = excluded.end_time,
      break_start = excluded.break_start,
      break_end   = excluded.break_end,
      source      = 'template',
      source_ref  = null
    where not (planning_entries.source = any (public.planning_protected_sources()))
      and p_overwrite
    returning planning_entries.date
  )
  select count(*)::integer, array_agg(w.date order by w.date)
    into v_count, v_dates
    from written w;

  if v_dates is not null then
    perform public.planning_announce(p_employee_id, v_dates);
  end if;

  insert into public.audit_log (actor_id, action, entity, entity_id, after)
  values ((select auth.uid()), 'planning.template_applied', 'employees', p_employee_id,
          jsonb_build_object('week_start', p_week_start, 'rows', v_count, 'overwrite', p_overwrite));

  return v_count;
end;
$$;

comment on function public.admin_apply_planning_template(uuid, date, boolean) is
  'Applique la semaine type sur une semaine. Par défaut ne remplit que les journées vides.';

revoke all on function public.admin_apply_planning_template(uuid, date, boolean) from public, anon;
grant execute on function public.admin_apply_planning_template(uuid, date, boolean)
  to authenticated, service_role;

-- =============================================================================
-- Gestionnaires d'événements : congés, remplacements, échanges
--
-- Ces deux fonctions sont la seule façon pour un autre module d'écrire dans le
-- planning. Elles appartiennent au module planning, sont appelées par le
-- distributeur avec la clé de service, et sont idempotentes : rejouer le même
-- événement produit exactement les mêmes lignes.
-- =============================================================================
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
  'Pose des journées de planning pour le compte d''un autre module (congé, remplacement, échange). Idempotente.';

revoke all on function public.apply_planning_from_event from public, anon, authenticated;
grant execute on function public.apply_planning_from_event to service_role;

-- Retrait : un congé annulé libère les journées qu'il avait posées, et rien
-- d'autre. Le couple (source, source_ref) délimite exactement ce qui est à lui.
create or replace function public.clear_planning_from_event(p_source text, p_source_ref uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_count   integer;
  v_removed jsonb;
  v_touched record;
begin
  if p_source_ref is null then
    raise exception 'Référence d''origine obligatoire.' using errcode = '22023';
  end if;

  with removed as (
    delete from public.planning_entries p
     where p.source = p_source and p.source_ref = p_source_ref
    returning p.employee_id, p.date
  )
  select count(*)::integer,
         coalesce(jsonb_agg(jsonb_build_object('e', r.employee_id, 'd', r.date)), '[]'::jsonb)
    into v_count, v_removed
    from removed r;

  for v_touched in
    select (x ->> 'e')::uuid as employee_id,
           array_agg((x ->> 'd')::date order by (x ->> 'd')::date) as dates
      from jsonb_array_elements(v_removed) as x
     group by 1
  loop
    perform public.planning_announce(v_touched.employee_id, v_touched.dates);
  end loop;

  return v_count;
end;
$$;

comment on function public.clear_planning_from_event(text, uuid) is
  'Retire les journées posées par un congé, un remplacement ou un échange donné.';

revoke all on function public.clear_planning_from_event(text, uuid) from public, anon, authenticated;
grant execute on function public.clear_planning_from_event(text, uuid) to service_role;
