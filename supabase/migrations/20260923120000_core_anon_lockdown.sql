-- =============================================================================
-- 20260923120000_core_anon_lockdown — refermer la porte de `anon`, et pouvoir
-- la refermer à nouveau
--
-- Incident, constaté par les tests pgTAP sur le projet réel : après l'arrivée des
-- tables du planning et du pointage, `anon` s'est retrouvé avec des droits sur
-- **les quatorze tables** du schéma public — les dix tables d'origine comprises,
-- dont les révocations dataient de la Phase 1. Une fonction `rls_auto_enable`,
-- que nous n'avons pas écrite, est apparue dans le schéma public, elle aussi
-- appelable par un visiteur anonyme.
--
-- Autrement dit : la plateforme réaccorde des droits, et pas seulement sur les
-- tables qu'on vient de créer. La RLS tenait toujours — aucune donnée n'était
-- lisible — mais le principe posé en Phase 1 était rompu, et une table qu'on
-- oublierait de protéger un jour ne serait plus retenue que par une seule
-- barrière au lieu de deux.
--
-- Deux conséquences, appliquées ici :
--   1. une révocation générale, maintenant ;
--   2. une fonction pour la rejouer, que **toute migration créant une table doit
--      appeler en dernière ligne**.
-- =============================================================================

create or replace function public.revoke_anon_table_privileges()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  -- `anon` n'a besoin d'aucune table : les écrans d'avant-connexion passent par
  -- des fonctions `security definer` qui ne renvoient que des prénoms. Une
  -- révocation générale ne peut donc rien casser, et se rejoue sans effet.
  revoke all on all tables in schema public from anon;
  revoke all on all sequences in schema public from anon;
end;
$$;

comment on function public.revoke_anon_table_privileges() is
  'Retire à anon tout droit sur les tables du schéma public. À appeler en fin de toute migration qui crée une table.';

revoke all on function public.revoke_anon_table_privileges() from public, anon, authenticated;
grant execute on function public.revoke_anon_table_privileges() to service_role;

select public.revoke_anon_table_privileges();

-- Et que les futures tables naissent fermées, plutôt que d'être refermées après
-- coup. Le pendant de ce qu'a fait `20260922140000_core_function_grants` pour
-- les fonctions.
alter default privileges for role postgres in schema public
  revoke all on tables from anon;

-- -----------------------------------------------------------------------------
-- `rls_auto_enable` : fonction de la plateforme, apparue dans le schéma public.
--
-- C'est le corps d'un event trigger ; un event trigger s'exécute avec les droits
-- du système, jamais avec ceux de l'appelant. Lui retirer l'exécution ne le prive
-- donc de rien, et referme une porte que personne n'a demandé à ouvrir.
--
-- Le bloc est défensif : la fonction ne nous appartient pas forcément, et un
-- refus de privilège ne doit pas faire échouer `db push` — le seul chemin de mise
-- à jour de la base dont dispose le propriétaire.
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'rls_auto_enable'
  ) then
    execute 'revoke all on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
exception
  when insufficient_privilege then
    raise warning 'public.rls_auto_enable reste appelable : privilèges insuffisants pour la révoquer.';
  when others then
    raise warning 'public.rls_auto_enable : révocation impossible (%).', sqlerrm;
end;
$$;
