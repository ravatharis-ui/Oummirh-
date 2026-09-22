-- pgTAP: politiques de sécurité du socle.
--
-- Ces tests tournent sur la base réelle, qui contient de vraies données. Ils ne
-- comptent donc jamais « toutes » les lignes d'une table : ils affirment qu'une
-- collaboratrice ne voit rien qui ne lui appartienne, et vérifient leurs propres
-- fixtures nommément. Un test qui ne passe que sur une base vide ne prouve rien.
--
-- Tout se déroule dans une transaction annulée : les fixtures n'existent jamais
-- durablement, même sur un projet hébergé.

begin;
select plan(27);

-- ---------------------------------------------------------------- fixtures --
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'rls-a@test.invalid'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'rls-b@test.invalid'),
  ('aaaaaaaa-0000-4000-8000-000000000003', 'rls-admin@test.invalid');

insert into public.user_roles (user_id, role, boutique_id) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'employee', null),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'employee', null),
  ('aaaaaaaa-0000-4000-8000-000000000003', 'admin', null);

insert into public.notifications (recipient_user_id, type, title, body) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'test.hello', 'Pour A', 'corps A'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'test.hello', 'Pour B', 'corps B');

insert into public.audit_log (actor_id, action, entity)
  values ('aaaaaaaa-0000-4000-8000-000000000003', 'test.rls', 'boutiques');
insert into public.login_attempts (employee_id, success) values (null, false);
insert into public.domain_events (type) values ('test.rls');

-- ------------------------------------------------------- invariants globaux --
-- Formulé comme un invariant plutôt qu'un décompte : chaque phase ajoute des
-- tables, et aucune ne doit jamais arriver sans politique de sécurité.
select is(
  (select count(*) from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  0::bigint,
  'Aucune table du schéma public n''est dépourvue de RLS'
);

select is(
  (select count(*) from information_schema.table_privileges
    where grantee = 'anon' and table_schema = 'public'),
  0::bigint,
  'Le rôle anon n''a aucun droit sur la moindre table'
);

select is(
  (select count(*) from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'notifications'),
  1::bigint,
  'Les notifications sont diffusées en temps réel'
);

-- --------------------------------------------- ce que voit une collaboratrice --
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';

select cmp_ok((select count(*) from public.boutiques), '>=', 1::bigint,
              'Une collaboratrice lit les points de vente');
select cmp_ok((select count(*) from public.contract_types), '>=', 1::bigint,
              'Une collaboratrice lit les types de contrat');
select cmp_ok((select count(*) from public.settings), '>=', 1::bigint,
              'Une collaboratrice lit les réglages');
select cmp_ok((select count(*) from public.public_holidays), '>=', 1::bigint,
              'Une collaboratrice lit les jours fériés');

-- Le cloisonnement se prouve par l'absence : rien qui ne lui appartienne.
select is(
  (select count(*) from public.user_roles
    where user_id <> 'aaaaaaaa-0000-4000-8000-000000000001'),
  0::bigint,
  'Une collaboratrice ne voit aucun rôle qui ne soit le sien'
);

select is(
  (select count(*) from public.notifications
    where recipient_user_id <> 'aaaaaaaa-0000-4000-8000-000000000001'),
  0::bigint,
  'Une collaboratrice ne voit aucune notification qui ne lui soit destinée'
);

select is((select count(*) from public.audit_log), 0::bigint,
          'Une collaboratrice ne voit pas le journal d''audit');
select is((select count(*) from public.login_attempts), 0::bigint,
          'Une collaboratrice ne voit pas les tentatives de connexion');
select is((select count(*) from public.domain_events), 0::bigint,
          'Une collaboratrice ne voit pas les événements internes');
select ok(not public.is_admin(), 'Une collaboratrice n''est pas administratrice');

-- ------------------------------------------ ce qu'une collaboratrice ne peut pas --
select throws_ok(
  $$insert into public.boutiques (code, name, kind) values ('TEST_HACK', 'Pirate', 'physical')$$,
  '42501', null,
  'Une collaboratrice ne peut pas créer de point de vente'
);

select throws_ok(
  $$update public.notifications set title = 'piraté'
     where recipient_user_id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  '42501', null,
  'Une collaboratrice ne peut pas réécrire le texte d''une notification'
);

select throws_ok(
  $$insert into public.audit_log (action, entity) values ('hack', 'x')$$,
  '42501', null,
  'Une collaboratrice ne peut pas écrire dans le journal d''audit'
);

-- Marquer comme lu est sa seule écriture. Les mises à jour s'exécutent sous son
-- rôle, les vérifications hors de ce rôle : elle ne voit pas la ligne de sa
-- collègue, donc seule une lecture privilégiée peut prouver qu'elle est intacte.
update public.notifications set read_at = now()
 where recipient_user_id = 'aaaaaaaa-0000-4000-8000-000000000001';
update public.notifications set read_at = now()
 where recipient_user_id = 'aaaaaaaa-0000-4000-8000-000000000002';

reset role;

select is(
  (select count(*) from public.notifications
    where recipient_user_id = 'aaaaaaaa-0000-4000-8000-000000000001' and read_at is not null),
  1::bigint,
  'Une collaboratrice marque sa notification comme lue'
);

select is(
  (select count(*) from public.notifications
    where recipient_user_id = 'aaaaaaaa-0000-4000-8000-000000000002' and read_at is not null),
  0::bigint,
  'Une collaboratrice ne touche pas la notification d''une collègue'
);

-- --------------------------------------------------------- ce que voit la direction --
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-4000-8000-000000000003","role":"authenticated"}';

select ok(public.is_admin(), 'La direction est reconnue comme administratrice');

select is(
  (select count(*) from public.user_roles
    where user_id in ('aaaaaaaa-0000-4000-8000-000000000001',
                      'aaaaaaaa-0000-4000-8000-000000000002',
                      'aaaaaaaa-0000-4000-8000-000000000003')),
  3::bigint,
  'La direction voit les rôles des trois comptes de test'
);

select is(
  (select count(*) from public.notifications
    where recipient_user_id in ('aaaaaaaa-0000-4000-8000-000000000001',
                                'aaaaaaaa-0000-4000-8000-000000000002')),
  2::bigint,
  'La direction voit les notifications des deux collaboratrices'
);

select is((select count(*) from public.audit_log where action = 'test.rls'), 1::bigint,
          'La direction voit le journal d''audit');
select cmp_ok((select count(*) from public.login_attempts), '>=', 1::bigint,
              'La direction voit les tentatives de connexion');
select is((select count(*) from public.domain_events where type = 'test.rls'), 1::bigint,
          'La direction voit les événements internes');

select lives_ok(
  $$insert into public.boutiques (code, name, kind) values ('TEST_RLS', 'Boutique de test', 'physical')$$,
  'La direction peut créer un point de vente'
);

reset role;

-- --------------------------------------------------- portée des rôles --
select throws_ok(
  $$insert into public.user_roles (user_id, role, boutique_id)
    values ('aaaaaaaa-0000-4000-8000-000000000001', 'manager', null)$$,
  '23514', null,
  'Un responsable doit être rattaché à une boutique'
);

select throws_ok(
  $$insert into public.user_roles (user_id, role, boutique_id)
    values ('aaaaaaaa-0000-4000-8000-000000000001', 'admin',
            (select id from public.boutiques order by sort_order limit 1))$$,
  '23514', null,
  'Un administrateur est global, jamais rattaché à une boutique'
);

select * from finish();
rollback;
