#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

MODE="${1:-plan}"
SOURCE_DIR="${BACKUP_SOURCE_DIR:-}"
TARGET_DIR="${OFFSITE_BACKUP_TARGET:-}"
RECIPIENT_FILE="${AGE_RECIPIENT_FILE:-}"

usage() {
    printf '%s\n' \
        'Usage: offsite-backup.sh plan|run' \
        'plan: BACKUP_SOURCE_DIR and OFFSITE_BACKUP_TARGET are optional' \
        'run: BACKUP_SOURCE_DIR, OFFSITE_BACKUP_TARGET, AGE_RECIPIENT_FILE, and BACKUP_CONFIRM=confirm are required'
}

if [[ "$MODE" == plan ]]; then
    if [[ -n "$SOURCE_DIR" ]]; then
        [[ "$SOURCE_DIR" == /* ]] || { printf '%s\n' 'BACKUP_SOURCE_DIR must be absolute' >&2; exit 1; }
        [[ -d "$SOURCE_DIR" ]] || { printf '%s\n' 'BACKUP_SOURCE_DIR does not exist' >&2; exit 1; }
        [[ "$SOURCE_DIR" != / ]] || { printf '%s\n' 'refusing to use the filesystem root as a backup source' >&2; exit 1; }
    fi
    printf 'mode=plan\nsource=%s\n' "${SOURCE_DIR:-<approved-absolute-data-directory>}"
    printf '%s\n' 'contents=encrypted archive only; env, keys, certificates, logs, and release trees are excluded'
    [[ -n "$TARGET_DIR" ]] && printf 'target=%s\n' "$TARGET_DIR"
    exit 0
fi

[[ -n "$SOURCE_DIR" && "$SOURCE_DIR" == /* ]] || { printf '%s\n' 'BACKUP_SOURCE_DIR must be absolute' >&2; exit 1; }
[[ -d "$SOURCE_DIR" ]] || { printf '%s\n' 'BACKUP_SOURCE_DIR does not exist' >&2; exit 1; }
[[ "$SOURCE_DIR" != / ]] || { printf '%s\n' 'refusing to use the filesystem root as a backup source' >&2; exit 1; }
[[ "$MODE" == run ]] || { usage >&2; exit 2; }
[[ -n "$TARGET_DIR" && "$TARGET_DIR" == /* ]] || { printf '%s\n' 'OFFSITE_BACKUP_TARGET must be absolute' >&2; exit 1; }
[[ -n "$RECIPIENT_FILE" && -f "$RECIPIENT_FILE" ]] || { printf '%s\n' 'AGE_RECIPIENT_FILE must point to an age recipients file' >&2; exit 1; }
[[ "${BACKUP_CONFIRM:-}" == confirm ]] || { printf '%s\n' 'set BACKUP_CONFIRM=confirm explicitly' >&2; exit 1; }
command -v age >/dev/null 2>&1 || { printf '%s\n' 'age is required for encrypted backups' >&2; exit 1; }
command -v tar >/dev/null 2>&1 || { printf '%s\n' 'tar is required' >&2; exit 1; }
recipient_mode="$(stat -c '%a' "$RECIPIENT_FILE" 2>/dev/null || stat -f '%Lp' "$RECIPIENT_FILE")"
if (( 8#$recipient_mode & 077 )); then
    printf '%s\n' 'AGE_RECIPIENT_FILE must not be readable by group or others' >&2
    exit 1
fi
install -d -m 0700 "$TARGET_DIR"
source_parent="$(dirname -- "$SOURCE_DIR")"
source_name="$(basename -- "$SOURCE_DIR")"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
temporary="$(mktemp "${TARGET_DIR%/}/.timetrack-${timestamp}.XXXXXX.age")"
trap 'rm -f -- "$temporary"' EXIT
tar -czf - \
    --exclude='.env' \
    --exclude='.env.*' \
    --exclude='*.key' \
    --exclude='*.pem' \
    --exclude='*.p12' \
    --exclude='*.pfx' \
    --exclude='*.jks' \
    --exclude='certs' \
    --exclude='keys' \
    --exclude='*.log' \
    --exclude='logs' \
    --exclude='node_modules' \
    --exclude='.next' \
    --exclude='backups' \
    --exclude='archives' \
    -C "$source_parent" "$source_name" \
    | age -R "$RECIPIENT_FILE" -o "$temporary"
mv -f -- "$temporary" "${TARGET_DIR%/}/timetrack-${timestamp}.tar.gz.age"
trap - EXIT
printf 'backup=timetrack-%s.tar.gz.age\n' "$timestamp"
