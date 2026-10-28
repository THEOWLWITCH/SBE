// קישור מתנה קצר ל"יש מה לעשות" (20/10/2026: "ההודעה לא נראית טוב כי רואים את כל הכתובת הארוכה").
// נשמר ב-Netlify Blobs, בלי השרת ב-Render (בחרה: "בלי השרת, דרך האתר").
// POST {action:'create', gifts:[{to,from,msg,lang}]} → {gifts:[{id,key}]}
// GET ?id=<קוד> → {gift:{to,from,msg,lang}}
// POST {action:'delete', id, key} → {ok:true}
// כל אחד/ת יכול/ה ליצור (כמו הקישור הארוך, שגם בו הטקסט בקישור), עם מגבלת אורך ומגבלה יומית לכל כתובת.
import { randomBytes } from 'node:crypto';

const ABC = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const DAILY = 120;
const newId = () => Array.from(randomBytes(7), (b) => ABC[b % ABC.length]).join('');
const line = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const text = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ').trim().slice(0, n);
const okId = (id) => /^[A-Za-z0-9]{5,16}$/.test(String(id || ''));
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type' };
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...CORS } });
const same = (a, b) => { a = String(a); b = String(b); if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };

// store: { get(key) → object|null, set(key, object) } ; ip: לכתובת השולחת, למגבלה היומית
export async function handle(req, store, ip = '') {
  if (req.method === 'OPTIONS') return json(204, {});
  if (req.method === 'GET') {
    const id = new URL(req.url).searchParams.get('id');
    const rec = okId(id) ? await store.get('gift:' + id) : null;
    if (!rec) return json(404, { error: 'not found' });
    return json(200, { gift: { to: rec.to, from: rec.from, msg: rec.msg, lang: rec.lang } });
  }
  if (req.method !== 'POST') return json(405, { error: 'method' });
  let body;
  try { body = await req.json(); } catch (e) { return json(400, { error: 'invalid JSON' }); }
  if (body && body.action === 'create') {
    const list = (Array.isArray(body.gifts) ? body.gifts : []).slice(0, 60);
    if (!list.length) return json(400, { error: 'empty' });
    const day = new Date().toISOString().slice(0, 10), rk = 'rl:' + day + ':' + String(ip).slice(0, 64);
    const used = Number(((await store.get(rk)) || {}).n) || 0;
    if (used + list.length > DAILY) return json(429, { error: 'too many' });
    await store.set(rk, { n: used + list.length });
    const out = [];
    for (const g of list) {
      let id = newId();
      while (await store.get('gift:' + id)) id = newId();
      const key = randomBytes(10).toString('hex');
      await store.set('gift:' + id, { id, key, at: new Date().toISOString(), to: line(g && g.to, 60), from: line(g && g.from, 60), msg: text(g && g.msg, 400), lang: g && g.lang === 'ar' ? 'ar' : 'he' });
      out.push({ id, key });
    }
    return json(200, { gifts: out });
  }
  if (body && body.action === 'delete') {
    const rec = okId(body.id) ? await store.get('gift:' + body.id) : null;
    if (!rec || !body.key || !same(body.key, rec.key)) return json(404, { error: 'not found' });
    await store.delete('gift:' + body.id);
    return json(200, { ok: true });
  }
  return json(400, { error: 'bad action' });
}

export default async (req, context) => {
  const { getStore } = await import('@netlify/blobs');
  const blobs = getStore({ name: 'gifts', consistency: 'strong' });
  const store = {
    get: (k) => blobs.get(k, { type: 'json' }),
    set: (k, v) => blobs.setJSON(k, v),
    delete: (k) => blobs.delete(k),
  };
  return handle(req, store, (context && context.ip) || req.headers.get('x-nf-client-connection-ip') || '');
};

export const config = { path: '/api/gift' };
