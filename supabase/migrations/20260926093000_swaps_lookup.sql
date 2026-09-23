-- =============================================================================
-- 20260926093000_swaps_lookup — voir juste ce qu'il faut pour proposer un échange
--
-- Une collaboratrice ne lit pas le planning d'une collègue : la RLS l'en
-- empêche, et c'est voulu. Mais pour proposer un échange, il faut bien savoir
-- quelles journées sa collègue peut céder.
--
-- Ces deux fonctions ouvrent la porte le moins possible. `swappable_days` ne
-- renvoie **que** les journées échangeables — travail, remplacement, repos. Un
-- congé, un arrêt maladie ou un jour d'école n'y figurent pas, et sont donc
-- indistinguables d'une journée sans planning. C'est la même règle que
-- `my_boutique_presence` : on dit qui est là, jamais pourquoi quelqu'un ne
-- l'est pas.
-- =============================================================================

create or replace function public.swappable_days(
  p_employee_id uuid,
  p_from        date default null,
  p_to          date default null
)
returns table (date date, status text, start_time time, end_time time)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_from date := coalesce(p_from, public.reunion_today() + 1);
  v_to   date := coalesce(p_to, public.reunion_today() + 60);
begin
  if public.current_employee_id() is null and not public.is_admin() then
    raise exception 'Session expirée.' using errcode = '42501';
  end if;

  if not exists (select 1 from public.employees e where e.id = p_employee_id and e.is_active) then
    return;
  end if;

  return query
  select p.date, p.status, p.start_time, p.end_time
    from public.planning_entries p
   where p.employee_id = p_employee_id
     and p.date between v_from and v_to
     and p.status in ('work', 'replacement', 'rest')
   order by p.date;
end;
$$;

comment on function public.swappable_days(uuid, date, date) is
  'Journées échangeables d''une collaboratrice. N''expose jamais un congé, une maladie ou un jour d''école.';

revoke all on function public.swappable_days(uuid, date, date) from public, anon;
grant execute on function public.swappable_days(uuid, date, date) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Les collègues à qui proposer un échange.
--
-- Prénom et point de vente, rien d'autre : de quoi choisir quelqu'un dans une
-- liste, pas de quoi reconstituer l'annuaire du personnel.
-- -----------------------------------------------------------------------------
create or replace function public.swap_colleagues()
returns table (employee_id uuid, display_name text, boutique_name text, same_boutique boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me       uuid := public.current_employee_id();
  v_boutique uuid;
begin
  if v_me is null then
    raise exception 'Session expirée.' using errcode = '42501';
  end if;

  select e.boutique_id into v_boutique from public.employees e where e.id = v_me;

  return query
  select e.id, e.display_name, b.name, e.boutique_id = v_boutique
    from public.employees e
    join public.boutiques b on b.id = e.boutique_id
   where e.is_active and e.id <> v_me
   -- Sa propre boutique d'abord : c'est là que les échanges se font le plus.
   order by (e.boutique_id = v_boutique) desc, e.display_name;
end;
$$;

comment on function public.swap_colleagues() is
  'Collègues à qui proposer un échange : prénom et point de vente, rien de plus.';

revoke all on function public.swap_colleagues() from public, anon;
grant execute on function public.swap_colleagues() to authenticated, service_role;
