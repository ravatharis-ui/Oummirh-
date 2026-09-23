-- =============================================================================
-- 20260926090000_swaps_schema — bourse d'échange de créneaux
--
-- Deux collaboratrices s'arrangent entre elles ; la direction tranche en
-- dernier. C'est le seul flux de l'application à **double validation**, et
-- l'ordre compte : la collègue d'abord, parce que demander à la direction
-- d'arbitrer un échange que l'intéressée refusera est une perte de temps pour
-- tout le monde.
--
-- Une demande ne devient un fait qu'à la validation de la direction. Avant, elle
-- s'annule ; après, elle ne s'annule plus — le planning des deux a bougé, et
-- deux personnes ont organisé leur semaine autour.
-- =============================================================================

create table public.shift_swaps (
  id                 uuid primary key default gen_random_uuid(),

  requester_id       uuid not null references public.employees (id) on delete cascade,
  requester_date     date not null,

  partner_id         uuid not null references public.employees (id) on delete cascade,
  partner_date       date not null,

  message            text,

  status             text not null default 'pending_partner' check (
    status in ('pending_partner', 'pending_admin', 'approved',
               'refused_partner', 'refused_admin', 'cancelled')
  ),

  partner_decided_at timestamptz,
  admin_decided_at   timestamptz,
  decided_by         uuid references auth.users (id) on delete set null,
  admin_comment      text,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint shift_swaps_two_people check (requester_id <> partner_id)
);

-- Une journée ne se négocie pas deux fois en même temps, de chaque côté.
create unique index shift_swaps_requester_live
  on public.shift_swaps (requester_id, requester_date)
  where status in ('pending_partner', 'pending_admin');

create unique index shift_swaps_partner_live
  on public.shift_swaps (partner_id, partner_date)
  where status in ('pending_partner', 'pending_admin');

create index shift_swaps_partner_inbox on public.shift_swaps (partner_id, status);
create index shift_swaps_admin_inbox on public.shift_swaps (status) where status = 'pending_admin';

create trigger shift_swaps_set_updated_at
  before update on public.shift_swaps
  for each row execute function public.set_updated_at();

comment on table public.shift_swaps is
  'Échanges de journées entre collaboratrices, validés par la collègue puis par la direction.';

-- =============================================================================
-- Row Level Security
--
-- Les deux parties voient l'échange : la demandeuse parce qu'il est à elle, la
-- collègue parce qu'on lui demande quelque chose. Personne d'autre.
-- =============================================================================
alter table public.shift_swaps enable row level security;

create policy "échanges: les deux parties voient le leur"
  on public.shift_swaps for select to authenticated
  using (
    requester_id = (select public.current_employee_id())
    or partner_id = (select public.current_employee_id())
  );

create policy "échanges: la direction voit tout"
  on public.shift_swaps for select to authenticated
  using ((select public.is_admin()));

revoke all on public.shift_swaps from anon, authenticated;
grant select on public.shift_swaps to authenticated;
grant all on public.shift_swaps to service_role;

-- =============================================================================
-- Proposer un échange
-- =============================================================================
create or replace function public.request_swap(
  p_partner_id     uuid,
  p_requester_date date,
  p_partner_date   date,
  p_message        text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_requester uuid := public.current_employee_id();
  v_today     date := public.reunion_today();
  v_status    text;
  v_id        uuid;
begin
  if v_requester is null then
    raise exception 'Session expirée. Reconnecte-toi.' using errcode = '42501';
  end if;

  if p_partner_id = v_requester then
    raise exception 'On n''échange pas une journée avec soi-même.' using errcode = '22023';
  end if;

  if not exists (select 1 from public.employees e where e.id = p_partner_id and e.is_active) then
    raise exception 'Cette collègue n''est plus dans l''équipe.' using errcode = '23503';
  end if;

  -- Les deux journées sont à venir : on n'échange pas ce qui a déjà été vécu.
  if p_requester_date <= v_today or p_partner_date <= v_today then
    raise exception 'Les deux journées doivent être à venir.' using errcode = '22023';
  end if;

  -- Ni l'une ni l'autre ne peut être un congé, une maladie ou un jour d'école :
  -- ces journées-là ont été décidées ailleurs.
  select p.status into v_status
    from public.planning_entries p
   where p.employee_id = v_requester and p.date = p_requester_date;

  if v_status in ('leave', 'sick', 'school') then
    raise exception 'Ta journée du % ne peut pas être échangée.', p_requester_date
      using errcode = '22023';
  end if;

  select p.status into v_status
    from public.planning_entries p
   where p.employee_id = p_partner_id and p.date = p_partner_date;

  if v_status in ('leave', 'sick', 'school') then
    raise exception 'La journée que tu demandes ne peut pas être échangée.'
      using errcode = '22023';
  end if;

  -- Double affectation : après l'échange, ta collègue travaille TA journée. Si
  -- elle est déjà en poste ce jour-là, l'échange lui ferait perdre son créneau.
  -- Le cas des deux mêmes dates est l'échange le plus banal — deux personnes qui
  -- permutent leurs horaires d'une même journée — et ne pose pas ce problème.
  if p_requester_date <> p_partner_date then
    if exists (
      select 1 from public.planning_entries p
       where p.employee_id = p_partner_id and p.date = p_requester_date
         and p.status in ('work', 'replacement')
    ) then
      raise exception 'Ta collègue travaille déjà le %.', p_requester_date using errcode = '22023';
    end if;

    if exists (
      select 1 from public.planning_entries p
       where p.employee_id = v_requester and p.date = p_partner_date
         and p.status in ('work', 'replacement')
    ) then
      raise exception 'Tu travailles déjà le %.', p_partner_date using errcode = '22023';
    end if;
  end if;

  insert into public.shift_swaps (
    requester_id, requester_date, partner_id, partner_date, message
  ) values (
    v_requester, p_requester_date, p_partner_id, p_partner_date, p_message
  )
  returning id into v_id;

  perform public.emit_event(
    'swaps.requested',
    jsonb_build_object('id', v_id, 'requester_id', v_requester, 'partner_id', p_partner_id,
                       'requester_date', p_requester_date, 'partner_date', p_partner_date)
  );

  return v_id;
end;
$$;

comment on function public.request_swap(uuid, date, date, text) is
  'Propose un échange de journées. Contrôle les dates, les statuts et la double affectation.';

revoke all on function public.request_swap(uuid, date, date, text) from public, anon;
grant execute on function public.request_swap(uuid, date, date, text) to authenticated, service_role;

-- =============================================================================
-- La collègue répond
-- =============================================================================
create or replace function public.partner_decide_swap(p_swap_id uuid, p_accept boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_swap public.shift_swaps;
  v_me   uuid := public.current_employee_id();
begin
  select * into v_swap from public.shift_swaps where id = p_swap_id for update;

  if v_swap.id is null then
    raise exception 'Échange introuvable.' using errcode = '23503';
  end if;

  if v_swap.partner_id is distinct from v_me then
    raise exception 'Cet échange ne te concerne pas.' using errcode = '42501';
  end if;

  if v_swap.status <> 'pending_partner' then
    raise exception 'Tu as déjà répondu à cette demande.' using errcode = '22023';
  end if;

  update public.shift_swaps
     set status = case when p_accept then 'pending_admin' else 'refused_partner' end,
         partner_decided_at = now()
   where id = p_swap_id;

  perform public.emit_event(
    case when p_accept then 'swaps.accepted_by_partner' else 'swaps.refused_by_partner' end,
    jsonb_build_object('id', p_swap_id, 'requester_id', v_swap.requester_id,
                       'partner_id', v_swap.partner_id,
                       'requester_date', v_swap.requester_date,
                       'partner_date', v_swap.partner_date)
  );
end;
$$;

revoke all on function public.partner_decide_swap(uuid, boolean) from public, anon;
grant execute on function public.partner_decide_swap(uuid, boolean) to authenticated, service_role;

-- =============================================================================
-- La direction tranche
-- =============================================================================
create or replace function public.admin_decide_swap(
  p_swap_id uuid,
  p_approve boolean,
  p_comment text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_swap public.shift_swaps;
begin
  if not public.is_admin() then
    raise exception 'Seule la direction valide un échange.' using errcode = '42501';
  end if;

  select * into v_swap from public.shift_swaps where id = p_swap_id for update;

  if v_swap.id is null then
    raise exception 'Échange introuvable.' using errcode = '23503';
  end if;

  if v_swap.status <> 'pending_admin' then
    raise exception 'Cet échange n''attend pas votre décision.' using errcode = '22023';
  end if;

  update public.shift_swaps
     set status = case when p_approve then 'approved' else 'refused_admin' end,
         admin_decided_at = now(), decided_by = (select auth.uid()), admin_comment = p_comment
   where id = p_swap_id;

  insert into public.audit_log (actor_id, action, entity, entity_id, before, after)
  values ((select auth.uid()),
          case when p_approve then 'swap.approved' else 'swap.refused' end,
          'shift_swaps', p_swap_id, to_jsonb(v_swap),
          jsonb_build_object('approved', p_approve, 'comment', p_comment));

  perform public.emit_event(
    case when p_approve then 'swaps.approved' else 'swaps.refused_by_admin' end,
    jsonb_build_object('id', p_swap_id, 'requester_id', v_swap.requester_id,
                       'partner_id', v_swap.partner_id,
                       'requester_date', v_swap.requester_date,
                       'partner_date', v_swap.partner_date,
                       'comment', p_comment)
  );
end;
$$;

revoke all on function public.admin_decide_swap(uuid, boolean, text) from public, anon;
grant execute on function public.admin_decide_swap(uuid, boolean, text)
  to authenticated, service_role;

-- =============================================================================
-- Annuler — tant que la direction n'a pas tranché
-- =============================================================================
create or replace function public.cancel_swap(p_swap_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_swap public.shift_swaps;
  v_me   uuid := public.current_employee_id();
begin
  select * into v_swap from public.shift_swaps where id = p_swap_id for update;

  if v_swap.id is null then
    raise exception 'Échange introuvable.' using errcode = '23503';
  end if;

  if v_swap.requester_id is distinct from v_me and not public.is_admin() then
    raise exception 'Cette demande n''est pas la tienne.' using errcode = '42501';
  end if;

  if v_swap.status = 'approved' then
    raise exception 'Cet échange est validé : les deux plannings ont déjà changé.'
      using errcode = '22023';
  end if;

  if v_swap.status not in ('pending_partner', 'pending_admin') then
    return;
  end if;

  update public.shift_swaps set status = 'cancelled' where id = p_swap_id;

  perform public.emit_event(
    'swaps.cancelled',
    jsonb_build_object('id', p_swap_id, 'requester_id', v_swap.requester_id,
                       'partner_id', v_swap.partner_id)
  );
end;
$$;

revoke all on function public.cancel_swap(uuid) from public, anon;
grant execute on function public.cancel_swap(uuid) to authenticated, service_role;

-- =============================================================================
-- Le planning échange les deux journées
--
-- Les deux lignes changent de propriétaire : ce que la demandeuse faisait ce
-- jour-là, sa collègue le fera, et réciproquement. Les journées libérées
-- deviennent du repos — sauf quand les deux dates sont la même, où il n'y a
-- rien à libérer puisque les deux échangent au même endroit du calendrier.
--
-- Idempotente : rejouer l'événement ne réinverse pas l'échange, parce que les
-- lignes portent alors déjà la marque `swap` de cette demande.
-- =============================================================================
create or replace function public.apply_planning_swap(
  p_swap_id        uuid,
  p_requester_id   uuid,
  p_requester_date date,
  p_partner_id     uuid,
  p_partner_date   date
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_a public.planning_entries;
  v_b public.planning_entries;
begin
  if exists (
    select 1 from public.planning_entries p
     where p.source = 'swap' and p.source_ref = p_swap_id
  ) then
    return false;
  end if;

  select * into v_a from public.planning_entries
   where employee_id = p_requester_id and date = p_requester_date;

  select * into v_b from public.planning_entries
   where employee_id = p_partner_id and date = p_partner_date;

  -- Ce que la demandeuse cède va à sa collègue…
  perform public.place_swapped_day(p_swap_id, p_partner_id, p_requester_date, v_a);
  -- …et ce que la collègue cède revient à la demandeuse.
  perform public.place_swapped_day(p_swap_id, p_requester_id, p_partner_date, v_b);

  if p_requester_date <> p_partner_date then
    perform public.free_swapped_day(p_swap_id, p_requester_id, p_requester_date);
    perform public.free_swapped_day(p_swap_id, p_partner_id, p_partner_date);
  end if;

  perform public.planning_announce(p_requester_id, array[p_requester_date, p_partner_date]);
  perform public.planning_announce(p_partner_id, array[p_requester_date, p_partner_date]);

  return true;
end;
$$;

-- Pose chez `p_employee_id`, au jour dit, la journée que `p_source_entry`
-- décrivait. Une journée vide donne du repos : l'absence est une information.
create or replace function public.place_swapped_day(
  p_swap_id     uuid,
  p_employee_id uuid,
  p_date        date,
  p_entry       public.planning_entries
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_boutique uuid;
begin
  v_boutique := coalesce(
    p_entry.boutique_id,
    (select e.boutique_id from public.employees e where e.id = p_employee_id)
  );

  insert into public.planning_entries (
    employee_id, boutique_id, date, status,
    start_time, end_time, break_start, break_end, note, source, source_ref
  ) values (
    p_employee_id, v_boutique, p_date,
    coalesce(p_entry.status, 'rest'),
    p_entry.start_time, p_entry.end_time, p_entry.break_start, p_entry.break_end,
    p_entry.note, 'swap', p_swap_id
  )
  on conflict (employee_id, date) do update set
    boutique_id = excluded.boutique_id,
    status      = excluded.status,
    start_time  = excluded.start_time,
    end_time    = excluded.end_time,
    break_start = excluded.break_start,
    break_end   = excluded.break_end,
    note        = excluded.note,
    source      = 'swap',
    source_ref  = p_swap_id;
end;
$$;

-- La journée cédée devient du repos, marquée par l'échange qui l'a libérée.
create or replace function public.free_swapped_day(
  p_swap_id     uuid,
  p_employee_id uuid,
  p_date        date
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_boutique uuid;
begin
  select e.boutique_id into v_boutique from public.employees e where e.id = p_employee_id;

  insert into public.planning_entries (
    employee_id, boutique_id, date, status, source, source_ref
  ) values (
    p_employee_id, v_boutique, p_date, 'rest', 'swap', p_swap_id
  )
  on conflict (employee_id, date) do update set
    status      = 'rest',
    start_time  = null,
    end_time    = null,
    break_start = null,
    break_end   = null,
    source      = 'swap',
    source_ref  = p_swap_id;
end;
$$;

revoke all on function public.apply_planning_swap(uuid, uuid, date, uuid, date)
  from public, anon, authenticated;
revoke all on function public.place_swapped_day(uuid, uuid, date, public.planning_entries)
  from public, anon, authenticated;
revoke all on function public.free_swapped_day(uuid, uuid, date) from public, anon, authenticated;

grant execute on function public.apply_planning_swap(uuid, uuid, date, uuid, date) to service_role;

select public.revoke_anon_table_privileges();
