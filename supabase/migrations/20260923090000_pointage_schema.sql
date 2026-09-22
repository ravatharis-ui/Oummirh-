-- =============================================================================
-- 20260923090000_pointage_schema — pointage et selfies
--
-- Une pointeuse est un registre, pas un formulaire. Trois règles gouvernent ce
-- fichier :
--
--   1. L'heure vient de `now()`, côté Postgres. L'horloge d'un téléphone se
--      règle à la main ; celle du serveur, non.
--   2. Rien n'est jamais modifié. Une correction de la direction est une
--      nouvelle ligne, marquée comme telle, qui fait autorité sans effacer
--      l'originale.
--   3. Le navigateur n'écrit pas dans la table. Il appelle `clock_event`, qui
--      revérifie tout : la session, la séquence, la photo.
-- =============================================================================

create table public.time_clocks (
  id            uuid primary key default gen_random_uuid(),
  employee_id   uuid not null references public.employees (id) on delete cascade,
  boutique_id   uuid not null references public.boutiques (id),

  event_type    text not null check (
    event_type in ('clock_in', 'break_start', 'break_end', 'clock_out')
  ),

  -- Always the server clock. Never a value sent by the client.
  occurred_at   timestamptz not null default now(),

  -- The business day in Réunion. A clock-out after midnight belongs to the day
  -- that opened, not to the one the calendar has just turned to.
  local_date    date not null,

  -- `<employee_id>/<uuid>.jpg` in the private `selfies` bucket.
  photo_path    text,

  -- What the planning expected, and by how much reality differed. Stored at
  -- insert: the planning can change afterwards, the pointing stays true to what
  -- was expected at that moment.
  planned_time  time,
  delta_minutes integer,

  is_correction     boolean not null default false,
  correction_reason text,
  corrected_by      uuid references auth.users (id) on delete set null,

  created_at    timestamptz not null default now(),

  constraint time_clocks_correction_reason check (
    (is_correction = false and correction_reason is null and corrected_by is null)
    or (is_correction = true and corrected_by is not null
        and correction_reason is not null and length(btrim(correction_reason)) >= 5)
  ),
  -- A correction is entered by hand; it carries no selfie.
  constraint time_clocks_correction_has_no_photo check (
    is_correction = false or photo_path is null
  )
);

-- A selfie proves one pointing and one only. Replaying the same upload cannot
-- forge a second one — and this is an index, not a check, so no concurrent
-- insert can slip between the two.
create unique index time_clocks_photo_once
  on public.time_clocks (photo_path) where photo_path is not null;

create index time_clocks_employee_day_idx
  on public.time_clocks (employee_id, local_date, occurred_at);
create index time_clocks_day_boutique_idx
  on public.time_clocks (local_date, boutique_id);

comment on table public.time_clocks is
  'Registre des pointages. Aucune ligne n''est jamais modifiée : une correction est une nouvelle ligne.';
comment on column public.time_clocks.local_date is
  'Journée de travail à La Réunion. Un départ après minuit reste rattaché à la journée ouverte.';

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.time_clocks enable row level security;

create policy "pointage: chacune voit le sien"
  on public.time_clocks for select to authenticated
  using (employee_id = (select public.current_employee_id()));

create policy "pointage: la direction voit tout"
  on public.time_clocks for select to authenticated
  using ((select public.is_admin()));

-- Deliberately no INSERT / UPDATE / DELETE policy, for anyone. Even the
-- direction goes through `admin_correct_time_clock`, so every write is audited
-- and no row can ever be rewritten or erased from a browser.
revoke all on public.time_clocks from anon, authenticated;
grant select on public.time_clocks to authenticated;
grant all on public.time_clocks to service_role;

-- =============================================================================
-- Lecture consolidée
--
-- La ligne qui fait foi pour un événement donné est la dernière écrite : une
-- correction, arrivée après, l'emporte sur l'originale sans l'effacer.
-- =============================================================================
create or replace view public.effective_time_clocks
with (security_invoker = true) as
select distinct on (tc.employee_id, tc.local_date, tc.event_type)
       tc.id, tc.employee_id, tc.boutique_id, tc.event_type, tc.occurred_at,
       tc.local_date, tc.photo_path, tc.planned_time, tc.delta_minutes,
       tc.is_correction, tc.correction_reason
  from public.time_clocks tc
 order by tc.employee_id, tc.local_date, tc.event_type, tc.created_at desc;

comment on view public.effective_time_clocks is
  'Dernière version de chaque pointage : une correction masque l''originale sans la supprimer.';

create or replace view public.daily_worked_time
with (security_invoker = true) as
with days as (
  select e.employee_id, e.local_date, e.boutique_id,
         max(e.occurred_at) filter (where e.event_type = 'clock_in')    as clock_in_at,
         max(e.occurred_at) filter (where e.event_type = 'break_start') as break_start_at,
         max(e.occurred_at) filter (where e.event_type = 'break_end')   as break_end_at,
         max(e.occurred_at) filter (where e.event_type = 'clock_out')   as clock_out_at,
         max(e.delta_minutes) filter (where e.event_type = 'clock_in')  as arrival_delta_minutes
    from public.effective_time_clocks e
   group by e.employee_id, e.local_date, e.boutique_id
)
select d.employee_id, d.local_date, d.boutique_id,
       d.clock_in_at, d.break_start_at, d.break_end_at, d.clock_out_at,
       d.arrival_delta_minutes,
       case
         when d.clock_in_at is null or d.clock_out_at is null then null
         else greatest(0, (
           extract(epoch from (d.clock_out_at - d.clock_in_at))
           - coalesce(extract(epoch from (d.break_end_at - d.break_start_at)), 0)
         ) / 60)::integer
       end as worked_minutes,
       (d.clock_in_at is not null and d.clock_out_at is null) as is_open
  from days d;

comment on view public.daily_worked_time is
  'Temps travaillé par collaboratrice et par journée, pause déduite. NULL tant que la journée n''est pas close.';

grant select on public.effective_time_clocks, public.daily_worked_time to authenticated;
grant select on public.effective_time_clocks, public.daily_worked_time to service_role;

-- =============================================================================
-- clock_event — la seule écriture possible depuis l'application
-- =============================================================================
create or replace function public.clock_event(
  p_event_type text,
  p_photo_path text default null
)
returns public.time_clocks
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_employee   uuid;
  v_boutique   uuid;
  v_active     boolean;
  v_today      date;
  v_local_date date;
  v_last_date  date;
  v_last_type  text;
  v_prev_type  text;
  v_planned    time;
  v_status     text;
  v_row        public.time_clocks;
begin
  if p_event_type not in ('clock_in', 'break_start', 'break_end', 'clock_out') then
    raise exception 'Type de pointage inconnu.' using errcode = '22023';
  end if;

  v_employee := public.current_employee_id();
  if v_employee is null then
    raise exception 'Session expirée. Reconnecte-toi pour pointer.' using errcode = '42501';
  end if;

  select e.is_active, e.boutique_id into v_active, v_boutique
    from public.employees e where e.id = v_employee;

  if not coalesce(v_active, false) then
    raise exception 'Ce compte n''est plus actif.' using errcode = '42501';
  end if;

  v_today := public.reunion_today();

  -- Which business day does this belong to? A day stays open until it is
  -- clocked out, but only until the next day: a clock-out forgotten last week
  -- must not swallow this morning's arrival.
  select tc.local_date, tc.event_type into v_last_date, v_last_type
    from public.time_clocks tc
   where tc.employee_id = v_employee
   order by tc.occurred_at desc
   limit 1;

  if v_last_type is not null and v_last_type <> 'clock_out' and v_last_date >= v_today - 1 then
    v_local_date := v_last_date;
  else
    v_local_date := v_today;
  end if;

  select tc.event_type into v_prev_type
    from public.time_clocks tc
   where tc.employee_id = v_employee and tc.local_date = v_local_date
   order by tc.occurred_at desc
   limit 1;

  -- The sequence. Each refusal says, in French, what the next step actually is:
  -- the collaboratrice reads this message on her phone with a customer waiting.
  if v_prev_type is null then
    if p_event_type <> 'clock_in' then
      raise exception 'Il faut d''abord pointer ton arrivée.' using errcode = '22023';
    end if;
  elsif v_prev_type = 'clock_in' then
    if p_event_type = 'clock_in' then
      raise exception 'Ton arrivée est déjà pointée.' using errcode = '22023';
    elsif p_event_type = 'break_end' then
      raise exception 'Tu n''as pas encore pointé le début de ta pause.' using errcode = '22023';
    end if;
  elsif v_prev_type = 'break_start' then
    if p_event_type <> 'break_end' then
      raise exception 'Tu es en pause. Pointe d''abord la fin de ta pause.' using errcode = '22023';
    end if;
  elsif v_prev_type = 'break_end' then
    if p_event_type <> 'clock_out' then
      raise exception 'Ta pause est terminée. Il ne reste que le départ à pointer.' using errcode = '22023';
    end if;
  elsif v_prev_type = 'clock_out' then
    raise exception 'Ta journée est déjà terminée.' using errcode = '22023';
  end if;

  -- The selfie. It must exist, belong to her folder, and never have been used.
  if p_photo_path is not null then
    if (storage.foldername(p_photo_path))[1] is distinct from v_employee::text then
      raise exception 'Photo refusée.' using errcode = '42501';
    end if;

    if not exists (
      select 1 from storage.objects o
       where o.bucket_id = 'selfies' and o.name = p_photo_path
    ) then
      raise exception 'La photo n''est pas arrivée jusqu''au serveur. Réessaie.'
        using errcode = '22023';
    end if;

    if exists (select 1 from public.time_clocks tc where tc.photo_path = p_photo_path) then
      raise exception 'Cette photo a déjà servi à un pointage.' using errcode = '22023';
    end if;
  end if;

  -- What the planning expected of her that day, and where she was expected.
  select case p_event_type
           when 'clock_in'  then p.start_time
           when 'clock_out' then p.end_time
         end,
         p.status,
         coalesce(p.boutique_id, v_boutique)
    into v_planned, v_status, v_boutique
    from public.planning_entries p
   where p.employee_id = v_employee and p.date = v_local_date;

  if v_boutique is null then
    select e.boutique_id into v_boutique from public.employees e where e.id = v_employee;
  end if;

  insert into public.time_clocks (
    employee_id, boutique_id, event_type, local_date, photo_path, planned_time, delta_minutes
  ) values (
    v_employee, v_boutique, p_event_type, v_local_date, p_photo_path, v_planned,
    case
      when v_planned is null then null
      else (extract(epoch from (
             ((now() at time zone 'Indian/Reunion')::time) - v_planned
           )) / 60)::integer
    end
  )
  returning * into v_row;

  perform public.emit_event(
    'pointage.clock_recorded',
    jsonb_build_object(
      'employee_id', v_employee,
      'event_type', p_event_type,
      'local_date', v_local_date,
      'delta_minutes', v_row.delta_minutes,
      'planned_status', v_status
    )
  );

  return v_row;
end;
$$;

comment on function public.clock_event(text, text) is
  'Enregistre un pointage à l''heure du serveur. Seule écriture possible dans time_clocks depuis l''application.';

revoke all on function public.clock_event(text, text) from public, anon;
grant execute on function public.clock_event(text, text) to authenticated, service_role;

-- =============================================================================
-- Correction par la direction — une nouvelle ligne, jamais une réécriture
-- =============================================================================
create or replace function public.admin_correct_time_clock(
  p_employee_id uuid,
  p_local_date  date,
  p_event_type  text,
  p_occurred_at timestamptz,
  p_reason      text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_boutique uuid;
  v_planned  time;
  v_id       uuid;
begin
  if not public.is_admin() then
    raise exception 'Seule la direction peut corriger un pointage.' using errcode = '42501';
  end if;

  if p_event_type not in ('clock_in', 'break_start', 'break_end', 'clock_out') then
    raise exception 'Type de pointage inconnu.' using errcode = '22023';
  end if;

  if p_reason is null or length(btrim(p_reason)) < 5 then
    raise exception 'Une correction doit être motivée.' using errcode = '22023';
  end if;

  select coalesce(p.boutique_id, e.boutique_id),
         case p_event_type when 'clock_in' then p.start_time
                           when 'clock_out' then p.end_time end
    into v_boutique, v_planned
    from public.employees e
    left join public.planning_entries p
      on p.employee_id = e.id and p.date = p_local_date
   where e.id = p_employee_id;

  if v_boutique is null then
    raise exception 'Collaboratrice introuvable.' using errcode = '23503';
  end if;

  insert into public.time_clocks (
    employee_id, boutique_id, event_type, occurred_at, local_date,
    planned_time, delta_minutes, is_correction, correction_reason, corrected_by
  ) values (
    p_employee_id, v_boutique, p_event_type, p_occurred_at, p_local_date,
    v_planned,
    case when v_planned is null then null
         else (extract(epoch from (
                ((p_occurred_at at time zone 'Indian/Reunion')::time) - v_planned
              )) / 60)::integer
    end,
    true, btrim(p_reason), (select auth.uid())
  )
  returning id into v_id;

  insert into public.audit_log (actor_id, action, entity, entity_id, after)
  values ((select auth.uid()), 'pointage.corrected', 'time_clocks', v_id,
          jsonb_build_object('employee_id', p_employee_id, 'local_date', p_local_date,
                             'event_type', p_event_type, 'occurred_at', p_occurred_at,
                             'reason', btrim(p_reason)));

  perform public.emit_event(
    'pointage.corrected',
    jsonb_build_object('employee_id', p_employee_id, 'local_date', p_local_date,
                       'event_type', p_event_type)
  );

  return v_id;
end;
$$;

comment on function public.admin_correct_time_clock is
  'Ajoute un pointage corrigé. L''originale reste en base et reste consultable.';

revoke all on function public.admin_correct_time_clock from public, anon;
grant execute on function public.admin_correct_time_clock to authenticated, service_role;

-- =============================================================================
-- Realtime — le tableau de présence de la direction suit les pointages du jour
-- =============================================================================
alter table public.time_clocks replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'time_clocks'
  ) then
    alter publication supabase_realtime add table public.time_clocks;
  end if;
end;
$$;
