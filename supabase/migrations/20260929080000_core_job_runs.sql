-- Santé des tâches planifiées.
--
-- Cinq choses tournent sans que personne clique : le distributeur d'événements,
-- les alertes de retard, le calcul des heures, l'acquisition des congés et la
-- purge des photos. Si l'une s'arrête, **rien ne le dit** aujourd'hui : on le
-- découvrirait en mars, en constatant que personne n'a acquis de congés depuis
-- janvier, ou en trouvant une photo de décembre que la page de confidentialité
-- promettait effacée.
--
-- Chaque tâche écrit donc ici en finissant, et l'espace direction lit ces
-- lignes. Une ligne par tâche, jamais un journal : le distributeur tourne
-- toutes les minutes, et garder son histoire ferait cinquante mille lignes par
-- mois pour répondre à une question qui ne porte que sur la dernière.
--
-- `last_ok_at` est tenu à part de `last_run_at` exprès : un échec ne doit pas
-- effacer la trace du dernier succès, qui est ce qui dit depuis quand ça dure.

create table if not exists public.job_runs (
  job                  text primary key,
  last_run_at          timestamptz not null,
  last_ok_at           timestamptz,
  ok                   boolean not null,
  summary              jsonb not null default '{}'::jsonb,
  error                text,
  consecutive_failures integer not null default 0
);

comment on table public.job_runs is
  'Dernier passage de chaque tâche planifiée. Une ligne par tâche, écrite par record_job_run().';
comment on column public.job_runs.last_ok_at is
  'Dernier passage réussi. Tenu à part de last_run_at pour qu''un échec n''efface pas depuis quand ça marchait.';

alter table public.job_runs enable row level security;

-- La direction lit. Personne n'écrit depuis une session : ni politique
-- d'insert, ni d'update, ni de delete, pour personne. Tout passe par
-- record_job_run(), qui n'est appelable que par le serveur.
drop policy if exists "job_runs: la direction consulte" on public.job_runs;
create policy "job_runs: la direction consulte"
  on public.job_runs for select
  to authenticated
  using (public.is_admin());

revoke all on table public.job_runs from anon, authenticated;
grant select on table public.job_runs to authenticated;

-- ======================================================= l'écriture =========

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
                                    consecutive_failures)
  values (
    p_job,
    now(),
    case when p_ok then now() end,
    p_ok,
    coalesce(p_summary, '{}'::jsonb),
    p_error,
    case when p_ok then 0 else 1 end
  )
  on conflict (job) do update
     set last_run_at          = now(),
         -- Un échec conserve la date du dernier succès.
         last_ok_at           = case when p_ok then now() else j.last_ok_at end,
         ok                   = p_ok,
         summary              = coalesce(p_summary, '{}'::jsonb),
         error                = p_error,
         consecutive_failures = case when p_ok then 0 else j.consecutive_failures + 1 end;
end;
$$;

comment on function public.record_job_run(text, boolean, jsonb, text) is
  'Enregistre le passage d''une tâche planifiée. Appelée par le serveur uniquement.';

revoke all on function public.record_job_run(text, boolean, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.record_job_run(text, boolean, jsonb, text)
  to service_role;
