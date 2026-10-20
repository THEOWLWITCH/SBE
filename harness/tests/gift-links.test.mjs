// קישור מתנה קצר ל"יש מה לעשות" (20/10/2026): נוצר רק למי שנכנס/ה, נקרא בלי כניסה, ונמחק רק עם המפתח.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { handleAccess } from '../lib/access.mjs';
import { seedOwnerPassword, SYNTHETIC_OWNER_PASSWORD } from './synthetic-access.mjs';

function memoryStore() {
  const data = new Map();
  return { data, async get(k) { return data.get(k) || null; }, async set(k, v) { data.set(k, v); }, async del(k) { data.delete(k); },
    async list(prefix, o = {}) { return [...data].filter(([k]) => k.startsWith(prefix)).map(([key, value]) => o.keysOnly ? { key } : { key, value }); },
    async delPrefix(prefix) { for (const k of data.keys()) if (k.startsWith(prefix)) data.delete(k); } };
}

test('short gift links: created only after sign-in, read by anyone, deleted only with the key', async () => {
  const store = memoryStore();
  await seedOwnerPassword(store);
  const [, sys] = await handleAccess(store, { action: 'login', kind: 'sys', secret: SYNTHETIC_OWNER_PASSWORD });
  const gifts = [{ to: ' נועה ', from: 'ד״ר יעל שדה', msg: 'שיהיה לך בטלפון.\nתודה.', lang: 'ar' }, { to: 'צוות שכבה ז׳' }];
  assert.equal((await handleAccess(store, { action: 'giftCreate', gifts }))[0], 403);
  const [st, out] = await handleAccess(store, { action: 'giftCreate', token: sys.token, gifts });
  assert.equal(st, 200); assert.equal(out.gifts.length, 2);
  for (const g of out.gifts) { assert.match(g.id, /^[A-Za-z0-9]{7}$/); assert.ok(g.key); }
  const [gs, got] = await handleAccess(store, { action: 'giftGet', id: out.gifts[0].id });
  assert.equal(gs, 200);
  assert.deepEqual(got.gift, { to: 'נועה', from: 'ד״ר יעל שדה', msg: 'שיהיה לך בטלפון.\nתודה.', lang: 'ar' });
  assert.equal(got.gift.key, undefined);
  assert.equal((await handleAccess(store, { action: 'giftGet', id: 'nope!!' }))[0], 404);
  assert.equal((await handleAccess(store, { action: 'giftDelete', id: out.gifts[0].id, key: 'wrong' }))[0], 404);
  assert.equal((await handleAccess(store, { action: 'giftDelete', id: out.gifts[0].id, key: out.gifts[0].key }))[0], 200);
  assert.equal((await handleAccess(store, { action: 'giftGet', id: out.gifts[0].id }))[0], 404);
});

test('the short address /g/<code> leads to the guide, which reads the code', () => {
  const toml = readFileSync(new URL('../../netlify.toml', import.meta.url), 'utf8');
  assert.match(toml, /from = "\/g\/:id"\s+to = "\/yesh-ma-laasot\.html\?g=:id"/);
  const page = readFileSync(new URL('../../app/yesh-ma-laasot.html', import.meta.url), 'utf8');
  assert.match(page, /action:"giftGet"/);
  assert.match(readFileSync(new URL('../../app/lib/gift-link.js', import.meta.url), 'utf8'), /be-good\.co\.il\/g\//);
  for (const f of ['home.html', 'admin.html']) assert.match(readFileSync(new URL('../../app/' + f, import.meta.url), 'utf8'), /giftCreate/, f);
});
