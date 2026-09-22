-- Minimal stand-in for the pgTAP assertions this project uses, so the real test
-- file can be executed without the extension. Any failure raises immediately.
create schema if not exists pgtap_stub;

create or replace function public.plan(integer) returns text
language plpgsql as $$
begin
  perform set_config('pgtap_stub.planned', $1::text, false);
  perform set_config('pgtap_stub.ran', '0', false);
  return '1..' || $1;
end $$;

create or replace function public.bump() returns void
language plpgsql as $$
begin
  perform set_config('pgtap_stub.ran',
    (coalesce(nullif(current_setting('pgtap_stub.ran', true), ''), '0')::int + 1)::text, false);
end $$;

create or replace function public.is(anyelement, anyelement, text) returns text
language plpgsql as $$
begin
  perform public.bump();
  if $1 is distinct from $2 then
    raise exception 'ECHEC [%] : attendu %, obtenu %', $3, $2, $1;
  end if;
  return 'ok - ' || $3;
end $$;

create or replace function public.ok(boolean, text) returns text
language plpgsql as $$
begin
  perform public.bump();
  if $1 is not true then
    raise exception 'ECHEC [%] : condition fausse', $2;
  end if;
  return 'ok - ' || $2;
end $$;

create or replace function public.cmp_ok(anyelement, text, anyelement, text) returns text
language plpgsql as $$
declare result boolean;
begin
  perform public.bump();
  execute format('select $1 %s $2', $2) into result using $1, $3;
  if result is not true then
    raise exception 'ECHEC [%] : « % % % » est faux', $4, $1, $2, $3;
  end if;
  return 'ok - ' || $4;
end $$;

create or replace function public.throws_ok(text, text, text, text) returns text
language plpgsql as $$
declare got text;
begin
  perform public.bump();
  begin
    execute $1;
  exception when others then
    got := SQLSTATE;
    if got <> $2 then
      raise exception 'ECHEC [%] : code attendu %, obtenu % (%)', $4, $2, got, SQLERRM;
    end if;
    return 'ok - ' || $4;
  end;
  raise exception 'ECHEC [%] : aucune erreur levée, % attendu', $4, $2;
end $$;

create or replace function public.lives_ok(text, text) returns text
language plpgsql as $$
begin
  perform public.bump();
  begin
    execute $1;
  exception when others then
    raise exception 'ECHEC [%] : erreur inattendue % (%)', $2, SQLSTATE, SQLERRM;
  end;
  return 'ok - ' || $2;
end $$;

create or replace function public.set_eq(text, anyarray, text) returns text
language plpgsql as $$
declare got text[]; want text[];
begin
  perform public.bump();
  execute format('select coalesce(array_agg(x order by x), array[]::text[]) from (%s) s(x)', $1)
    into got;
  select coalesce(array_agg(x order by x), array[]::text[]) into want from unnest($2) x;
  if got is distinct from want then
    raise exception 'ECHEC [%] : attendu %, obtenu %', $3, want, got;
  end if;
  return 'ok - ' || $3;
end $$;

create or replace function public.finish() returns setof text
language plpgsql as $$
declare planned int; ran int;
begin
  planned := current_setting('pgtap_stub.planned', true)::int;
  ran := current_setting('pgtap_stub.ran', true)::int;
  if planned <> ran then
    raise exception 'ECHEC : % tests annoncés, % exécutés', planned, ran;
  end if;
  return next format('TOUS LES %s TESTS SONT PASSES', ran);
end $$;

grant usage on schema pgtap_stub to public;
