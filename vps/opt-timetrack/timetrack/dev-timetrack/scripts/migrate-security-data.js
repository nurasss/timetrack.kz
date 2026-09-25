'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PIN_PBKDF2_ITERATIONS = 600000;
const COMMON_PINS = new Set([
  '000000',
  '111111',
  '123456',
  '654321',
  '123123',
  '121212',
  '112233',
  '1234',
]);

function usage() {
  process.stderr.write(
    'Usage: node scripts/migrate-security-data.js --data-dir <path> [--apply] [--revoke-tablets]\n',
  );
}

function parseArgs(argv) {
  const result = {
    dataDir: '',
    apply: false,
    revokeTablets: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--data-dir') {
      result.dataDir = path.resolve(argv[index + 1] || '');
      index += 1;
    } else if (argument === '--apply') {
      result.apply = true;
    } else if (argument === '--revoke-tablets') {
      result.revokeTablets = true;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  if (!result.dataDir) {
    usage();
    throw new Error('--data-dir is required');
  }
  return result;
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
}

function writeJsonAtomic(file, value) {
  const directory = path.dirname(file);
  fs.mkdirSync(directory, { recursive: true });
  const temporary = path.join(
    directory,
    `.${path.basename(file)}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`,
  );
  let mode = 0o600;
  let ownership = null;
  try {
    const existing = fs.statSync(file);
    mode = existing.mode;
    ownership = { uid: existing.uid, gid: existing.gid };
  } catch {}
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode });
  if (ownership && typeof fs.chownSync === 'function') {
    try {
      fs.chownSync(temporary, ownership.uid, ownership.gid);
    } catch {}
  }
  fs.renameSync(temporary, file);
}

function validNewAdminPin(pin) {
  const value = String(pin || '');
  return /^\d{6,12}$/.test(value)
    && !COMMON_PINS.has(value)
    && new Set(value).size > 1;
}

function adminPinHash(pin) {
  const salt = crypto.randomBytes(16);
  const derived = crypto.pbkdf2Sync(
    String(pin),
    salt,
    PIN_PBKDF2_ITERATIONS,
    32,
    'sha256',
  );
  return [
    'pbkdf2-sha256',
    PIN_PBKDF2_ITERATIONS,
    salt.toString('base64'),
    derived.toString('base64'),
  ].join('$');
}

function companyDirectories(dataDir) {
  return fs.readdirSync(dataDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => path.join(dataDir, entry.name))
    .sort();
}

function migrateCompany(directory, options) {
  const settingsFile = path.join(directory, 'settings.json');
  const securityFile = path.join(directory, 'security.json');
  const settingsDocument = readJson(settingsFile, { settings: {} });
  const settings = settingsDocument && typeof settingsDocument.settings === 'object'
    ? settingsDocument.settings
    : {};
  const security = readJson(securityFile, {});
  const legacyPin = String(settings.adminPin || '').trim();

  let settingsChanged = false;
  let securityChanged = false;
  let pinMigrated = false;
  let weakPin = Boolean(security.pinChangeRequired);
  let sessionsRevoked = 0;
  let tabletsRevoked = 0;

  if (!security.adminPinHash && legacyPin) {
    security.adminPinHash = adminPinHash(legacyPin);
    weakPin = !validNewAdminPin(legacyPin);
    security.pinChangeRequired = weakPin;
    security.pinUpdatedAt = new Date().toISOString();
    pinMigrated = true;
    securityChanged = true;
  }

  if (Object.prototype.hasOwnProperty.call(settings, 'adminPin')) {
    delete settings.adminPin;
    settingsChanged = true;
  }
  if (Object.prototype.hasOwnProperty.call(settings, 'adminPinHash')) {
    delete settings.adminPinHash;
    settingsChanged = true;
  }

  if (Array.isArray(security.adminSessions) && security.adminSessions.length) {
    sessionsRevoked = security.adminSessions.length;
    security.adminSessions = [];
    securityChanged = true;
  } else if (!Array.isArray(security.adminSessions)) {
    security.adminSessions = [];
    securityChanged = true;
  }

  if (options.revokeTablets) {
    tabletsRevoked = Array.isArray(security.tabletDevices)
      ? security.tabletDevices.length
      : 0;
    if (
      tabletsRevoked
      || security.tabletToken
      || security.tabletExpires
      || !Array.isArray(security.tabletDevices)
    ) {
      security.tabletDevices = [];
      security.tabletToken = null;
      security.tabletExpires = null;
      securityChanged = true;
    }
  }

  if (options.apply) {
    if (settingsChanged) {
      settingsDocument.settings = settings;
      writeJsonAtomic(settingsFile, settingsDocument);
    }
    if (securityChanged) writeJsonAtomic(securityFile, security);
  }

  return {
    company: path.basename(directory),
    changed: settingsChanged || securityChanged,
    pinMigrated,
    weakPin,
    sessionsRevoked,
    tabletsRevoked,
    missingPin: !security.adminPinHash,
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const stat = fs.statSync(options.dataDir);
  if (!stat.isDirectory()) throw new Error('Data path is not a directory');

  const companies = companyDirectories(options.dataDir)
    .map((directory) => migrateCompany(directory, options));
  const summary = {
    mode: options.apply ? 'apply' : 'dry-run',
    companies: companies.length,
    changed: companies.filter((company) => company.changed).length,
    pinsMigrated: companies.filter((company) => company.pinMigrated).length,
    weakPinsRequiringChange: companies.filter((company) => company.weakPin).length,
    adminSessionsRevoked: companies.reduce((sum, company) => sum + company.sessionsRevoked, 0),
    tabletDevicesRevoked: companies.reduce((sum, company) => sum + company.tabletsRevoked, 0),
    companiesMissingPin: companies.filter((company) => company.missingPin).length,
  };
  process.stdout.write(`${JSON.stringify(summary)}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
