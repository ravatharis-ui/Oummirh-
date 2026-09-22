# Module `pointage`

La pointeuse : arrivée, pause, retour de pause, départ.

## Rôle

- **Collaboratrice** : un écran, un gros bouton, qui dit ce qu'il y a à faire maintenant. Selfie
  au moment de l'arrivée, confirmation plein écran avec **l'heure renvoyée par le serveur**.
- **Direction** : tableau de présence en temps réel, historique filtrable, correction motivée.

## Règles qui ne se négocient pas

1. **L'heure vient de `now()`, côté Postgres.** Aucune heure n'est jamais acceptée du client.
   Un téléphone dont l'horloge avance de vingt minutes ne rend personne ponctuelle.
2. **Rien n'est jamais modifié.** Une correction de la direction est une **nouvelle ligne**,
   motivée et signée. Les vues consolidées montrent le dernier mot ; la table garde tout.
3. **Le navigateur n'écrit pas dans `time_clocks`.** Aucune politique RLS d'insert n'existe,
   pour personne. Tout passe par `clock_event` ou `admin_correct_time_clock`.
4. **Pas de pointage différé.** Hors réseau, l'écran le dit et invite à prévenir la direction.
   Enregistrer un pointage « pour tout à l'heure » reviendrait à accepter une heure du client.

## Tables et vues

| Objet                   | Rôle                                                                |
| ----------------------- | ------------------------------------------------------------------- |
| `time_clocks`           | Le registre. Une ligne par pointage, jamais modifiée.               |
| `pointage_alerts`       | Trace des alertes envoyées, pour n'alerter qu'une fois par journée. |
| `effective_time_clocks` | Vue : la dernière version de chaque pointage (correction comprise). |
| `daily_worked_time`     | Vue : temps travaillé par journée, pause déduite.                   |

`local_date` est la **journée de travail à La Réunion**. Un départ pointé après minuit reste
rattaché à la journée qui s'était ouverte — mais une journée laissée ouverte plus de vingt-quatre
heures n'absorbe pas l'arrivée du lendemain.

## Selfies

Bucket privé `selfies`, chemin `<employee_id>/<uuid>.jpg`. La photo est prise par
`getUserMedia` (caméra frontale) — **jamais par un `<input type="file">`**, qui ouvrirait la
galerie. Elle est réduite à 720 px et compressée à 0,7 dans le navigateur avant d'être envoyée.

- Un chemin doit exister dans le bucket, être dans **son** dossier, et n'avoir jamais servi
  (index unique `time_clocks_photo_once`).
- Aucune biométrie : rien n'est mesuré, comparé ni analysé.
- Rétention `settings.selfie_retention_days` (60 jours par défaut), purgée par
  `/api/cron/selfies`. Le pointage survit à la purge de sa photo.

## Événements

**Émis**

- `pointage.clock_recorded` — `{ employee_id, event_type, local_date, delta_minutes, planned_status }`
- `pointage.late` — une arrivée prévue jamais pointée, passé la tolérance
- `pointage.missing_clock_out` — une journée restée ouverte une heure après l'heure de fin

**Écoutés** : `pointage.late` et `pointage.missing_clock_out`, notifiés à la direction — jamais à
la collaboratrice. Dire à quelqu'un qu'il est en retard est une conversation, pas une notification.

Un jour d'école, de repos, de congé ou de maladie ne déclenche **aucune** alerte : il n'y avait
rien à pointer.

## Tâches planifiées

| Route                | Cadence           | Rôle                            |
| -------------------- | ----------------- | ------------------------------- |
| `/api/cron/pointage` | toutes les 10 min | Retards et départs non pointés. |
| `/api/cron/selfies`  | une fois par nuit | Purge des selfies expirés.      |

La fenêtre horaire (07 h – 20 h par défaut, `settings.clock_check_window`) est appliquée par
`pointage_run_checks`, pas par le cron : changer la cadence ne change pas ce qui est un retard.

## Écrans

| Route                        | Espace         |
| ---------------------------- | -------------- |
| `/pointer`                   | Collaboratrice |
| `/admin/pointage`            | Direction      |
| `/admin/pointage/historique` | Direction      |
