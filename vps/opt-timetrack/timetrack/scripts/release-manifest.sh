#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="${1:-$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)}"
OUTPUT_FILE="${MANIFEST_FILE:-}"
if command -v sha256sum >/dev/null 2>&1; then
    hash_file() { sha256sum -- "$1"; }
elif command -v shasum >/dev/null 2>&1; then
    hash_file() { shasum -a 256 "$1"; }
else
    printf '%s\n' 'sha256sum or shasum is required' >&2
    exit 1
fi
if ! command -v find >/dev/null 2>&1; then
    printf '%s\n' 'find is required' >&2
    exit 1
fi

ROOT_DIR="$(cd -- "$ROOT_DIR" && pwd)"
umask 077
scan() {
    find "$ROOT_DIR" -type f \
        -not -path '*/.git/*' \
        -not -path '*/.github/*' \
        -not -path '*/.claude/*' \
        -not -path '*/.idea/*' \
        -not -path '*/node_modules/*' \
        -not -path '*/.next/*' \
        -not -path '*/dist/*' \
        -not -path '*/build/*' \
        -not -path '*/__pycache__/*' \
        -not -path '*/.pytest_cache/*' \
        -not -path '*/.ruff_cache/*' \
        -not -path '*/.venv/*' \
        -not -path '*/backups/*' \
        -not -path '*/.ops-backups/*' \
        -not -path '*/archives/*' \
        -not -path '*/archive/*' \
        -not -path '*/data/*' \
        -not -path '*/logs/*' \
        -not -path '*/models/*' \
        -not -path '*/videos/*' \
        -not -path '*/media/*' \
        -not -path '*/certs/*' \
        -not -path '*/keys/*' \
        -not -name '.env' \
        -not -name '.env.*' \
        -not -name '._*' \
        -not -name '*.key' \
        -not -name '*.pem' \
        -not -name '*.p12' \
        -not -name '*.pfx' \
        -not -name '*.jks' \
        -not -name '*.sql' \
        -not -name '*.dump' \
        -not -name '*.sqlite' \
        -not -name '*.sqlite3' \
        -not -name '*.db' \
        -not -name '*.log' \
        -not -name '*.tar' \
        -not -name '*.tar.gz' \
        -not -name '*.tgz' \
        -not -name '*.zip' \
        -not -name '*.7z' \
        -not -name '*.mp4' \
        -not -name '*.mov' \
        -not -name '*.webm' \
        -print0
}

emit_manifest() {
    printf 'manifest_schema=1\n'
    printf 'generated_at=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    printf 'source_root=%s\n' "$ROOT_DIR"
    printf '%s\n' 'secrets_data_included=false'
    while IFS= read -r -d '' file; do
        relative="${file#"$ROOT_DIR/"}"
        digest_line="$(hash_file "$file")"
        digest="${digest_line%% *}"
        printf '%s  %s\n' "$digest" "$relative"
    done < <(scan)
}

if [[ -n "$OUTPUT_FILE" ]]; then
    temporary="${OUTPUT_FILE}.tmp.$$"
    emit_manifest > "$temporary"
    mv -f -- "$temporary" "$OUTPUT_FILE"
    chmod 0600 -- "$OUTPUT_FILE"
else
    emit_manifest
fi
