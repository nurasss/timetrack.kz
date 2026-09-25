#!/usr/bin/env bash
set -euo pipefail

cat <<'CHECKLIST'
1. Declare maintenance mode and stop writers before restoring.
2. Verify the encrypted offsite artifact checksum and decrypt it with the approved age identity.
3. Restore PostgreSQL into an isolated database first:
   createdb --maintenance-db "$RESTORE_ADMIN_DATABASE"
   pg_restore --clean --if-exists --no-owner --dbname "$RESTORE_DATABASE_URL" "$POSTGRES_DUMP"
4. Validate schema revision with Alembic current and compare sanitized row counts.
5. Restore MinIO into an isolated bucket, then compare object count, sizes, and checksums:
   mc alias set restore "$MINIO_ENDPOINT" "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY"
   mc mirror --overwrite "restore/$MINIO_BUCKET" "$MINIO_BUCKET"
6. Run application health, authentication, tenant-isolation, and attachment-readiness checks.
7. Re-enable writers, monitor errors and latency, then retire temporary restore credentials.
CHECKLIST
