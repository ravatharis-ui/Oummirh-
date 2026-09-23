-- pgTAP: coffre-fort numérique.
--
-- Le critère d'acceptation de la phase, et ce que ce fichier éprouve :
-- **une collaboratrice ne peut pas atteindre le document d'une autre, même en
-- devinant le chemin.** Trois barrières le garantissent — la RLS sur la table,
-- la politique de stockage sur le chemin, et l'URL signée qui expire.

begin;
select plan(23);

-- ---------------------------------------------------------------- fixtures --
insert into public.boutiques (id, code, name, kind, sort_order) values
  ('bbbbbbbb-0000-4000-8000-000000000801', 'TEST_DOC', 'Boutique documents', 'physical', 9800);

insert into auth.users (id, email) values
  ('cccccccc-0000-4000-8000-000000000801', 'doc-a@staff.oummi.invalid'),
  ('cccccccc-0000-4000-8000-000000000802', 'doc-b@staff.oummi.invalid'),
  ('cccccccc-0000-4000-8000-000000000803', 'doc-direction@oummi.invalid');

insert into public.user_roles (user_id, role, boutique_id) values
  ('cccccccc-0000-4000-8000-000000000801', 'employee', null),
  ('cccccccc-0000-4000-8000-000000000802', 'employee', null),
  ('cccccccc-0000-4000-8000-000000000803', 'admin', null);

insert into public.employees (id, auth_user_id, last_name, first_name, display_name,
  boutique_id, contract_type_id, pin_hash)
values
  ('dddddddd-0000-4000-8000-000000000801', 'cccccccc-0000-4000-8000-000000000801',
   'TESTDOC', 'DocAnna', 'DocAnna', 'bbbbbbbb-0000-4000-8000-000000000801',
   (select id from public.contract_types where code = 'CDI'),
   extensions.crypt('7392', extensions.gen_salt('bf'))),
  ('dddddddd-0000-4000-8000-000000000802', 'cccccccc-0000-4000-8000-000000000802',
   'TESTDOC', 'DocBea', 'DocBea', 'bbbbbbbb-0000-4000-8000-000000000801',
   (select id from public.contract_types where code = 'CDI'),
   extensions.crypt('8461', extensions.gen_salt('bf')));

-- ================================================================= grants ====
select is(
  (select count(*) from information_schema.table_privileges
    where table_schema = 'public' and table_name = 'documents' and grantee = 'anon'),
  0::bigint,
  'Un visiteur anonyme n''a aucun droit sur les documents'
);

select is(
  (select count(*) from information_schema.table_privileges
    where table_schema = 'public' and table_name = 'documents'
      and grantee = 'authenticated' and privilege_type <> 'SELECT'),
  0::bigint,
  'Une session ne peut que lire : un document ne s''écrit pas depuis un navigateur'
);

-- ============================================================== le dépôt =====
set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-0000-4000-8000-000000000801","role":"authenticated"}';

select throws_ok(
  $$select public.admin_add_document('dddddddd-0000-4000-8000-000000000801', 'payslip',
      'Ma fiche de paie', 'dddddddd-0000-4000-8000-000000000801/moi.pdf', 1000, '2026-09-01')$$,
  '42501', null,
  'Une collaboratrice ne dépose pas de document, même pour elle-même'
);

reset role;
set local request.jwt.claims = '';

set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-0000-4000-8000-000000000803","role":"authenticated"}';

select throws_ok(
  $$select public.admin_add_document('dddddddd-0000-4000-8000-000000000801', 'payslip',
      'Fiche de paie', 'dddddddd-0000-4000-8000-000000000802/paie.pdf', 1000, '2026-09-01')$$,
  '22023', null,
  'Un chemin rangé dans le dossier d''une autre est refusé'
);

select throws_ok(
  $$select public.admin_add_document('dddddddd-0000-4000-8000-000000000801', 'payslip',
      '   ', 'dddddddd-0000-4000-8000-000000000801/paie.pdf', 1000, '2026-09-01')$$,
  '22023', null,
  'Un document sans titre est refusé'
);

select throws_ok(
  $$select public.admin_add_document('dddddddd-0000-4000-8000-000000000801', 'payslip',
      'Fiche de paie', 'dddddddd-0000-4000-8000-000000000801/paie.pdf', 1000, null)$$,
  '23514', null,
  'Une fiche de paie sans période est refusée : sinon on ne la retrouve pas'
);

select lives_ok(
  $$select set_config('test.doc',
      public.admin_add_document('dddddddd-0000-4000-8000-000000000801', 'payslip',
        'Fiche de paie septembre 2026',
        'dddddddd-0000-4000-8000-000000000801/paie-09.pdf', 84000, '2026-09-01')::text, false)$$,
  'La direction dépose une fiche de paie'
);

select lives_ok(
  $$select public.admin_add_document('dddddddd-0000-4000-8000-000000000801', 'contract',
      'Contrat de travail', 'dddddddd-0000-4000-8000-000000000801/contrat.pdf', 120000)$$,
  'Un contrat se dépose sans période : il n''en a pas'
);

select lives_ok(
  $$select set_config('test.doc_b',
      public.admin_add_document('dddddddd-0000-4000-8000-000000000802', 'payslip',
        'Fiche de paie septembre 2026',
        'dddddddd-0000-4000-8000-000000000802/paie-09.pdf', 81000, '2026-09-01')::text, false)$$,
  'Et une autre pour sa collègue'
);

reset role;
set local request.jwt.claims = '';

select is(
  (select count(*) from public.domain_events
    where type = 'documents.added' and payload->>'id' = current_setting('test.doc')),
  1::bigint,
  'La collaboratrice est prévenue par un événement'
);

select is(
  (select count(*) from public.audit_log where action = 'document.added'),
  3::bigint,
  'Chaque dépôt est journalisé'
);

-- ================================================ le cloisonnement, le vrai ==
set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-0000-4000-8000-000000000801","role":"authenticated"}';

select is(
  (select count(*) from public.documents
    where employee_id <> 'dddddddd-0000-4000-8000-000000000801'),
  0::bigint,
  'Une collaboratrice ne voit aucun document qui ne soit le sien'
);

-- Même en connaissant l'identifiant exact du document de sa collègue.
select is(
  (select count(*) from public.documents where id = current_setting('test.doc_b')::uuid),
  0::bigint,
  'Même en devinant l''identifiant, le document d''une collègue reste invisible'
);

select is(
  (select count(*) from public.documents), 2::bigint,
  'Elle voit exactement ses deux documents'
);

-- ==================================================== le suivi de lecture ====
select is(
  (select first_viewed_at from public.documents where id = current_setting('test.doc')::uuid),
  null,
  'Un document neuf n''a jamais été ouvert'
);

select lives_ok(
  $$select public.mark_document_viewed(current_setting('test.doc')::uuid)$$,
  'Elle ouvre son document'
);

reset role;
set local request.jwt.claims = '';

select ok(
  (select first_viewed_at is not null from public.documents
    where id = current_setting('test.doc')::uuid),
  'La première ouverture est retenue'
);

select set_config('test.first_view',
  (select first_viewed_at::text from public.documents
    where id = current_setting('test.doc')::uuid), false);

-- Marquer le document d'une collègue ne doit rien faire du tout.
set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-0000-4000-8000-000000000801","role":"authenticated"}';

select lives_ok(
  $$select public.mark_document_viewed(current_setting('test.doc_b')::uuid)$$,
  'Marquer le document d''une collègue ne lève pas d''erreur'
);

select lives_ok(
  $$select public.mark_document_viewed(current_setting('test.doc')::uuid)$$,
  'Relire son propre document ne lève pas d''erreur'
);

reset role;
set local request.jwt.claims = '';

select is(
  (select first_viewed_at from public.documents where id = current_setting('test.doc_b')::uuid),
  null,
  'Et le document de la collègue reste marqué comme jamais ouvert'
);

select is(
  (select first_viewed_at::text from public.documents
    where id = current_setting('test.doc')::uuid),
  current_setting('test.first_view'),
  'Seule la première ouverture est retenue : le reste ne regarde personne'
);

-- ========================================================== le retrait =======
set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-0000-4000-8000-000000000801","role":"authenticated"}';
select throws_ok(
  $$select public.admin_remove_document(current_setting('test.doc')::uuid)$$,
  '42501', null,
  'Une collaboratrice ne retire pas un document'
);
reset role;
set local request.jwt.claims = '';

set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-0000-4000-8000-000000000803","role":"authenticated"}';
select is(
  public.admin_remove_document(current_setting('test.doc_b')::uuid),
  'dddddddd-0000-4000-8000-000000000802/paie-09.pdf',
  'La direction retire un document et récupère le chemin du fichier à supprimer'
);
reset role;
set local request.jwt.claims = '';

select * from finish();
rollback;
