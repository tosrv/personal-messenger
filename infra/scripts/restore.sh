#!/usr/bin/env sh
# Restore a backup produced by backup.sh into the production database.
# Usage (from repo root): sh infra/scripts/restore.sh backups/messenger-XXXX.sql.gz
# WARNING: run against an empty database, or drop/recreate it first.
set -eu

file="${1:?usage: restore.sh <backup.sql.gz>}"
COMPOSE="docker compose -f infra/compose.prod.yaml --env-file .env"

gunzip -c "$file" | $COMPOSE exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
echo "restored: $file"
