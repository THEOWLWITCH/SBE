import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startProviderCapture } from '../../scripts/provider-config-capture.mjs';

const serviceId = 'srv-synthetic1234';
const secret = 'synthetic-confidential-value-never-echo';
const document = { provider: 'render', identity: serviceId, payload: { original: { envText: `SYNTHETIC_TOKEN=${secret}\nMULTILINE="first\nsecond"\n` }, secretFiles: [{ filename: 'synthetic.txt', content: secret }], metadata: { region: 'synthetic-region' } } };
const wire = value => new URLSearchParams({ configuration: typeof value === 'string' ? value : JSON.stringify(value) }).toString();

function request(url, { method = 'POST', origin = new URL(url).origin, body = wire(document), headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method, headers: { ...(origin === null ? {} : { Origin: origin }), 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body), ...headers } }, res => {
      const chunks = []; res.on('data', chunk => chunks.push(chunk)); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.once('error', reject); req.end(body);
  });
}
async function capture(t, options = {}) {
  const persisted = [], reports = [], rejections = [];
  const session = await startProviderCapture({ expectedServiceId: serviceId, persist: async value => { persisted.push({ plaintext: Buffer.from(value.plaintext), metadata: value.metadata }); return { ciphertextSha256: 'a'.repeat(64), ciphertextBytes: 100 }; }, onComplete: report => reports.push(report), onRejected: diagnostic => rejections.push(diagnostic), ...options });
  t.after(() => { session.server.closeAllConnections(); return new Promise(resolve => session.server.close(resolve)); });
  return { ...session, persisted, reports, rejections };
}

test('loopback form has no stored configuration and restricts the host, origin, and content type', async t => {
  const session = await capture(t);
  const get = await request(session.url, { method: 'GET', body: '' });
  assert.equal(get.status, 200);
  assert.match(get.body, /name="configuration"/);
  assert.match(get.body, /autocomplete="off"/);
  assert.doesNotMatch(get.body, /<script|https?:\/\//);
  assert.equal(get.headers['cache-control'], 'no-store');
  assert.equal(get.headers['referrer-policy'], 'same-origin');
  assert.match(get.headers['content-security-policy'], /default-src 'none'/);
  assert.equal((await request(session.url, { origin: 'https://untrusted.invalid' })).status, 403);
  assert.equal((await request(session.url, { headers: { Host: 'localhost' } })).status, 404);
  assert.equal((await request(session.url, { headers: { 'Content-Type': 'application/json' } })).status, 403);
  assert.equal(session.persisted.length, 0);
});

test('missing, opaque-null, and arbitrary origins remain rejected with value-free diagnostic classifications', async t => {
  const session = await capture(t);
  for (const [origin, classification] of [[null, 'missing'], ['null', 'opaque-null'], [`https://${secret}.invalid`, 'other']]) {
    const response = await request(session.url, { origin });
    assert.equal(response.status, 403);
    assert.equal(response.body, 'Forbidden(origin)');
    assert.deepEqual(session.rejections.at(-1), { rejected: true, reason: 'origin', originClassification: classification });
  }
  for (const [options, reason] of [[{ method: 'DELETE' }, 'method'], [{ headers: { 'Content-Type': 'application/json' } }, 'contenttype'], [{ headers: { 'Content-Encoding': 'identity' } }, 'contentencoding']]) {
    const response = await request(session.url, options);
    assert.equal(response.status, 403);
    assert.equal(response.body, 'Forbidden(' + reason + ')');
    assert.deepEqual(session.rejections.at(-1), { rejected: true, reason, originClassification: 'expected-local' });
  }
  assert.equal(session.persisted.length, 0);
  assert.ok(!JSON.stringify(session.rejections).includes(secret));
  assert.ok(!JSON.stringify(session.rejections).includes('https://'));
});

test('oversized wire and JSON, malformed JSON, and wrong provider identity fail before persistence', async t => {
  const session = await capture(t, { maxJsonBytes: 1024, maxWireBytes: 4096 });
  const bodies = [
    [wire('x'.repeat(4097)), 413],
    [wire(JSON.stringify({ ...document, payload: { text: 'x'.repeat(1100) } })), 413],
    [wire(`{"payload":"${secret}`), 400],
    [wire({ ...document, identity: 'srv-anothersynthetic' }), 400],
    [wire({ ...document, provider: 'other' }), 400],
    [wire({ ...document, payload: [] }), 400],
    [wire(document) + '&configuration=' + encodeURIComponent(JSON.stringify(document)), 400]
  ];
  for (const [body, status] of bodies) {
    const response = await request(session.url, { body });
    assert.equal(response.status, status);
    assert.ok(!response.body.includes(secret));
  }
  assert.equal(session.persisted.length, 0);
  assert.equal(session.reports.length, 0);
});

test('successful capture persists the exact serialized envelope with intact confidential payload once', async t => {
  const session = await capture(t);
  const response = await request(session.url);
  assert.equal(response.status, 200);
  assert.ok(!response.body.includes(secret));
  assert.equal(session.persisted.length, 1);
  const { plaintext, metadata } = session.persisted[0];
  const envelope = JSON.parse(plaintext.toString('utf8'));
  assert.deepEqual(envelope.payload, document.payload);
  assert.equal(envelope.identity, serviceId);
  assert.equal(envelope.provider, 'render');
  assert.equal(new Date(envelope.capturedAtISO).toISOString(), envelope.capturedAtISO);
  assert.equal(plaintext.toString('utf8'), JSON.stringify({ provider: 'render', identity: serviceId, capturedAtISO: metadata.capturedAtISO, payload: document.payload }));
  assert.equal(metadata.capturedPayloadSectionCount, 3);
  assert.equal(session.reports[0].independentCopyVerified, false);
  assert.equal(session.reports[0].providerRestorePerformed, false);
  assert.equal(session.reports[0].crossMachineRecoveryVerified, false);
  assert.ok(!JSON.stringify(session.reports).includes(secret));
  assert.ok(!JSON.stringify(session.reports).includes('SYNTHETIC_TOKEN'));
  await assert.rejects(request(session.url));
  assert.equal(session.persisted.length, 1);
  plaintext.fill(0);
});

test('an in-flight capture cannot persist a concurrent second submission and clears the original buffer', async t => {
  let release, entered, original;
  const started = new Promise(resolve => { entered = resolve; });
  const pending = new Promise(resolve => { release = resolve; });
  let calls = 0;
  const session = await capture(t, { persist: async ({ plaintext }) => { calls++; original = plaintext; entered(); await pending; return {}; } });
  const first = request(session.url);
  await started;
  assert.equal((await request(session.url)).status, 409);
  release();
  assert.equal((await first).status, 200);
  assert.equal(calls, 1);
  assert.ok(original.every(byte => byte === 0));
});

test('persistence errors do not echo exception details or confidential configuration', async t => {
  const session = await capture(t, { persist: async () => { throw new Error(secret); } });
  const response = await request(session.url);
  assert.equal(response.status, 500);
  assert.ok(!response.body.includes(secret));
  assert.equal(session.reports.length, 0);
});

test('capture expires without accepting configuration', async t => {
  const session = await capture(t, { lifetimeMs: 15 });
  await new Promise(resolve => setTimeout(resolve, 40));
  await assert.rejects(request(session.url));
  assert.equal(session.persisted.length, 0);
});

test('Windows CLI encrypts only synthetic configuration and verifies local DPAPI reopening', { skip: process.platform !== 'win32' || Number(process.versions.node.split('.')[0]) !== 24, timeout: 30_000 }, async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'provider-capture-synthetic-'));
  const child = spawn(process.execPath, [fileURLToPath(new URL('../../scripts/provider-config-capture.mjs', import.meta.url)), directory, serviceId], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  const closed = new Promise(resolve => child.once('close', resolve));
  child.stderr.on('data', bytes => bytes.fill(0));
  t.after(async () => {
    child.kill();
    await closed;
    const expectedPrefix = path.resolve(tmpdir()) + path.sep + 'provider-capture-synthetic-';
    assert.ok(path.resolve(directory).startsWith(expectedPrefix));
    await rm(directory, { recursive: true, force: true });
  });
  let ready, saved, output = '';
  let announce;
  const announced = new Promise(resolve => { announce = resolve; });
  child.stdout.on('data', chunk => {
    output += chunk.toString('utf8');
    const lines = output.split('\n'); output = lines.pop();
    for (const line of lines) {
      let event;
      try { event = JSON.parse(line); } catch { continue; }
      if (event.ready) { ready = event; announce(); }
      if (event.saved) saved = event;
    }
  });
  await Promise.race([announced, closed.then(() => { throw new Error('Synthetic capture did not start'); })]);
  const response = await request(ready.url);
  assert.equal(response.status, 200);
  assert.ok(!response.body.includes(secret));
  assert.equal(await closed, 0);
  assert.equal(saved.dpapiCurrentUserRoundTripVerified, true);
  assert.equal(saved.independentCopyVerified, false);
  assert.match(path.basename(ready.output), /^render-configuration-\d{8}-[a-f0-9]{16}\.dpapi$/);
  const cipher = await readFile(ready.output);
  assert.ok(cipher.length > 0);
  assert.equal(cipher.includes(Buffer.from(secret)), false);
  const report = await readFile(ready.reportPath, 'utf8');
  assert.ok(!report.includes(secret));
  assert.ok(!report.includes('SYNTHETIC_TOKEN'));
  assert.equal(JSON.parse(report).ciphertextBytes, cipher.length);
  cipher.fill(0);
  const restarted = spawn(process.execPath, [fileURLToPath(new URL('../../scripts/provider-config-capture.mjs', import.meta.url)), directory, serviceId], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  const restartClosed = new Promise(resolve => restarted.once('close', resolve));
  t.after(async () => { restarted.kill(); await restartClosed; });
  restarted.stderr.on('data', bytes => bytes.fill(0));
  let restartOutput = '';
  const restartReady = new Promise(resolve => restarted.stdout.on('data', chunk => {
    restartOutput += chunk.toString('utf8');
    for (const line of restartOutput.split('\n')) {
      try { if (JSON.parse(line).ready) resolve(); } catch { /* Only complete JSON lines matter. */ }
    }
  }));
  await Promise.race([restartReady, restartClosed.then(() => { throw new Error('Synthetic restart did not start'); })]);
  restarted.kill();
  await restartClosed;
});

test('Windows startup failure reports only a safe stage when PowerShell is unavailable', { skip: process.platform !== 'win32' || Number(process.versions.node.split('.')[0]) !== 24, timeout: 10_000 }, async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'provider-capture-synthetic-'));
  t.after(async () => {
    assert.ok(path.resolve(directory).startsWith(path.resolve(tmpdir()) + path.sep + 'provider-capture-synthetic-'));
    await rm(directory, { recursive: true, force: true });
  });
  const environment = { ...process.env };
  for (const key of Object.keys(environment)) if (key.toLowerCase() === 'path') delete environment[key];
  environment.PATH = '';
  const child = spawn(process.execPath, [fileURLToPath(new URL('../../scripts/provider-config-capture.mjs', import.meta.url)), directory, serviceId], { env: environment, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let stdout = '', stderr = '';
  child.stdout.on('data', chunk => { stdout += chunk.toString('utf8'); });
  child.stderr.on('data', chunk => { stderr += chunk.toString('utf8'); });
  const code = await new Promise(resolve => child.once('close', resolve));
  assert.equal(code, 1);
  assert.equal(stdout, '');
  assert.deepEqual(JSON.parse(stderr), { ready: false, stage: 'directory-acl-process-unavailable', confidentialDetailsOmitted: true });
  assert.ok(!stderr.includes(directory));
});
