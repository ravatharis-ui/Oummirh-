# core/settings

Lecture typée de la table `settings`.

- `schemas.ts` est **pur** (testé par Vitest) : un schéma Zod par clé, les valeurs par défaut,
  et `parseSettingsRows()` qui transforme les lignes brutes en objet typé.
- Chaque clé est validée séparément : une ligne corrompue retombe sur sa valeur par défaut
  et signale le problème, sans faire tomber le reste.
- Les réglages pilotent l'affichage et les règles métier, **jamais les droits** : les droits
  sont dans la RLS. C'est pourquoi une base injoignable dégrade vers les valeurs par défaut
  au lieu de bloquer l'application.

Les valeurs par défaut doivent rester alignées sur `supabase/migrations/0002_core_reference_data.sql`.
