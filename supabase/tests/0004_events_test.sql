-- pgTAP: bus d'événements et notifications.
--
-- Ce que ces tests protègent : un module ne peut pas injecter d'événement depuis
-- le navigateur, deux distributeurs ne traitent pas le même événement, et un
-- événement qui échoue toujours finit par être abandonné au lieu de tourner en
-- boucle indéfiniment.

begin;
select plan(18);

-- ---------------------------------------------------------------- fixtures --
insert into auth.users (id, email) values
  ('ffffffff-0000-4000-8000-000000000001', 'evt-a@test.invalid'),
  ('ffffffff-0000-4000-8000-000000000002', 'evt-b@test.invalid');

insert into public.user_roles (user_id, role, boutique_id) values
  ('ffffffff-0000-4000-8000-000000000001', 'employee', null),
  ('ffffffff-0000-4000-8000-000000000002', 'employee', null);

-- ------------------------------------------------------------- émission -----
select throws_ok(
  $$select public.emit_event('pasunformat')$$,
  '22023', null,
  'Un type d''événement sans point est refusé'
);

select throws_ok(
  $$select public.emit_event('Module.Action')$$,
  '22023', null,
  'Un type d''événement en majuscules est refusé'
);

select lives_ok(
  $$select set_config('test.evt1',
      public.emit_event('demo.hello', '{"n":1}'::jsonb,
                        'ffffffff-0000-4000-8000-000000000001')::text, false)$$,
  'Un événement bien formé est accepté'
);

select is(
  (select type from public.domain_events where id = current_setting('test.evt1')::uuid),
  'demo.hello',
  'L''événement est enregistré avec son type'
);

select is(
  (select payload->>'n' from public.domain_events where id = current_setting('test.evt1')::uuid),
  '1',
  'La charge utile est conservée'
);

select is(
  (select attempts from public.domain_events where id = current_setting('test.evt1')::uuid),
  0,
  'Un événement neuf n''a encore été tenté aucune fois'
);

-- ------------------------------------------------- personne d'autre n'émet ---
set local role authenticated;
set local request.jwt.claims = '{"sub":"ffffffff-0000-4000-8000-000000000001","role":"authenticated"}';

select throws_ok(
  $$select public.emit_event('demo.hello')$$,
  '42501', null,
  'Une session ne peut pas injecter d''événement'
);

select throws_ok(
  $$select public.notify_user('ffffffff-0000-4000-8000-000000000002', 'demo.hello', 't', 'b')$$,
  '42501', null,
  'Une session ne peut pas notifier quelqu''un d''autre'
);

select throws_ok(
  $$select public.claim_domain_events()$$,
  '42501', null,
  'Une session ne peut pas réserver les événements'
);

reset role;

-- --------------------------------------------------------------- réservation --
select is(
  (select count(*) from public.claim_domain_events(50)
    where id = current_setting('test.evt1')::uuid),
  1::bigint,
  'Le distributeur réserve un événement non traité'
);

select is(
  (select attempts from public.domain_events where id = current_setting('test.evt1')::uuid),
  1,
  'La réservation compte la tentative, avant même d''exécuter le gestionnaire'
);

-- Le compteur est incrémenté à la réservation, donc un événement qui fait
-- tomber le distributeur finit quand même par sortir de la file.
select lives_ok(
  $$update public.domain_events set attempts = 5
     where id = current_setting('test.evt1')::uuid$$,
  'Simulation de cinq tentatives'
);

select is(
  (select count(*) from public.claim_domain_events(50)
    where id = current_setting('test.evt1')::uuid),
  0::bigint,
  'Après cinq tentatives, l''événement est abandonné et n''est plus réservé'
);

-- ------------------------------------------------------------------ issue ---
select lives_ok(
  $$select public.mark_event_failed(current_setting('test.evt1')::uuid, 'gestionnaire en panne')$$,
  'Le motif du dernier échec est conservé'
);

select is(
  (select processed_at is null and last_error = 'gestionnaire en panne'
     from public.domain_events where id = current_setting('test.evt1')::uuid),
  true,
  'Un échec enregistre le motif sans marquer l''événement comme traité'
);

-- Deux instructions distinctes : dans une seule, le SELECT lirait la ligne
-- telle qu'elle était avant l'UPDATE fait par la fonction.
select public.mark_event_processed(current_setting('test.evt1')::uuid);

select is(
  (select processed_at is not null and last_error is null
     from public.domain_events where id = current_setting('test.evt1')::uuid),
  true,
  'Le succès efface le motif d''échec'
);

-- ---------------------------------------------------------- notifications ---
select lives_ok(
  $$select public.notify_user('ffffffff-0000-4000-8000-000000000001', 'demo.hello',
      'Bonjour', 'Corps du message', '/demo')$$,
  'Le serveur dépose une notification'
);

-- Marquer comme lu passe par la RLS de l'appelante : impossible de toucher
-- la ligne d'une autre, même en appelant la fonction prévue pour cela.
insert into public.notifications (recipient_user_id, type, title, body)
  values ('ffffffff-0000-4000-8000-000000000002', 'demo.hello', 'Pour B', 'corps');

set local role authenticated;
set local request.jwt.claims = '{"sub":"ffffffff-0000-4000-8000-000000000001","role":"authenticated"}';
select public.mark_all_notifications_read();
reset role;

select is(
  (select count(*) from public.notifications
    where recipient_user_id = 'ffffffff-0000-4000-8000-000000000002' and read_at is not null),
  0::bigint,
  'Tout marquer comme lu ne touche pas les notifications d''une collègue'
);

select * from finish();
rollback;
