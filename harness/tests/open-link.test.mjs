// קישור פתוח ליום אחד (11/10/2026): בלי קוד, רק בתאריך שנקבע, רק לכלי אחד.
import test from 'node:test';
import assert from 'node:assert/strict';
import { handleAccess, authorizeModel, ilToday } from '../lib/access.mjs';

function memoryStore(seed = {}) {
  const data = new Map(Object.entries(seed));
  return { data, async get(k) { return data.get(k) || null; }, async set(k, v) { data.set(k, v); }, async del(k) { data.delete(k); },
    async list(prefix, o = {}) { return [...data].filter(([k]) => k.startsWith(prefix)).map(([key, value]) => o.keysOnly ? { key } : { key, value }); },
    async delPrefix(prefix) { for (const k of data.keys()) if (k.startsWith(prefix)) data.delete(k); } };
}
const dayShift = (n) => { const d = new Date(ilToday() + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
async function sys(store) { const [, out] = await handleAccess(store, { action: 'login', kind: 'sys', secret: '990211' }); return out.token; }

test('only the system admin creates, lists and revokes open links', async () => {
  const store = memoryStore();
  for (const action of ['openCreate', 'openList', 'openRevoke'])
    assert.equal((await handleAccess(store, { action, page: 'message-writer.html', date: ilToday(), id: 'x' }))[0], 403);
  const token = await sys(store);
  let [st, out] = await handleAccess(store, { action: 'openCreate', token, page: 'message-writer.html', date: ilToday(), id: 'orit' });
  assert.equal(st, 200); assert.equal(out.item.perm, 'writer');
  assert.equal((await handleAccess(store, { action: 'openCreate', token, page: 'message-writer.html', date: ilToday(), id: 'orit' }))[0], 409);
  assert.equal((await handleAccess(store, { action: 'openCreate', token, page: 'routines-hub.html', date: ilToday() }))[0], 400, 'only tools on the open list');
  assert.equal((await handleAccess(store, { action: 'openCreate', token, page: 'message-writer.html', date: 'tomorrow' }))[0], 400);
  [st, out] = await handleAccess(store, { action: 'openList', token });
  assert.equal(out.items.length, 1);
});

test('the link opens one tool, only on its day, and closes when revoked', async () => {
  const store = memoryStore();
  const token = await sys(store);
  await handleAccess(store, { action: 'openCreate', token, page: 'message-writer.html', date: ilToday(), id: 'today' });
  await handleAccess(store, { action: 'openCreate', token, page: 'message-writer.html', date: dayShift(1), id: 'tomorrow' });
  await handleAccess(store, { action: 'openCreate', token, page: 'message-writer.html', date: dayShift(-1), id: 'yesterday' });

  let [st, out] = await handleAccess(store, { action: 'openJoin', id: 'today' });
  assert.equal(st, 200); assert.equal(out.page, 'message-writer.html'); assert.deepEqual(out.perms, ['writer']);
  const guest = out.token;
  assert.ok((await authorizeModel(store, { token: guest, page: 'message-writer.html' })).ok);
  for (const page of ['facilitation-advisor.html', 'resilience-advisor.html', 'conversation-planner.html'])
    assert.equal((await authorizeModel(store, { token: guest, page })).ok, false, page);

  assert.equal((await handleAccess(store, { action: 'openJoin', id: 'tomorrow' }))[1].error, 'open-early');
  assert.equal((await handleAccess(store, { action: 'openJoin', id: 'yesterday' }))[1].error, 'open-over');
  assert.equal((await handleAccess(store, { action: 'openJoin', id: 'nothing' }))[0], 404);

  // the day passes: the same token stops working
  const rec = await store.get('open:today'); await store.set('open:today', { ...rec, date: dayShift(-1) });
  assert.equal((await authorizeModel(store, { token: guest, page: 'message-writer.html' })).ok, false);
  await store.set('open:today', rec);
  assert.ok((await authorizeModel(store, { token: guest, page: 'message-writer.html' })).ok);
  await handleAccess(store, { action: 'openRevoke', token, id: 'today' });
  assert.equal((await authorizeModel(store, { token: guest, page: 'message-writer.html' })).ok, false);
  assert.equal((await handleAccess(store, { action: 'openJoin', id: 'today' }))[0], 404);
});

test('a full link stops letting people in', async () => {
  const store = memoryStore();
  const token = await sys(store);
  await handleAccess(store, { action: 'openCreate', token, page: 'message-writer.html', date: ilToday(), id: 'small', max: 2 });
  assert.equal((await handleAccess(store, { action: 'openJoin', id: 'small' }))[0], 200);
  assert.equal((await handleAccess(store, { action: 'openJoin', id: 'small' }))[0], 200);
  assert.equal((await handleAccess(store, { action: 'openJoin', id: 'small' }))[1].error, 'open-full');
});

test('a daily link can open any listed tool, or all of them at once', async () => {
  const store = memoryStore();
  const token = await sys(store);
  let [st, out] = await handleAccess(store, { action: 'openCreate', token, page: 'team-thinking.html', date: ilToday(), id: 'team' });
  assert.equal(st, 200); assert.equal(out.item.perm, 'teamthink');
  [st, out] = await handleAccess(store, { action: 'openCreate', token, page: 'home.html', date: ilToday(), id: 'all-day' });
  assert.equal(st, 200);
  [st, out] = await handleAccess(store, { action: 'openJoin', id: 'all-day' });
  assert.equal(out.page, 'home.html'); assert.ok(out.perms.includes('writer') && out.perms.includes('leadership') && out.perms.includes('teamthink'));
  const guest = out.token;
  for (const page of ['message-writer.html', 'leadership-advisor.html', 'shared-dialogue-lab.html', 'academic-review.html'])
    assert.ok((await authorizeModel(store, { token: guest, page })).ok, page);
  for (const page of ['resilience-studio.html', 'journey.html', 'practice.html'])
    assert.equal((await authorizeModel(store, { token: guest, page })).ok, false, page);
  await handleAccess(store, { action: 'openRevoke', token, id: 'all-day' });
  assert.equal((await authorizeModel(store, { token: guest, page: 'message-writer.html' })).ok, false);
});

test('a link can stay open for several days, and its dates can change without changing the link', async () => {
  const store = memoryStore();
  const token = await sys(store);
  let [st, out] = await handleAccess(store, { action: 'openCreate', token, page: 'message-writer.html', date: dayShift(-1), until: dayShift(1), id: 'week' });
  assert.equal(st, 200); assert.equal(out.item.until, dayShift(1));
  [st, out] = await handleAccess(store, { action: 'openJoin', id: 'week' });
  assert.equal(st, 200);
  const guest = out.token;
  assert.ok((await authorizeModel(store, { token: guest, page: 'message-writer.html' })).ok);
  assert.equal((await handleAccess(store, { action: 'openCreate', token, page: 'message-writer.html', date: ilToday(), until: dayShift(-2), id: 'bad' }))[1].error, 'bad until');
  assert.equal((await handleAccess(store, { action: 'openCreate', token, page: 'message-writer.html', date: ilToday(), until: dayShift(40), id: 'long' }))[1].error, 'bad until');
  // a link set for yesterday (the mistake behind "the QR did not work") is fixed by moving its date
  await handleAccess(store, { action: 'openCreate', token, page: 'message-writer.html', date: dayShift(-1), id: 'orit-14' });
  assert.equal((await handleAccess(store, { action: 'openJoin', id: 'orit-14' }))[1].error, 'open-over');
  assert.equal((await handleAccess(store, { action: 'openUpdate', id: 'orit-14', date: ilToday() }))[0], 403, 'only the system admin');
  [st] = await handleAccess(store, { action: 'openUpdate', token, id: 'orit-14', date: ilToday() });
  assert.equal(st, 200);
  assert.equal((await handleAccess(store, { action: 'openJoin', id: 'orit-14' }))[0], 200);
});
