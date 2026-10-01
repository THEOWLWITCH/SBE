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
// ההרשאות במערכת. לכל מוסד יש "תקרה" (modules:<מוסד>) — מה שמנהלת המערכת פתחה
// לו; ברירת המחדל: שום דבר. קודי הצוות שמנהל/ת המוסד מפיק/ה מקבלים רק צירוף
// מתוך התקרה.
export const PERMS = ['fac_trainee', 'fac_parent', 'fac_youth', 'conv', 'activity', 'academic', 'lecturer', 'resilience'];
const DEFAULT_MODULES = Object.fromEntries(PERMS.map((p) => [p, false]));
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
    const byCode = t && t.k === 'code' && (t.perms || []).includes('resilience');
    if (!t || (t.k !== 'inst' && t.k !== 'sys' && !byCode)) { await pause(); return [403, { error: 'unauthorized' }]; }
    if (t.k === 'inst' || byCode) {
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


// ── קודים, הרשאות ומנויים ──
// קוד: code:<קוד מנורמל> → { code, kind, inst, perms, label, createdBy, createdAt,
//   expiresAt (YYYY-MM-DD או null), maxUses, uses, revoked }
//   kind: 'instadmin' — מנהל/ת מוסד (מפיק/ה קודי צוות); 'staff' — איש/אשת צוות עם
//   צירוף הרשאות; 'student' — קוד "משוב לעבודות" שמרצה מפיק/ה לסטודנט/ית.
// התוקף בפועל: המוקדם מבין תוקף הקוד וסוף המנוי של המוסד + ימי החסד.
// מוסד: { ..., subEnd: 'YYYY-MM-DD' או null (ללא הגבלה) }.
// הגדרות: settings → { graceDays, academic: { maxActive, days, uses } }.
const DEFAULT_SETTINGS = { graceDays: 14, academic: { maxActive: 50, days: 7, uses: 3 } };
const DAY = 86400e3;
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (ymd, n) => new Date(Date.parse(ymd + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / DAY);
const validYmd = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d + 'T00:00:00Z'));
const minYmd = (...ds) => ds.filter(Boolean).sort()[0] || null;

async function getSettings(store) {
  const s = (await store.get('settings')) || {};
  return { ...DEFAULT_SETTINGS, ...s, academic: { ...DEFAULT_SETTINGS.academic, ...(s.academic || {}) } };
}

async function getCeiling(store, inst) {
  return { ...DEFAULT_MODULES, ...((await store.get('modules:' + inst)) || {}) };
}

// מצב המנוי של מוסד: ok | warn (עד 60 יום לסיום) | grace | expired | inactive
function subState(x, settings) {
  if (!x) return { state: 'expired' };
  if (x.active === false) return { state: 'inactive' };
  if (!x.subEnd) return { state: 'ok', subEnd: null };
  const left = daysBetween(today(), x.subEnd);
  if (left >= 0) return { state: left <= 60 ? 'warn' : 'ok', subEnd: x.subEnd, daysLeft: left };
  const graceEnd = addDays(x.subEnd, settings.graceDays);
  const gl = daysBetween(today(), graceEnd);
  return gl >= 0 ? { state: 'grace', subEnd: x.subEnd, graceEnd, daysLeft: gl } : { state: 'expired', subEnd: x.subEnd, graceEnd };
}

function newCodeUnique(existing) {
  for (;;) { const c = newCode(); if (!existing.has(normCode(c))) return c; }
}

async function allCodes(store) {
  return (await store.list('code:')).map((r) => r.value).filter(Boolean);
}

// מה הקוד מאפשר עכשיו: null אם הוא לא תקף, אחרת { rec, inst, perms, sub }.
async function resolveCode(store, rec, settings) {
  if (!rec || rec.revoked) return { error: 'revoked' };
  const list = await getInstitutions(store);
  const x = list.find((i) => i.name === rec.inst);
  const sub = subState(x, settings);
  if (sub.state === 'inactive') return { error: 'inactive' };
  if (sub.state === 'expired') return { error: 'sub-expired', sub };
  if (rec.expiresAt && rec.expiresAt < today()) return { error: 'expired' };
  if (rec.kind === 'student' && rec.uses >= rec.maxUses) return { error: 'used-up' };
  const ceiling = await getCeiling(store, rec.inst);
  let perms;
  if (rec.kind === 'instadmin') perms = PERMS.filter((p) => ceiling[p]);
  else if (rec.kind === 'student') perms = ceiling.academic || ceiling.lecturer ? ['academic'] : [];
  else perms = (rec.perms || []).filter((p) => ceiling[p]);
  return { rec, inst: rec.inst, perms, sub };
}

// הודעות לבאנר אחרי כניסה.
function notices(kind, sub, rec) {
  const n = [];
  if (sub.state === 'grace') n.push({ level: 'danger', type: 'grace', graceEnd: sub.graceEnd, daysLeft: sub.daysLeft });
  else if (sub.state === 'warn' && (kind === 'instadmin' ? sub.daysLeft <= 60 : sub.daysLeft <= 7))
    n.push({ level: sub.daysLeft <= 7 ? 'danger' : 'warn', type: 'sub-ending', subEnd: sub.subEnd, daysLeft: sub.daysLeft });
  if (rec && rec.expiresAt && rec.kind !== 'student') {
    const left = daysBetween(today(), rec.expiresAt);
    if (left <= 7) n.push({ level: 'warn', type: 'code-ending', expiresAt: rec.expiresAt, daysLeft: left });
  }
  return n;
}

const publicCode = (r) => ({ code: r.code, kind: r.kind, inst: r.inst, perms: r.perms || [], label: r.label || '',
  createdAt: r.createdAt, expiresAt: r.expiresAt || null, uses: r.uses || 0, maxUses: r.maxUses || null,
  revoked: !!r.revoked, createdBy: r.createdBy || '' });

async function handleCodes(store, body, isSys) {
  const { action } = body;
  const settings = await getSettings(store);
  const t = await verifyToken(store, body.token);
  const me = t && t.k === 'code' ? await store.get('code:' + t.c) : null;
  const meOk = me ? await resolveCode(store, me, settings) : null;
  const mine = meOk && !meOk.error ? meOk : null;

  // בקשת חידוש מנוי — ציבורית (גם כשהמנוי כבר הסתיים). אין סליקה: הבקשה נשמרת,
  // מנהלת המערכת מתקשרת להאריך ולקבל פרטי תשלום. המוסד מזוהה לפי קוד (אם
  // הוקלד) או לפי שם מדויק; אחרת נשמר כ"לא מזוהה". בלי טקסט חופשי.
  // שמות המוסדות שיש להם מנוי — לרשימה הנפתחת בטופס (ציבורי: שמות בלבד).
  if (action === 'renewInstitutions') {
    const list = await getInstitutions(store);
    return [200, { names: list.filter((i) => i.active !== false).map((i) => i.name).sort((a, b) => a.localeCompare(b, 'he')) }];
  }

  if (action === 'renewRequest') {
    const list = await getInstitutions(store);
    const code = normCode(body.code);
    const rec = code ? await store.get('code:' + code) : null;
    const legacy = code && !rec ? list.find((i) => normCode(i.code) === code) : null;
    const instTyped = String(body.instName || '').trim().slice(0, 80);
    const inst = rec && rec.kind === 'instadmin' ? rec.inst : legacy ? legacy.name
      : (list.find((i) => i.name === instTyped) || {}).name || null;
    const fullName = String(body.fullName || '').trim().slice(0, 60);
    const email = String(body.email || '').trim().slice(0, 80);
    const phone = String(body.phone || '').replace(/[^\d+]/g, '').slice(0, 15);
    const systems = [...new Set((Array.isArray(body.systems) ? body.systems : []).filter((p) => PERMS.includes(p)))];
    const other = String(body.other || '').trim().slice(0, 80);
    const period = ['year', 'half'].includes(body.period) ? body.period : 'year';
    const type = body.type === 'new' ? 'new' : 'renew';
    if (!fullName || !instTyped || (!systems.length && !other)) return [400, { error: 'missing fields' }];
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return [400, { error: 'bad email' }];
    if (!/^(\+972|0)5\d{8}$/.test(phone)) return [400, { error: 'bad phone' }];
    // טופס ציבורי: עד 5 בקשות פתוחות למוסד מזוהה, ועד 30 לא-מזוהות, כדי שלא יציפו את המאגר.
    const open = (await store.list('renewreq:')).map((r) => r.value).filter((v) => v && !v.done);
    if (open.filter((v) => (v.inst || null) === inst).length >= (inst ? 5 : 30)) return [429, { error: 'too many' }];
    const at = new Date().toISOString();
    await store.set('renewreq:' + at + ':' + randomBytes(3).toString('hex'),
      { type, inst, instTyped, fullName, email, phone, systems, other, period, at, done: false });
    return [200, { ok: true, at, inst: inst || instTyped }];
  }

  if (action === 'codesList') {
    const codes = await allCodes(store);
    if (isSys) return [200, { codes: codes.filter((c) => !body.inst || c.inst === body.inst).map(publicCode) }];
    if (!mine) { await pause(); return [403, { error: 'unauthorized' }]; }
    const out = mine.rec.kind === 'instadmin'
      ? codes.filter((c) => c.inst === mine.inst && c.kind !== 'instadmin')
      : codes.filter((c) => c.createdBy === mine.rec.code);
    return [200, { codes: out.map(publicCode), ceiling: await getCeiling(store, mine.inst), sub: mine.sub, settings: { academic: settings.academic } }];
  }

  if (action === 'codeCreate') {
    const kind = body.kind;
    const existing = new Set((await allCodes(store)).map((c) => normCode(c.code)));
    const list = await getInstitutions(store);
    const label = String(body.label || '').trim().slice(0, 60);
    if (kind === 'instadmin' || (kind === 'staff' && isSys)) {
      if (!isSys) { await pause(); return [403, { error: 'unauthorized' }]; }
      const x = list.find((i) => i.name === String(body.inst || ''));
      if (!x) return [404, { error: 'no such institution' }];
      // קוד אישי שמנהלת המערכת מפיקה ישירות (למשל לאדם יחיד בלי צוות): רק מתוך התקרה של המוסד.
      if (kind === 'staff') {
        const want = [...new Set((body.perms || []).filter((p) => PERMS.includes(p)))];
        const ceiling = await getCeiling(store, x.name);
        if (!want.length) return [400, { error: 'no perms' }];
        if (want.some((p) => !ceiling[p])) return [403, { error: 'above ceiling' }];
      }
      const rec = { code: newCodeUnique(existing), kind, inst: x.name, perms: kind === 'staff' ? [...new Set((body.perms || []).filter((p) => PERMS.includes(p)))] : [],
        label: label || (kind === 'instadmin' ? 'מנהל/ת המוסד' : ''), createdBy: 'sys', createdAt: new Date().toISOString(),
        expiresAt: validYmd(body.expiresAt) ? body.expiresAt : null, uses: 0, revoked: false };
      await store.set('code:' + normCode(rec.code), rec);
      return [200, { code: publicCode(rec) }];
    }
    if (kind === 'staff') {
      if (!mine || mine.rec.kind !== 'instadmin') { await pause(); return [403, { error: 'unauthorized' }]; }
      const ceiling = await getCeiling(store, mine.inst);
      const perms = [...new Set((body.perms || []).filter((p) => PERMS.includes(p)))];
      if (!perms.length) return [400, { error: 'no perms' }];
      if (perms.some((p) => !ceiling[p])) return [403, { error: 'above ceiling' }];
      const rec = { code: newCodeUnique(existing), kind, inst: mine.inst, perms, label, createdBy: mine.rec.code,
        createdAt: new Date().toISOString(), expiresAt: validYmd(body.expiresAt) ? minYmd(body.expiresAt, mine.sub.subEnd) : null,
        uses: 0, revoked: false };
      await store.set('code:' + normCode(rec.code), rec);
      return [200, { code: publicCode(rec) }];
    }
    if (kind === 'student') {
      if (!mine || !mine.perms.includes('lecturer')) { await pause(); return [403, { error: 'unauthorized' }]; }
      const lim = settings.academic;
      const active = (await allCodes(store)).filter((c) => c.createdBy === mine.rec.code && !c.revoked
        && (!c.expiresAt || c.expiresAt >= today()) && (c.uses || 0) < (c.maxUses || Infinity)).length;
      const count = Math.max(1, Math.min(Number(body.count) || 1, 50));
      if (active + count > lim.maxActive) return [429, { error: 'limit', maxActive: lim.maxActive, active }];
      const expiresAt = minYmd(addDays(today(), lim.days), mine.sub.subEnd);
      const made = [];
      for (let i = 0; i < count; i++) {
        const rec = { code: newCodeUnique(existing), kind, inst: mine.inst, perms: ['academic'], label, createdBy: mine.rec.code,
          createdAt: new Date().toISOString(), expiresAt, maxUses: lim.uses, uses: 0, revoked: false };
        existing.add(normCode(rec.code));
        await store.set('code:' + normCode(rec.code), rec);
        made.push(publicCode(rec));
      }
      return [200, { codes: made }];
    }
    return [400, { error: 'bad kind' }];
  }

  if (action === 'codeRevoke') {
    const rec = await store.get('code:' + normCode(body.code));
    if (!rec) return [404, { error: 'no such code' }];
    const allowed = isSys || (mine && (rec.createdBy === mine.rec.code
      || (mine.rec.kind === 'instadmin' && rec.inst === mine.inst && rec.kind !== 'instadmin')));
    if (!allowed) { await pause(); return [403, { error: 'unauthorized' }]; }
    rec.revoked = true;
    await store.set('code:' + normCode(rec.code), rec);
    return [200, { code: publicCode(rec) }];
  }

  // שימוש אחד בקוד סטודנט/ית (לפני הפקת משוב). לקודים אחרים — בלי מגבלה.
  if (action === 'codeUse') {
    if (!t || t.k !== 'code') { await pause(); return [403, { error: 'unauthorized' }]; }
    const rec = await store.get('code:' + t.c);
    const r = await resolveCode(store, rec, settings);
    if (r.error) return [403, { error: r.error }];
    if (rec.kind !== 'student') return [200, { ok: true, left: null }];
    rec.uses = (rec.uses || 0) + 1;
    await store.set('code:' + t.c, rec);
    return [200, { ok: true, left: rec.maxUses - rec.uses }];
  }

  // ── מנהלת המערכת ──
  if (!isSys) { await pause(); return [403, { error: 'unauthorized' }]; }

  if (action === 'setSubscription' || action === 'renewSubscription') {
    const list = await getInstitutions(store);
    const x = list.find((i) => i.name === String(body.name || ''));
    if (!x) return [404, { error: 'no such institution' }];
    if (action === 'setSubscription') {
      if (body.subEnd !== null && !validYmd(body.subEnd)) return [400, { error: 'bad date' }];
      x.subEnd = body.subEnd;
    } else {
      const months = Number(body.months) || 12;
      const from = x.subEnd && x.subEnd >= today() ? x.subEnd : today();
      const d = new Date(from + 'T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + months);
      x.subEnd = d.toISOString().slice(0, 10);
    }
    await store.set('institutions', list);
    return [200, { institutions: await institutionsView(store) }];
  }

  if (action === 'getSettings') return [200, { settings }];
  if (action === 'setSettings') {
    const g = Number(body.graceDays), a = body.academic || {};
    const clamp = (v, lo, hi, d) => (Number.isFinite(Number(v)) ? Math.max(lo, Math.min(hi, Math.round(Number(v)))) : d);
    const next = { graceDays: clamp(g, 0, 90, settings.graceDays),
      academic: { maxActive: clamp(a.maxActive, 1, 500, settings.academic.maxActive), days: clamp(a.days, 1, 60, settings.academic.days),
        uses: clamp(a.uses, 1, 50, settings.academic.uses) } };
    await store.set('settings', next);
    return [200, { settings: next }];
  }

  if (action === 'renewList') {
    const rows = (await store.list('renewreq:')).map((r) => ({ id: r.key.slice(9), ...r.value })).reverse();
    return [200, { requests: rows }];
  }
  // רכישה חדשה: פותחת את המוסד מהבקשה, עם המערכות שביקשו ומנוי לתקופה שביקשו.
  if (action === 'renewCreateInst') {
    const k = 'renewreq:' + String(body.id || '');
    const r = await store.get(k);
    if (!r) return [404, { error: 'no such request' }];
    const list = await getInstitutions(store);
    const name = r.inst || r.instTyped;
    if (!list.find((i) => i.name === name)) list.push({ name, code: newInstCode(list), active: true, since: String(new Date().getFullYear()) });
    const x = list.find((i) => i.name === name);
    const d = new Date(today() + 'T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + (r.period === 'half' ? 6 : 12));
    x.subEnd = d.toISOString().slice(0, 10);
    await store.set('institutions', list);
    const cur = await getCeiling(store, name);
    (r.systems || []).forEach((p) => { cur[p] = true; });
    await store.set('modules:' + name, cur);
    r.inst = name; r.done = true; await store.set(k, r);
    return [200, { institutions: await institutionsView(store) }];
  }

  if (action === 'renewApplySystems') {
    const r = await store.get('renewreq:' + String(body.id || ''));
    if (!r || !r.inst) return [404, { error: 'no such request' }];
    const cur = await getCeiling(store, r.inst);
    (r.systems || []).forEach((p) => { cur[p] = true; });
    await store.set('modules:' + r.inst, cur);
    return [200, { ok: true, modules: cur }];
  }
  if (action === 'renewDone') {
    const k = 'renewreq:' + String(body.id || '');
    const r = await store.get(k);
    if (!r) return [404, { error: 'no such request' }];
    r.done = true; await store.set(k, r);
    return [200, { ok: true }];
  }
  return null;
}

// רשימת המוסדות למסך הניהול — עם מצב המנוי וקוד מנהל/ת המוסד.
async function institutionsView(store) {
  const [list, settings, codes] = await Promise.all([getInstitutions(store), getSettings(store), allCodes(store)]);
  const ceilings = await Promise.all(list.map((x) => getCeiling(store, x.name)));
  return list.map((x, i) => {
    const admin = codes.filter((c) => c.kind === 'instadmin' && c.inst === x.name && !c.revoked).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    return { ...x, sub: subState(x, settings), adminCode: admin ? admin.code : null, open: PERMS.filter((p) => ceilings[i][p]),
      staffCodes: codes.filter((c) => c.inst === x.name && c.kind === 'staff' && !c.revoked).length,
      personalCodes: codes.filter((c) => c.inst === x.name && c.kind === 'staff' && c.createdBy === 'sys' && !c.revoked)
        .map((c) => ({ code: c.code, label: c.label || '', perms: c.perms || [], expiresAt: c.expiresAt || null })) };
  });
}


// ── רשימות פתוחות לקהילה ("חכמת ההמונים", 01/10/2026) ──
// list:<name> → [{ value, inst, date }]. כל אחד/ת עם הרשאה מתאימה מוסיף/ה פריט,
// והוא מופיע מיד לכולם. מנהלת המערכת יכולה להסיר. רשימות מוכרות בלבד.
const OPEN_LISTS = { 'advisor-situation': 'resilience' };
const LIST_MAX = 200, ITEM_MAX = 80;
async function handleLists(store, body) {
  const { action } = body;
  const name = String(body.name || '');
  if (!(name in OPEN_LISTS)) return [404, { error: 'no such list' }];
  const key = 'list:' + name;
  const list = (await store.get(key)) || [];
  if (action === 'listGet') return [200, { items: list.map((x) => x.value) }];
  const t = await verifyToken(store, body.token);
  const isSysTok = !!t && t.k === 'sys';
  if (action === 'listAdd') {
    const ok = isSysTok || (t && Array.isArray(t.perms) && t.perms.includes(OPEN_LISTS[name]));
    if (!ok) { await pause(); return [403, { error: 'unauthorized' }]; }
    const value = String(body.value || '').replace(/\s+/g, ' ').trim().slice(0, ITEM_MAX);
    if (value.length < 2) return [400, { error: 'too short' }];
    if (!list.some((x) => x.value === value)) {
      if (list.length >= LIST_MAX) return [429, { error: 'list full' }];
      list.push({ value, inst: t.inst || '', date: new Date().toISOString().slice(0, 10) });
      await store.set(key, list);
    }
    return [200, { items: list.map((x) => x.value), value }];
  }
  if (action === 'listRemove') {
    if (!isSysTok) { await pause(); return [403, { error: 'unauthorized' }]; }
    const next = list.filter((x) => x.value !== String(body.value || ''));
    await store.set(key, next);
    return [200, { items: next.map((x) => x.value) }];
  }
  return [400, { error: 'bad action' }];
}


// ── פניות מהמשתמשים (01/10/2026): רעיונות, תקלות ושאלות מתוך פרקטי ──
// fb:<ts>-<rand> → { type, text, name, contact, source, page, at }. שליחה פתוחה
// (גם לאורחים בהתנסות הקהילה), קריאה ומחיקה — מנהלת המערכת בלבד.
const FB_TYPES = ['רעיון', 'תקלה', 'שאלה'];
const FB_MAX = 3000;
async function handleFeedbackInbox(store, body) {
  const { action } = body;
  const clip = (v, n) => String(v || '').trim().slice(0, n);
  if (action === 'fbSubmit') {
    const text = clip(body.text, 2000);
    if (text.length < 2) return [400, { error: 'empty' }];
    const keys = await store.list('fb:', { keysOnly: true });
    if (keys.length >= FB_MAX) return [429, { error: 'full' }];
    const rec = { type: FB_TYPES.includes(body.type) ? body.type : 'רעיון', text, name: clip(body.name, 80),
      contact: clip(body.contact, 120), source: clip(body.source, 40), page: clip(body.page, 80), at: new Date().toISOString() };
    await store.set('fb:' + Date.now() + '-' + randomBytes(3).toString('hex'), rec);
    return [200, { ok: true }];
  }
  const t = await verifyToken(store, body.token);
  const sys = (t && t.k === 'sys') || await checkPassword(store, 'sys', body.auth);
  if (!sys) { await pause(); return [403, { error: 'unauthorized' }]; }
  if (action === 'fbList') {
    const rows = await store.list('fb:');
    return [200, { items: rows.map((r) => ({ id: r.key.slice(3), ...r.value })).sort((a, b) => String(b.at).localeCompare(String(a.at))) }];
  }
  if (action === 'fbDelete') {
    const id = String(body.id || '');
    if (!/^[0-9]+-[0-9a-f]{6}$/.test(id)) return [400, { error: 'bad id' }];
    await store.del('fb:' + id);
    return [200, { ok: true }];
  }
  return [400, { error: 'bad action' }];
}

// מחזירה [status, body].
export async function handleAccess(store, body) {
  const { action } = body || {};

  if (action === 'login' && body.kind === 'code') {
    // כניסה בשדה אחד: הקוד קובע מי את/ה ומה פתוח.
    const settings = await getSettings(store);
    const c = normCode(body.secret);
    const rec = c ? await store.get('code:' + c) : null;
    if (rec) {
      const r = await resolveCode(store, rec, settings);
      if (r.error) { await pause(); return [403, { error: r.error }]; }
      const token = await signToken(store, { k: 'code', c, kind: rec.kind, inst: r.inst, perms: r.perms });
      return [200, { ok: true, token, kind: rec.kind, inst: r.inst, label: rec.label || '', perms: r.perms,
        notices: notices(rec.kind, r.sub, rec), sub: rec.kind === 'instadmin' ? r.sub : undefined }];
    }
    // קוד מוסד ישן (6 ספרות): איש/אשת צוות עם כל מה שפתוח למוסד — עד שיעברו לקודים אישיים.
    const legacy = c && (await getInstitutions(store)).find((x) => same(normCode(x.code), c));
    if (legacy) {
      const sub = subState(legacy, settings);
      if (sub.state === 'inactive') { await pause(); return [403, { error: 'inactive' }]; }
      if (sub.state === 'expired') { await pause(); return [403, { error: 'sub-expired' }]; }
      const ceiling = await getCeiling(store, legacy.name);
      const perms = PERMS.filter((p) => ceiling[p] && p !== 'lecturer');
      const token = await signToken(store, { k: 'code', c: 'LEGACY', kind: 'legacy', inst: legacy.name, perms });
      return [200, { ok: true, token, kind: 'legacy', inst: legacy.name, label: 'צוות ' + legacy.name, perms, notices: notices('staff', sub) }];
    }
    // קוד "משוב לעבודות" הכללי הישן.
    const ac = await store.get('code-academic');
    if (ac && c && same(c, normCode(ac.code))) {
      const token = await signToken(store, { k: 'code', c: 'ACADEMIC', kind: 'academic-legacy', inst: '', perms: ['academic'] });
      return [200, { ok: true, token, kind: 'academic-legacy', inst: '', label: 'משוב לעבודות', perms: ['academic'], notices: [] }];
    }
    await pause(); return [403, { error: 'wrong' }];
  }

  if (action === 'login') {
    const { kind, secret } = body;
    let ok = false;
    // הסיסמה המשותפת הישנה של מנהלות מוסדות בוטלה — לכל מוסד קוד מנהל/ת משלו.
    if (kind === 'sys') ok = await checkPassword(store, kind, secret);
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
  if (action === 'listGet' || action === 'listAdd' || action === 'listRemove') return handleLists(store, body);
  if (action === 'fbSubmit' || action === 'fbList' || action === 'fbDelete') return handleFeedbackInbox(store, body);

  const sysTok = await verifyToken(store, body?.token);
  const isSys = (sysTok && sysTok.k === 'sys') || await checkPassword(store, 'sys', body?.auth);

  if (['renewRequest', 'codesList', 'codeCreate', 'codeRevoke', 'codeUse', 'setSubscription', 'renewSubscription',
    'getSettings', 'setSettings', 'renewList', 'renewDone', 'renewApplySystems', 'renewCreateInst', 'renewInstitutions'].includes(action)) {
    const out = await handleCodes(store, body, isSys);
    if (out) return out;
  }

  // מנהלת מוסד רואה ומחליפה את קוד המוסד שלה (גם סיסמת מנהלת המערכת מתקבלת).
  if (action === 'instGetCode' || action === 'instNewCode') {
    if (!isSys) { await pause(); return [403, { error: 'unauthorized' }]; }
    const list = await getInstitutions(store);
    const x = list.find((i) => i.name === String(body.inst || '').trim());
    if (!x) return [404, { error: 'no such institution' }];
    if (action === 'instNewCode') { x.code = newInstCode(list); await store.set('institutions', list); }
    return [200, { name: x.name, code: x.code, active: x.active !== false }];
  }

  // כל שאר פעולות הניהול מחייבות את סיסמת מנהלת המערכת בבקשה עצמה.
  if (!isSys) { await pause(); return [403, { error: 'unauthorized' }]; }

  if (action === 'listInstitutions') return [200, { institutions: await institutionsView(store), settings: await getSettings(store) }];

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
    return [200, { institutions: await institutionsView(store) }];
  }

  // מחיקת מוסד: הרשומה, התקרה, כל הקודים שלו וכיתות החוסן שלו (עם התשובות).
  // בקשות חידוש נשארות — הן היסטוריה של פניות.
  if (action === 'deleteInstitution') {
    const list = await getInstitutions(store);
    const name = String(body.name || '').trim();
    if (!list.find((i) => i.name === name)) return [404, { error: 'no such institution' }];
    await store.set('institutions', list.filter((i) => i.name !== name));
    await store.del('modules:' + name);
    for (const c of await allCodes(store)) if (c.inst === name) await store.del('code:' + normCode(c.code));
    for (const { key, value } of await store.list('resil:')) {
      const [, id, r] = key.split(':');
      if (!r && value && value.inst === name) { await store.delPrefix('resil:' + id + ':r:'); await store.del('resil:' + id); }
    }
    return [200, { institutions: await institutionsView(store) }];
  }

  if (action === 'setModules') {
    const inst = String(body.inst || '').trim();
    const m = body.modules;
    if (!inst || !m || typeof m !== 'object') return [400, { error: 'missing fields' }];
    const safe = Object.fromEntries(PERMS.map((p) => [p, m[p] === true]));
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
