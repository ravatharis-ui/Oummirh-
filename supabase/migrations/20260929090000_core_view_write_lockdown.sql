-- =============================================================================
-- 20260929090000_core_view_write_lockdown — les vues aussi naissent ouvertes
--
-- Incident, constaté par l'audit RLS sur le projet réel : `authenticated` avait
-- les droits d'insertion, de modification et de suppression sur
-- `effective_time_clocks` et `daily_worked_time`. Nos migrations ne leur avaient
-- accordé que `select` — la plateforme applique
-- `alter default privileges ... grant all on tables`, et **PostgreSQL range les
-- vues parmi les tables**.
--
-- Le risque réel était nul : les deux vues sont en `security_invoker`, donc une
-- écriture serait passée sous la RLS de `time_clocks`, qui n'a aucune politique
-- d'écriture pour personne ; et une vue bâtie sur `distinct on` ou sur une
-- agrégation n'est de toute façon pas modifiable. Mais c'est le même principe
-- qu'en Phase 5 : deux barrières valent mieux qu'une, et une vue qu'on
-- ajouterait demain sur une table moins bien protégée ne serait retenue par
-- rien.
--
-- Troisième fois que la plateforme rouvre une porte que nous avions fermée :
-- après les fonctions (`core_function_grants`) et les tables pour `anon`
-- (`core_anon_lockdown`), les vues pour `authenticated`. Même réponse : une
-- fonction rejouable, appelée maintenant, et à rappeler en fin de toute
-- migration qui crée une vue.
-- =============================================================================

create or replace function public.revoke_view_write_privileges()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_view record;
begin
  -- Une révocation générale sur `all tables` emporterait aussi `user_roles`,
  -- seule table encore écrite depuis le navigateur, et les droits colonne par
  -- colonne de `employees` et `notifications`. On ne vise donc que les vues,
  -- une par une.
  for v_view in
    select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('v', 'm')
  loop
    execute format(
      'revoke insert, update, delete, truncate on public.%I from anon, authenticated',
      v_view.relname
    );
  end loop;

  -- Une vue ne sert qu'à lire ; `anon` n'a rien à y faire du tout.
  perform public.revoke_anon_table_privileges();
end;
$$;

comment on function public.revoke_view_write_privileges() is
  'Retire aux sessions tout droit d''écriture sur les vues du schéma public. À appeler en fin de toute migration qui crée une vue.';

revoke all on function public.revoke_view_write_privileges() from public, anon, authenticated;
grant execute on function public.revoke_view_write_privileges() to service_role;

select public.revoke_view_write_privileges();
