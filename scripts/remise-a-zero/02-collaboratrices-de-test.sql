-- SUPPRESSION DES FICHES DE TEST — irréversible, et plus large qu'il n'y paraît.
--
-- ⚠ LISEZ CECI AVANT DE LANCER.
--
-- Supprimer une fiche supprime **tout ce qui lui est rattaché**, y compris son
-- planning et ses semaines types : la base est construite ainsi (`on delete
-- cascade`), et c'est voulu — une journée planifiée pour quelqu'un qui n'existe
-- plus n'a pas de sens.
--
-- Autrement dit : **on ne peut pas garder le planning de quelqu'un qu'on
-- supprime.** Si le planning déjà saisi est le vrai, il ne faut PAS lancer ce
-- script : gardez les fiches, corrigez les prénoms depuis l'espace direction, et
-- tirez un nouveau code PIN pour chacune (bouton « Réinitialiser le code » sur
-- /admin/collaboratrices). Vous obtenez le même résultat sans rien perdre.
--
-- Ce script ne sert que si les fiches sont de vraies fiches de test, dont le
-- planning n'a aucune valeur.
--
-- ---------------------------------------------------------------------------
-- COMMENT S'EN SERVIR
--
-- 1. Lancez d'abord `01-activite.sql`.
-- 2. Remplacez la liste ci-dessous par les prénoms **exacts** à supprimer, tels
--    qu'ils apparaissent dans /admin/collaboratrices.
-- 3. Lancez le bloc « VÉRIFICATION » seul, et lisez ce qu'il affiche.
-- 4. Si et seulement si la liste est la bonne, lancez le bloc « SUPPRESSION ».
--
-- Il n'y a pas de liste par défaut, et c'est délibéré : un script qui
-- supprimerait tout le monde si on oublie de le modifier est un piège.
-- ---------------------------------------------------------------------------

-- ============================== VÉRIFICATION ===============================
-- Ne supprime rien. Affiche qui serait supprimé, et ce que cela emporterait.

with cibles as (
  select id, display_name, auth_user_id
    from public.employees
   where display_name in ('REMPLACEZ_MOI', 'PAR_LES_PRENOMS')
)
select c.display_name                                                as collaboratrice,
       (select count(*) from public.planning_entries p where p.employee_id = c.id)
                                                                     as journees_planifiees,
       (select count(*) from public.planning_templates t where t.employee_id = c.id)
                                                                     as semaines_types,
       (select count(*) from public.time_clocks tc where tc.employee_id = c.id)
                                                                     as pointages
  from cibles c
 order by c.display_name;

-- ============================== SUPPRESSION ================================
-- Décommentez ce bloc (retirez les /* et */) seulement après avoir lu la
-- vérification ci-dessus.

/*
begin;

-- Les comptes de connexion sont notés avant, parce que la fiche les référence :
-- une fois la fiche partie, on ne saurait plus lesquels supprimer.
create temporary table comptes_a_supprimer on commit drop as
select auth_user_id
  from public.employees
 where display_name in ('REMPLACEZ_MOI', 'PAR_LES_PRENOMS')
   and auth_user_id is not null;

-- La fiche part, et avec elle son planning, ses pointages, ses compteurs, ses
-- demandes et ses documents.
delete from public.employees
 where display_name in ('REMPLACEZ_MOI', 'PAR_LES_PRENOMS');

-- Puis le compte de connexion, qui emporte son rôle et ses notifications.
delete from auth.users
 where id in (select auth_user_id from comptes_a_supprimer);

commit;
*/

-- ⚠ Pensez ensuite à vider l'espace « selfies » dans Dashboard → Storage :
--   les fichiers ne partent pas avec les lignes.
