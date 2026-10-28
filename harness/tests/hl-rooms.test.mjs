// מעבדת האופק: שיתוף בין מכשירים (28/10/2026). חדר נפתח רק עם הרשאת horizon; משתתפים בקישור כותבים רק בתוך החדר,
// לא נוגעים בהגדרות, מוחקים רק מה שהוסיפו; הסקר שואל רק על הגרסה; החדר נסגר בידי מי שפתח/ה אותו או פג אחרי 30 יום.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { handleAccess, authorizeModel } from '../lib/access.mjs';
import { _resetHlCaches } from '../lib/hl-rooms.mjs';

function memoryStore(seed = {}) {
  const data = new Map(Object.entries(seed));
  return { data, async get(k) { return data.has(k) ? structuredClone(data.get(k)) : null; }, async set(k, v) { data.set(k, structuredClone(v)); }, async del(k) { data.delete(k); },
    async list(prefix, o = {}) { return [...data].filter(([k]) => k.startsWith(prefix)).map(([key, value]) => o.keysOnly ? { key } : { key, value: structuredClone(value) }); },
    async delPrefix(prefix) { for (const k of [...data.keys()]) if (k.startsWith(prefix)) data.delete(k); } };
}
async function login(perms) {
  _resetHlCaches();
  const store = memoryStore({ institutions: [{ name: 'Inst', code: '123456', active: true }],
    'modules:Inst': Object.fromEntries(perms.map((p) => [p, true])),
    'code:TEST1234': { code: 'TEST-1234', kind: 'staff', inst: 'Inst', perms, revoked: false } });
  const [status, out] = await handleAccess(store, { action: 'login', kind: 'code', secret: 'TEST-1234' });
  assert.equal(status, 200);
  return { store, token: out.token };
}
const call = (store, body) => handleAccess(store, body);

test('only someone with the Horizon Lab opens a shared room, and only for the three group tools', async () => {
  const other = await login(['writer']);
  assert.equal((await call(other.store, { action: 'hlRoomCreate', token: other.token, page: 'hl-collage.html' }))[0], 403);
  assert.equal((await call(other.store, { action: 'hlRoomCreate', page: 'hl-collage.html' }))[0], 403);
  const { store, token } = await login(['horizon']);
  assert.equal((await call(store, { action: 'hlRoomCreate', token, page: 'hl-radar.html' }))[0], 400);
  const [s, r] = await call(store, { action: 'hlRoomCreate', token, page: 'hl-collage.html' });
  assert.equal(s, 200); assert.match(r.room, /^[a-f0-9]{24}$/); assert.ok(r.key.length > 20);
  assert.ok(Date.parse(r.exp) - Date.now() > 29 * 86400000);
  assert.ok(!JSON.stringify(store.data.get('hlr:' + r.room)).includes(r.key), 'only a hash of the owner key is stored');
});

test('guests write in the room, see each other, and the poll returns only what changed', async () => {
  const { store, token } = await login(['horizon']);
  const [, r] = await call(store, { action: 'hlRoomCreate', token, page: 'hl-collage.html' });
  let [s, w] = await call(store, { action: 'hlWrite', room: r.room, key: r.key, ops: [{ p: 'collages/c1', d: { title: 'T' } }, { p: 'config/active', d: { cid: 'c1' } }] });
  assert.equal(s, 200); assert.equal(w.ver, 1);
  const [, p0] = await call(store, { action: 'hlPoll', room: r.room, since: -1 });
  assert.equal(p0.full, true); assert.equal(p0.docs.length, 2); assert.equal(p0.owner, false);
  [s] = await call(store, { action: 'hlWrite', room: r.room, g: 'guestaaa1', ops: [{ p: 'collages/c1/items/i1', d: { text: 'אמון' } }] });
  assert.equal(s, 200);
  const [, same] = await call(store, { action: 'hlPoll', room: r.room, since: 2 });
  assert.deepEqual(same, { ver: 2 }, 'nothing new: only the version comes back');
  const [, delta] = await call(store, { action: 'hlPoll', room: r.room, since: 1 });
  assert.deepEqual(delta.docs.map((d) => d.p), ['collages/c1/items/i1']);
});

test('guests cannot change the settings or delete what others added; the owner can', async () => {
  const { store, token } = await login(['horizon']);
  const [, r] = await call(store, { action: 'hlRoomCreate', token, page: 'hl-voice.html' });
  assert.equal((await call(store, { action: 'hlWrite', room: r.room, g: 'guestaaa1', ops: [{ p: 'config/active', d: { pid: 'x' } }] }))[0], 403);
  await call(store, { action: 'hlWrite', room: r.room, g: 'guestaaa1', ops: [{ p: 'processes/p/ratings/a', d: { v: 1 } }] });
  assert.equal((await call(store, { action: 'hlWrite', room: r.room, g: 'guestbbb2', ops: [{ p: 'processes/p/ratings/a', d: null }] }))[0], 403);
  assert.equal((await call(store, { action: 'hlWrite', room: r.room, g: 'guestaaa1', ops: [{ p: 'processes/p/ratings/a', d: null }] }))[0], 200);
  await call(store, { action: 'hlWrite', room: r.room, g: 'guestbbb2', ops: [{ p: 'processes/p/ratings/b', d: { v: 2 } }] });
  assert.equal((await call(store, { action: 'hlWrite', room: r.room, key: r.key, ops: [{ p: 'processes/p/ratings/b', d: null }] }))[0], 200);
  for (const p of ['../x', 'a', 'a/b/c', 'a/b c']) assert.equal((await call(store, { action: 'hlWrite', room: r.room, key: r.key, ops: [{ p, d: {} }] }))[0], 400, p);
  assert.equal((await call(store, { action: 'hlWrite', room: r.room, key: r.key, ops: [{ p: 'a/b', d: { big: 'x'.repeat(1_600_000) } }] }))[0], 413);
});

test('guests reach the model only inside an open room, on its own page', async () => {
  const { store, token } = await login(['horizon']);
  const [, r] = await call(store, { action: 'hlRoomCreate', token, page: 'hl-voice.html' });
  assert.ok((await authorizeModel(store, { room: r.room, g: 'guestaaa1', page: 'hl-voice.html' })).ok);
  assert.equal((await authorizeModel(store, { room: r.room, g: 'guestaaa1', page: 'hl-collage.html' })).ok, false);
  assert.equal((await authorizeModel(store, { room: r.room, page: 'message-writer.html' })).ok, false);
  assert.equal((await authorizeModel(store, { room: 'a'.repeat(24), page: 'hl-voice.html' })).ok, false);
  assert.equal((await call(store, { action: 'hlRoomClose', room: r.room, key: 'wrong' }))[0], 403);
  assert.equal((await call(store, { action: 'hlRoomClose', room: r.room, key: r.key }))[0], 200);
  _resetHlCaches();
  assert.equal((await authorizeModel(store, { room: r.room, page: 'hl-voice.html' })).ok, false);
  assert.equal((await call(store, { action: 'hlPoll', room: r.room, since: -1 }))[0], 404);
  assert.equal([...store.data.keys()].filter((k) => k.includes(r.room)).length, 0, 'closing deletes everything');
});

test('expired rooms are refused and cleaned up when a new room opens', async () => {
  const { store, token } = await login(['horizon']);
  const [, r] = await call(store, { action: 'hlRoomCreate', token, page: 'hl-futures.html' });
  await call(store, { action: 'hlWrite', room: r.room, key: r.key, ops: [{ p: 'workshops/w', d: { a: 1 } }] });
  const rec = store.data.get('hlr:' + r.room); rec.exp = new Date(Date.now() - 1000).toISOString();
  _resetHlCaches();
  assert.equal((await call(store, { action: 'hlPoll', room: r.room, since: -1 }))[0], 404);
  await call(store, { action: 'hlRoomCreate', token, page: 'hl-futures.html' });
  assert.equal([...store.data.keys()].filter((k) => k.includes(r.room)).length, 0);
});

test('the guard opens only the three group pages with a room link, and the runtime knows them', () => {
  const guard = readFileSync(new URL('../../app/lib/access-guard.js', import.meta.url), 'utf8');
  assert.match(guard, /hl-\(voice\|futures\|collage\)\\\.html/);
  const rt = readFileSync(new URL('../../app/lib/hl-runtime.js', import.meta.url), 'utf8');
  for (const p of ['hl-voice.html', 'hl-futures.html', 'hl-collage.html']) assert.ok(rt.includes(`"${p}"`), p);
  assert.ok(!/צריך|חייב|חובה/.test(rt.replace(/\/\/.*$/gm, '')), 'invitation language in the share panel');
});
