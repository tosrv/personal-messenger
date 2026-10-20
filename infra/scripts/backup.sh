#!/usr/bin/env sh
# Dump the production database to ./backups (gzip, timestamped) and keep 14 days.
# Usage (from repo root): sh infra/scripts/backup.sh
# Cron (daily 03:15): 15 3 * * * cd /opt/personal-messenger && sh infra/scripts/backup.sh >> backups/backup.log 2>&1
set -eu

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
COMPOSE="${COMPOSE:-docker compose -f infra/compose.prod.yaml --env-file .env}"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
umask 077

file="$BACKUP_DIR/messenger-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"
tmp="$file.partial"
# --clean/--if-exists make the dump restorable over an existing database.
$COMPOSE exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --clean --if-exists' | gzip > "$tmp"
gzip -t "$tmp"   # refuse to keep a truncated archive
mv "$tmp" "$file"
echo "$(date -u +%FT%TZ) backup written: $file ($(du -h "$file" | cut -f1))"

find "$BACKUP_DIR" -name 'messenger-*.sql.gz' -mtime +"$RETENTION_DAYS" -delete
