// האתר האישי של ד״ר יעל שדה: אתר נפרד מ-Begood, עם דומיין משלו ב-Netlify (31/10/2026: "אני אחליף דומיין ואעלה אותו דרך נטליפיי").
//  (31/10/2026: "הקמת אתר אישי עבורי... הוסף לי חלק ניהול שאוכל להעלות חומרים חדשים לכל דף ודף, לערוך ולהסיר").
// התוכן והקבצים נשמרים ב-Netlify Blobs (כמו קישור המתנה), בלי השרת ב-Render.
//
// GET  /api/site                         → {site}  (site=null כשעוד לא נשמר: הדף מציג את תוכן הפתיחה)
// GET  /api/file?id=<מזהה>                → הקובץ
// POST /api/site {action:'login', password, remember}   → {token, exp}
//                      {action:'check'|'logout', token}
//                      {action:'save', token, site, base}       → {ok, updatedAt}   (base: updatedAt שממנו התחילה העריכה)
//                      {action:'upload', token, name, data}     → {file:{id,name,type,size,url}}  (data ב-base64, עד 4 מגה)
//                      {action:'files', token}                  → {files:[...]}
//                      {action:'deleteFile', token, id}         → {ok}
// הסיסמה: משתנה הסביבה YAEL_SITE_PASSWORD ב-Netlify. בלעדיו אי אפשר להיכנס לניהול.
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';

const MAX_FILE = 4 * 1024 * 1024;          // מגבלת גוף הבקשה בפונקציה היא 6 מגה, ו-base64 מגדיל בשליש
const MAX_SITE = 900 * 1024;
const LOGIN_TRIES = 8;                     // לשעה, לכל כתובת
const DAY = 864e5;

// רק סוגי קבצים שלא יכולים להריץ קוד באתר (בלי HTML ו-SVG). הסוג נקבע לפי הסיומת, לא לפי מה שהדפדפן שלח.
export const TYPES = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  mp3: 'audio/mpeg', m4a: 'audio/mp4', mp4: 'video/mp4', txt: 'text/plain; charset=utf-8', zip: 'application/zip',
};
const INLINE = /^(application\/pdf|image\/|audio\/|video\/)/;
const ITEM_TYPES = ['text', 'file', 'link', 'image', 'video'];

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type' };
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...CORS } });
const sha = (s) => createHash('sha256').update(String(s)).digest('hex');
const same = (a, b) => { const x = Buffer.from(sha(a)), y = Buffer.from(sha(b)); return timingSafeEqual(x, y); };
const line = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const text = (v, n) => String(v == null ? '' : v).replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ').trim().slice(0, n);
const okId = (id) => /^[A-Za-z0-9_-]{3,40}$/.test(String(id || ''));
const newId = () => randomBytes(9).toString('base64url');
const extOf = (name) => (String(name || '').toLowerCase().match(/\.([a-z0-9]{1,5})$/) || [])[1] || '';
const fileUrl = (id) => '/api/file?id=' + id;

// קישור: רק http(s), mailto, tel, עוגן בדף או קובץ מהאתר. כל השאר נמחק.
export function safeUrl(u) {
  u = line(u, 600);
  if (!u) return '';
  if (/^(https?:\/\/|mailto:|tel:)/i.test(u)) return u;
  if (/^#[\w-]{1,40}$/.test(u)) return u;
  if (/^\/(?!\/)[\w\-./?=&%#]*$/.test(u)) return u;
  return '';
}

function cleanFile(f) {
  if (!f || !okId(f.id)) return null;
  return { id: f.id, name: line(f.name, 140), type: line(f.type, 120), size: Math.max(0, Number(f.size) || 0) };
}

// מנקה את כל מבנה האתר: רק השדות המוכרים, באורך מוגבל.
export function cleanSite(s) {
  s = s && typeof s === 'object' ? s : {};
  const b = s.brand && typeof s.brand === 'object' ? s.brand : {};
  const brand = {
    name: line(b.name, 80), title: line(b.title, 160), tagline: line(b.tagline, 240),
    email: line(b.email, 120), phone: line(b.phone, 40), photo: cleanFile(b.photo), footer: line(b.footer, 240),
  };
  const seen = new Set();
  const pages = (Array.isArray(s.pages) ? s.pages : []).slice(0, 30).map((p) => {
    p = p && typeof p === 'object' ? p : {};
    let id = okId(p.id) ? p.id : newId();
    while (seen.has(id)) id = newId();
    seen.add(id);
    const items = (Array.isArray(p.items) ? p.items : []).slice(0, 200).map((it) => {
      it = it && typeof it === 'object' ? it : {};
      return {
        id: okId(it.id) ? it.id : newId(),
        type: ITEM_TYPES.includes(it.type) ? it.type : 'text',
        title: line(it.title, 200), body: text(it.body, 20000), url: safeUrl(it.url), label: line(it.label, 80),
        date: line(it.date, 40), file: cleanFile(it.file), hidden: !!it.hidden,
      };
    });
    return { id, title: line(p.title, 120) || 'דף', nav: line(p.nav, 40), intro: text(p.intro, 6000), hidden: !!p.hidden, home: !!p.home, items };
  });
  if (pages.length && !pages.some((p) => p.home)) pages[0].home = true;
  let homeSeen = false;
  for (const p of pages) { if (p.home) { if (homeSeen) p.home = false; else { homeSeen = true; p.hidden = false; } } }
  return { brand, pages };
}

const fileIds = (site) => {
  const out = new Set();
  if (site && site.brand && site.brand.photo) out.add(site.brand.photo.id);
  for (const p of (site && site.pages) || []) for (const it of p.items || []) if (it.file) out.add(it.file.id);
  return out;
};

async function session(store, token) {
  if (!token || typeof token !== 'string' || token.length > 100) return null;
  const s = await store.get('sess:' + sha(token));
  if (!s || !(s.exp > Date.now())) return null;
  return s;
}

// store: { get, set, delete, getBin, setBin } ; env: { password } ; ip: למגבלת הניסיונות
export async function handle(req, store, env = {}, ip = '') {
  if (req.method === 'OPTIONS') return json(204, {});
  const url = new URL(req.url);

  if (req.method === 'GET' && /\/file$/.test(url.pathname)) {
    const id = url.searchParams.get('id');
    const meta = okId(id) ? await store.get('file:' + id) : null;
    const bin = meta ? await store.getBin('bin:' + id) : null;
    if (!meta || !bin) return new Response('not found', { status: 404, headers: CORS });
    const type = meta.type || 'application/octet-stream';
    const disp = (INLINE.test(type) ? 'inline' : 'attachment') + "; filename*=UTF-8''" + encodeURIComponent(meta.name || 'file');
    return new Response(bin, { status: 200, headers: { 'content-type': type, 'content-disposition': disp, 'cache-control': 'public, max-age=3600', 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox", ...CORS } });
  }

  if (req.method === 'GET') {
    const site = await store.get('site');
    return json(200, { site: site || null });
  }
  if (req.method !== 'POST') return json(405, { error: 'method' });

  let body;
  try { body = await req.json(); } catch (e) { return json(400, { error: 'invalid JSON' }); }
  body = body && typeof body === 'object' ? body : {};
  const pass = String(env.password || '');

  if (body.action === 'login') {
    if (pass.length < 6) return json(503, { error: 'no password', message: 'הניהול עוד לא הוגדר: חסרה סיסמה ב-Netlify (YAEL_SITE_PASSWORD).' });
    const rk = 'rl:' + new Date().toISOString().slice(0, 13) + ':' + String(ip).slice(0, 64);
    const used = Number(((await store.get(rk)) || {}).n) || 0;
    if (used >= LOGIN_TRIES) return json(429, { error: 'too many', message: 'היו הרבה ניסיונות. אפשר לנסות שוב בעוד שעה.' });
    if (!same(String(body.password || ''), pass)) {
      await store.set(rk, { n: used + 1 });
      return json(401, { error: 'wrong', message: 'הסיסמה לא נכונה.' });
    }
    const token = randomBytes(24).toString('base64url');
    const exp = Date.now() + (body.remember ? 90 : 1) * DAY;
    await store.set('sess:' + sha(token), { exp, at: Date.now(), p: sha(pass) });
    return json(200, { token, exp });
  }

  const s = await session(store, body.token);
  // החלפת הסיסמה ב-Netlify מבטלת את כל הכניסות הקודמות
  if (!s || s.p !== sha(pass) || pass.length < 6) return json(401, { error: 'login', message: 'כדי להמשיך, נכנסים שוב לניהול.' });

  if (body.action === 'check') return json(200, { ok: true, exp: s.exp });
  if (body.action === 'logout') { await store.delete('sess:' + sha(body.token)); return json(200, { ok: true }); }

  if (body.action === 'save') {
    const old = await store.get('site');
    if (old && body.base && old.updatedAt && body.base !== old.updatedAt) return json(409, { error: 'conflict', message: 'האתר נשמר בינתיים ממכשיר אחר. אפשר לרענן את הדף ולהמשיך מהגרסה השמורה.' });
    const site = cleanSite(body.site);
    site.updatedAt = new Date().toISOString();
    if (JSON.stringify(site).length > MAX_SITE) return json(413, { error: 'too big', message: 'התוכן ארוך מדי לשמירה אחת.' });
    await store.set('site', site);
    // קבצים שהוסרו מהאתר נמחקים
    const keep = fileIds(site);
    for (const id of fileIds(old)) if (!keep.has(id)) { await store.delete('file:' + id); await store.delete('bin:' + id); }
    return json(200, { ok: true, updatedAt: site.updatedAt });
  }

  if (body.action === 'upload') {
    const ext = extOf(body.name);
    const type = TYPES[ext];
    if (!type) return json(415, { error: 'type', message: 'סוג הקובץ לא נתמך. אפשר להעלות PDF, תמונה, Word, PowerPoint, Excel, שמע או סרטון קצר.' });
    const b64 = String(body.data || '').replace(/^data:[^,]*,/, '');
    if (!/^[A-Za-z0-9+/=\s]*$/.test(b64)) return json(400, { error: 'data' });
    const buf = Buffer.from(b64, 'base64');
    if (!buf.length) return json(400, { error: 'empty' });
    if (buf.length > MAX_FILE) return json(413, { error: 'too big', message: 'הקובץ גדול מ-4 מגה. קובץ גדול יותר: מעלים ל-Google Drive או ל-YouTube ומוסיפים כקישור.' });
    const id = newId();
    const meta = { id, name: line(body.name, 140), type, size: buf.length, at: new Date().toISOString() };
    await store.setBin('bin:' + id, buf);
    await store.set('file:' + id, meta);
    return json(200, { file: { id, name: meta.name, type, size: buf.length, url: fileUrl(id) } });
  }

  if (body.action === 'deleteFile') {
    if (!okId(body.id)) return json(400, { error: 'id' });
    const site = await store.get('site');
    if (fileIds(site).has(body.id)) return json(409, { error: 'in use', message: 'הקובץ עדיין מופיע באתר.' });
    await store.delete('file:' + body.id); await store.delete('bin:' + body.id);
    return json(200, { ok: true });
  }

  return json(400, { error: 'bad action' });
}

export default async (req, context) => {
  const { getStore } = await import('@netlify/blobs');
  const blobs = getStore({ name: 'site', consistency: 'strong' });
  const store = {
    get: (k) => blobs.get(k, { type: 'json' }),
    set: (k, v) => blobs.setJSON(k, v),
    delete: (k) => blobs.delete(k),
    getBin: (k) => blobs.get(k, { type: 'arrayBuffer' }),
    setBin: (k, v) => blobs.set(k, v),
  };
  const env = { password: (globalThis.Netlify && Netlify.env.get('YAEL_SITE_PASSWORD')) || process.env.YAEL_SITE_PASSWORD || '' };
  return handle(req, store, env, (context && context.ip) || req.headers.get('x-nf-client-connection-ip') || '');
};

export const config = { path: ['/api/site', '/api/file'] };
