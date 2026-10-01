#!/usr/bin/env bash
#
# Backup the database (and uploaded files) of this environment.
#
#   ./backup.sh                 # nightly (cron): backups/db-20260930-020000.sql.gz
#   ./backup.sh pre-deploy-abc  # labelled, e.g. by deploy.sh before a migration
#
# Keeps BACKUP_RETENTION_DAYS (default 14) days of backups, then deletes older files.
# Restore: ./restore.sh (see deploy/README.md). A backup is only real once a restore was tested.

set -Eeuo pipefail

LABEL="${1:-}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

cd "$(dirname "$0")"
COMPOSE=(docker compose -f docker-compose.prod.yml)
mkdir -p backups
chmod 700 backups

STAMP="$(date -u +%Y%m%d-%H%M%S)${LABEL:+-$LABEL}"
DB_FILE="backups/db-${STAMP}.sql.gz"
UPLOADS_FILE="backups/uploads-${STAMP}.tar.gz"
# Never leave a half-written dump behind that could be mistaken for a good backup.
trap 'rm -f "$DB_FILE.partial" "$UPLOADS_FILE.partial"' EXIT

# pg_dump runs INSIDE the db container with its own credentials (no password on the host
# command line). pipefail makes a failing pg_dump fail the script, not produce an empty file.
# shellcheck disable=SC2016 # $POSTGRES_* must expand inside the container, not on the host
"${COMPOSE[@]}" exec -T db sh -c 'pg_dump --no-owner --clean --if-exists -U "$POSTGRES_USER" "$POSTGRES_DB"' \
  | gzip -9 > "$DB_FILE.partial"
gzip -t "$DB_FILE.partial"
mv "$DB_FILE.partial" "$DB_FILE"
echo "database → $DB_FILE ($(du -h "$DB_FILE" | cut -f1))"

# Uploaded attachments live in a Docker volume, not in PostgreSQL.
PROJECT="$(grep -E '^COMPOSE_PROJECT_NAME=' .env | cut -d= -f2-)"
if docker volume inspect "${PROJECT}_uploads" > /dev/null 2>&1; then
  # The archive comes out on stdout instead of through a bind mount (no host-path quirks),
  # and gzip -t proves a real archive arrived: a silent tar failure must not look like a backup.
  docker run --rm -v "${PROJECT}_uploads:/data:ro" alpine tar czf - -C /data . > "$UPLOADS_FILE.partial"
  gzip -t "$UPLOADS_FILE.partial"
  mv "$UPLOADS_FILE.partial" "$UPLOADS_FILE"
  echo "uploads  → $UPLOADS_FILE ($(du -h "$UPLOADS_FILE" | cut -f1))"
fi

find backups -name '*.gz' -mtime +"$RETENTION_DAYS" -print -delete | sed 's/^/deleted old backup: /'
