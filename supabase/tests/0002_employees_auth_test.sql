-- pgTAP: collaboratrices et authentification par PIN.
--
-- Comme 0001, ces tests tournent sur une base qui contient de vraies personnes.
-- Les fixtures vivent donc dans un point de vente créé pour l'occasion, et
-- chaque affirmation est bornée à ce point de vente ou à ses comptes.

begin;
select plan(40);

-- ---------------------------------------------------------------- fixtures --
insert into public.boutiques (id, code, name, kind, sort_order) values
  ('bbbbbbbb-0000-4000-8000-000000000001', 'TEST_AUTH', 'Boutique de test', 'physical', 9000),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'TEST_VIDE', 'Boutique de test vide', 'physical', 9001);

insert into auth.users (id, email) values
  ('cccccccc-0000-4000-8000-000000000001', 'loubna-test@staff.oummi.invalid'),
  ('cccccccc-0000-4000-8000-000000000002', 'chamyma-test@staff.oummi.invalid'),
  ('cccccccc-0000-4000-8000-000000000003', 'direction-test@oummi.invalid'),
  ('cccccccc-0000-4000-8000-000000000004', 'zoe-test@staff.oummi.invalid');

insert into public.user_roles (user_id, role, boutique_id) values
  ('cccccccc-0000-4000-8000-000000000001', 'employee', null),
  ('cccccccc-0000-4000-8000-000000000002', 'employee', null),
  ('cccccccc-0000-4000-8000-000000000003', 'admin', null);

insert into public.employees (id, auth_user_id, last_name, first_name, display_name,
  boutique_id, contract_type_id, pin_hash, weekly_contract_hours)
values
  ('dddddddd-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001',
   'TESTNOM', 'TestLoubna', 'TestLoubna', 'bbbbbbbb-0000-4000-8000-000000000001',
   (select id from public.contract_types where code = 'CDI'),
   extensions.crypt('7392', extensions.gen_salt('bf')), 35),
  ('dddddddd-0000-4000-8000-000000000002', 'cccccccc-0000-4000-8000-000000000002',
   'TESTNOM', 'TestChamyma', 'TestChamyma', 'bbbbbbbb-0000-4000-8000-000000000001',
   (select id from public.contract_types where code = 'CDD'),
   extensions.crypt('8461', extensions.gen_salt('bf')), 35);

-- ------------------------------------------------------------- le hachage ---
select is(
  (select count(*) from information_schema.column_privileges
    where table_schema = 'public' and table_name = 'employees'
      and column_name = 'pin_hash' and grantee in ('anon', 'authenticated')),
  0::bigint,
  'Aucune session ne peut lire pin_hash, direction comprise'
);

-- Conséquence pratique : toute requête doit nommer ses colonnes. Un `select *`,
-- que le client Supabase envoie par défaut, échoue.
set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-0000-4000-8000-000000000003","role":"authenticated"}';
select throws_ok(
  $$select * from public.employees$$,
  '42501', null,
  'Un « select * » sur les collaboratrices est refusé, il faut nommer les colonnes'
);
select lives_ok(
  $$select id, display_name from public.employees$$,
  'Une sélection de colonnes explicites fonctionne'
);
reset role;

-- -------------------------------------------------------- règles sur le PIN --
select ok(public.is_acceptable_pin('7392'), 'Un PIN à quatre chiffres est accepté');
select ok(not public.is_acceptable_pin('1234'), 'La suite 1234 est refusée');
select ok(not public.is_acceptable_pin('0000'), 'Le code 0000 est refusé');
select ok(not public.is_acceptable_pin('4321'), 'La suite descendante 4321 est refusée');
select ok(not public.is_acceptable_pin('739'), 'Un code à trois chiffres est refusé');
select ok(not public.is_acceptable_pin('73a2'), 'Un code non numérique est refusé');

-- --------------------------------------------------- écran d'avant-connexion --
set local role anon;

select is(
  (select count(*) from public.login_boutiques()
    where id = 'bbbbbbbb-0000-4000-8000-000000000001'),
  1::bigint,
  'Un point de vente ayant une collaboratrice est proposé'
);

select is(
  (select count(*) from public.login_boutiques()
    where id = 'bbbbbbbb-0000-4000-8000-000000000002'),
  0::bigint,
  'Un point de vente sans collaboratrice n''est pas proposé'
);

select is(
  (select string_agg(display_name, ', ' order by display_name)
     from public.login_employees('bbbbbbbb-0000-4000-8000-000000000001')),
  'TestChamyma, TestLoubna',
  'L''écran de connexion propose les prénoms de la boutique'
);

select is(
  (select display_name from public.login_employee('dddddddd-0000-4000-8000-000000000001')),
  'TestLoubna',
  'Une collaboratrice mémorisée est retrouvée par son identifiant'
);

select is(
  (select count(*) from public.login_employee('99999999-9999-4999-8999-999999999999')),
  0::bigint,
  'Un identifiant inconnu ne renvoie rien'
);

select throws_ok(
  $$select 1 from public.employees$$,
  '42501', null,
  'Un visiteur anonyme ne peut pas lire la table des collaboratrices'
);

select throws_ok(
  $$select 1 from public.verify_employee_pin('dddddddd-0000-4000-8000-000000000001', '7392', null)$$,
  '42501', null,
  'Un visiteur anonyme ne peut pas vérifier un code PIN'
);

reset role;

-- Une session valide non plus : seul le serveur peut tenter un code.
set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated"}';

select throws_ok(
  $$select 1 from public.verify_employee_pin('dddddddd-0000-4000-8000-000000000001', '7392', null)$$,
  '42501', null,
  'Une collaboratrice connectée ne peut pas vérifier un code PIN elle-même'
);

select is(
  (select count(*) from public.employees
    where id <> 'dddddddd-0000-4000-8000-000000000001'),
  0::bigint,
  'Une collaboratrice ne voit aucune fiche qui ne soit la sienne'
);

select throws_ok(
  $$select public.reset_employee_pin('dddddddd-0000-4000-8000-000000000002', '2580')$$,
  '42501', null,
  'Une collaboratrice ne peut pas réinitialiser le PIN d''une collègue'
);

reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-0000-4000-8000-000000000003","role":"authenticated"}';
select is(
  (select count(*) from public.employees
    where boutique_id = 'bbbbbbbb-0000-4000-8000-000000000001'),
  2::bigint,
  'La direction voit les fiches de la boutique de test'
);
reset role;

-- ------------------------------------------------------ vérification du PIN --
-- Chaque appel est une instruction distincte, donc la tentative précédente est
-- déjà visible : c'est ce qui fait avancer le compteur d'échecs.
select is((select status from public.verify_employee_pin('dddddddd-0000-4000-8000-000000000001', '7392', null)),
          'ok', 'Le bon code ouvre une session');

select is(
  (select auth_email from public.verify_employee_pin('dddddddd-0000-4000-8000-000000000001', '7392', null)),
  'loubna-test@staff.oummi.invalid',
  'La vérification renvoie l''adresse technique du compte, pas l''email de notification'
);

select is((select status from public.verify_employee_pin('dddddddd-0000-4000-8000-000000000001', '0000', null)),
          'invalid_pin', 'Un mauvais code est refusé');
select is((select attempts_left from public.verify_employee_pin('dddddddd-0000-4000-8000-000000000001', '0000', null)),
          3, 'Le nombre d''essais restants décroît');
select is((select status from public.verify_employee_pin('dddddddd-0000-4000-8000-000000000001', '0000', null)),
          'invalid_pin', 'Troisième échec');
select is((select status from public.verify_employee_pin('dddddddd-0000-4000-8000-000000000001', '0000', null)),
          'invalid_pin', 'Quatrième échec');
select is((select status from public.verify_employee_pin('dddddddd-0000-4000-8000-000000000001', '0000', null)),
          'invalid_pin', 'Cinquième échec');

select is((select status from public.verify_employee_pin('dddddddd-0000-4000-8000-000000000001', '0000', null)),
          'locked', 'Le compte se verrouille au sixième essai');

select is((select status from public.verify_employee_pin('dddddddd-0000-4000-8000-000000000001', '7392', null)),
          'locked', 'Même le bon code est refusé pendant le verrouillage');

select is(
  (select count(*) from public.login_attempts
    where employee_id = 'dddddddd-0000-4000-8000-000000000001' and not success),
  5::bigint,
  'Les essais faits pendant le verrouillage ne le prolongent pas'
);

-- --------------------------------------------------------- réinitialisation --
set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-0000-4000-8000-000000000003","role":"authenticated"}';

select throws_ok(
  $$select public.reset_employee_pin('dddddddd-0000-4000-8000-000000000001', '1234')$$,
  '22023', null,
  'La direction ne peut pas imposer un code trivial'
);

select lives_ok(
  $$select public.reset_employee_pin('dddddddd-0000-4000-8000-000000000001', '2580')$$,
  'La direction réinitialise un code PIN'
);

-- --------------------------------------------------------------- création ---
select throws_ok(
  $$select public.admin_create_employee(null, 'TESTNOM', 'TestZoe', 'TestZoe',
      'bbbbbbbb-0000-4000-8000-000000000001',
      (select id from public.contract_types where code = 'CDI'), '1111')$$,
  '22023', null,
  'La création refuse un code trivial'
);

select lives_ok(
  $$select set_config('test.created', public.admin_create_employee(
      'cccccccc-0000-4000-8000-000000000004', 'TESTNOM', 'TestZoe', 'TestZoe',
      'bbbbbbbb-0000-4000-8000-000000000001',
      (select id from public.contract_types where code = 'CDI'), '7531')::text, false)$$,
  'La direction crée une collaboratrice'
);

reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok(
  $$select public.admin_create_employee(null, 'TESTNOM', 'TestAutre', 'TestAutre',
      'bbbbbbbb-0000-4000-8000-000000000001',
      (select id from public.contract_types where code = 'CDI'), '7531')$$,
  '42501', null,
  'Une collaboratrice ne peut pas créer une collègue'
);
reset role;

select is(
  (select count(*) from public.user_roles
    where user_id = 'cccccccc-0000-4000-8000-000000000004' and role = 'employee'),
  1::bigint,
  'La création pose le rôle employee dans la même transaction'
);

select is(
  (select count(*) from public.audit_log
    where entity_id = current_setting('test.created')::uuid and action = 'employee.created'),
  1::bigint,
  'La création est tracée'
);

select is(
  (select count(*) from public.audit_log
    where entity_id = current_setting('test.created')::uuid and after::text ~ '7531'),
  0::bigint,
  'Le code choisi à la création n''apparaît nulle part dans la trace'
);

select is(
  (select count(*) from public.audit_log
    where entity_id = 'dddddddd-0000-4000-8000-000000000001'
      and action = 'pin.reset' and after::text ~ '2580'),
  0::bigint,
  'La réinitialisation est tracée sans jamais écrire le code'
);

select is((select status from public.verify_employee_pin('dddddddd-0000-4000-8000-000000000001', '2580', null)),
          'ok', 'La réinitialisation lève le verrouillage et le nouveau code fonctionne');

select * from finish();
rollback;
