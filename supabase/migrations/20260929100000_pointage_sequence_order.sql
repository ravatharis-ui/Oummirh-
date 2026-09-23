-- =============================================================================
-- 20260929100000_pointage_sequence_order — « le dernier pointage » doit être
-- une question qui a une seule réponse
--
-- Incident, constaté par les tests pgTAP sur le projet réel : cinq assertions du
-- pointage se sont retournées après une migration qui ne touchait qu'aux droits
-- des vues. `clock_event` a laissé pointer un départ alors qu'une pause était
-- ouverte, puis a refusé la fin de pause.
--
-- La cause est celle déjà rencontrée en Phase 7 sur `effective_time_clocks` :
-- **`now()` est l'heure de début de transaction**. Plusieurs pointages écrits
-- dans la même transaction portent donc le même `occurred_at` à la microseconde
-- près, et `order by occurred_at desc limit 1` rend l'un d'eux **au hasard**.
-- La correction de l'époque a rendu la vue déterministe ; la même ambiguïté est
-- restée dans la fonction, et il a suffi qu'un plan d'exécution change pour
-- qu'elle se voie.
--
-- En service réel, chaque pointage est sa propre transaction et les heures
-- diffèrent : personne n'a jamais été gêné. Mais une règle métier dont le
-- résultat dépend du plan choisi par Postgres n'est pas une règle, et une suite
-- de tests qui se retourne toute seule ne prouve plus rien.
--
-- Réponse : une colonne strictement croissante, qui départage ce que l'horloge
-- ne peut pas départager. `occurred_at` reste la clé de tri principale — c'est
-- l'heure qui fait foi ; `seq` ne tranche qu'entre deux lignes de même instant.
-- =============================================================================

alter table public.time_clocks
  add column if not exists seq bigint generated always as identity;

comment on column public.time_clocks.seq is
  'Ordre d''écriture. Départage deux pointages de même occurred_at : now() étant l''heure de début de transaction, ce cas est réel.';

-- -----------------------------------------------------------------------------
-- La vue : même tri, avec le départage qui ne dépend plus d'un uuid tiré au sort
-- -----------------------------------------------------------------------------
create or replace view public.effective_time_clocks
with (security_invoker = true) as
select distinct on (tc.employee_id, tc.local_date, tc.event_type)
       tc.id, tc.employee_id, tc.boutique_id, tc.event_type, tc.occurred_at,
       tc.local_date, tc.photo_path, tc.planned_time, tc.delta_minutes,
       tc.is_correction, tc.correction_reason
  from public.time_clocks tc
 order by tc.employee_id, tc.local_date, tc.event_type,
          tc.is_correction desc, tc.created_at desc, tc.seq desc;

grant select on public.effective_time_clocks to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- La fonction : les deux lectures de « le dernier pointage »
-- -----------------------------------------------------------------------------
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
   order by tc.occurred_at desc, tc.seq desc
   limit 1;

  if v_last_type is not null and v_last_type <> 'clock_out' and v_last_date >= v_today - 1 then
    v_local_date := v_last_date;
  else
    v_local_date := v_today;
  end if;

  select tc.event_type into v_prev_type
    from public.time_clocks tc
   where tc.employee_id = v_employee and tc.local_date = v_local_date
   order by tc.occurred_at desc, tc.seq desc
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
  'Enregistre un pointage à l''heure du serveur. Le tri (occurred_at, seq) rend « le dernier pointage » déterministe.';

revoke all on function public.clock_event(text, text) from public, anon;
grant execute on function public.clock_event(text, text) to authenticated, service_role;

-- Une vue recréée renaît écrivable : la plateforme réapplique ses droits par
-- défaut. Dernière ligne obligatoire de toute migration qui touche à une vue.
select public.revoke_view_write_privileges();
