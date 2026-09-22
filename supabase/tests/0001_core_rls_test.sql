-- pgTAP: proves the core Row Level Security policies.
--
-- Run with:  supabase test db --linked     (or --local with Docker)
-- Requires the pgtap extension:  create extension if not exists pgtap with schema extensions;
--
-- Everything happens inside a transaction that is rolled back, so the fixtures
-- below never persist, not even on a hosted project.

begin;
select plan(28);

-- ---------------------------------------------------------------- fixtures --
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@staff.oummi.invalid'),
  ('22222222-2222-2222-2222-222222222222', 'b@staff.oummi.invalid'),
  ('33333333-3333-3333-3333-333333333333', 'direction@oummi.invalid');

insert into public.user_roles (user_id, role, boutique_id) values
  ('11111111-1111-1111-1111-111111111111', 'employee', null),
  ('22222222-2222-2222-2222-222222222222', 'employee', null),
  ('33333333-3333-3333-3333-333333333333', 'admin', null);

insert into public.notifications (recipient_user_id, type, title, body) values
  ('11111111-1111-1111-1111-111111111111', 'demo.hello', 'Pour A', 'corps A'),
  ('22222222-2222-2222-2222-222222222222', 'demo.hello', 'Pour B', 'corps B');

insert into public.audit_log (actor_id, action, entity)
  values ('33333333-3333-3333-3333-333333333333', 'test', 'boutiques');
insert into public.login_attempts (employee_id, success)
  values ('11111111-1111-1111-1111-111111111111', false);
insert into public.domain_events (type) values ('demo.hello');

-- ------------------------------------------------------- structural checks --
select is(
  (select count(*) from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity),
  9::bigint,
  'RLS est activée sur les 9 tables du socle'
);

select is(
  (select count(*) from information_schema.table_privileges
    where grantee = 'anon' and table_schema = 'public'),
  0::bigint,
  'Le rôle anon n''a aucun droit sur le schéma public'
);

select is(
  (select count(*) from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'notifications'),
  1::bigint,
  'Les notifications sont diffusées en temps réel'
);

-- --------------------------------------------- what a collaboratrice sees ---
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select is((select count(*) from public.boutiques), 5::bigint,
          'Une collaboratrice lit les 5 points de vente');
select is((select count(*) from public.contract_types), 4::bigint,
          'Une collaboratrice lit les 4 types de contrat');
select is((select count(*) from public.settings), 8::bigint,
          'Une collaboratrice lit les réglages');
select is((select count(*) from public.public_holidays), 24::bigint,
          'Une collaboratrice lit les jours fériés');
select is((select count(*) from public.user_roles), 1::bigint,
          'Une collaboratrice ne voit que son propre rôle');
select is((select count(*) from public.notifications), 1::bigint,
          'Une collaboratrice ne voit que ses propres notifications');
select is((select count(*) from public.audit_log), 0::bigint,
          'Une collaboratrice ne voit pas le journal d''audit');
select is((select count(*) from public.login_attempts), 0::bigint,
          'Une collaboratrice ne voit pas les tentatives de connexion');
select is((select count(*) from public.domain_events), 0::bigint,
          'Une collaboratrice ne voit pas les événements internes');
select ok(not public.is_admin(), 'Une collaboratrice n''est pas administratrice');

-- ------------------------------------------ what a collaboratrice cannot do --
select throws_ok(
  $$insert into public.boutiques (code, name, kind) values ('HACK', 'Pirate', 'physical')$$,
  '42501', null,
  'Une collaboratrice ne peut pas créer de point de vente'
);

select throws_ok(
  $$update public.notifications set title = 'piraté'
     where recipient_user_id = '11111111-1111-1111-1111-111111111111'$$,
  '42501', null,
  'Une collaboratrice ne peut pas réécrire le texte d''une notification'
);

select throws_ok(
  $$insert into public.audit_log (action, entity) values ('hack', 'x')$$,
  '42501', null,
  'Une collaboratrice ne peut pas écrire dans le journal d''audit'
);

select throws_ok(
  $$insert into public.settings (key, value) values ('hack', '1'::jsonb)$$,
  '42501', null,
  'Une collaboratrice ne peut pas modifier les réglages'
);

-- Marking as read is the one write she is allowed, and only on her own rows.
select is(
  (with upd as (
     update public.notifications set read_at = now()
      where recipient_user_id = '11111111-1111-1111-1111-111111111111'
      returning 1)
   select count(*) from upd),
  1::bigint,
  'Une collaboratrice marque sa notification comme lue'
);

select is(
  (with upd as (
     update public.notifications set read_at = now()
      where recipient_user_id = '22222222-2222-2222-2222-222222222222'
      returning 1)
   select count(*) from upd),
  0::bigint,
  'Une collaboratrice ne touche pas la notification d''une collègue'
);

reset role;

-- ------------------------------------------------------ what the direction sees --
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select ok(public.is_admin(), 'La direction est reconnue comme administratrice');
select is((select count(*) from public.user_roles), 3::bigint,
          'La direction voit tous les rôles');
select is((select count(*) from public.notifications), 2::bigint,
          'La direction voit toutes les notifications');
select is((select count(*) from public.audit_log), 1::bigint,
          'La direction voit le journal d''audit');
select is((select count(*) from public.login_attempts), 1::bigint,
          'La direction voit les tentatives de connexion');
select is((select count(*) from public.domain_events), 1::bigint,
          'La direction voit les événements internes');

select lives_ok(
  $$insert into public.boutiques (code, name, kind) values ('TEST', 'Boutique test', 'physical')$$,
  'La direction peut créer un point de vente'
);

reset role;

-- --------------------------------------------------- role scope constraint --
select throws_ok(
  $$insert into public.user_roles (user_id, role, boutique_id)
    values ('11111111-1111-1111-1111-111111111111', 'manager', null)$$,
  '23514', null,
  'Un responsable doit être rattaché à une boutique'
);

select throws_ok(
  $$insert into public.user_roles (user_id, role, boutique_id)
    values ('11111111-1111-1111-1111-111111111111', 'admin',
            (select id from public.boutiques order by sort_order limit 1))$$,
  '23514', null,
  'Un administrateur est global, jamais rattaché à une boutique'
);

select * from finish();
rollback;
