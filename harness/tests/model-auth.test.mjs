// מי יכול/ה לפנות למודל (10/10/2026): רק מי שנכנס/ה, ורק לכלי שפתוח לו או לה. מנהלת המערכת: הכול.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

test('workshop participants use only the workshop tools, and only while the workshop is fresh', async () => {
  const store = memoryStore({ 'wf:abcdefgh12': { w: 'abcdefgh12', created: new Date().toISOString() },
    'wf:oldworkshop1': { w: 'oldworkshop1', created: new Date(Date.now() - 72 * 3600e3).toISOString() } });
  assert.ok((await authorizeModel(store, { w: 'abcdefgh12', page: 'practice.html' })).ok);
  assert.equal((await authorizeModel(store, { w: 'abcdefgh12', page: 'facilitation-advisor.html' })).ok, false);
  assert.equal((await authorizeModel(store, { w: 'oldworkshop1', page: 'practice.html' })).ok, false);
  assert.equal((await authorizeModel(store, { w: 'nosuchworkshop', page: 'practice.html' })).ok, false);
  for (const p of WORKSHOP_MODEL_PAGES) assert.ok(MODEL_PAGES[p], p);
});

test('every page that calls the model has a rule, and the browser sends the sign-in details', () => {
  const guard = readFileSync(new URL('../../app/lib/access-guard.js', import.meta.url), 'utf8');
  const m = guard.match(/var PAGES_BY_PERM = \{([\s\S]*?)\};/)[1];
  const pages = new Set([...m.matchAll(/"([a-z-]+\.html)"/g)].map((x) => x[1]).filter((p) => !/sources|fill|home/.test(p)));
  for (const p of pages) if (!['resilience-advisor-sources.html'].includes(p)) assert.ok(MODEL_PAGES[p], 'MODEL_PAGES lacks ' + p);
  assert.match(guard, /_auth = \{ token: ss\("sbe\.session\.token"\)/);
  assert.match(guard, /"sbe\.session\.wf"\]/);
});
