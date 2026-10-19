#!/usr/bin/env sh
# Dump the production database to ./backups (gzip, timestamped) and keep 14 days.
# Usage (from repo root): sh infra/scripts/backup.sh
set -eu

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
COMPOSE="docker compose -f infra/compose.prod.yaml --env-file .env"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

file="$BACKUP_DIR/messenger-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"
$COMPOSE exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner' | gzip > "$file"
chmod 600 "$file"
echo "backup written: $file"

find "$BACKUP_DIR" -name 'messenger-*.sql.gz' -mtime +"$RETENTION_DAYS" -delete
