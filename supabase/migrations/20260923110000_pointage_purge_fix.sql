-- =============================================================================
-- 20260923110000_pointage_purge_fix — la purge ne touche plus storage.objects
--
-- Supabase protège ses tables de stockage par un trigger, `storage.protect_delete`,
-- qui refuse tout DELETE en SQL :
--
--     Direct deletion from storage tables is not allowed. Use the Storage API instead.
--
-- Il a raison : effacer la ligne sans effacer le fichier laisserait un octet
-- orphelin que plus rien ne référence, donc que plus rien ne pourra jamais
-- supprimer. C'est exactement l'inverse de ce qu'une purge de rétention doit faire.
--
-- La suppression du fichier appartenait déjà à la route `/api/cron/selfies`, qui
-- passe par l'API Storage. Cette fonction n'a donc plus qu'un seul rôle : oublier
-- le chemin. Le pointage, lui, n'est jamais supprimé.
-- =============================================================================
create or replace function public.mark_selfies_purged(p_paths text[])
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.time_clocks
     set photo_path = null
   where photo_path = any (coalesce(p_paths, '{}'::text[]));
  get diagnostics v_count = row_count;

  return v_count;
end;
$$;

comment on function public.mark_selfies_purged(text[]) is
  'Oublie les chemins des selfies purgés. Le fichier est supprimé par l''API Storage, jamais en SQL.';

revoke all on function public.mark_selfies_purged(text[]) from public, anon, authenticated;
grant execute on function public.mark_selfies_purged(text[]) to service_role;
