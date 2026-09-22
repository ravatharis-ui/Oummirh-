# Contrôle de la base hors ligne

Rejoue les migrations et la suite pgTAP sur un PostgreSQL local jetable, **sans Docker,
sans Supabase et sans l'extension pgtap**.

```bash
./scripts/offline-db-check/run.sh
```

## À quoi ça sert

Ce contrôle existe parce qu'un fichier de test SQL non exécuté est un fichier de test faux.
Il attrape, avant tout envoi :

- du SQL qui ne compile pas ;
- une migration qui ne s'applique pas, ou qui n'est pas rejouable sans doublon ;
- une politique de sécurité qui laisse passer la mauvaise ligne ;
- un `plan(n)` qui ne correspond plus au nombre d'assertions.

## Ce que ça ne remplace pas

`supabase test db --linked` reste la référence : il exécute le vrai pgTAP sur le vrai projet.
Les deux fichiers ci-dessous sont des imitations volontairement minimales.

| Fichier                     | Rôle                                                                                                               |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `00-supabase-bootstrap.sql` | recrée ce que Supabase fournit déjà : rôles `anon` / `authenticated` / `service_role`, schéma `auth`, `auth.uid()` |
| `01-pgtap-stub.sql`         | réimplémente les seules fonctions pgTAP utilisées ici : `plan`, `is`, `ok`, `throws_ok`, `lives_ok`, `finish`      |

Si un test utilise une fonction pgTAP absente du simulateur, ajoutez-la à `01-pgtap-stub.sql`.

## Prérequis

Les binaires serveur de PostgreSQL 16 (`initdb`, `pg_ctl`, `psql`). Sur Debian ou Ubuntu :
`apt-get install postgresql-16`. Utilisez `PGBIN=...` pour pointer une autre installation.
