import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync
} from 'node:fs';
import { createServer } from 'node:net';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cacheRoot = path.join(serverRoot, 'node_modules', '.cache');
let runtimeRoot;
let runtimeServer;
let database;
let serverProcess;
let serverOutput = '';
let apiBase;
let student;
let admin;

async function findAvailablePort() {
  const listener = createServer();
  await new Promise((resolve, reject) => {
    listener.once('error', reject);
    listener.listen(0, '127.0.0.1', resolve);
  });
  const { port } = listener.address();
  await new Promise((resolve, reject) => {
    listener.close((error) => (error ? reject(error) : resolve()));
  });
  return port;
}

async function waitForServer() {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (serverProcess.exitCode !== null) {
      throw new Error(`Isolated server exited before becoming ready:\n${serverOutput}`);
    }
    try {
      const response = await fetch(`${apiBase}/api/health`);
      if (response.ok) return;
    } catch {
      // The isolated server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Timed out waiting for isolated server:\n${serverOutput}`);
}

async function send(pathname, { token, method = 'GET', body, headers = {} } = {}) {
  const requestHeaders = { ...headers };
  if (token) requestHeaders.Authorization = `Bearer ${token}`;
  const response = await fetch(`${apiBase}${pathname}`, {
    method,
    headers: requestHeaders,
    body
  });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
}

async function sendJson(pathname, { token, method = 'POST', body } = {}) {
  return send(pathname, {
    token,
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

async function register(email, fullName, role = 'student') {
  const response = await sendJson('/api/auth/register', {
    body: {
      email,
      password: 'isolated-test-password',
      full_name: fullName,
      role
    }
  });
  assert.equal(response.status, 201, 'fixture account should register in the isolated database');
  return response.data;
}

async function login(email, password) {
  const response = await sendJson('/api/auth/login', {
    body: { email, password }
  });
  assert.equal(response.status, 200, 'fixture account should log in');
  return response.data;
}

function buildIssueForm(candidate, { confirmationToken, filename = 'fixture.jpg' } = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries(candidate)) {
    if (value !== null && value !== undefined) form.append(key, String(value));
  }
  form.append('priority', 'medium');
  if (confirmationToken) {
    form.append('duplicate_confirmation_token', confirmationToken);
  }
  form.append(
    'image',
    new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' }),
    filename
  );
  return form;
}

async function submitIssue(candidate, { token = student.token, confirmationToken, filename } = {}) {
  return send('/api/issues', {
    token,
    method: 'POST',
    body: buildIssueForm(candidate, { confirmationToken, filename })
  });
}

async function checkDuplicates(candidate, token = student.token) {
  return sendJson('/api/issues/check-duplicates', { token, body: candidate });
}

function countRows(table, where = '', parameters = []) {
  return database.prepare(`SELECT COUNT(*) AS count FROM ${table} ${where}`).get(...parameters).count;
}

function notificationCount(userId) {
  return database.prepare('SELECT COUNT(*) AS count FROM notifications WHERE user_id = ?').get(userId).count;
}

function assertNoPrivateMatchFields(match) {
  for (const field of ['student_id', 'student_name', 'student_email', 'image_url', 'latitude', 'longitude']) {
    assert.equal(Object.hasOwn(match, field), false, `duplicate preview must not include ${field}`);
  }
}

before(async () => {
  mkdirSync(cacheRoot, { recursive: true });
  runtimeRoot = mkdtempSync(path.join(cacheRoot, 'campusfix-e2e-'));
  runtimeServer = path.join(runtimeRoot, 'server');
  mkdirSync(runtimeServer, { recursive: true });
  cpSync(path.join(serverRoot, 'src'), path.join(runtimeServer, 'src'), { recursive: true });
  copyFileSync(path.join(serverRoot, 'package.json'), path.join(runtimeServer, 'package.json'));
  copyFileSync(path.join(serverRoot, 'tsconfig.json'), path.join(runtimeServer, 'tsconfig.json'));

  const port = await findAvailablePort();
  apiBase = `http://127.0.0.1:${port}`;
  serverProcess = spawn(
    process.execPath,
    [path.join(serverRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs'), 'src/index.ts'],
    {
      cwd: runtimeServer,
      env: {
        ...process.env,
        PORT: String(port),
        GEMINI_API_KEY: '',
        JWT_SECRET: 'campusfix-isolated-integration-test-secret'
      },
      stdio: ['ignore', 'pipe', 'pipe']
    }
  );
  serverProcess.stdout.setEncoding('utf8').on('data', (chunk) => { serverOutput += chunk; });
  serverProcess.stderr.setEncoding('utf8').on('data', (chunk) => { serverOutput += chunk; });
  serverProcess.on('error', (error) => { serverOutput += `Server process error: ${error.message}\n`; });

  await waitForServer();
  database = new DatabaseSync(path.join(runtimeRoot, 'data', 'campusfix.sqlite'));
  student = await register('student@integration.test', 'CampusFix Test Student');
  const adminRegistration = await register('admin@integration.test', 'CampusFix Test Admin', 'admin');
  assert.equal(adminRegistration.user.role, 'student', 'public registration must not grant admin privileges');
  database.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(adminRegistration.user.id);
  admin = await login('admin@integration.test', 'isolated-test-password');
});

after(async () => {
  database?.close();

  if (serverProcess && serverProcess.exitCode === null) {
    const exited = new Promise((resolve) => serverProcess.once('exit', resolve));
    serverProcess.kill();
    await Promise.race([
      exited,
      new Promise((resolve) => setTimeout(resolve, 3_000))
    ]);
    if (serverProcess.exitCode === null) serverProcess.kill('SIGKILL');
  }

  if (
    runtimeRoot &&
    path.dirname(runtimeRoot) === cacheRoot &&
    path.basename(runtimeRoot).startsWith('campusfix-e2e-') &&
    existsSync(runtimeRoot)
  ) {
    rmSync(runtimeRoot, { recursive: true, force: true });
  }
});

test('isolated HTTP issue workflow, auth, uploads, duplicate confirmations, and notifications', async (t) => {
  const tapReport = {
    title: 'Leaking water tap',
    description: 'Water continues leaking from the tap beside the library entrance and makes the floor slippery.',
    category: 'Water Leakage',
    location_name: 'Main Library',
    latitude: 12.9716,
    longitude: 77.5946
  };

  await t.test('A, M: a new report saves once with existing issue and notification behavior', async () => {
    const preflight = await checkDuplicates(tapReport);
    assert.equal(preflight.status, 200);
    assert.deepEqual(preflight.data.potentialMatches, []);

    const created = await submitIssue(tapReport, { filename: 'tap-first.jpg' });
    assert.equal(created.status, 201);
    assert.equal(created.data.issue.status, 'pending');
    assert.equal(created.data.issue.issue_code, 'CF-1001');
    assert.equal(countRows('issues'), 1);
    assert.equal(countRows('issue_updates', 'WHERE issue_id = ?', [created.data.issue.id]), 1);
    assert.equal(notificationCount(student.user.id), 1);
    assert.equal(notificationCount(admin.user.id), 1);
    assert.equal(countRows('notifications'), 2);

    const uploadedPath = path.join(runtimeRoot, 'uploads', path.basename(created.data.issue.image_url));
    assert.equal(existsSync(uploadedPath), true, 'successful report image should remain in isolated uploads');
  });

  await t.test('B, N: similar unresolved report warns and match summaries omit private fields', async () => {
    const checked = await checkDuplicates(tapReport);
    assert.equal(checked.status, 200);
    assert.equal(checked.data.potentialMatches.length, 1);
    assert.equal(checked.data.potentialMatches[0].issue_code, 'CF-1001');
    assert.ok(checked.data.confirmationToken);
    assertNoPrivateMatchFields(checked.data.potentialMatches[0]);

    const issueCount = countRows('issues');
    const notifications = countRows('notifications');
    const uploadCount = readdirSync(path.join(runtimeRoot, 'uploads')).length;
    const bypassed = await submitIssue(tapReport, { filename: 'blocked-duplicate.jpg' });
    assert.equal(bypassed.status, 409, 'direct create request without preflight confirmation should be rejected');
    assert.equal(bypassed.data.potentialMatches[0].issue_code, 'CF-1001');
    assert.equal(countRows('issues'), issueCount);
    assert.equal(countRows('notifications'), notifications);
    assert.equal(readdirSync(path.join(runtimeRoot, 'uploads')).length, uploadCount);
  });

  await t.test('C: similar details within 100 meters match with a different location name', async () => {
    const nearby = {
      ...tapReport,
      location_name: 'Library East Entrance',
      latitude: 12.9721,
      longitude: 77.5946
    };
    const checked = await checkDuplicates(nearby);
    assert.equal(checked.data.potentialMatches.length, 1);
    assert.ok(checked.data.potentialMatches[0].match_reasons.includes('Within 100 m'));
  });

  await t.test('D: same category and details at a distant location do not match', async () => {
    const distant = {
      ...tapReport,
      location_name: 'North Sports Complex',
      latitude: 13.001,
      longitude: 77.62
    };
    const checked = await checkDuplicates(distant);
    assert.equal(checked.status, 200);
    assert.deepEqual(checked.data.potentialMatches, []);
  });

  await t.test('E: a different issue in the same building is accepted', async () => {
    const differentIssue = {
      ...tapReport,
      title: 'Flickering hallway light',
      description: 'The fluorescent lamp flickers above the western corridor exit and goes dark every few minutes.',
      category: 'Lighting'
    };
    const checked = await checkDuplicates(differentIssue);
    assert.deepEqual(checked.data.potentialMatches, []);

    const created = await submitIssue(differentIssue, { filename: 'different-light.jpg' });
    assert.equal(created.status, 201);
    assert.equal(countRows('issues'), 2);
    assert.equal(notificationCount(student.user.id), 2);
    assert.equal(notificationCount(admin.user.id), 2);
  });

  await t.test('F, G: resolved/closed and missing/invalid coordinates follow the defined rules', async () => {
    const updateStatus = database.prepare('UPDATE issues SET status = ? WHERE issue_code = ?');
    for (const status of ['resolved', 'closed']) {
      updateStatus.run(status, 'CF-1001');
      const checked = await checkDuplicates(tapReport);
      assert.deepEqual(checked.data.potentialMatches, [], `${status} issues should not be returned as matches`);
    }
    updateStatus.run('pending', 'CF-1001');

    const withoutCoordinates = { ...tapReport, latitude: null, longitude: null };
    const missingCoordinates = await checkDuplicates(withoutCoordinates);
    assert.equal(missingCoordinates.status, 200);
    assert.equal(missingCoordinates.data.potentialMatches.length, 1);

    const invalidCoordinates = await checkDuplicates({ ...tapReport, latitude: 91 });
    assert.equal(invalidCoordinates.status, 400);
    const partialCoordinates = await checkDuplicates({ ...tapReport, longitude: null });
    assert.equal(partialCoordinates.status, 400);
    const missingLocation = await checkDuplicates({ ...tapReport, location_name: '' });
    assert.equal(missingLocation.status, 400);
  });

  await t.test('H, N: reports are private to students and the admin can retrieve the queue', async () => {
    const unauthenticatedCheck = await checkDuplicates(tapReport, null);
    assert.equal(unauthenticatedCheck.status, 401);

    const unauthenticatedSubmit = await submitIssue(tapReport, { token: null });
    assert.equal(unauthenticatedSubmit.status, 401);

    const firstIssue = database.prepare('SELECT id FROM issues WHERE student_id = ? ORDER BY id LIMIT 1')
      .get(student.user.id);
    const unauthenticatedList = await send('/api/issues');
    assert.equal(unauthenticatedList.status, 401);
    const unauthenticatedDetail = await send(`/api/issues/${firstIssue.id}`);
    assert.equal(unauthenticatedDetail.status, 401);

    const ownDetail = await send(`/api/issues/${firstIssue.id}`, { token: student.token });
    assert.equal(ownDetail.status, 200);
    assert.equal(ownDetail.data.issue.id, firstIssue.id);
    assert.equal(Object.hasOwn(ownDetail.data.issue, 'student_email'), false);
    assert.equal(Object.hasOwn(ownDetail.data.issue, 'student_department'), false);
    assert.equal(Object.hasOwn(ownDetail.data.issue, 'assigned_email'), false);

    const otherStudent = await register('other.student@integration.test', 'Other Test Student');
    const otherIssue = await submitIssue({
      title: 'Broken computer lab chair',
      description: 'The chair at workstation twenty in the east computer lab has a split seat.',
      category: 'Classroom Equipment',
      location_name: 'East Computer Lab',
      latitude: 12.99,
      longitude: 77.61
    }, { token: otherStudent.token, filename: 'other-student-report.jpg' });
    assert.equal(otherIssue.status, 201);

    const issueCountBeforeDeniedReads = countRows('issues');
    const notificationCountBeforeDeniedReads = countRows('notifications');
    const crossStudentDetail = await send(`/api/issues/${otherIssue.data.issue.id}`, { token: student.token });
    assert.equal(crossStudentDetail.status, 404, 'another student’s report should not be disclosed');

    const crossStudentQueue = await send('/api/issues?all=true', { token: student.token });
    assert.equal(crossStudentQueue.status, 200);
    assert.equal(crossStudentQueue.data.issues.length, 2);
    assert.ok(crossStudentQueue.data.issues.every((issue) => issue.student_id === student.user.id));
    assert.ok(crossStudentQueue.data.issues.every((issue) => !Object.hasOwn(issue, 'student_email')));
    assert.ok(crossStudentQueue.data.issues.every((issue) => issue.id !== otherIssue.data.issue.id));

    const crossStudentFilter = await send(`/api/issues?student_id=${otherStudent.user.id}`, { token: student.token });
    assert.equal(crossStudentFilter.status, 200);
    assert.ok(crossStudentFilter.data.issues.every((issue) => issue.student_id === student.user.id));

    assert.equal(countRows('issues'), issueCountBeforeDeniedReads);
    assert.equal(countRows('notifications'), notificationCountBeforeDeniedReads);

    const adminQueue = await send('/api/issues', { token: admin.token });
    assert.equal(adminQueue.status, 200);
    assert.equal(adminQueue.data.issues.length, 3);
    assert.ok(adminQueue.data.issues.every((issue) => issue.issue_code && issue.status));
    assert.ok(adminQueue.data.issues.some((issue) => issue.id === otherIssue.data.issue.id && issue.student_email));
  });

  await t.test('I: expired and reused confirmations cannot authorize duplicate submission', async () => {
    const expiredCheck = await checkDuplicates(tapReport);
    assert.ok(expiredCheck.data.confirmationToken);
    const expiredHash = createHash('sha256').update(expiredCheck.data.confirmationToken).digest('hex');
    database.prepare('UPDATE issue_duplicate_confirmations SET expires_at = ? WHERE token_hash = ?')
      .run(Date.now() - 1, expiredHash);

    const issueCount = countRows('issues');
    const notificationCountBefore = countRows('notifications');
    const expiredAttempt = await submitIssue(tapReport, {
      confirmationToken: expiredCheck.data.confirmationToken,
      filename: 'expired-confirmation.jpg'
    });
    assert.equal(expiredAttempt.status, 409);
    assert.equal(countRows('issues'), issueCount);
    assert.equal(countRows('notifications'), notificationCountBefore);

    const first = await checkDuplicates(tapReport);
    const second = await checkDuplicates(tapReport);
    const accepted = await submitIssue(tapReport, {
      confirmationToken: first.data.confirmationToken,
      filename: 'confirmed-report.jpg'
    });
    assert.equal(accepted.status, 201);

    const reused = await submitIssue(tapReport, {
      confirmationToken: first.data.confirmationToken,
      filename: 'reused-confirmation.jpg'
    });
    assert.equal(reused.status, 409);

    const stale = await submitIssue(tapReport, {
      confirmationToken: second.data.confirmationToken,
      filename: 'stale-confirmation.jpg'
    });
    assert.equal(stale.status, 409, 'a token bound to an old match set should be rejected');
  });

  await t.test('J: valid confirmation allows a student to continue after reviewing a potential match', async () => {
    const candidate = {
      ...tapReport,
      title: 'Tap still leaking after walkthrough',
      description: 'The library entrance water tap still leaks onto the floor during the evening walkthrough.'
    };
    const checked = await checkDuplicates(candidate);
    assert.ok(checked.data.potentialMatches.length > 0);
    assert.ok(checked.data.confirmationToken);

    const submitted = await submitIssue(candidate, {
      confirmationToken: checked.data.confirmationToken,
      filename: 'student-confirmed.jpg'
    });
    assert.equal(submitted.status, 201);
    assert.equal(submitted.data.issue.status, 'pending');
  });

  await t.test('K, L: concurrent repeated submissions create at most one report and one notification pair', async () => {
    const candidate = {
      title: 'Broken drinking fountain',
      description: 'The drinking fountain beside the south gym entrance has stopped dispensing water.',
      category: 'Classroom Equipment',
      location_name: 'South Gym',
      latitude: 12.98,
      longitude: 77.60
    };
    const preflight = await checkDuplicates(candidate);
    assert.deepEqual(preflight.data.potentialMatches, []);

    const issueCount = countRows('issues');
    const notifications = countRows('notifications');
    const [first, second] = await Promise.all([
      submitIssue(candidate, { filename: 'concurrent-one.jpg' }),
      submitIssue(candidate, { filename: 'concurrent-two.jpg' })
    ]);
    assert.deepEqual([first.status, second.status].sort(), [201, 409]);
    assert.equal(countRows('issues'), issueCount + 1);
    assert.equal(countRows('notifications'), notifications + 2);
  });

  await t.test('M, O: existing classification endpoint stays local and admin sees submitted queue entries', async () => {
    const form = new FormData();
    form.append(
      'image',
      new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' }),
      'water-leakage-fixture.jpg'
    );
    const classification = await send('/api/ai/classify', { method: 'POST', body: form });
    assert.equal(classification.status, 200);
    assert.equal(classification.data.analysis.provider, 'heuristic');
    assert.equal(classification.data.analysis.suggestedCategory, 'Water Leakage');

    const queue = await send('/api/issues', { token: admin.token });
    assert.equal(queue.status, 200);
    assert.ok(queue.data.issues.length >= 5);
    assert.ok(queue.data.issues.some((issue) => issue.issue_code === 'CF-1001' && issue.status === 'pending'));
  });
});
