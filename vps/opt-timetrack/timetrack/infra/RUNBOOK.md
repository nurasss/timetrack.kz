# Remediation Runbook

## Release and Caddy staging

The production release lives in an immutable `releases/<release-id>` directory. `current` is changed only through an atomic symlink operation. The active root site remains the existing static tree and `/api.php` remains on the Node service. Next is reachable only on the internal Docker network and is not published by Caddy.

`/api/v1/*` is present in the Caddy migration route, but its default upstream is `dev-api:8787`. Set `FASTAPI_UPSTREAM=api:8000` in the protected production environment only after authentication fixes are merged, the API tests pass, and the database migration has been reviewed. Do not enable the route as part of an ordinary deploy.

Keep Caddy automatic HTTPS and the HTTP challenge path enabled. Do not terminate ACME challenges in an application container. The health endpoints are `/healthz` for proxy liveness and `/readyz` for the API process check. Internal admin paths and legacy, kiosk, data, backup, source, and key paths return 404.

## Secret handling

Production values are supplied through the remote environment file passed to Compose. It must be owned by the deployment identity and mode `0600` or `0400`; it is never copied into a release, rsync payload, manifest, log, or image. The checked-in `.env.example` contains local-only placeholders.

Rotate the database password, MinIO root and application credentials, JWT signing key, and SMTP credential through the owning systems. Update the remote environment file, recreate affected containers, verify `/readyz`, and revoke old credentials. A JWT rotation invalidates existing access and refresh tokens unless the application has an explicit key-ring design.

## SSH rollout

1. Verify a working key-only login in a second session for every intended deployment identity.
2. Install `infra/ssh/99-timetrack-hardening.conf` as a drop-in with mode `0644` and run `sshd -t` before reload.
3. Install `infra/ssh/allow-users.conf.example` as `AllowUsers` only after replacing its placeholder with the verified account name; do not install it blindly.
4. Reload SSH, then test the approved key and confirm root, password, forwarding, and agent paths are denied.
5. Keep a console access path until the key-only session and rollback procedure are verified.

The configuration intentionally omits an active `AllowUsers` directive so an unknown account cannot lock operators out.

## Evidence quarantine and rotation

Do not delete DKIM private keys, TLS private keys, Caddy certificate data, or DNS evidence as part of hardening. First inventory the relevant `/etc/dkim`, `/etc/ssh`, Caddy data, DNS export, and mail-provider evidence locations. Copy the evidence to an encrypted, access-controlled quarantine with mode `0600` or stricter, record only a sanitized manifest and checksums, and keep the original in place until the replacement is verified.

For DKIM rotation, create a new selector, publish the new DNS record, wait for propagation, send a test message, and update the mail provider only after the new signature validates. Keep the old selector published during the overlap window, then quarantine it according to retention policy. For TLS rotation, stage the replacement certificate or ACME account, verify the full chain and renewal hooks, reload Caddy, and retain the previous evidence until rollback and renewal checks pass. Never place private keys, passwords, or complete DNS exports in this repository.

## Disaster recovery

Set and approve the service RPO/RTO before production use, for example `RPO_MINUTES=<approved-value>` and `RTO_MINUTES=<approved-value>`. Take database and object-storage backups independently, encrypt them off-site, and retain immutable copies in a separate account or provider. The following command is a plan only:

```sh
BACKUP_SOURCE_DIR=/opt/timetrack/shared/data \
OFFSITE_BACKUP_TARGET=/mnt/encrypted-offsite \
./scripts/offsite-backup.sh plan
```

The actual backup requires an approved age recipients file, mode-restricted target, and explicit confirmation:

```sh
BACKUP_SOURCE_DIR=/opt/timetrack/shared/data \
OFFSITE_BACKUP_TARGET=/mnt/encrypted-offsite \
AGE_RECIPIENT_FILE=/secure/config/timetrack-backup-recipients \
BACKUP_CONFIRM=confirm \
./scripts/offsite-backup.sh run
```

Upload the resulting `.tar.gz.age` object using the approved off-site transfer mechanism. Do not put database passwords, MinIO keys, or age identities in shell history. Test decryption and restore quarterly, or at the approved RPO/RTO cadence.

Use `scripts/restore-checklist.sh` for the PostgreSQL and MinIO restore sequence. Restore into isolated targets first, compare sanitized schema and object checksums, run authentication and tenant-isolation tests, and only then promote the restored services.

## Database migration gate

`deploy.sh deploy` never runs Alembic. Review and run the migration separately against the intended environment:

```sh
SERVER_IP="<approved-host>" \
ENV_FILE="/opt/timetrack/shared/production.env" \
MIGRATION_CONFIRM=confirm \
./deploy.sh migrate
```

Take a verified PostgreSQL backup before the migration. A failed post-deploy smoke check activates the previous immutable release when one exists; schema rollback is not automatic.
