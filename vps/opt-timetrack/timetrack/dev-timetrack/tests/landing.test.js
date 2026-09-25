const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('landing install notice is hidden initially and claimed once per tab session', () => {
  const file = path.resolve(__dirname, '..', 'index.html');
  const html = fs.readFileSync(file, 'utf8');

  assert.match(
    html,
    /class="mobile-install-notice is-hidden" id="mobile-install-notice"/,
  );
  assert.match(
    html,
    /sessionStorage\.getItem\(MOBILE_INSTALL_NOTICE_SESSION_KEY\)/,
  );
  assert.match(
    html,
    /sessionStorage\.setItem\(MOBILE_INSTALL_NOTICE_SESSION_KEY,\s*'1'\)/,
  );
  assert.match(html, /showMobileInstallNoticeOnce\(\)/);

  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1])
    .filter((script) => script.trim());
  assert.ok(scripts.length > 0);
  scripts.forEach((script, index) => {
    assert.doesNotThrow(
      () => new vm.Script(script, { filename: `index-inline-${index + 1}.js` }),
    );
  });
});

test('landing closes the presentation modal when the local video ends', () => {
  const file = path.resolve(__dirname, '..', 'index.html');
  const html = fs.readFileSync(file, 'utf8');

  assert.match(
    html,
    /getElementById\('demo-local-video'\)\?\.addEventListener\('ended', closeDemoModal\)/,
  );
});

test('landing selects local mobile and desktop presentation videos for Kazakh', () => {
  const file = path.resolve(__dirname, '..', 'index.html');
  const html = fs.readFileSync(file, 'utf8');

  assert.match(html, /const DEMO_KZ_DESKTOP_URL = 'videos\/how-it-works-kz-desktop\.mp4\?v=\d{8}-\d+'/);
  assert.match(html, /const DEMO_KZ_MOBILE_URL = 'videos\/how-it-works-kz-mobile\.mp4\?v=\d{8}-\d+'/);
  assert.match(html, /kaz: \{ desktop: DEMO_KZ_DESKTOP_URL, mobile: DEMO_KZ_MOBILE_URL \}/);
  assert.match(
    html,
    /localVideo\.src = usePortraitVideo \? localVideoUrls\.mobile : localVideoUrls\.desktop/,
  );
});

test('deployed admin and tablet inline scripts parse', () => {
  for (const name of ['admin.html', 'tablet.html']) {
    const html = fs.readFileSync(path.resolve(__dirname, '..', 'public', name), 'utf8');
    const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
      .map((match) => match[1])
      .filter((script) => script.trim());
    assert.ok(scripts.length > 0, name);
    scripts.forEach((script, index) => {
      assert.doesNotThrow(() => new vm.Script(script, { filename: `${name}-${index + 1}.js` }));
    });
  }
});
