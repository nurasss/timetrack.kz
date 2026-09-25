#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

COMMAND="${1:-deploy}"
if [[ $# -gt 0 ]]; then
    shift
fi

SERVER_IP="${SERVER_IP:-}"
SERVER_USER="${SERVER_USER:-ubuntu}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/timetrack}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-${DEPLOY_PATH}/shared/production.env}"
PROJECT_NAME="${PROJECT_NAME:-timetrack}"
RELEASE_ROOT="${RELEASE_ROOT:-${DEPLOY_PATH}/releases}"
MANIFEST_ROOT="${MANIFEST_ROOT:-${DEPLOY_PATH}/shared/manifests}"
SHARED_DATA_DIR="${DEV_DATA_DIR:-${DEPLOY_PATH}/shared/dev-timetrack-data}"
DEV_API_UID="${DEV_API_UID:-10001}"
DEV_API_GID="${DEV_API_GID:-10001}"
SMOKE_URL="${SMOKE_URL:-}"
USE_SUDO="${USE_SUDO:-1}"
REMOTE_SSH_OPTIONS=(-o BatchMode=yes -o StrictHostKeyChecking=yes)

usage() {
    printf '%s\n' \
        'Usage: deploy.sh deploy|migrate|rollback|smoke|manifest' \
        'Required remote settings: SERVER_IP, ENV_FILE, SMOKE_URL' \
        'Migrations run only with: deploy.sh migrate and MIGRATION_CONFIRM=confirm' \
        'Rollback runs only with: deploy.sh rollback and ROLLBACK_CONFIRM=confirm'
}

die() {
    printf 'error: %s\n' "$*" >&2
    exit 1
}

require_command() {
    command -v "$1" >/dev/null 2>&1 || die "required command not found: $1"
}

require_remote_settings() {
    [[ -n "$SERVER_IP" ]] || die 'SERVER_IP is required; no default host is provided'
    [[ "$DEPLOY_PATH" == /* ]] || die 'DEPLOY_PATH must be absolute'
    [[ "$ENV_FILE" == /* ]] || die 'ENV_FILE must be an absolute remote path'
    [[ "$SHARED_DATA_DIR" == /* ]] || die 'DEV_DATA_DIR must be an absolute remote path'
    [[ "$COMPOSE_FILE" =~ ^[A-Za-z0-9._-]+$ ]] || die 'COMPOSE_FILE contains an unsafe path'
    [[ "$PROJECT_NAME" =~ ^[a-z0-9][a-z0-9_-]*$ ]] || die 'PROJECT_NAME contains unsafe characters'
    [[ "$DEV_API_UID" =~ ^[0-9]+$ && "$DEV_API_GID" =~ ^[0-9]+$ ]] || die 'DEV_API_UID and DEV_API_GID must be numeric'
    [[ "$USE_SUDO" == 0 || "$USE_SUDO" == 1 ]] || die 'USE_SUDO must be 0 or 1'
}

require_smoke_settings() {
    if [[ -z "$SMOKE_URL" ]]; then
        [[ -n "${TIMETRACK_DOMAIN:-}" ]] || die 'SMOKE_URL or TIMETRACK_DOMAIN is required'
        SMOKE_URL="https://${TIMETRACK_DOMAIN}/"
    fi
    SMOKE_URL="${SMOKE_URL%/}"
}

validate_release_id() {
    [[ "$1" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]] || die 'RELEASE_ID contains unsafe characters'
}

remote_exec() {
    ssh "${REMOTE_SSH_OPTIONS[@]}" "${SERVER_USER}@${SERVER_IP}" bash -s -- "$@"
}

local_release_id() {
    local release_id
    release_id="${RELEASE_ID:-$(date -u +%Y%m%dT%H%M%SZ)-$$}"
    validate_release_id "$release_id"
    printf '%s' "$release_id"
}

run_local_gates() {
    [[ "${ALLOW_UNCHECKED_DEPLOY:-0}" == 1 ]] && return 0
    require_command npm
    require_command node
    if [[ -f package.json ]]; then
        npm ci --ignore-scripts
        npm run typecheck
        npm run lint
        npm run build:admin
    fi
    if compgen -G 'dev-timetrack/tests/*.test.js' >/dev/null; then
        node --test dev-timetrack/tests/*.test.js
    fi
    if [[ -f apps/api/requirements.lock ]]; then
        require_command python3
        rm -rf .deploy-check-venv
        python3 -m venv .deploy-check-venv
        ./.deploy-check-venv/bin/python -m pip install --disable-pip-version-check --require-hashes -r apps/api/requirements.lock
        (cd apps/api && ../../.deploy-check-venv/bin/python -m ruff check app migrations)
        DATABASE_URL='postgresql+asyncpg://deploy-check:deploy-check@127.0.0.1:1/deploy-check' JWT_SECRET='deploy-check-only-secret-not-for-production' APP_ENV=test ./.deploy-check-venv/bin/python scripts/check-api-contract.py
        rm -rf .deploy-check-venv
    fi
}

remote_preflight() {
    local release_id="$1"
    remote_exec "$DEPLOY_PATH" "$RELEASE_ROOT" "$MANIFEST_ROOT" "$ENV_FILE" "$COMPOSE_FILE" "$SHARED_DATA_DIR" "$DEV_API_UID" "$DEV_API_GID" "$USE_SUDO" "$release_id" <<'REMOTE'
set -eu
deploy_path=$1
release_root=$2
manifest_root=$3
env_file=$4
compose_file=$5
shared_data_dir=$6
api_uid=$7
api_gid=$8
use_sudo=$9
release_id=${10}
user_name="$(id -un)"
group_name="$(id -gn)"
run_root() {
    if [ "$use_sudo" = 1 ]; then
        sudo -n "$@"
    else
        "$@"
    }
}
install -d -m 0750 -o "$user_name" -g "$group_name" "$deploy_path" "$release_root" "$manifest_root"
legacy_data_dir="$deploy_path/dev-timetrack/data"
if [ -d "$legacy_data_dir" ] && [ "$legacy_data_dir" != "$shared_data_dir" ] && [ ! -d "$shared_data_dir" ]; then
    printf 'legacy data exists at %s; provision %s without copying it into a release\n' "$legacy_data_dir" "$shared_data_dir" >&2
    exit 1
fi
run_root install -d -m 0750 -o "$api_uid" -g "$api_gid" "$shared_data_dir"
run_root chown "$api_uid:$api_gid" "$shared_data_dir"
current_target=""
if [ -L "$deploy_path/current" ]; then
    current_target="$(readlink -f "$deploy_path/current" 2>/dev/null || true)"
fi
run_root test -f "$env_file"
env_mode="$(run_root stat -c '%a' "$env_file")"
case "$env_mode" in
    400|600) ;;
    *) printf 'ENV_FILE must have mode 0400 or 0600: %s\n' "$env_file" >&2; exit 1 ;;
esac
manifest="$manifest_root/predeploy-${release_id}.manifest"
{
    printf 'release_id=%s\n' "$release_id"
    printf 'created_at=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    printf 'compose_file=%s\n' "$compose_file"
    printf 'previous_release=%s\n' "${current_target:-none}"
    printf 'secrets_data_copied=false\n'
    if [ -n "$current_target" ]; then
        for file in "$current_target/$compose_file" "$current_target/Caddyfile"; do
            if [ -f "$file" ]; then
                run_root sha256sum "$file"
            fi
        done
    fi
} > "$manifest"
run_root chmod 0640 "$manifest"
REMOTE
}

remote_prepare_release() {
    local release_path="$1"
    remote_exec "$release_path" "$RELEASE_ROOT" "$SHARED_DATA_DIR" "$DEV_API_UID" "$DEV_API_GID" "$USE_SUDO" <<'REMOTE'
set -eu
release_path=$1
release_root=$2
shared_data_dir=$3
api_uid=$4
api_gid=$5
use_sudo=$6
user_name="$(id -un)"
group_name="$(id -gn)"
run_root() {
    if [ "$use_sudo" = 1 ]; then
        sudo -n "$@"
    else
        "$@"
    }
}
case "$release_path" in
    "$release_root"/*) ;;
    *) printf 'release path escaped release root\n' >&2; exit 1 ;;
esac
if [ -e "$release_path" ] || [ -L "$release_path" ]; then
    printf 'release already exists and is immutable: %s\n' "$release_path" >&2
    exit 1
fi
install -d -m 0750 -o "$user_name" -g "$group_name" "$release_path"
run_root install -d -m 0750 -o "$api_uid" -g "$api_gid" "$shared_data_dir"
REMOTE
}

remote_finalize_release() {
    local release_path="$1"
    remote_exec "$release_path" "$USE_SUDO" <<'REMOTE'
set -eu
release_path=$1
use_sudo=$2
run_root() {
    if [ "$use_sudo" = 1 ]; then
        sudo -n "$@"
    else
        "$@"
    }
}
chmod -R a-w "$release_path"
test -f "$release_path/Caddyfile"
test -f "$release_path/infra/caddy/timetrack.caddy"
REMOTE
}

remote_compose() {
    local release_path="$1"
    local release_id="$2"
    shift 2
    remote_exec "$release_path" "$release_id" "$PROJECT_NAME" "$ENV_FILE" "$COMPOSE_FILE" "$USE_SUDO" "$SHARED_DATA_DIR" "$DEV_API_UID" "$DEV_API_GID" "$@" <<'REMOTE'
set -eu
release_path=$1
release_id=$2
project_name=$3
env_file=$4
compose_file=$5
use_sudo=$6
shared_data_dir=$7
api_uid=$8
api_gid=$9
shift 9
run_root() {
    if [ "$use_sudo" = 1 ]; then
        sudo -n "$@"
    else
        "$@"
    fi
}
run_root env RELEASE_TAG="$release_id" DEV_DATA_DIR="$shared_data_dir" DEV_API_UID="$api_uid" DEV_API_GID="$api_gid" docker compose --project-name "$project_name" --env-file "$env_file" -f "$release_path/$compose_file" "$@"
REMOTE
}

remote_current_target() {
    remote_exec "$DEPLOY_PATH" <<'REMOTE'
set -eu
deploy_path=$1
if [ -L "$deploy_path/current" ]; then
    readlink -f "$deploy_path/current"
fi
REMOTE
}

remote_previous_target() {
    remote_exec "$DEPLOY_PATH" <<'REMOTE'
set -eu
deploy_path=$1
if [ -L "$deploy_path/previous" ]; then
    readlink -f "$deploy_path/previous"
fi
REMOTE
}

remote_atomic_link() {
    local target="$1"
    local link_path="$2"
    remote_exec "$target" "$link_path" "$USE_SUDO" <<'REMOTE'
set -eu
target=$1
link_path=$2
use_sudo=$3
run_root() {
    if [ "$use_sudo" = 1 ]; then
        sudo -n "$@"
    else
        "$@"
    }
}
temporary="${link_path}.tmp.$$"
run_root rm -f "$temporary"
run_root ln -s "$target" "$temporary"
run_root mv -Tf "$temporary" "$link_path"
REMOTE
}

remote_remove_link() {
    local link_path="$1"
    remote_exec "$link_path" "$USE_SUDO" <<'REMOTE'
set -eu
link_path=$1
use_sudo=$2
run_root() {
    if [ "$use_sudo" = 1 ]; then
        sudo -n "$@"
    else
        "$@"
    }
}
if [ -L "$link_path" ]; then
    run_root rm -f "$link_path"
fi
REMOTE
}

remote_smoke() {
    remote_exec "$SMOKE_URL" <<'REMOTE'
set -eu
smoke_url=$1
command -v curl >/dev/null 2>&1 || { printf 'curl is required for smoke checks\n' >&2; exit 1; }
curl --fail --silent --show-error --max-time 15 "${smoke_url}/healthz" >/dev/null
curl --fail --silent --show-error --max-time 15 "${smoke_url}/readyz" >/dev/null
REMOTE
}

deploy_release() {
    require_remote_settings
    require_smoke_settings
    require_command ssh
    require_command rsync
    local release_id release_path old_target old_release_id switched=0
    release_id="$(local_release_id)"
    release_path="${RELEASE_ROOT}/${release_id}"
    old_target="$(remote_current_target || true)"
    run_local_gates
    remote_preflight "$release_id"
    remote_prepare_release "$release_path"
    rsync -a --delete --safe-links \
        --exclude='.git/' \
        --exclude='.github/' \
        --exclude='.env*' \
        --exclude='**/.env*' \
        --exclude='node_modules/' \
        --exclude='**/node_modules/' \
        --exclude='.next/' \
        --exclude='**/.next/' \
        --exclude='dist/' \
        --exclude='**/dist/' \
        --exclude='__pycache__/' \
        --exclude='**/__pycache__/' \
        --exclude='data/' \
        --exclude='**/data/' \
        --exclude='backups/' \
        --exclude='**/backups/' \
        --exclude='.ops-backups/' \
        --exclude='archives/' \
        --exclude='**/archives/' \
        --exclude='*.sql' \
        --exclude='*.dump' \
        --exclude='*.sqlite*' \
        --exclude='*.db' \
        --exclude='*.log' \
        --exclude='*.key' \
        --exclude='*.pem' \
        --exclude='*.p12' \
        --exclude='*.pfx' \
        --exclude='*.tar' \
        --exclude='*.tar.gz' \
        --exclude='*.tgz' \
        --exclude='*.zip' \
        --exclude='*.mp4' \
        --exclude='*.mov' \
        --exclude='*.webm' \
        --exclude='models/' \
        --exclude='**/models/' \
        --exclude='videos/' \
        --exclude='**/videos/' \
        --exclude='timetrack-mobile-prototype/' \
        --exclude='timetrack-web-prototype/' \
        "$ROOT_DIR/" "${SERVER_USER}@${SERVER_IP}:${release_path}/"
    remote_finalize_release "$release_path"
    remote_compose "$release_path" "$release_id" config --quiet
    remote_compose "$release_path" "$release_id" build --pull
    if [[ -n "$old_target" && "$old_target" == "$RELEASE_ROOT/"* ]]; then
        old_release_id="$(basename -- "$old_target")"
        remote_atomic_link "$old_target" "${DEPLOY_PATH}/previous"
    else
        remote_remove_link "${DEPLOY_PATH}/previous"
        old_release_id=""
    fi
    remote_atomic_link "$release_path" "${DEPLOY_PATH}/current"
    switched=1
    rollback_failed_deploy() {
        if [[ "$switched" == 1 ]]; then
            if [[ -n "$old_target" && "$old_target" == "$RELEASE_ROOT/"* ]]; then
                remote_atomic_link "$old_target" "${DEPLOY_PATH}/current" || true
                remote_compose "$old_target" "$old_release_id" up -d --remove-orphans || true
            else
                remote_remove_link "${DEPLOY_PATH}/current" || true
            fi
        fi
    }
    if ! remote_compose "$release_path" "$release_id" up -d --remove-orphans; then
        rollback_failed_deploy
        return 1
    fi
    if ! remote_smoke; then
        rollback_failed_deploy
        return 1
    fi
    switched=0
    printf 'release=%s\nprevious=%s\n' "$release_path" "${old_target:-none}"
}

migrate_current() {
    require_remote_settings
    [[ "${MIGRATION_CONFIRM:-}" == confirm ]] || die 'set MIGRATION_CONFIRM=confirm explicitly; deploy never migrates'
    local current_target release_id
    current_target="$(remote_current_target)"
    [[ -n "$current_target" && "$current_target" == "$RELEASE_ROOT/"* ]] || die 'current is not an immutable release'
    release_id="$(basename -- "$current_target")"
    remote_compose "$current_target" "$release_id" config --quiet
    remote_compose "$current_target" "$release_id" run --rm api alembic upgrade head
}

rollback_release() {
    require_remote_settings
    require_smoke_settings
    [[ "${ROLLBACK_CONFIRM:-}" == confirm ]] || die 'set ROLLBACK_CONFIRM=confirm explicitly'
    local target release_id
    target="$(remote_previous_target)"
    [[ -n "$target" && "$target" == "$RELEASE_ROOT/"* ]] || die 'no immutable previous release is available'
    release_id="$(basename -- "$target")"
    remote_compose "$target" "$release_id" config --quiet
    remote_atomic_link "$target" "${DEPLOY_PATH}/current"
    remote_compose "$target" "$release_id" up -d --remove-orphans
    remote_smoke
    printf 'rollback_release=%s\n' "$target"
}

smoke_current() {
    require_remote_settings
    require_smoke_settings
    remote_smoke
}

case "$COMMAND" in
    deploy)
        deploy_release
        ;;
    migrate)
        migrate_current
        ;;
    rollback)
        rollback_release
        ;;
    smoke)
        smoke_current
        ;;
    manifest)
        "$ROOT_DIR/scripts/release-manifest.sh" "$ROOT_DIR"
        ;;
    -h|--help|help)
        usage
        ;;
    *)
        usage >&2
        exit 2
        ;;
esac
