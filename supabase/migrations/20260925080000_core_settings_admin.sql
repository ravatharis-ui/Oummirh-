-- =============================================================================
-- 20260925080000_core_settings_admin — le gérant change les règles lui-même
--
-- Jusqu'ici, la direction pouvait écrire directement dans `settings`,
-- `boutiques`, `contract_types` et `public_holidays` : la RLS l'autorisait. Ça
-- marche, mais ça laisse passer trois choses qu'on ne veut pas dans une
-- application qui tient les congés et les heures de vraies personnes :
--
--   1. une modification sans trace — qui a changé la règle d'acquisition, quand,
--      et quelle était la valeur d'avant ?
--   2. une clé de réglage inventée par une faute de frappe, que plus rien ne lit ;
--   3. un point de vente supprimé alors que des plannings et des pointages le
--      référencent encore.
--
-- À partir d'ici, ces quatre tables ne sont plus écrites depuis le navigateur.
-- Tout passe par les fonctions ci-dessous, qui revérifient le rôle, refusent
-- l'absurde, et écrivent dans `audit_log` avec l'avant et l'après.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Un réglage
--
-- La clé doit **déjà exister**. Créer un réglage est une décision de code — il
-- faut bien que quelque chose le lise — et passe donc par une migration. Cette
-- fonction ne sert qu'à changer une valeur.
-- -----------------------------------------------------------------------------
create or replace function public.admin_set_setting(p_key text, p_value jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_before jsonb;
begin
  if not public.is_admin() then
    raise exception 'Seule la direction peut modifier les réglages.' using errcode = '42501';
  end if;

  select s.value into v_before from public.settings s where s.key = p_key;

  if v_before is null then
    raise exception 'Réglage inconnu : « % ».', p_key using errcode = '23503';
  end if;

  if p_value is null then
    raise exception 'Un réglage ne peut pas être vidé.' using errcode = '22023';
  end if;

  update public.settings
     set value = p_value, updated_by = (select auth.uid())
   where key = p_key;

  insert into public.audit_log (actor_id, action, entity, entity_id, before, after)
  values ((select auth.uid()), 'settings.updated', 'settings', null,
          jsonb_build_object('key', p_key, 'value', v_before),
          jsonb_build_object('key', p_key, 'value', p_value));
end;
$$;

comment on function public.admin_set_setting(text, jsonb) is
  'Change la valeur d''un réglage existant. Journalisé avec l''avant et l''après.';

revoke all on function public.admin_set_setting(text, jsonb) from public, anon;
grant execute on function public.admin_set_setting(text, jsonb) to authenticated, service_role;

-- =============================================================================
-- Points de vente
--
-- Cinq aujourd'hui. Le jour où il y en a sept, c'est ici que ça se passe, et
-- nulle part ailleurs : ni migration, ni développeur, ni tableau de bord Supabase.
-- =============================================================================
create or replace function public.admin_upsert_boutique(
  p_code       text,
  p_name       text,
  p_kind       text default 'physical',
  p_address    text default null,
  p_sort_order integer default null,
  p_id         uuid default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id     uuid;
  v_before jsonb;
  v_order  integer;
begin
  if not public.is_admin() then
    raise exception 'Seule la direction peut gérer les points de vente.' using errcode = '42501';
  end if;

  if p_name is null or length(btrim(p_name)) = 0 then
    raise exception 'Le nom du point de vente est obligatoire.' using errcode = '22023';
  end if;

  if p_code is null or btrim(p_code) !~ '^[A-Z0-9_]{2,20}$' then
    raise exception 'Le code doit faire 2 à 20 caractères, en majuscules, chiffres ou tirets bas.'
      using errcode = '22023';
  end if;

  if p_kind not in ('physical', 'online') then
    raise exception 'Type de point de vente inconnu.' using errcode = '22023';
  end if;

  if p_id is not null then
    select to_jsonb(b) into v_before from public.boutiques b where b.id = p_id;
    if v_before is null then
      raise exception 'Point de vente introuvable.' using errcode = '23503';
    end if;
  end if;

  -- Un nouveau point de vente se range à la fin, sans que personne ait à y penser.
  v_order := coalesce(
    p_sort_order,
    (v_before ->> 'sort_order')::integer,
    (select coalesce(max(b.sort_order), 0) + 10 from public.boutiques b)
  );

  if p_id is null then
    insert into public.boutiques (code, name, kind, address, sort_order)
    values (btrim(p_code), btrim(p_name), p_kind, p_address, v_order)
    returning id into v_id;
  else
    update public.boutiques
       set code = btrim(p_code), name = btrim(p_name), kind = p_kind,
           address = p_address, sort_order = v_order
     where id = p_id
    returning id into v_id;
  end if;

  insert into public.audit_log (actor_id, action, entity, entity_id, before, after)
  values ((select auth.uid()),
          case when p_id is null then 'boutique.created' else 'boutique.updated' end,
          'boutiques', v_id, v_before,
          (select to_jsonb(b) from public.boutiques b where b.id = v_id));

  return v_id;
end;
$$;

revoke all on function public.admin_upsert_boutique from public, anon;
grant execute on function public.admin_upsert_boutique to authenticated, service_role;

-- On n'efface pas un point de vente : des plannings, des pointages et des
-- pointeuses le référencent, parfois depuis des mois. On le désactive.
create or replace function public.admin_set_boutique_active(p_id uuid, p_active boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_before  jsonb;
  v_staff   integer;
  v_others  integer;
begin
  if not public.is_admin() then
    raise exception 'Seule la direction peut gérer les points de vente.' using errcode = '42501';
  end if;

  select to_jsonb(b) into v_before from public.boutiques b where b.id = p_id;
  if v_before is null then
    raise exception 'Point de vente introuvable.' using errcode = '23503';
  end if;

  if not p_active then
    select count(*) into v_staff
      from public.employees e where e.boutique_id = p_id and e.is_active;

    if v_staff > 0 then
      raise exception
        'Ce point de vente compte encore % collaboratrice(s) active(s). Rattachez-les ailleurs avant de le fermer.',
        v_staff using errcode = '23503';
    end if;

    select count(*) into v_others
      from public.boutiques b where b.is_active and b.id <> p_id;

    if v_others = 0 then
      raise exception 'Il doit rester au moins un point de vente actif.' using errcode = '23514';
    end if;
  end if;

  update public.boutiques set is_active = p_active where id = p_id;

  insert into public.audit_log (actor_id, action, entity, entity_id, before, after)
  values ((select auth.uid()),
          case when p_active then 'boutique.reopened' else 'boutique.closed' end,
          'boutiques', p_id, v_before,
          (select to_jsonb(b) from public.boutiques b where b.id = p_id));
end;
$$;

revoke all on function public.admin_set_boutique_active(uuid, boolean) from public, anon;
grant execute on function public.admin_set_boutique_active(uuid, boolean)
  to authenticated, service_role;

-- =============================================================================
-- Types de contrat
-- =============================================================================
create or replace function public.admin_upsert_contract_type(
  p_code              text,
  p_label             text,
  p_is_apprenticeship boolean default false,
  p_sort_order        integer default null,
  p_id                uuid default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id     uuid;
  v_before jsonb;
  v_order  integer;
begin
  if not public.is_admin() then
    raise exception 'Seule la direction peut gérer les types de contrat.' using errcode = '42501';
  end if;

  if p_label is null or length(btrim(p_label)) = 0 then
    raise exception 'Le libellé du contrat est obligatoire.' using errcode = '22023';
  end if;

  if p_code is null or btrim(p_code) !~ '^[A-Z0-9_]{2,20}$' then
    raise exception 'Le code doit faire 2 à 20 caractères, en majuscules, chiffres ou tirets bas.'
      using errcode = '22023';
  end if;

  if p_id is not null then
    select to_jsonb(c) into v_before from public.contract_types c where c.id = p_id;
    if v_before is null then
      raise exception 'Type de contrat introuvable.' using errcode = '23503';
    end if;
  end if;

  v_order := coalesce(
    p_sort_order,
    (v_before ->> 'sort_order')::integer,
    (select coalesce(max(c.sort_order), 0) + 10 from public.contract_types c)
  );

  if p_id is null then
    insert into public.contract_types (code, label, is_apprenticeship, sort_order)
    values (btrim(p_code), btrim(p_label), coalesce(p_is_apprenticeship, false), v_order)
    returning id into v_id;
  else
    update public.contract_types
       set code = btrim(p_code), label = btrim(p_label),
           is_apprenticeship = coalesce(p_is_apprenticeship, false), sort_order = v_order
     where id = p_id
    returning id into v_id;
  end if;

  insert into public.audit_log (actor_id, action, entity, entity_id, before, after)
  values ((select auth.uid()),
          case when p_id is null then 'contract_type.created' else 'contract_type.updated' end,
          'contract_types', v_id, v_before,
          (select to_jsonb(c) from public.contract_types c where c.id = v_id));

  return v_id;
end;
$$;

revoke all on function public.admin_upsert_contract_type from public, anon;
grant execute on function public.admin_upsert_contract_type to authenticated, service_role;

-- =============================================================================
-- Jours fériés
--
-- La migration de référence en pose deux années. La troisième, c'est le gérant
-- qui l'ajoutera — Pâques et l'Ascension bougent chaque année, et personne ne
-- veut attendre un développeur pour que le décompte des congés tombe juste.
-- =============================================================================
create or replace function public.admin_set_public_holiday(p_date date, p_label text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_before jsonb;
begin
  if not public.is_admin() then
    raise exception 'Seule la direction peut gérer les jours fériés.' using errcode = '42501';
  end if;

  if p_label is null or length(btrim(p_label)) = 0 then
    raise exception 'Le nom du jour férié est obligatoire.' using errcode = '22023';
  end if;

  select to_jsonb(h) into v_before from public.public_holidays h where h.date = p_date;

  insert into public.public_holidays (date, label)
  values (p_date, btrim(p_label))
  on conflict (date) do update set label = excluded.label;

  insert into public.audit_log (actor_id, action, entity, entity_id, before, after)
  values ((select auth.uid()), 'holiday.set', 'public_holidays', null, v_before,
          jsonb_build_object('date', p_date, 'label', btrim(p_label)));
end;
$$;

revoke all on function public.admin_set_public_holiday(date, text) from public, anon;
grant execute on function public.admin_set_public_holiday(date, text) to authenticated, service_role;

-- Retirer un férié change le décompte des congés à venir. Les congés déjà
-- validés, eux, gardent le nombre de jours arrêté le jour de la décision : leur
-- ligne de ledger est écrite, et rien ici ne la touche.
create or replace function public.admin_remove_public_holiday(p_date date)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_before jsonb;
begin
  if not public.is_admin() then
    raise exception 'Seule la direction peut gérer les jours fériés.' using errcode = '42501';
  end if;

  delete from public.public_holidays h where h.date = p_date
  returning to_jsonb(h) into v_before;

  if v_before is null then
    return false;
  end if;

  insert into public.audit_log (actor_id, action, entity, entity_id, before)
  values ((select auth.uid()), 'holiday.removed', 'public_holidays', null, v_before);

  return true;
end;
$$;

revoke all on function public.admin_remove_public_holiday(date) from public, anon;
grant execute on function public.admin_remove_public_holiday(date) to authenticated, service_role;

-- =============================================================================
-- Fermer la porte de derrière
--
-- Les politiques RLS autorisaient déjà la direction à écrire dans ces quatre
-- tables. On retire le droit : la politique reste (elle ne coûte rien et
-- documente l'intention), mais sans `grant`, PostgreSQL refuse la requête avant
-- même de la regarder. Les fonctions ci-dessus deviennent le seul chemin, et
-- chaque changement laisse donc une trace.
-- =============================================================================
revoke insert, update, delete on public.boutiques, public.contract_types,
                                 public.settings, public.public_holidays
  from authenticated;

select public.revoke_anon_table_privileges();
