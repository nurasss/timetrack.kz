const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'tablet.html'), 'utf8');
function fragment(start, end) {
  return html.slice(html.indexOf(start), html.indexOf(end, html.indexOf(start)));
}

function identityHarness({ busyFor = 0, frames = [[]] } = {}) {
  let clock = 100;
  const emp = { id: 'e1', fname: 'Test', lname: 'Employee' };
  const messages = [];
  let frameIndex = 0;
  const context = vm.createContext({
    currentDetected: { employee: emp, samples: 2 },
    detecting: busyFor > 0, identityVerificationRunning: false,
    attendanceSubmitting: true, modelsLoadedFor: 'tiny',
    RECOGNITION_CONFIRMATION_HITS: 2,
    IDENTITY_WAIT_MS: 8000,
    IDENTITY_CAPTURE_ATTEMPTS: 3,
    lastConfirmedIdentityAt: 0, lastFullMatchAt: 0,
    Date: { now: () => clock },
    setTimeout: (fn, delay) => {
      clock += delay;
      if (clock >= 100 + busyFor) context.detecting = false;
      fn();
    },
    document: { getElementById: () => ({ readyState: 4 }) },
    detectorOptions: () => ({}),
    setVideoStatus: (message) => messages.push(message),
    toast: (message) => messages.push(message),
    setRecognitionUnknown() {}, resetRecognitionCandidate() {}, resetLiveness() {},
    recognitionFailureCopy: () => ({ title: 'Unclear frame', status: 'Look at camera' }),
    matchRecognition: (frame) => ({ employee: frame.employee, confidence: 90, distance: 0.2 }),
    faceapi: {
      detectAllFaces: () => ({
        withFaceLandmarks: () => ({
          withFaceDescriptors: async () => frames[Math.min(frameIndex++, frames.length - 1)],
        }),
      }),
    },
  });
  context.window = { faceapi: context.faceapi };
  vm.runInContext(fragment('async function verifyCurrentIdentity()', '\nlet manualQuery'), context);
  return { context, emp, messages };
}

test('an accepted tap waits for a slow background frame instead of requiring another tap', async () => {
  const { context } = identityHarness({ busyFor: 2100, frames: [[{ employee: { id: 'e1' } }]] });
  assert.equal(await context.verifyCurrentIdentity(), true);
  assert.equal(context.identityVerificationRunning, false);
});

test('a transient missing frame is retried within the same tap', async () => {
  const { context } = identityHarness({ frames: [[], [{ employee: { id: 'e1' } }]] });
  assert.equal(await context.verifyCurrentIdentity(), true);
});

test('a different employee or multiple faces must never inherit the accepted tap', async () => {
  for (const frames of [[[{ employee: { id: 'e2' } }]], [[{}, {}]]]) {
    const { context } = identityHarness({ frames });
    assert.equal(await context.verifyCurrentIdentity(), false);
    assert.equal(context.currentDetected, null);
  }
});

test('recognition rendering cannot re-enable buttons during submission', () => {
  const nodes = { 'btn-checkin': {}, 'btn-checkout': {} };
  const context = vm.createContext({
    attendanceSubmitting: true, currentDetected: { employee: { id: 'e1' } },
    document: { getElementById: (id) => nodes[id] }, nextActionFor: () => 'checkin',
  });
  vm.runInContext(fragment('function setButtons(', '\nasync function verifyCurrentIdentity'), context);
  context.setButtons(true);
  assert.equal(nodes['btn-checkin'].disabled, true);
  assert.equal(nodes['btn-checkout'].disabled, true);
});

test('repeated taps while saving produce one request and one success acknowledgement', async () => {
  let resolveSave;
  let writes = 0;
  let acknowledgements = 0;
  const context = vm.createContext({
    attendanceSubmitting: false, currentDetected: { employee: { id: 'e1', fname: 'Test', lname: 'Employee' } },
    Date, isLivenessValid: () => true, verifyCurrentIdentity: async () => true,
    nextActionFor: () => 'checkin', recentDuplicate: () => false,
    buildAttendanceLog: () => ({ id: 'unique-event', employeeId: 'e1', type: 'checkin' }),
    Store: { post: () => { writes++; return new Promise((resolve) => { resolveSave = resolve; }); } },
    setButtons() {}, setAttendanceProgress() {}, setVideoStatus() {},
    noteVisualActivity() {}, showSavedGreeting: () => { acknowledgements++; },
    resetRecognitionCandidate() {}, resetLiveness() {}, toast() {},
  });
  vm.runInContext(fragment('async function markAttendance(', '\nlet greetTimer'), context);
  const first = context.markAttendance('checkin');
  await Promise.resolve();
  await context.markAttendance('checkin');
  assert.equal(writes, 1);
  resolveSave(true);
  await first;
  assert.equal(acknowledgements, 1);
  assert.equal(context.attendanceSubmitting, false);
});

test('a stalled save is aborted instead of leaving attendance permanently busy', async () => {
  let timeout;
  let cleared = false;
  const context = vm.createContext({
    AbortController, API: '/api.php?action=', TABLET_REQUEST_TIMEOUT_MS: 12000,
    setTimeout: (fn) => { timeout = fn; return 1; },
    clearTimeout: () => { cleared = true; },
    fetch: async (_url, { signal }) => ({
      json: () => signal.aborted
        ? Promise.reject(signal.reason)
        : new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason))),
    }),
  });
  vm.runInContext(fragment('async function tabletJsonRequest(', '\nconst Store ='), context);
  const request = context.tabletJsonRequest('addLog', { log: { id: 'event' } });
  await Promise.resolve();
  timeout();
  await assert.rejects(request, { name: 'AbortError' });
  assert.equal(cleared, true);
});

test('a timed-out mark enters the outbox once with its original event time', async () => {
  let clock = Date.parse('2026-10-05T10:00:00Z');
  let queued;
  class ClockDate extends Date {
    constructor(value) { super(value === undefined ? clock : value); }
    static now() { return clock; }
  }
  const context = vm.createContext({
    Date: ClockDate, location: { protocol: 'https:' }, state: { logs: [] },
    tabletDeviceToken: () => 'token', tabletDeviceId: () => 'device',
    tabletJsonRequest: async () => { clock += 12000; throw new Error('Timed out'); },
    enqueueLog: (log) => { queued = log; return true; },
    saveLocal: () => true, renderAll() {}, toast() {}, showTabletLock() {},
  });
  vm.runInContext(fragment('const Store =', '\n// --- Offline outbox:'), context);
  const result = await vm.runInContext("Store.post('addLog', {log:{id:'one-tap',employeeId:'e1',type:'checkin'}})", context);
  assert.equal(result, 'queued');
  assert.equal(queued.id, 'one-tap');
  assert.equal(queued.clientTimestamp, '2026-10-05T10:00:00.000Z');
  assert.equal(context.state.logs.length, 1);
  assert.equal(context.state.logs[0].ts, queued.clientTimestamp);
});

test('a late background refresh cannot overwrite a newly saved mark', async () => {
  let resolveState;
  let applied = 0;
  const response = new Promise((resolve) => { resolveState = resolve; });
  const context = vm.createContext({
    attendanceSubmitting: false, stateRevision: 0,
    location: { protocol: 'https:' }, API: '/api.php?action=',
    tabletDeviceToken: () => 'token', tabletDeviceId: () => 'device',
    fetch: async () => ({ ok: true, json: () => response }),
    applyState: () => { applied++; }, saveLocal() {}, renderAll() {},
    queueSize: () => 0, flushQueue: async () => {},
  });
  vm.runInContext(fragment('const Store =', '\n// --- Offline outbox:'), context);
  const loading = vm.runInContext('Store.load()', context);
  context.stateRevision = 1; // The foreground save has already installed newer state.
  resolveState({ ok: true, state: { logs: [] } });
  await loading;
  assert.equal(applied, 0);
});

test('a saved mark is acknowledged even when the older outbox replay stalls', async () => {
  let replay;
  let replayStarted = false;
  const context = vm.createContext({
    location: { protocol: 'https:' }, console,
    tabletDeviceToken: () => 'token', tabletDeviceId: () => 'device',
    tabletJsonRequest: async () => ({ res: { ok: true }, data: { ok: true, state: { logs: [] } } }),
    applyState() {}, saveLocal() {}, renderAll() {},
    queueSize: () => 2,
    setTimeout: (callback) => { replay = callback; },
    flushQueue: () => { replayStarted = true; return new Promise(() => {}); },
  });
  vm.runInContext(fragment('const Store =', '\n// --- Offline outbox:'), context);
  const result = await vm.runInContext("Store.post('addLog', {log:{id:'new-mark'}})", context);
  assert.equal(result, true);
  assert.equal(replayStarted, false);
  assert.equal(typeof replay, 'function');
  replay();
  assert.equal(replayStarted, true);
});
