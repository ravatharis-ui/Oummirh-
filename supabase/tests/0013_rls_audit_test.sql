-- pgTAP: audit des accès, table par table.
--
-- Les autres suites vérifient des règles métier. Celle-ci vérifie qu'**aucune
-- table n'est passée à travers les mailles** : ni une table créée sans RLS, ni
-- une table lisible par un visiteur anonyme, ni une table qu'un navigateur
-- pourrait écrire alors qu'elle devrait passer par une fonction.
--
-- Elle est écrite par énumération, pas par liste : une table ajoutée demain sans
-- protection fera échouer ce fichier sans que personne ait à y penser. C'est
-- exactement ce qu'on attend d'un audit — qu'il continue à travailler après que
-- son auteur est parti.

begin;
select plan(10);

-- ====================================================== RLS sur tout =========
select set_eq(
  $$select c.relname::text
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity$$,
  array[]::text[],
  'Toutes les tables du schéma public ont la sécurité au niveau ligne'
);

-- Une table avec RLS mais sans aucune politique est fermée à tout le monde —
-- ce qui est sûr, mais presque toujours un oubli. Une seule exception assumée :
-- les clichés de planning, que personne ne lit depuis une session parce qu'ils
-- ne s'affichent nulle part.
select set_eq(
  $$select c.relname::text
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
       and not exists (select 1 from pg_policy p where p.polrelid = c.oid)$$,
  array['planning_snapshots']::text[],
  'La seule table sans politique est celle que personne ne lit'
);

-- ================================================ anon ne touche rien ========
select set_eq(
  $$select distinct table_name::text
      from information_schema.table_privileges
     where grantee = 'anon' and table_schema = 'public'$$,
  array[]::text[],
  'Le rôle anon n''a aucun droit sur la moindre table'
);

select set_eq(
  $$select p.proname::text
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
      join information_schema.routine_privileges g
        on g.specific_name = p.proname || '_' || p.oid
       and g.grantee = 'anon' and g.privilege_type = 'EXECUTE'$$,
  array['login_boutiques', 'login_employee', 'login_employees'],
  'Seules les trois fonctions de l''écran de connexion sont ouvertes à anon'
);

-- ============================== ce qu'un navigateur peut écrire ==============
-- La liste exhaustive et voulue. Tout le reste passe par une fonction
-- `security definer` qui revérifie les droits, applique les règles et journalise.
--
-- `user_roles` est la seule qui reste : elle est écrite au même instant que la
-- collaboratrice, dans `admin_create_employee`, pour qu'une fiche ne puisse pas
-- exister sans le rôle qui lui permet de se connecter.
select set_eq(
  $$select distinct table_name::text
      from information_schema.table_privileges
     where grantee = 'authenticated' and table_schema = 'public'
       and privilege_type in ('INSERT', 'UPDATE', 'DELETE')$$,
  array['user_roles']::text[],
  'Une seule table entière reste écrite depuis le navigateur'
);

-- `employees` n'est écrite que colonne par colonne, et `pin_hash` n'y figure
-- pas : le hachage ne peut donc être posé que par une fonction.
select is(
  (select count(*) from information_schema.column_privileges
    where table_schema = 'public' and table_name = 'employees'
      and grantee = 'authenticated' and privilege_type in ('INSERT', 'UPDATE')
      and column_name = 'pin_hash'),
  0::bigint,
  'Le hachage du code PIN n''est écrit par aucune session'
);

-- Sur les notifications, la seule écriture possible est le marquage « lu ».
-- Le texte d'une notification n'est donc pas réécrivable depuis un navigateur.
select set_eq(
  $$select column_name::text
      from information_schema.column_privileges
     where table_schema = 'public' and table_name = 'notifications'
       and grantee = 'authenticated' and privilege_type = 'UPDATE'$$,
  array['read_at']::text[],
  'Une notification ne se modifie que pour la marquer comme lue'
);

-- ============================== les tables qui ne s'écrivent jamais ==========
-- Les registres et les journaux. Une écriture directe y ferait perdre la trace
-- de qui a fait quoi, et c'est précisément ce qu'ils existent pour garder.
select is(
  (select count(*) from information_schema.table_privileges
    where grantee = 'authenticated' and table_schema = 'public'
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
      and table_name in ('time_clocks', 'leave_ledger', 'hours_ledger', 'audit_log',
                         'domain_events', 'documents', 'shift_swaps',
                         'direct_replacements', 'leave_requests', 'recovery_requests',
                         'settings', 'boutiques', 'contract_types', 'public_holidays')),
  0::bigint,
  'Aucun registre ni journal ne s''écrit depuis un navigateur'
);

-- ================================== pin_hash n'est lisible par personne ======
select is(
  (select count(*) from information_schema.column_privileges
    where table_schema = 'public' and table_name = 'employees'
      and column_name = 'pin_hash' and grantee in ('anon', 'authenticated')),
  0::bigint,
  'Aucune session ne peut lire un code PIN haché, direction comprise'
);

-- ============================ les fonctions internes restent internes ========
-- Celles qui écrivent au nom d'un autre module ou qui tournent en tâche de
-- fond : une session ne doit jamais pouvoir les appeler directement.
select is(
  (select count(*) from information_schema.routine_privileges
    where routine_schema = 'public' and grantee in ('anon', 'authenticated')
      and routine_name in (
        'emit_event', 'claim_domain_events', 'notify_user', 'verify_employee_pin',
        'apply_planning_from_event', 'clear_planning_from_event', 'apply_planning_swap',
        'apply_planning_recovery', 'apply_planning_leave', 'compute_daily_hours',
        'accrue_monthly_leave', 'close_leave_period', 'pointage_run_checks',
        'selfies_to_purge', 'mark_selfies_purged', 'revoke_anon_table_privileges',
        'planning_announce', 'midday_boundary', 'set_updated_at')),
  0::bigint,
  'Les fonctions internes et les tâches de fond restent hors de portée du navigateur'
);

select * from finish();
rollback;
