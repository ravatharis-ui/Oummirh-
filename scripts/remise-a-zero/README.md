# Remise à zéro avant la mise en boutique

Ces scripts effacent les données d'essai pour ouvrir l'application aux collaboratrices sur une
base propre. **Tout se fait depuis le navigateur**, dans l'éditeur SQL de Supabase — rien à
installer.

> Ce sont les seules suppressions de données de tout le projet. Elles vivent ici, hors des
> migrations, parce qu'une migration se rejoue : une suppression qui se rejoue effacerait un jour
> de vraies données.

## Avant de commencer

**Faites une sauvegarde.** Dashboard Supabase → **Database** → **Backups**. C'est un clic, et
c'est la seule chose qui rattrape une erreur ici.

## La marche à suivre

### 1. Regarder ce qu'il y a

Dashboard → **SQL Editor** → **New query** → collez `00-inventaire.sql` → **Run**.

Il ne modifie rien. Il affiche combien de pointages, de congés, de journées planifiées existent
aujourd'hui. Gardez cet écran sous les yeux : c'est votre point de comparaison.

### 2. Effacer l'activité d'essai

Collez `01-activite.sql` dans une nouvelle requête → **Run**.

Ce qui part : pointages, photos, alertes, compteurs d'heures, congés, remplacements, échanges,
documents, notifications.

Ce qui reste : **les fiches des collaboratrices avec leurs codes PIN**, **le planning et les
semaines types**, et tous vos réglages — points de vente, types de contrat, jours fériés, règle
d'acquisition.

### 3. Effacer les fichiers

Le SQL ne sait pas supprimer un fichier. Dashboard → **Storage** :

- espace **selfies** : tout sélectionner, supprimer ;
- espace **documents** : tout sélectionner, supprimer.

Sans cette étape, les photos resteraient stockées sans que rien ne les référence — donc sans que
rien ne puisse plus les supprimer.

### 4. Relancer l'inventaire

Rejouez `00-inventaire.sql`. Tout doit être à zéro sauf les collaboratrices, les journées
planifiées et les semaines types.

### 5. Repartir

- **Nouveaux codes PIN** : sur `/admin/collaboratrices`, bouton **Réinitialiser le code** pour
  chacune. Le code s'affiche une seule fois — notez-le et donnez-le en main propre.
- **Vérifiez le planning** de la première semaine.
- **Les congés repartent de zéro.** L'acquisition des mois passés n'est pas rejouée : la tâche de
  nuit crédite 2,5 jours par mois à partir de maintenant. Si une collaboratrice arrive avec un
  solde acquis ailleurs, saisissez-le avec **Ajuster le solde** — la ligne portera votre motif, et
  on saura dans six mois d'où venait ce chiffre.

## Et si les fiches sont des fiches de test ?

`02-collaboratrices-de-test.sql` les supprime. **Lisez son en-tête avant de vous en servir** :
supprimer une fiche supprime aussi **son planning et ses semaines types**. On ne peut pas garder
le planning de quelqu'un qu'on supprime.

Dans la plupart des cas, ce script est inutile : corrigez les prénoms depuis l'espace direction et
réinitialisez les codes PIN. Vous obtenez une base propre sans rien perdre.
