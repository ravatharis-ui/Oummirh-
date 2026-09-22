-- =============================================================================
-- 20260922160000_core_events — bus d'événements et notifications
--
-- Modules never call each other. They emit an event, and whoever cares reacts.
-- The row is written in the same transaction as the business change, so an
-- approved leave and the event announcing it are committed together or not at
-- all: no half-applied state, ever.
--
-- The dispatcher then picks rows up out-of-band. Every function here is
-- `service_role` only, except `emit_event`, which is also reachable from the
-- module RPCs because those run as their owner.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Emission — called from inside a business transaction.
-- -----------------------------------------------------------------------------
create or replace function public.emit_event(
  p_type text,
  p_payload jsonb default '{}'::jsonb,
  p_actor_id uuid default null
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
  if p_type is null or p_type !~ '^[a-z_]+\.[a-z_]+$' then
    raise exception 'Type d''événement invalide : "%". Format attendu : module.action.', p_type
      using errcode = '22023';
  end if;

  insert into public.domain_events (type, payload, actor_id)
  values (p_type, coalesce(p_payload, '{}'::jsonb), coalesce(p_actor_id, (select auth.uid())))
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.emit_event(text, jsonb, uuid) is
  'Inscrit un événement dans la même transaction que l''action métier (pattern outbox).';

revoke all on function public.emit_event(text, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.emit_event(text, jsonb, uuid) to service_role;

-- -----------------------------------------------------------------------------
-- Claiming — the dispatcher reserves a batch.
--
-- `for update skip locked` lets two dispatchers run at once without either
-- touching the other's rows: the webhook can fire while the cron is catching up.
--
-- `attempts` is incremented when the row is claimed, not when the handler fails.
-- A crash mid-handler therefore still counts, so an event that reliably kills the
-- process cannot loop forever.
-- -----------------------------------------------------------------------------
create or replace function public.claim_domain_events(
  p_limit integer default 20,
  p_max_attempts integer default 5
)
returns setof public.domain_events
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  return query
  with claimed as (
    select e.id
    from public.domain_events e
    where e.processed_at is null
      and e.attempts < p_max_attempts
    order by e.created_at
    limit greatest(p_limit, 1)
    for update skip locked
  )
  update public.domain_events d
     set attempts = d.attempts + 1
    from claimed c
   where d.id = c.id
  returning d.*;
end;
$$;

comment on function public.claim_domain_events(integer, integer) is
  'Réserve un lot d''événements non traités et incrémente leur compteur de tentatives.';

revoke all on function public.claim_domain_events(integer, integer) from public, anon, authenticated;
grant execute on function public.claim_domain_events(integer, integer) to service_role;

-- -----------------------------------------------------------------------------
-- Outcome
-- -----------------------------------------------------------------------------
create or replace function public.mark_event_processed(p_id uuid)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.domain_events
     set processed_at = now(), last_error = null
   where id = p_id and processed_at is null;
$$;

create or replace function public.mark_event_failed(p_id uuid, p_error text)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.domain_events
     set last_error = left(coalesce(p_error, 'Erreur inconnue'), 2000)
   where id = p_id and processed_at is null;
$$;

comment on function public.mark_event_processed(uuid) is 'Marque un événement comme traité.';
comment on function public.mark_event_failed(uuid, text) is
  'Conserve le motif du dernier échec. La tentative a déjà été comptée à la réservation.';

revoke all on function public.mark_event_processed(uuid) from public, anon, authenticated;
revoke all on function public.mark_event_failed(uuid, text) from public, anon, authenticated;
grant execute on function public.mark_event_processed(uuid) to service_role;
grant execute on function public.mark_event_failed(uuid, text) to service_role;

-- -----------------------------------------------------------------------------
-- Notifications — inserted server side, read by the bell.
-- -----------------------------------------------------------------------------
create or replace function public.notify_user(
  p_recipient_user_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_href text default null,
  p_payload jsonb default '{}'::jsonb
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
  insert into public.notifications (recipient_user_id, type, title, body, href, payload)
  values (p_recipient_user_id, p_type, p_title, p_body, p_href, coalesce(p_payload, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end;
$$;

comment on function public.notify_user(uuid, text, text, text, text, jsonb) is
  'Dépose une notification. Le nom évite la collision avec le NOTIFY de Postgres.';

revoke all on function public.notify_user(uuid, text, text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.notify_user(uuid, text, text, text, text, jsonb) to service_role;

create or replace function public.mark_notification_emailed(p_id uuid)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.notifications set emailed_at = now() where id = p_id and emailed_at is null;
$$;

revoke all on function public.mark_notification_emailed(uuid) from public, anon, authenticated;
grant execute on function public.mark_notification_emailed(uuid) to service_role;

-- -----------------------------------------------------------------------------
-- Marking as read — the one write the browser is allowed, already limited to the
-- `read_at` column by the grants from the core migration.
-- -----------------------------------------------------------------------------
create or replace function public.mark_all_notifications_read()
returns integer
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_count integer;
begin
  -- security invoker: the caller's RLS applies, so this can only ever touch the
  -- caller's own rows. It exists for convenience, not for privilege.
  update public.notifications
     set read_at = now()
   where recipient_user_id = (select auth.uid())
     and read_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.mark_all_notifications_read() is
  'Marque toutes les notifications de l''utilisateur courant comme lues.';

revoke all on function public.mark_all_notifications_read() from public, anon;
grant execute on function public.mark_all_notifications_read() to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Realtime needs the whole row to reach the browser on insert.
-- -----------------------------------------------------------------------------
alter table public.notifications replica identity full;
