# Mettre Oummi RH en ligne

Guide pour une personne **non développeuse**. Tout se fait depuis le navigateur : rien à installer
sur votre ordinateur, aucune ligne de commande.

Trois services, chacun avec un rôle :

| Service      | Rôle                                                  | Compte nécessaire |
| ------------ | ----------------------------------------------------- | ----------------- |
| **GitHub**   | garde le code et applique les mises à jour de la base | déjà créé         |
| **Supabase** | la base de données, les comptes et les fichiers       | déjà créé         |
| **Vercel**   | héberge l'application que vos collaboratrices ouvrent | à créer, gratuit  |

---

## Étape 1 — Récupérer vos informations Supabase

Ouvrez le tableau de bord de votre projet Supabase et notez quatre valeurs.

1. `Project Settings` → `General` : la **Reference ID** du projet. C'est une suite de lettres,
   la même que dans l'adresse de votre projet.
2. `Project Settings` → `API` : l'**URL du projet**, la clé **`anon`** (parfois appelée
   « publishable ») et la clé **`service_role`** (parfois appelée « secret »).
3. `Project Settings` → `Database` : le **mot de passe de la base**. Si vous ne l'avez plus,
   le bouton de réinitialisation en crée un nouveau, à noter immédiatement.

⚠️ La clé `service_role` et le mot de passe de la base donnent un accès total. Ils se collent
uniquement dans les écrans décrits ci-dessous. Jamais dans un message, un email ou un ticket.

---

## Étape 2 — Donner ses accès à GitHub

GitHub va créer et mettre à jour les tables à votre place.

### ⚠️ Ne pas confondre les trois identifiants Supabase

Ils se ressemblent et servent à des choses totalement différentes.

| Identifiant                            | Où le trouver                                                                                       | À quoi il sert                                        | Il commence par            |
| -------------------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | -------------------------- |
| **Jeton d'accès personnel**            | votre **compte**, pas le projet : avatar en haut à droite → `Account Preferences` → `Access Tokens` | piloter le projet depuis GitHub                       | `sbp_`                     |
| **Clé `anon`** (ou « publishable »)    | le **projet** : `Project Settings` → `API`                                                          | le navigateur parle à la base, protections appliquées | `eyJ` ou `sb_publishable_` |
| **Clé `service_role`** (ou « secret ») | le **projet** : `Project Settings` → `API`                                                          | le serveur, sans aucune protection                    | `eyJ` ou `sb_secret_`      |

Le jeton personnel va dans **GitHub** uniquement, jamais dans Vercel.
Les deux clés du projet vont dans **Vercel** (étape 4) et, à partir de l'étape 6, également dans
GitHub : c'est GitHub qui créera vos comptes pour vous.

### Créer les secrets

1. Créez le jeton personnel : avatar Supabase en haut à droite → `Account Preferences` →
   `Access Tokens` → `Generate new token`. Nommez-le « GitHub Actions ».
   **Copiez-le tout de suite**, il ne s'affiche qu'une seule fois.
2. Dans votre dépôt GitHub : `Settings` → `Secrets and variables` → `Actions` →
   `New repository secret`.
3. Créez ces trois secrets, un par un :

| Nom du secret           | Valeur à coller               | Exemple de forme        |
| ----------------------- | ----------------------------- | ----------------------- |
| `SUPABASE_ACCESS_TOKEN` | le jeton personnel du point 1 | `sbp_a1b2c3...`         |
| `SUPABASE_PROJECT_REF`  | la Reference ID du projet     | `hujjyzheggsnqtjflilw`  |
| `SUPABASE_DB_PASSWORD`  | le mot de passe de la base    | ce que vous avez choisi |

> La Reference ID est aussi lisible dans l'adresse de votre projet : dans
> `https://hujjyzheggsnqtjflilw.supabase.co`, c'est la partie avant `.supabase.co`.

Si vous collez une clé `anon` ou `service_role` dans `SUPABASE_ACCESS_TOKEN`, le workflow de
l'étape 3 échouera avec un message d'authentification refusée. Recréez simplement le secret avec
le bon jeton.

---

## Étape 3 — Créer les tables

1. Dans votre dépôt GitHub, onglet **`Actions`**.
2. Dans la colonne de gauche, cliquez sur **« Base de données »**.
3. Bouton **`Run workflow`** à droite, puis **`Run workflow`** dans le petit panneau.

Décochez « Lancer les tests de sécurité » pour ce premier passage : les tests demandent une
extension que vous installerez à l'étape 5.

Comptez une à deux minutes. Une coche verte signifie que c'est fait. En cas de croix rouge,
cliquez dessus : le message d'erreur indique lequel des trois secrets pose problème.

**Vérification** : dans Supabase, `Table Editor` doit maintenant afficher 9 tables. Ouvrez
`boutiques` : vos 5 points de vente y sont. Ouvrez `public_holidays` : 24 jours fériés,
dont le 20 décembre.

> Vous pouvez relancer ce bouton autant de fois que vous voulez. Il n'applique que ce qui manque,
> ne crée jamais de doublon et n'efface aucune donnée.

---

## Étape 4 — Mettre l'application en ligne

1. Créez un compte sur <https://vercel.com> en choisissant **« Continue with GitHub »**.
2. `Add New…` → `Project`, puis importez le dépôt **oummirh**.
3. Vercel reconnaît Next.js tout seul. Ne touchez pas aux réglages de build.
4. Dépliez **`Environment Variables`** et ajoutez ces quatre lignes :

| Nom                             | Valeur                                                                 |
| ------------------------------- | ---------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | l'URL du projet Supabase                                               |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | la clé `anon`                                                          |
| `SUPABASE_SERVICE_ROLE_KEY`     | la clé `service_role`                                                  |
| `APP_URL`                       | `https://oummirh.vercel.app` (à corriger après le premier déploiement) |

5. **Important — le type de chaque variable.** Vercel propose `Secret` ou `Config` :

| Variable                        | Type à choisir | Pourquoi                                                                                                                                               |
| ------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`      | **Config**     | les variables `NEXT_PUBLIC_` doivent être lisibles pendant la construction du site ; en `Secret` elles sont invisibles et l'application tombe en panne |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Config**     | idem. Cette clé part de toute façon dans le navigateur : la marquer secrète ne protège rien                                                            |
| `SUPABASE_SERVICE_ROLE_KEY`     | **Secret**     | ne doit jamais sortir du serveur                                                                                                                       |
| `APP_URL`                       | **Config**     | simple adresse publique                                                                                                                                |

Une variable déjà enregistrée en `Secret` ne peut pas être convertie : supprimez-la et
recréez-la en `Config`.

6. Cliquez sur **`Deploy`**, puis patientez.

Vercel vous donne une adresse du type `https://oummirh.vercel.app`. Revenez dans
`Settings` → `Environment Variables` pour corriger `APP_URL` avec l'adresse réelle, puis
redéployez depuis l'onglet `Deployments`.

**Choix de la région** : dans `Settings` → `Functions`, sélectionnez la région la plus proche de
votre projet Supabase (indiquée dans `Project Settings` → `General`). L'application répondra plus
vite à La Réunion.

À partir de maintenant, **chaque modification du code redéploie l'application toute seule**, en
une minute environ.

---

## Étape 5 — Activer les tests de sécurité

Ces tests prouvent qu'une collaboratrice ne peut pas voir les données d'une autre. Ils demandent
une extension à installer une seule fois.

1. Dans Supabase, ouvrez **`SQL Editor`** → `New query`.
2. Collez ceci et cliquez sur `Run` :

   ```sql
   create extension if not exists pgtap with schema extensions;
   ```

3. Relancez le bouton de l'étape 3 en laissant « Lancer les tests de sécurité » coché.

---

## Étape 6 — Créer la direction et les collaboratrices

1. Ajoutez cinq secrets de plus dans GitHub, au même endroit qu'à l'étape 2 :

| Nom du secret                   | Valeur                                                        |
| ------------------------------- | ------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | l'URL du projet                                               |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | la clé `anon` / publishable                                   |
| `SUPABASE_SERVICE_ROLE_KEY`     | la clé `service_role` / secret                                |
| `ADMIN_EMAIL`                   | **votre** adresse email, pour vous connecter à la direction   |
| `ADMIN_PASSWORD`                | un mot de passe d'au moins 12 caractères, que vous choisissez |

2. `Actions` → `Base de données` → `Run workflow`, en cochant
   **« Créer le compte de direction et les 10 collaboratrices »**.

Vous pouvez relancer ce bouton sans risque : une collaboratrice déjà créée est laissée
telle quelle, et aucun code en service n'est modifié.

### Obtenir les codes PIN

Les codes tirés à la création sont aléatoires et **connus de personne**, pas même du
programme qui les a créés : seule leur empreinte chiffrée est enregistrée. C'est voulu, et
c'est ce qui les rend sûrs.

Pour donner son code à chacune :

1. Connectez-vous à l'espace direction, à l'adresse `/admin/connexion`, avec l'email et le
   mot de passe de l'étape 6.
2. Ouvrez `Collaboratrices`, puis la fiche de la personne.
3. Cliquez sur **« Réinitialiser le code PIN »**. Le code apparaît une seule fois.
4. Transmettez-le de vive voix, puis passez à la suivante.

Si un code est perdu plus tard, c'est exactement la même manipulation.

---

## Étape 7 — Notifications et emails

Cette étape rend vivantes la cloche et les emails. La cloche fonctionne sans rien ajouter ;
les emails demandent un compte Resend, et la distribution automatique un webhook.

### Les secrets

Générez deux secrets au hasard. Sur un Mac ou sous Linux, dans un terminal :
`openssl rand -hex 32`. Sinon, n'importe quelle suite longue de lettres et de chiffres convient.

Ajoutez-les dans **Vercel**, `Settings` → `Environment Variables` :

| Nom                      | Type   | Valeur                                             |
| ------------------------ | ------ | -------------------------------------------------- |
| `EVENTS_DISPATCH_SECRET` | Secret | le premier secret généré                           |
| `CRON_SECRET`            | Secret | le second secret généré                            |
| `RESEND_API_KEY`         | Secret | la clé fournie par Resend, facultative             |
| `EMAIL_FROM`             | Config | par exemple `Oummi RH <rh@votredomaine.re>`        |
| `APP_URL`                | Config | l'adresse de votre site, sans barre oblique finale |

Sans `RESEND_API_KEY`, tout continue de fonctionner : les notifications arrivent dans la cloche,
et seuls les emails sont ignorés, avec un avertissement dans les journaux.

### Le webhook Supabase

C'est lui qui déclenche le traitement à l'instant où un événement est inscrit.

1. Tableau de bord Supabase → `Database` → `Webhooks` → `Create a new hook`.
2. Nom : `dispatch-events`. Table : `domain_events`. Événement : `Insert` uniquement.
3. Type : `HTTP Request`, méthode `POST`.
4. URL : `https://votre-adresse.vercel.app/api/events/dispatch`.
5. En-tête HTTP : nom `Authorization`, valeur `Bearer ` suivi de votre `EVENTS_DISPATCH_SECRET`.
6. `Create webhook`.

Une tâche planifiée Vercel repasse par ailleurs toutes les minutes pour rattraper ce qui aurait
échoué. Elle est déjà décrite dans `vercel.json`, vous n'avez rien à faire. Sur l'offre gratuite
de Vercel, les tâches planifiées sont limitées à une fois par jour : changez alors la valeur
`"* * * * *"` en `"0 3 * * *"`, le webhook restant le chemin principal.

### Vérifier

1. Connectez-vous à l'espace direction, ouvrez `Démo`.
2. Cliquez sur **« Envoyer une notification de test »**, puis sur **« Traiter la file
   maintenant »**. La cloche en haut doit afficher un point et le message apparaître.
3. Cliquez sur **« Déclencher un échec volontaire »**, puis traitez la file six fois de suite.
   Le compteur de tentatives monte, puis l'événement passe en « abandonné » avec son motif.
4. Pour vérifier le webhook, envoyez une notification de test **sans** traiter la file : elle
   doit arriver toute seule en quelques secondes.

---

## Étape 8 — Planning et pointage

Rien à installer : les tables, le bucket des selfies et les tâches planifiées arrivent avec le
code. Il suffit de relancer le bouton **« Base de données »** de l'étape 3 après le déploiement.

### Vérifier le planning

1. Espace direction → **Planning**. Vous voyez la semaine en cours, une ligne par collaboratrice.
2. Cliquez sur une case : le panneau s'ouvre. Cliquez sur **« Journée standard »**, puis
   **Enregistrer**. La case se remplit et le total de la ligne change.
3. Cliquez sur **« Copier la semaine précédente »**. Le message vous dit combien de journées ont
   été copiées — et rappelle que les congés déjà posés n'ont pas été touchés.
4. **Imprimer** ouvre un onglet prêt pour du A4 paysage.
5. Sur le téléphone d'une collaboratrice : **Planning** montre sa semaine et, en haut, les
   collègues présentes aujourd'hui dans sa boutique.

### Vérifier le pointage

1. Sur le téléphone, onglet **Pointer**. Un seul gros bouton : « Je commence ».
2. Le navigateur demande l'accès à la caméra — c'est normal, et c'est la caméra frontale
   uniquement. Autorisez, cadrez, validez.
3. L'écran de confirmation affiche **l'heure renvoyée par le serveur**, pas celle du téléphone,
   et le téléphone vibre brièvement.
4. Le bouton devient « Je pars en pause », puis « Je reprends », puis « Je termine ».
5. Espace direction → **Pointage** : la ligne se met à jour toute seule, sans recharger.
6. **Historique et corrections** → bouton **Corriger** : la correction demande un motif. Le
   pointage d'origine reste en base, la ligne porte la mention « corrigé ».

### Ce qui tourne tout seul

| Quand                       | Ce qui se passe                                   |
| --------------------------- | ------------------------------------------------- |
| Toutes les 10 min, 7 h–20 h | Alerte si une arrivée prévue n'a pas été pointée. |
| 1 h après l'heure de fin    | Alerte si le départ n'a pas été pointé.           |
| Chaque nuit                 | Suppression des selfies de plus de 60 jours.      |

Les alertes arrivent dans **votre** cloche, pas dans celle de la collaboratrice. Un jour d'école,
de repos, de congé ou de maladie ne déclenche jamais d'alerte.

### Si le journal du workflow affiche un avertissement « bucket selfies »

Cela veut dire que la base n'a pas eu le droit de créer le bucket toute seule. Dans le tableau de
bord Supabase : `Storage` → **New bucket** → nom `selfies`, laissez **Public** décoché →
**Create**. Tout le reste est déjà en place.

---

## Étape 9 — Congés et heures

Comme à l'étape 8 : rien à installer, relancez le bouton **« Base de données »** après le
déploiement.

### Vérifier les congés

1. Sur le téléphone, onglet **Congés**. Le solde s'affiche, avec la période (juin → mai).
2. Choisissez des dates : l'écran annonce **combien de jours seront décomptés**, et le solde
   avant / après. Les dimanches, les jours fériés et vos jours de repos ne comptent pas.
3. Envoyez. Espace direction → **Congés** : la demande apparaît, avec un avertissement si une
   collègue du même point de vente est déjà absente sur ces dates.
4. **Valider** : les jours partent du solde, et le planning se remplit tout seul en « Congé ».
5. **Annuler** un congé validé (direction seulement) : les jours reviennent, et les journées se
   libèrent dans le planning.

### Vérifier les heures

1. Le solde d'heures se remplit **tout seul**, à partir des pointages : à chaque départ pointé,
   l'écart entre le réel et le planning est enregistré.
2. Sur le téléphone, onglet **Heures** : « Mon solde d'heures », puis **« ⚡ Prendre mes heures
   supp »**. Choisissez d'arriver plus tard ou de partir plus tôt, un jour à venir, une durée.
3. Espace direction → **Heures** : la demande se valide **en un clic**. Le planning du jour se
   décale immédiatement.
4. **Export CSV** : le fichier s'ouvre directement dans Excel, colonnes séparées.

Pour tester sans attendre un vrai pointage, la direction peut créditer un solde depuis
**Heures → Ajuster** (un motif est obligatoire, et l'ajustement est tracé).

### Ce qui tourne tout seul

| Quand       | Ce qui se passe                                             |
| ----------- | ----------------------------------------------------------- |
| Chaque nuit | Acquisition mensuelle des congés (une seule fois par mois). |
| Chaque nuit | Report ou expiration au changement de période, le 1er juin. |
| Chaque nuit | Calcul des heures de la veille, en filet du calcul à chaud. |

Ces tâches peuvent tourner tous les jours sans rien fausser : elles sont écrites pour ne jamais
créditer deux fois la même chose.

### À vérifier une fois dans Vercel

L'application utilise cinq tâches planifiées. Les offres gratuites de Vercel en limitent le
nombre et la fréquence. Dans l'interface Vercel, onglet **Cron Jobs**, vérifiez qu'elles
apparaissent toutes ; si certaines manquent, dites-le moi et je regrouperai les tâches
quotidiennes en une seule.

---

## Étape 10 — Régler l'application vous-même

Espace direction → **Paramètres**. Tout ce qui s'y trouve se change sans développeur, et chaque
modification est enregistrée avec sa valeur d'avant.

| Ce que vous pouvez régler  | Effet                                                            |
| -------------------------- | ---------------------------------------------------------------- |
| Nom de l'entreprise        | En tête des emails et des plannings imprimés.                    |
| Horaires par défaut        | Proposés à la création d'une fiche ou d'une journée de planning. |
| Règle d'acquisition        | 30 jours/an (ouvrables) ou 25 jours/an (ouvrés).                 |
| Tolérance de retard        | En dessous, l'arrivée est « à l'heure » et n'alerte personne.    |
| Fenêtre des alertes        | Les alertes ne partent qu'entre ces deux heures.                 |
| Délai de départ non pointé | Temps avant que la direction soit prévenue.                      |
| Selfie à l'arrivée         | Demandé ou non.                                                  |
| Conservation des selfies   | Au-delà, les photos sont supprimées chaque nuit.                 |
| Pas des récupérations      | Les tranches proposées pour « Prendre mes heures supp ».         |
| Points de vente            | Ajouter, renommer, fermer, rouvrir.                              |
| Types de contrat           | Allonger la liste proposée à la création d'une collaboratrice.   |
| Jours fériés               | Ajouter les dates de l'année suivante.                           |
| Modules                    | Allumer ou éteindre une partie de l'application.                 |

### Trois choses à savoir

**Fermer n'est pas supprimer.** Un point de vente fermé garde tout son historique et peut être
rouvert. L'application refuse de le fermer s'il reste des collaboratrices rattachées : rattachez-les
ailleurs d'abord.

**Éteindre un module ne perd rien.** Il disparaît des menus, ses données restent, et tout revient
tel quel si vous le rallumez.

**Les jours fériés se tiennent à jour ici.** Pâques et l'Ascension changent de date chaque année.
Deux années sont déjà enregistrées ; pensez à ajouter la suivante, sinon ces journées seront
décomptées des congés comme des jours ordinaires. L'écran vous prévient s'il n'en reste aucun à
venir.

---

## Étape 11 — Remplacements et échanges

Toujours pareil : relancez le bouton **« Base de données »** après le déploiement.

### Vérifier un remplacement

1. Espace direction → **Remplacements** → **Remplacement direct**.
2. Étape 1 : le point de vente qui a besoin de renfort, le jour, les horaires.
3. Étape 2 : la liste des collaboratrices, avec pour chacune ce qu'elle fait ce jour-là. Celles
   qui sont en congé apparaissent mais ne sont pas sélectionnables.
4. Étape 3 : vous relisez, vous confirmez. Elle reçoit une notification et un email.
5. Regardez son planning : la journée a changé de point de vente.
6. **Annulez le remplacement** : son planning d'origine revient exactement comme il était.

### Vérifier un échange

Il faut deux téléphones, ou deux navigateurs.

1. Collaboratrice A → **Échanges** : elle choisit une de ses journées, une collègue, et la
   journée qu'elle veut récupérer. Elle envoie.
2. Collaboratrice B → **Échanges** : la demande s'affiche en haut, en évidence. Elle accepte.
3. Espace direction → **Échanges** : l'échange attend votre validation. Vous validez.
4. Les deux plannings ont changé : A travaille la journée de B, et B celle de A.

Si B refuse, rien ne bouge et A est prévenue. Tant que vous n'avez pas validé, A peut retirer sa
demande. Une fois validé, l'échange ne s'annule plus — deux personnes ont organisé leur semaine
autour.

---

## Étape 12 — Le coffre-fort

Relancez le bouton **« Base de données »** après le déploiement.

### Déposer les fiches de paie du mois

1. Espace direction → **Documents** → **Déposer les fiches de paie du mois**.
2. Choisissez le mois, puis sélectionnez **tous les PDF d'un coup**.
3. L'application associe chaque fichier à une collaboratrice d'après son nom. Ce qu'elle n'a pas
   su reconnaître reste à associer à la main — et le bouton d'envoi reste bloqué tant qu'il en
   reste. C'est voulu : mieux vaut trois clics de plus qu'une fiche de paie envoyée à la mauvaise
   personne.
4. Envoyez. Chacune reçoit une notification et un email.

### Vérifier côté collaboratrice

1. Sur le téléphone, onglet **Documents** : le document apparaît, marqué **Nouveau**.
2. **Ouvrir** télécharge le PDF. Le lien vaut soixante secondes — il ne sert qu'une fois.
3. Espace direction → **Documents** : la ligne indique maintenant la date d'ouverture. Celles qui
   n'ont rien ouvert sont signalées en orange.

### Ce que personne ne peut faire

Une collaboratrice ne voit que son propre coffre. Même en connaissant l'identifiant du document
d'une collègue, il reste invisible — et le fichier, inatteignable.

### Si le journal du workflow affiche un avertissement « bucket documents »

Même manipulation que pour les selfies : `Storage` → **New bucket** → nom `documents`, laissez
**Public** décoché → **Create**.

---

## Étape 13 — Mise en production

Jusqu'ici, l'application tourne sur un projet Supabase de test et une adresse `*.vercel.app`.
Voici le passage en service réel. **Aucune étape ne demande d'installer quoi que ce soit.**

### La checklist

- [ ] **Un projet Supabase dédié aux vraies données.** Créez-le dans le tableau de bord Supabase,
      région la plus proche. Notez la référence du projet et le mot de passe de la base.
- [ ] **Les secrets GitHub pointent vers ce projet.** `Settings → Secrets and variables →
Actions` : `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`, `SUPABASE_ACCESS_TOKEN`.
- [ ] **Lancez le workflow « Base de données »**, tests cochés. Il crée toutes les tables et
      vérifie les 382 règles de sécurité sur le nouveau projet.
- [ ] **Les variables Vercel pointent vers ce projet.** `NEXT_PUBLIC_SUPABASE_URL` et
      `NEXT_PUBLIC_SUPABASE_ANON_KEY` en type **Config** (jamais Secret — sinon l'application se
      déploie sans savoir joindre la base), `SUPABASE_SERVICE_ROLE_KEY` en type Secret.
- [ ] **`CRON_SECRET` et `EVENTS_DISPATCH_SECRET`** dans Vercel, en type Secret. Générez-les
      depuis n'importe quel générateur de mot de passe, 32 caractères.
- [ ] **Le webhook Supabase** vers `/api/events/dispatch`, avec l'en-tête
      `Authorization: Bearer <EVENTS_DISPATCH_SECRET>` (étape 7).
- [ ] **Les tâches planifiées** apparaissent dans Vercel, onglet **Cron Jobs**. Il y en a cinq.
- [ ] **Les deux espaces de stockage existent et sont privés.** Supabase → **Storage** : il doit
      y avoir `selfies` et `documents`, tous les deux marqués privés. Les migrations les créent,
      mais sur un projet hébergé elles n'en ont pas toujours le droit — dans ce cas elles laissent
      passer plutôt que de tout bloquer, et c'est à vérifier à l'œil. S'ils manquent, créez-les
      avec exactement ces noms, en privé, et dites-le moi.
- [ ] **Éteignez le module « Démo »** (Paramètres → Modules) une fois la chaîne de notifications
      vérifiée. Il ne sert qu'à ça, et il n'a rien à faire sous les yeux des collaboratrices.
- [ ] **Votre nom de domaine** dans Vercel, onglet Domains. Vercel s'occupe du certificat.
- [ ] **Le domaine d'envoi Resend vérifié** (étape 7). Sans lui, les emails partent en spam ou ne
      partent pas — mais l'application fonctionne : les notifications dans l'application, elles,
      arrivent toujours.
- [ ] **Créez votre compte de direction** et les fiches des collaboratrices. Tirez chaque code PIN
      depuis `/admin/collaboratrices` : il s'affiche une fois.
- [ ] **Les jours fériés de l'année en cours et de la suivante** (Paramètres → Jours fériés).
- [ ] **Réglez ce qui doit l'être** : règle d'acquisition des congés, tolérance de retard, durée
      de conservation des photos (Paramètres).
- [ ] **Faites le tour sur un téléphone** : installer l'application, se connecter, pointer
      (photo à l'arrivée **et** au départ), voir son planning. C'est le vrai test.
- [ ] **Vérifiez la connexion après chaque déploiement.** Ouvrez `/connexion` et cliquez : si la
      page s'affiche mais qu'aucun bouton ne réagit, voir « Si une page s'affiche mais ne réagit à
      rien » plus bas. C'est le défaut le plus sournois de cette application, parce qu'elle a
      l'air d'aller bien.

### Ce qu'il ne faut pas faire

**Ne réutilisez pas les codes PIN de la V1.** Ils sont considérés comme compromis. Chaque
collaboratrice en reçoit un nouveau.

**Ne supprimez pas le projet de test tout de suite.** Gardez-le : c'est là qu'on essaiera les
prochaines évolutions sans toucher aux vraies données.

### Si une page s'affiche mais ne réagit à rien

Même cause que la page blanche, et même remède : `CSP_REPORT_ONLY=1` dans Vercel, puis
redéploiement. Dites-le moi ensuite, c'est un défaut à corriger, pas un réglage à laisser.

### Si une page devient blanche après un déploiement

Une seule cause possible : la politique de sécurité du contenu. Dans Vercel, ajoutez la variable
`CSP_REPORT_ONLY` avec la valeur `1`, redéployez — l'application refonctionne immédiatement, et on
regarde ensuite ce qui coinçait. C'est prévu pour ça.

### Mesurer la qualité depuis votre navigateur

Chrome → F12 → onglet **Lighthouse** → cochez _Mobile_, _Performance_ et _Accessibilité_ →
**Analyser**. Faites-le sur `/connexion`, connectée sur `/accueil`.

L'accessibilité est déjà vérifiée automatiquement à chaque modification du code (12 contrôles
axe-core sur les pages publiques, y compris les contrastes). Lighthouse ajoute la performance
réelle, qui dépend de votre connexion et de votre téléphone : c'est pour ça qu'elle se mesure
chez vous et pas ici.

---

## Ce qui se passe ensuite

À chaque phase terminée, le déroulé est toujours le même :

1. Le code arrive sur GitHub.
2. Vercel redéploie l'application automatiquement.
3. Si la phase ajoute des tables, vous cliquez sur le bouton de l'étape 3.
4. Vous testez sur votre téléphone, à l'adresse Vercel.

Aucune autre manipulation n'est nécessaire.

---

## En cas de problème

**La page affiche une erreur de configuration Supabase.** Une des variables de l'étape 4 est
absente ou mal copiée. Corrigez-la dans Vercel, puis redéployez.

**Le bouton « Base de données » échoue.** Ouvrez le détail dans `Actions` : le premier message
rouge nomme le secret en cause. Un jeton Supabase expiré se recrée à l'étape 2.

**L'application est en ligne mais vide.** Normal tant que les tables ne sont pas créées :
faites l'étape 3.

**Passer en production propre.** L'adresse `*.vercel.app` convient pour tester. Pour une mise en
service réelle, on branchera votre nom de domaine et on créera un second projet Supabase réservé
aux vraies données, en Phase 11.
