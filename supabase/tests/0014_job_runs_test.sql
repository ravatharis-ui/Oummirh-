-- pgTAP: santé des tâches planifiées.
--
-- Cette table existe pour qu'une panne silencieuse devienne visible. Elle ne
-- vaut donc que si elle dit la vérité : ce fichier éprouve qu'**aucune session
-- ne peut l'écrire**, direction comprise. Une direction capable de repeindre le
-- voyant en vert aurait un tableau de bord rassurant et faux.
--
-- Il éprouve aussi la règle qui a motivé la forme de la table : un échec ne doit
-- pas effacer la date du dernier succès, parce que c'est elle qui dit depuis
-- quand ça dure.

begin;
select plan(11);

-- ---------------------------------------------------------------- fixtures --
insert into auth.users (id, email) values
  ('cccccccc-0000-4000-8000-000000000901', 'job-collab@staff.oummi.invalid'),
  ('cccccccc-0000-4000-8000-000000000902', 'job-direction@oummi.invalid');

insert into public.user_roles (user_id, role, boutique_id) values
  ('cccccccc-0000-4000-8000-000000000901', 'employee', null),
  ('cccccccc-0000-4000-8000-000000000902', 'admin', null);

-- ================================================================== grants ===
select is(
  (select count(*) from information_schema.table_privileges
    where table_schema = 'public' and table_name = 'job_runs' and grantee = 'anon'),
  0::bigint,
  'Un visiteur anonyme n''a aucun droit sur les passages de tâches'
);

select set_eq(
  $$select privilege_type::text from information_schema.table_privileges
     where table_schema = 'public' and table_name = 'job_runs' and grantee = 'authenticated'$$,
  array['SELECT']::text[],
  'Une session ne peut que lire : ni insert, ni update, ni delete'
);

select is(
  (select count(*) from information_schema.routine_privileges g
     join pg_proc p on p.proname = 'record_job_run'
    where g.specific_name = p.proname || '_' || p.oid
      and g.grantee in ('anon', 'authenticated')),
  0::bigint,
  'record_job_run n''est joignable depuis aucune session'
);

-- ================================================== ce que la fonction écrit =
select public.record_job_run('conges.accrual', true, '{"accrued": 3}'::jsonb, null);

select is(
  (select ok from public.job_runs where job = 'conges.accrual'),
  true,
  'Un passage réussi est enregistré'
);

select is(
  (select consecutive_failures from public.job_runs where job = 'conges.accrual'),
  0,
  'Un succès remet le compteur d''échecs à zéro'
);

select isnt(
  (select last_ok_at from public.job_runs where job = 'conges.accrual'),
  null::timestamptz,
  'Un succès horodate le dernier succès'
);

-- Un échec ensuite : la date du dernier succès doit survivre.
select public.record_job_run('conges.accrual', false, '{}'::jsonb, 'la base a refusé');

select isnt(
  (select last_ok_at from public.job_runs where job = 'conges.accrual'),
  null::timestamptz,
  'Un échec n''efface pas la trace du dernier succès : c''est elle qui dit depuis quand ça dure'
);

select is(
  (select consecutive_failures from public.job_runs where job = 'conges.accrual'),
  1,
  'Un échec incrémente le compteur'
);

select public.record_job_run('conges.accrual', false, '{}'::jsonb, 'encore');

select is(
  (select consecutive_failures from public.job_runs where job = 'conges.accrual'),
  2,
  'Deux échecs de suite se comptent'
);

-- Une ligne par tâche, jamais un journal.
select is(
  (select count(*) from public.job_runs where job = 'conges.accrual'),
  1::bigint,
  'Trois passages ne font qu''une ligne : la table répond sur le dernier, pas sur l''histoire'
);

-- ================================================ qui voit quoi, et qui écrit =
set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-0000-4000-8000-000000000901","role":"authenticated"}';

select is(
  (select count(*) from public.job_runs),
  0::bigint,
  'Une collaboratrice ne voit aucun passage de tâche'
);

reset role;
set local request.jwt.claims = '';

rollback;
