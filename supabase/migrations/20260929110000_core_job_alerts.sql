-- =============================================================================
-- 20260929110000_core_job_alerts — la carte doit venir à la direction, pas
-- l'inverse
--
-- `job_runs` dit déjà quelle tâche a décroché, mais il faut ouvrir le tableau de
-- bord pour le voir. Une panne qui commence un mardi matin reste invisible
-- jusqu'au jour où quelqu'un pense à regarder — c'est-à-dire, en pratique, le
-- jour où le problème est devenu visible autrement.
--
-- `alerted_at` est ce qui fait qu'une alerte part **une fois** et non toutes les
-- minutes. Remise à null par un passage réussi : une tâche qui retombe en panne
-- six mois plus tard doit réalerter.
-- =============================================================================

alter table public.job_runs
  add column if not exists alerted_at timestamptz;

comment on column public.job_runs.alerted_at is
  'Dernière alerte envoyée à la direction pour cette tâche. Remise à null par un passage réussi.';

-- -----------------------------------------------------------------------------
-- `record_job_run` gagne l'effacement de l'alerte
-- -----------------------------------------------------------------------------
create or replace function public.record_job_run(
  p_job     text,
  p_ok      boolean,
  p_summary jsonb default '{}'::jsonb,
  p_error   text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.job_runs as j (job, last_run_at, last_ok_at, ok, summary, error,
                                    consecutive_failures, alerted_at)
  values (
    p_job,
    now(),
    case when p_ok then now() end,
    p_ok,
    coalesce(p_summary, '{}'::jsonb),
    p_error,
    case when p_ok then 0 else 1 end,
    null
  )
  on conflict (job) do update
     set last_run_at          = now(),
         -- Un échec conserve la date du dernier succès.
         last_ok_at           = case when p_ok then now() else j.last_ok_at end,
         ok                   = p_ok,
         summary              = coalesce(p_summary, '{}'::jsonb),
         error                = p_error,
         consecutive_failures = case when p_ok then 0 else j.consecutive_failures + 1 end,
         -- Un succès referme l'alerte : la prochaine panne pourra se signaler.
         alerted_at           = case when p_ok then null else j.alerted_at end;
end;
$$;

revoke all on function public.record_job_run(text, boolean, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.record_job_run(text, boolean, jsonb, text)
  to service_role;

-- -----------------------------------------------------------------------------
-- Marquer une alerte envoyée.
--
-- Un simple `update` : la fonction ne crée jamais de ligne. Une tâche qui n'a
-- jamais tourné n'a pas de ligne, et lui en fabriquer une la ferait passer pour
-- « en échec à l'instant » sur le tableau de bord — un écran de santé qui ment
-- est pire que pas d'écran. C'est aussi pourquoi « jamais lancée » n'alerte
-- pas : sur une installation neuve c'est l'état normal.
-- -----------------------------------------------------------------------------
create or replace function public.mark_job_alerted(p_job text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.job_runs set alerted_at = now() where job = p_job;
$$;

comment on function public.mark_job_alerted(text) is
  'Horodate l''alerte envoyée pour une tâche, pour qu''elle ne reparte pas à chaque passage.';

revoke all on function public.mark_job_alerted(text) from public, anon, authenticated;
grant execute on function public.mark_job_alerted(text) to service_role;
