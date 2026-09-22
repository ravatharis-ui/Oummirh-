-- Données représentatives d'un projet déjà en service.
--
-- La suite de tests s'exécute APRÈS ce fichier, volontairement. Des tests qui ne
-- passent que sur une base vide ne prouvent rien : ils ont déjà laissé passer une
-- régression en production, parce qu'ils comptaient « toutes » les lignes d'une
-- table au lieu de vérifier leurs propres fixtures.
--
-- On recrée donc ici l'équivalent de ce que `scripts/seed-employees.ts` produit :
-- une direction et dix collaboratrices réparties dans les cinq points de vente.

insert into auth.users (id, email) values
  ('eeeeeeee-0000-4000-8000-00000000000a', 'direction@oummi-existant.invalid');
insert into public.user_roles (user_id, role, boutique_id)
  values ('eeeeeeee-0000-4000-8000-00000000000a', 'admin', null);

do $$
declare
  people text[][] := array[
    array['ADAM','Loubna','STDENIS','CDI'],
    array['ADAM','Chamyma','STDENIS','CDD'],
    array['BLUKER','Yolaine','STPAUL','CDI'],
    array['MESSINE','Annie','STPAUL','CDI'],
    array['MURAT','Carinne','STPIERRE','CDI'],
    array['AGATHE','Elisa','STPIERRE','CDD'],
    array['ZITTE','Maeva','STPIERRE','TEMPS_PARTIEL'],
    array['HODGI','Laurine','STLOUIS','CDD'],
    array['CHAMBAUD','Lena','STLOUIS','TEMPS_PARTIEL'],
    array['HOARAU','Zoe','ONLINE','TEMPS_PARTIEL']
  ];
  person text[];
  account uuid;
begin
  foreach person slice 1 in array people loop
    account := gen_random_uuid();
    insert into auth.users (id, email)
      values (account, account || '@staff.oummi.invalid');
    insert into public.employees (auth_user_id, last_name, first_name, display_name,
      boutique_id, contract_type_id, pin_hash, weekly_contract_hours)
    values (account, person[1], person[2], person[2],
      (select id from public.boutiques where code = person[3]),
      (select id from public.contract_types where code = person[4]),
      extensions.crypt('5' || lpad((random() * 998 + 1)::int::text, 3, '0'),
                       extensions.gen_salt('bf')),
      35);
    insert into public.user_roles (user_id, role, boutique_id)
      values (account, 'employee', null);
  end loop;
end $$;

-- Un peu de trafic, pour que les compteurs ne partent pas de zéro.
insert into public.audit_log (actor_id, action, entity)
  values ('eeeeeeee-0000-4000-8000-00000000000a', 'employee.created', 'employees');
insert into public.domain_events (type) values ('pointage.clock_recorded');
insert into public.notifications (recipient_user_id, type, title, body)
  values ('eeeeeeee-0000-4000-8000-00000000000a', 'demo.hello', 'Bonjour', 'corps');
