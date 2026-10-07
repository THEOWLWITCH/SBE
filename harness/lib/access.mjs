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
export const PERMS = ['fac_trainee', 'fac_parent', 'fac_youth', 'conv', 'activity', 'academic', 'lecturer', 'resilience', 'leadership', 'practi', 'journey', 'writer', 'studio', 'nana'];
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
//   צירוף הרשאות; 'student' — קוד "משוב לעבודות" שמרצה מפיק/ה לסטודנט/ית;
//   'course' — קוד "משוב לעבודות" אחד לכל הקורס (05/10/2026): seats מקומות, ולכל
//   סטודנט/ית (מזהה מכשיר sid, נרשם בהפקת המשוב הראשונה) עד usesPer הפקות —
//   taken: { [sid]: הפקות }. במקום לשלוח לכל סטודנטית קוד אחר.
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
  else if (rec.kind === 'student' || rec.kind === 'course') perms = ceiling.academic || ceiling.lecturer ? ['academic'] : [];
  else perms = (rec.perms || []).filter((p) => ceiling[p]);
  return { rec, inst: rec.inst, perms, sub };
}

// Recheck access at the moment protected Studio data or AI is used. A signed
// token proves entry, but its cached permissions do not prove a live entitlement.
export async function authorizePermission(store, token, permissions) {
  const t = await verifyToken(store, token);
  if (!t) return null;
  const wanted = (Array.isArray(permissions) ? permissions : [permissions]).filter(p => PERMS.includes(p));
  if (!wanted.length) return null;
  if (t.k === 'sys') return { ...t, perms: [...PERMS] };
  const settings = await getSettings(store);
  let live;
  if (t.k === 'code' && t.c !== 'LEGACY') {
    const rec = await store.get('code:' + t.c);
    if (!rec || rec.inst !== t.inst || rec.kind !== t.kind) return null;
    live = await resolveCode(store, rec, settings);
    if (live.error) return null;
  } else if (t.k === 'inst' || (t.k === 'code' && t.c === 'LEGACY' && t.kind === 'legacy')) {
    const inst = (await getInstitutions(store)).find(x => x.name === t.inst);
    const sub = subState(inst, settings);
    if (!inst || ['inactive', 'expired'].includes(sub.state)) return null;
    const ceiling = await getCeiling(store, inst.name);
    live = { perms: PERMS.filter(p => ceiling[p] && p !== 'lecturer') };
  } else return null;
  return wanted.some(p => live.perms.includes(p)) ? { ...t, perms: live.perms } : null;
}

// הודעות לבאנר אחרי כניסה.
function notices(kind, sub, rec) {
  const n = [];
  if (sub.state === 'grace') n.push({ level: 'danger', type: 'grace', graceEnd: sub.graceEnd, daysLeft: sub.daysLeft });
  else if (sub.state === 'warn' && (kind === 'instadmin' ? sub.daysLeft <= 60 : sub.daysLeft <= 7))
    n.push({ level: sub.daysLeft <= 7 ? 'danger' : 'warn', type: 'sub-ending', subEnd: sub.subEnd, daysLeft: sub.daysLeft });
  if (rec && rec.expiresAt && rec.kind !== 'student' && rec.kind !== 'course') {
    const left = daysBetween(today(), rec.expiresAt);
    if (left <= 7) n.push({ level: 'warn', type: 'code-ending', expiresAt: rec.expiresAt, daysLeft: left });
  }
  return n;
}

const publicCode = (r) => ({ code: r.code, kind: r.kind, inst: r.inst, perms: r.perms || [], label: r.label || '',
  createdAt: r.createdAt, expiresAt: r.expiresAt || null, uses: r.uses || 0, maxUses: r.maxUses || null,
  revoked: !!r.revoked, createdBy: r.createdBy || '',
  ...(r.kind === 'course' ? { seats: r.seats, usesPer: r.usesPer, seatsUsed: Object.keys(r.taken || {}).length } : {}) });
// מקום בקורס פנוי? (מי שכבר רשום/ה — תמיד ממשיך/ה)
const courseFull = (rec, sid) => !(sid && (rec.taken || {})[sid] !== undefined) && Object.keys(rec.taken || {}).length >= rec.seats;
const validSid = (s) => typeof s === 'string' && /^[a-f0-9]{16}$/.test(s);

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
    if (kind === 'course') {
      if (!mine || !mine.perms.includes('lecturer')) { await pause(); return [403, { error: 'unauthorized' }]; }
      const lim = settings.academic;
      const active = (await allCodes(store)).filter((c) => c.createdBy === mine.rec.code && !c.revoked
        && (!c.expiresAt || c.expiresAt >= today()) && (c.uses || 0) < (c.maxUses || Infinity)).length;
      if (active + 1 > lim.maxActive) return [429, { error: 'limit', maxActive: lim.maxActive, active }];
      const seats = Math.max(1, Math.min(Math.round(Number(body.seats)) || 40, 300));
      const days = Math.max(1, Math.min(Math.round(Number(body.days)) || 30, 180));
      const rec = { code: newCodeUnique(existing), kind, inst: mine.inst, perms: ['academic'], label: label || 'קורס',
        createdBy: mine.rec.code, createdAt: new Date().toISOString(), expiresAt: minYmd(addDays(today(), days), mine.sub.subEnd),
        seats, usesPer: lim.uses, taken: {}, uses: 0, revoked: false };
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
    if (rec.kind === 'course') {
      // ההפקות נספרות לכל סטודנט/ית בנפרד; המקום בקורס נתפס בהפקה הראשונה.
      const sid = validSid(t.s) ? t.s : null;
      if (!sid) return [403, { error: 'revoked' }];
      rec.taken = rec.taken || {};
      if (courseFull(rec, sid)) return [403, { error: 'full' }];
      const done = rec.taken[sid] || 0;
      if (done >= rec.usesPer) return [403, { error: 'used-up' }];
      rec.taken[sid] = done + 1; rec.uses = (rec.uses || 0) + 1;
      await store.set('code:' + t.c, rec);
      return [200, { ok: true, left: rec.usesPer - rec.taken[sid] }];
    }
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
// רשימות פתוחות לקהילה (חכמת ההמונים): שם הרשימה → ההרשאה שנדרשת כדי להוסיף לה.
// advisor-* — פרקטי (resilience); leader-* — נוגי (leadership). *-stmt — היגדים שאנשי חינוך מוסיפים
// לשאלון ("שם הממד|ההיגד"), ולכן ארוכים יותר.
// practi — פרקטי ככלי עצמאי (02/10/2026); גם resilience ממשיכה לפתוח את פרקטי.
const OPEN_LISTS = { 'advisor-situation': ['resilience', 'practi'], 'advisor-age': ['resilience', 'practi'], 'advisor-stmt': ['resilience', 'practi'],
  'leader-situation': 'leadership', 'leader-role': 'leadership', 'leader-stage': 'leadership', 'leader-stmt': 'leadership',
  // כתיבה מקדמת חוסן: נמענים וסוגי הודעות שאנשי חינוך מוסיפים
  'writer-aud': 'writer', 'writer-kind': 'writer',
  // ננה — מהוראה להנחיה (07/10/2026): סוגי קבוצות, גילים ומצבים שמנחים מוסיפים
  'nana-group': 'nana', 'nana-age': 'nana', 'nana-sit': 'nana' };
const LIST_ITEM_MAX = { 'advisor-stmt': 200, 'leader-stmt': 200 };
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
    const ok = isSysTok || (t && Array.isArray(t.perms) && [].concat(OPEN_LISTS[name]).some((p) => t.perms.includes(p)));
    if (!ok) { await pause(); return [403, { error: 'unauthorized' }]; }
    const value = String(body.value || '').replace(/\s+/g, ' ').trim().slice(0, LIST_ITEM_MAX[name] || ITEM_MAX);
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


// ── קריטריונים לבדיקת עבודות מהקהילה (02/10/2026) ──
// rc:items → [{ id, title, detail, cat, status:'pending'|'approved'|'rejected', reason, by, inst, code, at, decidedAt, uses }].
// כל מי שנכנס/ה עם קוד שפותח את "משוב לעבודות" (academic) מציע/ה; ההצעה מופיעה לכולם רק אחרי אישור
// של מנהלת המערכת. השרת פוסל קריטריון כפול או דומה מדי, וקריטריון שמבקש מהמערכת לכתוב במקום הכותב/ת.
export const RC_CATS = ['כללי', 'מבוא ושאלת מחקר', 'סקירת ספרות', 'שיטת מחקר', 'ממצאים', 'דיון ומסקנות', 'כתיבה אקדמית ומבנה', 'מקורות וציטוט', 'פרויקט ותוצר'];
const RC_TITLE_MAX = 80, RC_DETAIL_MAX = 400, RC_MAX = 1000, RC_PENDING_PER_CODE = 10;
const HEB = '֐-׿';
// נרמול להשוואה: בלי ניקוד וסימנים, בלי תחיליות (ו/ה/ב/ל/מ/ש/כ) במילים ארוכות, בלי מילות קישור.
const RC_STOP = new Set(['של', 'את', 'עם', 'על', 'אל', 'או', 'גם', 'כל', 'האם', 'מידת', 'רמת', 'אופן', 'בין', 'the', 'of', 'and', 'a', 'to', 'in']);
export function rcNorm(t) {
  return String(t || '').toLowerCase().replace(/[֑-ׇ]/g, '').replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/).filter(Boolean)
    .map((w) => (w.length > 3 && /^[והבלמשכ]/.test(w) ? w.slice(1) : w))
    .map((w) => w.replace(/(ים|ות)$/, (m) => (w.length > 4 ? '' : m)))
    .filter((w) => w.length > 1 && !RC_STOP.has(w));
}
function bigrams(s) { const g = new Set(); for (let i = 0; i < s.length - 1; i++) g.add(s.slice(i, i + 2)); return g; }
export function rcSimilar(a, b) {
  const A = rcNorm(a), B = rcNorm(b);
  if (!A.length || !B.length) return false;
  const ja = A.join(' '), jb = B.join(' ');
  if (ja === jb) return true;
  if (Math.min(ja.length, jb.length) >= 4 && (ja.includes(jb) || jb.includes(ja))) return true;
  const sa = new Set(A), sb = new Set(B);
  const inter = [...sa].filter((x) => sb.has(x)).length;
  if (inter / new Set([...sa, ...sb]).size >= 0.6) return true;
  const ga = bigrams(ja.replace(/ /g, '')), gb = bigrams(jb.replace(/ /g, ''));
  const gi = [...ga].filter((x) => gb.has(x)).length;
  return ga.size + gb.size > 0 && (2 * gi) / (ga.size + gb.size) >= 0.8;
}
// בקשה מהמערכת לכתוב במקום הכותב/ת ("כתבי לי את הסעיף", "נסח את המבוא", "write the chapter").
const RC_VERBS = ['כתוב', 'כתבי', 'כתבו', 'תכתוב', 'תכתבי', 'תכתבו', 'נסח', 'נסחי', 'נסחו', 'תנסח', 'תנסחי', 'חבר', 'חברי', 'תחבר', 'תחברי',
  'השלם', 'השלימי', 'תשלים', 'תשלימי', 'צור', 'צרי', 'תיצור', 'תיצרי', 'הפק', 'הפיקי', 'תפיק', 'תפיקי', 'שכתב', 'שכתבי', 'תשכתב', 'תשכתבי',
  'ערוך', 'ערכי', 'תערוך', 'תערכי', 'סכם', 'סכמי', 'תסכם', 'תסכמי', 'תקן', 'תקני', 'תתקן', 'תתקני', 'הוסף', 'הוסיפי', 'תוסיף', 'תוסיפי',
  'מלא', 'מלאי', 'תמלא', 'תמלאי', 'פתח', 'פתחי', 'תפתח', 'תפתחי', 'הרחב', 'הרחיבי', 'תרחיב', 'תרחיבי', 'בנה', 'בני', 'תבנה', 'תבני'];
const RC_PARTS = 'סעיף|הסעיף|פרק|הפרק|מבוא|המבוא|סיכום|הסיכום|דיון|הדיון|סקירה|הסקירה|סקירת|עבודה|העבודה|פסקה|הפסקה|פסקאות|תקציר|התקציר|מסקנות|המסקנות|טקסט|הטקסט|חלק|החלק|שאלת|השאלה|ביבליוגרפיה|רשימת';
const B0 = '(?<![' + HEB + '\\w])', B1 = '(?![' + HEB + '\\w])';
const RC_GHOST = [
  new RegExp(B0 + '(?:' + RC_VERBS.join('|') + ')' + B1 + '\\s+(?:לי|עבורי|בשבילי|במקומי|לנו|עבורנו)' + B1),
  new RegExp(B0 + '(?:' + RC_VERBS.join('|') + ')' + B1 + '\\s+(?:(?:את|עוד|גם)\\s+)?(?:' + RC_PARTS + ')' + B1),
  new RegExp(B0 + '(?:במקומי|במקום הכותב|במקום הכותבת|במקום הסטודנט|במקום הסטודנטית)' + B1),
  /\b(?:write|rewrite|compose|generate|draft)\b[^.]{0,40}\b(?:for me|my|the (?:section|chapter|paragraph|introduction|essay|summary|conclusion))\b/i,
];
export function rcGhostwrite(t) { const s = String(t || '').replace(/\s+/g, ' '); return RC_GHOST.some((r) => r.test(s)); }
// התראה למנהלת המערכת (02/10/2026) — לא חוסמת ולא מפילה את הבקשה אם נכשלה.
// פוש לנייד דרך ntfy.sh (חינם, בלי חשבון): משתנה הסביבה NTFY_TOPIC = שם הערוץ שנרשמים אליו באפליקציה.
// טלגרם (חינם, בלי פרסומות): TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID.
// וואטסאפ דרך CallMeBot (חינם לשימוש אישי, שירות לא רשמי): WHATSAPP_PHONE + CALLMEBOT_APIKEY.
// מייל דרך Resend (חינם עד 3,000 בחודש): RESEND_API_KEY + NOTIFY_EMAIL. בלי המשתנים — אין התראה.
// השולח: NOTIFY_FROM (למשל "Begood <noreply@be-good.co.il>", אחרי אימות הדומיין ב-Resend); ברירת מחדל — הכתובת הזמנית של Resend.
// detail — פרטים מלאים (למשל תוכן פנייה ופרטי קשר): נשלחים רק במייל, לא בערוצי הצ'אט.
export function notifyAdmin(title, message, link, detail) {
  const env = (typeof process !== 'undefined' && process.env) || {};
  const jobs = [];
  if (env.NTFY_TOPIC) {
    jobs.push(fetch('https://ntfy.sh/' + encodeURIComponent(env.NTFY_TOPIC), { method: 'POST',
      headers: { Title: 'Begood', Tags: 'bell', ...(link ? { Click: link } : {}) }, body: title + '\n' + message }));
  }
  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
    jobs.push(fetch('https://api.telegram.org/bot' + env.TELEGRAM_BOT_TOKEN + '/sendMessage', { method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: 'Begood — ' + title + '\n' + message + (link ? '\n' + link : '') }) }));
  }
  if (env.WHATSAPP_PHONE && env.CALLMEBOT_APIKEY) {
    const q = new URLSearchParams({ phone: env.WHATSAPP_PHONE, apikey: env.CALLMEBOT_APIKEY,
      text: 'Begood — ' + title + '\n' + message + (link ? '\n' + link : '') });
    jobs.push(fetch('https://api.callmebot.com/whatsapp.php?' + q.toString()));
  }
  if (env.RESEND_API_KEY && env.NOTIFY_EMAIL) {
    jobs.push(fetch('https://api.resend.com/emails', { method: 'POST',
      headers: { authorization: 'Bearer ' + env.RESEND_API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ from: env.NOTIFY_FROM || 'Begood <onboarding@resend.dev>', to: [env.NOTIFY_EMAIL], subject: 'Begood — ' + title,
        text: message + (detail ? '\n\n' + detail : '') + (link ? '\n\n' + link : '') }) }));
  }
  return Promise.allSettled(jobs);
}
const ADMIN_URL = (((typeof process !== 'undefined' && process.env.CORS_ORIGIN) || 'https://s-b-e.netlify.app').split(',')[0].trim().replace(/\/$/, '')) + '/admin.html';
// מייל למשתתפי מסע אל החוסן (04/10/2026) — רק בהסכמה (j.contact.updates), לא במסעות דמו, ורק כשיש
// שולח מאומת (NOTIFY_FROM בדומיין be-good.co.il; הכתובת הזמנית של Resend שולחת רק לבעלת החשבון).
// כתוב ברוח השפה המחזקת: חם, ענייני, מה כבר קיים ומה הצעד הבא, הזמנה לשותפות. בלי "איחור".
const SITE_URL = (((typeof process !== 'undefined' && process.env.CORS_ORIGIN) || 'https://s-b-e.netlify.app').split(',')[0].trim().replace(/\/$/, ''));
const JR_EMAIL_RE = /^[^\s@<>]{1,64}@[^\s@<>]{1,190}\.[a-z]{2,24}$/i;
const jrEsc = (x) => String(x == null ? '' : x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export function notifyParticipant(j, subject, paras, link, linkText) {
  const env = (typeof process !== 'undefined' && process.env) || {};
  const to = j && j.contact && j.contact.updates && j.contact.email;
  if (!to || j.demo || !JR_EMAIL_RE.test(to) || !env.RESEND_API_KEY || !env.NOTIFY_FROM) return Promise.resolve(false);
  const own = SITE_URL + '/journey.html#' + j.id;
  const foot = 'קיבלתם את המייל כי ביקשתם עדכונים על "' + j.unitName + '" במסע אל החוסן. אפשר להפסיק בכל רגע במסך המסע.';
  const text = ['שלום ' + (j.by || 'לכם') + ',', ...paras, link ? (linkText || 'לצפייה') + ': ' + link : '', 'למסך המסע: ' + own, '',
    'ד״ר יעל שדה · Begood · חוסן · קהילה · חינוך', '', foot].filter((x) => x !== '').join('\n\n');
  const btn = (href, label) => '<a href="' + jrEsc(href) + '" style="display:inline-block;background:#1F4E6B;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:700;margin:6px 0 6px 8px">' + jrEsc(label) + '</a>';
  const html = '<div dir="rtl" style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.7;color:#14212B;max-width:560px">' +
    '<p>שלום ' + jrEsc(j.by || 'לכם') + ',</p>' + paras.map((p) => '<p>' + jrEsc(p).replace(/\n/g, '<br>') + '</p>').join('') +
    '<p>' + (link ? btn(link, linkText || 'לצפייה') : '') + btn(own, 'למסך המסע') + '</p>' +
    '<p style="color:#2F7D7A;font-weight:700">ד״ר יעל שדה · Begood<br><span style="font-weight:400">חוסן · קהילה · חינוך</span></p>' +
    '<p style="font-size:12.5px;color:#5B6873;border-top:1px solid #ddd;padding-top:8px">' + jrEsc(foot) + '</p></div>';
  return fetch('https://api.resend.com/emails', { method: 'POST', headers: { authorization: 'Bearer ' + env.RESEND_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ from: env.NOTIFY_FROM, to: [to], subject: 'מסע אל החוסן — ' + subject, text, html }) }).then((r) => r.ok).catch(() => false);
}
// תאריך בסגנון הישראלי 06.10.26 (06/10/2026)
const jrFmt = (d) => String(d || '').slice(0, 10).split('-').reverse().map((x, i) => (i === 2 ? x.slice(2) : x)).join('.');
const jrContact = (body) => { const e = String(body.email || '').trim().slice(0, 254); return { email: JR_EMAIL_RE.test(e) ? e : '', updates: !!body.updates && JR_EMAIL_RE.test(e), at: new Date().toISOString() }; };
const rcPublic = (x) => ({ id: x.id, title: x.title, detail: x.detail || '', cat: x.cat, uses: x.uses || 0 });

async function handleReviewCriteria(store, body) {
  const { action } = body;
  const items = (await store.get('rc:items')) || [];
  if (action === 'critList') {
    return [200, { cats: RC_CATS, items: items.filter((x) => x.status === 'approved').map(rcPublic).sort((a, b) => b.uses - a.uses) }];
  }
  const t = await verifyToken(store, body.token);
  const isSys = (t && t.k === 'sys') || await checkPassword(store, 'sys', body.auth);
  const canUse = isSys || (t && Array.isArray(t.perms) && t.perms.includes('academic'));
  if (action === 'critPropose') {
    if (!canUse) { await pause(); return [403, { error: 'unauthorized' }]; }
    const title = String(body.title || '').replace(/\s+/g, ' ').trim();
    const detail = String(body.detail || '').replace(/\s+/g, ' ').trim();
    if (title.length < 3) return [400, { error: 'too short' }];
    if (title.length > RC_TITLE_MAX || detail.length > RC_DETAIL_MAX) return [400, { error: 'too long', max: { title: RC_TITLE_MAX, detail: RC_DETAIL_MAX } }];
    if (rcGhostwrite(title) || rcGhostwrite(detail)) return [422, { error: 'ghostwrite' }];
    const live = items.filter((x) => x.status !== 'rejected');
    const dup = live.find((x) => rcSimilar(x.title, title));
    if (dup) return [409, { error: 'duplicate', similar: dup.title, status: dup.status }];
    const code = t && t.c ? String(t.c) : 'sys';
    if (items.filter((x) => x.status === 'pending' && x.code === code).length >= RC_PENDING_PER_CODE) return [429, { error: 'too many pending' }];
    if (items.length >= RC_MAX) return [429, { error: 'full' }];
    const rec = { id: Date.now().toString(36) + randomBytes(3).toString('hex'), title, detail, cat: RC_CATS.includes(body.cat) ? body.cat : 'כללי',
      status: isSys ? 'approved' : 'pending', by: String(body.by || '').trim().slice(0, 60), inst: (t && t.inst) || '', code,
      at: new Date().toISOString(), uses: 0 };
    if (isSys) rec.decidedAt = rec.at;
    items.push(rec); await store.set('rc:items', items);
    if (rec.status === 'pending') {
      const n = items.filter((x) => x.status === 'pending').length;
      notifyAdmin('קריטריון ממתין לאישור', '"' + title + '" (' + rec.cat + ')' + (n > 1 ? '\nממתינים לאישורך: ' + n : ''), ADMIN_URL).catch(() => {});
    }
    return [200, { ok: true, id: rec.id, status: rec.status }];
  }
  if (action === 'critMine') {
    if (!t || !t.c) return [200, { items: [] }];
    const ids = Array.isArray(body.ids) ? body.ids.map(String).slice(0, 100) : null;
    return [200, { items: items.filter((x) => x.code === t.c && (!ids || ids.includes(x.id)))
      .map((x) => ({ id: x.id, title: x.title, status: x.status, reason: x.reason || '' })) }];
  }
  if (action === 'critUse') {
    if (!canUse) return [200, { ok: false }];
    const ids = new Set((Array.isArray(body.ids) ? body.ids : []).map(String).slice(0, 30));
    let n = 0; items.forEach((x) => { if (x.status === 'approved' && ids.has(x.id)) { x.uses = (x.uses || 0) + 1; n++; } });
    if (n) await store.set('rc:items', items);
    return [200, { ok: true, counted: n }];
  }
  if (!isSys) { await pause(); return [403, { error: 'unauthorized' }]; }
  if (action === 'critAdmin') {
    const approved = items.filter((x) => x.status === 'approved');
    return [200, { cats: RC_CATS, pending: items.filter((x) => x.status === 'pending').map((x) => ({ ...x,
      near: approved.filter((y) => rcSimilar(y.title, x.title) || rcNorm(y.title).some((w) => rcNorm(x.title).includes(w))).slice(0, 3).map((y) => y.title) })),
      approved: approved.sort((a, b) => (b.uses || 0) - (a.uses || 0)), rejected: items.filter((x) => x.status === 'rejected').slice(-30).reverse() }];
  }
  const id = String(body.id || '');
  const it = items.find((x) => x.id === id);
  if (!it) return [404, { error: 'not found' }];
  if (action === 'critApprove' || action === 'critReject') {
    it.status = action === 'critApprove' ? 'approved' : 'rejected';
    if (body.title && action === 'critApprove') it.title = String(body.title).replace(/\s+/g, ' ').trim().slice(0, RC_TITLE_MAX) || it.title;
    if (RC_CATS.includes(body.cat)) it.cat = body.cat;
    it.reason = action === 'critReject' ? String(body.reason || '').trim().slice(0, 200) : '';
    it.decidedAt = new Date().toISOString();
    await store.set('rc:items', items);
    return [200, { ok: true }];
  }
  if (action === 'critRemove') {
    await store.set('rc:items', items.filter((x) => x.id !== id));
    return [200, { ok: true }];
  }
  return [400, { error: 'bad action' }];
}

// ── מסע אל החוסן (02/10/2026) ──
// jr:<id> → מסע אחד: מיפוי → הצעת מסע (עם אפשרויות) → בחירות + הסבר → אישור מנהלת המערכת → אבני דרך
// (הגשה → משוב / השלמה → תעודה) → תו חוסן. הכול מתועד בתוך המערכת (שרשור לכל אבן דרך, ערעורים ובקשות דחייה).
// הבעלים — הקוד שבאסימון (t.c); הרשאה journey. מנהלת המערכת רואה הכול ומאשרת.
const JR_UNITS = ['gan', 'elem', 'sec', 'school', 'community', 'other'];
const JR_MAX_BYTES = 400000, JR_TXT = 4000;
const jrClip = (v, n) => String(v == null ? '' : v).slice(0, n || JR_TXT);
// ניקוי עמוק של אובייקט שמגיע מהדפדפן: מחרוזות מקוצרות, מספרים, מערכים ואובייקטים מוגבלים
function jrClean(v, depth = 0) {
  if (depth > 6) return null;
  if (typeof v === 'string') return jrClip(v);
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'boolean' || v == null) return v;
  if (Array.isArray(v)) return v.slice(0, 80).map((x) => jrClean(x, depth + 1));
  if (typeof v === 'object') { const o = {}; Object.keys(v).slice(0, 60).forEach((k) => { o[jrClip(k, 40)] = jrClean(v[k], depth + 1); }); return o; }
  return null;
}
const jrNow = () => new Date().toISOString();
const jrDay = (d) => new Date(d).toISOString().slice(0, 10);
function jrSummary(j) {
  const ms = j.milestones || [];
  return { id: j.id, unit: j.unit, unitName: j.unitName, by: j.by, inst: j.inst, status: j.status, created: j.created,
    startStage: j.startStage || 1, stage: j.stage || j.startStage || 1, total: ms.length,
    approved: ms.filter((m) => m.status === 'approved').length, submitted: ms.filter((m) => m.status === 'submitted').length,
    needs: ms.filter((m) => m.status === 'needs').length,
    next: (ms.find((m) => m.status !== 'approved') || {}).due || null,
    nextTitle: (ms.find((m) => m.status !== 'approved') || {}).title || '',
    obstacles: ((j.proposal || {}).fails || []).length, bridges: ms.reduce((n, m) => n + ((m.bridges || 0)), 0),
    pendingAdmin: j.status === 'review' || ms.some((m) => m.status === 'submitted') || (j.thread || []).some((x) => x.open),
    consent: !!(j.consent && j.consent.research), certs: ms.filter((m) => m.cert).length, demo: !!j.demo, mail: !!(j.contact && j.contact.updates) };
}
async function jrLoad(store, id) { return /^[a-z0-9]{6,24}$/.test(String(id || '')) ? store.get('jr:' + id) : null; }
async function jrSave(store, j) {
  j.updated = jrNow();
  if (Buffer.byteLength(JSON.stringify(j)) > JR_MAX_BYTES) return false;
  await store.set('jr:' + j.id, j); return true;
}
// השלב הנוכחי: השלב של אבן הדרך הראשונה שעוד לא הושלמה (או 5 כשהכול הושלם)
function jrStage(j) { const m = (j.milestones || []).find((x) => x.status !== 'approved'); return m ? m.stage : 5; }

async function handleJourney(store, body) {
  const { action } = body;
  const t = await verifyToken(store, body.token);
  const isSys = (t && t.k === 'sys') || await checkPassword(store, 'sys', body.auth);
  const ADMIN_J = (((typeof process !== 'undefined' && process.env.CORS_ORIGIN) || 'https://s-b-e.netlify.app').split(',')[0].trim().replace(/\/$/, '')) + '/journeys.html';

  // ── ציבורי: אימות תעודה ──
  if (action === 'jrCert') {
    const j = await jrLoad(store, body.id);
    const code = String(body.code || '');
    if (!j || !code) return [404, { error: 'not found' }];
    const ms = j.milestones || [];
    const i = ms.findIndex((m) => m.cert && m.cert.code === code);
    if (i < 0) return [404, { error: 'not found' }];
    const m = ms[i], last = ms.length && ms.every((x) => x.status === 'approved') && i === ms.length - 1;
    return [200, { unit: j.unit, unitName: j.unitName, inst: j.inst || '', title: m.title, stage: m.stage, gate: !!m.gate, n: i + 1, total: ms.length,
      at: m.cert.at, assessment: m.cert.assessment || '', progress: m.cert.progress || [], final: !!last, code }];
  }
  // ── בדיקה יומית (GitHub Actions): סיכום שבועי למנהלת המערכת ──
  if (action === 'jrTick') {
    const secret = (typeof process !== 'undefined' && process.env.CRON_SECRET) || '';
    if (!secret || body.secret !== secret) { await pause(); return [403, { error: 'unauthorized' }]; }
    const rows = (await store.list('jr:')).map((r) => r.value).filter((j) => j && !j.demo && j.status !== 'done');
    const today = jrDay(Date.now()), in14 = jrDay(Date.now() + 14 * 864e5);
    const soon = [], late = [], waiting = [];
    rows.forEach((j) => {
      const s = jrSummary(j);
      if (s.pendingAdmin) waiting.push(j.unitName);
      (j.milestones || []).filter((m) => m.status === 'open' || m.status === 'needs').forEach((m) => {
        if (m.due < today) late.push(j.unitName + ' — ' + m.title); else if (m.due <= in14) soon.push(j.unitName + ' — ' + m.title + ' (' + jrFmt(m.due) + ')');
      });
    });
    // תזכורות למשתתפים (בהסכמה): שבוע לפני המועד, ומילה חמה שלושה ימים אחריו. כל תזכורת נשלחת פעם אחת.
    const in7 = jrDay(Date.now() + 7 * 864e5), ago3 = jrDay(Date.now() - 3 * 864e5);
    let reminded = 0;
    for (const j of rows) {
      if (j.status !== 'active' || !(j.contact && j.contact.updates)) continue;
      let changed = false;
      for (const m of (j.milestones || [])) {
        if (!['open', 'needs'].includes(m.status) || !m.due) continue;
        m.remind = m.remind || {};
        if (!m.remind.week && m.due <= in7 && m.due >= today) {
          m.remind.week = jrNow(); changed = true;
          if (await notifyParticipant(j, 'אבן דרך מתקרבת', ['"' + m.title + '" מתקרבת — המועד הוא ' + jrFmt(m.due) + '.', 'מה כבר קיים אצלכם? לפעמים חצי מהדרך כבר נעשתה בלי ששמנו לב.', 'צריכים עוד זמן? אפשר לבקש דחייה במסך המסע, בלי הסברים מסובכים.'])) reminded++;
        } else if (!m.remind.rest && m.due <= ago3) {
          m.remind.rest = jrNow(); changed = true;
          if (await notifyParticipant(j, '☕ עצירת התרעננות', ['המועד של "' + m.title + '" עבר לפני כמה ימים, וזה בסדר — לפעמים הדרך מבקשת עצירה.', 'איך אפשר לעזור? אפשר להגיש את מה שכבר קיים, לבקש מועד חדש, או לכתוב לי מה מעכב. ביחד נתאים את המסלול.'])) reminded++;
        }
      }
      if (changed) await jrSave(store, j);
    }
    const st = (await store.get('jr:tick')) || {};
    const week = today.slice(0, 4) + '-' + Math.floor((Date.parse(today) / 864e5 + 4) / 7);
    let sent = false;
    if (new Date(today).getUTCDay() === 0 && st.week !== week && (soon.length || late.length || waiting.length)) {
      await notifyAdmin('מסע אל החוסן — סיכום שבועי', 'ממתינים לך: ' + waiting.length + ' · מתקרבים בשבועיים: ' + soon.length + ' · בעצירת התרעננות: ' + late.length, ADMIN_J,
        [waiting.length ? 'ממתינים לאישור או למשוב שלך:\n' + waiting.map((x) => '• ' + x).join('\n') : '', soon.length ? 'אבני דרך מתקרבות:\n' + soon.map((x) => '• ' + x).join('\n') : '',
          late.length ? 'בעצירת התרעננות (עבר המועד):\n' + late.map((x) => '• ' + x).join('\n') : ''].filter(Boolean).join('\n\n')).catch(() => {});
      await store.set('jr:tick', { week, at: jrNow() }); sent = true;
    }
    return [200, { ok: true, soon: soon.length, late: late.length, waiting: waiting.length, sent, reminded }];
  }

  const canUse = isSys || (t && Array.isArray(t.perms) && t.perms.includes('journey'));
  if (!canUse) { await pause(); return [403, { error: 'unauthorized' }]; }
  const owner = t && t.c ? String(t.c) : (isSys ? 'sys' : '');

  if (action === 'jrCreate') {
    const unit = JR_UNITS.includes(body.unit) ? body.unit : 'other';
    const unitName = jrClip(body.unitName, 80).trim();
    if (unitName.length < 2) return [400, { error: 'missing name' }];
    const mine = (await store.list('jr:')).filter((r) => r.value && r.value.code === owner).length;
    if (mine >= 10 && !isSys) return [429, { error: 'too many' }]; // מנהלת המערכת (מסעות דמו) — בלי מגבלה
    const id = Date.now().toString(36) + randomBytes(3).toString('hex');
    const j = { id, code: owner, inst: (t && t.inst) || '', by: jrClip(body.by, 60), unit, unitName, created: jrNow(), status: 'mapping', demo: !!(isSys && body.demo),
      consent: { research: !!body.research, at: jrNow() }, contact: jrContact(body), mapping: {}, thread: [], events: [] };
    await jrSave(store, j);
    return [200, { ok: true, id }];
  }
  if (action === 'jrMine') {
    const rows = (await store.list('jr:')).map((r) => r.value).filter((j) => j && j.id && (j.code === owner || isSys && body.all));
    return [200, { items: rows.map(jrSummary) }];
  }
  if (action === 'jrAll') {
    if (!isSys) { await pause(); return [403, { error: 'unauthorized' }]; }
    const rows = (await store.list('jr:')).map((r) => r.value).filter((j) => j && j.id);
    return [200, { items: rows.map(jrSummary).sort((a, b) => String(b.created).localeCompare(String(a.created))), settings: (await store.get('jr:settings')) || {} }];
  }
  if (action === 'jrSettings') {
    if (!isSys) { await pause(); return [403, { error: 'unauthorized' }]; }
    const st = jrClean(body.settings || {}); await store.set('jr:settings', st); return [200, { ok: true, settings: st }];
  }
  if (action === 'jrExport') {
    if (!isSys) { await pause(); return [403, { error: 'unauthorized' }]; }
    const rows = (await store.list('jr:')).map((r) => r.value).filter((j) => j && j.id && !j.demo && j.consent && j.consent.research);
    // שורה לכל אירוע מחקרי (בחירה, רפלקציה, תחקיר) — בלי שם המסגרת ובלי פרטים מזהים
    const out = [];
    rows.forEach((j, n) => (j.events || []).forEach((e) => out.push({ journey: 'J' + (n + 1), unit: j.unit, at: e.at, stage: e.stage || '', type: e.type, key: e.key || '', choice: e.choice || '',
      reasons: (e.reasons || []).join('; '), explain: e.explain || '', who: (e.who || []).join('; '), effect: e.effect || '', again: e.again || '', learned: e.learned || '' })));
    return [200, { rows: out }];
  }

  const j = await jrLoad(store, body.id);
  if (!j) return [404, { error: 'not found' }];
  const isOwner = j.code === owner;
  if (!isOwner && !isSys) { await pause(); return [403, { error: 'unauthorized' }]; }
  const ev = (type, data) => { j.events = (j.events || []).concat([{ at: jrNow(), type, stage: jrStage(j), ...data }]).slice(-400); };

  if (action === 'jrGet') return [200, { journey: j, settings: (await store.get('jr:settings')) || {} }];

  // ── המגישים ──
  if (isOwner || isSys) {
    if (action === 'jrSaveMapping') {
      if (!['mapping', 'proposal'].includes(j.status)) return [409, { error: 'bad state' }];
      j.mapping = jrClean(body.mapping || {}); await jrSave(store, j); return [200, { ok: true }];
    }
    if (action === 'jrSetProposal') {
      if (!['mapping', 'proposal'].includes(j.status)) return [409, { error: 'bad state' }];
      j.proposal = jrClean(body.proposal || {}); j.status = 'proposal'; j.proposalAt = jrNow();
      if (!(await jrSave(store, j))) return [413, { error: 'too large' }];
      return [200, { ok: true }];
    }
    if (action === 'jrSubmitChoices') {
      if (j.status !== 'proposal') return [409, { error: 'bad state' }];
      const choices = jrClean(body.choices || {});
      const missing = Object.keys(choices).filter((k) => !String((choices[k] || {}).explain || '').trim() && !((choices[k] || {}).reasons || []).length);
      if (!Object.keys(choices).length || missing.length) return [400, { error: 'explain required', missing }];
      j.choices = choices; j.plan = jrClean(body.plan || {}); j.startStage = Math.min(5, Math.max(1, Number(body.startStage) || 1));
      j.pace = ['fast', 'normal', 'calm'].includes(body.pace) ? body.pace : 'normal';
      j.status = 'review'; j.submittedAt = jrNow();
      Object.keys(choices).forEach((k) => ev('choice', { key: k, choice: choices[k].option, reasons: choices[k].reasons, explain: choices[k].explain, who: choices[k].who }));
      if (!(await jrSave(store, j))) return [413, { error: 'too large' }];
      (j.demo ? Promise.resolve() : notifyAdmin('מסע חדש ממתין לאישור', j.unitName + ' — הצעת המסע והבחירות חזרו אלייך', ADMIN_J + '#' + j.id)).catch(() => {});
      return [200, { ok: true }];
    }
    if (action === 'jrSubmitMilestone') {
      const i = Number(body.mi), m = (j.milestones || [])[i];
      if (j.status !== 'active' || !m || !['open', 'needs'].includes(m.status)) return [409, { error: 'bad state' }];
      const sub = jrClean(body.submission || {});
      if (String(sub.evidence || '').trim().length < 10) return [400, { error: 'evidence required' }];
      m.submissions = (m.submissions || []).concat([{ ...sub, at: jrNow() }]).slice(-5);
      m.status = 'submitted';
      if (m.gate && sub.reflection) ev('reflection', { key: 'gate-' + m.stage, effect: sub.reflection.effect, again: sub.reflection.again, learned: sub.reflection.learned });
      if (m.gate && sub.next) Object.keys(sub.next).forEach((k) => ev('choice', { key: 'next-' + k, choice: sub.next[k].option, reasons: sub.next[k].reasons, explain: sub.next[k].explain }));
      if (!(await jrSave(store, j))) return [413, { error: 'too large' }];
      if (!j.demo) notifyAdmin((m.gate ? 'שער הוגש' : 'אבן דרך הוגשה') + ' — ' + j.unitName, m.title, ADMIN_J + '#' + j.id).catch(() => {});
      return [200, { ok: true }];
    }
    if (action === 'jrPost') {
      const text = jrClip(body.text, 2000).trim();
      if (text.length < 2) return [400, { error: 'empty' }];
      const kind = isSys && (!isOwner || body.as === 'admin') ? 'reply' : (['appeal', 'extension', 'comment'].includes(body.kind) ? body.kind : 'comment');
      const mi = body.mi === null || body.mi === undefined || body.mi === '' ? null : Number(body.mi);
      j.thread = (j.thread || []).concat([{ at: jrNow(), by: kind === 'reply' ? 'admin' : 'owner', kind, mi, text, open: kind !== 'reply' }]).slice(-300);
      if (kind === 'reply') j.thread.forEach((x) => { if (x.by === 'owner' && (x.mi === mi)) x.open = false; });
      if (!(await jrSave(store, j))) return [413, { error: 'too large' }];
      if (kind === 'reply' && !isOwner) notifyParticipant(j, 'תשובה מד״ר יעל שדה', ['כתבתי לכם במסע' + (mi != null && j.milestones && j.milestones[mi] ? ', באבן הדרך "' + j.milestones[mi].title + '"' : '') + ':', text]).catch(() => {});
      if (kind !== 'reply' && !j.demo) notifyAdmin({ appeal: 'ערעור', extension: 'בקשת דחייה', comment: 'הודעה' }[kind] + ' — ' + j.unitName,
        mi != null && j.milestones && j.milestones[mi] ? j.milestones[mi].title : 'המסע', ADMIN_J + '#' + j.id, text).catch(() => {});
      return [200, { ok: true }];
    }
    if (action === 'jrContact') {
      j.contact = jrContact(body); await jrSave(store, j); return [200, { ok: true, contact: j.contact }];
    }
    if (action === 'jrFinalReflection') {
      j.final = jrClean(body.final || {}); ev('final', { learned: j.final.learned || '', explain: j.final.recommend || '' });
      await jrSave(store, j); return [200, { ok: true }];
    }
  }

  // ── מנהלת המערכת ──
  if (!isSys) { await pause(); return [403, { error: 'unauthorized' }]; }
  if (action === 'jrApprove') {
    if (j.status !== 'review') return [409, { error: 'bad state' }];
    const ms = jrClean(body.milestones || (j.plan || {}).milestones || []);
    if (!Array.isArray(ms) || !ms.length) return [400, { error: 'no milestones' }];
    j.milestones = ms.map((m) => ({ ...m, stage: Math.min(5, Math.max(1, Number(m.stage) || 1)), status: 'open', due: /^\d{4}-\d{2}-\d{2}$/.test(m.due || '') ? m.due : jrDay(Date.now() + 30 * 864e5) }));
    j.status = 'active'; j.approvedAt = jrNow(); j.adminMsg = jrClip(body.message, 3000);
    j.thread = (j.thread || []).concat([{ at: jrNow(), by: 'admin', kind: 'reply', mi: null, text: j.adminMsg || 'המסע אושר — יוצאים לדרך!', open: false }]);
    await jrSave(store, j);
    const m0 = j.milestones[0];
    notifyParticipant(j, 'המסע אושר — יוצאים לדרך!', ['הבחירות שלכם וההסברים שכתבתם עברו אצלי, והמסע של "' + j.unitName + '" אושר. 🧭',
      j.adminMsg || '', 'במסע ' + j.milestones.length + ' אבני דרך. הראשונה: "' + m0.title + '", עד ' + jrFmt(m0.due) + '.', 'אפשר להוסיף את כל המועדים ליומן ממסך המסע. אני כאן לאורך כל הדרך.'].filter(Boolean)).catch(() => {});
    return [200, { ok: true }];
  }
  if (action === 'jrReturn') {
    if (j.status !== 'review') return [409, { error: 'bad state' }];
    j.status = 'proposal';
    j.thread = (j.thread || []).concat([{ at: jrNow(), by: 'admin', kind: 'reply', mi: null, text: jrClip(body.message, 3000) || 'נשמח לעוד כמה התאמות בבחירות.', open: false }]);
    await jrSave(store, j);
    notifyParticipant(j, '🧭 מתאימים את המסלול', ['קראתי את הבחירות שלכם, ויש לי הצעה לכמה התאמות לפני שיוצאים לדרך:', j.thread[j.thread.length - 1].text, 'אפשר לעדכן את הבחירות במסך המסע.']).catch(() => {});
    return [200, { ok: true }];
  }
  if (action === 'jrReview') {
    const i = Number(body.mi), m = (j.milestones || [])[i];
    if (!m || m.status !== 'submitted') return [409, { error: 'bad state' }];
    const msg = jrClip(body.message, 3000);
    if (body.decision === 'approve') {
      m.status = 'approved'; m.approvedAt = jrNow();
      m.cert = { code: randomBytes(5).toString('hex'), at: jrNow(), assessment: jrClip(body.assessment, 1500), progress: jrClean((body.progress || []).slice(0, 10)) };
      m.bridges = Math.max(0, Number(body.bridges) || 0);
    } else { m.status = 'needs'; }
    j.thread = (j.thread || []).concat([{ at: jrNow(), by: 'admin', kind: 'reply', mi: i, text: msg || (m.status === 'approved' ? 'אבן הדרך הושלמה — כל הכבוד!' : 'השלמה קטנה בדרך.'), open: false }]);
    j.thread.forEach((x) => { if (x.by === 'owner' && x.mi === i) x.open = false; });
    j.stage = jrStage(j);
    if ((j.milestones || []).every((x) => x.status === 'approved')) { j.status = 'done'; j.doneAt = jrNow(); }
    await jrSave(store, j);
    const said = j.thread[j.thread.length - 1].text, nx = (j.milestones || []).find((x) => x.status !== 'approved');
    if (m.status === 'approved') {
      const certUrl = SITE_URL + '/journey-cert.html?id=' + j.id + '&code=' + m.cert.code;
      notifyParticipant(j, j.status === 'done' ? 'תו חוסן לקהילת חוסן 🎉' : (m.gate ? 'עברתם שער! 🎉' : 'אבן דרך הושלמה ✓'),
        [j.status === 'done' ? 'השלמתם את המסע אל החוסן, ו"' + j.unitName + '" מקבלים תו חוסן לקהילת חוסן. זו דרך שבניתם יחד, צעד אחרי צעד.' : '"' + m.title + '" הושלמה, ומחכה לכם תעודה.',
          said, nx ? 'הצעד הבא: "' + nx.title + '", עד ' + jrFmt(nx.due) + '.' : ''].filter(Boolean), certUrl, j.status === 'done' ? 'לתו החוסן' : 'לתעודה').catch(() => {});
    } else {
      notifyParticipant(j, 'השלמה קטנה בדרך', ['קראתי את מה שהגשתם ב"' + m.title + '". חסרה השלמה קטנה, ואז ממשיכים:', said, 'אפשר להגיש שוב במסך המסע. אם משהו לא ברור, כתבו לי שם.']).catch(() => {});
    }
    return [200, { ok: true, cert: m.cert || null }];
  }
  if (action === 'jrEdit') {
    const ms = jrClean(body.milestones || []);
    if (!Array.isArray(ms) || !ms.length) return [400, { error: 'no milestones' }];
    // שומרים מצב, הגשות ותעודות של אבני דרך קיימות לפי המיקום
    j.milestones = ms.map((m, i) => { const old = (j.milestones || [])[i] || {}; return { ...old, ...m, stage: Math.min(5, Math.max(1, Number(m.stage) || old.stage || 1)),
      status: old.status || 'open', submissions: old.submissions, cert: old.cert, due: /^\d{4}-\d{2}-\d{2}$/.test(m.due || '') ? m.due : (old.due || jrDay(Date.now() + 30 * 864e5)) }; });
    j.stage = jrStage(j);
    j.thread = (j.thread || []).concat([{ at: jrNow(), by: 'admin', kind: 'reply', mi: null, text: jrClip(body.message, 2000) || 'עדכנתי את אבני הדרך של המסע.', open: false }]);
    await jrSave(store, j);
    notifyParticipant(j, '🧭 אבני הדרך עודכנו', [j.thread[j.thread.length - 1].text, 'המועדים המעודכנים מופיעים במסך המסע, ואפשר להוריד אותם שוב ליומן.']).catch(() => {});
    return [200, { ok: true }];
  }
  if (action === 'jrDelete') { await store.del('jr:' + j.id); return [200, { ok: true }]; }
  return [400, { error: 'bad action' }];
}

// ── משוב הסדנה בשרת (04/10/2026) ──
// עד עכשיו המשובים נשמרו רק בדפדפן שממנו נשלחו, ומנחה שפתחה את התוצאות במכשיר אחר לא ראתה אותם.
// wf:<w> → סדנה אחת: נפתחת על ידי המנחה (wfOpen, עם אסימון), והמשתתפות שולחות אליה משוב בלי חשבון (wfSubmit),
// רק כשהסדנה קיימת ועד 400 משובים. קריאה (wfList): מנהלת המערכת — הכול; מנחה — הסדנאות שלה ושל המוסד שלה.
const WF_ROLES = ['fac', 'trainee', 'obs'];
const WF_MAX = 400;
function wfWho(t) { if (!t) return null; if (t.k === 'code' && (t.perms || []).some((p) => /^fac_/.test(p))) return { code: t.c, inst: t.inst || '' };
  if (t.k === 'code' && t.kind === 'legacy') return { code: t.c, inst: t.inst || '' }; if (t.k === 'inst') return { code: '', inst: t.inst }; return null; }
async function handleWorkshopFeedback(store, body) {
  const { action } = body;
  const w = String(body.w || '');
  const wOk = /^[a-z0-9]{8,32}$/.test(w);
  // כניסת משתתפת עם קוד הסדנה (6 ספרות) — ציבורי: מחזיר את מזהה הסדנה רק לקוד פעיל (24 שעות)
  if (action === 'wfJoin') {
    const code = String(body.code || '').replace(/\D/g, '');
    if (code.length !== 6) return [400, { error: 'bad code' }];
    const map = await store.get('wfc:' + code);
    if (!map || Date.now() - Date.parse(map.at) > 864e5) { await pause(); return [404, { error: 'no such workshop' }]; }
    const ws = await store.get('wf:' + map.w);
    if (!ws) return [404, { error: 'no such workshop' }];
    return [200, { ok: true, w: ws.w, track: ws.track || 'edu', scenario: ws.scenario || '' }];
  }
  // הגדרות טופס המשוב של סדנה (המדדים שנבחרו) — ציבורי, בלי המשובים עצמם. כך הקישור והקוד ה-QR קצרים.
  if (action === 'wfGet') {
    if (!wOk) return [400, { error: 'bad workshop' }];
    const ws = await store.get('wf:' + w);
    if (!ws) return [404, { error: 'no such workshop' }];
    return [200, { w: ws.w, m: ws.m || '', c: ws.c || '', scenario: ws.scenario || '', track: ws.track || 'edu' }];
  }
  if (action === 'wfSubmit') {
    if (!wOk) return [400, { error: 'bad workshop' }];
    const ws = await store.get('wf:' + w);
    if (!ws) return [404, { error: 'no such workshop' }];
    const role = WF_ROLES.includes(body.role) ? body.role : '';
    if (!role) return [400, { error: 'bad role' }];
    const rec = jrClean(body.record || {});
    if (Buffer.byteLength(JSON.stringify(rec)) > 12000) return [413, { error: 'too large' }];
    if ((ws.entries || []).length >= WF_MAX) return [429, { error: 'full' }];
    ws.entries = (ws.entries || []).concat([{ role, ts: Date.now(), entry: rec }]);
    await store.set('wf:' + w, ws);
    return [200, { ok: true }];
  }
  const t = await verifyToken(store, body.token);
  const isSys = (t && t.k === 'sys') || await checkPassword(store, 'sys', body.auth);
  const who = isSys ? { code: 'sys', inst: '' } : wfWho(t);
  if (!who) { await pause(); return [403, { error: 'unauthorized' }]; }
  if (action === 'wfOpen') {
    if (!wOk) return [400, { error: 'bad workshop' }];
    const old = await store.get('wf:' + w);
    if (old) return [200, { ok: true, existed: true }];
    // קוד הסדנה (6 ספרות) — ייחודי בין הסדנאות הפעילות; אם תפוס, הדפדפן מגריל קוד אחר
    const code = String(body.code || '').replace(/\D/g, '');
    if (code) {
      if (code.length !== 6) return [400, { error: 'bad code' }];
      const taken = await store.get('wfc:' + code);
      if (taken && Date.now() - Date.parse(taken.at) < 864e5) return [409, { error: 'code taken' }];
      await store.set('wfc:' + code, { w, at: new Date().toISOString() });
    }
    await store.set('wf:' + w, { w, owner: who.code, inst: jrClip(body.inst || who.inst, 120), fac: jrClip(body.fac, 80), scenario: jrClip(body.scenario, 160),
      track: ['edu', 'parents', 'youth'].includes(body.track) ? body.track : 'edu', code, m: jrClip(body.m, 600), c: jrClip(body.c, 3000),
      created: new Date().toISOString(), entries: [] });
    return [200, { ok: true }];
  }
  if (action === 'wfList') {
    const rows = (await store.list('wf:')).map((r) => r.value).filter((x) => x && x.w)
      .filter((x) => isSys || (who.code && x.owner === who.code) || (who.inst && x.inst === who.inst));
    return [200, { items: rows.sort((a, b) => String(b.created).localeCompare(String(a.created))) }];
  }
  if (action === 'wfDelete') {
    const x = wOk && await store.get('wf:' + w);
    if (!x) return [404, { error: 'not found' }];
    if (!isSys && x.owner !== who.code) { await pause(); return [403, { error: 'unauthorized' }]; }
    await store.del('wf:' + w); return [200, { ok: true }];
  }
  return [400, { error: 'bad action' }];
}

// ── פניות מהמשתמשים (01/10/2026): רעיונות, תקלות ושאלות מתוך פרקטי ──
// fb:<ts>-<rand> → { type, text, name, contact, source, page, at }. שליחה פתוחה
// (גם לאורחים בהתנסות הקהילה), קריאה ומחיקה — מנהלת המערכת בלבד.
const FB_TYPES = ['פנייה', 'רעיון', 'תקלה', 'שאלה', 'רעיון לשיפור', 'בקשה', 'משוב על השימוש במערכת'];
const FB_MAX = 3000;
async function handleFeedbackInbox(store, body) {
  const { action } = body;
  const clip = (v, n) => String(v || '').trim().slice(0, n);
  if (action === 'fbSubmit') {
    const text = clip(body.text, 2000);
    if (text.length < 2 || !clip(body.name, 80)) return [400, { error: 'missing fields' }];
    const keys = await store.list('fb:', { keysOnly: true });
    if (keys.length >= FB_MAX) return [429, { error: 'full' }];
    const rec = { type: FB_TYPES.includes(body.type) ? body.type : 'פנייה', text, name: clip(body.name, 80),
      contact: clip(body.contact, 120), source: clip(body.source, 40), page: clip(body.page, 80), at: new Date().toISOString() };
    await store.set('fb:' + Date.now() + '-' + randomBytes(3).toString('hex'), rec);
    notifyAdmin('פנייה חדשה — ' + rec.type, 'מ' + (rec.source || 'המערכת') + (rec.page ? ' · ' + rec.page : ''),
      ADMIN_URL, ['שם: ' + rec.name, rec.contact ? 'פרטי קשר: ' + rec.contact : '', '', rec.text].filter((x, i) => x || i === 2).join('\n')).catch(() => {});
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
      // קוד קורס: מזהה קבוע לכל מכשיר (נשמר אצל הסטודנט/ית), כדי שהמכסה תהיה אישית.
      let sid;
      if (rec.kind === 'course') {
        sid = validSid(body.sid) ? body.sid : randomBytes(8).toString('hex');
        if (courseFull(rec, sid)) { await pause(); return [403, { error: 'full' }]; }
      }
      const token = await signToken(store, { k: 'code', c, kind: rec.kind, inst: r.inst, perms: r.perms, ...(sid ? { s: sid } : {}) });
      return [200, { ok: true, token, kind: rec.kind, inst: r.inst, label: rec.label || '', perms: r.perms, ...(sid ? { sid } : {}),
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
  if (/^crit(List|Propose|Mine|Use|Admin|Approve|Reject|Remove)$/.test(action || '')) return handleReviewCriteria(store, body);
  if (/^jr[A-Z]/.test(action || '')) return handleJourney(store, body);
  if (/^wf(Open|Submit|List|Delete|Join|Get)$/.test(action || '')) return handleWorkshopFeedback(store, body);

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
