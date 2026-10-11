# Attendance reliability release — 20261005.3

Published on 2026-10-05 to `/opt/timetrack/dev-timetrack/public` on `kz-vps`.

## Reproduced failures

- An accepted tap was discarded when a background inference took longer than
  1.5 seconds. A simulated 2.1-second frame reproduced the failure.
- One missing frame immediately reset identity/liveness instead of retrying the
  accepted tap; a missing frame followed by the correct employee reproduced it.
- Recognition rendering could enable a button during an in-flight submission.
- Attendance requests had no time limit, including response-body reads.
- A late background state response could replace newer foreground state.

## Changes

- Wait up to eight seconds for an existing inference; explicitly report a stuck
  camera if it does not finish.
- Retry up to three transient missing/unclear frames within the same tap.
  A different recognized employee or multiple faces is still rejected.
- Show “Проверяем лицо…” and “Сохраняем…” immediately, with `aria-busy` and
  disabled attendance/camera-restart buttons throughout submission.
- Serialize both regular and manual attendance submissions.
- Apply a 12-second request timeout. Regular marks that cannot reach the server
  enter the existing persistent outbox with their original ID and timestamp;
  manual marks still require the server.
- Reject background refreshes older than a newer applied state.
- Redirect the legacy `kiosk.html` page to `tablet.html`, preserving query/hash.
- Update public tablet version to `20261005.3`; admin version is unchanged.

## Verification

Command:

```sh
node --test tests/tablet-attendance.test.js tests/security.test.js
```

All **11 tests passed**. Inline scripts in tablet/kiosk parse successfully.

Browser smoke test against the published site confirmed matching build/version,
visible save progress, disabled repeated taps, one simulated write, success
acknowledgement and legacy URL redirection. The save and identity check were
stubbed in an isolated browser profile; no real employee attendance was written.
Physical camera recognition on the affected employee device remains to be checked.

## Backup

`/opt/timetrack/dev-timetrack/backup-attendance-20261005T094655Z`

- `0-tablet.html`
- `1-kiosk.html`
- `2-version.json`

Only these public files were replaced. Existing analytics script references were
preserved during deployment, and deployed file bytes were verified afterwards.
The API and attendance records were not modified by this release.

Reload the tablet page once to activate the release immediately. The existing
version checker also reloads an idle, visible tablet after detecting the version
change; no device re-pairing or local-data clearing is needed.
