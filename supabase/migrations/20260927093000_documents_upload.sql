-- =============================================================================
-- 20260927093000_documents_upload — la direction dépose depuis son navigateur
--
-- Un PDF de dix mégaoctets ne traverse pas une server action : Next impose une
-- limite sur le corps d'une action, et l'augmenter ferait passer chaque fiche de
-- paie par la mémoire du serveur d'application pour rien.
--
-- Le fichier va donc directement du navigateur de la direction au stockage, et
-- seule la ligne de base passe par le serveur. Deux politiques suffisent, toutes
-- deux réservées à la direction — une collaboratrice n'écrit jamais dans ce
-- bucket, elle ne fait qu'y lire ce qui lui appartient.
-- =============================================================================
do $$
begin
  drop policy if exists "documents: la direction dépose" on storage.objects;
  create policy "documents: la direction dépose"
    on storage.objects for insert to authenticated
    with check (bucket_id = 'documents' and (select public.is_admin()));

  -- Le retrait sert à deux choses : effacer un document déposé par erreur, et
  -- nettoyer un fichier dont l'enregistrement en base a échoué — sinon le
  -- stockage accumulerait des orphelins que plus rien ne référence.
  drop policy if exists "documents: la direction retire" on storage.objects;
  create policy "documents: la direction retire"
    on storage.objects for delete to authenticated
    using (bucket_id = 'documents' and (select public.is_admin()));
exception
  when insufficient_privilege then
    raise warning 'Politiques de dépôt du bucket « documents » à créer à la main dans le tableau de bord Supabase.';
end;
$$;
