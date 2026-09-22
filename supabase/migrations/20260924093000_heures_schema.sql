-- =============================================================================
-- 20260924093000_heures_schema — suivi des heures et récupération
--
-- Même principe que les congés : le solde d'heures est la somme de mouvements,
-- jamais un nombre qu'on rectifie. Trois sortes de mouvements seulement :
--   `daily_delta`  ce qu'une journée a produit (réel − planifié) ;
--   `recovery`     des heures reprises, en arrivant plus tard ou en partant plus tôt ;
--   `adjustment`   une correction de la direction, motivée et tracée.
--
-- ⚠️ Ce module suit un **solde de récupération interne**. Il ne calcule aucune
-- majoration légale et ne produit aucune paie. L'écran de la direction le dit.
-- =============================================================================

create table public.hours_ledger (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid not null references public.employees (id) on delete cascade,

  kind         text not null check (kind in ('daily_delta', 'recovery', 'adjustment')),

  -- Positif : des heures gagnées. Négatif : des heures reprises ou dues.
  minutes      integer not null,

  local_date   date not null,
  source_ref   uuid,
  note         text,
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Une seule ligne par collaboratrice et par journée. Le recalcul met à jour
-- celle-là au lieu d'en ajouter une, sinon une correction de pointage
-- compterait deux fois la même journée.
create unique index hours_ledger_daily_once
  on public.hours_ledger (employee_id, local_date) where kind = 'daily_delta';

create index hours_ledger_employee_idx on public.hours_ledger (employee_id, local_date desc);

create trigger hours_ledger_set_updated_at
  before update on public.hours_ledger
  for each row execute function public.set_updated_at();

comment on table public.hours_ledger is
  'Mouvements d''heures. Le solde est leur somme. Aucun lien avec la paie.';

-- -----------------------------------------------------------------------------
-- recovery_requests — « ⚡ Prendre mes heures supp »
-- -----------------------------------------------------------------------------
create table public.recovery_requests (
  id            uuid primary key default gen_random_uuid(),
  employee_id   uuid not null references public.employees (id) on delete cascade,

  date          date not null,
  mode          text not null check (mode in ('later', 'earlier')),

  -- Par paliers de quinze minutes : une récupération de sept minutes n'a pas de
  -- sens à l'échelle d'un magasin.
  minutes       integer not null check (minutes > 0 and minutes % 15 = 0),

  status        text not null default 'pending' check (
    status in ('pending', 'approved', 'refused', 'cancelled')
  ),

  admin_comment text,
  decided_by    uuid references auth.users (id) on delete set null,
  decided_at    timestamptz,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Une seule demande vivante par journée. Les demandes refusées ou annulées ne
-- sont pas concernées : se voir refuser deux fois la même journée est
-- désagréable, mais ce n'est pas une erreur de saisie à empêcher.
create unique index recovery_requests_one_live_per_day
  on public.recovery_requests (employee_id, date)
  where status in ('pending', 'approved');

create index recovery_requests_pending_idx
  on public.recovery_requests (status, date) where status = 'pending';

create trigger recovery_requests_set_updated_at
  before update on public.recovery_requests
  for each row execute function public.set_updated_at();

comment on table public.recovery_requests is
  'Demandes de récupération d''heures : arriver plus tard ou partir plus tôt.';

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.hours_ledger enable row level security;
alter table public.recovery_requests enable row level security;

create policy "heures: chacune voit ses mouvements"
  on public.hours_ledger for select to authenticated
  using (employee_id = (select public.current_employee_id()));

create policy "heures: la direction voit tous les mouvements"
  on public.hours_ledger for select to authenticated
  using ((select public.is_admin()));

create policy "récupération: chacune voit ses demandes"
  on public.recovery_requests for select to authenticated
  using (employee_id = (select public.current_employee_id()));

create policy "récupération: la direction voit toutes les demandes"
  on public.recovery_requests for select to authenticated
  using ((select public.is_admin()));

revoke all on public.hours_ledger, public.recovery_requests from anon, authenticated;
grant select on public.hours_ledger, public.recovery_requests to authenticated;
grant all on public.hours_ledger, public.recovery_requests to service_role;

-- =============================================================================
-- Le calcul quotidien
--
-- Réel moins planifié, pour les journées **closes**. Une journée dont le départ
-- n'a jamais été pointé n'écrit rien : ce n'est pas une journée à zéro heure,
-- c'est une journée dont on ne sait rien. Écrire « −7 h » à la place ferait
-- porter à la collaboratrice le prix d'un téléphone déchargé, et la direction a
-- déjà une alerte pour ça.
-- =============================================================================
create or replace function public.compute_daily_hours(p_date date default null)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_date  date := coalesce(p_date, public.reunion_today());
  v_count integer := 0;
  v_row   record;
begin
  for v_row in
    select d.employee_id,
           d.worked_minutes,
           coalesce(
             case
               when p.status in ('work', 'replacement')
                    and p.start_time is not null and p.end_time is not null
               then (extract(epoch from (p.end_time - p.start_time))
                     - coalesce(extract(epoch from (p.break_end - p.break_start)), 0)) / 60
             end,
             0
           )::integer as planned_minutes
      from public.daily_worked_time d
      left join public.planning_entries p
        on p.employee_id = d.employee_id and p.date = d.local_date
     where d.local_date = v_date
       and d.worked_minutes is not null
  loop
    insert into public.hours_ledger (employee_id, kind, minutes, local_date, note)
    values (
      v_row.employee_id, 'daily_delta',
      v_row.worked_minutes - v_row.planned_minutes,
      v_date,
      format('Réel %s min, prévu %s min', v_row.worked_minutes, v_row.planned_minutes)
    )
    on conflict (employee_id, local_date) where kind = 'daily_delta'
    do update set minutes = excluded.minutes, note = excluded.note;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

comment on function public.compute_daily_hours(date) is
  'Écrit l''écart réel − planifié d''une journée close. Idempotente : un recalcul met à jour la ligne.';

revoke all on function public.compute_daily_hours(date) from public, anon, authenticated;
grant execute on function public.compute_daily_hours(date) to service_role;

-- -----------------------------------------------------------------------------
-- Le solde
-- -----------------------------------------------------------------------------
create or replace function public.hours_balance(p_employee_id uuid default null)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_employee uuid := coalesce(p_employee_id, public.current_employee_id());
begin
  if v_employee is null then
    return 0;
  end if;

  -- Même règle que pour les congés : sans session, l'appelant est le serveur.
  if (select auth.uid()) is not null
     and v_employee is distinct from public.current_employee_id()
     and not public.is_admin() then
    raise exception 'Solde non consultable.' using errcode = '42501';
  end if;

  return coalesce(
    (select sum(h.minutes)::integer from public.hours_ledger h where h.employee_id = v_employee),
    0
  );
end;
$$;

comment on function public.hours_balance(uuid) is
  'Solde d''heures en minutes : la somme des mouvements.';

revoke all on function public.hours_balance(uuid) from public, anon;
grant execute on function public.hours_balance(uuid) to authenticated, service_role;

-- =============================================================================
-- Demander une récupération
-- =============================================================================
create or replace function public.request_recovery(
  p_date    date,
  p_mode    text,
  p_minutes integer
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_employee uuid := public.current_employee_id();
  v_balance  integer;
  v_pending  integer;
  v_entry    public.planning_entries;
  v_id       uuid;
begin
  if v_employee is null then
    raise exception 'Session expirée. Reconnecte-toi.' using errcode = '42501';
  end if;

  if p_mode not in ('later', 'earlier') then
    raise exception 'Choisis d''arriver plus tard ou de partir plus tôt.' using errcode = '22023';
  end if;

  if p_minutes is null or p_minutes <= 0 or p_minutes % 15 <> 0 then
    raise exception 'La durée se choisit par tranches de quinze minutes.' using errcode = '22023';
  end if;

  if p_date <= public.reunion_today() then
    raise exception 'Choisis un jour à venir.' using errcode = '22023';
  end if;

  select * into v_entry
    from public.planning_entries
   where employee_id = v_employee and date = p_date;

  if v_entry.id is null or v_entry.status not in ('work', 'replacement') then
    raise exception 'Tu ne travailles pas ce jour-là.' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.recovery_requests r
     where r.employee_id = v_employee and r.date = p_date
       and r.status in ('pending', 'approved')
  ) then
    raise exception 'Tu as déjà une demande sur cette journée.' using errcode = '23505';
  end if;

  -- Le solde disponible tient compte de ce qui est déjà demandé et pas encore
  -- tranché : sans cela, trois demandes de deux heures passeraient toutes les
  -- trois avec un solde de deux heures.
  v_balance := public.hours_balance(v_employee);

  select coalesce(sum(r.minutes), 0)::integer into v_pending
    from public.recovery_requests r
   where r.employee_id = v_employee and r.status = 'pending';

  if p_minutes > v_balance - v_pending then
    raise exception 'Ton solde disponible ne couvre pas cette durée.' using errcode = '22023';
  end if;

  insert into public.recovery_requests (employee_id, date, mode, minutes)
  values (v_employee, p_date, p_mode, p_minutes)
  returning id into v_id;

  perform public.emit_event(
    'heures.recovery_requested',
    jsonb_build_object('id', v_id, 'employee_id', v_employee, 'date', p_date,
                       'mode', p_mode, 'minutes', p_minutes)
  );

  return v_id;
end;
$$;

comment on function public.request_recovery(date, text, integer) is
  'Demande de récupération. Plafonnée au solde, déduction faite des demandes déjà en attente.';

revoke all on function public.request_recovery(date, text, integer) from public, anon;
grant execute on function public.request_recovery(date, text, integer) to authenticated, service_role;

-- =============================================================================
-- Décider — en un clic
-- =============================================================================
create or replace function public.admin_decide_recovery(
  p_request_id uuid,
  p_approve    boolean,
  p_comment    text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_request public.recovery_requests;
begin
  if not public.is_admin() then
    raise exception 'Seule la direction décide d''une récupération.' using errcode = '42501';
  end if;

  select * into v_request from public.recovery_requests where id = p_request_id for update;

  if v_request.id is null then
    raise exception 'Demande introuvable.' using errcode = '23503';
  end if;

  if v_request.status <> 'pending' then
    raise exception 'Cette demande a déjà été traitée.' using errcode = '22023';
  end if;

  update public.recovery_requests
     set status = case when p_approve then 'approved' else 'refused' end,
         admin_comment = p_comment,
         decided_by = (select auth.uid()), decided_at = now()
   where id = p_request_id;

  insert into public.audit_log (actor_id, action, entity, entity_id, before, after)
  values ((select auth.uid()),
          case when p_approve then 'heures.recovery_approved' else 'heures.recovery_refused' end,
          'recovery_requests', p_request_id, to_jsonb(v_request),
          jsonb_build_object('approved', p_approve, 'comment', p_comment));

  if p_approve then
    -- Le débit est écrit ici ; le déplacement de la journée est l'affaire du
    -- module planning, qui écoute l'événement.
    insert into public.hours_ledger (
      employee_id, kind, minutes, local_date, source_ref, note, created_by
    ) values (
      v_request.employee_id, 'recovery', -v_request.minutes, v_request.date, p_request_id,
      case when v_request.mode = 'later' then 'Arrivée décalée' else 'Départ avancé' end,
      (select auth.uid())
    );
  end if;

  perform public.emit_event(
    case when p_approve then 'heures.recovery_approved' else 'heures.recovery_refused' end,
    jsonb_build_object('id', p_request_id, 'employee_id', v_request.employee_id,
                       'date', v_request.date, 'mode', v_request.mode,
                       'minutes', v_request.minutes, 'comment', p_comment)
  );
end;
$$;

revoke all on function public.admin_decide_recovery(uuid, boolean, text) from public, anon;
grant execute on function public.admin_decide_recovery(uuid, boolean, text)
  to authenticated, service_role;

-- =============================================================================
-- Ajustement manuel du solde
-- =============================================================================
create or replace function public.admin_adjust_hours(
  p_employee_id uuid,
  p_minutes     integer,
  p_note        text
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
    raise exception 'Seule la direction ajuste un solde.' using errcode = '42501';
  end if;

  if p_minutes = 0 then
    raise exception 'Un ajustement de zéro minute n''a pas de sens.' using errcode = '22023';
  end if;

  if p_note is null or length(btrim(p_note)) < 5 then
    raise exception 'Un ajustement de solde doit être motivé.' using errcode = '22023';
  end if;

  insert into public.hours_ledger (employee_id, kind, minutes, local_date, note, created_by)
  values (p_employee_id, 'adjustment', p_minutes, public.reunion_today(),
          btrim(p_note), (select auth.uid()))
  returning id into v_id;

  insert into public.audit_log (actor_id, action, entity, entity_id, after)
  values ((select auth.uid()), 'heures.adjusted', 'hours_ledger', v_id,
          jsonb_build_object('employee_id', p_employee_id, 'minutes', p_minutes,
                             'note', btrim(p_note)));

  return v_id;
end;
$$;

revoke all on function public.admin_adjust_hours(uuid, integer, text) from public, anon;
grant execute on function public.admin_adjust_hours(uuid, integer, text)
  to authenticated, service_role;

select public.revoke_anon_table_privileges();
