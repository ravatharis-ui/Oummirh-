-- pgTAP: planning.
--
-- Ce que ces tests protègent : une collaboratrice ne voit que son propre
-- planning et ignore le motif d'absence de ses collègues ; une duplication de
-- semaine n'efface jamais un congé ; un autre module ne peut écrire dans le
-- planning que par la porte prévue pour lui ; et rien n'est annoncé pour une
-- journée déjà passée.
--
-- Comme les suites précédentes, ces tests tournent sur une base peuplée. Les
-- fixtures vivent dans un point de vente créé pour l'occasion, et chaque
-- affirmation est bornée à ce point de vente.

begin;
select plan(40);

-- ---------------------------------------------------------------- fixtures --
insert into public.boutiques (id, code, name, kind, sort_order) values
  ('bbbbbbbb-0000-4000-8000-000000000101', 'TEST_PLAN', 'Boutique planning', 'physical', 9100),
  ('bbbbbbbb-0000-4000-8000-000000000102', 'TEST_PLAN2', 'Boutique planning 2', 'physical', 9101);

insert into auth.users (id, email) values
  ('cccccccc-0000-4000-8000-000000000101', 'plan-a@staff.oummi.invalid'),
  ('cccccccc-0000-4000-8000-000000000102', 'plan-b@staff.oummi.invalid'),
  ('cccccccc-0000-4000-8000-000000000103', 'plan-c@staff.oummi.invalid'),
  ('cccccccc-0000-4000-8000-000000000104', 'plan-direction@oummi.invalid');

insert into public.user_roles (user_id, role, boutique_id) values
  ('cccccccc-0000-4000-8000-000000000101', 'employee', null),
  ('cccccccc-0000-4000-8000-000000000102', 'employee', null),
  ('cccccccc-0000-4000-8000-000000000103', 'employee', null),
  ('cccccccc-0000-4000-8000-000000000104', 'admin', null);

insert into public.employees (id, auth_user_id, last_name, first_name, display_name,
  boutique_id, contract_type_id, pin_hash, weekly_contract_hours,
  default_start, default_end)
values
  ('dddddddd-0000-4000-8000-000000000101', 'cccccccc-0000-4000-8000-000000000101',
   'TESTPLAN', 'PlanAnna', 'PlanAnna', 'bbbbbbbb-0000-4000-8000-000000000101',
   (select id from public.contract_types where code = 'CDI'),
   extensions.crypt('7392', extensions.gen_salt('bf')), 35, '08:30', '16:00'),
  ('dddddddd-0000-4000-8000-000000000102', 'cccccccc-0000-4000-8000-000000000102',
   'TESTPLAN', 'PlanBea', 'PlanBea', 'bbbbbbbb-0000-4000-8000-000000000101',
   (select id from public.contract_types where code = 'CDI'),
   extensions.crypt('8461', extensions.gen_salt('bf')), 35, '09:00', '17:30'),
  -- Celle-ci travaille ailleurs : elle ne doit jamais apparaître dans la
  -- présence du jour des deux premières.
  ('dddddddd-0000-4000-8000-000000000103', 'cccccccc-0000-4000-8000-000000000103',
   'TESTPLAN', 'PlanCora', 'PlanCora', 'bbbbbbbb-0000-4000-8000-000000000102',
   (select id from public.contract_types where code = 'CDI'),
   extensions.crypt('5173', extensions.gen_salt('bf')), 35, '09:00', '17:30');

-- Semaines de travail : une semaine source à venir, sa cible la semaine d'après.
select set_config('test.src', (public.reunion_today() + 7)::text, false);
select set_config('test.dst', (public.reunion_today() + 14)::text, false);
select set_config('test.past', (public.reunion_today() - 10)::text, false);

-- =============================================================== écriture ===
-- Une collaboratrice n'écrit pas son planning.
set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-0000-4000-8000-000000000101","role":"authenticated"}';

select throws_ok(
  $$insert into public.planning_entries (employee_id, boutique_id, date, status, start_time, end_time)
    values ('dddddddd-0000-4000-8000-000000000101', 'bbbbbbbb-0000-4000-8000-000000000101',
            public.reunion_today() + 30, 'work', '09:00', '17:00')$$,
  '42501', null,
  'Une collaboratrice ne peut pas écrire dans le planning'
);

select throws_ok(
  $$select public.admin_upsert_planning_entry(
      'dddddddd-0000-4000-8000-000000000101', public.reunion_today() + 30, 'rest')$$,
  '42501', null,
  'Une collaboratrice ne peut pas appeler la saisie de la direction'
);

select throws_ok(
  $$select public.admin_duplicate_planning_week(
      current_setting('test.src')::date, current_setting('test.dst')::date)$$,
  '42501', null,
  'Une collaboratrice ne peut pas dupliquer une semaine'
);

reset role;

-- ---------------------------------------------------------- anon et grants --
select is(
  (select count(*) from information_schema.table_privileges
    where table_schema = 'public' and table_name in ('planning_entries', 'planning_templates')
      and grantee = 'anon'),
  0::bigint,
  'Un visiteur anonyme n''a aucun droit sur le planning'
);

select is(
  (select count(*) from information_schema.routine_privileges
    where routine_schema = 'public' and grantee = 'anon'
      and routine_name in ('reunion_today', 'my_boutique_presence',
                           'admin_upsert_planning_entry', 'apply_planning_from_event')),
  0::bigint,
  'Aucune fonction du planning n''est ouverte à un visiteur anonyme'
);

select is(
  (select count(*) from information_schema.routine_privileges
    where routine_schema = 'public' and grantee = 'authenticated'
      and routine_name in ('apply_planning_from_event', 'clear_planning_from_event',
                           'planning_announce')),
  0::bigint,
  'Les fonctions réservées aux gestionnaires d''événements restent hors de portée du navigateur'
);

-- ============================================== saisie par la direction ======
set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-0000-4000-8000-000000000104","role":"authenticated"}';

select lives_ok(
  $$select public.admin_upsert_planning_entry(
      'dddddddd-0000-4000-8000-000000000101', current_setting('test.src')::date, 'work')$$,
  'La direction pose une journée de travail'
);

select lives_ok(
  $$select public.admin_upsert_planning_entry(
      'dddddddd-0000-4000-8000-000000000101', current_setting('test.src')::date + 1, 'school')$$,
  'La direction pose une journée d''école'
);

select lives_ok(
  $$select public.admin_upsert_planning_entry(
      'dddddddd-0000-4000-8000-000000000102', current_setting('test.src')::date, 'work',
      '10:00', '18:00')$$,
  'La direction pose une journée avec des heures explicites'
);

reset role;

select is(
  (select start_time from public.planning_entries
    where employee_id = 'dddddddd-0000-4000-8000-000000000101'
      and date = current_setting('test.src')::date),
  '08:30'::time,
  'Une journée de travail sans heures reprend les horaires habituels de la collaboratrice'
);

select is(
  (select start_time from public.planning_entries
    where employee_id = 'dddddddd-0000-4000-8000-000000000101'
      and date = current_setting('test.src')::date + 1),
  null,
  'Une journée d''école ne porte aucune heure'
);

select is(
  (select source from public.planning_entries
    where employee_id = 'dddddddd-0000-4000-8000-000000000101'
      and date = current_setting('test.src')::date),
  'manual',
  'Une saisie de la direction est marquée « manual »'
);

-- --------------------------------------------------- ce qui est annoncé -----
select is(
  (select count(*) from public.domain_events
    where type = 'planning.entry_changed'
      and payload->>'employee_id' = 'dddddddd-0000-4000-8000-000000000101'),
  2::bigint,
  'Chaque journée à venir posée est annoncée une fois'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-0000-4000-8000-000000000104","role":"authenticated"}';
select lives_ok(
  $$select public.admin_upsert_planning_entry(
      'dddddddd-0000-4000-8000-000000000101', current_setting('test.past')::date, 'work')$$,
  'La direction peut corriger une journée passée'
);
reset role;

select is(
  (select count(*) from public.domain_events
    where type = 'planning.entry_changed'
      and payload->>'employee_id' = 'dddddddd-0000-4000-8000-000000000101'),
  2::bigint,
  'Corriger une journée passée n''annonce rien : il n''y a plus rien à prévenir'
);

-- =================================================== écritures par événement =
-- Un congé approuvé pose trois journées, du mardi au jeudi de la semaine source.
select is(
  public.apply_planning_from_event(
    'dddddddd-0000-4000-8000-000000000101',
    current_setting('test.src')::date + 1,
    current_setting('test.src')::date + 3,
    'leave', 'leave', 'aaaaaaaa-0000-4000-8000-000000000011'),
  3,
  'Un congé approuvé pose ses journées dans le planning'
);

select is(
  (select count(*) from public.planning_entries
    where employee_id = 'dddddddd-0000-4000-8000-000000000101'
      and source = 'leave' and source_ref = 'aaaaaaaa-0000-4000-8000-000000000011'),
  3::bigint,
  'Les trois journées portent la référence du congé'
);

select is(
  (select status from public.planning_entries
    where employee_id = 'dddddddd-0000-4000-8000-000000000101'
      and date = current_setting('test.src')::date + 1),
  'leave',
  'Le congé a remplacé la journée d''école déjà posée'
);

select is(
  public.apply_planning_from_event(
    'dddddddd-0000-4000-8000-000000000101',
    current_setting('test.src')::date + 1,
    current_setting('test.src')::date + 3,
    'leave', 'leave', 'aaaaaaaa-0000-4000-8000-000000000011'),
  3,
  'Rejouer le même événement ne crée pas de doublon'
);

select is(
  (select count(*) from public.planning_entries
    where employee_id = 'dddddddd-0000-4000-8000-000000000101'
      and source = 'leave'),
  3::bigint,
  'Après rejeu, il y a toujours trois journées de congé'
);

select throws_ok(
  $$select public.apply_planning_from_event(
      'dddddddd-0000-4000-8000-000000000101', public.reunion_today() + 40,
      public.reunion_today() + 40, 'work', 'manual', 'aaaaaaaa-0000-4000-8000-000000000012')$$,
  '22023', null,
  'Un événement ne peut pas se faire passer pour une saisie de la direction'
);

-- ================================================= duplication de semaine ====
set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-0000-4000-8000-000000000104","role":"authenticated"}';

-- La semaine cible reçoit d'abord un congé, qui ne doit pas être écrasé.
reset role;
select is(
  public.apply_planning_from_event(
    'dddddddd-0000-4000-8000-000000000101',
    current_setting('test.dst')::date,
    current_setting('test.dst')::date,
    'leave', 'leave', 'aaaaaaaa-0000-4000-8000-000000000013'),
  1,
  'La semaine cible contient déjà un congé'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-0000-4000-8000-000000000104","role":"authenticated"}';
select lives_ok(
  $$select public.admin_duplicate_planning_week(
      current_setting('test.src')::date, current_setting('test.dst')::date,
      array['dddddddd-0000-4000-8000-000000000101',
            'dddddddd-0000-4000-8000-000000000102']::uuid[])$$,
  'La direction duplique la semaine'
);

select throws_ok(
  $$select public.admin_duplicate_planning_week(
      current_setting('test.src')::date, current_setting('test.src')::date)$$,
  '22023', null,
  'Dupliquer une semaine sur elle-même est refusé'
);
reset role;

select is(
  (select status from public.planning_entries
    where employee_id = 'dddddddd-0000-4000-8000-000000000101'
      and date = current_setting('test.dst')::date),
  'leave',
  'La duplication n''a pas écrasé le congé de la semaine cible'
);

select is(
  (select source from public.planning_entries
    where employee_id = 'dddddddd-0000-4000-8000-000000000101'
      and date = current_setting('test.dst')::date),
  'leave',
  'Et la journée reste rattachée au congé qui l''a posée'
);

select is(
  (select count(*) from public.planning_entries
    where employee_id = 'dddddddd-0000-4000-8000-000000000101'
      and date between current_setting('test.dst')::date + 1
                   and current_setting('test.dst')::date + 3),
  0::bigint,
  'Le congé de la semaine source n''a pas été recopié sur la semaine cible'
);

select is(
  (select status from public.planning_entries
    where employee_id = 'dddddddd-0000-4000-8000-000000000102'
      and date = current_setting('test.dst')::date),
  'work',
  'La journée de travail d''une collègue a bien été recopiée'
);

-- ---------------------------------------------------- annulation d'un congé --
select is(
  public.clear_planning_from_event('leave', 'aaaaaaaa-0000-4000-8000-000000000011'),
  3,
  'Annuler un congé libère exactement les journées qu''il avait posées'
);

select is(
  (select count(*) from public.planning_entries
    where employee_id = 'dddddddd-0000-4000-8000-000000000101'
      and source_ref = 'aaaaaaaa-0000-4000-8000-000000000013'),
  1::bigint,
  'L''autre congé n''a pas été touché'
);

-- ==================================================== semaine type ===========
insert into public.planning_templates (employee_id, weekday, status, start_time, end_time) values
  ('dddddddd-0000-4000-8000-000000000103', 1, 'school', null, null),
  ('dddddddd-0000-4000-8000-000000000103', 2, 'work', '09:00', '17:30');

set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-0000-4000-8000-000000000104","role":"authenticated"}';

-- La semaine type démarre un lundi : on aligne pour que les jours ISO tombent juste.
select set_config('test.tpl',
  (date_trunc('week', public.reunion_today() + 60)::date)::text, false);

select is(
  public.admin_apply_planning_template(
    'dddddddd-0000-4000-8000-000000000103', current_setting('test.tpl')::date),
  2,
  'La semaine type remplit les journées vides'
);
reset role;

select is(
  (select status from public.planning_entries
    where employee_id = 'dddddddd-0000-4000-8000-000000000103'
      and date = current_setting('test.tpl')::date),
  'school',
  'Le lundi de la semaine type est bien un jour d''école'
);

select is(
  (select source from public.planning_entries
    where employee_id = 'dddddddd-0000-4000-8000-000000000103'
      and date = current_setting('test.tpl')::date + 1),
  'template',
  'La journée posée est marquée comme venant de la semaine type'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-0000-4000-8000-000000000104","role":"authenticated"}';
select is(
  public.admin_apply_planning_template(
    'dddddddd-0000-4000-8000-000000000103', current_setting('test.tpl')::date),
  0,
  'Rappliquer la semaine type ne réécrit pas ce qui est déjà arbitré'
);
reset role;

-- ==================================================== cloisonnement lecture ==
set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-0000-4000-8000-000000000101","role":"authenticated"}';

select is(
  (select count(*) from public.planning_entries
    where employee_id <> 'dddddddd-0000-4000-8000-000000000101'),
  0::bigint,
  'Une collaboratrice ne voit aucune ligne de planning qui ne soit la sienne'
);

-- Elle est en congé ce jour-là ; sa collègue y travaille. Elle doit voir qui
-- tient la boutique, sans que son propre congé, ni la boutique d'à côté,
-- n'apparaisse dans cette liste.
select is(
  (select count(*) from public.my_boutique_presence(current_setting('test.dst')::date)),
  1::bigint,
  'Même en congé, elle voit qui tient la boutique ce jour-là'
);

select is(
  (select count(*) from public.my_boutique_presence(current_setting('test.dst')::date)
    where employee_id = 'dddddddd-0000-4000-8000-000000000101'),
  0::bigint,
  'Son propre congé n''apparaît pas dans la présence du jour'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-0000-4000-8000-000000000102","role":"authenticated"}';

select is(
  (select count(*) from public.my_boutique_presence(current_setting('test.dst')::date)
    where employee_id in ('dddddddd-0000-4000-8000-000000000101',
                          'dddddddd-0000-4000-8000-000000000103')),
  0::bigint,
  'Ni la collègue en congé ni celle d''une autre boutique n''apparaissent'
);

reset role;

-- ==================================================== contraintes de table ===
select throws_ok(
  $$insert into public.planning_entries (employee_id, boutique_id, date, status)
    values ('dddddddd-0000-4000-8000-000000000101', 'bbbbbbbb-0000-4000-8000-000000000101',
            public.reunion_today() + 90, 'work')$$,
  '23514', null,
  'Une journée de travail sans horaires est refusée par la base'
);

select throws_ok(
  $$insert into public.planning_entries (employee_id, boutique_id, date, status, start_time, end_time)
    values ('dddddddd-0000-4000-8000-000000000101', 'bbbbbbbb-0000-4000-8000-000000000101',
            public.reunion_today() + 90, 'work', '17:00', '09:00')$$,
  '23514', null,
  'Une journée qui finit avant de commencer est refusée'
);

select * from finish();
rollback;
