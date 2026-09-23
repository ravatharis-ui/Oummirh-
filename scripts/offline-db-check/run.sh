#!/usr/bin/env bash
# Runs the migrations and the pgTAP suite against a throwaway local PostgreSQL,
# without Docker, without Supabase and without the pgtap extension.
#
#   ./scripts/offline-db-check/run.sh
#
# This is a pre-flight check for developers: it catches SQL that does not parse,
# migrations that do not apply, policies that let the wrong row through, and a
# plan() count that no longer matches the assertions. It is NOT a replacement for
# `supabase test db --linked`, which runs real pgTAP against the real project.
#
# Requires PostgreSQL 16 server binaries (initdb, pg_ctl, psql).
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
PGPORT="${PGPORT:-55432}"
PGDATA_DIR="${PGDATA_DIR:-/var/lib/postgresql/offline-check}"
SOCKET_DIR="$(dirname "$PGDATA_DIR")"
DB_NAME="offline_check_$$"

[ -x "$PGBIN/initdb" ] || { echo "PostgreSQL 16 introuvable dans $PGBIN (PGBIN=... pour le changer)." >&2; exit 1; }

# The server refuses to run as root, so everything happens as the postgres user.
as_pg() { if [ "$(id -u)" = "0" ]; then su postgres -c "$1"; else bash -c "$1"; fi; }

if [ ! -d "$PGDATA_DIR" ]; then
  echo "→ Création du cluster de test"
  mkdir -p "$SOCKET_DIR"
  [ "$(id -u)" = "0" ] && chown postgres:postgres "$SOCKET_DIR"
  as_pg "$PGBIN/initdb -D $PGDATA_DIR -U postgres --auth=trust -E UTF8 --locale=C" >/dev/null
fi

as_pg "$PGBIN/pg_ctl -D $PGDATA_DIR -l $SOCKET_DIR/offline-check.log -o '-p $PGPORT -k $SOCKET_DIR' -w start" >/dev/null 2>&1 || true

PSQL="psql -h $SOCKET_DIR -p $PGPORT -U postgres -v ON_ERROR_STOP=1 -q"

# A postmaster left over from a deleted cluster answers on the socket but serves
# nothing. Fail loudly here rather than a hundred confusing lines later.
if ! $PSQL -c "select 1" >/dev/null 2>&1; then
  echo "✗ Le serveur ne répond pas sur $SOCKET_DIR:$PGPORT." >&2
  echo "  Un ancien processus tourne peut-être encore : pkill -9 -u postgres postgres" >&2
  echo "  puis supprimez $PGDATA_DIR et relancez." >&2
  exit 1
fi
cleanup() {
  $PSQL -c "drop database if exists $DB_NAME;" >/dev/null 2>&1 || true
  $PSQL -c "drop database if exists replay_check_$$;" >/dev/null 2>&1 || true
}
trap cleanup EXIT

$PSQL -c "create database $DB_NAME;" >/dev/null

echo "→ Objets fournis par Supabase (rôles, schéma auth, auth.uid)"
$PSQL -d "$DB_NAME" -f "$HERE/00-supabase-bootstrap.sql" >/dev/null

echo "→ Migrations"
for file in "$ROOT"/supabase/migrations/*.sql; do
  $PSQL -d "$DB_NAME" -f "$file" 2>&1 | grep -v 'wal_level\|^HINT' || true
  echo "   appliquée : $(basename "$file")"
done

# Une migration de schéma échoue forcément au rejeu (« relation existe déjà ») et
# Supabase ne la rejoue jamais. Ce qui doit tenir, c'est qu'un rejeu manuel depuis
# l'éditeur SQL — que le guide de déploiement autorise — ne duplique aucune donnée.
#
# Le rejeu se fait sur une base **à part**, et c'est important : un fichier qui
# s'arrête sur « relation existe déjà » n'exécute pas ce qui suit, si bien qu'une
# fonction redéfinie par une migration plus récente peut se retrouver rétablie
# dans sa version d'avant. Rejouer sur la base de test revenait donc à éprouver
# un état que le projet réel n'aura jamais — et c'est exactement ce qui est
# arrivé : un test a échoué sur une fonction silencieusement revenue en arrière.
echo "→ Rejeu : les données de référence ne doivent pas se dupliquer"
REPLAY_DB="replay_check_$$"
$PSQL -c "create database $REPLAY_DB;" >/dev/null
$PSQL -d "$REPLAY_DB" -f "$HERE/00-supabase-bootstrap.sql" >/dev/null

REF_TABLES="boutiques contract_types settings public_holidays"

for file in "$ROOT"/supabase/migrations/*.sql; do
  $PSQL -d "$REPLAY_DB" -f "$file" >/dev/null 2>&1 || true
done

before=""
for t in $REF_TABLES; do
  before="$before $($PSQL -d "$REPLAY_DB" -tAc "select count(*) from public.$t")"
done

for file in "$ROOT"/supabase/migrations/*.sql; do
  $PSQL -d "$REPLAY_DB" -f "$file" >/dev/null 2>&1 || true
done

after=""
for t in $REF_TABLES; do
  after="$after $($PSQL -d "$REPLAY_DB" -tAc "select count(*) from public.$t")"
done

$PSQL -c "drop database $REPLAY_DB;" >/dev/null 2>&1 || true

if [ "$before" != "$after" ]; then
  echo "   ÉCHEC : le rejeu a modifié les données de référence ($before → $after)" >&2
  exit 1
fi
echo "   inchangées :$after"

# Les tests tournent sur une base peuplée, comme le projet réel.
echo "→ Données d'un projet déjà en service"
$PSQL -d "$DB_NAME" -f "$HERE/02-existing-data.sql" >/dev/null
echo "   $($PSQL -d "$DB_NAME" -tAc "select count(*) from public.employees") collaboratrices en place"

echo "→ Simulateur pgTAP"
$PSQL -d "$DB_NAME" -f "$HERE/01-pgtap-stub.sql" >/dev/null

echo "→ Suite de tests"
for file in "$ROOT"/supabase/tests/*.sql; do
  echo "   $(basename "$file")"
  $PSQL -d "$DB_NAME" -f "$file" 2>&1 | grep -E '^ ok - |TOUS LES|ERROR|ECHEC' | sed 's/^/     /'
done

echo "✓ Tout est passé."
