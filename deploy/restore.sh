#!/usr/bin/env bash
#
# Restore this environment from files made by backup.sh.
#
#   ./restore.sh backups/db-20261001-020000.sql.gz                                  # dry run
#   ./restore.sh backups/db-20261001-020000.sql.gz backups/uploads-20261001-020000.tar.gz --yes
#
# What it does (only with --yes):
#   1. checks the files are readable gzip archives
#   2. takes a SAFETY backup of the current state ("pre-restore") — a restore can be undone
#   3. stops api + web, so nothing writes while the data is replaced (the cron job included)
#   4. replays the SQL dump in ONE transaction: it either fully succeeds or changes nothing
#   5. replaces the uploads volume with the archive (if one was given)
#   6. starts api + web again and waits until the api container is healthy
#
# Exit code: 0 = restored and healthy, 1 = failed (the safety backup is listed in the output).

set -Eeuo pipefail

DB_FILE=""
UPLOADS_FILE=""
CONFIRMED=0
for arg in "$@"; do
  case "$arg" in
    --yes) CONFIRMED=1 ;;
    *.sql.gz) DB_FILE="$arg" ;;
    *.tar.gz) UPLOADS_FILE="$arg" ;;
    *) echo "unknown argument: $arg" >&2; exit 1 ;;
  esac
done

cd "$(dirname "$0")"
COMPOSE=(docker compose -f docker-compose.prod.yml)
HEALTH_ATTEMPTS="${HEALTH_ATTEMPTS:-24}"

log() { printf '\n[%s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

[ -n "$DB_FILE" ] || die "usage: $0 <db-*.sql.gz> [uploads-*.tar.gz] [--yes]"
[ -f .env ] || die ".env not found in $(pwd)"
for file in "$DB_FILE" ${UPLOADS_FILE:+"$UPLOADS_FILE"}; do
  [ -f "$file" ] || die "file not found: $file"
  gzip -t "$file" || die "not a valid gzip file: $file"
done

PROJECT="$(grep -E '^COMPOSE_PROJECT_NAME=' .env | cut -d= -f2-)"
[ -n "$PROJECT" ] || die "COMPOSE_PROJECT_NAME missing in .env"

echo "Environment : $PROJECT"
echo "Database    : $DB_FILE ($(du -h "$DB_FILE" | cut -f1))"
echo "Uploads     : ${UPLOADS_FILE:-(not restored — current files are kept)}"
if [ "$CONFIRMED" != 1 ]; then
  echo
  echo "Dry run. This REPLACES all data of '$PROJECT'. Add --yes to continue."
  exit 1
fi

# --- 1. safety backup -----------------------------------------------------------------
log "Safety backup of the current state"
"${COMPOSE[@]}" up -d --wait db
./backup.sh pre-restore

# Whatever happens next, try to bring the app back up.
restart_app() {
  log "Starting api + web"
  "${COMPOSE[@]}" up -d --no-deps api web
}
trap 'echo "Restore FAILED — the pre-restore backup above can undo partial changes." >&2; restart_app' ERR

# --- 2. stop writers ------------------------------------------------------------------
log "Stopping api + web"
"${COMPOSE[@]}" stop api web

# --- 3. database ----------------------------------------------------------------------
# The dump was made with --clean --if-exists (drops, then recreates every object).
# --single-transaction + ON_ERROR_STOP: the first error rolls EVERYTHING back.
log "Restoring the database"
# shellcheck disable=SC2016 # $POSTGRES_* must expand inside the container, not on the host
gunzip -c "$DB_FILE" | "${COMPOSE[@]}" exec -T db sh -c \
  'psql --quiet --single-transaction -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" > /dev/null'

# --- 4. uploads -----------------------------------------------------------------------
if [ -n "$UPLOADS_FILE" ]; then
  log "Restoring uploaded files"
  # Fed through stdin (-i), same reason as in backup.sh: no bind mount of a host path.
  docker run --rm -i -v "${PROJECT}_uploads:/data" alpine \
    sh -c 'find /data -mindepth 1 -delete && tar xzf - -C /data' < "$UPLOADS_FILE"
fi

# --- 5. start + verify ----------------------------------------------------------------
trap - ERR
restart_app
log "Waiting for the api to become healthy"
container="$("${COMPOSE[@]}" ps -q api)"
for ((attempt = 1; attempt <= HEALTH_ATTEMPTS; attempt++)); do
  status="$(docker inspect -f '{{.State.Health.Status}}' "$container" 2>/dev/null || echo unknown)"
  echo "  ${attempt}/${HEALTH_ATTEMPTS}: $status"
  [ "$status" = healthy ] && break
  [ "$attempt" = "$HEALTH_ATTEMPTS" ] && die "api did not become healthy — check: docker compose logs api"
  sleep 5
done

log "Row counts after restore"
# shellcheck disable=SC2016
"${COMPOSE[@]}" exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
  SELECT (SELECT count(*) FROM users) AS users,
         (SELECT count(*) FROM wallets) AS wallets,
         (SELECT count(*) FROM transactions) AS transactions,
         (SELECT count(*) FROM attachments) AS attachments;"'
log "Restore complete"
