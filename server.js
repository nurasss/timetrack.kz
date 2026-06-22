const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 8787);
const DATA_DIR = path.join(__dirname, 'data');
const COMPANIES_FILE = path.join(DATA_DIR, 'companies.json');
const DUPLICATE_WINDOW_MS = 120000;
const ADMIN_ACTIONS = new Set(['saveEmployee', 'deleteEmployee', 'updateSettings', 'clearLogs', 'deleteCompany']);

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

function readState(slug) {
  const file = storeFile(slug);
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return {
      employees: Array.isArray(parsed.employees) ? parsed.employees : [],
      logs: Array.isArray(parsed.logs) ? parsed.logs : [],
      settings: { ...DEFAULT_STATE.settings, ...(parsed.settings || {}) },
    };
  } catch {
    return clone(DEFAULT_STATE);
  }
}

function writeState(slug, state) {
  ensureDir(companyDir(slug));
  fs.writeFileSync(storeFile(slug), JSON.stringify(state, null, 2), 'utf8');
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
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(payload));
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
      'Access-Control-Allow-Origin': '*',
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

    if (!validSlug(newSlug)) return json(res, 422, { ok: false, error: 'Некорректный идентификатор' });
    if (!name) return json(res, 422, { ok: false, error: 'Укажите название компании' });
    if (pin.length < 4) return json(res, 422, { ok: false, error: 'PIN должен быть не менее 4 символов' });

    if (fs.existsSync(companyDir(newSlug))) {
      return json(res, 409, { ok: false, error: 'Этот идентификатор уже занят' });
    }

    const initialState = clone(DEFAULT_STATE);
    initialState.settings.adminPin = pin.slice(0, 32);
    ensureDir(companyDir(newSlug));
    writeState(newSlug, initialState);

    const companies = readCompanies();
    companies.push({ slug: newSlug, name, createdAt: new Date().toISOString() });
    writeCompanies(companies);

    return json(res, 200, { ok: true, company: { slug: newSlug, name } });
  }

  if (action === 'companies') {
    const companies = readCompanies();
    const publicList = companies.map((c) => ({ slug: c.slug || '', name: c.name || '' }));
    return json(res, 200, { ok: true, companies: publicList });
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

  let state = readState(slug);

  if (req.method === 'GET' && action === 'state') {
    return json(res, 200, { ok: true, state: publicState(state) });
  }

  if (req.method !== 'POST') {
    return json(res, 405, { ok: false, error: 'Метод не поддерживается' });
  }

  const body = await readBody(req);

  if (action === 'checkAdminPin') {
    if (!isAdminAuthorized(body, state)) return json(res, 403, { ok: false, error: 'Неверный PIN админки' });
    return json(res, 200, { ok: true, state: publicState(state) });
  }

  if (ADMIN_ACTIONS.has(action) && !isAdminAuthorized(body, state)) {
    return json(res, 403, { ok: false, error: 'Неверный PIN админки' });
  }

  if (action === 'saveEmployee') {
    const next = employee(body.employee || {});
    if (!next.fname || !next.lname) return json(res, 422, { ok: false, error: 'Имя и фамилия обязательны' });
    const index = state.employees.findIndex((item) => item.id === next.id);
    if (index >= 0) state.employees[index] = next;
    else state.employees.push(next);
    writeState(slug, state);
    return json(res, 200, { ok: true, state: publicState(state) });
  }

  if (action === 'deleteEmployee') {
    const target = id(body.id, 'e');
    state.employees = state.employees.filter((item) => item.id !== target);
    writeState(slug, state);
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
    writeState(slug, state);
    return json(res, 200, { ok: true, state: publicState(state) });
  }

  if (action === 'updateSettings') {
    state.settings = settings(body.settings || {}, state.settings);
    writeState(slug, state);
    return json(res, 200, { ok: true, state: publicState(state) });
  }

  if (action === 'clearLogs') {
    state.logs = [];
    writeState(slug, state);
    return json(res, 200, { ok: true, state: publicState(state) });
  }

  return json(res, 404, { ok: false, error: 'Неизвестное действие' });
}

ensureDir(DATA_DIR);
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api.php' || url.pathname === '/api') {
    handleAPI(req, res).catch((error) => {
      json(res, 500, { ok: false, error: error.message || 'Ошибка сервера' });
    });
  } else {
    serveStatic(req, res);
  }
}).listen(PORT, '0.0.0.0', () => {
  console.log(`Timetrack multi-tenant API + static on http://localhost:${PORT}`);
});
