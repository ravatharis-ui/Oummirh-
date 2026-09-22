# Tests pgTAP

Ces tests prouvent que les politiques de sécurité (RLS) font ce qu'elles annoncent :
une collaboratrice ne lit que ses propres lignes, et n'écrit nulle part directement.

## Lancer les tests

Sur le projet Supabase distant :

```bash
supabase link --project-ref <ref-du-projet>
supabase test db --linked
```

Sur une base locale (nécessite Docker) :

```bash
npm run db:start
npm run test:db
```

## Prérequis

L'extension pgTAP doit être installée une fois sur le projet, depuis l'éditeur SQL
du tableau de bord Supabase :

```sql
create extension if not exists pgtap with schema extensions;
```

Chaque fichier de test s'exécute dans une transaction annulée à la fin : les données
de test n'existent jamais durablement, même sur un projet hébergé.
