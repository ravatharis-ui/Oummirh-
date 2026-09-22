-- =============================================================================
-- 20260924083000_conges_functions — demander, décider, acquérir
--
-- Aucune de ces fonctions ne fait confiance à un décompte venu du navigateur.
-- Le nombre de jours est recalculé ici à la demande, **puis à nouveau à la
-- validation** : entre les deux, le planning a pu changer, un jour férié a pu
-- être ajouté, et c'est le jour de la décision qui fait foi.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Demander
-- -----------------------------------------------------------------------------
create or replace function public.request_leave(
  p_start_date         date,
  p_end_date           date,
  p_start_half         text default null,
  p_end_half           text default null,
  p_reason             text default null,
  p_justification_path text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_employee uuid := public.current_employee_id();
  v_days     numeric;
  v_id       uuid;
begin
  if v_employee is null then
    raise exception 'Session expirée. Reconnecte-toi pour demander un congé.' using errcode = '42501';
  end if;

  if p_end_date < p_start_date then
    raise exception 'La date de fin précède la date de début.' using errcode = '22023';
  end if;

  -- Une demande porte sur l'avenir. Régulariser un congé passé est une écriture
  -- de la direction, pas une demande.
  if p_start_date < public.reunion_today() then
    raise exception 'On ne demande pas un congé pour une date déjà passée.' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.leave_requests r
     where r.employee_id = v_employee
       and r.status in ('pending', 'approved')
       and r.start_date <= p_end_date
       and r.end_date >= p_start_date
  ) then
    raise exception 'Tu as déjà une demande sur ces dates.' using errcode = '23505';
  end if;

  v_days := public.count_leave_days(v_employee, p_start_date, p_end_date, p_start_half, p_end_half);

  if v_days <= 0 then
    raise exception 'Cette période ne contient aucun jour décompté : ce sont déjà des jours non travaillés.'
      using errcode = '22023';
  end if;

  insert into public.leave_requests (
    employee_id, start_date, end_date, start_half, end_half, days, reason, justification_path
  ) values (
    v_employee, p_start_date, p_end_date, p_start_half, p_end_half, v_days, p_reason, p_justification_path
  )
  returning id into v_id;

  perform public.emit_event(
    'conges.request_submitted',
    jsonb_build_object(
      'id', v_id, 'employee_id', v_employee,
      'start_date', p_start_date, 'end_date', p_end_date, 'days', v_days
    )
  );

  return v_id;
end;
$$;

comment on function public.request_leave is
  'Dépose une demande de congé. Le nombre de jours est calculé ici, jamais accepté du navigateur.';

revoke all on function public.request_leave from public, anon;
grant execute on function public.request_leave to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Décider
--
-- À la validation, et seulement là, le ledger bouge. La ligne `taken` porte la
-- référence de la demande : annuler, c'est retrouver cette ligne et la
-- contrebalancer, jamais la supprimer.
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

  -- Recalcul : le planning ou les jours fériés ont pu changer depuis la demande.
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
                       'days', v_days)
  );
end;
$$;

comment on function public.admin_decide_leave(uuid, boolean, text) is
  'Valide ou refuse une demande. À la validation, recalcule le décompte et écrit le mouvement.';

revoke all on function public.admin_decide_leave(uuid, boolean, text) from public, anon;
grant execute on function public.admin_decide_leave(uuid, boolean, text) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Annuler
--
-- Une demande en attente s'annule par la collaboratrice. Un congé déjà validé
-- ne s'annule que par la direction, et recrédite le ledger par une ligne
-- d'ajustement : la ligne `taken` d'origine reste, l'histoire aussi.
-- -----------------------------------------------------------------------------
create or replace function public.cancel_leave_request(p_request_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_request public.leave_requests;
  v_is_admin boolean := public.is_admin();
  v_employee uuid := public.current_employee_id();
begin
  select * into v_request from public.leave_requests where id = p_request_id for update;

  if v_request.id is null then
    raise exception 'Demande introuvable.' using errcode = '23503';
  end if;

  if not v_is_admin and v_request.employee_id is distinct from v_employee then
    raise exception 'Cette demande n''est pas la tienne.' using errcode = '42501';
  end if;

  if v_request.status = 'cancelled' then
    return;
  end if;

  if v_request.status = 'refused' then
    raise exception 'Une demande refusée ne s''annule pas.' using errcode = '22023';
  end if;

  if v_request.status = 'approved' and not v_is_admin then
    raise exception 'Ce congé est validé : seule la direction peut l''annuler.' using errcode = '42501';
  end if;

  update public.leave_requests
     set status = 'cancelled', decided_by = (select auth.uid()), decided_at = now()
   where id = p_request_id;

  if v_request.status = 'approved' then
    insert into public.leave_ledger (
      employee_id, kind, days, period_start, occurred_on, source_ref, note, created_by
    ) values (
      v_request.employee_id, 'adjustment', v_request.days,
      public.leave_period_start(v_request.start_date), public.reunion_today(),
      p_request_id, 'Annulation d''un congé validé', (select auth.uid())
    );

    insert into public.audit_log (actor_id, action, entity, entity_id, before, after)
    values ((select auth.uid()), 'conges.cancelled', 'leave_requests', p_request_id,
            to_jsonb(v_request), jsonb_build_object('status', 'cancelled'));
  end if;

  perform public.emit_event(
    'conges.request_cancelled',
    jsonb_build_object('id', p_request_id, 'employee_id', v_request.employee_id,
                       'start_date', v_request.start_date, 'end_date', v_request.end_date,
                       'was_approved', v_request.status = 'approved')
  );
end;
$$;

comment on function public.cancel_leave_request(uuid) is
  'Annule une demande. Un congé validé ne s''annule que par la direction et recrédite le solde.';

revoke all on function public.cancel_leave_request(uuid) from public, anon;
grant execute on function public.cancel_leave_request(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Ajustement manuel
-- -----------------------------------------------------------------------------
create or replace function public.admin_adjust_leave(
  p_employee_id uuid,
  p_days        numeric,
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

  if p_days = 0 then
    raise exception 'Un ajustement de zéro jour n''a pas de sens.' using errcode = '22023';
  end if;

  if p_note is null or length(btrim(p_note)) < 5 then
    raise exception 'Un ajustement de solde doit être motivé.' using errcode = '22023';
  end if;

  insert into public.leave_ledger (
    employee_id, kind, days, period_start, occurred_on, note, created_by
  ) values (
    p_employee_id, 'adjustment', p_days, public.leave_period_start(null),
    public.reunion_today(), btrim(p_note), (select auth.uid())
  )
  returning id into v_id;

  insert into public.audit_log (actor_id, action, entity, entity_id, after)
  values ((select auth.uid()), 'conges.adjusted', 'leave_ledger', v_id,
          jsonb_build_object('employee_id', p_employee_id, 'days', p_days, 'note', btrim(p_note)));

  return v_id;
end;
$$;

revoke all on function public.admin_adjust_leave(uuid, numeric, text) from public, anon;
grant execute on function public.admin_adjust_leave(uuid, numeric, text) to authenticated, service_role;

-- =============================================================================
-- Acquisition mensuelle
--
-- Le 1er de chaque mois, chaque collaboratrice active gagne ses jours. Une
-- embauche en cours de mois est proratisée sur les jours restants — sinon
-- quelqu'un embauché le 28 gagnerait autant que quelqu'un présent depuis le 1er.
--
-- L'index unique fait le reste : rejouer la tâche ne crédite jamais deux fois.
-- =============================================================================
create or replace function public.accrue_monthly_leave(p_at timestamptz default now())
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_month_start date := date_trunc('month', (p_at at time zone 'Indian/Reunion'))::date;
  v_month_days  integer := extract(day from (v_month_start + interval '1 month' - interval '1 day'));
  v_per_month   numeric := coalesce((public.leave_rules() ->> 'days_per_month')::numeric, 2.5);
  v_count       integer := 0;
  v_row         record;
  v_days        numeric;
begin
  for v_row in
    select e.id, e.hire_date
      from public.employees e
     where e.is_active
       and (e.hire_date is null or e.hire_date < v_month_start + interval '1 month')
  loop
    v_days := v_per_month;

    -- Embauchée en cours de mois : au prorata des jours restants.
    if v_row.hire_date is not null and v_row.hire_date > v_month_start then
      v_days := round(
        v_per_month * (v_month_days - extract(day from v_row.hire_date) + 1) / v_month_days,
        2
      );
    end if;

    if v_days > 0 then
      insert into public.leave_ledger (
        employee_id, kind, days, period_start, occurred_on, note
      ) values (
        v_row.id, 'accrual', v_days, public.leave_period_start(v_month_start),
        v_month_start, 'Acquisition mensuelle'
      )
      on conflict do nothing;

      if found then
        v_count := v_count + 1;
      end if;
    end if;
  end loop;

  return v_count;
end;
$$;

comment on function public.accrue_monthly_leave(timestamptz) is
  'Crédite l''acquisition du mois. Idempotente : rejouée, elle ne crédite pas deux fois.';

revoke all on function public.accrue_monthly_leave(timestamptz) from public, anon, authenticated;
grant execute on function public.accrue_monthly_leave(timestamptz) to service_role;

-- =============================================================================
-- Clôture de période — le 1er juin
--
-- Report ou expiration, selon `settings.leave_rules.carry_over`. Dans les deux
-- cas une ligne est écrite dans la période **qui s'ouvre** : l'ancienne période
-- garde son solde tel qu'il était, et reste lisible.
-- =============================================================================
create or replace function public.close_leave_period(p_at timestamptz default now())
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_new_period date := public.leave_period_start((p_at at time zone 'Indian/Reunion')::date);
  v_old_period date := (v_new_period - interval '1 year')::date;
  v_carry      boolean := coalesce((public.leave_rules() ->> 'carry_over')::boolean, true);
  v_count      integer := 0;
  v_row        record;
begin
  for v_row in
    select l.employee_id, sum(l.days) as balance
      from public.leave_ledger l
     where l.period_start = v_old_period
     group by l.employee_id
    having sum(l.days) <> 0
  loop
    if v_carry and v_row.balance > 0 then
      insert into public.leave_ledger (
        employee_id, kind, days, period_start, occurred_on, note
      ) values (
        v_row.employee_id, 'carry_over', v_row.balance, v_new_period, v_new_period,
        'Report de la période précédente'
      )
      on conflict do nothing;
    elsif not v_carry and v_row.balance > 0 then
      -- L'expiration s'écrit dans l'ancienne période : c'est là qu'elle a lieu.
      insert into public.leave_ledger (
        employee_id, kind, days, period_start, occurred_on, note
      ) values (
        v_row.employee_id, 'expiry', -v_row.balance, v_old_period, v_new_period,
        'Solde non reporté en fin de période'
      )
      on conflict do nothing;
    elsif v_row.balance < 0 then
      -- Un solde négatif suit la collaboratrice : l'effacer serait lui offrir
      -- des jours qu'elle a déjà pris.
      insert into public.leave_ledger (
        employee_id, kind, days, period_start, occurred_on, note
      ) values (
        v_row.employee_id, 'carry_over', v_row.balance, v_new_period, v_new_period,
        'Report d''un solde négatif'
      )
      on conflict do nothing;
    end if;

    if found then
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

comment on function public.close_leave_period(timestamptz) is
  'Reporte ou fait expirer le solde au changement de période. Un solde négatif est toujours reporté.';

revoke all on function public.close_leave_period(timestamptz) from public, anon, authenticated;
grant execute on function public.close_leave_period(timestamptz) to service_role;

-- =============================================================================
-- Chevauchements — l'information dont la direction a besoin pour décider
--
-- Réservée à la direction : savoir qui d'autre est en congé aux mêmes dates est
-- une information d'organisation, pas une information que les collègues se
-- partagent.
-- =============================================================================
create or replace function public.admin_leave_overlaps(
  p_employee_id uuid,
  p_from        date,
  p_to          date
)
returns table (employee_id uuid, display_name text, start_date date, end_date date)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Réservé à la direction.' using errcode = '42501';
  end if;

  return query
  select e.id, e.display_name, r.start_date, r.end_date
    from public.leave_requests r
    join public.employees e on e.id = r.employee_id
   where r.status in ('pending', 'approved')
     and r.employee_id <> p_employee_id
     and r.start_date <= p_to
     and r.end_date >= p_from
     and e.boutique_id = (
       select b.boutique_id from public.employees b where b.id = p_employee_id
     )
   order by r.start_date;
end;
$$;

revoke all on function public.admin_leave_overlaps(uuid, date, date) from public, anon;
grant execute on function public.admin_leave_overlaps(uuid, date, date) to authenticated, service_role;

select public.revoke_anon_table_privileges();
