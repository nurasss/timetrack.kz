const http = require('http');
const tls = require('tls');
const net = require('net');
const fs = require('fs');
const path = require('path');

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
const DATA_DIR = path.join(__dirname, 'data');
const COMPANIES_FILE = path.join(DATA_DIR, 'companies.json');
const LAST_LOGINS_FILE = path.join(DATA_DIR, 'last-logins.json');
const DUPLICATE_WINDOW_MS = 120000;
const ADMIN_ACTIONS = new Set(['saveEmployee', 'deleteEmployee', 'updateSettings', 'clearLogs', 'deleteCompany', 'requestTabletAccess']);
const MAX_PIN_ATTEMPTS = 6;
const PIN_LOCKOUT_MS = 900000;
const BACKUP_KEEP = 20;
const RESET_TOKEN_TTL_MS = 1800000;
const RESET_REQUEST_COOLDOWN_MS = 120000;
const EMAIL_VERIFY_TTL_MS = 86400000;
const TABLET_ACCESS_TTL_MS = 600000;
const ALLOWED_ORIGINS = new Set(['https://timetrack.kz', 'https://www.timetrack.kz', 'http://localhost:8787', 'http://127.0.0.1:8787']);

const DEFAULT_STATE = {
  employees: [],
  logs: [],
  settings: {
    recognitionModel: 'tiny',
    matchThreshold: 0.55,
    lateMinutes: 15,
    adminPin: '1234',
  },
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

function clone(v) { return JSON.parse(JSON.stringify(v)); }

function validSlug(s) { return /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/.test(s); }

function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }

function readCompanies() {
  try { return JSON.parse(fs.readFileSync(COMPANIES_FILE, 'utf8')); }
  catch { return []; }
}

function writeCompanies(list) {
  ensureDir(DATA_DIR);
  fs.writeFileSync(COMPANIES_FILE, JSON.stringify(list, null, 2), 'utf8');
}

function companyDir(slug) { return path.join(DATA_DIR, slug); }
function storeFile(slug) { return path.join(companyDir(slug), 'store.json'); }
function employeesFile(slug) { return path.join(companyDir(slug), 'employees.json'); }
function settingsFile(slug) { return path.join(companyDir(slug), 'settings.json'); }
function logsFile(slug) { return path.join(companyDir(slug), 'logs.json'); }

function readJsonSafe(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return null; }
}

function legacyReadState(slug) {
  const parsed = readJsonSafe(storeFile(slug));
  if (!parsed) return clone(DEFAULT_STATE);
  return {
    employees: Array.isArray(parsed.employees) ? parsed.employees : [],
    logs: Array.isArray(parsed.logs) ? parsed.logs : [],
    settings: { ...DEFAULT_STATE.settings, ...(parsed.settings || {}) },
  };
}

function writeEmployees(slug, state) {
  ensureDir(companyDir(slug));
  fs.writeFileSync(employeesFile(slug), JSON.stringify({ employees: state.employees }, null, 2), 'utf8');
}

function writeSettings(slug, state) {
  ensureDir(companyDir(slug));
  fs.writeFileSync(settingsFile(slug), JSON.stringify({ settings: state.settings }, null, 2), 'utf8');
}

function writeLogs(slug, state) {
  ensureDir(companyDir(slug));
  fs.writeFileSync(logsFile(slug), JSON.stringify({ logs: state.logs }, null, 2), 'utf8');
}

// Storage is split into three files per company so the high-frequency
// addLog action (every kiosk tap) never has to rewrite employee photos/face
// descriptors, and a settings change never has to rewrite the logs.
function readState(slug) {
  const employeesPath = employeesFile(slug);
  const settingsPath = settingsFile(slug);
  const logsPath = logsFile(slug);

  if (fs.existsSync(employeesPath) || fs.existsSync(settingsPath) || fs.existsSync(logsPath)) {
    const employeesRaw = readJsonSafe(employeesPath);
    const settingsRaw = readJsonSafe(settingsPath);
    const logsRaw = readJsonSafe(logsPath);
    return {
      employees: Array.isArray(employeesRaw?.employees) ? employeesRaw.employees : [],
      settings: { ...DEFAULT_STATE.settings, ...(settingsRaw?.settings || {}) },
      logs: Array.isArray(logsRaw?.logs) ? logsRaw.logs : [],
    };
  }

  // One-time migration from the legacy combined store.json, if present.
  const state = legacyReadState(slug);
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
  if (next.settings) delete next.settings.adminPin;
  return next;
}

function json(res, status, payload) {
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
    res.setHeader('Vary', 'Origin');
  }
}

function securityFile(slug) { return path.join(companyDir(slug), 'security.json'); }

function defaultSecurity() {
  return {
    failedAttempts: 0, lockUntil: null,
    resetToken: null, resetExpires: null, lastResetRequestAt: null,
    verifyToken: null, verifyExpires: null, lastVerifyRequestAt: null,
    tabletToken: null, tabletExpires: null,
  };
}

// Companies created before this feature shipped have no `emailVerified` key
// at all — treat that as already-verified (grandfathered in), so deploying
// this doesn't lock out existing live companies. Only an explicit `false`
// (set by a fresh registration) blocks access.
function companyIsVerified(company) {
  if (!company || !('emailVerified' in company)) return true;
  return company.emailVerified === true;
}

function readSecurity(slug) {
  try {
    const parsed = JSON.parse(fs.readFileSync(securityFile(slug), 'utf8'));
    return { ...defaultSecurity(), ...parsed };
  } catch {
    return defaultSecurity();
  }
}

function writeSecurity(slug, security) {
  fs.writeFileSync(securityFile(slug), JSON.stringify(security, null, 2), 'utf8');
}

function pinLockRemainingMs(security) {
  if (!security.lockUntil) return 0;
  return Math.max(0, Date.parse(security.lockUntil) - Date.now());
}

// Brute-force guard mirrors api.php: failures while locked don't reset the
// lock early, so the attacker can't use timing to learn anything either.
function requireAdminPin(body, state, slug) {
  const security = readSecurity(slug);
  const remaining = pinLockRemainingMs(security);
  if (remaining > 0) {
    return { ok: false, status: 429, error: `Слишком много попыток входа. Попробуйте через ${Math.ceil(remaining / 60000)} мин.` };
  }
  if (!isAdminAuthorized(body, state)) {
    security.failedAttempts = (security.failedAttempts || 0) + 1;
    if (security.failedAttempts >= MAX_PIN_ATTEMPTS) {
      security.lockUntil = new Date(Date.now() + PIN_LOCKOUT_MS).toISOString();
      security.failedAttempts = 0;
    }
    writeSecurity(slug, security);
    return { ok: false, status: 403, error: 'Неверный PIN админки' };
  }
  // A successful normal login also invalidates any pending reset-PIN token.
  writeSecurity(slug, defaultSecurity());
  return { ok: true };
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

// Soft "remember this browser's last company" lookup, NOT authentication —
// whoAmI only ever suggests a company name/slug so index.html can offer a
// shortcut into login.html; the PIN is still required there either way.
function readLastLogins() {
  try { return JSON.parse(fs.readFileSync(LAST_LOGINS_FILE, 'utf8')); }
  catch { return {}; }
}

function writeLastLogins(data) {
  ensureDir(DATA_DIR);
  fs.writeFileSync(LAST_LOGINS_FILE, JSON.stringify(data, null, 2), 'utf8');
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
    fs.copyFileSync(src, path.join(backupDir, `employees-${stamp}.json`));
  }
  const files = fs.readdirSync(backupDir).filter((f) => f.startsWith('employees-')).sort();
  const excess = files.length - BACKUP_KEEP;
  for (let i = 0; i < excess; i++) {
    fs.unlinkSync(path.join(backupDir, files[i]));
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

function photo(v) {
  if (typeof v !== 'string' || !v.startsWith('data:image/')) return null;
  return v.length > 1600000 ? null : v;
}

function descriptor(v) {
  if (!Array.isArray(v) || v.length < 64) return null;
  return v.slice(0, 256).map(Number).filter(Number.isFinite);
}

function employee(input = {}) {
  return {
    id: id(input.id, 'e'),
    fname: text(input.fname, 80),
    lname: text(input.lname, 80),
    position: text(input.position || 'Сотрудник', 100),
    dept: text(input.dept || 'Общий', 100),
    workStart: /^\d{2}:\d{2}$/.test(String(input.workStart || '')) ? input.workStart : '09:00',
    photo: photo(input.photo),
    descriptor: descriptor(input.descriptor),
  };
}

function log(input = {}) {
  const ts = Date.parse(input.ts) ? new Date(input.ts) : new Date();
  const verification = ['blink', 'head'].includes(input.verification) ? input.verification : '';
  return {
    id: id(input.id, 'l'),
    empId: id(input.empId, 'e'),
    empName: text(input.empName, 180),
    empPhoto: photo(input.empPhoto),
    type: input.type === 'checkout' ? 'checkout' : 'checkin',
    time: text(input.time || ts.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }), 24),
    date: text(input.date || ts.toLocaleDateString('ru-RU'), 24),
    ts: ts.toISOString(),
    isLate: Boolean(input.isLate),
    verification,
  };
}

function settings(input = {}, current = {}) {
  const nextPin = String(input.adminPin || '').trim().slice(0, 32);
  return {
    recognitionModel: input.recognitionModel === 'ssd' ? 'ssd' : 'tiny',
    matchThreshold: number(input.matchThreshold, 0.55, 0.35, 0.8),
    lateMinutes: Math.round(number(input.lateMinutes, 15, 0, 120)),
    adminPin: nextPin || current.adminPin || '1234',
  };
}

function isAdminAuthorized(body, state) {
  const expected = String(state.settings?.adminPin || '1234');
  return String(body.adminPin || '') === expected;
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
  let filePath = path.join(__dirname, decodeURIComponent(url.pathname));
  if (filePath.endsWith('/')) filePath = path.join(filePath, 'index.html');

  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  if (filePath.startsWith(path.join(__dirname, 'data'))) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
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
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

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
    if (pin.length < 4) return json(res, 422, { ok: false, error: 'PIN должен быть не менее 4 символов' });
    if (!emailValid) return json(res, 422, { ok: false, error: 'Укажите корректный email — на него можно будет восстановить PIN' });
    if (!acceptedPolicy || !acceptedOffer) {
      return json(res, 422, { ok: false, error: 'Необходимо подтвердить согласие с офертой и политикой конфиденциальности' });
    }

    if (fs.existsSync(companyDir(newSlug))) {
      return json(res, 409, { ok: false, error: 'Этот идентификатор уже занят' });
    }

    const initialState = clone(DEFAULT_STATE);
    initialState.settings.adminPin = pin.slice(0, 32);
    ensureDir(companyDir(newSlug));
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

    const verifyToken = require('crypto').randomBytes(16).toString('hex');
    writeSecurity(newSlug, {
      ...defaultSecurity(),
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
      + `После подтверждения станут доступны:\n`
      + `Админ-панель: ${base}/admin.html?c=${newSlug}\n`
      + `Планшет-киоск: ${base}/tablet.html?c=${newSlug}`,
    ).catch(() => {});

    return json(res, 200, { ok: true, company: { slug: newSlug, name, emailVerified: false } });
  }

  if (action === 'companies') {
    const companies = readCompanies();
    const publicList = companies.map((c) => ({ slug: c.slug || '', name: c.name || '' }));
    return json(res, 200, { ok: true, companies: publicList });
  }

  if (action === 'whoAmI') {
    const lastLogins = readLastLogins();
    const entry = lastLogins[clientIp(req)];
    if (!entry) return json(res, 200, { ok: true, found: false });
    return json(res, 200, { ok: true, found: true, slug: entry.slug || '', name: entry.name || '' });
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

  if (req.method === 'GET' && action === 'state') {
    return json(res, 200, { ok: true, state: publicState(state) });
  }

  if (req.method !== 'POST') {
    return json(res, 405, { ok: false, error: 'Метод не поддерживается' });
  }

  const body = await readBody(req);

  if (action === 'checkAdminPin') {
    const auth = requireAdminPin(body, state, slug);
    if (!auth.ok) return json(res, auth.status, { ok: false, error: auth.error });
    const company = readCompanies().find((c) => c.slug === slug);
    recordLastLogin(clientIp(req), slug, company?.name || slug);
    return json(res, 200, { ok: true, state: publicState(state) });
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
    if (newPin.length < 4) {
      return json(res, 422, { ok: false, error: 'PIN должен быть не менее 4 символов' });
    }

    state.settings.adminPin = newPin.slice(0, 32);
    writeSettings(slug, state);
    writeSecurity(slug, defaultSecurity());
    return json(res, 200, { ok: true });
  }

  if (ADMIN_ACTIONS.has(action)) {
    const auth = requireAdminPin(body, state, slug);
    if (!auth.ok) return json(res, auth.status, { ok: false, error: auth.error });
  }

  if (action === 'requestTabletAccess') {
    const security = readSecurity(slug);
    security.tabletToken = require('crypto').randomBytes(16).toString('hex');
    security.tabletExpires = new Date(Date.now() + TABLET_ACCESS_TTL_MS).toISOString();
    writeSecurity(slug, security);
    return json(res, 200, { ok: true, token: security.tabletToken, expiresInSeconds: TABLET_ACCESS_TTL_MS / 1000 });
  }

  if (action === 'verifyTabletAccess') {
    const token = String(body.token || '').trim();
    const security = readSecurity(slug);
    const validToken = Boolean(token) && Boolean(security.tabletToken)
      && token.length === security.tabletToken.length
      && require('crypto').timingSafeEqual(Buffer.from(token), Buffer.from(security.tabletToken));
    const notExpired = Boolean(security.tabletExpires) && Date.parse(security.tabletExpires) > Date.now();
    if (!validToken || !notExpired) {
      return json(res, 403, { ok: false, error: 'QR-код недействителен или устарел' });
    }
    return json(res, 200, { ok: true });
  }

  if (action === 'saveEmployee') {
    const next = employee(body.employee || {});
    if (!next.fname || !next.lname) return json(res, 422, { ok: false, error: 'Имя и фамилия обязательны' });
    const index = state.employees.findIndex((item) => item.id === next.id);
    if (index >= 0) state.employees[index] = next;
    else state.employees.push(next);
    writeEmployees(slug, state);
    backupStore(slug);
    return json(res, 200, { ok: true, state: publicState(state) });
  }

  if (action === 'deleteEmployee') {
    const target = id(body.id, 'e');
    state.employees = state.employees.filter((item) => item.id !== target);
    writeEmployees(slug, state);
    return json(res, 200, { ok: true, state: publicState(state) });
  }

  if (action === 'deleteCompany') {
    const confirmSlug = String(body.confirmSlug || '').toLowerCase().trim();
    if (confirmSlug !== slug) {
      return json(res, 422, { ok: false, error: 'Введите идентификатор компании точно как показано' });
    }

    const companies = readCompanies().filter((company) => company.slug !== slug);
    writeCompanies(companies);
    fs.rmSync(companyDir(slug), { recursive: true, force: true });
    return json(res, 200, { ok: true });
  }

  if (action === 'addLog') {
    const nextLog = log(body.log || {});
    if (hasRecentDuplicate(state.logs, nextLog)) {
      return json(res, 409, { ok: false, error: 'Такая отметка уже была недавно', state: publicState(state) });
    }
    state.logs.unshift(nextLog);
    state.logs = state.logs.slice(0, 10000);
    writeLogs(slug, state);
    return json(res, 200, { ok: true, state: publicState(state) });
  }

  if (action === 'updateSettings') {
    state.settings = settings(body.settings || {}, state.settings);
    writeSettings(slug, state);
    return json(res, 200, { ok: true, state: publicState(state) });
  }

  if (action === 'clearLogs') {
    state.logs = [];
    writeLogs(slug, state);
    return json(res, 200, { ok: true, state: publicState(state) });
  }

  return json(res, 404, { ok: false, error: 'Неизвестное действие' });
}

ensureDir(DATA_DIR);
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api.php' || url.pathname === '/api') {
    applyCors(req, res);
    handleAPI(req, res).catch((error) => {
      json(res, 500, { ok: false, error: error.message || 'Ошибка сервера' });
    });
  } else {
    serveStatic(req, res);
  }
}).listen(PORT, '0.0.0.0', () => {
  console.log(`Timetrack multi-tenant API + static on http://localhost:${PORT}`);
});
