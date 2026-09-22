-- =============================================================================
-- 20260923093000_pointage_storage_and_alerts — selfies, alertes, purge
--
-- Le selfie sert à une chose : montrer que la personne qui a pointé est bien
-- celle qui était là. Ce n'est pas de la biométrie, rien n'est comparé, rien
-- n'est mesuré. Le fichier est privé, il n'est jamais servi par une URL
-- publique, et il est détruit au bout de `settings.selfie_retention_days`.
-- =============================================================================

-- Le bucket et ses politiques sont créés ici plutôt qu'à la main dans le tableau
-- de bord : le propriétaire ne doit avoir aucune étape à ne pas oublier.
--
-- Le bloc est défensif à dessein. Sur un projet hébergé, `storage.objects`
-- n'appartient pas toujours au rôle qui applique les migrations. Un refus de
-- privilège ferait échouer `db push` en entier, c'est-à-dire le seul chemin de
-- mise à jour de la base dont dispose le propriétaire. Mieux vaut un avertissement
-- dans le journal du workflow et trois clics dans le tableau de bord qu'une
-- migration qui bloque tout.
do $$
begin
  insert into storage.buckets (id, name, public)
  values ('selfies', 'selfies', false)
  on conflict (id) do nothing;

  -- Chaque collaboratrice dépose dans `<son id>/…` et ne voit que ce dossier.
  -- Aucune politique d'update ni de delete : un selfie déposé n'est ni remplacé
  -- ni effacé depuis un navigateur. Seule la purge planifiée le supprime.
  drop policy if exists "selfies: dépôt dans son propre dossier" on storage.objects;
  create policy "selfies: dépôt dans son propre dossier"
    on storage.objects for insert to authenticated
    with check (
      bucket_id = 'selfies'
      and (storage.foldername(name))[1] = (select public.current_employee_id())::text
    );

  drop policy if exists "selfies: chacune relit les siens" on storage.objects;
  create policy "selfies: chacune relit les siens"
    on storage.objects for select to authenticated
    using (
      bucket_id = 'selfies'
      and (
        (storage.foldername(name))[1] = (select public.current_employee_id())::text
        or (select public.is_admin())
      )
    );
exception
  when insufficient_privilege then
    raise warning 'Bucket « selfies » à créer à la main dans le tableau de bord Supabase (privilèges insuffisants sur storage).';
end;
$$;

-- -----------------------------------------------------------------------------
-- Réglages ajoutés par cette phase. Insertion idempotente : un rejeu manuel
-- depuis l'éditeur SQL ne doit jamais écraser un réglage déjà ajusté.
-- -----------------------------------------------------------------------------
insert into public.settings (key, value) values
  ('selfie_required', 'true'::jsonb),
  ('missing_clock_out_delay_minutes', '60'::jsonb),
  ('clock_check_window', jsonb_build_object('start', '07:00', 'end', '20:00'))
on conflict (key) do nothing;

-- =============================================================================
-- Alertes
--
-- Une alerte est envoyée une fois. Cette table est ce qui le garantit : la
-- tâche tourne toutes les dix minutes, et la contrainte d'unicité fait le tri.
-- =============================================================================
create table public.pointage_alerts (
  employee_id uuid not null references public.employees (id) on delete cascade,
  local_date  date not null,
  kind        text not null check (kind in ('late', 'missing_clock_out')),
  created_at  timestamptz not null default now(),
  primary key (employee_id, local_date, kind)
);

alter table public.pointage_alerts enable row level security;

create policy "alertes de pointage: la direction seule"
  on public.pointage_alerts for select to authenticated
  using ((select public.is_admin()));

revoke all on public.pointage_alerts from anon, authenticated;
grant select on public.pointage_alerts to authenticated;
grant all on public.pointage_alerts to service_role;

comment on table public.pointage_alerts is
  'Trace des alertes déjà envoyées, pour qu''une tâche qui tourne toutes les dix minutes n''alerte qu''une fois.';

-- -----------------------------------------------------------------------------
-- La tâche planifiée.
--
-- Deux garde-fous que la cadence toutes les dix minutes rend indispensables :
-- la fenêtre horaire (personne ne reçoit d'alerte à trois heures du matin) et
-- le filtre sur le statut du planning. Un jour d'école, de repos, de congé ou
-- de maladie n'est pas un retard : il n'y avait rien à pointer.
-- -----------------------------------------------------------------------------
-- `p_at` n'est pas une heure venue d'un client : la fonction n'est appelable que
-- par le serveur, et la tâche planifiée ne passe jamais d'argument. Il existe
-- pour qu'un test puisse se placer à une heure donnée plutôt que d'espérer que
-- la suite tourne au bon moment de la journée.
create or replace function public.pointage_run_checks(p_at timestamptz default now())
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_today     date := (p_at at time zone 'Indian/Reunion')::date;
  v_now       time := (p_at at time zone 'Indian/Reunion')::time;
  v_window    jsonb;
  v_tolerance integer;
  v_delay     integer;
  v_late      integer := 0;
  v_missing   integer := 0;
  v_row       record;
begin
  select value into v_window from public.settings where key = 'clock_check_window';
  select value::text::integer into v_tolerance
    from public.settings where key = 'late_tolerance_minutes';
  select value::text::integer into v_delay
    from public.settings where key = 'missing_clock_out_delay_minutes';

  v_tolerance := coalesce(v_tolerance, 10);
  v_delay     := coalesce(v_delay, 60);

  if v_window is not null
     and (v_now < (v_window ->> 'start')::time or v_now > (v_window ->> 'end')::time) then
    return jsonb_build_object('late', 0, 'missing_clock_out', 0, 'skipped', 'hors fenêtre');
  end if;

  -- --- Retards -------------------------------------------------------------
  for v_row in
    select p.employee_id, p.start_time
      from public.planning_entries p
      join public.employees e on e.id = p.employee_id and e.is_active
     where p.date = v_today
       and p.status in ('work', 'replacement')
       and p.start_time is not null
       and v_now > p.start_time + make_interval(mins => v_tolerance)
       and not exists (
         select 1 from public.time_clocks tc
          where tc.employee_id = p.employee_id and tc.local_date = v_today
            and tc.event_type = 'clock_in'
       )
  loop
    insert into public.pointage_alerts (employee_id, local_date, kind)
    values (v_row.employee_id, v_today, 'late')
    on conflict do nothing;

    if found then
      v_late := v_late + 1;
      perform public.emit_event(
        'pointage.late',
        jsonb_build_object(
          'employee_id', v_row.employee_id,
          'local_date', v_today,
          'planned_start', v_row.start_time,
          'minutes_late', (extract(epoch from (v_now - v_row.start_time)) / 60)::integer
        )
      );
    end if;
  end loop;

  -- --- Départs jamais pointés ----------------------------------------------
  for v_row in
    select p.employee_id, p.end_time
      from public.planning_entries p
      join public.employees e on e.id = p.employee_id and e.is_active
     where p.date = v_today
       and p.status in ('work', 'replacement')
       and p.end_time is not null
       and v_now > p.end_time + make_interval(mins => v_delay)
       and exists (
         select 1 from public.time_clocks tc
          where tc.employee_id = p.employee_id and tc.local_date = v_today
            and tc.event_type = 'clock_in'
       )
       and not exists (
         select 1 from public.time_clocks tc
          where tc.employee_id = p.employee_id and tc.local_date = v_today
            and tc.event_type = 'clock_out'
       )
  loop
    insert into public.pointage_alerts (employee_id, local_date, kind)
    values (v_row.employee_id, v_today, 'missing_clock_out')
    on conflict do nothing;

    if found then
      v_missing := v_missing + 1;
      perform public.emit_event(
        'pointage.missing_clock_out',
        jsonb_build_object(
          'employee_id', v_row.employee_id,
          'local_date', v_today,
          'planned_end', v_row.end_time
        )
      );
    end if;
  end loop;

  return jsonb_build_object('late', v_late, 'missing_clock_out', v_missing);
end;
$$;

comment on function public.pointage_run_checks(timestamptz) is
  'Retards et départs non pointés. Appelée toutes les dix minutes ; n''alerte jamais deux fois pour la même journée.';

revoke all on function public.pointage_run_checks(timestamptz) from public, anon, authenticated;
grant execute on function public.pointage_run_checks(timestamptz) to service_role;

-- =============================================================================
-- Purge des selfies
--
-- Postgres ne sait pas supprimer un fichier du stockage : effacer la ligne de
-- `storage.objects` laisserait l'octet en place. La purge se fait donc en deux
-- temps — la base dit quoi supprimer, la tâche appelle l'API Storage, puis la
-- base oublie le chemin. Si la tâche s'interrompt entre les deux, le prochain
-- passage reprend le même travail : rien n'est perdu, rien n'est fait deux fois.
-- =============================================================================
create or replace function public.selfies_to_purge(p_limit integer default 200)
returns table (photo_path text)
language sql
stable
security definer
set search_path = ''
as $$
  select tc.photo_path
    from public.time_clocks tc
   where tc.photo_path is not null
     and tc.local_date < public.reunion_today() - coalesce(
           (select s.value::text::integer from public.settings s
             where s.key = 'selfie_retention_days'), 60)
   order by tc.local_date
   limit greatest(p_limit, 1);
$$;

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

  delete from storage.objects
   where bucket_id = 'selfies' and name = any (coalesce(p_paths, '{}'::text[]));

  return v_count;
end;
$$;

comment on function public.selfies_to_purge(integer) is
  'Chemins des selfies au-delà de la durée de rétention. La suppression du fichier appartient à la tâche planifiée.';
comment on function public.mark_selfies_purged(text[]) is
  'Oublie les chemins purgés. Le pointage lui-même n''est jamais supprimé.';

revoke all on function public.selfies_to_purge(integer) from public, anon, authenticated;
revoke all on function public.mark_selfies_purged(text[]) from public, anon, authenticated;
grant execute on function public.selfies_to_purge(integer) to service_role;
grant execute on function public.mark_selfies_purged(text[]) to service_role;
