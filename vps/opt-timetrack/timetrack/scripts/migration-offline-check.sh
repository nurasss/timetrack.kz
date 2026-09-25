#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
export DATABASE_URL="${DATABASE_URL:-postgresql+asyncpg://offline:offline@localhost:5432/offline}"
export JWT_SECRET="${JWT_SECRET:-offline-check-placeholder-not-secret}"
export APP_ENV=test
export CORS_ORIGINS="http://localhost"
cd "$ROOT_DIR/apps/api"
python3 -m alembic -c alembic.ini upgrade head --sql >/dev/null
