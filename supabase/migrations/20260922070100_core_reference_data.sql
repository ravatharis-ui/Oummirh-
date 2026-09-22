-- =============================================================================
-- 20260922070100_core_reference_data — sales outlets, contract types, settings, holidays.
--
-- Reference data lives in a migration rather than in supabase/seed.sql because
-- the project is developed against a hosted Supabase project: `supabase db push`
-- applies migrations, but never runs seed.sql, and `db reset` would wipe real
-- data. Every statement below is idempotent, so re-running is harmless and
-- values edited later from /admin/parametres are preserved.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Sales outlets
-- -----------------------------------------------------------------------------
insert into public.boutiques (code, name, kind, sort_order) values
  ('STDENIS',  'Oummi Dressing Saint-Denis',  'physical', 10),
  ('STLOUIS',  'Oummi Dressing Saint-Louis',  'physical', 20),
  ('STPAUL',   'Oummi Dressing Saint-Paul',   'physical', 30),
  ('STPIERRE', 'Oummi Dressing Saint-Pierre', 'physical', 40),
  ('ONLINE',   'Boutique en ligne',           'online',   50)
on conflict (code) do nothing;

-- -----------------------------------------------------------------------------
-- Contract types
-- -----------------------------------------------------------------------------
insert into public.contract_types (code, label, is_apprenticeship, sort_order) values
  ('CDI',           'CDI',           false, 10),
  ('CDD',           'CDD',           false, 20),
  ('TEMPS_PARTIEL', 'Temps partiel', false, 30),
  ('ALTERNANCE',    'Alternance',    true,  40)
on conflict (code) do nothing;

-- -----------------------------------------------------------------------------
-- Settings
--
-- leave_rules.mode:
--   'ouvrables' → 2,5 jours / mois, 30 jours / an, lundi→samedi hors fériés
--   'ouvres'    → 2,08 jours / mois, 25 jours / an, lundi→vendredi hors fériés
-- The prudent legal default in France is 'ouvrables'; both are implemented in
-- Phase 6 and the choice is switchable from /admin/parametres.
-- -----------------------------------------------------------------------------
insert into public.settings (key, value) values
  ('company_name', '"Oummi Dressing"'::jsonb),
  ('timezone', '"Indian/Reunion"'::jsonb),
  ('default_schedule', jsonb_build_object(
      'start', '09:00',
      'end', '17:30',
      'break_start', '12:30',
      'break_end', '14:00'
  )),
  ('leave_rules', jsonb_build_object(
      'mode', 'ouvrables',
      'days_per_month', 2.5,
      'period_start_month', 6,
      'period_start_day', 1,
      'carry_over', true
  )),
  ('late_tolerance_minutes', '10'::jsonb),
  ('selfie_retention_days', '60'::jsonb),
  ('overtime_recovery_min_step_minutes', '15'::jsonb),
  -- Explicit per-module switch. A module absent from this object stays enabled.
  ('modules_enabled', jsonb_build_object(
      'employees', true,
      'pointage', true,
      'planning', true,
      'conges', true,
      'heures', true,
      'remplacements', true,
      'swaps', true,
      'documents', true,
      'demo', true
  ))
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- Public holidays — La Réunion, current and next year.
-- Includes 20 December (abolition de l'esclavage), specific to the island.
-- Movable feasts are computed from Easter: 2026-04-05 and 2027-03-28.
-- -----------------------------------------------------------------------------
insert into public.public_holidays (date, label) values
  ('2026-01-01', 'Jour de l''An'),
  ('2026-04-06', 'Lundi de Pâques'),
  ('2026-05-01', 'Fête du Travail'),
  ('2026-05-08', 'Victoire 1945'),
  ('2026-05-14', 'Ascension'),
  ('2026-05-25', 'Lundi de Pentecôte'),
  ('2026-07-14', 'Fête nationale'),
  ('2026-08-15', 'Assomption'),
  ('2026-11-01', 'Toussaint'),
  ('2026-11-11', 'Armistice 1918'),
  ('2026-12-20', 'Abolition de l''esclavage'),
  ('2026-12-25', 'Noël'),
  ('2027-01-01', 'Jour de l''An'),
  ('2027-03-29', 'Lundi de Pâques'),
  ('2027-05-01', 'Fête du Travail'),
  ('2027-05-06', 'Ascension'),
  ('2027-05-08', 'Victoire 1945'),
  ('2027-05-17', 'Lundi de Pentecôte'),
  ('2027-07-14', 'Fête nationale'),
  ('2027-08-15', 'Assomption'),
  ('2027-11-01', 'Toussaint'),
  ('2027-11-11', 'Armistice 1918'),
  ('2027-12-20', 'Abolition de l''esclavage'),
  ('2027-12-25', 'Noël')
on conflict (date) do nothing;
