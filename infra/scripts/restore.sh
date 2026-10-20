#!/usr/bin/env sh
# Restore a backup produced by backup.sh into the production database.
# Usage (from repo root): sh infra/scripts/restore.sh backups/messenger-XXXX.sql.gz
# This REPLACES the current data. The server is stopped during the restore.
set -eu

file="${1:?usage: restore.sh <backup.sql.gz>}"
COMPOSE="${COMPOSE:-docker compose -f infra/compose.prod.yaml --env-file .env}"

gzip -t "$file"
if [ "${YES:-}" != "1" ]; then
  printf 'Replace the current database with %s? [y/N] ' "$file"
  read -r answer
  [ "$answer" = "y" ] || { echo "aborted"; exit 1; }
fi

$COMPOSE stop server
gunzip -c "$file" | $COMPOSE exec -T db sh -c 'psql -q -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
$COMPOSE start server
echo "restored: $file"
