// כניסות מוגנות: סיסמאות הניהול וקוד "משוב לעבודות" נבדקים כאן, בשרת,
// ולא בקוד הדף — כך שאי אפשר לקרוא אותם ב"הצגת מקור".
// סיסמאות נשמרות כ-hash (scrypt + salt). הקוד למשוב לעבודות נשמר כפי שהוא,
// כי מנהלת המערכת צריכה לראות אותו כדי למסור אותו.
// store: { get(key) → value|null, set(key, value), del(key), list(prefix), delPrefix(prefix) }.
import { scryptSync, randomBytes, timingSafeEqual, createHmac, createHash } from 'node:crypto';

// בתוקף רק עד שמנהלת המערכת מחליפה סיסמה בפעם הראשונה (אלה הסיסמאות שהיו
// כתובות עד עכשיו ב-entry.html).
const DEFAULT_PASSWORDS = { sys: '990211', inst: '550118' };
const MIN_PASSWORD = 8;
// ברירת המחדל: שום מודול לא פתוח למוסד עד שמנהלת המערכת פותחת אותו במסך הניהול.
const DEFAULT_MODULES = { conv: false, activity: false, academic: false, resilience: false };
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

const pause = () => new Promise((r) => setTimeout(r, 400));

function hashPassword(pw, salt = randomBytes(16).toString('hex')) {
  return { salt, hash: scryptSync(pw, salt, 32).toString('hex') };
}

function same(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

async function checkPassword(store, kind, pw) {
  if (!DEFAULT_PASSWORDS[kind] || typeof pw !== 'string' || !pw) return false;
  const rec = await store.get('pw-' + kind);
  if (!rec) return same(pw, DEFAULT_PASSWORDS[kind]);
  return same(hashPassword(pw, rec.salt).hash, rec.hash);
}

const normCode = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

function newCode() {
  let s = '';
  for (const b of randomBytes(8)) s += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return s.slice(0, 4) + '-' + s.slice(4);
}

// מוסדות וקודי המוסד. עד השמירה הראשונה — הרשימה שהייתה כתובה ב-entry.html.
const DEFAULT_INSTITUTIONS = [
  { name: 'מכללה לחינוך', code: '482913', active: true, since: '2025' },
  { name: 'מכללה אקדמית ב׳', code: '733204', active: true, since: '2026' },
  { name: 'מרכז סימולציה אזורי', code: '115708', active: true, since: '2026' },
  { name: 'מוסד YS', code: 'ys7777', active: true, since: '2026' },
];

async function getInstitutions(store) {
  return (await store.get('institutions')) || DEFAULT_INSTITUTIONS.map((x) => ({ ...x }));
}

function newInstCode(list) {
  for (;;) {
    const c = String(100000 + (randomBytes(4).readUInt32BE(0) % 900000));
    if (!list.some((x) => normCode(x.code) === c)) return c;
  }
}

async function status(store) {
  const [code, sys, inst] = await Promise.all([store.get('code-academic'), store.get('pw-sys'), store.get('pw-inst')]);
  return {
    academicCode: code ? code.code : null,
    academicCreatedAt: code ? code.createdAt : null,
    defaultPasswords: { sys: !sys, inst: !inst },
  };
}

// ── אסימון כניסה חתום ──
// אחרי כניסה מוצלחת השרת מחזיר אסימון חתום (HMAC) עם סוג הכניסה, המוסד ותוקף.
// הדפדפן לא יכול לזייף אותו, ולכן פעולות שדורשות כניסה (למשל פתיחת כיתת חוסן)
// נבדקות מולו כאן בשרת. המפתח נוצר פעם אחת ונשמר במאגר (token-secret).
const TOKEN_HOURS = 12;
const b64u = (buf) => Buffer.from(buf).toString('base64url');

async function tokenSecret(store) {
  let rec = await store.get('token-secret');
  if (!rec) { rec = { secret: randomBytes(32).toString('hex') }; await store.set('token-secret', rec); }
  return rec.secret;
}

async function signToken(store, payload) {
  const body = b64u(JSON.stringify({ ...payload, exp: Date.now() + TOKEN_HOURS * 3600e3 }));
  const sig = createHmac('sha256', await tokenSecret(store)).update(body).digest('base64url');
  return body + '.' + sig;
}

export async function verifyToken(store, token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const want = createHmac('sha256', await tokenSecret(store)).update(body).digest('base64url');
  if (!same(sig, want)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    return p.exp > Date.now() ? p : null;
  } catch { return null; }
}

// ── חוסן חברתי: כיתות ותשובות ──
// כיתה: resil:<id> → { inst, cls, band, open, keyHash, createdAt }.
// תשובה: resil:<id>:r:<קול>:<מפתח נשאל>:<סבב> → { v, k, a, rd, dt, ts } — שורה
// לכל תשובה, כדי ששני תלמידים ששולחים באותו רגע לא ידרסו זה את זה.
// מפתח הכיתה (key) נמסר רק למחנך/כת שפתח/ה אותה, ורק איתו (או עם כניסת מנהלת
// המערכת) אפשר לראות תוצאות, לסגור את השאלון או למחוק.
const RESIL_ITEMS = { 0: 62, 1: 75, 2: 75, 3: 75 }; // מספר ההיגדים בכל שכבה (resilience-data.js)
const RESIL_VOICES = 5, RESIL_LEVELS = 5, RESIL_MAX_RESP = 3000, RESIL_MAX_SEL = 15;
// השאלות שהמחנך/כת בחר/ה: מיקומים בתוך היגדי השכבה (0..מספר ההיגדים-1),
// 1 עד 15, בלי כפילויות, בסדר עולה. כיתה ישנה בלי sel — כל ההיגדים.
function validSel(sel, band) {
  return Array.isArray(sel) && sel.length >= 1 && sel.length <= RESIL_MAX_SEL
    && sel.every((x, j) => Number.isInteger(x) && x >= 0 && x < RESIL_ITEMS[band] && (j === 0 || x > sel[j - 1]));
}
const ID_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';
const randId = (n) => { let s = ''; for (const b of randomBytes(n)) s += ID_ALPHABET[b % ID_ALPHABET.length]; return s; };
const sha = (x) => createHash('sha256').update(String(x)).digest('hex');
const validId = (id) => typeof id === 'string' && /^[a-z0-9]{8,20}$/.test(id);

async function resilGroup(store, id) {
  return validId(id) ? store.get('resil:' + id) : null;
}

async function resilCanManage(store, body, g) {
  if (typeof body.key === 'string' && body.key && same(sha(body.key), g.keyHash)) return true;
  const t = await verifyToken(store, body.token);
  return !!t && t.k === 'sys';
}

const publicGroup = (id, g) => ({ id, cls: g.cls, band: g.band, sel: g.sel || null, open: g.open !== false, createdAt: g.createdAt });

async function handleResilience(store, body) {
  const { action } = body;

  if (action === 'resilCreate') {
    const t = await verifyToken(store, body.token);
    if (!t || (t.k !== 'inst' && t.k !== 'sys')) { await pause(); return [403, { error: 'unauthorized' }]; }
    if (t.k === 'inst') {
      const mods = { ...DEFAULT_MODULES, ...((await store.get('modules:' + t.inst)) || {}) };
      if (mods.resilience !== true) return [403, { error: 'module off' }];
    }
    const cls = String(body.cls || '').trim().slice(0, 40);
    const band = Number(body.band);
    if (!cls || !(band in RESIL_ITEMS)) return [400, { error: 'missing fields' }];
    const id = randId(12), key = randId(20);
    const sel = Array.isArray(body.sel) ? [...body.sel].sort((x, y) => x - y) : null;
    if (!validSel(sel, band)) return [400, { error: 'bad selection', max: RESIL_MAX_SEL }];
    const g = { inst: t.inst || '', cls, band, sel, open: true, keyHash: sha(key), createdAt: new Date().toISOString() };
    await store.set('resil:' + id, g);
    return [200, { key, group: publicGroup(id, g) }];
  }

  // כל הכיתות במערכת, עם מספר התשובות — רק למנהלת המערכת.
  if (action === 'resilList') {
    const t = await verifyToken(store, body.token);
    if (!t || t.k !== 'sys') { await pause(); return [403, { error: 'unauthorized' }]; }
    const counts = {};
    for (const { key } of await store.list('resil:', { keysOnly: true })) {
      const [, id, r] = key.split(':');
      if (!validId(id)) continue;
      counts[id] = (counts[id] || 0) + (r === 'r' ? 1 : 0);
    }
    const ids = Object.keys(counts);
    const groups = await Promise.all(ids.map((id) => store.get('resil:' + id)));
    const list = ids.map((id, i) => groups[i] && { ...publicGroup(id, groups[i]), inst: groups[i].inst, responses: counts[id] })
      .filter(Boolean).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return [200, { groups: list }];
  }

  const g = await resilGroup(store, body.id);
  if (!g) { await pause(); return [404, { error: 'no such group' }]; }

  if (action === 'resilInfo') return [200, { group: publicGroup(body.id, g) }];

  if (action === 'resilSubmit') {
    if (g.open === false) return [409, { error: 'closed' }];
    const v = Number(body.v), k = String(body.k || ''), a = body.a;
    if (!Number.isInteger(v) || v < 0 || v >= RESIL_VOICES) return [400, { error: 'bad voice' }];
    if (!/^[a-z0-9]{4,24}$/.test(k)) return [400, { error: 'bad key' }];
    // תשובה לכל היגדי השכבה; בהיגדים שלא נבחרו — null (הניקוד מדלג עליהם).
    const asked = g.sel ? new Set(g.sel) : null;
    if (!Array.isArray(a) || a.length !== RESIL_ITEMS[g.band]
      || !a.every((x, j) => (asked && !asked.has(j)) ? x === null
        : Number.isInteger(x) && x >= 0 && x < RESIL_LEVELS)) return [400, { error: 'bad answers' }];
    const all = await store.list('resil:' + body.id + ':r:', { keysOnly: true });
    if (all.length >= RESIL_MAX_RESP) return [429, { error: 'full' }];
    const mine = 'resil:' + body.id + ':r:' + v + ':' + k + ':';
    const rd = all.filter((x) => x.key.startsWith(mine)).length + 1;
    const rec = { v, k, a, rd, dt: new Date().toISOString().slice(0, 10), ts: Date.now() };
    await store.set(mine + rd, rec);
    return [200, { ok: true, round: rd }];
  }

  if (!(await resilCanManage(store, body, g))) { await pause(); return [403, { error: 'unauthorized' }]; }

  if (action === 'resilResults') {
    const rows = await store.list('resil:' + body.id + ':r:');
    return [200, { group: publicGroup(body.id, g), resp: rows.map((x) => x.value) }];
  }
  if (action === 'resilSetOpen') {
    g.open = body.open !== false;
    await store.set('resil:' + body.id, g);
    return [200, { group: publicGroup(body.id, g) }];
  }
  if (action === 'resilDelete') {
    await store.delPrefix('resil:' + body.id + ':r:');
    await store.del('resil:' + body.id);
    return [200, { ok: true }];
  }
  return [400, { error: 'unknown action' }];
}

// מחזירה [status, body].
export async function handleAccess(store, body) {
  const { action } = body || {};

  if (action === 'login') {
    const { kind, secret } = body;
    let ok = false;
    if (kind === 'sys' || kind === 'inst') ok = await checkPassword(store, kind, secret);
    else if (kind === 'academic') {
      const rec = await store.get('code-academic');
      ok = !!rec && normCode(secret).length > 0 && same(normCode(secret), normCode(rec.code));
    }
    else if (kind === 'inst-code') {
      const c = normCode(secret);
      const hit = c && (await getInstitutions(store)).find((x) => same(normCode(x.code), c));
      if (hit && hit.active === false) { await pause(); return [403, { error: 'inactive' }]; }
      if (hit) return [200, { ok: true, inst: hit.name, token: await signToken(store, { k: 'inst', inst: hit.name }) }];
    }
    if (!ok) { await pause(); return [403, { error: 'wrong' }]; }
    return [200, { ok: true, token: await signToken(store, { k: kind }) }];
  }

  // אילו מודולים פתוחים למוסד — לא סוד, נקרא בכניסה ל-system-select.html
  // ובכניסת מחנך/כת (resilience).
  if (action === 'getModules') {
    const inst = String(body.inst || '').trim();
    if (!inst) return [400, { error: 'missing inst' }];
    return [200, { ...DEFAULT_MODULES, ...((await store.get('modules:' + inst)) || {}) }];
  }

  if (typeof action === 'string' && action.startsWith('resil')) return handleResilience(store, body);

  const isSys = await checkPassword(store, 'sys', body?.auth);

  // מנהלת מוסד רואה ומחליפה את קוד המוסד שלה (גם סיסמת מנהלת המערכת מתקבלת).
  if (action === 'instGetCode' || action === 'instNewCode') {
    if (!isSys && !(await checkPassword(store, 'inst', body?.auth))) { await pause(); return [403, { error: 'unauthorized' }]; }
    const list = await getInstitutions(store);
    const x = list.find((i) => i.name === String(body.inst || '').trim());
    if (!x) return [404, { error: 'no such institution' }];
    if (action === 'instNewCode') { x.code = newInstCode(list); await store.set('institutions', list); }
    return [200, { name: x.name, code: x.code, active: x.active !== false }];
  }

  // כל שאר פעולות הניהול מחייבות את סיסמת מנהלת המערכת בבקשה עצמה.
  if (!isSys) { await pause(); return [403, { error: 'unauthorized' }]; }

  if (action === 'listInstitutions') return [200, { institutions: await getInstitutions(store) }];

  if (action === 'addInstitution' || action === 'newInstitutionCode' || action === 'setInstitutionActive') {
    const list = await getInstitutions(store);
    const name = String(body.name || '').trim();
    if (!name) return [400, { error: 'missing name' }];
    const x = list.find((i) => i.name === name);
    if (action === 'addInstitution') {
      if (x) return [409, { error: 'exists' }];
      list.push({ name, code: newInstCode(list), active: true, since: String(new Date().getFullYear()) });
    } else {
      if (!x) return [404, { error: 'no such institution' }];
      if (action === 'newInstitutionCode') x.code = newInstCode(list);
      else x.active = body.active !== false;
    }
    await store.set('institutions', list);
    return [200, { institutions: list }];
  }

  if (action === 'setModules') {
    const inst = String(body.inst || '').trim();
    const m = body.modules;
    if (!inst || !m || typeof m !== 'object') return [400, { error: 'missing fields' }];
    const safe = { conv: m.conv === true, activity: m.activity === true, academic: m.academic === true,
      resilience: m.resilience === true };
    await store.set('modules:' + inst, safe);
    return [200, { ok: true, modules: safe }];
  }

  if (action === 'status') return [200, await status(store)];

  if (action === 'newAcademicCode') {
    await store.set('code-academic', { code: newCode(), createdAt: new Date().toISOString() });
    return [200, await status(store)];
  }

  if (action === 'revokeAcademicCode') {
    await store.del('code-academic');
    return [200, await status(store)];
  }

  if (action === 'setPassword') {
    const { kind, newPassword } = body;
    if (kind !== 'sys' && kind !== 'inst') return [400, { error: 'bad kind' }];
    if (typeof newPassword !== 'string' || newPassword.trim().length < MIN_PASSWORD)
      return [400, { error: 'short', min: MIN_PASSWORD }];
    await store.set('pw-' + kind, hashPassword(newPassword.trim()));
    return [200, await status(store)];
  }

  return [400, { error: 'unknown action' }];
}

// מאגר ב-Supabase: טבלת access_settings (key text PK, value jsonb), עם RLS בלי
// שום policy — כך שרק השרת, עם ה-service key, יכול לקרוא ולכתוב.
export function supabaseStore(url, key) {
  const base = `${url.replace(/\/+$/, '')}/rest/v1/access_settings`;
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  const check = async (r) => {
    if (!r.ok) throw new Error(`Supabase ${r.status}: ${(await r.text().catch(() => '')).slice(0, 200)}`);
    return r;
  };
  return {
    async get(k) {
      const r = await check(await fetch(`${base}?key=eq.${encodeURIComponent(k)}&select=value`, { headers }));
      const rows = await r.json();
      return rows.length ? rows[0].value : null;
    },
    async set(k, value) {
      await check(await fetch(base, {
        method: 'POST',
        headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ key: k, value, updated_at: new Date().toISOString() }),
      }));
    },
    async del(k) {
      await check(await fetch(`${base}?key=eq.${encodeURIComponent(k)}`, { method: 'DELETE', headers }));
    },
    // כל השורות שהמפתח שלהן מתחיל ב-prefix (like של PostgREST; * הוא התו הכללי).
    async list(prefix, { keysOnly = false } = {}) {
      const sel = keysOnly ? 'key' : 'key,value';
      const r = await check(await fetch(`${base}?key=like.${encodeURIComponent(prefix + '*')}&select=${sel}&order=key&limit=5000`, { headers }));
      return r.json();
    },
    async delPrefix(prefix) {
      await check(await fetch(`${base}?key=like.${encodeURIComponent(prefix + '*')}`, { method: 'DELETE', headers }));
    },
  };
}
