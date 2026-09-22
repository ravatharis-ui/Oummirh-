-- =============================================================================
-- 20260924070000_pointage_effective_order — départager deux pointages du même
-- instant
--
-- `effective_time_clocks` retenait « la dernière ligne écrite », en se fiant au
-- seul `created_at`. Or `now()` en PostgreSQL est l'heure de **début de
-- transaction** : une originale et sa correction écrites dans la même
-- transaction portent exactement le même horodatage, et `distinct on` tranchait
-- alors arbitrairement.
--
-- En production le cas est rare — une correction arrive des jours après le
-- pointage. Mais « rare » n'est pas « jamais », et un test qui dépend du plan
-- d'exécution est un test qui ment un jour sur deux. C'est d'ailleurs comme ça
-- que le banc d'essai l'a trouvé : une migration sans rapport a changé le plan,
-- et l'assertion s'est retournée.
--
-- La règle devient explicite : **une correction l'emporte toujours sur une
-- originale**, quelle que soit l'heure d'écriture. C'est ce que le mot
-- « correction » veut dire.
-- =============================================================================
create or replace view public.effective_time_clocks
with (security_invoker = true) as
select distinct on (tc.employee_id, tc.local_date, tc.event_type)
       tc.id, tc.employee_id, tc.boutique_id, tc.event_type, tc.occurred_at,
       tc.local_date, tc.photo_path, tc.planned_time, tc.delta_minutes,
       tc.is_correction, tc.correction_reason
  from public.time_clocks tc
 order by tc.employee_id, tc.local_date, tc.event_type,
          tc.is_correction desc, tc.created_at desc, tc.id desc;

comment on view public.effective_time_clocks is
  'Dernière version de chaque pointage. Une correction l''emporte toujours sur l''originale, qui reste en base.';

grant select on public.effective_time_clocks to authenticated, service_role;
