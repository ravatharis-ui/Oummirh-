-- pgTAP: heures et récupération.
--
-- Ce que ces tests protègent : le solde d'heures ne s'écrit pas depuis un
-- navigateur, une journée non close ne produit aucun écart, un recalcul met à
-- jour la journée au lieu de la compter deux fois, et personne ne peut
-- récupérer plus d'heures qu'il n'en a — y compris en empilant des demandes.

begin;
select plan(34);

-- ---------------------------------------------------------------- fixtures --
insert into public.boutiques (id, code, name, kind, sort_order) values
  ('bbbbbbbb-0000-4000-8000-000000000401', 'TEST_HRS', 'Boutique heures', 'physical', 9400);

insert into auth.users (id, email) values
  ('cccccccc-0000-4000-8000-000000000401', 'hrs-a@staff.oummi.invalid'),
  ('cccccccc-0000-4000-8000-000000000402', 'hrs-b@staff.oummi.invalid'),
  ('cccccccc-0000-4000-8000-000000000403', 'hrs-direction@oummi.invalid');

insert into public.user_roles (user_id, role, boutique_id) values
  ('cccccccc-0000-4000-8000-000000000401', 'employee', null),
  ('cccccccc-0000-4000-8000-000000000402', 'employee', null),
  ('cccccccc-0000-4000-8000-000000000403', 'admin', null);

insert into public.employees (id, auth_user_id, last_name, first_name, display_name,
  boutique_id, contract_type_id, pin_hash, weekly_contract_hours)
values
  ('dddddddd-0000-4000-8000-000000000401', 'cccccccc-0000-4000-8000-000000000401',
   'TESTHRS', 'HrsAnna', 'HrsAnna', 'bbbbbbbb-0000-4000-8000-000000000401',
   (select id from public.contract_types where code = 'CDI'),
   extensions.crypt('7392', extensions.gen_salt('bf')), 35),
  ('dddddddd-0000-4000-8000-000000000402', 'cccccccc-0000-4000-8000-000000000402',
   'TESTHRS', 'HrsBea', 'HrsBea', 'bbbbbbbb-0000-4000-8000-000000000401',
   (select id from public.contract_types where code = 'CDI'),
   extensions.crypt('8461', extensions.gen_salt('bf')), 35);

-- Une journée prévue de 09:00 à 17:30 avec 1 h 30 de pause : 420 minutes.
insert into public.planning_entries (employee_id, boutique_id, date, status,
  start_time, end_time, break_start, break_end)
values
  ('dddddddd-0000-4000-8000-000000000401', 'bbbbbbbb-0000-4000-8000-000000000401',
   '2026-03-02', 'work', '09:00', '17:30', '12:30', '14:00'),
  ('dddddddd-0000-4000-8000-000000000402', 'bbbbbbbb-0000-4000-8000-000000000401',
   '2026-03-02', 'work', '09:00', '17:30', '12:30', '14:00');

-- Elle est restée une heure de plus : 480 minutes travaillées.
insert into public.time_clocks (employee_id, boutique_id, event_type, occurred_at, local_date)
values
  ('dddddddd-0000-4000-8000-000000000401', 'bbbbbbbb-0000-4000-8000-000000000401',
   'clock_in',    (date '2026-03-02' + time '09:00') at time zone 'Indian/Reunion', '2026-03-02'),
  ('dddddddd-0000-4000-8000-000000000401', 'bbbbbbbb-0000-4000-8000-000000000401',
   'break_start', (date '2026-03-02' + time '12:30') at time zone 'Indian/Reunion', '2026-03-02'),
  ('dddddddd-0000-4000-8000-000000000401', 'bbbbbbbb-0000-4000-8000-000000000401',
   'break_end',   (date '2026-03-02' + time '14:00') at time zone 'Indian/Reunion', '2026-03-02'),
  ('dddddddd-0000-4000-8000-000000000401', 'bbbbbbbb-0000-4000-8000-000000000401',
   'clock_out',   (date '2026-03-02' + time '18:30') at time zone 'Indian/Reunion', '2026-03-02');

-- Sa collègue a pointé son arrivée et jamais son départ.
insert into public.time_clocks (employee_id, boutique_id, event_type, occurred_at, local_date)
values
  ('dddddddd-0000-4000-8000-000000000402', 'bbbbbbbb-0000-4000-8000-000000000401',
   'clock_in', (date '2026-03-02' + time '09:00') at time zone 'Indian/Reunion', '2026-03-02');

-- ================================================================= grants ====
select is(
  (select count(*) from information_schema.table_privileges
    where table_schema = 'public' and table_name in ('hours_ledger', 'recovery_requests')
      and grantee = 'anon'),
  0::bigint,
  'Un visiteur anonyme n''a aucun droit sur les heures'
);

select is(
  (select count(*) from information_schema.table_privileges
    where table_schema = 'public' and table_name in ('hours_ledger', 'recovery_requests')
      and grantee = 'authenticated' and privilege_type <> 'SELECT'),
  0::bigint,
  'Une session ne peut que lire : un solde d''heures ne s''écrit pas depuis un navigateur'
);

select is(
  (select count(*) from information_schema.routine_privileges
    where routine_schema = 'public' and grantee in ('anon', 'authenticated')
      and routine_name in ('compute_daily_hours', 'apply_planning_recovery',
                           'accrue_monthly_leave', 'close_leave_period')),
  0::bigint,
  'Les tâches planifiées ne sont appelables que par le serveur'
);

-- ========================================================= calcul quotidien ==
select is(
  public.compute_daily_hours('2026-03-02'),
  1,
  'Seule la journée close produit une ligne : celle de sa collègue est ignorée'
);

select is(
  public.hours_balance('dddddddd-0000-4000-8000-000000000401'),
  60,
  'Une heure de plus que prévu fait une heure de crédit'
);

select is(
  public.hours_balance('dddddddd-0000-4000-8000-000000000402'),
  0,
  'Une journée sans départ pointé n''enlève rien à personne'
);

select is(
  public.compute_daily_hours('2026-03-02'),
  1,
  'Le recalcul repasse sur la même journée'
);

select is(
  (select count(*) from public.hours_ledger
    where employee_id = 'dddddddd-0000-4000-8000-000000000401'
      and kind = 'daily_delta' and local_date = '2026-03-02'),
  1::bigint,
  'Et n''a pas ajouté une seconde ligne pour la même journée'
);

select is(
  public.hours_balance('dddddddd-0000-4000-8000-000000000401'),
  60,
  'Le solde n''a donc pas doublé'
);

-- Une correction de la direction change le réel : le recalcul doit suivre.
insert into public.time_clocks (employee_id, boutique_id, event_type, occurred_at, local_date,
  is_correction, correction_reason, corrected_by)
values
  ('dddddddd-0000-4000-8000-000000000401', 'bbbbbbbb-0000-4000-8000-000000000401',
   'clock_out', (date '2026-03-02' + time '17:30') at time zone 'Indian/Reunion', '2026-03-02',
   true, 'Départ réel constaté à 17 h 30', 'cccccccc-0000-4000-8000-000000000403');

select is(
  public.compute_daily_hours('2026-03-02'),
  1,
  'Le recalcul après correction repasse sur la journée'
);

select is(
  public.hours_balance('dddddddd-0000-4000-8000-000000000401'),
  0,
  'La correction ramène la journée à l''heure prévue, et le crédit disparaît'
);

-- ================================================== demande de récupération ==
-- On lui redonne deux heures de crédit pour la suite du scénario.
set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-0000-4000-8000-000000000403","role":"authenticated"}';

select lives_ok(
  $$select public.admin_adjust_hours('dddddddd-0000-4000-8000-000000000401', 120,
      'Régularisation d''un samedi travaillé')$$,
  'La direction ajuste un solde, avec un motif'
);

select throws_ok(
  $$select public.admin_adjust_hours('dddddddd-0000-4000-8000-000000000401', 60, 'ok')$$,
  '22023', null,
  'Un ajustement sans motif sérieux est refusé'
);

reset role;
set local request.jwt.claims = '';

select is(
  public.hours_balance('dddddddd-0000-4000-8000-000000000401'),
  120,
  'Le solde vaut deux heures'
);

-- Une journée à venir, travaillée.
insert into public.planning_entries (employee_id, boutique_id, date, status,
  start_time, end_time)
values
  ('dddddddd-0000-4000-8000-000000000401', 'bbbbbbbb-0000-4000-8000-000000000401',
   public.reunion_today() + 10, 'work', '09:00', '17:30');

set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-0000-4000-8000-000000000401","role":"authenticated"}';

select throws_ok(
  $$select public.request_recovery(public.reunion_today() + 10, 'later', 20)$$,
  '22023', null,
  'La durée se choisit par tranches de quinze minutes'
);

select throws_ok(
  $$select public.request_recovery(public.reunion_today() - 1, 'later', 60)$$,
  '22023', null,
  'On ne récupère pas sur une journée passée'
);

select throws_ok(
  $$select public.request_recovery(public.reunion_today() + 11, 'later', 60)$$,
  '22023', null,
  'On ne récupère pas un jour où l''on ne travaille pas'
);

select throws_ok(
  $$select public.request_recovery(public.reunion_today() + 10, 'later', 180)$$,
  '22023', null,
  'On ne récupère pas plus d''heures qu''on en a'
);

select lives_ok(
  $$select set_config('test.rec1',
      public.request_recovery(public.reunion_today() + 10, 'later', 60)::text, false)$$,
  'La demande d''une heure est acceptée'
);

select throws_ok(
  $$select public.request_recovery(public.reunion_today() + 10, 'earlier', 60)$$,
  '23505', null,
  'Une seconde demande sur la même journée est refusée'
);

reset role;
set local request.jwt.claims = '';

-- Une autre journée à venir, pour éprouver le cumul des demandes en attente.
insert into public.planning_entries (employee_id, boutique_id, date, status,
  start_time, end_time)
values
  ('dddddddd-0000-4000-8000-000000000401', 'bbbbbbbb-0000-4000-8000-000000000401',
   public.reunion_today() + 12, 'work', '09:00', '17:30');

set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-0000-4000-8000-000000000401","role":"authenticated"}';

select throws_ok(
  $$select public.request_recovery(public.reunion_today() + 12, 'earlier', 120)$$,
  '22023', null,
  'Le solde disponible tient compte de ce qui est déjà demandé'
);

select lives_ok(
  $$select public.request_recovery(public.reunion_today() + 12, 'earlier', 60)$$,
  'Ce qui reste du solde, lui, reste demandable'
);

select throws_ok(
  $$select public.admin_decide_recovery(current_setting('test.rec1')::uuid, true)$$,
  '42501', null,
  'Une collaboratrice ne valide pas sa propre récupération'
);

reset role;
set local request.jwt.claims = '';

-- ============================================================== la décision ==
set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-0000-4000-8000-000000000403","role":"authenticated"}';

select lives_ok(
  $$select public.admin_decide_recovery(current_setting('test.rec1')::uuid, true, 'Accordé')$$,
  'La direction accorde la récupération'
);

reset role;
set local request.jwt.claims = '';

select is(
  public.hours_balance('dddddddd-0000-4000-8000-000000000401'),
  60,
  'Le solde est débité de l''heure accordée'
);

select is(
  (select count(*) from public.domain_events
    where type = 'heures.recovery_approved'
      and payload->>'id' = current_setting('test.rec1')),
  1::bigint,
  'Le planning est prévenu par un événement'
);

-- ======================================== le planning suit la récupération ===
select is(
  public.apply_planning_recovery(
    'dddddddd-0000-4000-8000-000000000401', public.reunion_today() + 10,
    'later', 60, current_setting('test.rec1')::uuid),
  true,
  'Le planning applique la récupération'
);

select is(
  (select start_time from public.planning_entries
    where employee_id = 'dddddddd-0000-4000-8000-000000000401'
      and date = public.reunion_today() + 10),
  '10:00'::time,
  'Elle commence une heure plus tard'
);

select is(
  (select source from public.planning_entries
    where employee_id = 'dddddddd-0000-4000-8000-000000000401'
      and date = public.reunion_today() + 10),
  'recovery',
  'La journée est marquée comme issue d''une récupération'
);

select is(
  public.apply_planning_recovery(
    'dddddddd-0000-4000-8000-000000000401', public.reunion_today() + 10,
    'later', 60, current_setting('test.rec1')::uuid),
  false,
  'Rejouer le même événement ne décale pas la journée une seconde fois'
);

select is(
  (select start_time from public.planning_entries
    where employee_id = 'dddddddd-0000-4000-8000-000000000401'
      and date = public.reunion_today() + 10),
  '10:00'::time,
  'Et l''heure de début n''a pas bougé'
);

-- Une journée ainsi ajustée ne doit pas être écrasée par une duplication.
select is(
  (select public.planning_protected_sources() @> array['recovery']),
  true,
  'Une récupération accordée est protégée d''une duplication de semaine'
);

-- ================================================== cloisonnement lecture ====
set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-0000-4000-8000-000000000402","role":"authenticated"}';

select is(
  (select count(*) from public.hours_ledger
    where employee_id <> 'dddddddd-0000-4000-8000-000000000402'),
  0::bigint,
  'Une collaboratrice ne voit aucun mouvement d''heures qui ne soit le sien'
);

select is(
  (select count(*) from public.recovery_requests
    where employee_id <> 'dddddddd-0000-4000-8000-000000000402'),
  0::bigint,
  'Ni aucune demande de récupération qui ne soit la sienne'
);

reset role;
set local request.jwt.claims = '';

select * from finish();
rollback;
