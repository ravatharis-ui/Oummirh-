-- =============================================================================
-- 20260924090000_planning_recovery — une récupération d'heures déplace une
-- journée
--
-- « Prendre ses heures supp » veut dire arriver plus tard ou partir plus tôt un
-- jour donné. C'est le planning qui porte ce changement, et c'est donc le module
-- planning qui l'écrit — le module heures se contente d'annoncer sa décision.
--
-- Une journée ainsi ajustée gagne une quatrième source protégée : `recovery`.
-- Sans cela, une duplication de semaine effacerait sans bruit une récupération
-- déjà accordée, et la collaboratrice se retrouverait attendue à 9 h un jour où
-- la direction lui a dit d'arriver à 11 h.
-- =============================================================================

alter table public.planning_entries
  drop constraint if exists planning_entries_source_check;

alter table public.planning_entries
  add constraint planning_entries_source_check check (
    source in ('manual', 'template', 'leave', 'replacement', 'swap', 'recovery')
  );

create or replace function public.planning_protected_sources()
returns text[]
language sql
immutable
set search_path = ''
as $$ select array['leave', 'replacement', 'swap', 'recovery']::text[]; $$;

comment on function public.planning_protected_sources() is
  'Origines de ligne qu''une duplication ou une semaine type ne réécrit jamais.';

-- -----------------------------------------------------------------------------
-- Appliquer la récupération.
--
-- Idempotente par construction : elle part de l'heure **prévue** du jour et
-- retranche le crédit accordé, donc la rejouer ne décale pas deux fois. Ce qui
-- est stocké n'est pas « moins une heure » mais « commence à 10 h ».
-- -----------------------------------------------------------------------------
create or replace function public.apply_planning_recovery(
  p_employee_id uuid,
  p_date        date,
  p_mode        text,
  p_minutes     integer,
  p_source_ref  uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_entry public.planning_entries;
  v_start time;
  v_end   time;
begin
  if p_mode not in ('later', 'earlier') then
    raise exception 'Mode de récupération inconnu : %.', p_mode using errcode = '22023';
  end if;

  select * into v_entry
    from public.planning_entries
   where employee_id = p_employee_id and date = p_date;

  if v_entry.id is null or v_entry.start_time is null or v_entry.end_time is null then
    raise exception 'Aucune journée travaillée à ajuster le % pour cette collaboratrice.', p_date
      using errcode = '22023';
  end if;

  -- On repart de l'horaire d'origine, pas de l'horaire courant : une seconde
  -- exécution du même événement produit exactement le même résultat.
  if v_entry.source = 'recovery' and v_entry.source_ref = p_source_ref then
    return false;
  end if;

  v_start := v_entry.start_time;
  v_end   := v_entry.end_time;

  if p_mode = 'later' then
    v_start := v_start + make_interval(mins => p_minutes);
  else
    v_end := v_end - make_interval(mins => p_minutes);
  end if;

  if v_end <= v_start then
    raise exception 'La récupération demandée ne laisse aucune heure de travail ce jour-là.'
      using errcode = '22023';
  end if;

  update public.planning_entries
     set start_time = v_start,
         end_time   = v_end,
         source     = 'recovery',
         source_ref = p_source_ref,
         note       = coalesce(note || ' · ', '') || 'Récupération d''heures'
   where id = v_entry.id;

  perform public.planning_announce(p_employee_id, array[p_date]);
  return true;
end;
$$;

comment on function public.apply_planning_recovery(uuid, date, text, integer, uuid) is
  'Décale l''arrivée ou le départ d''une journée pour une récupération d''heures accordée.';

revoke all on function public.apply_planning_recovery(uuid, date, text, integer, uuid)
  from public, anon, authenticated;
grant execute on function public.apply_planning_recovery(uuid, date, text, integer, uuid)
  to service_role;
