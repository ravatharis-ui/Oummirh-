-- REMISE À ZÉRO DE L'ACTIVITÉ — irréversible.
--
-- Efface tout ce qui a été *fait* pendant les essais, et **garde** :
--   • les fiches des collaboratrices et leurs codes PIN ;
--   • le planning déjà saisi et les semaines types ;
--   • les réglages, les points de vente, les types de contrat, les jours fériés.
--
-- À coller dans l'éditeur SQL de Supabase (Dashboard → SQL Editor → New query),
-- d'un seul bloc. Tout part ensemble ou rien ne part : si une ligne échoue, la
-- base reste exactement comme avant.
--
-- ⚠ Les fichiers eux-mêmes — photos de pointage, PDF du coffre-fort — ne se
--   suppriment pas en SQL. Après ce script, videz les espaces « selfies » et
--   « documents » depuis Dashboard → Storage. Sans ça, les fichiers resteraient
--   sans que rien ne les référence, donc sans que rien ne puisse plus les
--   supprimer.

begin;

-- Le pointage et ce qui en découle.
delete from public.pointage_alerts;
delete from public.time_clocks;
delete from public.hours_ledger;
delete from public.recovery_requests;

-- Les congés. Les compteurs repartent de zéro : l'acquisition des mois passés
-- n'est pas rejouée, la tâche de nuit crédite à partir de maintenant.
delete from public.leave_ledger;
delete from public.leave_requests;

-- Renforts et échanges.
delete from public.direct_replacements;
delete from public.shift_swaps;

-- Les clichés de planning ne servent qu'à défaire une demande, et il n'y a plus
-- de demande à défaire.
delete from public.planning_snapshots;

-- Le coffre-fort. Pensez à vider l'espace « documents » dans Storage.
delete from public.documents;

-- Les traces de la période d'essai.
delete from public.notifications;
delete from public.domain_events;
delete from public.login_attempts;

-- Ce qui n'est volontairement PAS effacé :
--   • audit_log  — le journal de vos actions d'administration. L'effacer serait
--                  effacer la trace de cette remise à zéro elle-même.
--   • job_runs   — la santé des tâches automatiques. La vider ferait repasser la
--                  carte du tableau de bord en « jamais lancée » une nuit
--                  entière, pour rien.
--   • planning_entries, planning_templates, employees, user_roles, settings,
--     boutiques, contract_types, public_holidays.

commit;
