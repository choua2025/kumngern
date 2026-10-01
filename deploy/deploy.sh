#!/usr/bin/env bash
#
# Deploy ONE app to this environment, verify it, and roll back automatically if it fails.
#
#   ./deploy.sh api <image-tag>     # backup DB → migrate → restart api → health check
#   ./deploy.sh web <image-tag>     # restart web → health check
#
# Run from the environment folder (/opt/income-expenses/<env>/) next to
# docker-compose.prod.yml and .env. Called by the CD workflow, but works by hand too.
# Exit code: 0 = deployed and healthy, 1 = failed (rolled back if possible).

set -Eeuo pipefail

SERVICE="${1:-}"
NEW_TAG="${2:-}"
HEALTH_ATTEMPTS="${HEALTH_ATTEMPTS:-10}"
HEALTH_INTERVAL="${HEALTH_INTERVAL:-5}"
# Local testing only: images already present (no registry), plain-HTTP health URL.
DEPLOY_SKIP_PULL="${DEPLOY_SKIP_PULL:-0}"
HEALTH_URL="${HEALTH_URL:-}"

cd "$(dirname "$0")"
COMPOSE=(docker compose -f docker-compose.prod.yml)

log() { printf '\n[%s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }
die() { printf '::error::%s\n' "$*" >&2; exit 1; }

# --- .env helpers (the file stays the single source of truth for image tags) ---------
env_get() { grep -E "^$1=" .env | tail -n1 | cut -d= -f2- || true; }
env_set() {
  if grep -qE "^$1=" .env; then
    sed -i "s|^$1=.*|$1=$2|" .env
  else
    printf '%s=%s\n' "$1" "$2" >> .env
  fi
}

# --- arguments ----------------------------------------------------------------------
case "$SERVICE" in
  api) TAG_VAR=API_IMAGE_TAG; IMAGES=(api migrate) ;;
  web) TAG_VAR=WEB_IMAGE_TAG; IMAGES=(web) ;;
  *) die "usage: $0 <api|web> <image-tag>" ;;
esac
[[ "$NEW_TAG" =~ ^[A-Za-z0-9._-]{1,128}$ ]] || die "invalid image tag: '$NEW_TAG'"
[ -f .env ] || die ".env not found in $(pwd)"

APP_DOMAIN="$(env_get APP_DOMAIN)"
API_DOMAIN="$(env_get API_DOMAIN)"
: "${APP_DOMAIN:?APP_DOMAIN missing in .env}" "${API_DOMAIN:?API_DOMAIN missing in .env}"

# A tag of "not-deployed" (or none) means that app has never run here.
is_deployed() { local tag; tag="$(env_get "$1")"; [ -n "$tag" ] && [ "$tag" != not-deployed ]; }

http_code() { curl -s -o /dev/null -m 5 -w '%{http_code}' "$1" || true; }

# Each deploy verifies its OWN unit, so the very first deploy works in either order:
#   api → readiness from inside the container (database reachable). The public URL is
#         checked too once web exists — the api is only reachable through web's nginx.
#   web → end to end through both nginx: /healthz, plus /api/v1/ready if the api is deployed.
check_once() {
  if [ -n "$HEALTH_URL" ]; then # local testing override
    [ "$(http_code "$HEALTH_URL")" = 200 ]
    return
  fi
  if [ "$SERVICE" = api ]; then
    "${COMPOSE[@]}" exec -T api wget -qO /dev/null http://127.0.0.1:3000/api/v1/ready 2> /dev/null || return 1
    if is_deployed WEB_IMAGE_TAG; then
      [ "$(http_code "https://$API_DOMAIN/api/v1/ready")" = 200 ] || return 1
    fi
  else
    [ "$(http_code "https://$APP_DOMAIN/healthz")" = 200 ] || return 1
    if is_deployed API_IMAGE_TAG; then
      [ "$(http_code "https://$APP_DOMAIN/api/v1/ready")" = 200 ] || return 1
    fi
  fi
}

healthy() {
  local attempt
  for ((attempt = 1; attempt <= HEALTH_ATTEMPTS; attempt++)); do
    if check_once; then
      echo "  health check ${attempt}/${HEALTH_ATTEMPTS}: ok"
      return 0
    fi
    echo "  health check ${attempt}/${HEALTH_ATTEMPTS}: not ready"
    sleep "$HEALTH_INTERVAL"
  done
  return 1
}

# --- 1. remember the running version (rollback target) ------------------------------
PREVIOUS_TAG="$(env_get "$TAG_VAR")"
log "Deploying $SERVICE: ${PREVIOUS_TAG:-<none>} → $NEW_TAG"
if [ -n "$PREVIOUS_TAG" ] && [ "$PREVIOUS_TAG" != "$NEW_TAG" ]; then
  printf '%s %s %s\n' "$(date -u +%FT%TZ)" "$SERVICE" "$PREVIOUS_TAG" >> .deploy-history
fi

# Until the container is switched (step 4), ANY failure restores the previous tag in .env,
# so a failed pull/backup/migration never leaves .env pointing at a version that isn't running.
SWITCHED=0
# shellcheck disable=SC2329 # invoked by the EXIT trap below
restore_tag_on_failure() {
  local status=$?
  if [ "$status" -ne 0 ] && [ "$SWITCHED" -eq 0 ]; then
    env_set "$TAG_VAR" "$PREVIOUS_TAG"
    echo "restored $TAG_VAR=${PREVIOUS_TAG:-<empty>} in .env"
  fi
}
trap restore_tag_on_failure EXIT

# --- 2. pull the new images before touching anything that runs ----------------------
env_set "$TAG_VAR" "$NEW_TAG"
log "Pulling ${IMAGES[*]}"
if [ "$DEPLOY_SKIP_PULL" != 1 ] && ! "${COMPOSE[@]}" --profile tools pull "${IMAGES[@]}"; then
  die "pull failed — nothing was changed"
fi

# --- 3. api only: backup, then migrate ----------------------------------------------
if [ "$SERVICE" = api ]; then
  # The database must be up before it can be backed up (fresh server: first deploy).
  "${COMPOSE[@]}" up -d --wait db

  log "Backing up the database before migrating"
  ./backup.sh "pre-deploy-${NEW_TAG:0:12}"

  log "Running migrations + reference data"
  if ! "${COMPOSE[@]}" --profile tools run --rm migrate; then
    die "migration failed — app containers were not changed (restore from backups/ if needed)"
  fi
fi

# --- 4. switch the container and verify ---------------------------------------------
log "Starting $SERVICE $NEW_TAG"
SWITCHED=1
"${COMPOSE[@]}" up -d --no-deps "$SERVICE"

log "Health check"
if healthy; then
  log "✅ $SERVICE $NEW_TAG is healthy"
  docker image prune -f > /dev/null
  exit 0
fi

# --- 5. rollback ----------------------------------------------------------------------
"${COMPOSE[@]}" logs --tail=50 "$SERVICE" || true
if [ -z "$PREVIOUS_TAG" ] || [ "$PREVIOUS_TAG" = not-deployed ]; then
  # First deploy: nothing to go back to. Stop the broken container so .env and reality agree.
  log "❌ Unhealthy on its first deploy — stopping $SERVICE"
  "${COMPOSE[@]}" rm -sf "$SERVICE"
  env_set "$TAG_VAR" "${PREVIOUS_TAG:-not-deployed}"
  die "$SERVICE $NEW_TAG is unhealthy (first deploy, nothing to roll back to)"
fi
if [ "$PREVIOUS_TAG" = "$NEW_TAG" ]; then
  die "$SERVICE $NEW_TAG is unhealthy and there is no previous version to roll back to"
fi
log "❌ Unhealthy — rolling back $SERVICE to $PREVIOUS_TAG"
env_set "$TAG_VAR" "$PREVIOUS_TAG"
"${COMPOSE[@]}" up -d --no-deps "$SERVICE"
if healthy; then
  echo "::warning::Rolled back $SERVICE to $PREVIOUS_TAG (note: database migrations are NOT rolled back)"
else
  echo "::error::Rollback of $SERVICE to $PREVIOUS_TAG is ALSO unhealthy — manual action needed"
fi
exit 1
