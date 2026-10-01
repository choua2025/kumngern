#!/usr/bin/env bash
#
# Server-side health check for cron (every 15 minutes). The external uptime monitor sees
# "is the site up?"; this script sees what it cannot: disk, stale backups, unhealthy containers.
#
#   */15 * * * * /opt/income-expenses/production/check.sh
#
# Problems → written to syslog (`journalctl -t income-expenses`) and exit code 1.
# All good → if HEARTBEAT_URL is set in .env, it is pinged. Point it at a "heartbeat" /
# dead-man's-switch check (Better Stack, healthchecks.io, ...): when the pings STOP —
# a problem here, cron not running, or the whole server down — you get an alert.

# No -e on purpose: collect EVERY problem instead of stopping at the first one.
set -Euo pipefail

cd "$(dirname "$0")" || exit 1
COMPOSE=(docker compose -f docker-compose.prod.yml)
DISK_LIMIT_PERCENT="${DISK_LIMIT_PERCENT:-85}"
BACKUP_MAX_AGE_HOURS="${BACKUP_MAX_AGE_HOURS:-26}"   # nightly backup + slack

PROJECT="$(grep -E '^COMPOSE_PROJECT_NAME=' .env | cut -d= -f2-)"
HEARTBEAT_URL="$(grep -E '^HEARTBEAT_URL=' .env | cut -d= -f2- || true)"
problems=()

# 1. Disk: PostgreSQL stops accepting writes when the disk is full.
used="$(df --output=pcent / | tail -n1 | tr -dc '0-9')"
[ "$used" -lt "$DISK_LIMIT_PERCENT" ] || problems+=("disk ${used}% used (limit ${DISK_LIMIT_PERCENT}%)")

# 2. Backups: the newest database dump must be recent.
newest="$(find backups -name 'db-*.sql.gz' -mmin -$((BACKUP_MAX_AGE_HOURS * 60)) 2>/dev/null | head -n1)"
[ -n "$newest" ] || problems+=("no database backup newer than ${BACKUP_MAX_AGE_HOURS}h")

# 3. Containers: every long-running service must be running (and healthy if it has a check).
for service in db api web; do
  container="$("${COMPOSE[@]}" ps -q "$service" 2>/dev/null)"
  if [ -z "$container" ]; then
    problems+=("$service is not running")
    continue
  fi
  state="$(docker inspect -f '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}}' "$container")"
  case "$state" in
    'running healthy' | 'running ') ;;
    *) problems+=("$service is '$state'") ;;
  esac
done

if [ "${#problems[@]}" -gt 0 ]; then
  for problem in "${problems[@]}"; do
    echo "[$PROJECT] $problem" >&2
    logger -t income-expenses -p user.err "[$PROJECT] $problem" 2>/dev/null || true
  done
  exit 1
fi

if [ -n "$HEARTBEAT_URL" ]; then
  curl -fsS -m 10 --retry 3 -o /dev/null "$HEARTBEAT_URL" || echo "heartbeat ping failed" >&2
fi
echo "[$PROJECT] ok (disk ${used}%, backup within ${BACKUP_MAX_AGE_HOURS}h)"
