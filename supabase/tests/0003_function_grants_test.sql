-- pgTAP: qui a le droit d'appeler quoi.
--
-- Ce fichier existe à cause d'un vrai incident. Supabase applique
-- `alter default privileges ... grant all on functions to anon, authenticated`,
-- si bien que toute nouvelle fonction naît appelable par un visiteur anonyme.
-- Un `revoke ... from public` ne défait pas une autorisation accordée nommément
-- à un rôle : `verify_employee_pin` était donc joignable sans aucune session.
--
-- Le tableau ci-dessous est la liste exhaustive et voulue. Une fonction ajoutée
-- sans autorisation explicite fera échouer ce test, ce qui est l'objectif.

begin;
select plan(4);

-- Les seules fonctions que le monde entier peut appeler sont celles de l'écran
-- d'avant-connexion, et elles ne renvoient qu'un prénom.
select set_eq(
  $$select p.proname::text
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
      join information_schema.routine_privileges g
        on g.specific_name = p.proname || '_' || p.oid
       and g.grantee = 'anon' and g.privilege_type = 'EXECUTE'$$,
  array['login_boutiques', 'login_employee', 'login_employees'],
  'Seules les fonctions de l''écran de connexion sont ouvertes à un visiteur anonyme'
);

-- La vérification d'un PIN n'appartient qu'au serveur : une session, même
-- valide, ne doit pas pouvoir tenter un code en direct et contourner la
-- limitation par adresse que l'application applique.
select is(
  (select count(*) from information_schema.routine_privileges g
     join pg_proc p on g.specific_name = p.proname || '_' || p.oid
    where p.proname = 'verify_employee_pin'
      and g.grantee in ('anon', 'authenticated')
      and g.privilege_type = 'EXECUTE'),
  0::bigint,
  'La vérification d''un code PIN n''est accessible ni à anon ni à une session'
);

select is(
  (select count(*) from information_schema.routine_privileges g
     join pg_proc p on g.specific_name = p.proname || '_' || p.oid
    where p.proname = 'verify_employee_pin'
      and g.grantee = 'service_role'
      and g.privilege_type = 'EXECUTE'),
  1::bigint,
  'La vérification d''un code PIN reste accessible au serveur'
);

-- Une fonction de trigger n'a aucune raison d'être appelable depuis l'API.
select is(
  (select count(*) from information_schema.routine_privileges g
     join pg_proc p on g.specific_name = p.proname || '_' || p.oid
    where p.proname = 'set_updated_at'
      and g.grantee in ('anon', 'authenticated')
      and g.privilege_type = 'EXECUTE'),
  0::bigint,
  'La fonction de trigger n''est appelable par aucune session'
);

select * from finish();
rollback;
