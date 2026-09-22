-- pgTAP: collaboratrices et authentification par PIN.
--
-- Prouve que le hachage d'un PIN n'est lisible par personne, que l'écran
-- d'avant-connexion n'expose que des prénoms, que le verrouillage tient après
-- cinq échecs, et que seule la direction peut réinitialiser un code.

begin;
select plan(39);

-- ---------------------------------------------------------------- fixtures --
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'loubna@staff.oummi.invalid'),
  ('22222222-2222-2222-2222-222222222222', 'chamyma@staff.oummi.invalid'),
  ('33333333-3333-3333-3333-333333333333', 'direction@oummi.invalid');

insert into public.user_roles (user_id, role, boutique_id) values
  ('11111111-1111-1111-1111-111111111111', 'employee', null),
  ('22222222-2222-2222-2222-222222222222', 'employee', null),
  ('33333333-3333-3333-3333-333333333333', 'admin', null);

insert into public.employees (id, auth_user_id, last_name, first_name, display_name,
  boutique_id, contract_type_id, pin_hash, weekly_contract_hours)
values
  ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111',
   'ADAM', 'Loubna', 'Loubna',
   (select id from public.boutiques where code = 'STDENIS'),
   (select id from public.contract_types where code = 'CDI'),
   extensions.crypt('7392', extensions.gen_salt('bf')), 35),
  ('55555555-5555-5555-5555-555555555555', '22222222-2222-2222-2222-222222222222',
   'ADAM', 'Chamyma', 'Chamyma',
   (select id from public.boutiques where code = 'STDENIS'),
   (select id from public.contract_types where code = 'CDD'),
   extensions.crypt('8461', extensions.gen_salt('bf')), 35);

-- ----------------------------------------------------------- le hachage -----
select is(
  (select count(*) from information_schema.column_privileges
    where table_schema = 'public' and table_name = 'employees'
      and column_name = 'pin_hash' and grantee in ('anon', 'authenticated')),
  0::bigint,
  'Aucune session ne peut lire pin_hash, direction comprise'
);

-- Conséquence pratique du refus sur pin_hash : toute requête doit nommer ses
-- colonnes. Un `select *`, que le client Supabase envoie par défaut, échoue.
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
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

select ok(public.is_acceptable_pin('7392'), 'Un PIN à quatre chiffres est accepté');
select ok(not public.is_acceptable_pin('1234'), 'La suite 1234 est refusée');
select ok(not public.is_acceptable_pin('0000'), 'Le code 0000 est refusé');
select ok(not public.is_acceptable_pin('4321'), 'La suite descendante 4321 est refusée');
select ok(not public.is_acceptable_pin('739'), 'Un code à trois chiffres est refusé');
select ok(not public.is_acceptable_pin('73a2'), 'Un code non numérique est refusé');

-- --------------------------------------------------- écran d'avant-connexion --
set local role anon;

select is(
  (select count(*) from public.login_boutiques()),
  1::bigint,
  'Seuls les points de vente ayant une collaboratrice sont proposés'
);

select is(
  (select string_agg(display_name, ', ' order by display_name)
     from public.login_employees((select b.id from public.login_boutiques() b limit 1))),
  'Chamyma, Loubna',
  'L''écran de connexion propose les prénoms de la boutique'
);

select is(
  (select display_name from public.login_employee('44444444-4444-4444-4444-444444444444')),
  'Loubna',
  'Une collaboratrice mémorisée est retrouvée par son identifiant'
);

select is(
  (select count(*) from public.login_employee('99999999-9999-9999-9999-999999999999')),
  0::bigint,
  'Un identifiant inconnu ne renvoie rien'
);

select throws_ok(
  $$select 1 from public.employees$$,
  '42501', null,
  'Un visiteur anonyme ne peut pas lire la table des collaboratrices'
);

select throws_ok(
  $$select 1 from public.verify_employee_pin('44444444-4444-4444-4444-444444444444', '7392', null)$$,
  '42501', null,
  'Un visiteur anonyme ne peut pas vérifier un code PIN'
);

reset role;

-- ------------------------------------------------------------ cloisonnement --
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select is((select count(*) from public.employees), 1::bigint,
          'Une collaboratrice ne voit que sa propre fiche');

select throws_ok(
  $$select public.reset_employee_pin('55555555-5555-5555-5555-555555555555', '2580')$$,
  '42501', null,
  'Une collaboratrice ne peut pas réinitialiser le PIN d''une collègue'
);

reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
select is((select count(*) from public.employees), 2::bigint,
          'La direction voit toutes les fiches');
reset role;

-- ------------------------------------------------------ vérification du PIN --
-- Chaque appel est une instruction distincte, donc la tentative précédente est
-- déjà visible : c'est ce qui fait avancer le compteur d'échecs.
select is((select status from public.verify_employee_pin('44444444-4444-4444-4444-444444444444', '7392', null)),
          'ok', 'Le bon code ouvre une session');

select is(
  (select auth_email from public.verify_employee_pin('44444444-4444-4444-4444-444444444444', '7392', null)),
  'loubna@staff.oummi.invalid',
  'La vérification renvoie l''adresse technique du compte, pas l''email de notification'
);

select is((select status from public.verify_employee_pin('44444444-4444-4444-4444-444444444444', '0000', null)),
          'invalid_pin', 'Un mauvais code est refusé');
select is((select attempts_left from public.verify_employee_pin('44444444-4444-4444-4444-444444444444', '0000', null)),
          3, 'Le nombre d''essais restants décroît');
select is((select status from public.verify_employee_pin('44444444-4444-4444-4444-444444444444', '0000', null)),
          'invalid_pin', 'Troisième échec');
select is((select status from public.verify_employee_pin('44444444-4444-4444-4444-444444444444', '0000', null)),
          'invalid_pin', 'Quatrième échec');
select is((select status from public.verify_employee_pin('44444444-4444-4444-4444-444444444444', '0000', null)),
          'invalid_pin', 'Cinquième échec');

select is((select status from public.verify_employee_pin('44444444-4444-4444-4444-444444444444', '0000', null)),
          'locked', 'Le compte se verrouille au sixième essai');

select is((select status from public.verify_employee_pin('44444444-4444-4444-4444-444444444444', '7392', null)),
          'locked', 'Même le bon code est refusé pendant le verrouillage');

select is(
  (select count(*) from public.login_attempts
    where employee_id = '44444444-4444-4444-4444-444444444444' and not success),
  5::bigint,
  'Les essais faits pendant le verrouillage ne le prolongent pas'
);

-- --------------------------------------------------------- réinitialisation --
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select throws_ok(
  $$select public.reset_employee_pin('44444444-4444-4444-4444-444444444444', '1234')$$,
  '22023', null,
  'La direction ne peut pas imposer un code trivial'
);

select lives_ok(
  $$select public.reset_employee_pin('44444444-4444-4444-4444-444444444444', '2580')$$,
  'La direction réinitialise un code PIN'
);

reset role;

select is((select status from public.verify_employee_pin('44444444-4444-4444-4444-444444444444', '2580', null)),
          'ok', 'La réinitialisation lève le verrouillage et le nouveau code fonctionne');

select is(
  (select count(*) from public.audit_log
    where action = 'pin.reset' and after::text !~ '2580'),
  1::bigint,
  'La réinitialisation est tracée sans jamais écrire le code'
);

-- ---------------------------------------------------------------- création --
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select throws_ok(
  $$select public.admin_create_employee(null, 'HOARAU', 'Zoé', 'Zoé',
      (select id from public.boutiques where code = 'ONLINE'),
      (select id from public.contract_types where code = 'CDI'), '7531')$$,
  '42501', null,
  'Une collaboratrice ne peut pas créer une collègue'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select throws_ok(
  $$select public.admin_create_employee(null, 'HOARAU', 'Zoé', 'Zoé',
      (select id from public.boutiques where code = 'ONLINE'),
      (select id from public.contract_types where code = 'CDI'), '1111')$$,
  '22023', null,
  'La création refuse un code trivial'
);

select lives_ok(
  $$select public.admin_create_employee(null, 'HOARAU', 'Zoé', 'Zoé',
      (select id from public.boutiques where code = 'ONLINE'),
      (select id from public.contract_types where code = 'CDI'), '7531')$$,
  'La direction crée une collaboratrice'
);

reset role;

select is(
  (select count(*) from public.audit_log where action = 'employee.created'),
  1::bigint,
  'La création est tracée'
);

-- Un compte créé sans rôle ne pourrait jamais se connecter : la fonction le pose.
insert into auth.users (id, email) values
  ('66666666-6666-6666-6666-666666666666', 'zoe@staff.oummi.invalid');
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
select lives_ok(
  $$select public.admin_create_employee('66666666-6666-6666-6666-666666666666',
      'HOARAU', 'Zoé', 'Zoé',
      (select id from public.boutiques where code = 'ONLINE'),
      (select id from public.contract_types where code = 'CDI'), '7531')$$,
  'La création accepte un compte de connexion'
);
reset role;

select is(
  (select count(*) from public.user_roles
    where user_id = '66666666-6666-6666-6666-666666666666' and role = 'employee'),
  1::bigint,
  'La création pose le rôle employee dans la même transaction'
);

select is(
  (select count(*) from public.audit_log
    where action = 'employee.created' and after::text ~ '7531'),
  0::bigint,
  'Le code choisi à la création n''apparaît nulle part dans la trace'
);

select * from finish();
rollback;
