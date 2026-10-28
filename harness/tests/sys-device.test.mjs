import { seedOwnerPassword, SYNTHETIC_OWNER_PASSWORD } from './synthetic-access.mjs';
// מכשיר מוכר למנהלת המערכת (28/10/2026): כניסה בלי סיסמה במכשיר שנשמר, עד 90 יום.
import test from 'node:test';
import assert from 'node:assert/strict';
import { handleAccess, verifyToken } from '../lib/access.mjs';

function memoryStore(seed = {}) {
  const data = new Map(Object.entries(seed));
  return { data, async get(k) { return data.get(k) || null; }, async set(k, v) { data.set(k, v); }, async del(k) { data.delete(k); },
    async list(prefix, o = {}) { return [...data].filter(([k]) => k.startsWith(prefix)).map(([key, value]) => o.keysOnly ? { key } : { key, value }); },
    async delPrefix(prefix) { for (const k of data.keys()) if (k.startsWith(prefix)) data.delete(k); } };
}
async function sys(store) { await seedOwnerPassword(store); const [, out] = await handleAccess(store, { action: 'login', kind: 'sys', secret: SYNTHETIC_OWNER_PASSWORD }); return out.token; }

test('only a system admin session can remember a device', async () => {
  const store = memoryStore();
  assert.equal((await handleAccess(store, { action: 'sysRemember' }))[0], 403);
  const token = await sys(store);
  const [st, out] = await handleAccess(store, { action: 'sysRemember', token });
  assert.equal(st, 200); assert.match(out.key, /^[a-f0-9]{64}$/);
  assert.ok(![...store.data.keys()].some((k) => k.includes(out.key)), 'the server keeps only a hash');
});

test('a remembered device logs in without the password, and forgetting it ends that', async () => {
  const store = memoryStore();
  const token = await sys(store);
  const [, { key }] = await handleAccess(store, { action: 'sysRemember', token });
  let [st, out] = await handleAccess(store, { action: 'sysDevice', key });
  assert.equal(st, 200);
  assert.equal((await verifyToken(store, out.token)).k, 'sys');
  assert.equal((await handleAccess(store, { action: 'sysDevice', key: 'a'.repeat(64) }))[0], 403);
  assert.equal((await handleAccess(store, { action: 'sysDevice', key: 'nothex' }))[0], 403);
  await handleAccess(store, { action: 'sysForget', key });
  assert.equal((await handleAccess(store, { action: 'sysDevice', key }))[0], 403);
});

test('an expired device or a changed password stops the device login', async () => {
  const store = memoryStore();
  const token = await sys(store);
  const [, { key }] = await handleAccess(store, { action: 'sysRemember', token });
  const [, { key: key2 }] = await handleAccess(store, { action: 'sysRemember', token });
  const rk = [...store.data.keys()].find((k) => k.startsWith('sysdev:'));
  store.data.set(rk, { ...store.data.get(rk), exp: new Date(Date.now() - 1000).toISOString() });
  const rec = store.data.get('pw-sys');
  store.data.set('pw-sys', { ...rec, hash: rec.hash + 'x' });
  assert.equal((await handleAccess(store, { action: 'sysDevice', key }))[0], 403);
  assert.equal((await handleAccess(store, { action: 'sysDevice', key: key2 }))[0], 403);
});
