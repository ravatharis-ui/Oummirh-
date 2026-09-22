-- pgTAP: congés.
--
-- Ce que ces tests protègent : le solde ne peut pas être écrit depuis un
-- navigateur, le décompte ignore les week-ends, les jours fériés — dont le
-- 20 décembre — et les jours de repos planifiés, l'acquisition mensuelle ne
-- crédite jamais deux fois, et annuler un congé validé recrédite sans effacer
-- l'histoire.

begin;
select plan(41);

-- ---------------------------------------------------------------- fixtures --
insert into public.boutiques (id, code, name, kind, sort_order) values
  ('bbbbbbbb-0000-4000-8000-000000000301', 'TEST_CONG', 'Boutique congés', 'physical', 9300);

insert into auth.users (id, email) values
  ('cccccccc-0000-4000-8000-000000000301', 'cong-a@staff.oummi.invalid'),
  ('cccccccc-0000-4000-8000-000000000302', 'cong-b@staff.oummi.invalid'),
  ('cccccccc-0000-4000-8000-000000000303', 'cong-direction@oummi.invalid');

insert into public.user_roles (user_id, role, boutique_id) values
  ('cccccccc-0000-4000-8000-000000000301', 'employee', null),
  ('cccccccc-0000-4000-8000-000000000302', 'employee', null),
  ('cccccccc-0000-4000-8000-000000000303', 'admin', null);

insert into public.employees (id, auth_user_id, last_name, first_name, display_name,
  boutique_id, contract_type_id, pin_hash, weekly_contract_hours, hire_date)
values
  ('dddddddd-0000-4000-8000-000000000301', 'cccccccc-0000-4000-8000-000000000301',
   'TESTCONG', 'CongAnna', 'CongAnna', 'bbbbbbbb-0000-4000-8000-000000000301',
   (select id from public.contract_types where code = 'CDI'),
   extensions.crypt('7392', extensions.gen_salt('bf')), 35, '2020-01-01'),
  ('dddddddd-0000-4000-8000-000000000302', 'cccccccc-0000-4000-8000-000000000302',
   'TESTCONG', 'CongBea', 'CongBea', 'bbbbbbbb-0000-4000-8000-000000000301',
   (select id from public.contract_types where code = 'CDI'),
   extensions.crypt('8461', extensions.gen_salt('bf')), 35, '2026-11-16');

-- ============================================================ la période ====
select is(
  public.leave_period_start('2026-09-21'::date),
  '2026-06-01'::date,
  'Septembre appartient à la période ouverte le 1er juin de la même année'
);

select is(
  public.leave_period_start('2026-03-15'::date),
  '2025-06-01'::date,
  'Mars appartient à la période ouverte le 1er juin de l''année précédente'
);

select is(
  public.leave_period_start('2026-06-01'::date),
  '2026-06-01'::date,
  'Le 1er juin ouvre sa propre période'
);

select is(
  public.leave_period_start('2026-05-31'::date),
  '2025-06-01'::date,
  'Le 31 mai est le dernier jour de la période précédente'
);

-- ============================================================ le décompte ===
-- Semaine du lundi 7 au dimanche 13 décembre 2026.
select is(
  public.count_leave_days('dddddddd-0000-4000-8000-000000000301', '2026-12-07', '2026-12-13'),
  6::numeric,
  'Une semaine entière compte six jours ouvrables : le dimanche ne compte pas'
);

select is(
  public.count_leave_days('dddddddd-0000-4000-8000-000000000301', '2026-12-12', '2026-12-12'),
  1::numeric,
  'Le samedi compte, en mode ouvrables'
);

select is(
  public.count_leave_days('dddddddd-0000-4000-8000-000000000301', '2026-12-13', '2026-12-13'),
  0::numeric,
  'Le dimanche ne compte jamais'
);

-- Le 20 décembre 2026 tombe un dimanche : on prend l'année suivante, où il
-- tombe un lundi, pour que le test porte bien sur le férié et non sur le jour.
select is(
  public.count_leave_days('dddddddd-0000-4000-8000-000000000301', '2027-12-20', '2027-12-20'),
  0::numeric,
  'Le 20 décembre, abolition de l''esclavage, ne compte pas'
);

select is(
  public.count_leave_days('dddddddd-0000-4000-8000-000000000301', '2026-12-21', '2026-12-26'),
  5::numeric,
  'Noël, férié, est retiré de la semaine'
);

-- Un jour de repos planifié ne coûte pas de congé.
insert into public.planning_entries (employee_id, boutique_id, date, status) values
  ('dddddddd-0000-4000-8000-000000000301', 'bbbbbbbb-0000-4000-8000-000000000301',
   '2026-12-08', 'rest'),
  ('dddddddd-0000-4000-8000-000000000301', 'bbbbbbbb-0000-4000-8000-000000000301',
   '2026-12-09', 'school');

select is(
  public.count_leave_days('dddddddd-0000-4000-8000-000000000301', '2026-12-07', '2026-12-13'),
  4::numeric,
  'Un jour de repos et un jour d''école planifiés ne coûtent pas de congé'
);

-- --------------------------------------------------------- demi-journées ----
select is(
  public.count_leave_days('dddddddd-0000-4000-8000-000000000302', '2026-12-07', '2026-12-11', 'pm', null),
  4.5::numeric,
  'Partir l''après-midi du premier jour retire une demi-journée'
);

select is(
  public.count_leave_days('dddddddd-0000-4000-8000-000000000302', '2026-12-07', '2026-12-11', null, 'am'),
  4.5::numeric,
  'Revenir l''après-midi du dernier jour retire une demi-journée'
);

select is(
  public.count_leave_days('dddddddd-0000-4000-8000-000000000302', '2026-12-07', '2026-12-11', 'pm', 'am'),
  4::numeric,
  'Les deux demi-journées se cumulent'
);

select is(
  public.count_leave_days('dddddddd-0000-4000-8000-000000000302', '2026-12-07', '2026-12-07', 'pm', null),
  0.5::numeric,
  'Une seule journée en demi vaut une demi-journée'
);

select is(
  public.count_leave_days('dddddddd-0000-4000-8000-000000000302', '2026-12-13', '2026-12-13', 'pm', null),
  0::numeric,
  'Une demi-journée un dimanche ne coûte rien'
);

select throws_ok(
  $$select public.count_leave_days('dddddddd-0000-4000-8000-000000000301',
      '2026-12-10', '2026-12-01')$$,
  '22023', null,
  'Une période à l''envers est refusée'
);

-- ============================================================== le ledger ===
select is(
  (select count(*) from information_schema.table_privileges
    where table_schema = 'public' and table_name in ('leave_ledger', 'leave_requests')
      and grantee = 'authenticated' and privilege_type <> 'SELECT'),
  0::bigint,
  'Une session ne peut que lire le ledger : un solde ne s''écrit pas depuis un navigateur'
);

select is(
  (select count(*) from information_schema.table_privileges
    where table_schema = 'public' and table_name in ('leave_ledger', 'leave_requests')
      and grantee = 'anon'),
  0::bigint,
  'Un visiteur anonyme n''a aucun droit sur les congés'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-0000-4000-8000-000000000301","role":"authenticated"}';

select throws_ok(
  $$insert into public.leave_ledger (employee_id, kind, days, period_start, occurred_on)
    values ('dddddddd-0000-4000-8000-000000000301', 'accrual', 99, '2026-06-01', '2026-06-01')$$,
  '42501', null,
  'Une collaboratrice ne peut pas se créditer des jours'
);

select throws_ok(
  $$select public.admin_adjust_leave('dddddddd-0000-4000-8000-000000000301', 5, 'parce que voilà')$$,
  '42501', null,
  'Une collaboratrice ne peut pas ajuster son solde'
);

reset role;
set local request.jwt.claims = '';

-- ==================================================== acquisition mensuelle ==
select is(
  (select public.accrue_monthly_leave('2026-11-15'::timestamptz) >= 2),
  true,
  'L''acquisition crédite les collaboratrices actives'
);

select is(
  public.leave_balance('dddddddd-0000-4000-8000-000000000301', '2026-06-01'),
  2.5::numeric,
  'Une collaboratrice présente depuis longtemps gagne le mois entier'
);

-- Embauchée le 16 novembre : 15 jours sur 30, soit la moitié de 2,5.
select is(
  public.leave_balance('dddddddd-0000-4000-8000-000000000302', '2026-06-01'),
  1.25::numeric,
  'Une embauche en cours de mois est proratisée sur les jours restants'
);

select is(
  public.accrue_monthly_leave('2026-11-28'::timestamptz),
  0,
  'Rejouer l''acquisition du même mois ne crédite personne une seconde fois'
);

select is(
  public.leave_balance('dddddddd-0000-4000-8000-000000000301', '2026-06-01'),
  2.5::numeric,
  'Et le solde n''a pas bougé'
);

-- ==================================================== demande et décision ====
set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-0000-4000-8000-000000000301","role":"authenticated"}';

select throws_ok(
  $$select public.request_leave(public.reunion_today() - 5, public.reunion_today() - 3)$$,
  '22023', null,
  'On ne demande pas un congé pour une date déjà passée'
);

select lives_ok(
  $$select set_config('test.req1',
      public.request_leave('2026-12-21', '2026-12-24', null, null, 'Fêtes')::text, false)$$,
  'La demande est déposée'
);

-- Du lundi 21 au jeudi 24 décembre 2026 : quatre jours ouvrables, aucun férié
-- dans l'intervalle. Le chiffre vient de la base, jamais du navigateur.
select is(
  (select days from public.leave_requests where id = current_setting('test.req1')::uuid),
  4::numeric,
  'Le décompte est calculé par la base, pas transmis par le navigateur'
);

select throws_ok(
  $$select public.request_leave('2026-12-23', '2026-12-28')$$,
  '23505', null,
  'Une seconde demande qui chevauche la première est refusée'
);

select throws_ok(
  $$select public.admin_decide_leave(current_setting('test.req1')::uuid, true)$$,
  '42501', null,
  'Une collaboratrice ne valide pas son propre congé'
);

reset role;
set local request.jwt.claims = '';

set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-0000-4000-8000-000000000303","role":"authenticated"}';

select lives_ok(
  $$select public.admin_decide_leave(current_setting('test.req1')::uuid, true, 'Bonnes fêtes')$$,
  'La direction valide la demande'
);

reset role;
set local request.jwt.claims = '';

select is(
  (select status from public.leave_requests where id = current_setting('test.req1')::uuid),
  'approved',
  'La demande est validée'
);

select is(
  public.leave_balance('dddddddd-0000-4000-8000-000000000301', '2026-06-01'),
  (2.5 - 4)::numeric,
  'Le solde est débité des jours pris, quitte à devenir négatif'
);

select is(
  (select count(*) from public.domain_events
    where type = 'conges.request_approved'
      and payload->>'id' = current_setting('test.req1')),
  1::bigint,
  'Le planning est prévenu par un événement'
);

-- ------------------------------------------------------------- annulation ---
set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-0000-4000-8000-000000000301","role":"authenticated"}';

select throws_ok(
  $$select public.cancel_leave_request(current_setting('test.req1')::uuid)$$,
  '42501', null,
  'Un congé validé ne s''annule pas depuis le téléphone'
);

reset role;
set local request.jwt.claims = '';

set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-0000-4000-8000-000000000303","role":"authenticated"}';
select lives_ok(
  $$select public.cancel_leave_request(current_setting('test.req1')::uuid)$$,
  'La direction annule le congé validé'
);
reset role;
set local request.jwt.claims = '';

select is(
  public.leave_balance('dddddddd-0000-4000-8000-000000000301', '2026-06-01'),
  2.5::numeric,
  'Le solde est recrédité'
);

select is(
  (select count(*) from public.leave_ledger
    where source_ref = current_setting('test.req1')::uuid),
  2::bigint,
  'Deux lignes, pas zéro : le débit d''origine reste, l''annulation s''ajoute'
);

select is(
  (select count(*) from public.domain_events
    where type = 'conges.request_cancelled'
      and payload->>'id' = current_setting('test.req1')),
  1::bigint,
  'Le planning est prévenu de l''annulation'
);

-- ================================================== cloisonnement lecture ====
set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-0000-4000-8000-000000000302","role":"authenticated"}';

select is(
  (select count(*) from public.leave_ledger
    where employee_id <> 'dddddddd-0000-4000-8000-000000000302'),
  0::bigint,
  'Une collaboratrice ne voit aucun mouvement qui ne soit le sien'
);

select throws_ok(
  $$select public.leave_balance('dddddddd-0000-4000-8000-000000000301')$$,
  '42501', null,
  'Et elle ne peut pas demander le solde d''une collègue'
);

reset role;
set local request.jwt.claims = '';

select * from finish();
rollback;
