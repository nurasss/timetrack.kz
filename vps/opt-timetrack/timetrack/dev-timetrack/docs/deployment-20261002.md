# Production deployment: timetrack-20261002-1

## Active release

- Host: SSH alias `kz-vps`.
- Application: `/opt/timetrack/dev-timetrack`.
- API container: `timetrack-dev-api`, existing `node:20-alpine` image.
- Public tablet/admin version: `20261002.1`.
- Updated files: `server.js`, `public/admin.html`, `public/tablet.html`,
  `public/offer.html`, `public/privacy.html`, `public/version.json`.
- Release source: `/opt/timetrack/releases/timetrack-20261002-1/app`.

## Backup and rollback

Backup directory: `/opt/timetrack/backups/timetrack-20261002-1`.

- `code-and-public.tar.gz`: previous API source, public files, SMTP environment
  and Caddy configuration. Contains private configuration; keep restricted.
- `data.tar.gz`: consistent pre-release file-store snapshot taken while the API
  container was paused. Contains company and biometric data; keep restricted.
- `SHA256SUMS`: verified archive checksums.
- `previous/`: original files replaced by this release.
- `rollback.sh`: code-only rollback, preserving current production data.

```sh
ssh kz-vps 'sudo -n bash /opt/timetrack/backups/timetrack-20261002-1/rollback.sh'
```

The rollback stops the API, restores the six original files and restarts it.
It maps newly issued `owner` admin-session roles to the old code's `admin`
role. It does not restore `data.tar.gz`, so attendance submitted after the
release is retained. A full data restore is a separate recovery operation.

Archive copies were also downloaded outside the repository to the private
local deployment directory under the harness temporary workspace. Temporary
storage is not a permanent off-site backup destination.

## Compatibility changes

- Existing hashed tablet tokens can resolve their device ID without re-pairing.
  New tablet pairings require both the ID and token; explicit mismatches fail.
- Previous browser outbox entries retain their original timestamps when
  converted to the new offline-event format. The new API's 15-minute offline
  acceptance window still applies; rejected entries stay queued.
- An unclosed check-in on the previous Kazakhstan calendar day does not block
  the current day's check-in, matching the tablet's daily action selection.

## Verification

- Seven Node tests passed locally and in the production Node image on VPS.
- Isolated normalization checks retained 10 company directories, 12 employees,
  1280 attendance records and three active tablet pairings.
- Isolated HTTP checks passed for four verified companies, including admin
  state and token-only/tablet-ID authentication for all three active devices.
- Rollback rehearsed in an isolated container: previous code restored, all
  attendance including an injected post-release event retained, session roles
  made compatible.
- Production HTTP checks passed after activation: verified-company lookup,
  unauthenticated admin-state rejection, and invalid tablet-token rejection.
- Public pages, manifest and face-model manifest returned 200. Inline scripts
  parsed, and the public tablet/admin release was `20261002.1`.
- Physical camera recognition and an actual employee mark were not performed
  by the deployment checks.
