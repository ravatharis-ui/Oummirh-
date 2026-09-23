-- pgTAP: remplacements directs.
--
-- Ce que ces tests protègent : seule la direction organise un remplacement, une
-- collaboratrice en congé n'est pas déplaçable, et — le point qui compte —
-- **annuler rend au planning exactement ce qu'il avait avant**, sans écraser
-- une décision plus récente.

begin;
select plan(27);

-- ---------------------------------------------------------------- fixtures --
insert into public.boutiques (id, code, name, kind, sort_order) values
  ('bbbbbbbb-0000-4000-8000-000000000601', 'TEST_RPL_A', 'Boutique A', 'physical', 9600),
  ('bbbbbbbb-0000-4000-8000-000000000602', 'TEST_RPL_B', 'Boutique B', 'physical', 9601);

insert into auth.users (id, email) values
  ('cccccccc-0000-4000-8000-000000000601', 'rpl-a@staff.oummi.invalid'),
  ('cccccccc-0000-4000-8000-000000000602', 'rpl-b@staff.oummi.invalid'),
  ('cccccccc-0000-4000-8000-000000000603', 'rpl-direction@oummi.invalid');

insert into public.user_roles (user_id, role, boutique_id) values
  ('cccccccc-0000-4000-8000-000000000601', 'employee', null),
  ('cccccccc-0000-4000-8000-000000000602', 'employee', null),
  ('cccccccc-0000-4000-8000-000000000603', 'admin', null);

insert into public.employees (id, auth_user_id, last_name, first_name, display_name,
  boutique_id, contract_type_id, pin_hash)
values
  ('dddddddd-0000-4000-8000-000000000601', 'cccccccc-0000-4000-8000-000000000601',
   'TESTRPL', 'RplAnna', 'RplAnna', 'bbbbbbbb-0000-4000-8000-000000000601',
   (select id from public.contract_types where code = 'CDI'),
   extensions.crypt('7392', extensions.gen_salt('bf'))),
  ('dddddddd-0000-4000-8000-000000000602', 'cccccccc-0000-4000-8000-000000000602',
   'TESTRPL', 'RplBea', 'RplBea', 'bbbbbbbb-0000-4000-8000-000000000601',
   (select id from public.contract_types where code = 'CDI'),
   extensions.crypt('8461', extensions.gen_salt('bf')));

select set_config('test.day', (public.reunion_today() + 5)::text, false);

-- Anna travaille dans sa boutique ce jour-là. Béa est en congé.
insert into public.planning_entries (employee_id, boutique_id, date, status,
  start_time, end_time, source)
values
  ('dddddddd-0000-4000-8000-000000000601', 'bbbbbbbb-0000-4000-8000-000000000601',
   (public.reunion_today() + 5), 'work', '09:00', '17:30', 'manual');

insert into public.planning_entries (employee_id, boutique_id, date, status, source)
values
  ('dddddddd-0000-4000-8000-000000000602', 'bbbbbbbb-0000-4000-8000-000000000601',
   (public.reunion_today() + 5), 'leave', 'leave');

-- ================================================================= grants ====
select is(
  (select count(*) from information_schema.table_privileges
    where table_schema = 'public' and table_name = 'direct_replacements'
      and grantee = 'authenticated' and privilege_type <> 'SELECT'),
  0::bigint,
  'Une session ne peut que lire les remplacements'
);

select is(
  (select count(*) from information_schema.table_privileges
    where table_schema = 'public'
      and table_name in ('direct_replacements', 'planning_snapshots')
      and grantee = 'anon'),
  0::bigint,
  'Un visiteur anonyme n''a aucun droit sur les remplacements'
);

-- ===================================================== qui est disponible ====
set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-0000-4000-8000-000000000601","role":"authenticated"}';

select throws_ok(
  $$select public.admin_replacement_candidates(current_setting('test.day')::date)$$,
  '42501', null,
  'Une collaboratrice ne consulte pas les disponibilités de l''équipe'
);

select throws_ok(
  $$select public.admin_create_replacement(
      'dddddddd-0000-4000-8000-000000000601', 'bbbbbbbb-0000-4000-8000-000000000602',
      current_setting('test.day')::date, '09:00', '17:00')$$,
  '42501', null,
  'Une collaboratrice ne s''envoie pas elle-même en remplacement'
);

reset role;
set local request.jwt.claims = '';

set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-0000-4000-8000-000000000603","role":"authenticated"}';

select is(
  (select availability from public.admin_replacement_candidates(
     current_setting('test.day')::date, 'bbbbbbbb-0000-4000-8000-000000000602')
    where employee_id = 'dddddddd-0000-4000-8000-000000000601'),
  'working_elsewhere',
  'Celle qui travaille ailleurs est signalée comme telle, pas exclue'
);

select is(
  (select availability from public.admin_replacement_candidates(
     current_setting('test.day')::date, 'bbbbbbbb-0000-4000-8000-000000000602')
    where employee_id = 'dddddddd-0000-4000-8000-000000000602'),
  'unavailable',
  'Celle qui est en congé est indisponible'
);

-- ============================================================ la création ====
select throws_ok(
  $$select public.admin_create_replacement(
      'dddddddd-0000-4000-8000-000000000602', 'bbbbbbbb-0000-4000-8000-000000000602',
      current_setting('test.day')::date, '09:00', '17:00')$$,
  '22023', null,
  'On n''envoie pas en remplacement quelqu''un en congé'
);

select throws_ok(
  $$select public.admin_create_replacement(
      'dddddddd-0000-4000-8000-000000000601', 'bbbbbbbb-0000-4000-8000-000000000602',
      public.reunion_today() - 1, '09:00', '17:00')$$,
  '22023', null,
  'On n''organise pas un remplacement pour hier'
);

select lives_ok(
  $$select set_config('test.rpl',
      public.admin_create_replacement(
        'dddddddd-0000-4000-8000-000000000601', 'bbbbbbbb-0000-4000-8000-000000000602',
        current_setting('test.day')::date, '10:00', '18:00', null, null,
        'Renfort soldes')::text, false)$$,
  'La direction organise un remplacement'
);

select throws_ok(
  $$select public.admin_create_replacement(
      'dddddddd-0000-4000-8000-000000000601', 'bbbbbbbb-0000-4000-8000-000000000602',
      current_setting('test.day')::date, '09:00', '17:00')$$,
  '23505', null,
  'Deux boutiques ne peuvent pas l''attendre le même jour'
);

reset role;
set local request.jwt.claims = '';

select is(
  (select count(*) from public.domain_events
    where type = 'remplacements.created' and payload->>'id' = current_setting('test.rpl')),
  1::bigint,
  'Le planning est prévenu'
);

-- ======================================= le planning applique, puis rend =====
select is(
  public.apply_planning_from_event(
    'dddddddd-0000-4000-8000-000000000601',
    current_setting('test.day')::date, current_setting('test.day')::date,
    'replacement', 'replacement', current_setting('test.rpl')::uuid,
    'bbbbbbbb-0000-4000-8000-000000000602', '10:00', '18:00'),
  1,
  'Le planning pose la journée de remplacement'
);

select is(
  (select boutique_id from public.planning_entries
    where employee_id = 'dddddddd-0000-4000-8000-000000000601'
      and date = current_setting('test.day')::date),
  'bbbbbbbb-0000-4000-8000-000000000602'::uuid,
  'Elle est attendue dans l''autre boutique'
);

select is(
  (select start_time from public.planning_entries
    where employee_id = 'dddddddd-0000-4000-8000-000000000601'
      and date = current_setting('test.day')::date),
  '10:00'::time,
  'Avec les horaires du remplacement'
);

select is(
  (select count(*) from public.planning_snapshots
    where source = 'replacement' and source_ref = current_setting('test.rpl')::uuid),
  1::bigint,
  'Un cliché de la journée d''origine a été gardé'
);

-- Rejouer l'événement ne doit pas remplacer le cliché par la ligne déjà posée :
-- c'est l'erreur qui rendrait l'annulation inutile.
select is(
  public.apply_planning_from_event(
    'dddddddd-0000-4000-8000-000000000601',
    current_setting('test.day')::date, current_setting('test.day')::date,
    'replacement', 'replacement', current_setting('test.rpl')::uuid,
    'bbbbbbbb-0000-4000-8000-000000000602', '10:00', '18:00'),
  1,
  'Le même événement peut être rejoué'
);

select is(
  (select entry->>'start_time' from public.planning_snapshots
    where source = 'replacement' and source_ref = current_setting('test.rpl')::uuid),
  '09:00:00',
  'Et le cliché montre toujours la journée d''origine, pas celle du remplacement'
);

-- --------------------------------------------------------- l'annulation -----
set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-0000-4000-8000-000000000603","role":"authenticated"}';
select lives_ok(
  $$select public.admin_cancel_replacement(current_setting('test.rpl')::uuid)$$,
  'La direction annule le remplacement'
);
reset role;
set local request.jwt.claims = '';

select is(
  public.clear_planning_from_event('replacement', current_setting('test.rpl')::uuid),
  1,
  'Le planning libère la journée'
);

select is(
  (select boutique_id from public.planning_entries
    where employee_id = 'dddddddd-0000-4000-8000-000000000601'
      and date = current_setting('test.day')::date),
  'bbbbbbbb-0000-4000-8000-000000000601'::uuid,
  'Elle est rendue à sa boutique d''origine'
);

select is(
  (select start_time from public.planning_entries
    where employee_id = 'dddddddd-0000-4000-8000-000000000601'
      and date = current_setting('test.day')::date),
  '09:00'::time,
  'Avec ses horaires d''avant : annuler rend ce qu''on avait pris'
);

select is(
  (select source from public.planning_entries
    where employee_id = 'dddddddd-0000-4000-8000-000000000601'
      and date = current_setting('test.day')::date),
  'manual',
  'Et la journée redevient une saisie de la direction'
);

select is(
  (select count(*) from public.planning_snapshots
    where source_ref = current_setting('test.rpl')::uuid),
  0::bigint,
  'Le cliché est consommé'
);

-- ============== une décision plus récente ne se laisse pas défaire ==========
set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-0000-4000-8000-000000000603","role":"authenticated"}';

select lives_ok(
  $$select set_config('test.rpl2',
      public.admin_create_replacement(
        'dddddddd-0000-4000-8000-000000000601', 'bbbbbbbb-0000-4000-8000-000000000602',
        current_setting('test.day')::date + 1, '10:00', '18:00')::text, false)$$,
  'Un second remplacement est organisé'
);

reset role;
set local request.jwt.claims = '';

select is(
  public.apply_planning_from_event(
    'dddddddd-0000-4000-8000-000000000601',
    current_setting('test.day')::date + 1, current_setting('test.day')::date + 1,
    'replacement', 'replacement', current_setting('test.rpl2')::uuid,
    'bbbbbbbb-0000-4000-8000-000000000602', '10:00', '18:00'),
  1,
  'Le planning le pose'
);

-- La direction reprend la journée à la main : sa décision est plus récente.
set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-0000-4000-8000-000000000603","role":"authenticated"}';
select lives_ok(
  $$select public.admin_upsert_planning_entry(
      'dddddddd-0000-4000-8000-000000000601', current_setting('test.day')::date + 1,
      'work', '08:00', '12:00')$$,
  'La direction reprend la journée à la main'
);
reset role;
set local request.jwt.claims = '';

select is(
  (select start_time from public.planning_entries
    where employee_id = 'dddddddd-0000-4000-8000-000000000601'
      and date = current_setting('test.day')::date + 1),
  '08:00'::time,
  'Annuler le remplacement ne défait pas la saisie manuelle qui a suivi'
);

select * from finish();
rollback;
