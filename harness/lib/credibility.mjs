// בדיקת אמינות של מקורות (17/11/2026): השרת של הכלי. מחקר של ד״ר איבנה ריטנר, ד״ר עינת שושן־רפאלי וד״ר יעל שדה.
// מי פונה:
//  - המרצה: כניסה עם קוד Begood עם הרשאת credibility (או dilemma). מי שפתח/ה את הפעילות, שותפים בקוד שותפות, ומנהלת המערכת.
//  - צוותים: בלי קוד Begood. סורקים את ה־QR של הכיתה (credibility-join.html?c=<קוד כיתה>), פותחים צוות (עד 10 בכיתה)
//    עם שמות המשתתפים וההסכמה של כל אחד ואחת, ומקבלים קוד צוות ומפתח שנשמר בדפדפן. אפשר להצטרף לצוות קיים
//    רק עם קוד הצוות, כך שכל אחד ואחת נכנס/ת רק לצוות שלו/ה.
// ההפרדה נאכפת כאן: צוות רואה רק את עצמו. הרפלקציות משותפות עם הצוות (17/11/2026), עם ניתוח ה־AI לפי הקריטריונים;
// הרמה המוצעת לפי המחוון מוצגת רק למרצה.
// אחסון (access_settings):
//  cra:<a>          הפעילות: הכותרת, הדילמה, הכיתות, ההגדרות, השותפים להנחיה.
//  crj:<קוד>        קוד כיתה → {a, c}.
//  crt:<a>:<t>      צוות: שם, קוד צוות, גיבוב המפתח, המשתתפים וההסכמות, ציון המרצה לפי המחוון.
//  crtc:<a>:<קוד>   קוד צוות → t.
//  crs:<a>:<t>      הבדיקות של הצוות (כל השלבים, כולל השיחה עם המודל ומקורות חיצוניים).
//  crr:<a>:<t>      העמדות הראשוניות והרפלקציות, לפי משתתף/ת.
//  crf:<a>:<fid>    קובץ שהצוות העלה.
//  crco:<קוד>       קוד שותפות → a.
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { verifyUrl } from './dilemma.mjs';
const require = createRequire(import.meta.url);
const M = require('../../app/lib/credibility-model.js');

export const CRD_JOIN_PAGE = 'credibility-join.html';
const KEEP_DAYS = 400;
const LIM = { mine: 80, classes: 12, teams: 15, members: 8, checks: 12, chat: 80, ext: 20, files: 40, text: 3000, long: 8000 };
const FILE_KINDS = [
  { re: /^(image\/(png|jpeg|webp|gif)|application\/pdf|text\/plain)$/, max: 3_000_000, t: '3 מגה' },
  { re: /^audio\/(mpeg|mp3|mp4|x-m4a|m4a|aac|ogg|wav|x-wav|webm)$/, max: 6_000_000, t: '6 מגה' },
  { re: /^video\/(mp4|webm|quicktime)$/, max: 8_000_000, t: '8 מגה' }
];
export class CrdError extends Error { constructor(msg, status = 400) { super(msg); this.status = status; } }
const hash = (v) => createHash('sha256').update(String(v)).digest('hex');
const now = () => new Date().toISOString();
const okId = (v) => typeof v === 'string' && /^[a-z0-9-]{6,40}$/.test(v);
const ALPH = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const code = (n) => { let s = ''; for (const b of randomBytes(n)) s += ALPH[b % ALPH.length]; return s; };
const sid = (p) => p + '-' + code(10).toLowerCase();
const txt = (v, label, max = LIM.text, required = false) => {
  const s = String(v == null ? '' : v).replace(/\u0000/g, '').trim();
  if (required && !s) throw new CrdError('אפשר למלא: ' + label);
  if (s.length > max) throw new CrdError(label + ': הטקסט ארוך מדי');
  return s;
};
const httpUrl = (u) => { const s = String(u || '').trim(); if (!s) return ''; if (!/^https?:\/\/[^\s<>"]{3,}$/i.test(s) || s.length > 800) throw new CrdError('הקישור אינו תקין'); return s; };
const clean = (o, n = 20000) => { try { const s = JSON.stringify(o == null ? null : o); return s.length > n ? null : JSON.parse(s); } catch { return null; } };

const locks = new Map();
function locked(k, fn) {
  const prev = locks.get(k) || Promise.resolve();
  const run = prev.catch(() => {}).then(fn);
  const tail = run.catch(() => {});
  locks.set(k, tail); tail.then(() => { if (locks.get(k) === tail) locks.delete(k); });
  return run;
}
async function mutate(store, key, fn, init) {
  return locked(key, async () => {
    for (let i = 0; i < 6; i++) {
      const cur = await store.get(key);
      const base = cur ? structuredClone(cur) : (init ? init() : null);
      if (!base) throw new CrdError('לא נמצא', 404);
      const out = await fn(base);
      const next = out === undefined ? base : out;
      const rev = cur && Number.isInteger(cur.revision) ? cur.revision : null;
      next.revision = (rev ?? 0) + 1;
      if (typeof store.compareSet === 'function') { if (await store.compareSet(key, cur ? (rev ?? 0) : null, next)) return next; continue; }
      await store.set(key, next); return next;
    }
    throw new CrdError('המידע עודכן בדיוק עכשיו. אפשר לנסות שוב', 409);
  });
}
const expired = (a) => !a || Date.parse(a.createdAt) + KEEP_DAYS * 86400000 < Date.now();
async function getActivity(store, id) {
  if (!okId(id)) throw new CrdError('הפעילות לא נמצאה', 404);
  const a = await store.get('cra:' + id);
  if (!a || expired(a)) throw new CrdError('הפעילות לא נמצאה', 404);
  return a;
}
function checkFile(d) {
  const data = String(d.data || ''), type = String(d.type || '').toLowerCase();
  const k = FILE_KINDS.find((x) => x.re.test(type));
  if (!k) throw new CrdError('אפשר להעלות תמונה, וידאו, הקלטת קול, PDF או קובץ טקסט');
  if (!/^[A-Za-z0-9+/=]+$/.test(data)) throw new CrdError('הקובץ אינו תקין');
  if (data.length * 0.75 > k.max) throw new CrdError('הקובץ גדול מדי (עד ' + k.t + ')', 413);
  return { data, type, size: Math.round(data.length * 0.75) };
}
const publicActivity = (a, c) => ({ id: a.id, title: a.title, dilemma: a.dilemma, status: a.status, research: !!a.research.enabled, reflectOpen: a.reflectOpen !== false,
  class: c ? { id: c.id, name: c.name } : null, consent: { ...M.CONSENT, ethics: a.research.ethics || '', contact: a.research.contact || '' } });
const teamView = (t) => ({ id: t.id, name: t.name, code: t.tcode, classId: t.classId, members: t.members.map((m) => ({ id: m.id, name: m.name, consent: m.consent })), workOpen: !!t.workOpen, createdAt: t.createdAt });

// ההסכמה (17/11/2026: "יש לחתום על הסכמה אבל לא לכתוב במצגת שזה לבחירה - המנחות יפתרו בעיות נקודתיות"):
// בצוות כל משתתף/ת חותם/ת על ההסכמה (research). "רק ללמידה" הוא חריג שרק המנחה מסמנת (f.teamEdit),
// והוא נשמר כשהצוות שומר שוב את רשימת המשתתפים.
function members(list, old, byFac = false) {
  const arr = (Array.isArray(list) ? list : []).slice(0, LIM.members);
  const out = arr.map((m) => {
    const prev = old && m && m.id ? old.find((x) => x.id === m.id) : null;
    let consent = m && ['research', 'learning'].includes(m.consent) ? m.consent : null;
    if (!byFac && consent === 'learning') consent = prev && prev.consent === 'learning' ? 'learning' : null;
    if (!byFac && prev && prev.consent === 'learning') consent = 'learning';
    if (!consent) throw new CrdError('כדי להמשיך, כל משתתף/ת חותם/ת על ההסכמה');
    const name = txt(m && m.name, 'שם המשתתף/ת', 80, true);
    const rec = { id: prev ? prev.id : sid('m'), name, consent, at: prev && prev.consent === consent ? prev.at : now(), history: prev ? prev.history || [] : [] };
    if (!prev || prev.consent !== consent) rec.history = rec.history.concat([{ consent, at: rec.at }]).slice(-10);
    return rec;
  });
  if (!out.length) throw new CrdError('אפשר לכתוב לפחות שם אחד');
  return out;
}

// ── בדיקה של מקור: כל השלבים נשמרים, עם חותמות זמן (לניתוח המחקר) ──
function newCheck(d) {
  const url = httpUrl(d.url);
  if (!url && !d.fileId) throw new CrdError('אפשר להעלות קובץ או להדביק קישור');
  return { id: sid('k'), title: txt(d.title, 'שם המקור', 200) || (d.fileName ? String(d.fileName).slice(0, 200) : url.slice(0, 200)),
    url, fileId: d.fileId && okId(d.fileId) ? d.fileId : '', fileName: txt(d.fileName, 'שם הקובץ', 200), fileType: txt(d.fileType, 'סוג הקובץ', 80),
    bank: /^[a-z]\d{1,2}$/.test(String(d.bank || '')) ? String(d.bank) : '',
    verify: null, seen: '', fields: {}, extra: [], first: null, chat: [], external: [], done: null, team: null, final: null, at: now(), log: [] };
}
const stamp = (k, kind, by) => { k.log.push({ at: now(), kind, by: by || null }); if (k.log.length > 400) k.log.shift(); };

async function teamOf(store, body) {
  const a = await getActivity(store, body.a);
  const t0 = String(body.t || ''), key = typeof body.key === 'string' && /^[a-f0-9]{48}$/.test(body.key) ? body.key : '';
  const t = okId(t0) && key ? await store.get('crt:' + a.id + ':' + t0) : null;
  if (!t || !(t.keys || [t.keyHash]).includes(hash(key))) throw new CrdError('כדי להמשיך, אפשר להיכנס שוב עם קוד הכיתה וקוד הצוות', 401);
  if (!a.classes.some((c) => c.id === t.classId)) throw new CrdError('הכיתה הזו כבר לא פעילה', 403);
  return { a, t };
}
export async function crdModelGate(store, auth, page) {
  if (page !== CRD_JOIN_PAGE || !auth || typeof auth.crd !== 'object') return null;
  try {
    const { a, t } = await teamOf(store, auth.crd);
    if (a.status !== 'open') return null;
    return { principal: 'crd:' + a.id + ':' + t.id, institution: 'crd:' + a.id + ':' + t.id, inst: a.inst || null };
  } catch { return null; }
}

async function newJoinCode(store) {
  for (let i = 0; i < 20; i++) { const c = code(8); if (!(await store.get('crj:' + c))) return c; }
  throw new CrdError('לא ניתן להפיק קוד כרגע. אפשר לנסות שוב', 503);
}
async function teamsOf(store, a) { return (await store.list('crt:' + a.id + ':')).map((r) => r.value).filter(Boolean); }

// הרפלקציה כפי שהצוות רואה אותה: הטקסט והניתוח, בלי הרמה המוצעת (היא רק למרצה).
function teamReflection(r) {
  r = r || {};
  const ai = r.ai ? { criteria: r.ai.criteria, strength: r.ai.strength, question: r.ai.question, at: r.ai.at } : null;
  return { initial: r.initial || null, reflect: r.reflect || null, ai, pre: !!r.pre, post: !!r.post };
}
// סיכום בדיקה למרצה ולממצאים
function checkSummary(k) {
  return { id: k.id, title: k.title, url: k.url, fileName: k.fileName, fileType: k.fileType, bank: k.bank || '', at: k.at,
    first: k.first ? k.first.score : undefined, team: k.team ? k.team.score : undefined, final: k.final ? k.final.score : undefined,
    ext: k.external.length, extKinds: [...new Set(k.external.map((e) => e.kind))], turns: k.chat.filter((m) => m.role === 'team').length, done: !!k.done };
}

export async function handleCredibility(store, body, { who, fetchImpl, resolve } = {}) {
  try {
    if (body.action !== 'crdCall') throw new CrdError('פעולה אינה נתמכת', 405);
    if (JSON.stringify(body.input || {}).length > 12_000_000) throw new CrdError('הבקשה גדולה מדי', 413);
    const op = String(body.op || '');
    const d = body.input && typeof body.input === 'object' && !Array.isArray(body.input) ? body.input : {};

    // ════════ המרצות ════════
    if (op.startsWith('f.')) {
      const me = await who(body.token);
      if (!me) throw new CrdError('כדי להמשיך, אפשר להיכנס שוב עם קוד שיש בו את הכלי בדיקת אמינות של מקורות', 401);
      const owns = (a) => me.sys || a.owner === me.principal || (a.cofacs || []).some((c) => c.principal === me.principal);
      const mine = async (id) => { const a = await getActivity(store, id); if (!owns(a)) throw new CrdError('הפעילות לא נמצאה', 404); return a; };
      const saveAct = (id, fn) => mutate(store, 'cra:' + id, async (a) => { if (!owns(a)) throw new CrdError('הפעילות לא נמצאה', 404); a.updatedAt = now(); return fn(a); });
      const view = (a) => ({ ...a, coCode: a.owner === me.principal || me.sys ? a.coCode || '' : '', cofacs: (a.cofacs || []).length, owner: undefined, isOwner: me.sys || a.owner === me.principal });

      if (op === 'f.mine') {
        const rows = (await store.list('cra:')).map((r) => r.value).filter((a) => a && !expired(a) && owns(a))
          .sort((x, y) => String(y.updatedAt).localeCompare(String(x.updatedAt))).slice(0, LIM.mine)
          .map((a) => ({ id: a.id, title: a.title, status: a.status, classes: a.classes.map((c) => c.name), updatedAt: a.updatedAt, co: a.owner !== me.principal && !me.sys }));
        return [200, { activities: rows }];
      }
      if (op === 'f.create') {
        const n = (await store.list('cra:')).filter((r) => r.value && r.value.owner === me.principal && !expired(r.value)).length;
        if (n >= LIM.mine) throw new CrdError('יש כבר הרבה פעילויות. אפשר למחוק פעילויות ישנות', 429);
        const a = { id: randomUUID(), owner: me.principal, inst: me.inst || null, status: 'open', createdAt: now(), updatedAt: now(),
          title: txt(d.title, 'שם הפעילות', 200, true), dilemma: txt(d.dilemma, 'הדילמה', LIM.text),
          research: { enabled: d.research !== false, ethics: txt(d.ethics, 'אישור האתיקה', 200), contact: txt(d.contact, 'פרטי קשר', 400) }, classes: [], cofacs: [] };
        await store.set('cra:' + a.id, a);
        return [201, { activity: view(a) }];
      }
      if (op === 'f.get') {
        const a = await mine(d.id);
        const teams = await teamsOf(store, a);
        const out = [];
        for (const t of teams) {
          const ks = (await store.get('crs:' + a.id + ':' + t.id)) || { checks: [] };
          const rr = (await store.get('crr:' + a.id + ':' + t.id)) || { members: {} };
          out.push({ ...teamView(t), grade: t.grade || null, checks: ks.checks.map(checkSummary),
            reflections: t.members.map((m) => ({ id: m.id, initial: !!(rr.members[m.id] || {}).initial, reflect: !!(rr.members[m.id] || {}).reflect, ai: !!(rr.members[m.id] || {}).ai, pre: !!(rr.members[m.id] || {}).pre, post: !!(rr.members[m.id] || {}).post })) });
        }
        return [200, { activity: view(a), teams: out }];
      }
      if (op === 'f.team') {
        const a = await mine(d.id);
        const t = await store.get('crt:' + a.id + ':' + d.teamId);
        if (!t) throw new CrdError('הצוות לא נמצא', 404);
        const ks = (await store.get('crs:' + a.id + ':' + t.id)) || { checks: [] };
        const rr = (await store.get('crr:' + a.id + ':' + t.id)) || { members: {} };
        return [200, { team: { ...teamView(t), grade: t.grade || null }, checks: ks.checks, reflections: rr.members }];
      }
      if (op === 'f.update') {
        const a = await saveAct(d.id, (a) => {
          if (d.title !== undefined) a.title = txt(d.title, 'שם הפעילות', 200, true);
          if (d.dilemma !== undefined) a.dilemma = txt(d.dilemma, 'הדילמה', LIM.text);
          if (typeof d.reflectOpen === 'boolean') a.reflectOpen = d.reflectOpen;
          if (d.research && typeof d.research === 'object') {
            if (typeof d.research.enabled === 'boolean') a.research.enabled = d.research.enabled;
            if (d.research.ethics !== undefined) a.research.ethics = txt(d.research.ethics, 'אישור האתיקה', 200);
            if (d.research.contact !== undefined) a.research.contact = txt(d.research.contact, 'פרטי קשר', 400);
          }
        });
        return [200, { activity: view(a) }];
      }
      if (op === 'f.status') {
        if (!['open', 'closed'].includes(d.status)) throw new CrdError('מצב לא תקין');
        const a = await saveAct(d.id, (a) => { a.status = d.status; });
        return [200, { activity: view(a) }];
      }
      if (op === 'f.classAdd') {
        const jc = await newJoinCode(store); let cls;
        const a = await saveAct(d.id, (a) => {
          if (a.classes.length >= LIM.classes) throw new CrdError('הגענו למספר הכיתות המרבי');
          cls = { id: sid('c'), name: txt(d.name, 'שם הכיתה', 120, true), code: jc, createdAt: now() };
          a.classes.push(cls);
        });
        await store.set('crj:' + jc, { a: a.id, c: cls.id });
        let a2 = a;
        if (a.classes.length >= 2 && !a.allCode) {
          const ac = await newJoinCode(store);
          a2 = await saveAct(d.id, (x) => { if (!x.allCode) x.allCode = ac; });
          if (a2.allCode === ac) await store.set('crj:' + ac, { a: a.id, all: true });
        }
        return [200, { activity: view(a2), class: cls }];
      }
      if (op === 'f.classCode') {
        const jc = await newJoinCode(store); let old;
        const a = await saveAct(d.id, (a) => { const c = a.classes.find((x) => x.id === d.classId); if (!c) throw new CrdError('הכיתה לא נמצאה', 404); old = c.code; c.code = jc; });
        await store.del('crj:' + old); await store.set('crj:' + jc, { a: a.id, c: d.classId });
        return [200, { activity: view(a) }];
      }
      if (op === 'f.allCode') {
        const jc = await newJoinCode(store); let old;
        const a = await saveAct(d.id, (a) => { old = a.allCode; a.allCode = jc; });
        if (old) await store.del('crj:' + old);
        await store.set('crj:' + jc, { a: a.id, all: true });
        return [200, { activity: view(a) }];
      }
      // צוותים מוכנים מראש (26/11/2026: "לכל כיתה תפיק 7 צוותים - קודים פשוטים של 3 ספרות - ספרה ראשונה
      // מציינת מכללה - ספרה שניה מסמנת כיתה וספרה שלישית היא מספר הצוות"): צוות 1 עד n, קוד <מכללה><כיתה><צוות>.
      // הצוות ריק, ומי שמצטרף/ת עם הקוד נוסף/ה אליו לפי ראשי התיבות
      if (op === 'f.teamsMake') {
        const a = await mine(d.id);
        const c = a.classes.find((x) => x.id === d.classId); if (!c) throw new CrdError('הכיתה לא נמצאה', 404);
        const col = String(d.college || ''), cl = String(d.cls || ''), n = Math.min(Number(d.n) || 7, LIM.teams);
        if (!/^[1-9]$/.test(col) || !/^[1-9]$/.test(cl)) throw new CrdError('ספרת המכללה וספרת הכיתה: מספר אחד מ־1 עד 9');
        const teams = (await teamsOf(store, a)).filter((t) => t.classId === c.id);
        const made = [];
        for (let i = 1; i <= n; i++) {
          const tc = col + cl + i, name = 'צוות ' + i;
          const hit = await store.get('crtc:' + a.id + ':' + tc);
          if (hit) { const ex = await store.get('crt:' + a.id + ':' + hit.t); if (ex && ex.classId === c.id) continue; throw new CrdError('הקוד ' + tc + ' כבר שייך לכיתה אחרת בפעילות. אפשר לבחור ספרת כיתה אחרת', 409); }
          if (teams.length + made.length >= LIM.teams) throw new CrdError('בכיתה הזו כבר יש ' + LIM.teams + ' צוותים', 409);
          const t = { id: sid('t'), classId: c.id, name: teams.some((x) => x.name === name) ? name + ' (' + tc + ')' : name, tcode: tc, keyHash: null, keys: [], members: [], premade: true, createdAt: now() };
          await store.set('crt:' + a.id + ':' + t.id, t); await store.set('crtc:' + a.id + ':' + tc, { t: t.id }); made.push(tc);
        }
        return [200, { made }];
      }
      if (op === 'f.classEdit') {
        const a = await saveAct(d.id, (a) => { const c = a.classes.find((x) => x.id === d.classId); if (!c) throw new CrdError('הכיתה לא נמצאה', 404); c.name = txt(d.name, 'שם הכיתה', 120, true); });
        return [200, { activity: view(a) }];
      }
      if (op === 'f.teamEdit') {
        const a = await mine(d.id);
        const t = await mutate(store, 'crt:' + a.id + ':' + d.teamId, (t) => {
          if (d.name !== undefined) t.name = txt(d.name, 'שם הצוות', 80, true);
          if (d.members) t.members = members(d.members, t.members, true);
        });
        return [200, { team: teamView(t) }];
      }
      if (op === 'f.teamRemove') {
        const a = await mine(d.id);
        const t = await store.get('crt:' + a.id + ':' + d.teamId);
        if (!t) throw new CrdError('הצוות לא נמצא', 404);
        for (const r of await store.list('crf:' + a.id + ':')) if (r.value && r.value.team === t.id) await store.del(r.key);
        await store.del('crs:' + a.id + ':' + t.id); await store.del('crr:' + a.id + ':' + t.id); await store.del('crtc:' + a.id + ':' + t.tcode); await store.del('crt:' + a.id + ':' + t.id);
        return [200, { ok: true }];
      }
      if (op === 'f.grade') {
        const a = await mine(d.id);
        const g = {}; for (const c of M.GRADE.criteria) { const v = Number(d.grade && d.grade[c.k]); if ([25, 50, 75, 100].includes(v)) g[c.k] = v; }
        const t = await mutate(store, 'crt:' + a.id + ':' + d.teamId, (t) => { t.grade = { ...g, note: txt(d.note, 'הערה', 1500), total: M.gradeTotal(g), at: now() }; });
        return [200, { grade: t.grade }];
      }
      if (op === 'f.file') {
        const a = await mine(d.id);
        const f = okId(String(d.fid || '')) ? await store.get('crf:' + a.id + ':' + d.fid) : null;
        if (!f) throw new CrdError('הקובץ לא נמצא', 404);
        return [200, { type: f.type, data: f.data, name: f.name }];
      }
      if (op === 'f.coCode') {
        const a0 = await mine(d.id);
        if (!me.sys && a0.owner !== me.principal) throw new CrdError('רק מי שפתח/ה את הפעילות יכול/ה להזמין שותפים', 403);
        const c = code(10);
        const a = await saveAct(d.id, (a) => { if (a.coCode) store.del('crco:' + a.coCode); a.coCode = c; });
        await store.set('crco:' + c, { a: a.id });
        return [200, { coCode: c }];
      }
      if (op === 'f.coJoin') {
        const r = /^[A-Z0-9]{10}$/.test(String(d.code || '').toUpperCase()) ? await store.get('crco:' + String(d.code).toUpperCase()) : null;
        if (!r) throw new CrdError('קוד השותפות לא נמצא', 404);
        const a = await mutate(store, 'cra:' + r.a, (a) => { if (a.owner !== me.principal && !(a.cofacs || []).some((c) => c.principal === me.principal)) (a.cofacs = a.cofacs || []).push({ principal: me.principal, at: now() }); });
        return [200, { id: a.id, title: a.title }];
      }
      if (op === 'f.delete') {
        const a = await mine(d.id);
        if (!me.sys && a.owner !== me.principal) throw new CrdError('רק מי שפתח/ה את הפעילות יכול/ה למחוק אותה', 403);
        for (const p of ['crt:', 'crtc:', 'crs:', 'crr:', 'crf:']) for (const r of await store.list(p + a.id + ':', { keysOnly: true })) await store.del(r.key);
        for (const c of a.classes) await store.del('crj:' + c.code);
        if (a.allCode) await store.del('crj:' + a.allCode);
        if (a.coCode) await store.del('crco:' + a.coCode);
        await store.del('cra:' + a.id);
        return [200, { ok: true }];
      }
      if (op === 'f.export') {
        const a = await mine(d.id);
        return [200, await researchExport(store, a)];
      }
      throw new CrdError('פעולה לא מוכרת', 400);
    }

    // ════════ צוותים ════════
    if (op === 'p.class') {
      const r = await store.get('crj:' + String(d.code || '').toUpperCase().trim());
      if (!r) throw new CrdError('קוד הכיתה לא נמצא. אפשר לסרוק שוב את ה־QR', 404);
      const a = await getActivity(store, r.a);
      if (r.all) return [200, { pick: { title: a.title, classes: a.classes.map((x) => ({ name: x.name, code: x.code })) } }];
      const c = a.classes.find((x) => x.id === r.c);
      if (!c) throw new CrdError('הכיתה לא נמצאה', 404);
      const teams = (await teamsOf(store, a)).filter((t) => t.classId === c.id);
      return [200, { activity: publicActivity(a, c), teams: teams.map((t) => ({ name: t.name, count: t.members.length })), full: teams.length >= LIM.teams }];
    }
    if (op === 'p.teamCreate' || op === 'p.teamJoin') {
      const jc = String(d.code || '').toUpperCase().trim();
      const r = await store.get('crj:' + jc);
      if (!r || r.all) throw new CrdError('קוד הכיתה לא נמצא. אפשר לסרוק שוב את ה־QR', 404);
      const a = await getActivity(store, r.a);
      if (a.status !== 'open') throw new CrdError('הפעילות סגורה כרגע. המרצה תפתח אותה', 409);
      const key = randomBytes(24).toString('hex');
      if (op === 'p.teamJoin') {
        const tc = String(d.tcode || '').toUpperCase().trim();
        const id = /^([A-Z0-9]{6}|[1-9]{3}|[1-9]{2}1[0-5])$/.test(tc) ? await store.get('crtc:' + a.id + ':' + tc) : null;
        const t = id ? await store.get('crt:' + a.id + ':' + id.t) : null;
        if (!t || t.classId !== r.c) throw new CrdError('קוד הצוות לא נמצא בכיתה הזו', 404);
        // מי שמצטרף/ת עם ראשי התיבות שלו/ה ועוד לא ברשימת הצוות נוסף/ה אליה (בצוות מוכן מראש הרשימה מתחילה ריקה)
        const nm = String(d.name || '').trim().slice(0, 80);
        const norm = (x) => String(x || '').replace(/[\s.'"״׳-]/g, '');
        const t2 = await mutate(store, 'crt:' + a.id + ':' + t.id, (t) => {
          t.keyHash = t.keyHash || hash(key); (t.keys = t.keys || []).push(hash(key)); t.keys = t.keys.slice(-30);
          if (nm && !t.members.some((m) => norm(m.name) === norm(nm)) && t.members.length < LIM.members) {
            const at = now(); t.members.push({ id: sid('m'), name: nm, consent: 'research', at, history: [{ consent: 'research', at }] });
          }
        });
        return [200, { a: a.id, t: t.id, key, team: teamView(t2) }];
      }
      const teams = (await teamsOf(store, a)).filter((t) => t.classId === r.c);
      if (teams.length >= LIM.teams) throw new CrdError('בכיתה הזו כבר יש ' + LIM.teams + ' צוותים. אפשר להצטרף לצוות קיים עם קוד הצוות', 409);
      const name = txt(d.name, 'שם הצוות', 80, true);
      if (teams.some((t) => t.name === name)) throw new CrdError('כבר יש צוות בשם הזה. אפשר לבחור שם אחר, או להצטרף לצוות עם קוד הצוות', 409);
      let tc; for (let i = 0; i < 20; i++) { const c = code(6); if (!(await store.get('crtc:' + a.id + ':' + c))) { tc = c; break; } }
      const t = { id: sid('t'), classId: r.c, name, tcode: tc, keyHash: hash(key), keys: [hash(key)], members: members(d.members), createdAt: now() };
      await store.set('crt:' + a.id + ':' + t.id, t);
      await store.set('crtc:' + a.id + ':' + tc, { t: t.id });
      return [201, { a: a.id, t: t.id, key, team: teamView(t) }];
    }

    if (op.startsWith('p.')) {
      // מפתח: כל מכשיר שהצטרף לצוות מקבל מפתח משלו
      const a = await getActivity(store, body.a);
      const t = okId(String(body.t || '')) ? await store.get('crt:' + a.id + ':' + body.t) : null;
      const key = typeof body.key === 'string' && /^[a-f0-9]{48}$/.test(body.key) ? body.key : '';
      if (!t || !key || !(t.keys || [t.keyHash]).includes(hash(key))) throw new CrdError('כדי להמשיך, אפשר להיכנס שוב עם קוד הכיתה וקוד הצוות', 401);
      const c = a.classes.find((x) => x.id === t.classId);
      if (!c) throw new CrdError('הכיתה הזו כבר לא פעילה', 403);
      const by = typeof body.by === 'string' ? body.by.slice(0, 40) : null;
      const closedNow = a.status !== 'open';
      const KS = 'crs:' + a.id + ':' + t.id, RR = 'crr:' + a.id + ':' + t.id;

      if (op === 'p.get') {
        const ks = (await store.get(KS)) || { checks: [] };
        const rr = (await store.get(RR)) || { members: {} };
        return [200, { activity: publicActivity(a, c), team: teamView(t), checks: ks.checks.map((k) => ({ ...k, log: undefined })),
          reflections: Object.fromEntries(t.members.map((m) => [m.id, teamReflection(rr.members[m.id])])) }];
      }
      if (closedNow) throw new CrdError('הפעילות סגורה כרגע. אפשר לצפות בעבודה, אבל לא לשנות', 409);
      if (op === 'p.members') {
        const t2 = await mutate(store, 'crt:' + a.id + ':' + t.id, (t) => { t.members = members(d.members, t.members); if (d.name) t.name = txt(d.name, 'שם הצוות', 80, true); });
        return [200, { team: teamView(t2) }];
      }
      // פתיחת אזור העבודה (17/11/2026: "הוסף כפתור לפתיחת אזור העבודה"): אחרי שלפחות משתתף/ת אחד/ת מילא/ה את השאלון.
      // מי שעוד לא מילא/ה ממלא/ת במכשיר שלו/ה כשנכנס/ת
      if (op === 'p.openWork') {
        const rr0 = (await store.get(RR)) || { members: {} };
        if (!t.members.some((m) => (rr0.members[m.id] || {}).pre)) throw new CrdError('אזור העבודה נפתח אחרי שלפחות משתתף/ת אחד/ת ממלא/ת את שאלון העמדות הראשוני', 409);
        const t2 = await mutate(store, 'crt:' + a.id + ':' + t.id, (t) => { t.workOpen = true; });
        return [200, { team: teamView(t2) }];
      }
      // לפני עבודת הצוות: כל משתתף/ת חתם/ה על ההסכמה (בפתיחת הצוות) ומילא/ה את שאלון העמדות הראשוני
      if (op === 'p.upload' || op === 'p.check') {
        const rr0 = (await store.get(RR)) || { members: {} };
        const miss = t.members.filter((m) => !(rr0.members[m.id] || {}).pre);
        if (miss.length && !t.workOpen) throw new CrdError('לפני עבודת הצוות, כל משתתף/ת ממלא/ת את שאלון העמדות הראשוני. עוד לא מילאו: ' + miss.map((m) => m.name).join(', '), 409);
      }
      if (op === 'p.upload') {
        const f = checkFile(d);
        const n = (await store.list('crf:' + a.id + ':', { keysOnly: true })).length;
        if (n >= LIM.files * LIM.teams * LIM.classes) throw new CrdError('הגענו למספר הקבצים המרבי');
        const fid = sid('f');
        await store.set('crf:' + a.id + ':' + fid, { ...f, name: txt(d.name, 'שם הקובץ', 200) || 'קובץ', team: t.id, at: now() });
        return [200, { fid, name: d.name || 'קובץ', type: f.type, size: f.size }];
      }
      if (op === 'p.file') {
        const f = okId(String(d.fid || '')) ? await store.get('crf:' + a.id + ':' + d.fid) : null;
        if (!f || f.team !== t.id) throw new CrdError('הקובץ לא נמצא', 404);
        return [200, { type: f.type, data: f.data, name: f.name }];
      }
      if (op === 'p.check') {
        const kind = String(d.kind || '');
        let result = {};
        let verify = null;
        if (kind === 'new' && d.fileId) { const f = okId(String(d.fileId)) ? await store.get('crf:' + a.id + ':' + d.fileId) : null; if (!f || f.team !== t.id) throw new CrdError('הקובץ לא נמצא', 404); }
        if ((kind === 'new' && d.url) || (kind === 'ext' && d.url)) { try { verify = { ...(await verifyUrl(httpUrl(d.url), { fetchImpl, resolve })), at: now() }; } catch { verify = { status: 'unreachable', at: now() }; } }
        const ks = await mutate(store, KS, (ks) => {
          if (kind === 'new') {
            if (ks.checks.length >= LIM.checks) throw new CrdError('אפשר לבדוק עד ' + LIM.checks + ' מקורות בצוות');
            const k = newCheck(d); k.verify = verify; stamp(k, 'new', by); ks.checks.push(k); result.id = k.id; return;
          }
          const k = ks.checks.find((x) => x.id === d.id);
          if (!k) throw new CrdError('הבדיקה לא נמצאה', 404);
          // הסדר (17/11/2026): 1 תיאור וציון של הצוות · 2 בדיקת AI · 3 פריטי מידע נוספים עד "אין לנו עוד מידע" · 4 בדיקת AI חוזרת ומשוב על התהליך
          if (kind === 'fields') {
            if (k.first) throw new CrdError('תיאור המקור נשמר לפני בדיקת ה־AI. פריטים חדשים מוסיפים בשלב 3', 409);
            const f = {}; for (const x of M.FIELDS) f[x.k] = txt(d.fields && d.fields[x.k], x.t, 1500);
            k.fields = f; k.extra = (Array.isArray(d.extra) ? d.extra : []).slice(0, 3).map((x) => ({ t: txt(x && x.t, 'שאלה', 200), ph: txt(x && x.ph, 'רמז', 200), v: txt(x && x.v, 'תשובה', 1500) })).filter((x) => x.t);
            if (d.seen !== undefined) k.seen = txt(d.seen, 'מה רואים', 1500);
            if (d.title) k.title = txt(d.title, 'שם המקור', 200, true);
            stamp(k, 'fields', by);
          } else if (kind === 'ai') {
            const stage = d.stage === 'final' ? 'final' : 'first';
            if (stage === 'first' && !k.team) throw new CrdError('בדיקת ה־AI מגיעה אחרי שהצוות מילא את פרטי המקור ונתן ציון', 409);
            if (stage === 'first' && k.done) throw new CrdError('אחרי "אין לנו עוד מידע" עוברים לבדיקה החוזרת', 409);
            if (stage === 'final' && !k.done) throw new CrdError('הבדיקה החוזרת מגיעה אחרי "אין לנו עוד מידע"', 409);
            const r = M.cleanAssess(d.result, stage);
            if (!r) throw new CrdError('התשובה של המודל לא נקראה. אפשר לנסות שוב');
            r.at = now();
            if (stage === 'first') { k.firstHistory = (k.firstHistory || []).concat(k.first ? [k.first] : []).slice(-5); k.first = r; }
            else { k.finalHistory = (k.finalHistory || []).concat(k.final ? [k.final] : []).slice(-5); k.final = r; }
            stamp(k, 'ai-' + stage, by);
          } else if (kind === 'msg') {
            if (k.chat.length >= LIM.chat) throw new CrdError('השיחה ארוכה מאוד. אפשר לסכם ולעבור לשלב הבא');
            k.chat.push({ role: d.role === 'ai' ? 'ai' : 'team', text: txt(d.text, 'ההודעה', d.role === 'ai' ? 4000 : LIM.text, true), by: d.role === 'ai' ? null : by, at: now() });
            stamp(k, 'msg-' + (d.role === 'ai' ? 'ai' : 'team'), by);
          } else if (kind === 'ext') {
            if (!k.first || k.done) throw new CrdError('פריטי מידע נוספים מוסיפים אחרי בדיקת ה־AI, עד "אין לנו עוד מידע"', 409);
            if (k.external.length >= LIM.ext) throw new CrdError('הגעתם למספר המקורות החיצוניים המרבי');
            const e = { id: sid('e'), url: httpUrl(d.url), title: txt(d.title, 'שם המקור', 300), kind: M.EXT_KINDS.some((x) => x.k === d.extKind) ? d.extKind : 'other',
              found: txt(d.found, 'מה מצאתם', LIM.text, true), verify, by, at: now() };

            k.external.push(e); result.id = e.id; stamp(k, 'ext', by);
          } else if (kind === 'extDel') {
            if (k.done) throw new CrdError('אחרי "אין לנו עוד מידע" הפריטים נשמרים כמו שהם', 409);
            k.external = k.external.filter((e) => e.id !== d.extId); stamp(k, 'extDel', by);
          } else if (kind === 'done') {
            if (!k.first) throw new CrdError('"אין לנו עוד מידע" מגיע אחרי בדיקת ה־AI', 409);
            k.done = { note: txt(d.note, 'הערה', 1500), at: now(), by }; stamp(k, 'done', by);
          } else if (kind === 'reopen') {
            if (k.final) throw new CrdError('אחרי ההערכה החוזרת אי אפשר לפתוח שוב את החקירה. אפשר לפתוח בדיקה חדשה', 409);
            k.done = null; stamp(k, 'reopen', by);
          } else if (kind === 'team') {
            if (k.first) throw new CrdError('הציון של הצוות ניתן לפני בדיקת ה־AI', 409);
            if (!(k.fields && k.fields.claim)) throw new CrdError('לפני הציון, אפשר למלא את פרטי המקור. לפחות את הטענה', 409);
            const s = Number(d.score);
            if (!Number.isInteger(s) || s < 1 || s > 5) throw new CrdError('הציון הוא מספר שלם מ־1 עד 5');
            k.team = { score: s, why: txt(d.why, 'הנימוק', LIM.text, true), basis: txt(d.basis, 'על מה זה נשען', LIM.text), at: now(), by };
            stamp(k, 'team', by);
          } else if (kind === 'remove') {
            ks.checks = ks.checks.filter((x) => x.id !== k.id);
          } else throw new CrdError('פעולה לא מוכרת');
        }, () => ({ checks: [] }));
        const k = ks.checks.find((x) => x.id === (result.id && kind === 'new' ? result.id : d.id));
        return [200, { ...result, check: k ? { ...k, log: undefined } : null }];
      }
      if (op === 'p.reflect') {
        const m = t.members.find((x) => x.id === d.member);
        if (!m) throw new CrdError('אפשר לבחור את השם שלך מהרשימה', 404);
        // פתוחה מראש (26/11/2026: "פתח מראש את השאלונים"); סגורה רק כשהמרצה סגרה אותה
        if ((d.reflect || d.post !== undefined) && a.reflectOpen === false) throw new CrdError('המרצה סגרה כרגע את הרפלקציה', 409);
        await mutate(store, RR, (rr) => {
          const cur = rr.members[m.id] || {};
          for (const w of ['pre', 'post']) {
            if (d[w] === undefined) continue;
            const att = M.cleanAttitudes(d[w]);
            if (!att) throw new CrdError('כדי לשלוח, אפשר לבחור תשובה בכל אחד מההיגדים');
            cur[w] = { ...att, at: now() };
          }
          if (d.pre !== undefined && !String(d.initial || '').trim() && !(cur.initial && cur.initial.text)) throw new CrdError('כדי לשלוח, אפשר לכתוב את עמדתך לגבי ספקולציות, פייק ניוז, קונספירציות ודיסאינפורמציה');
          if (d.initial !== undefined) cur.initial = { text: txt(d.initial, M.INITIAL.t, LIM.long, true), at: now() };
          if (d.reflect) {
            const r = {};
            for (const q of M.REFLECT) {
              if (q.items) { const v = M.cleanScale(q, d.reflect[q.k]); if (!v) throw new CrdError('כדי לשלוח, אפשר לבחור תשובה בכל אחד מההיגדים: ' + q.t); r[q.k] = v; }
              else r[q.k] = q.opts ? (q.opts.some((o) => o[0] === d.reflect[q.k]) ? d.reflect[q.k] : '') : txt(d.reflect[q.k], q.t, LIM.long);
            }
            if (!r.changed) throw new CrdError('אפשר לבחור: האם חל שינוי בעמדתי - כן או לא');
            if (!cur.post) throw new CrdError('כדי לשלוח, אפשר לבחור תשובה בכל אחד מההיגדים בשאלון העמדות המסכם');
            cur.reflect = { ...r, at: now() };
            cur.ai = null;
          }
          if (d.ai !== undefined) {
            if (!cur.reflect) throw new CrdError('הניתוח נשמר אחרי שליחת הרפלקציה', 409);
            const ai = M.cleanReflectAI(d.ai);
            if (!ai) throw new CrdError('הניתוח לא נקרא. אפשר לנסות שוב');
            cur.ai = { ...ai, at: now() };
          }
          rr.members[m.id] = cur;
        }, () => ({ members: {} }));
        return [200, { ok: true }];
      }
      throw new CrdError('פעולה לא מוכרת', 400);
    }
    throw new CrdError('פעולה לא מוכרת', 400);
  } catch (e) {
    if (e instanceof CrdError) return [e.status, { error: e.message }];
    throw e;
  }
}

// ── ייצוא מחקרי: רק מי שהסכים/ה. תוצר צוותי רק אם כל חברי הצוות הסכימו. בלי שמות: קודים. ──
export async function researchExport(store, a) {
  const teams = await teamsOf(store, a), out = { activity: { id: a.id, title: a.title, dilemma: a.dilemma, exportedAt: now() }, classes: a.classes.map((c, i) => ({ id: 'C' + (i + 1), name: c.name })), teams: [] };
  const cmap = Object.fromEntries(a.classes.map((c, i) => [c.id, 'C' + (i + 1)]));
  let ti = 0;
  for (const t of teams) {
    ti++;
    const all = t.members.every((m) => m.consent === 'research');
    const ks = (await store.get('crs:' + a.id + ':' + t.id)) || { checks: [] };
    const rr = (await store.get('crr:' + a.id + ':' + t.id)) || { members: {} };
    const ppl = t.members.map((m, i) => ({ code: 'T' + ti + '-P' + (i + 1), consent: m.consent, ...(m.consent === 'research' ? { pre: (rr.members[m.id] || {}).pre || null, post: (rr.members[m.id] || {}).post || null, initial: (rr.members[m.id] || {}).initial || null, reflect: (rr.members[m.id] || {}).reflect || null, reflectAI: (rr.members[m.id] || {}).ai || null } : {}) }));
    out.teams.push({ code: 'T' + ti, class: cmap[t.classId], size: t.members.length, allConsented: all, members: ppl,
      checks: all ? ks.checks.map((k) => ({ ...k, fileId: undefined, by: undefined, log: k.log.map((l) => ({ at: l.at, kind: l.kind })), chat: k.chat.map((m) => ({ role: m.role, text: m.text, at: m.at })), external: k.external.map((e) => ({ ...e, by: undefined })) })) : null,
      summary: all ? ks.checks.map(checkSummary).map((s) => ({ ...s, fileName: undefined })) : null });
  }
  return out;
}
export function _resetCrd() { locks.clear(); }
