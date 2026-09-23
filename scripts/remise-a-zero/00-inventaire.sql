-- INVENTAIRE — ne modifie rien.
--
-- À lancer en premier, dans l'éditeur SQL de Supabase. Il dit exactement ce que
-- les scripts suivants effaceraient. Rien n'est touché : vous pouvez le relancer
-- autant de fois que vous voulez.

select 'Collaboratrices' as quoi, count(*) as combien from public.employees
union all
select 'Pointages', count(*) from public.time_clocks
union all
select 'Photos de pointage', count(*) from public.time_clocks where photo_path is not null
union all
select 'Alertes de retard', count(*) from public.pointage_alerts
union all
select 'Mouvements d''heures', count(*) from public.hours_ledger
union all
select 'Demandes de récupération', count(*) from public.recovery_requests
union all
select 'Mouvements de congés', count(*) from public.leave_ledger
union all
select 'Demandes de congés', count(*) from public.leave_requests
union all
select 'Remplacements', count(*) from public.direct_replacements
union all
select 'Échanges de créneaux', count(*) from public.shift_swaps
union all
select 'Journées planifiées', count(*) from public.planning_entries
union all
select 'Semaines types', count(*) from public.planning_templates
union all
select 'Documents', count(*) from public.documents
union all
select 'Notifications', count(*) from public.notifications
union all
select 'Événements', count(*) from public.domain_events
order by quoi;
