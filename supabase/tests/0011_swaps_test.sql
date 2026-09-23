-- pgTAP: échanges de créneaux.
--
-- Ce que ces tests protègent : la double validation dans le bon ordre, les
-- contrôles qui empêchent d'échanger ce qui ne s'échange pas, et l'échange
-- lui-même — les deux journées changent bien de propriétaire, et rejouer
-- l'événement ne les réinverse pas.

begin;
select plan(34);

-- ---------------------------------------------------------------- fixtures --
insert into public.boutiques (id, code, name, kind, sort_order) values
  ('bbbbbbbb-0000-4000-8000-000000000701', 'TEST_SWP', 'Boutique échanges', 'physical', 9700);

insert into auth.users (id, email) values
  ('cccccccc-0000-4000-8000-000000000701', 'swp-a@staff.oummi.invalid'),
  ('cccccccc-0000-4000-8000-000000000702', 'swp-b@staff.oummi.invalid'),
  ('cccccccc-0000-4000-8000-000000000703', 'swp-c@staff.oummi.invalid'),
  ('cccccccc-0000-4000-8000-000000000704', 'swp-direction@oummi.invalid');

insert into public.user_roles (user_id, role, boutique_id) values
  ('cccccccc-0000-4000-8000-000000000701', 'employee', null),
  ('cccccccc-0000-4000-8000-000000000702', 'employee', null),
  ('cccccccc-0000-4000-8000-000000000703', 'employee', null),
  ('cccccccc-0000-4000-8000-000000000704', 'admin', null);

insert into public.employees (id, auth_user_id, last_name, first_name, display_name,
  boutique_id, contract_type_id, pin_hash)
values
  ('dddddddd-0000-4000-8000-000000000701', 'cccccccc-0000-4000-8000-000000000701',
   'TESTSWP', 'SwpAnna', 'SwpAnna', 'bbbbbbbb-0000-4000-8000-000000000701',
   (select id from public.contract_types where code = 'CDI'),
   extensions.crypt('7392', extensions.gen_salt('bf'))),
  ('dddddddd-0000-4000-8000-000000000702', 'cccccccc-0000-4000-8000-000000000702',
   'TESTSWP', 'SwpBea', 'SwpBea', 'bbbbbbbb-0000-4000-8000-000000000701',
   (select id from public.contract_types where code = 'CDI'),
   extensions.crypt('8461', extensions.gen_salt('bf'))),
  ('dddddddd-0000-4000-8000-000000000703', 'cccccccc-0000-4000-8000-000000000703',
   'TESTSWP', 'SwpCora', 'SwpCora', 'bbbbbbbb-0000-4000-8000-000000000701',
   (select id from public.contract_types where code = 'CDI'),
   extensions.crypt('5173', extensions.gen_salt('bf')));

select set_config('test.d1', (public.reunion_today() + 8)::text, false);
select set_config('test.d2', (public.reunion_today() + 9)::text, false);

-- Anna travaille le jour 1 ; Béa travaille le jour 2 ; Cora est en congé le jour 2.
insert into public.planning_entries (employee_id, boutique_id, date, status,
  start_time, end_time, source)
values
  ('dddddddd-0000-4000-8000-000000000701', 'bbbbbbbb-0000-4000-8000-000000000701',
   (public.reunion_today() + 8), 'work', '09:00', '17:00', 'manual'),
  ('dddddddd-0000-4000-8000-000000000702', 'bbbbbbbb-0000-4000-8000-000000000701',
   (public.reunion_today() + 9), 'work', '13:00', '19:00', 'manual');

insert into public.planning_entries (employee_id, boutique_id, date, status, source)
values
  ('dddddddd-0000-4000-8000-000000000703', 'bbbbbbbb-0000-4000-8000-000000000701',
   (public.reunion_today() + 9), 'leave', 'leave');

-- ================================================================= grants ====
select is(
  (select count(*) from information_schema.table_privileges
    where table_schema = 'public' and table_name = 'shift_swaps'
      and grantee = 'authenticated' and privilege_type <> 'SELECT'),
  0::bigint,
  'Une session ne peut que lire les échanges'
);

select is(
  (select count(*) from information_schema.table_privileges
    where table_schema = 'public' and table_name = 'shift_swaps' and grantee = 'anon'),
  0::bigint,
  'Un visiteur anonyme n''a aucun droit sur les échanges'
);

-- ============================================================ les contrôles ==
set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-0000-4000-8000-000000000701","role":"authenticated"}';

select throws_ok(
  $$select public.request_swap('dddddddd-0000-4000-8000-000000000701',
      current_setting('test.d1')::date, current_setting('test.d2')::date)$$,
  '22023', null,
  'On n''échange pas une journée avec soi-même'
);

select throws_ok(
  $$select public.request_swap('dddddddd-0000-4000-8000-000000000702',
      public.reunion_today() - 1, current_setting('test.d2')::date)$$,
  '22023', null,
  'Une journée passée ne s''échange pas'
);

select throws_ok(
  $$select public.request_swap('dddddddd-0000-4000-8000-000000000703',
      current_setting('test.d1')::date, current_setting('test.d2')::date)$$,
  '22023', null,
  'On ne récupère pas la journée de congé d''une collègue'
);

select lives_ok(
  $$select set_config('test.swap',
      public.request_swap('dddddddd-0000-4000-8000-000000000702',
        current_setting('test.d1')::date, current_setting('test.d2')::date,
        'Je dois emmener ma fille chez le médecin')::text, false)$$,
  'La demande d''échange est déposée'
);

select throws_ok(
  $$select public.request_swap('dddddddd-0000-4000-8000-000000000703',
      current_setting('test.d1')::date, current_setting('test.d1')::date + 30)$$,
  '23505', null,
  'La même journée ne se négocie pas deux fois à la fois'
);

reset role;
set local request.jwt.claims = '';

select is(
  (select status from public.shift_swaps where id = current_setting('test.swap')::uuid),
  'pending_partner',
  'La collègue est consultée en premier'
);

select is(
  (select count(*) from public.domain_events
    where type = 'swaps.requested' and payload->>'id' = current_setting('test.swap')),
  1::bigint,
  'Elle est prévenue par un événement'
);

-- ======================================================== l'ordre compte =====
set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-0000-4000-8000-000000000704","role":"authenticated"}';

select throws_ok(
  $$select public.admin_decide_swap(current_setting('test.swap')::uuid, true)$$,
  '22023', null,
  'La direction ne tranche pas avant que la collègue ait répondu'
);

reset role;
set local request.jwt.claims = '';

set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-0000-4000-8000-000000000703","role":"authenticated"}';

select throws_ok(
  $$select public.partner_decide_swap(current_setting('test.swap')::uuid, true)$$,
  '42501', null,
  'Une tierce personne ne répond pas à la place de la collègue'
);

select is(
  (select count(*) from public.shift_swaps
    where id = current_setting('test.swap')::uuid),
  0::bigint,
  'Et elle ne voit même pas cet échange'
);

reset role;
set local request.jwt.claims = '';

-- ============================================== la collègue, puis la direction
set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-0000-4000-8000-000000000702","role":"authenticated"}';

select is(
  (select count(*) from public.shift_swaps where id = current_setting('test.swap')::uuid),
  1::bigint,
  'La collègue concernée, elle, voit la demande'
);

select lives_ok(
  $$select public.partner_decide_swap(current_setting('test.swap')::uuid, true)$$,
  'La collègue accepte'
);

select throws_ok(
  $$select public.partner_decide_swap(current_setting('test.swap')::uuid, false)$$,
  '22023', null,
  'Elle ne répond pas deux fois'
);

reset role;
set local request.jwt.claims = '';

select is(
  (select status from public.shift_swaps where id = current_setting('test.swap')::uuid),
  'pending_admin',
  'La demande passe à la direction'
);

-- L'annulation reste possible tant que la direction n'a pas tranché.
set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-0000-4000-8000-000000000702","role":"authenticated"}';
select throws_ok(
  $$select public.cancel_swap(current_setting('test.swap')::uuid)$$,
  '42501', null,
  'La collègue n''annule pas la demande d''une autre'
);
reset role;
set local request.jwt.claims = '';

set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-0000-4000-8000-000000000704","role":"authenticated"}';

select lives_ok(
  $$select public.admin_decide_swap(current_setting('test.swap')::uuid, true, 'D''accord')$$,
  'La direction valide'
);

reset role;
set local request.jwt.claims = '';

select is(
  (select status from public.shift_swaps where id = current_setting('test.swap')::uuid),
  'approved',
  'L''échange est validé'
);

select is(
  (select count(*) from public.audit_log where action = 'swap.approved'),
  1::bigint,
  'La décision est journalisée'
);

-- Une fois validé, on n'annule plus : deux personnes ont organisé leur semaine.
set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-0000-4000-8000-000000000701","role":"authenticated"}';
select throws_ok(
  $$select public.cancel_swap(current_setting('test.swap')::uuid)$$,
  '22023', null,
  'Un échange validé ne s''annule plus'
);
reset role;
set local request.jwt.claims = '';

-- ====================================== le planning échange les journées =====
select is(
  public.apply_planning_swap(
    current_setting('test.swap')::uuid,
    'dddddddd-0000-4000-8000-000000000701', current_setting('test.d1')::date,
    'dddddddd-0000-4000-8000-000000000702', current_setting('test.d2')::date),
  true,
  'Le planning applique l''échange'
);

select is(
  (select start_time from public.planning_entries
    where employee_id = 'dddddddd-0000-4000-8000-000000000702'
      and date = current_setting('test.d1')::date),
  '09:00'::time,
  'La collègue reprend la journée cédée, avec ses horaires'
);

select is(
  (select start_time from public.planning_entries
    where employee_id = 'dddddddd-0000-4000-8000-000000000701'
      and date = current_setting('test.d2')::date),
  '13:00'::time,
  'Et la demandeuse récupère celle de sa collègue'
);

select is(
  (select status from public.planning_entries
    where employee_id = 'dddddddd-0000-4000-8000-000000000701'
      and date = current_setting('test.d1')::date),
  'rest',
  'La journée cédée devient du repos pour la demandeuse'
);

select is(
  (select status from public.planning_entries
    where employee_id = 'dddddddd-0000-4000-8000-000000000702'
      and date = current_setting('test.d2')::date),
  'rest',
  'Et réciproquement pour la collègue'
);

select is(
  (select source from public.planning_entries
    where employee_id = 'dddddddd-0000-4000-8000-000000000702'
      and date = current_setting('test.d1')::date),
  'swap',
  'Les journées portent la marque de l''échange'
);

select is(
  (select public.planning_protected_sources() @> array['swap']),
  true,
  'Une journée échangée est protégée d''une duplication de semaine'
);

select is(
  public.apply_planning_swap(
    current_setting('test.swap')::uuid,
    'dddddddd-0000-4000-8000-000000000701', current_setting('test.d1')::date,
    'dddddddd-0000-4000-8000-000000000702', current_setting('test.d2')::date),
  false,
  'Rejouer l''événement ne réinverse pas l''échange'
);

select is(
  (select start_time from public.planning_entries
    where employee_id = 'dddddddd-0000-4000-8000-000000000702'
      and date = current_setting('test.d1')::date),
  '09:00'::time,
  'Et les journées n''ont pas bougé'
);

-- ============================== permuter deux horaires d'une même journée ====
select set_config('test.d3', (public.reunion_today() + 20)::text, false);

insert into public.planning_entries (employee_id, boutique_id, date, status,
  start_time, end_time, source)
values
  ('dddddddd-0000-4000-8000-000000000701', 'bbbbbbbb-0000-4000-8000-000000000701',
   (public.reunion_today() + 20), 'work', '08:00', '14:00', 'manual'),
  ('dddddddd-0000-4000-8000-000000000702', 'bbbbbbbb-0000-4000-8000-000000000701',
   (public.reunion_today() + 20), 'work', '14:00', '20:00', 'manual');

set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-0000-4000-8000-000000000701","role":"authenticated"}';

select lives_ok(
  $$select set_config('test.swap2',
      public.request_swap('dddddddd-0000-4000-8000-000000000702',
        current_setting('test.d3')::date, current_setting('test.d3')::date)::text, false)$$,
  'Deux collègues peuvent permuter leurs horaires d''une même journée'
);

reset role;
set local request.jwt.claims = '';

select is(
  public.apply_planning_swap(
    current_setting('test.swap2')::uuid,
    'dddddddd-0000-4000-8000-000000000701', current_setting('test.d3')::date,
    'dddddddd-0000-4000-8000-000000000702', current_setting('test.d3')::date),
  true,
  'Le planning applique la permutation'
);

select is(
  (select start_time from public.planning_entries
    where employee_id = 'dddddddd-0000-4000-8000-000000000701'
      and date = current_setting('test.d3')::date),
  '14:00'::time,
  'Elle prend l''après-midi de sa collègue'
);

select is(
  (select start_time from public.planning_entries
    where employee_id = 'dddddddd-0000-4000-8000-000000000702'
      and date = current_setting('test.d3')::date),
  '08:00'::time,
  'Et sa collègue prend son matin : personne ne se retrouve au repos'
);

select * from finish();
rollback;
