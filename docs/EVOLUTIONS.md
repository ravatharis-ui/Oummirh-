# Ce que l'architecture permet d'ajouter, et à quel prix

Vérification demandée par `PROMPT.md` §10 : chacune de ces évolutions doit être faisable **par un
simple nouveau dossier de module**, sans toucher aux modules existants. Voici l'examen, fait à la
fin de la Phase 11, avec les points de friction réels — pas ceux qu'on aimerait ne pas avoir.

La règle de lecture : un module peut **ajouter** ses tables, ses écrans, ses événements et ses
gestionnaires. Il ne peut pas modifier ceux des autres. Une évolution qui exige de modifier un
module existant est un point de friction, même petit.

---

## 1. Rôle `manager` (responsable limité à sa boutique)

**Faisable sans toucher aux modules ? Non — et c'est le seul vrai point de friction.**

Ce qui est déjà prêt : le rôle existe dans `user_roles`, avec la contrainte qui l'attache à une
boutique ; `has_role(role, boutique_id)` existe et est testée ; `NavItem.roles` accepte déjà
`"manager"`.

Ce qui manque : **chaque politique RLS raisonne aujourd'hui en « elle » ou « la direction »**. Un
responsable de boutique est un troisième cas, et il faut l'ajouter table par table — planning,
pointage, congés, heures, remplacements. Ce sont des migrations (donc additives, donc sans risque
pour les données), mais elles touchent au socle de chaque module.

**Coût estimé** : une migration par module, plus les tests pgTAP correspondants. Pas de
réécriture, pas de rupture. C'est une journée de travail, pas une refonte.

**Ce qui aurait pu mal tourner et qui n'a pas mal tourné** : les politiques sont écrites en
`using ((select public.is_admin()))` plutôt qu'en dur. Ajouter un `or public.has_role('manager',
boutique_id)` est une ligne par politique.

## 2. Notifications push web

**Faisable sans toucher aux modules : oui.**

`notify()` est déjà le point de passage unique, et il consulte le manifeste du module émetteur
pour le titre et le corps. Un module `push` ajouterait une table d'abonnements, un gestionnaire
sur les événements qui l'intéressent, et un service worker.

**Friction** : aucune sur l'architecture. Une seule décision à prendre — l'application n'a
aujourd'hui **aucun service worker**, volontairement (voir `src/app/manifest.ts` : pas de mode
hors ligne, parce que pointer hors réseau reviendrait à accepter une heure venue du téléphone).
Le push en imposerait un. Il faudra veiller à ce qu'il ne mette rien en cache qui ressemble à un
pointage.

## 3. Messagerie interne / annonces de la direction

**Faisable sans toucher aux modules : oui.**

Un module `annonces` avec sa table, ses politiques, son écran, et `notify()` pour prévenir. Rien
à demander aux autres.

**Friction** : aucune.

## 4. Objectifs de vente par vendeuse (lien Shopify POS)

**Faisable sans toucher aux modules : oui, avec une réserve.**

Le module lirait `employees` (vue en lecture, déjà autorisée) et `daily_worked_time` pour
rapporter un chiffre d'affaires à des heures travaillées.

**Friction** : la lecture inter-modules se fait « via vues SQL documentées » (règle de
`CLAUDE.md`). `daily_worked_time` en est une, `effective_time_clocks` aussi. Mais aucune vue
n'expose aujourd'hui les congés ou le planning à un module tiers : il faudra en créer une, ce qui
est une migration du module planning — donc une modification d'un module existant, même minime.

**À prévoir** : une convention « vue publique » par module, nommée `<module>_public_*`, pour que
la prochaine lecture inter-modules n'ait rien à négocier.

## 5. Export vers le logiciel de paie / le comptable

**Faisable sans toucher aux modules : oui.**

L'export CSV des heures existe déjà (`/admin/heures/export`) et montre le chemin : une route qui
lit les vues et rend un fichier. Un module `paie` ferait la même chose en plus complet.

**Friction** : aucune sur l'architecture. La vraie difficulté est ailleurs — le format attendu
par le logiciel de paie, qu'aucune architecture ne peut deviner.

## 6. Entretiens annuels, formations, onboarding

**Faisable sans toucher aux modules : oui.**

Trois modules indépendants, ou un seul. Tables propres, écrans propres, événements propres.
`documents` peut déjà recevoir les pièces jointes : il suffit d'ajouter une catégorie — qui est un
`check` en base, donc une migration additive.

**Friction** : la catégorie de document est une contrainte `check` et non une table. Ajouter
« compte rendu d'entretien » demande une migration du module documents. C'est le même compromis
que pour `contract_types`, qui est une table **précisément** pour éviter ça. Si les catégories
doivent bouger souvent, il faudra les passer en table.

## 7. Tableau de bord multi-entreprises (autres marques du groupe)

**Faisable sans toucher aux modules : non. C'est la seule évolution structurante.**

Toute l'application suppose **une** entreprise. Il n'y a pas de colonne `company_id`, et les
politiques RLS ne raisonnent qu'en boutiques.

Deux chemins, et le choix n'est pas technique :

- **Un projet Supabase par marque.** Rien à changer dans le code. Chaque marque a ses données,
  physiquement séparées. Le tableau de bord consolidé devient une application à part qui lit
  plusieurs projets. C'est plus simple, plus sûr, et c'est ce que je recommanderais.
- **Une colonne `company_id` partout.** Une migration par table, toutes les politiques RLS à
  reprendre, et le risque permanent qu'un oubli laisse fuiter les données d'une marque vers une
  autre.

**Recommandation** : un projet par marque tant qu'il n'y a pas de besoin réel de vue consolidée
temps réel.

---

## Ce qui rend tout cela possible

Trois décisions prises tôt, qui tiennent :

1. **Les modules ne se connaissent pas.** Ils émettent des événements ; qui s'y intéresse réagit.
   Ajouter un auditeur ne demande la permission de personne.
2. **`src/app/modules.ts` est le seul point d'enregistrement.** Un module s'ajoute et se retire
   d'une ligne, et le gérant peut l'éteindre depuis l'écran des paramètres sans perdre ses données.
3. **Les écritures passent par des fonctions, pas par des tables.** Un nouveau module ne peut pas
   corrompre les données d'un autre, même en essayant : il n'a pas les droits.

## Le point de friction à traiter en priorité

Le rôle `manager`. Ce n'est pas urgent tant qu'Oummi compte cinq boutiques et une direction, mais
c'est la première chose qui deviendra pénible à sept ou huit. Le travail est connu, borné, et
purement additif — autant le faire avant que les politiques RLS aient encore grossi.
