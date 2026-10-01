#!/usr/bin/env bash
#
# One-time host setup for ONE environment. Run as an admin with sudo; it is idempotent
# (safe to run again) and touches nothing that belongs to other sites on this server.
#
#   sudo ./setup-host.sh staging front.dev.chdev.site api.dev.chdev.site 8081 \
#        ~/github_actions_deploy.pub
#
# 1. user "deploy" (no sudo, in group docker) that CI logs in as, with the given public key
# 2. /opt/income-expenses/<env>/ owned by deploy
# 3. 2 GB swap (only if the machine has none)
# 4. host nginx site /etc/nginx/sites-available/income-expenses-<env> (nginx -t before reload)
# 5. TLS certificate for both domains with certbot --nginx (adds HTTPS + redirect)

set -Eeuo pipefail

ENV_NAME="${1:-}"
APP_DOMAIN="${2:-}"
API_DOMAIN="${3:-}"
WEB_PORT="${4:-}"
DEPLOY_PUBKEY="${5:-}"

die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
log() { printf '\n==> %s\n' "$*"; }

[ "$(id -u)" = 0 ] || die "run with sudo"
[[ "$ENV_NAME" =~ ^(staging|production)$ ]] || die "usage: $0 <staging|production> <app-domain> <api-domain> <web-port> <deploy-pubkey-file>"
[[ "$APP_DOMAIN" =~ ^[a-z0-9.-]+$ && "$API_DOMAIN" =~ ^[a-z0-9.-]+$ ]] || die "invalid domain"
[[ "$WEB_PORT" =~ ^[0-9]{4,5}$ ]] || die "invalid port: $WEB_PORT"
[ -f "$DEPLOY_PUBKEY" ] || die "public key file not found: $DEPLOY_PUBKEY"
grep -qE '^ssh-(ed25519|rsa) ' "$DEPLOY_PUBKEY" || die "$DEPLOY_PUBKEY is not an SSH public key"

HERE="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="/opt/income-expenses/$ENV_NAME"
SITE="/etc/nginx/sites-available/income-expenses-$ENV_NAME"

# Refuse to take a port that something else already listens on (other apps share this host).
if ss -tlnH "( sport = :$WEB_PORT )" | grep -q . && ! docker ps --format '{{.Names}}' | grep -q "^income-expenses-$ENV_NAME-web"; then
  die "port $WEB_PORT is already in use by another program"
fi

# --- 1. deploy user ---------------------------------------------------------------------
log "User 'deploy'"
if ! id deploy > /dev/null 2>&1; then
  adduser --disabled-password --gecos "CI deploy user" deploy
fi
usermod -aG docker deploy
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
touch /home/deploy/.ssh/authorized_keys
if ! grep -qF "$(cut -d' ' -f2 "$DEPLOY_PUBKEY")" /home/deploy/.ssh/authorized_keys; then
  cat "$DEPLOY_PUBKEY" >> /home/deploy/.ssh/authorized_keys
fi
chown deploy:deploy /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys
echo "deploy: $(id deploy)"

# --- 2. app directory -------------------------------------------------------------------
log "Directory $APP_DIR"
install -d -m 755 -o root -g root /opt/income-expenses
install -d -m 750 -o deploy -g deploy "$APP_DIR"
ls -ld "$APP_DIR"

# --- 3. swap ----------------------------------------------------------------------------
log "Swap"
if [ -z "$(swapon --show --noheadings)" ]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile > /dev/null
  swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  # Prefer RAM; swap is the safety net that turns an OOM kill into a slowdown.
  echo 'vm.swappiness=10' > /etc/sysctl.d/90-swappiness.conf
  sysctl -q -p /etc/sysctl.d/90-swappiness.conf
fi
swapon --show

# --- 4. nginx site ----------------------------------------------------------------------
log "nginx site $SITE"
if [ -f "$SITE" ] && grep -q 'managed by Certbot' "$SITE"; then
  echo "already configured by certbot — left unchanged"
else
  # Only OUR placeholders are replaced; nginx variables like $host stay as they are.
  # shellcheck disable=SC2016 # the literal ${VAR} list tells envsubst WHICH names to replace
  ENV_NAME="$ENV_NAME" APP_DOMAIN="$APP_DOMAIN" API_DOMAIN="$API_DOMAIN" WEB_PORT="$WEB_PORT" \
    envsubst '${ENV_NAME} ${APP_DOMAIN} ${API_DOMAIN} ${WEB_PORT}' \
    < "$HERE/nginx-site.conf.template" > "$SITE"
  ln -sf "$SITE" "/etc/nginx/sites-enabled/income-expenses-$ENV_NAME"
fi
# A broken config must never reach the running nginx that also serves the other sites.
nginx -t
systemctl reload nginx

# --- 5. TLS -----------------------------------------------------------------------------
log "TLS certificate ($APP_DOMAIN, $API_DOMAIN)"
certbot --nginx --non-interactive --agree-tos --keep-until-expiring --redirect \
  --cert-name "income-expenses-$ENV_NAME" -d "$APP_DOMAIN" -d "$API_DOMAIN"
nginx -t
systemctl reload nginx

log "Done. Next: the app stack in $APP_DIR (as user deploy)."
