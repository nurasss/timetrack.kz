# Attendance performance release: 20261009.1

- SSH: `kz-vps`; application `/opt/timetrack/dev-timetrack`.
- Files deployed: `server.js`, `public/tablet.html`, `public/version.json`.
- Existing production changes (including attribution) preserved.
- Cached Kazakhstan `Intl.DateTimeFormat` instances replace per-record creation.
- Attendance records store `empPhoto: null`; admin already resolves employee
  photos through `employeeById`. Employee photos and descriptors remain in
  `employees.json`. Manual attendance photo references remain unchanged.
- Offline backlog replay no longer delays acknowledgment of a successful mark.
- Whole-file atomic history writes still exist, but now operate on compact JSON.

## Backup and rollback

Restricted backup directory: `/opt/timetrack/backups/attendance-20261009-1`.
Contains previous server, tablet, version file, and original `poscenter/logs.json`.
The migration script is saved there as `compact-attendance.py`.

```sh
ssh kz-vps 'sudo -n bash /opt/timetrack/backups/attendance-20261009-1/rollback.sh'
```

Rollback restores code and tablet version, preserving current attendance.
Compact histories are readable by the previous code. Do not overwrite current
logs with the archived history: that would discard marks submitted afterwards.

## Verification

- 12 security and tablet attendance tests passed locally, including a stalled
  offline backlog that must not block acknowledgment of a new saved mark.
- Isolated synthetic history on VPS: 1,359 records, 58,595,582 bytes reduced to
  632,480 bytes; average read + tablet projection ~80 ms over five samples.
  Synthetic marks were confined to temporary data, not production attendance.
- Production migration: 1,359 records retained; 1,280 duplicated photos replaced
  with null; JSON size 59,624,874 -> 698,318 bytes. Migration validates every
  non-photo field unchanged before atomic replacement; API stopped during it.
- Post-deploy unauthenticated state requests returned 401 in 164-212 ms
  (previous measured request ~2.8 s); companyInfo 200 in 69-90 ms.
- Tablet page returned 200; public version tablet=20261009.1, admin=20261002.1.
- End-to-end physical face recognition and an actual employee mark require a
  check on the tablet; production diagnostic requests did not create marks.
