-- pgTAP: pointage.
--
-- Ce que ces tests protègent : le navigateur ne peut pas écrire une ligne de
-- pointage, la séquence arrivée → pause → retour → départ ne peut pas être
-- contournée, un selfie ne sert qu'une fois et jamais à quelqu'un d'autre, une
-- correction n'efface pas l'originale, et un jour d'école n'est pas un retard.

begin;
select plan(46);

-- ---------------------------------------------------------------- fixtures --
insert into public.boutiques (id, code, name, kind, sort_order) values
  ('bbbbbbbb-0000-4000-8000-000000000201', 'TEST_PTG', 'Boutique pointage', 'physical', 9200);

insert into auth.users (id, email) values
  ('cccccccc-0000-4000-8000-000000000201', 'ptg-a@staff.oummi.invalid'),
  ('cccccccc-0000-4000-8000-000000000202', 'ptg-b@staff.oummi.invalid'),
  ('cccccccc-0000-4000-8000-000000000203', 'ptg-ecole@staff.oummi.invalid'),
  ('cccccccc-0000-4000-8000-000000000204', 'ptg-direction@oummi.invalid');

insert into public.user_roles (user_id, role, boutique_id) values
  ('cccccccc-0000-4000-8000-000000000201', 'employee', null),
  ('cccccccc-0000-4000-8000-000000000202', 'employee', null),
  ('cccccccc-0000-4000-8000-000000000203', 'employee', null),
  ('cccccccc-0000-4000-8000-000000000204', 'admin', null);

insert into public.employees (id, auth_user_id, last_name, first_name, display_name,
  boutique_id, contract_type_id, pin_hash, weekly_contract_hours)
values
  ('dddddddd-0000-4000-8000-000000000201', 'cccccccc-0000-4000-8000-000000000201',
   'TESTPTG', 'PtgAnna', 'PtgAnna', 'bbbbbbbb-0000-4000-8000-000000000201',
   (select id from public.contract_types where code = 'CDI'),
   extensions.crypt('7392', extensions.gen_salt('bf')), 35),
  ('dddddddd-0000-4000-8000-000000000202', 'cccccccc-0000-4000-8000-000000000202',
   'TESTPTG', 'PtgBea', 'PtgBea', 'bbbbbbbb-0000-4000-8000-000000000201',
   (select id from public.contract_types where code = 'CDI'),
   extensions.crypt('8461', extensions.gen_salt('bf')), 35),
  ('dddddddd-0000-4000-8000-000000000203', 'cccccccc-0000-4000-8000-000000000203',
   'TESTPTG', 'PtgCora', 'PtgCora', 'bbbbbbbb-0000-4000-8000-000000000201',
   (select id from public.contract_types where code = 'CDI'),
   extensions.crypt('5173', extensions.gen_salt('bf')), 24);

-- Le planning du jour : deux journées de travail, un jour d'école.
insert into public.planning_entries (employee_id, boutique_id, date, status, start_time, end_time)
values
  ('dddddddd-0000-4000-8000-000000000201', 'bbbbbbbb-0000-4000-8000-000000000201',
   public.reunion_today(), 'work', '09:00', '17:00'),
  ('dddddddd-0000-4000-8000-000000000202', 'bbbbbbbb-0000-4000-8000-000000000201',
   public.reunion_today(), 'work', '09:00', '17:00');

insert into public.planning_entries (employee_id, boutique_id, date, status)
values
  ('dddddddd-0000-4000-8000-000000000203', 'bbbbbbbb-0000-4000-8000-000000000201',
   public.reunion_today(), 'school');

-- ================================================================= grants ====
select is(
  (select count(*) from information_schema.table_privileges
    where table_schema = 'public' and table_name = 'time_clocks' and grantee = 'anon'),
  0::bigint,
  'Un visiteur anonyme n''a aucun droit sur les pointages'
);

select is(
  (select count(*) from information_schema.table_privileges
    where table_schema = 'public' and table_name = 'time_clocks'
      and grantee = 'authenticated' and privilege_type <> 'SELECT'),
  0::bigint,
  'Une session ne peut que lire les pointages, jamais en écrire un'
);

select is(
  (select count(*) from information_schema.routine_privileges
    where routine_schema = 'public' and grantee in ('anon', 'authenticated')
      and routine_name in ('pointage_run_checks', 'selfies_to_purge', 'mark_selfies_purged')),
  0::bigint,
  'Les tâches planifiées du pointage ne sont appelables que par le serveur'
);

-- ============================================================== séquence =====
set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-0000-4000-8000-000000000201","role":"authenticated"}';

select throws_ok(
  $$insert into public.time_clocks (employee_id, boutique_id, event_type, local_date)
    values ('dddddddd-0000-4000-8000-000000000201', 'bbbbbbbb-0000-4000-8000-000000000201',
            'clock_in', public.reunion_today())$$,
  '42501', null,
  'Une collaboratrice ne peut pas écrire directement une ligne de pointage'
);

select throws_ok(
  $$select public.clock_event('break_start')$$,
  '22023', null,
  'On ne peut pas partir en pause sans avoir pointé son arrivée'
);

select throws_ok(
  $$select public.clock_event('clock_out')$$,
  '22023', null,
  'On ne peut pas pointer son départ sans être arrivée'
);

select throws_ok(
  $$select public.clock_event('sieste')$$,
  '22023', null,
  'Un type de pointage inconnu est refusé'
);

select lives_ok(
  $$select public.clock_event('clock_in')$$,
  'L''arrivée est pointée'
);

select throws_ok(
  $$select public.clock_event('clock_in')$$,
  '22023', null,
  'Une deuxième arrivée le même jour est refusée'
);

select throws_ok(
  $$select public.clock_event('break_end')$$,
  '22023', null,
  'On ne peut pas revenir d''une pause qui n''a pas commencé'
);

select lives_ok(
  $$select public.clock_event('break_start')$$,
  'Le début de pause est pointé'
);

select throws_ok(
  $$select public.clock_event('clock_out')$$,
  '22023', null,
  'On ne peut pas partir en laissant sa pause ouverte'
);

select lives_ok(
  $$select public.clock_event('break_end')$$,
  'La fin de pause est pointée'
);

select lives_ok(
  $$select public.clock_event('clock_out')$$,
  'Le départ est pointé'
);

select throws_ok(
  $$select public.clock_event('clock_out')$$,
  '22023', null,
  'La journée close ne se repointe pas'
);

reset role;

select is(
  (select count(*) from public.time_clocks
    where employee_id = 'dddddddd-0000-4000-8000-000000000201'),
  4::bigint,
  'La journée compte exactement quatre pointages'
);

select is(
  (select count(distinct local_date) from public.time_clocks
    where employee_id = 'dddddddd-0000-4000-8000-000000000201'),
  1::bigint,
  'Les quatre pointages sont rattachés à la même journée'
);

select is(
  (select local_date from public.time_clocks
    where employee_id = 'dddddddd-0000-4000-8000-000000000201' limit 1),
  public.reunion_today(),
  'La journée est celle de La Réunion, calculée par le serveur'
);

select is(
  (select planned_time from public.time_clocks
    where employee_id = 'dddddddd-0000-4000-8000-000000000201'
      and event_type = 'clock_in'),
  '09:00'::time,
  'Le pointage a retenu l''heure que le planning attendait'
);

select ok(
  (select delta_minutes is not null from public.time_clocks
    where employee_id = 'dddddddd-0000-4000-8000-000000000201'
      and event_type = 'clock_in'),
  'L''écart avec l''heure prévue est calculé à l''enregistrement'
);

select is(
  (select count(*) from public.domain_events
    where type = 'pointage.clock_recorded'
      and payload->>'employee_id' = 'dddddddd-0000-4000-8000-000000000201'),
  4::bigint,
  'Chaque pointage est annoncé aux autres modules'
);

-- ================================================================= selfies ===
insert into storage.objects (bucket_id, name) values
  ('selfies', 'dddddddd-0000-4000-8000-000000000202/photo-1.jpg'),
  ('selfies', 'dddddddd-0000-4000-8000-000000000201/photo-vieille.jpg');

set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-0000-4000-8000-000000000202","role":"authenticated"}';

select throws_ok(
  $$select public.clock_event('clock_in',
      'dddddddd-0000-4000-8000-000000000201/photo-vieille.jpg')$$,
  '42501', null,
  'Une photo rangée dans le dossier d''une collègue est refusée'
);

select throws_ok(
  $$select public.clock_event('clock_in',
      'dddddddd-0000-4000-8000-000000000202/jamais-envoyee.jpg')$$,
  '22023', null,
  'Une photo annoncée mais jamais reçue est refusée'
);

select lives_ok(
  $$select public.clock_event('clock_in',
      'dddddddd-0000-4000-8000-000000000202/photo-1.jpg')$$,
  'Une photo déposée dans son propre dossier est acceptée'
);

select lives_ok(
  $$select public.clock_event('clock_out')$$,
  'Le départ se pointe sans photo'
);

reset role;

-- La réutilisation est refusée deux fois : par la règle, et par l'index unique
-- si jamais deux appels passaient la règle en même temps.
select throws_ok(
  $$insert into public.time_clocks (employee_id, boutique_id, event_type, local_date, photo_path)
    values ('dddddddd-0000-4000-8000-000000000201', 'bbbbbbbb-0000-4000-8000-000000000201',
            'clock_in', public.reunion_today() - 1,
            'dddddddd-0000-4000-8000-000000000202/photo-1.jpg')$$,
  '23505', null,
  'La base refuse qu''un même selfie serve à deux pointages'
);

-- =============================================================== correction ==
set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-0000-4000-8000-000000000201","role":"authenticated"}';
select throws_ok(
  $$select public.admin_correct_time_clock(
      'dddddddd-0000-4000-8000-000000000201', public.reunion_today(), 'clock_in',
      now(), 'oubli de badge')$$,
  '42501', null,
  'Une collaboratrice ne peut pas corriger son propre pointage'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-0000-4000-8000-000000000204","role":"authenticated"}';

select throws_ok(
  $$select public.admin_correct_time_clock(
      'dddddddd-0000-4000-8000-000000000201', public.reunion_today(), 'clock_in',
      now(), 'ok')$$,
  '22023', null,
  'Une correction sans motif sérieux est refusée'
);

select lives_ok(
  $$select public.admin_correct_time_clock(
      'dddddddd-0000-4000-8000-000000000201', public.reunion_today(), 'clock_in',
      (public.reunion_today() + time '09:00') at time zone 'Indian/Reunion',
      'Téléphone déchargé, arrivée constatée à 9 h')$$,
  'La direction corrige un pointage'
);

reset role;

select is(
  (select count(*) from public.time_clocks
    where employee_id = 'dddddddd-0000-4000-8000-000000000201'
      and event_type = 'clock_in'),
  2::bigint,
  'La correction est une nouvelle ligne : l''originale est toujours là'
);

select is(
  (select is_correction from public.effective_time_clocks
    where employee_id = 'dddddddd-0000-4000-8000-000000000201'
      and local_date = public.reunion_today() and event_type = 'clock_in'),
  true,
  'C''est la correction qui fait foi dans la lecture consolidée'
);

select is(
  (select delta_minutes from public.effective_time_clocks
    where employee_id = 'dddddddd-0000-4000-8000-000000000201'
      and local_date = public.reunion_today() and event_type = 'clock_in'),
  0,
  'Corrigée à l''heure prévue, la collaboratrice n''a plus aucun retard'
);

select is(
  (select count(*) from public.audit_log where action = 'pointage.corrected'),
  1::bigint,
  'La correction est tracée dans le journal d''audit'
);

-- ============================================ temps travaillé =================
-- Une journée entièrement maîtrisée, pour vérifier le calcul lui-même.
insert into public.time_clocks (employee_id, boutique_id, event_type, occurred_at, local_date)
values
  ('dddddddd-0000-4000-8000-000000000203', 'bbbbbbbb-0000-4000-8000-000000000201',
   'clock_in',    (date '2026-03-02' + time '09:00') at time zone 'Indian/Reunion', '2026-03-02'),
  ('dddddddd-0000-4000-8000-000000000203', 'bbbbbbbb-0000-4000-8000-000000000201',
   'break_start', (date '2026-03-02' + time '12:30') at time zone 'Indian/Reunion', '2026-03-02'),
  ('dddddddd-0000-4000-8000-000000000203', 'bbbbbbbb-0000-4000-8000-000000000201',
   'break_end',   (date '2026-03-02' + time '14:00') at time zone 'Indian/Reunion', '2026-03-02'),
  ('dddddddd-0000-4000-8000-000000000203', 'bbbbbbbb-0000-4000-8000-000000000201',
   'clock_out',   (date '2026-03-02' + time '17:30') at time zone 'Indian/Reunion', '2026-03-02');

select is(
  (select worked_minutes from public.daily_worked_time
    where employee_id = 'dddddddd-0000-4000-8000-000000000203'
      and local_date = '2026-03-02'),
  420,
  'Neuf heures trente moins une pause d''une heure trente font sept heures'
);

select is(
  (select is_open from public.daily_worked_time
    where employee_id = 'dddddddd-0000-4000-8000-000000000203'
      and local_date = '2026-03-02'),
  false,
  'Une journée pointée de bout en bout n''est plus ouverte'
);

-- ================================================================ alertes ====
-- On se place à 15 h à La Réunion : tout le monde aurait dû être arrivé.
update public.settings set value = '10'::jsonb where key = 'late_tolerance_minutes';

select is(
  (public.pointage_run_checks(
     (public.reunion_today() + time '15:00') at time zone 'Indian/Reunion') ->> 'late')::integer,
  0,
  'Personne n''est en retard : celles qui devaient pointer ont pointé'
);

-- PtgBea a pointé son arrivée. On la retire pour créer un vrai retard.
delete from public.time_clocks where employee_id = 'dddddddd-0000-4000-8000-000000000202';

select is(
  (public.pointage_run_checks(
     (public.reunion_today() + time '15:00') at time zone 'Indian/Reunion') ->> 'late')::integer,
  1,
  'Une arrivée jamais pointée déclenche une alerte'
);

select is(
  (public.pointage_run_checks(
     (public.reunion_today() + time '15:10') at time zone 'Indian/Reunion') ->> 'late')::integer,
  0,
  'La tâche suivante n''alerte pas une seconde fois pour la même journée'
);

select is(
  (select count(*) from public.pointage_alerts
    where employee_id = 'dddddddd-0000-4000-8000-000000000203'),
  0::bigint,
  'Un jour d''école n''est pas un retard : aucune alerte pour l''alternante'
);

select is(
  (public.pointage_run_checks(
     (public.reunion_today() + time '03:00') at time zone 'Indian/Reunion') ->> 'skipped'),
  'hors fenêtre',
  'La tâche ne dérange personne au milieu de la nuit'
);

-- ================================================================== purge ====
update public.time_clocks
   set photo_path = 'dddddddd-0000-4000-8000-000000000201/vieux-selfie.jpg',
       local_date = public.reunion_today() - 200
 where employee_id = 'dddddddd-0000-4000-8000-000000000201'
   and event_type = 'break_start';

select is(
  (select count(*) from public.selfies_to_purge()),
  1::bigint,
  'Un selfie au-delà de la rétention est proposé à la purge'
);

select is(
  public.mark_selfies_purged(array['dddddddd-0000-4000-8000-000000000201/vieux-selfie.jpg']),
  1,
  'La purge oublie le chemin du selfie'
);

select is(
  (select count(*) from public.time_clocks
    where employee_id = 'dddddddd-0000-4000-8000-000000000201'
      and event_type = 'break_start'),
  1::bigint,
  'Le pointage lui-même survit à la purge de sa photo'
);

-- Supabase refuse tout DELETE en SQL sur ses tables de stockage : effacer la
-- ligne sans effacer le fichier laisserait un octet que plus rien ne référence,
-- donc que plus rien ne pourrait supprimer. La purge doit passer par l'API
-- Storage, et ce test est là pour qu'on ne réessaie jamais en SQL.
select throws_ok(
  $$delete from storage.objects where bucket_id = 'selfies'$$,
  '42501', null,
  'La base refuse qu''on supprime un fichier du stockage en SQL'
);

select is(
  (select count(*) from storage.objects
    where name = 'dddddddd-0000-4000-8000-000000000202/photo-1.jpg'),
  1::bigint,
  'La purge ne touche pas au stockage : c''est le rôle de la tâche planifiée'
);

-- ==================================================== cloisonnement lecture ==
set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-0000-4000-8000-000000000201","role":"authenticated"}';

select is(
  (select count(*) from public.time_clocks
    where employee_id <> 'dddddddd-0000-4000-8000-000000000201'),
  0::bigint,
  'Une collaboratrice ne voit aucun pointage qui ne soit le sien'
);

reset role;

select * from finish();
rollback;
