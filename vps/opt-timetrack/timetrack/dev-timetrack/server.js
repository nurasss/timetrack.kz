const http = require('http');
const tls = require('tls');
const net = require('net');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Minimal .env loader (no dotenv dependency in this project): KEY=value
// lines, blank/`#` lines ignored, doesn't override already-set env vars.
function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnvFile(path.join(__dirname, '.env'));

const PORT = Number(process.env.PORT || 8787);
const STATIC_ROOT = path.join(__dirname, 'public');
const DATA_DIR = process.env.TIMETRACK_DATA_DIR
  ? path.resolve(process.env.TIMETRACK_DATA_DIR)
  : path.join(__dirname, 'data');
const COMPANIES_FILE = path.join(DATA_DIR, 'companies.json');
const LAST_LOGINS_FILE = path.join(DATA_DIR, 'last-logins.json');
const DUPLICATE_WINDOW_MS = 120000;
const ADMIN_ACTIONS = new Set([
  'saveEmployee',
  'deleteEmployee',
  'updateSettings',
  'clearLogs',
  'deleteCompany',
  'requestTabletAccess',
  'manualPhoto',
  'listTabletDevices',
  'revokeTabletDevice',
  'revokeAllTabletDevices',
  'listUsers',
  'saveUser',
  'deleteUser',
]);
const MAX_PIN_ATTEMPTS = 6;
const PIN_LOCKOUT_MS = 900000;
const BACKUP_KEEP = 20;
const RESET_TOKEN_TTL_MS = 1800000;
const RESET_REQUEST_COOLDOWN_MS = 120000;
const EMAIL_VERIFY_TTL_MS = 86400000;
const TABLET_ACCESS_TTL_MS = 60000;
const TABLET_DEVICE_TTL_MS = 7776000000;
const ADMIN_SESSION_TTL_MS = 43200000;
const ADMIN_SESSION_MAX = 10;
const PIN_PBKDF2_ITERATIONS = 600000;
const MANUAL_PHOTO_MAX_BYTES = 900000;
const PHOTO_MAX_BYTES = 1200000;
const PHOTO_MAX_DATA_URL_LENGTH = 1700000;
const OFFLINE_MAX_AGE_MS = 900000;
const CLOCK_FUTURE_TOLERANCE_MS = 30000;
const PIN_CHANGE_MAX_ATTEMPTS = 5;
const PIN_CHANGE_LOCKOUT_MS = 900000;
const MANUAL_APPROVAL_MAX_ATTEMPTS = 5;
const MANUAL_APPROVAL_LOCKOUT_MS = 900000;
const RATE_LIMIT_WINDOW_MS = 900000;
const RATE_LIMIT_MAX = 30;
const DEVICE_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;
const EVENT_ID_PATTERN = /^[a-zA-Z0-9_-]{1,96}$/;
const ALLOWED_ORIGINS = new Set(['https://timetrack.kz', 'https://www.timetrack.kz', 'http://localhost:8787', 'http://127.0.0.1:8787']);

const DEFAULT_STATE = {
  employees: [],
  logs: [],
  settings: {
    recognitionModel: 'tiny',
    matchThreshold: 0.55,
    lateMinutes: 15,
    schedules: [],
  },
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

function clone(v) { return JSON.parse(JSON.stringify(v)); }

function validSlug(s) { return /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/.test(s); }

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  try { fs.chmodSync(dir, 0o700); } catch {}
}

function restrictFile(file) {
  if (fs.existsSync(file)) {
    try { fs.chmodSync(file, 0o600); } catch {}
  }
}

function writeAtomic(file, data) {
  ensureDir(path.dirname(file));
  const temp = `${file}.${process.pid}.${crypto.randomBytes(8).toString('hex')}.tmp`;
  let fd;
  try {
    fd = fs.openSync(temp, 'wx', 0o600);
    fs.writeFileSync(fd, data);
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    fs.renameSync(temp, file);
    restrictFile(file);
  } catch (error) {
    if (fd !== undefined) {
      try { fs.closeSync(fd); } catch {}
    }
    try { fs.unlinkSync(temp); } catch {}
    throw error;
  }
}

function writeJson(file, value) {
  writeAtomic(file, `${JSON.stringify(value, null, 2)}\n`);
}

function readCompanies() {
  if (!fs.existsSync(COMPANIES_FILE)) return [];
  restrictFile(COMPANIES_FILE);
  const parsed = JSON.parse(fs.readFileSync(COMPANIES_FILE, 'utf8'));
  if (!Array.isArray(parsed)) throw new Error('Invalid companies state');
  return parsed;
} 

function writeCompanies(list) {
  ensureDir(DATA_DIR);
  writeJson(COMPANIES_FILE, list);
}

function companyDir(slug) { return path.join(DATA_DIR, slug); }
function storeFile(slug) { return path.join(companyDir(slug), 'store.json'); }
function employeesFile(slug) { return path.join(companyDir(slug), 'employees.json'); }
function settingsFile(slug) { return path.join(companyDir(slug), 'settings.json'); }
function logsFile(slug) { return path.join(companyDir(slug), 'logs.json'); }
function manualPhotosDir(slug) { return path.join(companyDir(slug), 'manual_photos'); }

function readJsonSafe(file) {
  if (!fs.existsSync(file)) return null;
  restrictFile(file);
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid JSON state');
  return parsed;
}

function legacyReadState(slug) {
  const parsed = readJsonSafe(storeFile(slug));
  if (!parsed) return clone(DEFAULT_STATE);
  if (!Array.isArray(parsed.employees) || !Array.isArray(parsed.logs)) throw new Error('Invalid legacy state');
  return {
    employees: parsed.employees,
    logs: parsed.logs,
    settings: { ...DEFAULT_STATE.settings, ...(parsed.settings || {}) },
  };
}

function writeEmployees(slug, state) {
  ensureDir(companyDir(slug));
  writeJson(employeesFile(slug), { employees: state.employees });
}

function writeSettings(slug, state) {
  ensureDir(companyDir(slug));
  writeJson(settingsFile(slug), { settings: state.settings });
}

function writeLogs(slug, state) {
  ensureDir(companyDir(slug));
  writeJson(logsFile(slug), { logs: state.logs });
}

// Storage is split into three files per company so the high-frequency
// addLog action (every kiosk tap) never has to rewrite employee photos/face
// descriptors, and a settings change never has to rewrite the logs.
function readState(slug) {
  const employeesPath = employeesFile(slug);
  const settingsPath = settingsFile(slug);
  const logsPath = logsFile(slug);

  if (fs.existsSync(employeesPath) || fs.existsSync(settingsPath) || fs.existsSync(logsPath)) {
    const employeesRaw = fs.existsSync(employeesPath) ? readJsonSafe(employeesPath) : null;
    const settingsRaw = fs.existsSync(settingsPath) ? readJsonSafe(settingsPath) : null;
    const logsRaw = fs.existsSync(logsPath) ? readJsonSafe(logsPath) : null;
    if ((employeesRaw && !Array.isArray(employeesRaw.employees)) || (logsRaw && !Array.isArray(logsRaw.logs)) || (settingsRaw && (!settingsRaw.settings || typeof settingsRaw.settings !== 'object' || Array.isArray(settingsRaw.settings)))) {
      throw new Error('Invalid company state');
    }
    const state = {
      employees: employeesRaw?.employees || [],
      settings: { ...DEFAULT_STATE.settings, ...(settingsRaw?.settings || {}) },
      logs: logsRaw?.logs || [],
    };
    return normalizeStoredState(state);
  }

  const state = normalizeStoredState(legacyReadState(slug));
  writeEmployees(slug, state);
  writeSettings(slug, state);
  writeLogs(slug, state);
  const legacy = storeFile(slug);
  if (fs.existsSync(legacy)) {
    try { fs.renameSync(legacy, `${legacy}.migrated`); } catch {}
  }
  return state;
}

function publicState(state) {
  const next = clone(state);
  if (next.settings) {
    delete next.settings.adminPin;
    delete next.settings.adminPinHash;
  }
  return next;
}

function stateForRole(state, role) {
  const next = publicState(state);
  if (role === 'owner' || role === 'admin') return next;
  if (role === 'recruiter') {
    next.logs = (next.logs || []).map((log) => {
      const copy = { ...log };
      delete copy.empPhoto;
      delete copy.manualPhoto;
      return copy;
    });
    return next;
  }
  next.employees = (next.employees || []).map((employee) => {
    const copy = { ...employee };
    delete copy.photo;
    delete copy.descriptor;
    return copy;
  });
  next.logs = (next.logs || []).map((log) => {
    const copy = { ...log };
    delete copy.empPhoto;
    return copy;
  });
  return next;
}

function kazakhstanDateKey(value = new Date()) {
  const dateParts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Qyzylorda',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const part = (type) => dateParts.find((item) => item.type === type)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function logKazakhstanDateKey(log) {
  const timestamp = Date.parse(log?.eventTimestamp || log?.clientTimestamp || log?.ts || log?.at || '');
  if (Number.isFinite(timestamp)) return kazakhstanDateKey(new Date(timestamp));

  const rawDate = String(log?.date || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) return rawDate;
  const displayDate = rawDate.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  return displayDate ? `${displayDate[3]}-${displayDate[2]}-${displayDate[1]}` : '';
}

function tabletState(state) {
  const today = kazakhstanDateKey();
  return {
    employees: (Array.isArray(state.employees) ? state.employees : []).map((employee) => ({
      id: employee.id || '',
      fname: employee.fname || '',
      lname: employee.lname || '',
      workStart: employee.workStart || '09:00',
      scheduleId: employee.scheduleId || '',
      descriptor: employee.descriptor || null,
    })),
    logs: (Array.isArray(state.logs) ? state.logs : [])
      .filter((log) => logKazakhstanDateKey(log) === today)
      .map((log) => ({
        id: log.id || '',
        empId: log.empId || '',
        type: log.type || '',
        date: log.date || '',
        time: log.time || '',
        ts: log.ts || '',
        at: log.at || '',
        manual: Boolean(log.manual),
        verification: log.verification === 'manual' ? 'manual' : '',
      })),
    settings: {
      recognitionModel: state.settings?.recognitionModel === 'ssd' ? 'ssd' : 'tiny',
      matchThreshold: number(state.settings?.matchThreshold, 0.55, 0.35, 0.55),
      lateMinutes: number(state.settings?.lateMinutes, 15, 0, 120),
      schedules: schedules(state.settings?.schedules),
    },
  };
}

const PAGE_CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob:",
  "connect-src 'self' https://raw.githubusercontent.com",
  "frame-src 'self' https://www.youtube.com https://youtube.com",
  "worker-src 'self' blob:",
  "manifest-src 'self' blob:",
  'upgrade-insecure-requests',
].join('; ');

const SAME_ORIGIN_PREVIEW_CSP = [
  "default-src 'none'",
  "base-uri 'none'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "form-action 'none'",
  "style-src 'unsafe-inline'",
].join('; ');

function applySecurityHeaders(res, api = false, allowSameOriginFrame = false) {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', api ? 'no-referrer' : 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', api
    ? 'camera=(), microphone=(), geolocation=()'
    : 'camera=(self), microphone=(), geolocation=()');
  res.setHeader('X-Frame-Options', allowSameOriginFrame ? 'SAMEORIGIN' : 'DENY');
  res.setHeader('Content-Security-Policy', api
    ? "default-src 'none'; frame-ancestors 'none'"
    : (allowSameOriginFrame ? SAME_ORIGIN_PREVIEW_CSP : PAGE_CSP));
}

function json(res, status, payload) {
  applySecurityHeaders(res, true);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(payload));
}

function applyCors(req, res) {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }
}

function securityFile(slug) { return path.join(companyDir(slug), 'security.json'); }

function defaultSecurity() {
  return {
    adminPinHash: null,
    ownerLogin: 'admin',
    pinChangeRequired: false,
    pinUpdatedAt: null,
    adminSessions: [],
    failedAttempts: 0, lockUntil: null,
    loginAttempts: {},
    pinChangeAttempts: 0, pinChangeLockUntil: null,
    manualApprovalAttempts: 0, manualApprovalLockUntil: null,
    resetToken: null, resetExpires: null, lastResetRequestAt: null,
    verifyToken: null, verifyExpires: null, lastVerifyRequestAt: null,
    tabletToken: null, tabletExpires: null,
    tabletDevices: [],
    users: [],
  };
}

// Companies created before this feature shipped have no `emailVerified` key
// at all — treat that as already-verified (grandfathered in), so deploying
// this doesn't lock out existing live companies. Only an explicit `false`
// (set by a fresh registration) blocks access.
function companyIsVerified(company) {
  if (!company) return false;
  if (!('emailVerified' in company)) return true;
  return company.emailVerified === true;
}

function readSecurity(slug) {
  if (!fs.existsSync(securityFile(slug))) return defaultSecurity();
  restrictFile(securityFile(slug));
  const parsed = JSON.parse(fs.readFileSync(securityFile(slug), 'utf8'));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid security state');
  return { ...defaultSecurity(), ...parsed };
}

function writeSecurity(slug, security) {
  ensureDir(companyDir(slug));
  writeJson(securityFile(slug), security);
}

function safeEqual(a, b) {
  const left = String(a || '');
  const right = String(b || '');
  if (!left || !right || left.length !== right.length) return false;
  return crypto.timingSafeEqual(Buffer.from(left), Buffer.from(right));
}

function validNewAdminPin(pin) {
  const value = String(pin || '');
  if (!/^\d{6,12}$/.test(value)) return false;
  if (new Set(['000000', '111111', '123456', '654321', '123123', '121212', '112233', '1234']).has(value)) {
    return false;
  }
  return new Set(value).size > 1;
}

function adminPinHash(pin) {
  const salt = crypto.randomBytes(16);
  const derived = crypto.pbkdf2Sync(String(pin), salt, PIN_PBKDF2_ITERATIONS, 32, 'sha256');
  return `pbkdf2-sha256$${PIN_PBKDF2_ITERATIONS}$${salt.toString('base64')}$${derived.toString('base64')}`;
}

function verifyAdminPinHash(pin, encoded) {
  const parts = String(encoded || '').split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2-sha256') return false;
  const iterations = Number(parts[1]);
  const salt = Buffer.from(parts[2], 'base64');
  const expected = Buffer.from(parts[3], 'base64');
  if (!Number.isInteger(iterations) || iterations < 100000 || iterations > 2000000 || !salt.length || expected.length !== 32) {
    return false;
  }
  const actual = crypto.pbkdf2Sync(String(pin), salt, iterations, 32, 'sha256');
  return crypto.timingSafeEqual(expected, actual);
}

function migrateAdminCredentials(state, slug) {
  const security = readSecurity(slug);
  const legacyPin = String(state.settings?.adminPin || '').trim();
  let securityChanged = false;
  let settingsChanged = false;
  if (!security.adminPinHash && legacyPin) {
    security.adminPinHash = adminPinHash(legacyPin);
    security.pinChangeRequired = !validNewAdminPin(legacyPin);
    security.pinUpdatedAt = new Date().toISOString();
    securityChanged = true;
  }
  const devices = tabletDevices(security);
  const hashedDevices = devices.filter((device) => device.tokenHash);
  if (hashedDevices.length !== devices.length) {
    security.tabletDevices = hashedDevices;
    security.tabletToken = null;
    security.tabletExpires = null;
    securityChanged = true;
  }
  if (state.settings && 'adminPin' in state.settings) {
    delete state.settings.adminPin;
    settingsChanged = true;
  }
  if (state.settings && 'adminPinHash' in state.settings) {
    delete state.settings.adminPinHash;
    settingsChanged = true;
  }
  if (settingsChanged) writeSettings(slug, state);
  if (securityChanged) writeSecurity(slug, security);
  return security;
}

function adminCookieName(slug) {
  return `tt_admin_${crypto.createHash('sha256').update(slug).digest('hex').slice(0, 16)}`;
}

function parseCookies(req) {
  const output = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const index = part.indexOf('=');
    if (index <= 0) continue;
    output[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return output;
}

function requestIsHttps(req) {
  if (String(req.headers['x-forwarded-proto'] || '').toLowerCase() === 'https') return true;
  const host = String(req.headers.host || '').toLowerCase();
  return host === 'timetrack.kz' || host.startsWith('timetrack.kz:') || host === 'www.timetrack.kz' || host.startsWith('www.timetrack.kz:');
}

function setAdminCookie(req, res, slug, token, expiresAt) {
  const secure = requestIsHttps(req) ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${adminCookieName(slug)}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Expires=${expiresAt.toUTCString()}${secure}`,
  );
}

function clearAdminCookie(req, res, slug) {
  const secure = requestIsHttps(req) ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${adminCookieName(slug)}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`,
  );
}

function adminSessions(security) {
  return Array.isArray(security.adminSessions) ? security.adminSessions : [];
}

function pruneAdminSessions(security) {
  security.adminSessions = adminSessions(security)
    .filter((session) => session.expiresAt && Date.parse(session.expiresAt) > Date.now())
    .slice(-ADMIN_SESSION_MAX);
  return security;
}

function users(security) { return Array.isArray(security.users) ? security.users : []; }
function userRole(value) { return ['owner', 'admin', 'recruiter', 'accountant'].includes(value) ? value : 'accountant'; }
function publicUsers(security) { return users(security).map(({ passwordHash, email, ...user }) => ({ ...user, login: user.login || email || '' })); }
function validPassword(value) { return typeof value === 'string' && value.length >= 8 && value.length <= 128; }

function issueAdminSession(req, res, slug, pinChangeRequired = false, user = { id: 'owner', role: 'owner', name: 'Администратор' }) {
  const security = pruneAdminSessions(readSecurity(slug));
  const token = crypto.randomBytes(32).toString('hex');
  const csrfToken = crypto.randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + ADMIN_SESSION_TTL_MS);
  security.adminSessions = [
    ...adminSessions(security),
    {
      id: `as${crypto.randomBytes(8).toString('hex')}`,
      tokenHash: crypto.createHash('sha256').update(token).digest('hex'),
      csrfToken,
      pinChangeRequired: Boolean(pinChangeRequired),
      userId: user.id || 'owner',
      role: userRole(user.role || 'admin'),
      userName: text(user.name || 'Администратор', 80),
      createdAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
    },
  ].slice(-ADMIN_SESSION_MAX);
  writeSecurity(slug, security);
  setAdminCookie(req, res, slug, token, expiresAt);
  return { csrfToken, pinChangeRequired: Boolean(pinChangeRequired) };
}

function currentAdminSession(req, security, slug) {
  const token = String(parseCookies(req)[adminCookieName(slug)] || '').trim();
  if (!token) return null;
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const index = adminSessions(security).findIndex((session) => (
    session.expiresAt
    && Date.parse(session.expiresAt) > Date.now()
    && safeEqual(session.tokenHash, tokenHash)
  ));
  return index >= 0 ? { index, session: security.adminSessions[index] } : null;
}

function requireAdminSession(req, res, slug, { csrfRequired = false, allowPinChange = false } = {}) {
  const security = pruneAdminSessions(readSecurity(slug));
  const match = currentAdminSession(req, security, slug);
  if (!match) {
    clearAdminCookie(req, res, slug);
    return { ok: false, status: 401, error: 'Сессия админки истекла. Войдите снова.', code: 'ADMIN_AUTH_REQUIRED' };
  }
  const csrfToken = String(match.session.csrfToken || '');
  if (match.session.pinChangeRequired && !allowPinChange) {
    return {
      ok: false,
      status: 428,
      error: 'Установите новый безопасный PIN для продолжения.',
      code: 'PIN_CHANGE_REQUIRED',
      csrfToken,
    };
  }
  if (csrfRequired) {
    const provided = String(req.headers['x-csrf-token'] || '').trim();
    if (!provided || !csrfToken || !safeEqual(provided, csrfToken)) {
      return { ok: false, status: 403, error: 'Защитный токен запроса недействителен', code: 'CSRF_FAILED' };
    }
  }
  const lastSeenAt = Date.parse(match.session.lastSeenAt || '') || 0;
  if (Date.now() - lastSeenAt >= 300000) {
    security.adminSessions[match.index].lastSeenAt = new Date().toISOString();
    writeSecurity(slug, security);
  }
  return { ok: true, security, session: match.session, csrfToken };
}

function sessionRole(auth) { return userRole(auth?.session?.role || 'admin'); }
function allowRole(auth, roles) { return roles.includes(sessionRole(auth)); }

function tabletDevices(security) {
  return Array.isArray(security.tabletDevices) ? security.tabletDevices : [];
}

function publicTabletDevices(security) {
  return tabletDevices(security)
    .filter((device) => !device.revokedAt)
    .map((device) => ({
      id: device.id || '',
      createdAt: device.createdAt || null,
      lastSeenAt: device.lastSeenAt || null,
      expiresAt: device.expiresAt || null,
    }));
}

function tabletTokenHash(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function requireTabletDevice(body, slug) {
  const token = String(body.deviceToken || body.tabletDeviceToken || '').trim();
  const deviceId = String(body.deviceId || body.tabletDeviceId || '').trim();
  if (!DEVICE_ID_PATTERN.test(deviceId)) {
    return { ok: false, status: 403, error: 'Идентификатор планшета недействителен', code: 'TABLET_DEVICE_REQUIRED' };
  }
  const security = readSecurity(slug);
  const tokenHash = token ? tabletTokenHash(token) : '';
  const index = tabletDevices(security).findIndex((device) => (
    tokenHash
    && device.tokenHash
    && device.id === deviceId
    && !device.revokedAt
    && (!device.expiresAt || Date.parse(device.expiresAt) > Date.now())
    && safeEqual(device.tokenHash, tokenHash)
  ));
  if (index < 0) {
    return { ok: false, status: 403, error: 'Доступ планшета отозван или истёк. Создайте новый QR-код в админке.', code: 'TABLET_AUTH_REQUIRED' };
  }
  const lastSeenAt = Date.parse(security.tabletDevices[index].lastSeenAt || '') || 0;
  if (Date.now() - lastSeenAt >= 300000) {
    security.tabletDevices[index].lastSeenAt = new Date().toISOString();
    writeSecurity(slug, security);
  }
  return { ok: true, device: security.tabletDevices[index] };
}

function pinLockRemainingMs(security) {
  if (!security.lockUntil) return 0;
  return Math.max(0, Date.parse(security.lockUntil) - Date.now());
}

// Brute-force guard mirrors api.php: failures while locked don't reset the
// lock early, so the attacker can't use timing to learn anything either.
function requireAdminPin(body, slug) {
  const security = readSecurity(slug);
  const remaining = pinLockRemainingMs(security);
  if (remaining > 0) {
    return { ok: false, status: 429, error: `Слишком много попыток входа. Попробуйте через ${Math.ceil(remaining / 60000)} мин.` };
  }
  const pin = String(body.adminPin || '').trim();
  if (!pin || !security.adminPinHash || !verifyAdminPinHash(pin, security.adminPinHash)) {
    security.failedAttempts = (security.failedAttempts || 0) + 1;
    if (security.failedAttempts >= MAX_PIN_ATTEMPTS) {
      security.lockUntil = new Date(Date.now() + PIN_LOCKOUT_MS).toISOString();
      security.failedAttempts = 0;
    }
    writeSecurity(slug, security);
    return { ok: false, status: 403, error: 'Неверный PIN админки' };
  }
  // Only clear the brute-force counters — this helper runs on every
  // admin-authorized action (saveEmployee, requestTabletAccess, ...), so
  // wiping the whole security record here would also nuke unrelated,
  // still-pending tokens like a freshly issued tablet QR token.
  security.failedAttempts = 0;
  security.lockUntil = null;
  writeSecurity(slug, security);
  return { ok: true, security };
}

// Minimal SMTP client over a raw TLS socket (no nodemailer/deps in this
// project). Handles AUTH LOGIN over implicit TLS (port 465) only — all the
// configured provider needs.
function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT);
}

// AUTH+TLS is only used when SMTP_USER/SMTP_PASS are set (external provider,
// e.g. a real mailbox over implicit TLS on port 465). Without credentials,
// this connects in the clear with no AUTH — meant for a local Postfix relay
// on a trusted private network (e.g. the docker bridge) that authorizes by
// source IP via mynetworks, not by login.
// Plain-text emails risk a confirmation/reset link getting visually
// line-wrapped by the recipient's client, which can make its auto-link
// detector grab only part of the URL (silently dropping the token). Sending
// as HTML with a real <a href> sidesteps that — the href is a literal
// attribute, independent of how the visible text wraps.
function textToHtml(text) {
  const escaped = String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const linked = escaped.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>');
  return linked.replace(/\n/g, '<br>\n');
}

function sendEmail(to, subject, bodyText) {
  return new Promise((resolve) => {
    if (!smtpConfigured()) {
      console.error(`SMTP not configured (.env missing/incomplete); skipping email to ${to}`);
      resolve(false);
      return;
    }

    const useAuth = Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
    const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || `no-reply@timetrack.kz`;

    const encodedSubject = `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`;
    const htmlBody = `<!DOCTYPE html><html><body style="font-family:sans-serif;font-size:15px;line-height:1.5">${textToHtml(bodyText)}</body></html>`;
    const headers = `From: Timetrack <${fromAddress}>\r\n`
      + `To: <${to}>\r\n`
      + `Subject: ${encodedSubject}\r\n`
      + 'MIME-Version: 1.0\r\n'
      + 'Content-Type: text/html; charset=UTF-8\r\n'
      + 'Content-Transfer-Encoding: base64\r\n\r\n';
    const body = headers + Buffer.from(htmlBody, 'utf8').toString('base64').replace(/(.{76})/g, '$1\r\n');

    // Each entry: wait for `expect` reply code, then `send` the next line.
    // Index 0 has send=null — it just waits for the server's 220 greeting.
    const sequence = [
      { send: null, expect: '220' },
      { send: 'EHLO timetrack.kz', expect: '250' },
      ...(useAuth ? [
        { send: 'AUTH LOGIN', expect: '334' },
        { send: Buffer.from(process.env.SMTP_USER, 'utf8').toString('base64'), expect: '334' },
        { send: Buffer.from(process.env.SMTP_PASS, 'utf8').toString('base64'), expect: '235' },
      ] : []),
      { send: `MAIL FROM:<${fromAddress}>`, expect: '250' },
      { send: `RCPT TO:<${to}>`, expect: '250' },
      { send: 'DATA', expect: '354' },
      { send: `${body}\r\n.`, expect: '250' },
    ];

    const connectOptions = { host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT), timeout: 10000 };
    const socket = useAuth ? tls.connect(connectOptions) : net.connect(connectOptions);
    let buffer = '';
    let finished = false;
    let idx = 0;

    const finish = (ok) => {
      if (finished) return;
      finished = true;
      try { socket.end(); } catch {}
      resolve(ok);
    };

    socket.on('error', () => finish(false));
    socket.on('timeout', () => finish(false));

    socket.on('data', (chunk) => {
      if (finished) return; // e.g. the server's "221 bye" reply to our QUIT
      buffer += chunk.toString('utf8');
      const lines = buffer.split('\r\n').filter(Boolean);
      const last = lines[lines.length - 1] || '';
      if (!/^\d{3} /.test(last)) return; // multi-line reply not finished yet
      const code = last.slice(0, 3);
      buffer = '';

      if (code !== sequence[idx].expect) { finish(false); return; }
      idx++;
      if (idx >= sequence.length) {
        try { socket.write('QUIT\r\n'); } catch {}
        finish(true);
        return;
      }
      socket.write(`${sequence[idx].send}\r\n`);
    });
  });
}

function baseUrl(req) {
  const host = req.headers.host || 'timetrack.kz';
  const proto = req.headers['x-forwarded-proto'] || 'http';
  return `${proto}://${host}`;
}

// Caddy's reverse_proxy sets X-Forwarded-For automatically, so this is the
// real visitor IP even though this Node process sits behind it.
function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.socket.remoteAddress || '';
}

const requestRateBuckets = new Map();

function allowRequestRate(req, scope, max = RATE_LIMIT_MAX, windowMs = RATE_LIMIT_WINDOW_MS) {
  const ip = clientIp(req) || 'unknown';
  const key = `${scope}:${crypto.createHash('sha256').update(ip).digest('hex')}`;
  const now = Date.now();
  const bucket = requestRateBuckets.get(key) || [];
  const active = bucket.filter((value) => value > now - windowMs);
  if (active.length >= max) {
    requestRateBuckets.set(key, active);
    return false;
  }
  active.push(now);
  requestRateBuckets.set(key, active);
  if (requestRateBuckets.size > 5000) {
    for (const [bucketKey, values] of requestRateBuckets) {
      if (!values.some((value) => value > now - windowMs)) requestRateBuckets.delete(bucketKey);
    }
  }
  return true;
}

function rateLimited(res, scope) {
  return json(res, 429, { ok: false, error: `Слишком много запросов: ${scope}`, code: 'RATE_LIMITED' });
}

function loginKey(login) {
  return crypto.createHash('sha256').update(String(login || '').trim().toLowerCase()).digest('hex');
}

function userLoginLocked(security, login) {
  const record = security.loginAttempts?.[loginKey(login)];
  return Boolean(record?.lockUntil && Date.parse(record.lockUntil) > Date.now());
}

function userLoginFailure(security, login) {
  const key = loginKey(login);
  const current = security.loginAttempts?.[key] || { attempts: 0, lockUntil: null };
  current.attempts = (Number(current.attempts) || 0) + 1;
  if (current.attempts >= MAX_PIN_ATTEMPTS) {
    current.lockUntil = new Date(Date.now() + PIN_LOCKOUT_MS).toISOString();
    current.attempts = 0;
  }
  security.loginAttempts = { ...(security.loginAttempts || {}), [key]: current };
}

function clearUserLoginFailures(security, login) {
  const key = loginKey(login);
  if (security.loginAttempts?.[key]) {
    const next = { ...security.loginAttempts };
    delete next[key];
    security.loginAttempts = next;
  }
}

function verifyOwnerPin(body, slug, purpose = 'pin') {
  const security = readSecurity(slug);
  const now = Date.now();
  const lockField = purpose === 'manual' ? 'manualApprovalLockUntil' : 'pinChangeLockUntil';
  const attemptsField = purpose === 'manual' ? 'manualApprovalAttempts' : 'pinChangeAttempts';
  const maxAttempts = purpose === 'manual' ? MANUAL_APPROVAL_MAX_ATTEMPTS : PIN_CHANGE_MAX_ATTEMPTS;
  const lockMs = purpose === 'manual' ? MANUAL_APPROVAL_LOCKOUT_MS : PIN_CHANGE_LOCKOUT_MS;
  const lockUntil = Date.parse(security[lockField] || '');
  if (Number.isFinite(lockUntil) && lockUntil > now) {
    return { ok: false, status: 429, error: 'Слишком много попыток. Повторите позже.' };
  }
  const pin = String(purpose === 'manual' ? (body.supervisorPin || body.currentPin || '') : (body.currentPin || '')).trim();
  if (!pin || !security.adminPinHash || !verifyAdminPinHash(pin, security.adminPinHash)) {
    security[attemptsField] = (Number(security[attemptsField]) || 0) + 1;
    if (security[attemptsField] >= maxAttempts) {
      security[lockField] = new Date(now + lockMs).toISOString();
      security[attemptsField] = 0;
    }
    writeSecurity(slug, security);
    return { ok: false, status: 403, error: 'Неверный PIN' };
  }
  security[attemptsField] = 0;
  security[lockField] = null;
  writeSecurity(slug, security);
  return { ok: true, security };
}

function appendAudit(security, entry) {
  const audit = Array.isArray(security.auditLog) ? security.auditLog : [];
  audit.push({ ...entry, at: new Date().toISOString() });
  security.auditLog = audit.slice(-500);
}

// Soft "remember this browser's last company" lookup, NOT authentication —
// whoAmI only ever suggests a company name/slug so index.html can offer a
// shortcut into login.html; the PIN is still required there either way.
function readLastLogins() {
  if (!fs.existsSync(LAST_LOGINS_FILE)) return {};
  restrictFile(LAST_LOGINS_FILE);
  const parsed = JSON.parse(fs.readFileSync(LAST_LOGINS_FILE, 'utf8'));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid last login state');
  return parsed;
}

function writeLastLogins(data) {
  ensureDir(DATA_DIR);
  writeJson(LAST_LOGINS_FILE, data);
}

function recordLastLogin(ip, slug, name) {
  if (!ip) return;
  const data = readLastLogins();
  data[ip] = { slug, name, lastLoginAt: new Date().toISOString() };
  // Keep the file from growing without bound on a busy shared IP pool.
  const keys = Object.keys(data);
  if (keys.length > 5000) {
    for (const key of keys.slice(0, keys.length - 2000)) delete data[key];
  }
  writeLastLogins(data);
}

function backupStore(slug) {
  const backupDir = path.join(companyDir(slug), 'backups');
  ensureDir(backupDir);
  const src = employeesFile(slug);
  if (fs.existsSync(src)) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const target = path.join(backupDir, `employees-${stamp}.json`);
    fs.copyFileSync(src, target);
    restrictFile(target);
  }
  const files = fs.readdirSync(backupDir).filter((f) => f.startsWith('employees-')).sort();
  const excess = files.length - BACKUP_KEEP;
  for (let i = 0; i < excess; i++) {
    fs.unlinkSync(path.join(backupDir, files[i]));
  }
}

function redactEmployeeHistory(slug, state, employeeId) {
  for (const log of state.logs) {
    if (log.empId !== employeeId) continue;
    if (isSafeManualPhotoPath(log.manualPhoto)) {
      const file = path.resolve(companyDir(slug), log.manualPhoto);
      const photoDir = path.resolve(manualPhotosDir(slug));
      if (file.startsWith(`${photoDir}${path.sep}`) && fs.existsSync(file)) fs.unlinkSync(file);
    }
    log.empName = 'Удалённый сотрудник';
    log.empIin = '';
    log.empPhoto = null;
    log.manualPhoto = '';
    delete log.recognition;
  }
  const backupDir = path.join(companyDir(slug), 'backups');
  if (fs.existsSync(backupDir)) {
    for (const name of fs.readdirSync(backupDir)) {
      if (!/^employees-[a-zA-Z0-9_.-]+\.json$/.test(name)) continue;
      const file = path.join(backupDir, name);
      const snapshot = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (!Array.isArray(snapshot.employees)) throw new Error('Invalid employee backup');
      snapshot.employees = snapshot.employees.filter((employee) => employee.id !== employeeId);
      writeJson(file, snapshot);
    }
  }
  for (const legacy of [storeFile(slug), `${storeFile(slug)}.migrated`]) {
    if (!fs.existsSync(legacy)) continue;
    const snapshot = JSON.parse(fs.readFileSync(legacy, 'utf8'));
    if (!Array.isArray(snapshot.employees) || !Array.isArray(snapshot.logs)) throw new Error('Invalid legacy state');
    snapshot.employees = snapshot.employees.filter((employee) => employee.id !== employeeId);
    snapshot.logs = snapshot.logs.map((log) => log.empId === employeeId
      ? { ...log, empName: 'Удалённый сотрудник', empIin: '', empPhoto: null, manualPhoto: '' }
      : log);
    writeJson(legacy, snapshot);
  }
}

function text(v, max = 120) {
  return String(v || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function id(v, prefix) {
  const cleaned = String(v || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  return cleaned || `${prefix}${Date.now()}${Math.floor(Math.random() * 9000 + 1000)}`;
}

function number(v, fallback, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function time(v, fallback = '09:00') {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(v || '')) ? String(v) : fallback;
}

function schedules(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 50).map((item, index) => {
    const start = time(item?.start, '09:00');
    const end = time(item?.end, '18:00');
    const days = [...new Set((Array.isArray(item?.days) ? item.days : [])
      .map(Number).filter((day) => Number.isInteger(day) && day >= 1 && day <= 7))].sort();
    return {
      id: id(item?.id, `s${index}`),
      name: text(item?.name, 80) || `График ${index + 1}`,
      days,
      start,
      end,
    };
  }).filter((item) => item.days.length && item.start < item.end);
}

function parsePhotoDataUrl(v) {
  if (typeof v !== 'string' || v.length > PHOTO_MAX_DATA_URL_LENGTH) return null;
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(v);
  if (!match || match[2].length % 4 !== 0) return null;
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length || buffer.length > PHOTO_MAX_BYTES) return null;
  if (buffer.toString('base64') !== match[2]) return null;
  const jpeg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const png = buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const webp = buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  if ((match[1] === 'jpeg' && !jpeg) || (match[1] === 'png' && !png) || (match[1] === 'webp' && !webp)) return null;
  return { mime: `image/${match[1]}`, buffer, dataUrl: `data:image/${match[1]};base64,${match[2]}` };
}

function photo(v) {
  return parsePhotoDataUrl(v)?.dataUrl || null;
}

function manualPhotoBuffer(v) {
  const parsed = parsePhotoDataUrl(v);
  if (!parsed || parsed.mime !== 'image/jpeg' || parsed.buffer.length < 64 || parsed.buffer.length > MANUAL_PHOTO_MAX_BYTES) return null;
  return parsed.buffer;
}

function isSafeManualPhotoPath(v) {
  return /^manual_photos\/[a-zA-Z0-9_.-]+\.jpg$/.test(String(v || ''));
}

function saveManualPhoto(slug, nextLog, buffer) {
  const dir = manualPhotosDir(slug);
  ensureDir(dir);
  const stamp = new Date(nextLog.ts).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, '').replace('T', '_');
  const empId = String(nextLog.empId || 'emp').replace(/[^a-zA-Z0-9_-]/g, '') || 'emp';
  const logId = String(nextLog.id || 'log').replace(/[^a-zA-Z0-9_-]/g, '') || 'log';
  let filename = `${stamp}_${empId}_${logId}.jpg`;
  let target = path.join(dir, filename);
  if (fs.existsSync(target)) {
    filename = `${stamp}_${empId}_${logId}_${crypto.randomBytes(3).toString('hex')}.jpg`;
    target = path.join(dir, filename);
  }
  writeAtomic(target, buffer);
  return `manual_photos/${filename}`;
}

function readManualPhotoDataUrl(slug, relativePath) {
  if (!isSafeManualPhotoPath(relativePath)) return null;
  const dir = path.resolve(manualPhotosDir(slug));
  const file = path.resolve(companyDir(slug), relativePath);
  if (!file.startsWith(`${dir}${path.sep}`) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return null;
  const parsed = parsePhotoDataUrl(`data:image/jpeg;base64,${fs.readFileSync(file).toString('base64')}`);
  return parsed?.mime === 'image/jpeg' ? parsed.dataUrl : null;
}

function descriptor(v) {
  if (!Array.isArray(v) || v.length < 64) return null;
  return v.slice(0, 256).map(Number).filter(Number.isFinite);
}

function strictId(v) {
  const value = String(v || '');
  return DEVICE_ID_PATTERN.test(value) ? value : '';
}

const BIOMETRIC_CONSENT_VERSION = 'privacy-20260924.1';

function biometricConsent(input = {}, current = {}) {
  const value = input && typeof input === 'object' && input.consent !== undefined ? input.consent : current?.consent;
  if (!value || typeof value !== 'object') return null;
  const grantedAt = Date.parse(value.grantedAt || '');
  if (value.granted !== true || !Number.isFinite(grantedAt) || value.revokedAt) return null;
  return {
    granted: true,
    version: String(value.version || BIOMETRIC_CONSENT_VERSION).slice(0, 64),
    grantedAt: new Date(grantedAt).toISOString(),
  };
}

function employee(input = {}, current = {}, options = {}) {
  const next = {
    id: id(input.id, 'e'),
    fname: text(input.fname, 80),
    lname: text(input.lname, 80),
    iin: text(input.iin, 12),
    position: text(input.position || 'Сотрудник', 100),
    dept: text(input.dept || 'Общий', 100),
    workStart: /^\d{2}:\d{2}$/.test(String(input.workStart || '')) ? input.workStart : '09:00',
    scheduleId: String(input.scheduleId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64),
    photo: photo(input.photo),
    descriptor: descriptor(input.descriptor),
  };
  next.consent = biometricConsent(input, current);
  if ((next.photo || next.descriptor) && !next.consent && !options.preserveStoredBiometrics) {
    return { error: 'Для сохранения фото или биометрического шаблона требуется согласие сотрудника', code: 'CONSENT_REQUIRED' };
  }
  return next;
}

function kazakhstanTime(when) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Qyzylorda',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(when).reduce((result, item) => {
    if (item.type === 'hour' || item.type === 'minute') result[item.type] = Number(item.value);
    return result;
  }, { hour: 0, minute: 0 });
}

function kazakhstanTimeString(when) {
  const parts = kazakhstanTime(when);
  return `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
}

function kazakhstanDisplayDate(when) {
  const [year, month, day] = kazakhstanDateKey(when).split('-');
  return `${day}.${month}.${year}`;
}

function attendanceEventMs(value) {
  const raw = value?.eventTimestamp || value?.clientTimestamp || value?.ts || value?.at;
  const parsed = Date.parse(raw || '');
  return Number.isFinite(parsed) ? parsed : 0;
}

function employeeLate(employeeRecord, settingsState, when) {
  if (!employeeRecord) return false;
  const local = new Date(when.getTime() + 5 * 60 * 60 * 1000);
  const weekDay = local.getUTCDay() || 7;
  const schedule = schedules(settingsState?.schedules).find((item) => item.id === employeeRecord.scheduleId && item.days.includes(weekDay));
  const start = schedule?.start || employeeRecord.workStart || '09:00';
  const [hour, minute] = start.split(':').map(Number);
  const current = kazakhstanTime(when);
  return current.hour * 60 + current.minute > hour * 60 + minute + number(settingsState?.lateMinutes, 15, 0, 120);
}

function normalizeStoredState(state) {
  const employees = (Array.isArray(state?.employees) ? state.employees : [])
    .map((value) => employee(value || {}, value || {}, { preserveStoredBiometrics: true }))
    .filter((value) => value.id && value.fname && value.lname);
  const employeeMap = new Map(employees.map((value) => [value.id, value]));
  const logs = (Array.isArray(state?.logs) ? state.logs : []).map((value) => {
    const input = value && typeof value === 'object' ? value : {};
    const logId = strictId(input.id);
    const employeeId = strictId(input.employeeId || input.empId);
    const rawTime = input.ts || input.at || input.eventTimestamp || input.clientTimestamp;
    const timestamp = Date.parse(rawTime || '');
    if (!logId || !employeeId || !Number.isFinite(timestamp)) return null;
    const when = new Date(timestamp);
    const employeeRecord = employeeMap.get(employeeId);
    const manual = Boolean(input.manual);
    const type = input.type === 'checkout' ? 'checkout' : 'checkin';
    const clientTimestamp = Date.parse(input.clientTimestamp || '');
    const eventId = EVENT_ID_PATTERN.test(String(input.eventId || '')) ? String(input.eventId) : '';
    const eventTimestamp = Number.isFinite(clientTimestamp) ? new Date(clientTimestamp).toISOString() : when.toISOString();
    return {
      id: logId,
      employeeId,
      empId: employeeId,
      empName: employeeRecord ? `${employeeRecord.fname} ${employeeRecord.lname}`.trim() : text(input.empName, 180),
      empIin: employeeRecord?.iin || '',
      empPhoto: employeeRecord?.photo || null,
      type,
      time: kazakhstanTimeString(when),
      date: kazakhstanDisplayDate(when),
      ts: when.toISOString(),
      at: when.toISOString(),
      eventTimestamp,
      isLate: type === 'checkin' ? employeeLate(employeeRecord, state.settings, when) : false,
      verification: manual ? 'manual' : '',
      manual,
      manualPhoto: isSafeManualPhotoPath(input.manualPhoto) ? String(input.manualPhoto) : '',
      ...(eventId ? { eventId } : {}),
      ...(Number.isFinite(clientTimestamp) ? { clientTimestamp: new Date(clientTimestamp).toISOString(), offline: true } : {}),
    };
  }).filter(Boolean);
  const normalizedSettings = settings(state?.settings || {}, DEFAULT_STATE.settings);
  if (typeof state?.settings?.adminPin === 'string') normalizedSettings.adminPin = state.settings.adminPin;
  if (typeof state?.settings?.adminPinHash === 'string') normalizedSettings.adminPinHash = state.settings.adminPinHash;
  return {
    employees,
    logs,
    settings: normalizedSettings,
  };
}

function parseAttendanceInput(input) {
  const raw = input && typeof input === 'object' ? input : {};
  const logId = strictId(raw.id);
  const employeeId = strictId(raw.employeeId || raw.empId);
  if (!logId) return { ok: false, status: 422, error: 'Некорректный идентификатор отметки', code: 'INVALID_LOG_ID' };
  if (!employeeId) return { ok: false, status: 422, error: 'Некорректный идентификатор сотрудника', code: 'INVALID_EMPLOYEE_ID' };
  if (raw.employeeId && raw.empId && String(raw.employeeId) !== String(raw.empId)) return { ok: false, status: 422, error: 'Идентификатор сотрудника не совпадает', code: 'INVALID_EMPLOYEE_ID' };
  if (raw.type !== 'checkin' && raw.type !== 'checkout') return { ok: false, status: 422, error: 'Некорректный тип отметки', code: 'INVALID_LOG_TYPE' };
  const offline = raw.offline === true;
  if (!offline && (raw.clientTimestamp !== undefined || raw.eventId !== undefined)) return { ok: false, status: 422, error: 'Онлайн-отметка не принимает клиентское время', code: 'CLIENT_TIME_NOT_ALLOWED' };
  if (offline && !EVENT_ID_PATTERN.test(String(raw.eventId || ''))) return { ok: false, status: 422, error: 'Некорректный eventId', code: 'INVALID_EVENT_ID' };
  const clientTimestamp = raw.clientTimestamp ? new Date(raw.clientTimestamp) : null;
  if (offline && (!clientTimestamp || Number.isNaN(clientTimestamp.getTime()))) return { ok: false, status: 422, error: 'Некорректное клиентское время', code: 'INVALID_CLIENT_TIMESTAMP' };
  return { ok: true, value: { id: logId, employeeId, type: raw.type, offline, eventId: offline ? String(raw.eventId) : '', clientTimestamp: offline ? clientTimestamp.toISOString() : '' } };
}

function buildAttendanceLog(input, employeeRecord, state, { manual = false, serverNow = new Date() } = {}) {
  const eventMs = input.offline ? Date.parse(input.clientTimestamp) : serverNow.getTime();
  const nowMs = serverNow.getTime();
  if (!Number.isFinite(eventMs) || eventMs > nowMs + CLOCK_FUTURE_TOLERANCE_MS || eventMs < nowMs - OFFLINE_MAX_AGE_MS) return { ok: false, status: 422, error: 'Отметка находится вне допустимого временного окна', code: 'TIME_WINDOW' };
  const previous = state.logs
    .filter((item) => item.empId === input.employeeId)
    .sort((a, b) => attendanceEventMs(a) - attendanceEventMs(b) || timestamp(a.ts) - timestamp(b.ts));
  const latest = previous[previous.length - 1];
  if (latest && eventMs < attendanceEventMs(latest)) return { ok: false, status: 409, error: 'Отметка противоречит более новой последовательности', code: 'OUT_OF_ORDER' };
  const expectedType = latest?.type === 'checkin' ? 'checkout' : 'checkin';
  if (input.type !== expectedType) return { ok: false, status: 409, error: `Сейчас доступна отметка: ${expectedType === 'checkin' ? 'приход' : 'уход'}`, code: 'INVALID_SEQUENCE' };
  if (previous.some((item) => item.type === input.type && Math.abs(attendanceEventMs(item) - eventMs) <= DUPLICATE_WINDOW_MS)) return { ok: false, status: 409, error: 'Такая отметка уже была недавно', code: 'DUPLICATE_ATTENDANCE' };
  const eventDate = new Date(eventMs);
  return {
    ok: true,
    log: {
      id: input.id,
      employeeId: employeeRecord.id,
      empId: employeeRecord.id,
      empName: `${employeeRecord.fname} ${employeeRecord.lname}`.trim(),
      empIin: employeeRecord.iin || '',
      empPhoto: employeeRecord.photo || null,
      type: expectedType,
      time: kazakhstanTimeString(eventDate),
      date: kazakhstanDisplayDate(eventDate),
      ts: serverNow.toISOString(),
      at: serverNow.toISOString(),
      eventTimestamp: eventDate.toISOString(),
      isLate: expectedType === 'checkin' ? employeeLate(employeeRecord, state.settings, eventDate) : false,
      verification: manual ? 'manual' : '',
      manual,
      manualPhoto: '',
      ...(input.offline ? { eventId: input.eventId, clientTimestamp: input.clientTimestamp, offline: true } : {}),
    },
  };
}

function settings(input = {}, current = {}) {
  return {
    recognitionModel: input.recognitionModel === 'ssd' ? 'ssd' : 'tiny',
    matchThreshold: number(input.matchThreshold, 0.55, 0.35, 0.55),
    lateMinutes: Math.round(number(input.lateMinutes, 15, 0, 120)),
    schedules: schedules(input.schedules ?? current.schedules),
  };
}

function timestamp(v) {
  const n = Date.parse(v);
  return Number.isFinite(n) ? n : 0;
}

function hasRecentDuplicate(logs, nextLog) {
  const nextTs = timestamp(nextLog.ts);
  return logs.some((item) => (
    item.empId === nextLog.empId &&
    item.type === nextLog.type &&
    Math.abs(timestamp(item.ts) - nextTs) <= DUPLICATE_WINDOW_MS
  ));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 2500000) { reject(new Error('payload too large')); req.destroy(); }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try { resolve(JSON.parse(body)); } catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

function serveStatic(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const allowSameOriginFrame = url.pathname === '/downloads/primer-tabelya-timetrack.html';
  applySecurityHeaders(res, false, allowSameOriginFrame);
  let decoded;
  try {
    decoded = decodeURIComponent(url.pathname);
  } catch {
    res.writeHead(400);
    res.end('Bad request');
    return;
  }
  const segments = decoded.split(/[\\/]+/).filter(Boolean);
  const blocked = new Set(['server.js', 'server.vps.js', 'api.php', 'smtp-config.php', 'kiosk.html', 'timetrack-legacy.html']);
  if (decoded.includes('\0') || segments.some((segment) => segment.startsWith('.') || blocked.has(segment) || segment === 'backups' || segment === 'data')) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  let filePath = path.resolve(STATIC_ROOT, `.${decoded}`);
  if (decoded.endsWith('/')) filePath = path.join(filePath, 'index.html');
  if (filePath !== STATIC_ROOT && !filePath.startsWith(`${STATIC_ROOT}${path.sep}`)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream' };
    if (['.html', '.json'].includes(ext)) headers['Cache-Control'] = 'no-store';
    res.writeHead(200, headers);
    res.end(data);
  });
}

async function handleAPI(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const action = url.searchParams.get('action') || 'state';
  const slug = (url.searchParams.get('c') || '').toLowerCase().trim();

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-CSRF-Token',
      'Access-Control-Allow-Credentials': 'true',
    });
    res.end();
    return;
  }

  const requestLimits = {
    register: [5, 3600000],
    checkAdminPin: [30, RATE_LIMIT_WINDOW_MS],
    requestPinReset: [10, RATE_LIMIT_WINDOW_MS],
    resetPin: [10, RATE_LIMIT_WINDOW_MS],
    confirmEmail: [20, RATE_LIMIT_WINDOW_MS],
    resendConfirmation: [10, RATE_LIMIT_WINDOW_MS],
    verifyTabletAccess: [20, RATE_LIMIT_WINDOW_MS],
    addLog: [120, RATE_LIMIT_WINDOW_MS],
    addManualLog: [30, RATE_LIMIT_WINDOW_MS],
    changeAdminPin: [10, RATE_LIMIT_WINDOW_MS],
  };
  const limit = requestLimits[action];
  if (req.method === 'POST' && limit && !allowRequestRate(req, action, limit[0], limit[1])) return rateLimited(res, action);

  if (action === 'register') {
    if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Метод не поддерживается' });
    const body = await readBody(req);
    const newSlug = (body.slug || '').toLowerCase().trim();
    const name = text(body.name, 120);
    const pin = String(body.pin || '').trim();
    const email = String(body.email || '').toLowerCase().trim();
    const acceptedPolicy = Boolean(body.acceptedPolicy);
    const acceptedOffer = Boolean(body.acceptedOffer);
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    if (!validSlug(newSlug)) return json(res, 422, { ok: false, error: 'Некорректный идентификатор' });
    if (!name) return json(res, 422, { ok: false, error: 'Укажите название компании' });
    if (!validNewAdminPin(pin)) {
      return json(res, 422, { ok: false, error: 'PIN должен содержать 6–12 цифр и не быть слишком простым' });
    }
    if (!emailValid) return json(res, 422, { ok: false, error: 'Укажите корректный email — на него можно будет восстановить PIN' });
    if (!acceptedPolicy || !acceptedOffer) {
      return json(res, 422, { ok: false, error: 'Необходимо подтвердить согласие с офертой и политикой конфиденциальности' });
    }

    if (fs.existsSync(companyDir(newSlug))) {
      return json(res, 409, { ok: false, error: 'Этот идентификатор уже занят' });
    }

    const initialState = clone(DEFAULT_STATE);
    ensureDir(companyDir(newSlug));
    ensureDir(manualPhotosDir(newSlug));
    writeEmployees(newSlug, initialState);
    writeSettings(newSlug, initialState);
    writeLogs(newSlug, initialState);

    const companies = readCompanies();
    companies.push({
      slug: newSlug,
      name,
      email,
      emailVerified: false,
      createdAt: new Date().toISOString(),
      consent: { policy: true, offer: true, acceptedAt: new Date().toISOString() },
    });
    writeCompanies(companies);

    const verifyToken = crypto.randomBytes(16).toString('hex');
    writeSecurity(newSlug, {
      ...defaultSecurity(),
      adminPinHash: adminPinHash(pin),
      pinUpdatedAt: new Date().toISOString(),
      verifyToken,
      verifyExpires: new Date(Date.now() + EMAIL_VERIFY_TTL_MS).toISOString(),
    });

    const base = baseUrl(req);
    sendEmail(
      email,
      'Timetrack — подтвердите email',
      `Спасибо за регистрацию в Timetrack!\n\n`
      + `Компания: ${name}\n\n`
      + `Подтвердите email, чтобы активировать компанию (ссылка действует 24 часа):\n`
      + `${base}/register.html?confirm=1&c=${newSlug}&token=${verifyToken}\n\n`
      + `После подтверждения откройте админ-панель:\n`
      + `${base}/admin.html?c=${newSlug}\n\n`
      + `Планшет подключается позже из настроек админки через QR-код.`,
    ).catch(() => {});

    return json(res, 200, { ok: true, company: { slug: newSlug, name, emailVerified: false } });
  }

  if (action === 'companies') {
    return json(res, 404, { ok: false, error: 'Публичный каталог компаний отключён' });
  }

  if (action === 'whoAmI') {
    return json(res, 404, { ok: false, error: 'Автоматическое определение компании отключено' });
  }

  if (!validSlug(slug)) {
    return json(res, 400, { ok: false, error: 'Укажите компанию (?c=slug)' });
  }

  if (!fs.existsSync(companyDir(slug))) {
    return json(res, 404, { ok: false, error: 'Компания не найдена' });
  }

  if (action === 'companyInfo') {
    const companies = readCompanies();
    const found = companies.find((c) => c.slug === slug);
    return json(res, 200, { ok: true, company: { slug, name: found?.name || slug } });
  }

  if (action === 'confirmEmail') {
    if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Метод не поддерживается' });
    const body = await readBody(req);
    const token = String(body.token || '').trim();
    const security = readSecurity(slug);

    const validToken = Boolean(token) && Boolean(security.verifyToken)
      && token.length === security.verifyToken.length
      && require('crypto').timingSafeEqual(Buffer.from(token), Buffer.from(security.verifyToken));
    const notExpired = Boolean(security.verifyExpires) && Date.parse(security.verifyExpires) > Date.now();

    if (!validToken || !notExpired) {
      return json(res, 403, { ok: false, error: 'Ссылка подтверждения недействительна или устарела' });
    }

    const companies = readCompanies();
    const company = companies.find((c) => c.slug === slug);
    if (company) company.emailVerified = true;
    writeCompanies(companies);

    security.verifyToken = null;
    security.verifyExpires = null;
    writeSecurity(slug, security);
    return json(res, 200, { ok: true });
  }

  if (action === 'resendConfirmation') {
    if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Метод не поддерживается' });
    const companies = readCompanies();
    const company = companies.find((c) => c.slug === slug);

    if (company && !companyIsVerified(company)) {
      const security = readSecurity(slug);
      const cooldownOk = !security.lastVerifyRequestAt
        || (Date.now() - Date.parse(security.lastVerifyRequestAt)) >= RESET_REQUEST_COOLDOWN_MS;
      if (cooldownOk) {
        const token = require('crypto').randomBytes(16).toString('hex');
        security.verifyToken = token;
        security.verifyExpires = new Date(Date.now() + EMAIL_VERIFY_TTL_MS).toISOString();
        security.lastVerifyRequestAt = new Date().toISOString();
        writeSecurity(slug, security);

        const base = baseUrl(req);
        sendEmail(
          String(company.email || ''),
          'Timetrack — подтвердите email',
          `Подтвердите email, чтобы активировать компанию «${company.name}» (ссылка действует 24 часа):\n`
          + `${base}/register.html?confirm=1&c=${slug}&token=${token}`,
        ).catch(() => {});
      }
    }
    return json(res, 200, { ok: true, message: 'Если компания существует и email ещё не подтверждён, письмо отправлено повторно' });
  }

  {
    const companies = readCompanies();
    const company = companies.find((c) => c.slug === slug);
    if (!companyIsVerified(company)) {
      return json(res, 403, { ok: false, error: 'Подтвердите email — мы отправили ссылку при регистрации', code: 'EMAIL_NOT_VERIFIED' });
    }
  }

  let state = readState(slug);
  migrateAdminCredentials(state, slug);

  if (req.method === 'GET' && action === 'state') {
    const auth = requireAdminSession(req, res, slug);
    if (!auth.ok) {
      return json(res, auth.status, {
        ok: false,
        error: auth.error,
        code: auth.code,
        ...(auth.csrfToken ? { csrfToken: auth.csrfToken } : {}),
      });
    }
    return json(res, 200, { ok: true, state: stateForRole(state, sessionRole(auth)), csrfToken: auth.csrfToken, role: sessionRole(auth), userName: auth.session.userName || '' });
  }

  if (req.method !== 'POST') {
    return json(res, 405, { ok: false, error: 'Метод не поддерживается' });
  }

  const body = await readBody(req);

  if (action === 'tabletState') {
    const auth = requireTabletDevice(body, slug);
    if (!auth.ok) return json(res, auth.status, { ok: false, error: auth.error, code: auth.code });
    return json(res, 200, { ok: true, state: tabletState(state) });
  }

  if (action === 'checkAdminPin') {
    const security = readSecurity(slug);
    const login = String(body.login || '').trim().toLowerCase();
    const password = String(body.password || body.adminPin || '').trim();
    const matchedUser = users(security).find((user) => String(user.login || user.email || '').toLowerCase() === login);
    const ownerLogin = String(security.ownerLogin || 'admin').trim().toLowerCase();
    let auth;
    if (matchedUser) {
      if (userLoginLocked(security, login)) {
        return json(res, 429, { ok: false, error: 'Слишком много попыток входа', code: 'LOGIN_RATE_LIMITED' });
      }
      if (password && verifyAdminPinHash(password, matchedUser.passwordHash)) {
        clearUserLoginFailures(security, login);
        writeSecurity(slug, security);
        auth = { ok: true, security };
      } else {
        userLoginFailure(security, login);
        writeSecurity(slug, security);
        auth = { ok: false, status: 403, error: 'Неверные данные для входа' };
      }
    } else if (!login || login === ownerLogin) {
      auth = requireAdminPin({ adminPin: password }, slug);
    } else {
      return json(res, 403, { ok: false, error: 'Неверные данные для входа' });
    }
    if (!auth.ok) return json(res, auth.status, { ok: false, error: auth.error, code: auth.code });
    const pinChangeRequired = Boolean(auth.security.pinChangeRequired);
    const sessionUser = matchedUser || { id: 'owner', role: 'owner', name: 'Администратор' };
    const session = issueAdminSession(req, res, slug, pinChangeRequired, sessionUser);
    const company = readCompanies().find((c) => c.slug === slug);
    recordLastLogin(clientIp(req), slug, company?.name || slug);
    if (pinChangeRequired) {
      return json(res, 200, { ok: true, pinChangeRequired: true, csrfToken: session.csrfToken, role: userRole(sessionUser.role), userName: sessionUser.name || 'Администратор' });
    }
    const role = userRole(sessionUser.role);
    return json(res, 200, { ok: true, state: stateForRole(state, role), csrfToken: session.csrfToken, role, userName: sessionUser.name || 'Администратор' });
  }

  if (action === 'requestPinReset') {
    const companies = readCompanies();
    const company = companies.find((c) => c.slug === slug);
    const requestedEmail = String(body.email || '').toLowerCase().trim();
    const security = readSecurity(slug);
    const cooldownOk = !security.lastResetRequestAt
      || (Date.now() - Date.parse(security.lastResetRequestAt)) >= RESET_REQUEST_COOLDOWN_MS;

    if (company && requestedEmail && String(company.email || '').toLowerCase() === requestedEmail && cooldownOk) {
      const token = require('crypto').randomBytes(16).toString('hex');
      security.resetToken = token;
      security.resetExpires = new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString();
      security.lastResetRequestAt = new Date().toISOString();
      writeSecurity(slug, security);

      const base = baseUrl(req);
      sendEmail(
        requestedEmail,
        'Timetrack — сброс PIN администратора',
        `Запрошен сброс PIN для компании «${company.name}».\n\n`
        + `Перейдите по ссылке, чтобы задать новый PIN (действует 30 минут):\n`
        + `${base}/admin.html?c=${slug}&reset=${token}\n\n`
        + `Если вы не запрашивали сброс — просто игнорируйте это письмо.`,
      ).catch(() => {});
    }
    // Deliberately generic regardless of match — avoids leaking which email a company uses.
    return json(res, 200, { ok: true, message: 'Если email указан верно, на него отправлена ссылка для сброса PIN' });
  }

  if (action === 'resetPin') {
    const token = String(body.resetToken || '').trim();
    const newPin = String(body.newPin || '').trim();
    const security = readSecurity(slug);

    const validToken = Boolean(token) && Boolean(security.resetToken)
      && token.length === security.resetToken.length
      && require('crypto').timingSafeEqual(Buffer.from(token), Buffer.from(security.resetToken));
    const notExpired = Boolean(security.resetExpires) && Date.parse(security.resetExpires) > Date.now();

    if (!validToken || !notExpired) {
      return json(res, 403, { ok: false, error: 'Ссылка для сброса недействительна или устарела' });
    }
    if (!validNewAdminPin(newPin)) {
      return json(res, 422, { ok: false, error: 'PIN должен содержать 6–12 цифр и не быть слишком простым' });
    }

    security.adminPinHash = adminPinHash(newPin);
    security.pinChangeRequired = false;
    security.pinUpdatedAt = new Date().toISOString();
    security.failedAttempts = 0;
    security.lockUntil = null;
    security.resetToken = null;
    security.resetExpires = null;
    security.adminSessions = [];
    writeSecurity(slug, security);
    clearAdminCookie(req, res, slug);
    return json(res, 200, { ok: true });
  }

  if (action === 'changeAdminPin') {
    const auth = requireAdminSession(req, res, slug, { csrfRequired: true, allowPinChange: true });
    if (!auth.ok) {
      return json(res, auth.status, { ok: false, error: auth.error, code: auth.code });
    }
    if (!allowRole(auth, ['owner', 'admin'])) {
      return json(res, 403, { ok: false, error: 'Недостаточно прав для смены PIN', code: 'FORBIDDEN' });
    }
    const pinAuth = verifyOwnerPin(body, slug, 'pin');
    if (!pinAuth.ok) return json(res, pinAuth.status, { ok: false, error: pinAuth.error, code: 'CURRENT_PIN_INVALID' });
    const newPin = String(body.newPin || '').trim();
    if (!validNewAdminPin(newPin)) {
      return json(res, 422, { ok: false, error: 'PIN должен содержать 6–12 цифр и не быть слишком простым' });
    }
    const security = pinAuth.security;
    security.adminPinHash = adminPinHash(newPin);
    security.pinChangeRequired = false;
    security.pinUpdatedAt = new Date().toISOString();
    security.adminSessions = [];
    writeSecurity(slug, security);
    const session = issueAdminSession(req, res, slug, false, { id: 'owner', role: 'owner', name: 'Администратор' });
    return json(res, 200, { ok: true, state: stateForRole(state, 'owner'), csrfToken: session.csrfToken, role: 'owner', userName: 'Администратор' });
  }

  if (action === 'logoutAdmin') {
    const auth = requireAdminSession(req, res, slug, { csrfRequired: true, allowPinChange: true });
    if (!auth.ok) {
      return json(res, auth.status, { ok: false, error: auth.error, code: auth.code });
    }
    const security = readSecurity(slug);
    const match = currentAdminSession(req, security, slug);
    if (match) {
      security.adminSessions.splice(match.index, 1);
      writeSecurity(slug, security);
    }
    clearAdminCookie(req, res, slug);
    return json(res, 200, { ok: true });
  }

  let adminSessionAuth = null;
  if (ADMIN_ACTIONS.has(action)) {
    adminSessionAuth = requireAdminSession(req, res, slug, { csrfRequired: true });
    if (!adminSessionAuth.ok) {
      return json(res, adminSessionAuth.status, {
        ok: false,
        error: adminSessionAuth.error,
        code: adminSessionAuth.code,
        ...(adminSessionAuth.csrfToken ? { csrfToken: adminSessionAuth.csrfToken } : {}),
      });
    }
  }

  if (adminSessionAuth && action !== 'manualPhoto') {
    const permitted = (['saveEmployee', 'deleteEmployee'].includes(action) && allowRole(adminSessionAuth, ['owner', 'admin', 'recruiter']))
      || (action !== 'saveEmployee' && action !== 'deleteEmployee' && allowRole(adminSessionAuth, ['owner', 'admin']));
    if (!permitted) return json(res, 403, { ok: false, error: 'Недостаточно прав для этого действия', code: 'FORBIDDEN' });
  }
  if (action === 'manualPhoto' && !allowRole(adminSessionAuth, ['owner', 'admin', 'accountant'])) {
    return json(res, 403, { ok: false, error: 'Недостаточно прав для просмотра фото', code: 'FORBIDDEN' });
  }

  if (action === 'listUsers') return json(res, 200, { ok: true, users: publicUsers(readSecurity(slug)) });
  if (action === 'saveUser') {
    const input = body.user || {};
    const login = String(input.login || '').trim().toLowerCase();
    const password = String(input.password || '');
    if (!/^[a-z0-9][a-z0-9._-]{2,63}$/.test(login) || !text(input.name, 80) || (!input.id && !validPassword(password))) {
      return json(res, 422, { ok: false, error: 'Укажите имя, логин от 3 символов и пароль от 8 символов' });
    }
    const security = readSecurity(slug);
    const next = { id: String(input.id || `u${crypto.randomBytes(8).toString('hex')}`), name: text(input.name, 80), login, role: ['admin', 'recruiter', 'accountant'].includes(input.role) ? input.role : 'accountant', ...(password ? { passwordHash: adminPinHash(password) } : {}) };
    const index = users(security).findIndex((user) => user.id === next.id);
    if (login === String(security.ownerLogin || 'admin').toLowerCase()) return json(res, 409, { ok: false, error: 'Этот логин используется владельцем компании' });
    if (users(security).some((user, itemIndex) => String(user.login || user.email || '').toLowerCase() === login && itemIndex !== index)) return json(res, 409, { ok: false, error: 'Пользователь с таким логином уже есть' });
    if (index >= 0) security.users[index] = { ...security.users[index], ...next }; else security.users.push(next);
    writeSecurity(slug, security); return json(res, 200, { ok: true, users: publicUsers(security) });
  }
  if (action === 'deleteUser') {
    const security = readSecurity(slug); const userId = String(body.userId || '');
    security.users = users(security).filter((user) => user.id !== userId); security.adminSessions = adminSessions(security).filter((session) => session.userId !== userId);
    writeSecurity(slug, security); return json(res, 200, { ok: true, users: publicUsers(security) });
  }

  if (action === 'deleteCompany') {
    const auth = requireAdminPin(body, slug);
    if (!auth.ok) return json(res, auth.status, { ok: false, error: auth.error });
  }

  if (action === 'listTabletDevices') {
    return json(res, 200, { ok: true, devices: publicTabletDevices(readSecurity(slug)) });
  }

  if (action === 'revokeTabletDevice') {
    const deviceId = id(body.deviceId, 'td');
    const security = readSecurity(slug);
    security.tabletDevices = tabletDevices(security).filter((device) => device.id !== deviceId);
    writeSecurity(slug, security);
    return json(res, 200, { ok: true, devices: publicTabletDevices(security) });
  }

  if (action === 'revokeAllTabletDevices') {
    const security = readSecurity(slug);
    security.tabletDevices = [];
    security.tabletToken = null;
    security.tabletExpires = null;
    writeSecurity(slug, security);
    return json(res, 200, { ok: true, devices: [] });
  }

  if (action === 'requestTabletAccess') {
    const security = readSecurity(slug);
    security.tabletToken = crypto.randomBytes(16).toString('hex');
    security.tabletExpires = new Date(Date.now() + TABLET_ACCESS_TTL_MS).toISOString();
    security.tabletDevices = tabletDevices(security);
    writeSecurity(slug, security);
    return json(res, 200, { ok: true, token: security.tabletToken, expiresInSeconds: TABLET_ACCESS_TTL_MS / 1000 });
  }

  if (action === 'verifyTabletAccess') {
    const token = String(body.token || '').trim();
    const security = readSecurity(slug);
    const validToken = safeEqual(token, security.tabletToken);
    const notExpired = Boolean(security.tabletExpires) && Date.parse(security.tabletExpires) > Date.now();
    if (!validToken) {
      return json(res, 403, { ok: false, error: 'Код не совпадает с тем, что выдала админка. Создайте новый QR-код и используйте именно его.' });
    }
    if (!notExpired) {
      return json(res, 403, { ok: false, error: 'Срок действия QR-кода истёк. Создайте новый в Настройках.' });
    }
    const deviceId = `td${crypto.randomBytes(8).toString('hex')}`;
    const deviceToken = crypto.randomBytes(32).toString('hex');
    security.tabletDevices = [
      ...tabletDevices(security),
      {
        id: deviceId,
        tokenHash: tabletTokenHash(deviceToken),
        createdAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + TABLET_DEVICE_TTL_MS).toISOString(),
      },
    ].slice(-50);
    security.tabletToken = null;
    security.tabletExpires = null;
    writeSecurity(slug, security);
    return json(res, 200, { ok: true, deviceId, deviceToken, state: tabletState(state) });
  }

  if (action === 'manualPhoto') {
    const image = readManualPhotoDataUrl(slug, text(body.path, 180));
    if (!image) return json(res, 404, { ok: false, error: 'Фото ручной отметки не найдено' });
    return json(res, 200, { ok: true, image });
  }

  if (action === 'saveEmployee') {
    if (body.employee?.photo && !photo(body.employee.photo)) return json(res, 422, { ok: false, error: 'Фото должно быть в формате JPEG, PNG или WebP' });
    const current = state.employees.find((item) => item.id === id(body.employee?.id, 'e'));
    const next = employee(body.employee || {}, current || {});
    if (next.error) return json(res, 422, { ok: false, error: next.error, code: next.code });
    if (!next.fname || !next.lname) return json(res, 422, { ok: false, error: 'Имя и фамилия обязательны' });
    const index = state.employees.findIndex((item) => item.id === next.id);
    if (index >= 0) state.employees[index] = next;
    else state.employees.push(next);
    writeEmployees(slug, state);
    backupStore(slug);
    return json(res, 200, { ok: true, state: stateForRole(state, sessionRole(adminSessionAuth)) });
  }

  if (action === 'deleteEmployee') {
    const target = strictId(body.id);
    if (!target || !state.employees.some((item) => item.id === target)) {
      return json(res, 404, { ok: false, error: 'Сотрудник не найден' });
    }
    redactEmployeeHistory(slug, state, target);
    state.employees = state.employees.filter((item) => item.id !== target);
    writeEmployees(slug, state);
    writeLogs(slug, state);
    backupStore(slug);
    return json(res, 200, { ok: true, state: stateForRole(state, sessionRole(adminSessionAuth)) });
  }

  if (action === 'deleteCompany') {
    const confirmSlug = String(body.confirmSlug || '').toLowerCase().trim();
    if (confirmSlug !== slug) {
      return json(res, 422, { ok: false, error: 'Введите идентификатор компании точно как показано' });
    }

    const companies = readCompanies().filter((company) => company.slug !== slug);
    writeCompanies(companies);
    fs.rmSync(companyDir(slug), { recursive: true, force: true });
    clearAdminCookie(req, res, slug);
    return json(res, 200, { ok: true });
  }

  if (action === 'addLog') {
    const auth = requireTabletDevice(body, slug);
    if (!auth.ok) return json(res, auth.status, { ok: false, error: auth.error, code: auth.code });
    const parsed = parseAttendanceInput(body.log || {});
    if (!parsed.ok) return json(res, parsed.status, { ok: false, error: parsed.error, code: parsed.code });
    if (state.logs.some((item) => item.id === parsed.value.id)) return json(res, 409, { ok: false, error: 'Идентификатор отметки уже использован', code: 'DUPLICATE_LOG_ID', state: tabletState(state) });
    const employeeRecord = state.employees.find((item) => item.id === parsed.value.employeeId);
    if (!employeeRecord) return json(res, 422, { ok: false, error: 'Сотрудник не найден', code: 'UNKNOWN_EMPLOYEE' });
    const built = buildAttendanceLog(parsed.value, employeeRecord, state, { serverNow: new Date() });
    if (!built.ok) return json(res, built.status, { ok: false, error: built.error, code: built.code, state: tabletState(state) });
    state.logs.unshift(built.log);
    state.logs = state.logs.slice(0, 10000);
    writeLogs(slug, state);
    return json(res, 200, { ok: true, state: tabletState(state) });
  }

  if (action === 'addManualLog') {
    const auth = requireTabletDevice(body, slug);
    if (!auth.ok) return json(res, auth.status, { ok: false, error: auth.error, code: auth.code });
    const rawLog = body.log && typeof body.log === 'object' ? body.log : {};
    if (rawLog.offline === true) return json(res, 422, { ok: false, error: 'Ручная отметка требует подключения к серверу', code: 'CLIENT_TIME_NOT_ALLOWED' });
    const parsed = parseAttendanceInput(rawLog);
    if (!parsed.ok) return json(res, parsed.status, { ok: false, error: parsed.error, code: parsed.code });
    if (state.logs.some((item) => item.id === parsed.value.id)) return json(res, 409, { ok: false, error: 'Идентификатор отметки уже использован', code: 'DUPLICATE_LOG_ID', state: tabletState(state) });
    const employeeRecord = state.employees.find((item) => item.id === parsed.value.employeeId);
    if (!employeeRecord) return json(res, 422, { ok: false, error: 'Сотрудник не найден', code: 'UNKNOWN_EMPLOYEE' });
    const reason = text(body.reason || rawLog.reason, 240);
    if (reason.length < 3) return json(res, 422, { ok: false, error: 'Укажите причину ручной отметки', code: 'REASON_REQUIRED' });
    const pinAuth = verifyOwnerPin({ supervisorPin: body.supervisorPin || body.currentPin, currentPin: body.currentPin }, slug, 'manual');
    if (!pinAuth.ok) return json(res, pinAuth.status, { ok: false, error: pinAuth.error, code: 'SUPERVISOR_PIN_INVALID' });
    const photoBuffer = manualPhotoBuffer(rawLog.manualPhoto);
    if (!photoBuffer) return json(res, 422, { ok: false, error: 'Не удалось получить фото ручной отметки', code: 'INVALID_MANUAL_PHOTO' });
    const serverNow = new Date();
    const built = buildAttendanceLog(parsed.value, employeeRecord, state, { manual: true, serverNow });
    if (!built.ok) return json(res, built.status, { ok: false, error: built.error, code: built.code, state: tabletState(state) });
    built.log.manualPhoto = saveManualPhoto(slug, built.log, photoBuffer);
    state.logs.unshift(built.log);
    state.logs = state.logs.slice(0, 10000);
    writeLogs(slug, state);
    appendAudit(pinAuth.security, { action: 'manualAttendance', deviceId: auth.device.id, logId: built.log.id, employeeId: built.log.employeeId, reason });
    writeSecurity(slug, pinAuth.security);
    return json(res, 200, { ok: true, state: tabletState(state) });
  }

  if (action === 'updateSettings') {
    if (body.settings?.adminPin || body.settings?.adminPinHash) {
      return json(res, 422, { ok: false, error: 'Смена PIN требует currentPin', code: 'CURRENT_PIN_REQUIRED' });
    }
    state.settings = settings(body.settings || {}, state.settings);
    writeSettings(slug, state);
    return json(res, 200, { ok: true, state: stateForRole(state, sessionRole(adminSessionAuth)), csrfToken: String(adminSessionAuth?.csrfToken || '') });
  }

  if (action === 'clearLogs') {
    state.logs = [];
    writeLogs(slug, state);
    return json(res, 200, { ok: true, state: stateForRole(state, sessionRole(adminSessionAuth)) });
  }

  return json(res, 404, { ok: false, error: 'Неизвестное действие' });
}

ensureDir(DATA_DIR);
const API_ONLY = process.env.TIMETRACK_API_ONLY === '1';
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (API_ONLY || url.pathname === '/api.php' || url.pathname === '/api') {
    applyCors(req, res);
    handleAPI(req, res).catch(() => {
      json(res, 500, { ok: false, error: 'Ошибка сервера', code: 'STORAGE_ERROR' });
    });
  } else {
    serveStatic(req, res);
  }
}).listen(PORT, '0.0.0.0', () => {
  console.log(API_ONLY
    ? `Timetrack multi-tenant API listening on ${PORT}`
    : `Timetrack multi-tenant API + static on http://localhost:${PORT}`);
});
