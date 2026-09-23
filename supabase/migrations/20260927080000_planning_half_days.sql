-- =============================================================================
-- 20260927080000_planning_half_days — une demi-journée de congé reste une
-- demi-journée sur le planning
--
-- Le décompte savait compter 0,5 jour ; le planning, lui, affichait « Congé »
-- sur la journée entière. Le solde était juste et l'écran mentait : quelqu'un
-- qui part à midi apparaissait absente toute la journée, et la direction ne
-- pouvait pas voir qu'il restait une matinée à couvrir.
--
-- La correction tient à une idée simple : sur les journées de bord, on ne
-- remplace pas la journée de travail, on la **raccourcit**. Le milieu de journée
-- est la pause déjeuner par défaut (`settings.default_schedule`), donc le gérant
-- peut le déplacer depuis l'écran des paramètres sans qu'on touche au code.
-- =============================================================================

create or replace function public.midday_boundary()
returns table (morning_end time, afternoon_start time)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_schedule jsonb;
begin
  select value into v_schedule from public.settings where key = 'default_schedule';

  return query select
    coalesce((v_schedule ->> 'break_start')::time, '12:30'::time),
    coalesce((v_schedule ->> 'break_end')::time, '14:00'::time);
end;
$$;

comment on function public.midday_boundary() is
  'Le milieu de journée, pris sur la pause déjeuner par défaut. Sert à couper une demi-journée de congé.';

revoke all on function public.midday_boundary() from public, anon, authenticated;
grant execute on function public.midday_boundary() to service_role;

-- -----------------------------------------------------------------------------
-- Poser un congé, demi-journées comprises
-- -----------------------------------------------------------------------------
create or replace function public.apply_planning_leave(
  p_employee_id uuid,
  p_request_id  uuid,
  p_from        date,
  p_to          date,
  p_start_half  text default null,
  p_end_half    text default null
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_boutique    uuid;
  v_morning_end time;
  v_afternoon   time;
  v_count       integer := 0;
  v_dates       date[] := '{}';
  v_day         date;
  v_before      jsonb;
  v_status      text;
  v_start       time;
  v_end         time;
  v_is_first    boolean;
  v_is_last     boolean;
  v_half        text;
begin
  select e.boutique_id into v_boutique from public.employees e where e.id = p_employee_id;
  if v_boutique is null then
    raise exception 'Collaboratrice introuvable.' using errcode = '23503';
  end if;

  select m.morning_end, m.afternoon_start into v_morning_end, v_afternoon
    from public.midday_boundary() m;

  -- Le cliché d'abord, comme pour toute écriture au nom d'un autre module :
  -- c'est lui qui permettra de tout rendre à l'annulation.
  insert into public.planning_snapshots (source, source_ref, employee_id, date, entry)
  select 'leave', p_request_id, p_employee_id, d.day::date,
         (select to_jsonb(pe) from public.planning_entries pe
           where pe.employee_id = p_employee_id and pe.date = d.day::date)
    from generate_series(p_from, p_to, interval '1 day') as d(day)
  on conflict do nothing;

  for v_day in select generate_series(p_from, p_to, interval '1 day')::date
  loop
    v_is_first := v_day = p_from;
    v_is_last  := v_day = p_to;

    -- Sur une journée unique, c'est `start_half` qui tranche : « je pars
    -- l'après-midi » veut dire qu'elle travaille le matin.
    v_half := case
      when v_is_first and p_start_half = 'pm' then 'pm'
      when v_is_last and p_end_half = 'am' then 'am'
      else null
    end;

    select entry into v_before
      from public.planning_snapshots
     where source = 'leave' and source_ref = p_request_id
       and employee_id = p_employee_id and date = v_day;

    v_status := 'leave';
    v_start := null;
    v_end := null;

    -- Une demi-journée ne se dessine que s'il y avait une journée de travail à
    -- raccourcir. Sinon, « Congé » reste la description la plus honnête.
    if v_half is not null
       and v_before ->> 'status' in ('work', 'replacement')
       and (v_before ->> 'start_time') is not null
       and (v_before ->> 'end_time') is not null
    then
      if v_half = 'pm' then
        v_start := (v_before ->> 'start_time')::time;
        v_end   := least((v_before ->> 'end_time')::time, v_morning_end);
      else
        v_start := greatest((v_before ->> 'start_time')::time, v_afternoon);
        v_end   := (v_before ->> 'end_time')::time;
      end if;

      -- Si la coupure ne laisse rien, la demi-journée n'en est pas une.
      if v_end > v_start then
        v_status := v_before ->> 'status';
      else
        v_start := null;
        v_end := null;
      end if;
    end if;

    insert into public.planning_entries (
      employee_id, boutique_id, date, status, start_time, end_time,
      note, source, source_ref
    ) values (
      p_employee_id,
      coalesce((v_before ->> 'boutique_id')::uuid, v_boutique),
      v_day, v_status, v_start, v_end,
      case when v_half is not null then 'Demi-journée de congé' end,
      'leave', p_request_id
    )
    on conflict (employee_id, date) do update set
      boutique_id = excluded.boutique_id,
      status      = excluded.status,
      start_time  = excluded.start_time,
      end_time    = excluded.end_time,
      break_start = null,
      break_end   = null,
      note        = excluded.note,
      source      = 'leave',
      source_ref  = p_request_id;

    v_count := v_count + 1;
    v_dates := v_dates || v_day;
  end loop;

  if cardinality(v_dates) > 0 then
    perform public.planning_announce(p_employee_id, v_dates);
  end if;

  return v_count;
end;
$$;

comment on function public.apply_planning_leave is
  'Pose un congé sur le planning. Les journées de bord en demi sont raccourcies, pas remplacées.';

revoke all on function public.apply_planning_leave from public, anon, authenticated;
grant execute on function public.apply_planning_leave to service_role;

-- -----------------------------------------------------------------------------
-- L'événement transporte désormais les demi-journées
-- -----------------------------------------------------------------------------
create or replace function public.admin_decide_leave(
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
  v_request public.leave_requests;
  v_days    numeric;
begin
  if not public.is_admin() then
    raise exception 'Seule la direction décide d''un congé.' using errcode = '42501';
  end if;

  select * into v_request from public.leave_requests where id = p_request_id for update;

  if v_request.id is null then
    raise exception 'Demande introuvable.' using errcode = '23503';
  end if;

  if v_request.status <> 'pending' then
    raise exception 'Cette demande a déjà été traitée.' using errcode = '22023';
  end if;

  if not p_approve then
    update public.leave_requests
       set status = 'refused', admin_comment = p_comment,
           decided_by = (select auth.uid()), decided_at = now()
     where id = p_request_id;

    insert into public.audit_log (actor_id, action, entity, entity_id, before, after)
    values ((select auth.uid()), 'conges.refused', 'leave_requests', p_request_id,
            to_jsonb(v_request), jsonb_build_object('status', 'refused', 'comment', p_comment));

    perform public.emit_event(
      'conges.request_refused',
      jsonb_build_object('id', p_request_id, 'employee_id', v_request.employee_id,
                         'start_date', v_request.start_date, 'end_date', v_request.end_date,
                         'comment', p_comment)
    );
    return;
  end if;

  v_days := public.count_leave_days(
    v_request.employee_id, v_request.start_date, v_request.end_date,
    v_request.start_half, v_request.end_half
  );

  update public.leave_requests
     set status = 'approved', days = v_days, admin_comment = p_comment,
         decided_by = (select auth.uid()), decided_at = now()
   where id = p_request_id;

  insert into public.leave_ledger (
    employee_id, kind, days, period_start, occurred_on, source_ref, note, created_by
  ) values (
    v_request.employee_id, 'taken', -v_days,
    public.leave_period_start(v_request.start_date), v_request.start_date,
    p_request_id, 'Congé validé', (select auth.uid())
  );

  insert into public.audit_log (actor_id, action, entity, entity_id, before, after)
  values ((select auth.uid()), 'conges.approved', 'leave_requests', p_request_id,
          to_jsonb(v_request), jsonb_build_object('status', 'approved', 'days', v_days));

  perform public.emit_event(
    'conges.request_approved',
    jsonb_build_object('id', p_request_id, 'employee_id', v_request.employee_id,
                       'start_date', v_request.start_date, 'end_date', v_request.end_date,
                       'start_half', v_request.start_half, 'end_half', v_request.end_half,
                       'days', v_days)
  );
end;
$$;

revoke all on function public.admin_decide_leave(uuid, boolean, text) from public, anon;
grant execute on function public.admin_decide_leave(uuid, boolean, text) to authenticated, service_role;
