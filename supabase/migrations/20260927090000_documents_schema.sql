-- =============================================================================
-- 20260927090000_documents_schema — coffre-fort numérique
--
-- Des fiches de paie, des contrats, des attestations. Ce que ce module tient,
-- ce n'est pas un partage de fichiers : c'est le seul endroit où une
-- collaboratrice retrouvera son bulletin de septembre dans deux ans.
--
-- Une seule exigence gouverne tout le fichier, et c'est aussi le critère
-- d'acceptation de la phase : **une collaboratrice ne peut pas télécharger le
-- document d'une autre, même en devinant le chemin.** D'où trois barrières
-- superposées — la RLS sur la table, la politique de stockage sur le chemin, et
-- l'URL signée qui expire en soixante secondes.
-- =============================================================================

create table public.documents (
  id            uuid primary key default gen_random_uuid(),
  employee_id   uuid not null references public.employees (id) on delete cascade,

  category      text not null check (
    category in ('payslip', 'contract', 'amendment', 'certificate', 'other')
  ),

  title         text not null,

  -- La période que le document couvre, pour les fiches de paie surtout.
  -- Un contrat n'en a pas : la colonne est nullable, et c'est voulu.
  period_month  date,

  -- `<employee_id>/<uuid>.pdf` dans le bucket privé `documents`.
  storage_path  text not null unique,
  size_bytes    integer not null check (size_bytes > 0),

  -- Quand elle l'a ouvert pour la première fois. NULL = jamais ouvert, et c'est
  -- précisément l'information que la direction cherche.
  first_viewed_at timestamptz,

  uploaded_by   uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),

  constraint documents_payslip_needs_period check (
    category <> 'payslip' or period_month is not null
  )
);

create index documents_employee_idx
  on public.documents (employee_id, category, period_month desc);
create index documents_unread_idx
  on public.documents (employee_id) where first_viewed_at is null;

comment on table public.documents is
  'Coffre-fort : documents déposés par la direction, consultables par la seule intéressée.';
comment on column public.documents.first_viewed_at is
  'Première ouverture. NULL signifie « jamais ouvert », ce que la direction a besoin de voir.';

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.documents enable row level security;

create policy "documents: chacune voit les siens"
  on public.documents for select to authenticated
  using (employee_id = (select public.current_employee_id()));

create policy "documents: la direction voit tout"
  on public.documents for select to authenticated
  using ((select public.is_admin()));

revoke all on public.documents from anon, authenticated;
grant select on public.documents to authenticated;
grant all on public.documents to service_role;

-- =============================================================================
-- Le bucket
--
-- Même précaution défensive que pour les selfies : sur un projet hébergé,
-- `storage.objects` n'appartient pas toujours au rôle qui applique les
-- migrations, et un refus de privilège ne doit pas faire échouer `db push` —
-- le seul chemin de mise à jour de la base dont dispose le propriétaire.
-- =============================================================================
do $$
begin
  insert into storage.buckets (id, name, public)
  values ('documents', 'documents', false)
  on conflict (id) do nothing;

  -- Aucune politique d'insert pour `authenticated` : un document est déposé par
  -- la direction, depuis le serveur, avec la clé de service. Le navigateur
  -- d'une collaboratrice n'écrit jamais dans ce bucket.
  drop policy if exists "documents: chacune relit les siens" on storage.objects;
  create policy "documents: chacune relit les siens"
    on storage.objects for select to authenticated
    using (
      bucket_id = 'documents'
      and (
        (storage.foldername(name))[1] = (select public.current_employee_id())::text
        or (select public.is_admin())
      )
    );
exception
  when insufficient_privilege then
    raise warning 'Bucket « documents » à créer à la main dans le tableau de bord Supabase (privilèges insuffisants sur storage).';
end;
$$;

-- =============================================================================
-- Déposer
-- =============================================================================
create or replace function public.admin_add_document(
  p_employee_id  uuid,
  p_category     text,
  p_title        text,
  p_storage_path text,
  p_size_bytes   integer,
  p_period_month date default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Seule la direction dépose un document.' using errcode = '42501';
  end if;

  if p_title is null or length(btrim(p_title)) = 0 then
    raise exception 'Le document doit porter un titre.' using errcode = '22023';
  end if;

  -- Le chemin doit être dans le dossier de la collaboratrice. C'est déjà ce que
  -- la politique de stockage impose à la lecture ; le vérifier ici évite qu'une
  -- ligne pointe vers un fichier qu'elle ne pourra jamais ouvrir.
  if (storage.foldername(p_storage_path))[1] is distinct from p_employee_id::text then
    raise exception 'Chemin de document invalide.' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.employees e where e.id = p_employee_id and e.is_active
  ) then
    raise exception 'Collaboratrice introuvable ou inactive.' using errcode = '23503';
  end if;

  insert into public.documents (
    employee_id, category, title, period_month, storage_path, size_bytes, uploaded_by
  ) values (
    p_employee_id, p_category, btrim(p_title), p_period_month, p_storage_path, p_size_bytes,
    (select auth.uid())
  )
  returning id into v_id;

  insert into public.audit_log (actor_id, action, entity, entity_id, after)
  values ((select auth.uid()), 'document.added', 'documents', v_id,
          jsonb_build_object('employee_id', p_employee_id, 'category', p_category,
                             'title', btrim(p_title), 'period_month', p_period_month));

  perform public.emit_event(
    'documents.added',
    jsonb_build_object('id', v_id, 'employee_id', p_employee_id, 'category', p_category,
                       'title', btrim(p_title), 'period_month', p_period_month)
  );

  return v_id;
end;
$$;

revoke all on function public.admin_add_document from public, anon;
grant execute on function public.admin_add_document to authenticated, service_role;

-- =============================================================================
-- Consulter
--
-- Le marquage se fait ici, pas depuis le navigateur : une collaboratrice ne doit
-- pas pouvoir prétendre n'avoir jamais vu un document — ni, d'ailleurs, en
-- marquer un comme vu sans l'avoir ouvert.
--
-- Seule la **première** ouverture est retenue. Combien de fois elle relit son
-- bulletin ne regarde personne.
-- =============================================================================
create or replace function public.mark_document_viewed(p_document_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := public.current_employee_id();
begin
  if v_me is null then
    return;
  end if;

  update public.documents
     set first_viewed_at = now()
   where id = p_document_id
     and employee_id = v_me
     and first_viewed_at is null;
end;
$$;

comment on function public.mark_document_viewed(uuid) is
  'Retient la première ouverture d''un document par son destinataire. Jamais les suivantes.';

revoke all on function public.mark_document_viewed(uuid) from public, anon;
grant execute on function public.mark_document_viewed(uuid) to authenticated, service_role;

-- =============================================================================
-- Retirer
--
-- Un document déposé par erreur — le bulletin de quelqu'un d'autre — doit
-- pouvoir disparaître vite. La ligne part ; le fichier est supprimé par l'API
-- Storage, depuis le serveur, comme pour les selfies.
-- =============================================================================
create or replace function public.admin_remove_document(p_document_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_before public.documents;
begin
  if not public.is_admin() then
    raise exception 'Seule la direction retire un document.' using errcode = '42501';
  end if;

  delete from public.documents where id = p_document_id returning * into v_before;

  if v_before.id is null then
    return null;
  end if;

  insert into public.audit_log (actor_id, action, entity, entity_id, before)
  values ((select auth.uid()), 'document.removed', 'documents', p_document_id,
          to_jsonb(v_before));

  return v_before.storage_path;
end;
$$;

revoke all on function public.admin_remove_document(uuid) from public, anon;
grant execute on function public.admin_remove_document(uuid) to authenticated, service_role;

select public.revoke_anon_table_privileges();
