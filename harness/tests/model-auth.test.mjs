// מי יכול/ה לפנות למודל (10/10/2026): רק מי שנכנס/ה, ורק לכלי שפתוח לו או לה. מנהלת המערכת: הכול.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { handleAccess, authorizeModel, MODEL_PAGES, WORKSHOP_MODEL_PAGES } from '../lib/access.mjs';

function memoryStore(seed = {}) {
  const data = new Map(Object.entries(seed));
  return { data, async get(k) { return data.get(k) || null; }, async set(k, v) { data.set(k, v); }, async del(k) { data.delete(k); },
    async list(prefix, o = {}) { return [...data].filter(([k]) => k.startsWith(prefix)).map(([key, value]) => o.keysOnly ? { key } : { key, value }); },
    async delPrefix(prefix) { for (const k of data.keys()) if (k.startsWith(prefix)) data.delete(k); } };
}
async function codeLogin(perms) {
  const store = memoryStore({ institutions: [{ name: 'Inst', code: '123456', active: true }],
    'modules:Inst': Object.fromEntries(perms.map((p) => [p, true])),
    'code:TEST1234': { code: 'TEST-1234', kind: 'staff', inst: 'Inst', perms, revoked: false } });
  const [status, out] = await handleAccess(store, { action: 'login', kind: 'code', secret: 'TEST-1234' });
  assert.equal(status, 200);
  return { store, token: out.token };
}

test('a code opens the model only for its own tool', async () => {
  const { store, token } = await codeLogin(['writer']);
  assert.ok((await authorizeModel(store, { token, page: 'message-writer.html' })).ok);
  for (const page of ['facilitation-advisor.html', 'resilience-advisor.html', 'routines-hub.html', 'continuity-kit.html', 'demo-lab.html', 'nothing.html', ''])
    assert.equal((await authorizeModel(store, { token, page })).ok, false, page);
});

test('a revoked code stops at once, and a forged or missing token is refused', async () => {
  const { store, token } = await codeLogin(['nana']);
  assert.ok((await authorizeModel(store, { token, page: '/app/facilitation-advisor.html' })).ok);
  store.data.get('code:TEST1234').revoked = true;
  assert.equal((await authorizeModel(store, { token, page: 'facilitation-advisor.html' })).ok, false);
  assert.equal((await authorizeModel(store, { token: token.slice(0, -2) + 'xx', page: 'facilitation-advisor.html' })).ok, false);
  assert.equal((await authorizeModel(store, {})).ok, false);
  assert.equal((await authorizeModel(store, undefined)).ok, false);
});

test('the system admin can use every tool, including tools not yet open to others', async () => {
  const store = memoryStore();
  const [, out] = await handleAccess(store, { action: 'login', kind: 'sys', secret: '990211' });
  for (const page of ['routines-hub.html', 'continuity-kit.html', 'demo-lab.html', 'journeys.html', 'message-writer.html'])
    assert.ok((await authorizeModel(store, { token: out.token, page })).ok, page);
});

test('workshop access uses the signed role issued by the actual join flow, never a workshop id alone', async () => {
  const at = new Date().toISOString();
  const store = memoryStore({ 'wf:abcdefgh12': { w: 'abcdefgh12', inst: '', created: at },
    'wfc:123456': { w: 'abcdefgh12', at } });
  const [status, out] = await handleAccess(store, { action: 'wfJoin', code: '123456', role: 'parent' });
  assert.equal(status, 200);
  assert.ok((await authorizeModel(store, { token: out.token, page: 'practice.html' })).ok);
  assert.ok((await authorizeModel(store, { token: out.token, page: 'conversation-planner.html' })).ok);
  assert.equal((await authorizeModel(store, { token: out.token, page: 'activity-planner.html' })).ok, false);
  assert.equal((await authorizeModel(store, { w: 'abcdefgh12', page: 'practice.html' })).ok, false);
  await store.del('wfc:123456');
  assert.equal((await authorizeModel(store, { token: out.token, page: 'practice.html' })).ok, false);
  for (const p of WORKSHOP_MODEL_PAGES) assert.ok(MODEL_PAGES[p], p);
});

test('Nana opens the team lab, and activity or conversation opens approved-plan rehearsal', async () => {
  for (const [perm, own, other] of [
    ['nana', 'team-learning-lab.html', 'rehearsal.html'],
    ['activity', 'rehearsal.html', 'team-learning-lab.html'],
    ['conv', 'rehearsal.html', 'team-learning-lab.html']
  ]) {
    const { store, token } = await codeLogin([perm]);
    assert.ok((await authorizeModel(store, { token, page: own })).ok, perm);
    assert.equal((await authorizeModel(store, { token, page: other })).ok, false, perm);
  }
});

test('changing the administrator password invalidates an older model credential', async () => {
  const store = memoryStore();
  const [, out] = await handleAccess(store, { action: 'login', kind: 'sys', secret: '990211' });
  await store.set('pw-sys', { salt: 'changed', hash: 'changed' });
  assert.equal((await authorizeModel(store, { token: out.token, page: 'demo-lab.html' })).ok, false);
});

test('every page that calls the model has a rule, and the browser sends the sign-in details', () => {
  const guard = readFileSync(new URL('../../app/lib/access-guard.js', import.meta.url), 'utf8');
  const m = guard.match(/var PAGES_BY_PERM = \{([\s\S]*?)\};/)[1];
  const pages = new Set([...m.matchAll(/"([a-z-]+\.html)"/g)].map((x) => x[1]).filter((p) => !/sources|fill|home/.test(p)));
  for (const p of pages) if (!['resilience-advisor-sources.html'].includes(p)) assert.ok(MODEL_PAGES[p], 'MODEL_PAGES lacks ' + p);
  assert.match(guard, /"sbe\.session\.wf"\]/);
});

function browserGuard(host = 'localhost', modelOrigin = 'http://127.0.0.1:8126') {
  const source = readFileSync(new URL('../../app/lib/access-guard.js', import.meta.url), 'utf8');
  const values = new Map([['sbe.session.token', 'synthetic-token'], ['sbe.session.homeUrl', 'home.html'], ['sbe.session.perms', '["writer"]']]);
  const calls = [];
  const storage = { getItem: k => values.get(k) || null, setItem: (k,v) => values.set(k,v), removeItem: k => values.delete(k) };
  const location = { hostname: host, pathname: '/message-writer.html', search: '', href: `http://${host}:8126/message-writer.html`, replace() {} };
  const window = { SBE_AI_ORIGIN: modelOrigin, fetch: async (url, opts) => { calls.push({ url, opts }); return {}; } };
  vm.runInNewContext(source, { window, location, URL, URLSearchParams, Headers, sessionStorage: storage, localStorage: storage,
    document: { documentElement: { classList: { add() {} }, style: {}, appendChild() {} }, createElement: () => ({}), head: { appendChild() {} }, addEventListener() {} },
    HTMLInputElement: class {}, TextDecoder, Uint8Array, Date, setTimeout, clearTimeout });
  return { window, calls, values };
}

test('the actual browser helper adds auth only to designated model service requests', async () => {
  const { window, calls } = browserGuard();
  const opts = { method: 'POST', body: JSON.stringify({ messages: [{ role: 'user', content: 'synthetic' }] }) };
  await window.fetch('http://127.0.0.1:8126/api/complete', opts);
  const sent = JSON.parse(calls[0].opts.body);
  assert.equal(sent._auth.page, 'message-writer.html');
  assert.equal(sent._auth.token, 'synthetic-token');
  assert.equal(new Headers(calls[0].opts.headers).get('authorization'), 'Bearer synthetic-token');
  assert.equal(JSON.parse(opts.body)._auth, undefined, 'caller options stay unchanged');
  for (const url of ['https://third-party.example/api/complete', 'http://127.0.0.1:8126/not-api/complete', 'http://localhost:8126/library.json']) {
    await window.fetch(url, opts);
    const call = calls.at(-1);
    assert.equal(JSON.parse(call.opts.body)._auth, undefined, url);
    assert.equal(new Headers(call.opts.headers).get('authorization'), null, url);
  }
});

test('a public page cannot select an external model service through the development override', async () => {
  const { window, calls } = browserGuard('be-good.co.il', 'https://third-party.example');
  assert.equal(window.sbeAIOrigin(), 'https://sbe-server.onrender.com');
  await window.fetch('https://third-party.example/api/complete', { method: 'POST', body: '{}' });
  assert.equal(JSON.parse(calls[0].opts.body)._auth, undefined);
});

test('the wrapper preserves an explicitly captured credential when the current session changes', async () => {
  const { window, calls, values } = browserGuard();
  const headers = window.sbeAIHeaders();
  values.set('sbe.session.token', 'next-owner-token');
  await window.fetch('http://127.0.0.1:8126/api/complete', { method: 'POST', headers, body: '{}' });
  assert.equal(new Headers(calls[0].opts.headers).get('authorization'), 'Bearer synthetic-token');
  assert.equal(JSON.parse(calls[0].opts.body)._auth.token, 'synthetic-token');
  assert.equal(headers.authorization, 'Bearer synthetic-token');
});
