-- pgTAP: paramétrage par la direction.
--
-- Ce que ces tests protègent : les données de référence ne s'écrivent plus en
-- direct, même par la direction ; chaque modification laisse une trace ; un
-- réglage inventé est refusé ; et un point de vente où travaillent encore des
-- gens ne se ferme pas.

begin;
select plan(29);

-- ---------------------------------------------------------------- fixtures --
insert into public.boutiques (id, code, name, kind, sort_order) values
  ('bbbbbbbb-0000-4000-8000-000000000501', 'TEST_SET', 'Boutique réglages', 'physical', 9500);

insert into auth.users (id, email) values
  ('cccccccc-0000-4000-8000-000000000501', 'set-a@staff.oummi.invalid'),
  ('cccccccc-0000-4000-8000-000000000502', 'set-direction@oummi.invalid');

insert into public.user_roles (user_id, role, boutique_id) values
  ('cccccccc-0000-4000-8000-000000000501', 'employee', null),
  ('cccccccc-0000-4000-8000-000000000502', 'admin', null);

insert into public.employees (id, auth_user_id, last_name, first_name, display_name,
  boutique_id, contract_type_id, pin_hash)
values
  ('dddddddd-0000-4000-8000-000000000501', 'cccccccc-0000-4000-8000-000000000501',
   'TESTSET', 'SetAnna', 'SetAnna', 'bbbbbbbb-0000-4000-8000-000000000501',
   (select id from public.contract_types where code = 'CDI'),
   extensions.crypt('7392', extensions.gen_salt('bf')));

-- ======================================================= la porte de derrière =
select is(
  (select count(*) from information_schema.table_privileges
    where table_schema = 'public'
      and table_name in ('settings', 'boutiques', 'contract_types', 'public_holidays')
      and grantee = 'authenticated' and privilege_type <> 'SELECT'),
  0::bigint,
  'Aucune session ne peut écrire dans les données de référence'
);

select is(
  (select count(*) from information_schema.routine_privileges
    where routine_schema = 'public' and grantee = 'anon'
      and routine_name in ('admin_set_setting', 'admin_upsert_boutique',
                           'admin_set_boutique_active', 'admin_set_public_holiday',
                           'admin_remove_public_holiday', 'admin_upsert_contract_type')),
  0::bigint,
  'Aucune fonction de paramétrage n''est ouverte à un visiteur anonyme'
);

-- ================================================== une collaboratrice, non ==
set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-0000-4000-8000-000000000501","role":"authenticated"}';

select throws_ok(
  $$select public.admin_set_setting('late_tolerance_minutes', '60'::jsonb)$$,
  '42501', null,
  'Une collaboratrice ne change pas la tolérance de retard'
);

select throws_ok(
  $$select public.admin_upsert_boutique('PIRATE', 'Ma boutique')$$,
  '42501', null,
  'Une collaboratrice ne crée pas de point de vente'
);

select throws_ok(
  $$select public.admin_set_public_holiday('2027-06-15', 'Mon anniversaire')$$,
  '42501', null,
  'Une collaboratrice ne décrète pas un jour férié'
);

select throws_ok(
  $$update public.settings set value = '99'::jsonb where key = 'late_tolerance_minutes'$$,
  '42501', null,
  'Et elle ne passe pas non plus par la table'
);

reset role;
set local request.jwt.claims = '';

-- ================================================= la direction, par la porte =
set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-0000-4000-8000-000000000502","role":"authenticated"}';

select throws_ok(
  $$update public.settings set value = '99'::jsonb where key = 'late_tolerance_minutes'$$,
  '42501', null,
  'La direction non plus n''écrit pas directement dans les réglages'
);

select lives_ok(
  $$select public.admin_set_setting('late_tolerance_minutes', '15'::jsonb)$$,
  'La direction change un réglage par la fonction prévue'
);

select throws_ok(
  $$select public.admin_set_setting('tolerance_de_retard', '15'::jsonb)$$,
  '23503', null,
  'Un réglage inventé par une faute de frappe est refusé'
);

select throws_ok(
  $$select public.admin_set_setting('late_tolerance_minutes', null)$$,
  '22023', null,
  'Un réglage ne peut pas être vidé'
);

reset role;
set local request.jwt.claims = '';

select is(
  (select value from public.settings where key = 'late_tolerance_minutes'),
  '15'::jsonb,
  'La nouvelle valeur est en place'
);

select is(
  (select count(*) from public.audit_log
    where action = 'settings.updated' and after->>'key' = 'late_tolerance_minutes'),
  1::bigint,
  'Le changement est journalisé'
);

select is(
  (select before->>'value' from public.audit_log
    where action = 'settings.updated' and after->>'key' = 'late_tolerance_minutes'),
  '10',
  'Avec la valeur d''avant, celle qu''il faudra pour comprendre plus tard'
);

-- ========================================================== points de vente ==
set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-0000-4000-8000-000000000502","role":"authenticated"}';

select throws_ok(
  $$select public.admin_upsert_boutique('minuscule', 'Boutique test')$$,
  '22023', null,
  'Un code en minuscules est refusé'
);

select throws_ok(
  $$select public.admin_upsert_boutique('TEST_NEW', '   ')$$,
  '22023', null,
  'Un nom vide est refusé'
);

select throws_ok(
  $$select public.admin_upsert_boutique('TEST_NEW', 'Boutique test', 'marché')$$,
  '22023', null,
  'Un type de point de vente inconnu est refusé'
);

select lives_ok(
  $$select set_config('test.newshop',
      public.admin_upsert_boutique('TEST_NEW', 'Nouvelle boutique')::text, false)$$,
  'La direction ouvre un nouveau point de vente'
);

select is(
  (select sort_order > 0 from public.boutiques where id = current_setting('test.newshop')::uuid),
  true,
  'Il se range tout seul à la fin de la liste'
);

select throws_ok(
  $$select public.admin_set_boutique_active('bbbbbbbb-0000-4000-8000-000000000501', false)$$,
  '23503', null,
  'On ne ferme pas un point de vente où quelqu''un travaille encore'
);

select lives_ok(
  $$select public.admin_set_boutique_active(current_setting('test.newshop')::uuid, false)$$,
  'On ferme un point de vente vide'
);

reset role;
set local request.jwt.claims = '';

select is(
  (select is_active from public.boutiques where id = current_setting('test.newshop')::uuid),
  false,
  'Il est fermé'
);

select is(
  (select count(*) from public.boutiques where id = current_setting('test.newshop')::uuid),
  1::bigint,
  'Mais toujours là : fermer n''est pas supprimer'
);

select is(
  (select count(*) from public.audit_log where action = 'boutique.closed'),
  1::bigint,
  'La fermeture est journalisée'
);

-- ============================================================== jours fériés ==
set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-0000-4000-8000-000000000502","role":"authenticated"}';

select lives_ok(
  $$select public.admin_set_public_holiday('2028-04-17', 'Lundi de Pâques')$$,
  'La direction ajoute un jour férié'
);

select lives_ok(
  $$select public.admin_set_public_holiday('2028-04-17', 'Lundi de Pâques 2028')$$,
  'Le rejouer ne fait que corriger son nom'
);

reset role;
set local request.jwt.claims = '';

select is(
  (select label from public.public_holidays where date = '2028-04-17'),
  'Lundi de Pâques 2028',
  'Le nom est à jour, et il n''y a qu''une ligne'
);

-- Le décompte des congés en tient compte immédiatement : c'est tout l'intérêt.
select is(
  public.count_leave_days('dddddddd-0000-4000-8000-000000000501', '2028-04-17', '2028-04-17'),
  0::numeric,
  'Le nouveau jour férié n''est plus décompté des congés'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-0000-4000-8000-000000000502","role":"authenticated"}';

select is(
  public.admin_remove_public_holiday('2028-04-17'),
  true,
  'La direction retire un jour férié'
);

select is(
  public.admin_remove_public_holiday('2028-04-17'),
  false,
  'Le retirer deux fois ne lève pas d''erreur'
);

reset role;
set local request.jwt.claims = '';

select * from finish();
rollback;
