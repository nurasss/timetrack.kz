const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn, spawnSync } = require('node:child_process');

function kazakhstanDate(offsetDays = 0) {
  const date = new Date(Date.now() + offsetDays * 86400000);
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Qyzylorda',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (type) => parts.find((item) => item.type === type)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function kazakhstanDisplayDate(offsetDays = 0) {
  const [year, month, day] = kazakhstanDate(offsetDays).split('-');
  return `${day}.${month}.${year}`;
}

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', resolve).once('error', reject));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function waitForServer(url, child) {
  let lastError;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Test server exited with ${child.exitCode}`);
    try {
      const response = await fetch(url);
      if (response.status < 500) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw lastError || new Error('Test server did not start');
}

test('security boundary: admin session, CSRF, minimized tablet state and revocation', async (t) => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'timetrack-security-'));
  const slug = 'security-test';
  const weakSlug = 'weak-pin-test';
  const companyDir = path.join(dataDir, slug);
  const weakCompanyDir = path.join(dataDir, weakSlug);
  fs.mkdirSync(companyDir, { recursive: true });
  fs.mkdirSync(weakCompanyDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'companies.json'), JSON.stringify([
    { slug, name: 'Security Test', email: 'security@example.test', emailVerified: true },
    { slug: weakSlug, name: 'Weak PIN Test', email: 'weak@example.test', emailVerified: true },
  ]));
  fs.writeFileSync(path.join(companyDir, 'employees.json'), JSON.stringify({
    employees: [{
      id: 'e1',
      fname: 'Test',
      lname: 'Employee',
      position: 'QA',
      dept: 'Security',
      workStart: '09:00',
      photo: 'data:image/png;base64,ZmFrZQ==',
      descriptor: Array.from({ length: 128 }, (_, index) => index / 128),
    }],
  }));
  fs.writeFileSync(path.join(companyDir, 'settings.json'), JSON.stringify({
    settings: {
      recognitionModel: 'tiny',
      matchThreshold: 0.55,
      lateMinutes: 15,
      adminPin: '246810',
    },
  }));
  fs.writeFileSync(path.join(companyDir, 'logs.json'), JSON.stringify({
    logs: [
      {
        id: 'today-log',
        empId: 'e1',
        type: 'checkin',
        date: kazakhstanDisplayDate(),
        time: '09:00',
        ts: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        empPhoto: 'data:image/png;base64,ZmFrZQ==',
        manualPhoto: 'manual_photos/private.jpg',
      },
      {
        id: 'old-log',
        empId: 'e1',
        type: 'checkout',
        date: kazakhstanDisplayDate(-1),
        time: '18:00',
        ts: new Date(Date.now() - 86400000).toISOString(),
      },
    ],
  }));
  fs.writeFileSync(path.join(companyDir, 'security.json'), JSON.stringify({ tabletDevices: [] }));
  fs.writeFileSync(path.join(weakCompanyDir, 'employees.json'), JSON.stringify({ employees: [] }));
  fs.writeFileSync(path.join(weakCompanyDir, 'logs.json'), JSON.stringify({ logs: [] }));
  fs.writeFileSync(path.join(weakCompanyDir, 'settings.json'), JSON.stringify({
    settings: { recognitionModel: 'tiny', matchThreshold: 0.55, lateMinutes: 15, adminPin: '1234' },
  }));
  fs.writeFileSync(path.join(weakCompanyDir, 'security.json'), JSON.stringify({ tabletDevices: [] }));

  const port = await freePort();
  const serverPath = path.resolve(__dirname, '..', 'server.js');
  const child = spawn(process.execPath, [serverPath], {
    env: {
      ...process.env,
      PORT: String(port),
      TIMETRACK_DATA_DIR: dataDir,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let diagnostics = '';
  child.stdout.on('data', (chunk) => { diagnostics += chunk; });
  child.stderr.on('data', (chunk) => { diagnostics += chunk; });
  t.after(() => {
    if (child.exitCode === null) child.kill();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  const base = `http://127.0.0.1:${port}/api.php?c=${slug}&action=`;
  await waitForServer(`${base}companyInfo`, child);

  const request = async (action, { method = 'GET', cookie = '', csrf = '', body } = {}) => {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (cookie) headers.Cookie = cookie;
    if (csrf) headers['X-CSRF-Token'] = csrf;
    return fetch(base + action, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'manual',
    });
  };

  const publicStateResponse = await request('state');
  assert.equal(publicStateResponse.status, 401);
  assert.equal((await publicStateResponse.json()).state, undefined);
  assert.equal(publicStateResponse.headers.get('x-content-type-options'), 'nosniff');
  assert.match(publicStateResponse.headers.get('content-security-policy') || '', /default-src 'none'/);

  const catalogResponse = await fetch(`http://127.0.0.1:${port}/api.php?action=companies`);
  assert.equal(catalogResponse.status, 404);

  const loginResponse = await request('checkAdminPin', {
    method: 'POST',
    body: { adminPin: '246810' },
  });
  assert.equal(loginResponse.status, 200, diagnostics);
  const login = await loginResponse.json();
  assert.equal(login.ok, true);
  assert.equal(login.pinChangeRequired, undefined);
  assert.equal(login.state.settings.adminPin, undefined);
  assert.ok(login.csrfToken);
  const cookie = (loginResponse.headers.get('set-cookie') || '').split(';')[0];
  assert.ok(cookie);
  assert.match(loginResponse.headers.get('set-cookie') || '', /HttpOnly/i);
  assert.match(loginResponse.headers.get('set-cookie') || '', /SameSite=Strict/i);

  const migratedSettings = JSON.parse(fs.readFileSync(path.join(companyDir, 'settings.json'), 'utf8'));
  const migratedSecurity = JSON.parse(fs.readFileSync(path.join(companyDir, 'security.json'), 'utf8'));
  assert.equal(migratedSettings.settings.adminPin, undefined);
  assert.match(migratedSecurity.adminPinHash, /^pbkdf2-sha256\$/);
  assert.equal(migratedSecurity.adminPinHash.includes('246810'), false);

  const authenticatedState = await request('state', { cookie });
  assert.equal(authenticatedState.status, 200);

  const noCsrf = await request('saveEmployee', {
    method: 'POST',
    cookie,
    body: { employee: { id: 'e2', fname: 'No', lname: 'Csrf' } },
  });
  assert.equal(noCsrf.status, 403);
  assert.equal((await noCsrf.json()).code, 'CSRF_FAILED');

  const pairingResponse = await request('requestTabletAccess', {
    method: 'POST',
    cookie,
    csrf: login.csrfToken,
    body: {},
  });
  assert.equal(pairingResponse.status, 200);
  const pairing = await pairingResponse.json();
  assert.ok(pairing.token);

  const verifyResponse = await request('verifyTabletAccess', {
    method: 'POST',
    body: { token: pairing.token },
  });
  assert.equal(verifyResponse.status, 200);
  const verified = await verifyResponse.json();
  assert.ok(verified.deviceToken);
  assert.equal(verified.state.employees[0].photo, undefined);
  assert.equal(Array.isArray(verified.state.employees[0].descriptor), true);
  assert.deepEqual(verified.state.logs.map((log) => log.id), ['today-log']);
  assert.ok(verified.state.logs[0].ts);
  assert.equal(verified.state.logs[0].empPhoto, undefined);
  assert.equal(verified.state.logs[0].manualPhoto, undefined);

  const storedDeviceSecurity = JSON.parse(fs.readFileSync(path.join(companyDir, 'security.json'), 'utf8'));
  assert.ok(storedDeviceSecurity.tabletDevices[0].tokenHash);
  assert.equal(storedDeviceSecurity.tabletDevices[0].token, undefined);
  assert.equal(JSON.stringify(storedDeviceSecurity).includes(verified.deviceToken), false);

  const missingDeviceId = await request('addLog', {
    method: 'POST',
    body: { deviceToken: verified.deviceToken, log: { id: 'missing-device', empId: 'e1', type: 'checkout' } },
  });
  assert.equal(missingDeviceId.status, 403);

  const checkoutResponse = await request('addLog', {
    method: 'POST',
    body: {
      deviceToken: verified.deviceToken,
      deviceId: verified.deviceId,
      log: {
        id: 'today-checkout',
        empId: 'e1',
        empName: 'Forged Name',
        empPhoto: 'data:image/" onerror="alert(1)',
        type: 'checkout',
        date: kazakhstanDisplayDate(),
        time: '18:00',
        ts: new Date().toISOString(),
        verification: 'blink',
        isLate: true,
      },
    },
  });
  assert.equal(checkoutResponse.status, 200);
  const checkout = await checkoutResponse.json();
  assert.deepEqual(checkout.state.logs.map((item) => item.type), ['checkout', 'checkin']);
  assert.ok(checkout.state.logs.every((item) => item.ts));
  const storedCheckout = JSON.parse(fs.readFileSync(path.join(companyDir, 'logs.json'), 'utf8')).logs[0];
  assert.equal(storedCheckout.empName, 'Test Employee');
  assert.equal(storedCheckout.empPhoto, null);
  assert.equal(storedCheckout.verification, '');
  assert.ok(Math.abs(Date.parse(storedCheckout.ts) - Date.now()) < 15000);

  const duplicateResponse = await request('addLog', {
    method: 'POST',
    body: { deviceToken: verified.deviceToken, deviceId: verified.deviceId, log: { id: 'today-checkout', empId: 'e1', type: 'checkout' } },
  });
  assert.equal(duplicateResponse.status, 409);
  assert.equal((await duplicateResponse.json()).code, 'DUPLICATE_LOG_ID');

  const unknownEmployee = await request('addLog', {
    method: 'POST',
    body: { deviceToken: verified.deviceToken, deviceId: verified.deviceId, log: { id: 'unknown-employee', empId: 'not-an-employee', type: 'checkin' } },
  });
  assert.equal(unknownEmployee.status, 422);
  assert.equal((await unknownEmployee.json()).code, 'UNKNOWN_EMPLOYEE');

  const saveUser = await request('saveUser', {
    method: 'POST', cookie, csrf: login.csrfToken,
    body: { user: { name: 'Recruiter', login: 'recruiter-test', role: 'recruiter', password: 'strong-recruiter-password' } },
  });
  assert.equal(saveUser.status, 200);
  const recruiterLoginResponse = await request('checkAdminPin', {
    method: 'POST', body: { login: 'recruiter-test', password: 'strong-recruiter-password' },
  });
  assert.equal(recruiterLoginResponse.status, 200);
  const recruiterLogin = await recruiterLoginResponse.json();
  const recruiterCookie = (recruiterLoginResponse.headers.get('set-cookie') || '').split(';')[0];
  const recruiterPinChange = await request('changeAdminPin', {
    method: 'POST', cookie: recruiterCookie, csrf: recruiterLogin.csrfToken,
    body: { currentPin: '246810', newPin: '246802' },
  });
  assert.equal(recruiterPinChange.status, 403);
  assert.equal((await recruiterPinChange.json()).code, 'FORBIDDEN');

  const manualPhoto = `data:image/jpeg;base64,${Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(64)]).toString('base64')}`;
  const manualLog = { id: 'manual-checkin', empId: 'e1', type: 'checkin', manualPhoto };
  const manualWithoutApproval = await request('addManualLog', {
    method: 'POST', body: { deviceToken: verified.deviceToken, deviceId: verified.deviceId, log: manualLog, reason: 'Camera failure' },
  });
  assert.equal(manualWithoutApproval.status, 403);
  const approvedManual = await request('addManualLog', {
    method: 'POST', body: { deviceToken: verified.deviceToken, deviceId: verified.deviceId, log: manualLog, reason: 'Camera failure', supervisorPin: '246810' },
  });
  assert.equal(approvedManual.status, 200);
  const manualPhotoPath = JSON.parse(fs.readFileSync(path.join(companyDir, 'logs.json'), 'utf8')).logs[0].manualPhoto;
  assert.ok(fs.existsSync(path.join(companyDir, manualPhotoPath)));

  const deleteResponse = await request('deleteEmployee', {
    method: 'POST', cookie, csrf: login.csrfToken, body: { id: 'e1' },
  });
  assert.equal(deleteResponse.status, 200);
  const anonymized = JSON.parse(fs.readFileSync(path.join(companyDir, 'logs.json'), 'utf8')).logs;
  assert.ok(anonymized.every((item) => item.empName === 'Удалённый сотрудник' && !item.empIin && !item.empPhoto && !item.manualPhoto));
  assert.equal(fs.existsSync(path.join(companyDir, manualPhotoPath)), false);
  assert.equal(JSON.parse(fs.readFileSync(path.join(companyDir, 'employees.json'), 'utf8')).employees.length, 0);

  const devicesResponse = await request('listTabletDevices', {
    method: 'POST',
    cookie,
    csrf: login.csrfToken,
    body: {},
  });
  const devices = await devicesResponse.json();
  assert.equal(devices.devices.length, 1);
  assert.equal(devices.devices[0].tokenHash, undefined);

  const revokeResponse = await request('revokeTabletDevice', {
    method: 'POST',
    cookie,
    csrf: login.csrfToken,
    body: { deviceId: verified.deviceId },
  });
  assert.equal(revokeResponse.status, 200);

  const revokedTabletState = await request('tabletState', {
    method: 'POST',
    body: { deviceToken: verified.deviceToken, deviceId: verified.deviceId },
  });
  assert.equal(revokedTabletState.status, 403);
  assert.equal((await revokedTabletState.json()).code, 'TABLET_AUTH_REQUIRED');

  const logoutResponse = await request('logoutAdmin', {
    method: 'POST',
    cookie,
    csrf: login.csrfToken,
    body: {},
  });
  assert.equal(logoutResponse.status, 200);
  assert.equal((await request('state', { cookie })).status, 401);

  const weakBase = `http://127.0.0.1:${port}/api.php?c=${weakSlug}&action=`;
  const weakLoginResponse = await fetch(weakBase + 'checkAdminPin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminPin: '1234' }),
  });
  assert.equal(weakLoginResponse.status, 200);
  const weakLogin = await weakLoginResponse.json();
  const weakCookie = (weakLoginResponse.headers.get('set-cookie') || '').split(';')[0];
  assert.equal(weakLogin.pinChangeRequired, true);
  assert.equal(weakLogin.state, undefined);
  assert.ok(weakLogin.csrfToken);

  const restrictedState = await fetch(weakBase + 'state', { headers: { Cookie: weakCookie } });
  assert.equal(restrictedState.status, 428);
  assert.equal((await restrictedState.json()).code, 'PIN_CHANGE_REQUIRED');

  const changePinResponse = await fetch(weakBase + 'changeAdminPin', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: weakCookie,
      'X-CSRF-Token': weakLogin.csrfToken,
    },
    body: JSON.stringify({ currentPin: '1234', newPin: '246802' }),
  });
  assert.equal(changePinResponse.status, 200);
  const changed = await changePinResponse.json();
  const upgradedCookie = (changePinResponse.headers.get('set-cookie') || '').split(';')[0];
  assert.ok(changed.state);
  assert.ok(changed.csrfToken);
  assert.equal((await fetch(weakBase + 'state', { headers: { Cookie: upgradedCookie } })).status, 200);
});

test('security data migration hashes PINs and revokes legacy access', () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'timetrack-migration-'));
  const companyDir = path.join(dataDir, 'migration-test');
  fs.mkdirSync(companyDir, { recursive: true });
  fs.writeFileSync(path.join(companyDir, 'settings.json'), JSON.stringify({
    settings: {
      adminPin: '1234',
      recognitionModel: 'tiny',
    },
  }));
  fs.writeFileSync(path.join(companyDir, 'security.json'), JSON.stringify({
    adminSessions: [{ tokenHash: 'old-session' }],
    tabletToken: 'old-pairing-token',
    tabletExpires: new Date(Date.now() + 60000).toISOString(),
    tabletDevices: [{ id: 'legacy-device', token: 'raw-device-token' }],
  }));

  const migrationScript = path.resolve(__dirname, '..', 'scripts', 'migrate-security-data.js');
  const result = spawnSync(process.execPath, [
    migrationScript,
    '--data-dir',
    dataDir,
    '--apply',
    '--revoke-tablets',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr);
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.pinsMigrated, 1);
  assert.equal(summary.weakPinsRequiringChange, 1);
  assert.equal(summary.adminSessionsRevoked, 1);
  assert.equal(summary.tabletDevicesRevoked, 1);

  const settings = JSON.parse(fs.readFileSync(path.join(companyDir, 'settings.json'), 'utf8'));
  const security = JSON.parse(fs.readFileSync(path.join(companyDir, 'security.json'), 'utf8'));
  assert.equal(settings.settings.adminPin, undefined);
  assert.match(security.adminPinHash, /^pbkdf2-sha256\$600000\$/);
  assert.equal(security.pinChangeRequired, true);
  assert.deepEqual(security.adminSessions, []);
  assert.deepEqual(security.tabletDevices, []);
  assert.equal(security.tabletToken, null);
  assert.equal(security.tabletExpires, null);
  assert.equal(JSON.stringify({ settings, security }).includes('1234'), false);
  assert.equal(JSON.stringify({ settings, security }).includes('raw-device-token'), false);
});
