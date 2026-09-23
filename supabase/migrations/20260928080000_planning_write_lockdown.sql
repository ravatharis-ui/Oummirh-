-- =============================================================================
-- 20260928080000_planning_write_lockdown — le planning ne s'écrit plus en direct
--
-- Audit de la Phase 11, table par table. Il restait une porte ouverte :
-- `planning_entries` et `planning_templates` étaient encore écrites directement
-- depuis le navigateur par la direction — la RLS l'autorisait, et le `grant`
-- aussi.
--
-- Ce n'est pas une faille : la RLS tenait. Mais une écriture directe contourne
-- trois choses qui comptent — le journal d'audit, l'annonce à la collaboratrice
-- (`planning_announce`), et la règle qui protège une journée posée par un congé
-- ou un remplacement. Autrement dit, elle contourne tout ce qui fait qu'un
-- planning est autre chose qu'un tableau.
--
-- Même raisonnement que pour les réglages : la politique reste — elle documente
-- l'intention —, le droit part.
-- =============================================================================

revoke insert, update, delete on public.planning_entries, public.planning_templates
  from authenticated;

-- -----------------------------------------------------------------------------
-- Conséquence : il faut une porte pour la semaine type
--
-- Jusqu'ici, `admin_apply_planning_template` savait appliquer une semaine type
-- que rien ne savait créer. La capacité existait sans porte d'entrée ; la voici.
-- -----------------------------------------------------------------------------
create or replace function public.admin_set_planning_template(
  p_employee_id uuid,
  p_weekday     integer,
  p_status      text,
  p_start_time  time default null,
  p_end_time    time default null,
  p_break_start time default null,
  p_break_end   time default null
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
    raise exception 'Seule la direction définit une semaine type.' using errcode = '42501';
  end if;

  if p_weekday not between 1 and 7 then
    raise exception 'Jour de la semaine invalide.' using errcode = '22023';
  end if;

  -- Même repli que pour une journée de planning : une journée travaillée sans
  -- horaires reprend ceux de la collaboratrice, plutôt que d'être refusée.
  if p_status in ('work', 'replacement') and (p_start_time is null or p_end_time is null) then
    select e.default_start, e.default_end into p_start_time, p_end_time
      from public.employees e where e.id = p_employee_id;
  end if;

  insert into public.planning_templates (
    employee_id, weekday, status, start_time, end_time, break_start, break_end
  ) values (
    p_employee_id, p_weekday, p_status,
    case when p_status in ('work', 'replacement') then p_start_time end,
    case when p_status in ('work', 'replacement') then p_end_time end,
    case when p_status in ('work', 'replacement') then p_break_start end,
    case when p_status in ('work', 'replacement') then p_break_end end
  )
  on conflict (employee_id, weekday) do update set
    status      = excluded.status,
    start_time  = excluded.start_time,
    end_time    = excluded.end_time,
    break_start = excluded.break_start,
    break_end   = excluded.break_end
  returning id into v_id;

  insert into public.audit_log (actor_id, action, entity, entity_id, after)
  values ((select auth.uid()), 'planning.template_set', 'planning_templates', v_id,
          jsonb_build_object('employee_id', p_employee_id, 'weekday', p_weekday,
                             'status', p_status));

  return v_id;
end;
$$;

comment on function public.admin_set_planning_template is
  'Définit une journée de la semaine type. La semaine type ne change aucun planning : elle sert à le remplir.';

revoke all on function public.admin_set_planning_template from public, anon;
grant execute on function public.admin_set_planning_template to authenticated, service_role;

create or replace function public.admin_clear_planning_template(
  p_employee_id uuid,
  p_weekday     integer
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_deleted uuid;
begin
  if not public.is_admin() then
    raise exception 'Seule la direction définit une semaine type.' using errcode = '42501';
  end if;

  delete from public.planning_templates
   where employee_id = p_employee_id and weekday = p_weekday
  returning id into v_deleted;

  if v_deleted is null then
    return false;
  end if;

  insert into public.audit_log (actor_id, action, entity, entity_id, after)
  values ((select auth.uid()), 'planning.template_cleared', 'planning_templates', v_deleted,
          jsonb_build_object('employee_id', p_employee_id, 'weekday', p_weekday));

  return true;
end;
$$;

revoke all on function public.admin_clear_planning_template(uuid, integer) from public, anon;
grant execute on function public.admin_clear_planning_template(uuid, integer)
  to authenticated, service_role;

select public.revoke_anon_table_privileges();
