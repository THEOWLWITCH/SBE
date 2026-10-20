// קישור מתנה קצר ל"יש מה לעשות" (20/10/2026): נשמר ב-Netlify (netlify/functions/gift.mjs), לא בשרת ב-Render.
// יצירה עם מגבלה יומית, קריאה לכולם, ומחיקה רק עם המפתח.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { handle } from '../../netlify/functions/gift.mjs';

function memoryStore() {
  const data = new Map();
  return { data, async get(k) { return data.has(k) ? structuredClone(data.get(k)) : null; }, async set(k, v) { data.set(k, structuredClone(v)); }, async delete(k) { data.delete(k); } };
}
const post = (body) => new Request('https://be-good.co.il/api/gift', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const get = (id) => new Request('https://be-good.co.il/api/gift?id=' + encodeURIComponent(id));

test('short gift links: create, read by anyone, delete only with the key', async () => {
  const store = memoryStore();
  const gifts = [{ to: ' נועה ', from: 'ד״ר יעל שדה', msg: 'שיהיה לך בטלפון.\nתודה.', lang: 'ar' }, { to: 'צוות שכבה ז׳' }];
  const r = await handle(post({ action: 'create', gifts }), store, '1.2.3.4');
  assert.equal(r.status, 200);
  const out = await r.json();
  assert.equal(out.gifts.length, 2);
  for (const g of out.gifts) { assert.match(g.id, /^[A-Za-z0-9]{7}$/); assert.ok(g.key); }
  const got = await (await handle(get(out.gifts[0].id), store)).json();
  assert.deepEqual(got.gift, { to: 'נועה', from: 'ד״ר יעל שדה', msg: 'שיהיה לך בטלפון.\nתודה.', lang: 'ar' });
  assert.equal((await handle(get('nope!!'), store)).status, 404);
  assert.equal((await handle(post({ action: 'delete', id: out.gifts[0].id, key: 'wrong' }), store)).status, 404);
  assert.equal((await handle(post({ action: 'delete', id: out.gifts[0].id, key: out.gifts[0].key }), store)).status, 200);
  assert.equal((await handle(get(out.gifts[0].id), store)).status, 404);
});

test('a daily limit per address, and texts are clipped', async () => {
  const store = memoryStore();
  const many = Array.from({ length: 60 }, (_, i) => ({ to: 'x' + i, msg: 'מ'.repeat(900) }));
  assert.equal((await handle(post({ action: 'create', gifts: many }), store, '9.9.9.9')).status, 200);
  assert.equal((await handle(post({ action: 'create', gifts: many }), store, '9.9.9.9')).status, 200);
  assert.equal((await handle(post({ action: 'create', gifts: many }), store, '9.9.9.9')).status, 429);
  assert.equal((await handle(post({ action: 'create', gifts: many.slice(0, 1) }), store, '8.8.8.8')).status, 200);
  const rec = [...store.data.entries()].find(([k]) => k.startsWith('gift:'))[1];
  assert.equal(rec.msg.length, 400);
});

test('the short address /g/<code> leads to the guide, which reads the code from the site', () => {
  const toml = readFileSync(new URL('../../netlify.toml', import.meta.url), 'utf8');
  assert.match(toml, /from = "\/g\/:id"\s+to = "\/yesh-ma-laasot\.html\?g=:id"/);
  assert.match(readFileSync(new URL('../../app/yesh-ma-laasot.html', import.meta.url), 'utf8'), /be-good\.co\.il\/api\/gift\?id=/);
  const lib = readFileSync(new URL('../../app/lib/gift-link.js', import.meta.url), 'utf8');
  assert.match(lib, /be-good\.co\.il\/g\//); assert.match(lib, /be-good\.co\.il\/api\/gift/);
  assert.match(readFileSync(new URL('../../netlify/functions/gift.mjs', import.meta.url), 'utf8'), /path: '\/api\/gift'/);
  assert.match(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'), /@netlify\/blobs/);
});
