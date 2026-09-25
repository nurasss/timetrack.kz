#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const positional = args.filter((arg) => !arg.startsWith('--'));
const dataDir = path.resolve(positional[0] || path.join(__dirname, '..', 'data'));
const retentionDays = Number(process.env.MANUAL_PHOTO_RETENTION_DAYS || positional[1] || 90);

if (!Number.isFinite(retentionDays) || retentionDays <= 0) {
  console.error('Retention days must be a positive number');
  process.exit(1);
}

const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
let scanned = 0;
let removed = 0;
let bytes = 0;

function listEntries(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

for (const company of listEntries(dataDir).filter((entry) => entry.isDirectory())) {
  const companyDir = path.join(dataDir, company.name);
  const manualDir = path.join(companyDir, 'manual_photos');
  const logsFile = path.join(companyDir, 'logs.json');
  let logs = null;
  try {
    const parsed = JSON.parse(fs.readFileSync(logsFile, 'utf8'));
    if (parsed && Array.isArray(parsed.logs)) logs = parsed;
  } catch { logs = null; }
  let logsChanged = false;
  for (const file of listEntries(manualDir).filter((entry) => entry.isFile())) {
    if (!/\.jpg$/i.test(file.name)) continue;
    const fullPath = path.join(manualDir, file.name);
    let stat;
    try { stat = fs.statSync(fullPath); } catch { continue; }
    scanned += 1;
    if (stat.mtimeMs >= cutoff) continue;
    bytes += stat.size;
    removed += 1;
    if (!dryRun) {
      fs.unlinkSync(fullPath);
      if (logs) {
        for (const log of logs.logs) {
          if (log.manualPhoto === `manual_photos/${file.name}`) {
            log.manualPhoto = '';
            logsChanged = true;
          }
        }
      }
    }
  }
  if (logsChanged && !dryRun) {
    fs.writeFileSync(logsFile, `${JSON.stringify(logs, null, 2)}\n`);
  }
}

console.log(JSON.stringify({
  ok: true,
  dryRun,
  dataDir,
  retentionDays,
  scanned,
  removed,
  freedBytes: dryRun ? 0 : bytes,
  wouldFreeBytes: dryRun ? bytes : undefined,
}, null, 2));
