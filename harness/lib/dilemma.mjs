// בירור דילמות | Dilemma Inquiry (12/11/2026): השרת של הכלי.
// מי פונה:
//  - המנחה: כניסה עם קוד Begood עם הרשאת dilemma. מי שפתח/ה את הפעילות (אותו קוד) היא/הוא המנחה, מכל מכשיר.
//  - משתתפים: בלי קוד Begood. סורקים את ה־QR של הכיתה (dilemma-join.html?c=<קוד כיתה>), עוברים הסכמה מדעת,
//    ומקבלים קוד אישי אקראי ומפתח שנשמר בדפדפן. אפשר לחזור לפעילות עם קוד הכיתה והקוד האישי.
// ההפרדה נאכפת כאן, בשרת: משתתף/ת רואה רק את הפעילות, הכיתה והלוח של הקבוצה שלו/ה. כיתה לא רואה כיתה אחרת.
// התגובה האישית והרפלקציה נשמרות בנפרד (dlx:), ואינן נשלחות לאף משתתף/ת אחר/ת. ה־QR מכיל רק את קוד הכיתה.
//
// אחסון (במסד הקיים, access_settings):
//  dla:<a>          הפעילות: הדילמה, המקורות של המנחה, הכיתות והקבוצות, הגדרות המחקר וההסכמה.
//  dlj:<קוד>        קוד כיתה → {a, c}. ביטול קוד: מוחקים ומפיקים חדש.
//  dlp:<a>:<pid>    משתתף/ת: קוד אישי, גיבוב המפתח, כיתה, קבוצה, ההסכמה (גרסה, סוג, מועד) והיסטוריית ההסכמות.
//  dlpc:<a>:<קוד>   קוד אישי → pid (לחזרה לפעילות).
//  dlx:<a>:<pid>    הפרטי: תגובה אישית, רפלקציה, פעולות AI אישיות.
//  dlb:<a>:<g>      הלוח של קבוצה (g = מזהה הקבוצה, או p-<pid> במצב אישי): כרטיסים, קשרים, מקורות, הערכות אמינות,
//                   התרעות, מידע מאתגר, גרסאות שמורות, מסקנה ויומן שינויים (לניתוח המחקר, לפי ההסכמה).
//  dlf:<a>:<fid>    קובץ שהמנחה העלה/תה (עד 1 מגה).
// כתיבה ללוח: revision ו-compareSet (כמה שרתים), ולפני כן נעילה בזיכרון.
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const M = require('../../app/lib/dilemma-model.js');

export const DLM_JOIN_PAGE = 'dilemma-join.html';
const KEEP_DAYS = 400;
const LIM = { title: 200, text: 2000, long: 6000, items: 500, links: 800, sources: 150, assess: 40, alerts: 120, challenges: 30, snapshots: 12,
  events: 4000, classes: 30, groups: 40, participants: 400, mine: 80, files: 30, fileBytes: 1_000_000, actSources: 80, reports: 300 };

export class DlmError extends Error { constructor(msg, status = 400) { super(msg); this.status = status; } }
const hash = (v) => createHash('sha256').update(String(v)).digest('hex');
const newKey = () => randomBytes(24).toString('hex');
const now = () => new Date().toISOString();
const okId = (v) => typeof v === 'string' && /^[a-z0-9-]{6,40}$/.test(v);
const ALPH = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const code = (n) => { let s = ''; for (const b of randomBytes(n)) s += ALPH[b % ALPH.length]; return s; };
const txt = (v, label, max = LIM.text, required = false) => {
  const s = String(v == null ? '' : v).replace(/\u0000/g, '').trim();
  if (required && !s) throw new DlmError('אפשר למלא: ' + label);
  if (s.length > max) throw new DlmError(label + ': הטקסט ארוך מדי');
  return s;
};
const arr = (v, n) => (Array.isArray(v) ? v.slice(0, n) : []);
const httpUrl = (u) => { const s = String(u || '').trim(); if (!s) return ''; if (!/^https?:\/\/[^\s<>"]{3,}$/i.test(s) || s.length > 600) throw new DlmError('הקישור אינו תקין'); return s; };

// נעילה לכל מפתח (שתי משתתפות כותבות באותו רגע באותו שרת), ו-compareSet בין שרתים.
const locks = new Map();
function locked(k, fn) {
  const prev = locks.get(k) || Promise.resolve();
  const run = prev.catch(() => {}).then(fn);
  const tail = run.catch(() => {});
  locks.set(k, tail);
  tail.then(() => { if (locks.get(k) === tail) locks.delete(k); });
  return run;
}
async function mutate(store, key, fn, init) {
  return locked(key, async () => {
    for (let i = 0; i < 6; i++) {
      const cur = await store.get(key);
      const base = cur ? structuredClone(cur) : (init ? init() : null);
      if (!base) throw new DlmError('לא נמצא', 404);
      const out = await fn(base);
      const next = out === undefined ? base : out;
      const rev = cur && Number.isInteger(cur.revision) ? cur.revision : null;
      next.revision = (rev ?? 0) + 1;
      if (typeof store.compareSet === 'function') {
        if (await store.compareSet(key, cur ? (rev ?? 0) : null, next)) return next;
        continue;
      }
      await store.set(key, next);
      return next;
    }
    throw new DlmError('הלוח עודכן בדיוק עכשיו. אפשר לנסות שוב', 409);
  });
}
const expired = (a) => !a || Date.parse(a.createdAt) + KEEP_DAYS * 86400000 < Date.now();
async function getActivity(store, id) {
  if (!okId(id)) throw new DlmError('הפעילות לא נמצאה', 404);
  const a = await store.get('dla:' + id);
  if (!a || expired(a)) throw new DlmError('הפעילות לא נמצאה', 404);
  return a;
}

// ── הפעילות כפי שהמשתתפים רואים אותה: בלי קודי כיתה, בלי בעלים, רק הכיתה שלהם ─
function publicActivity(a, classId) {
  const c = a.classes.find((x) => x.id === classId);
  return { id: a.id, title: a.title, status: a.status, mode: a.mode, durationMin: a.durationMin, challengeMode: a.challengeMode, challengeOpen: !!a.challengeOpen,
    dilemma: a.dilemma, reflectionQs: a.reflectionQs, sources: a.sources.map(publicSource), researchEnabled: !!a.research.enabled,
    consent: consentView(a), class: c ? { id: c.id, name: c.name, groups: c.groups.map((g) => ({ id: g.id, name: g.name })) } : null };
}
function consentView(a) {
  const r = a.research || {};
  return { version: r.consentVersion || M.CONSENT_VERSION, sections: M.CONSENT.sections.map((s) => ({ k: s.k, t: s.t,
    d: (r.sections && typeof r.sections[s.k] === 'string' && r.sections[s.k].trim()) ? r.sections[s.k] : (s.k === 'who' ? M.CONSENT.researchers + ' · ' + M.CONSENT.institutions : s.k === 'contact' ? (r.contact || s.d) : s.d) })),
    ethics: r.ethics || M.CONSENT.ethics, research: M.CONSENT.research, learning: M.CONSENT.learning, note: M.CONSENT.note, recording: M.CONSENT.recording };
}
function publicSource(s) {
  return { id: s.id, origin: s.origin, title: s.title, publisher: s.publisher, date: s.date, type: s.type, url: s.url, fileId: s.fileId || '', fileName: s.fileName || '',
    excerpt: s.excerpt || '', part: s.part || '', verify: s.verify || { status: 'not_checked' }, assessments: (s.assessments || []).slice(-LIM.assess), addedAt: s.addedAt };
}

function newSource(data, origin, by) {
  const url = httpUrl(data.url);
  const s = { id: 's-' + code(10).toLowerCase(), origin: Object.hasOwn(M.ORIGINS, origin) ? origin : 'participant',
    title: txt(data.title, 'שם המקור', LIM.title, true), publisher: txt(data.publisher, 'מחבר או גוף מפרסם', LIM.title), date: txt(data.date, 'תאריך פרסום', 40),
    type: txt(data.type, 'סוג המקור', 80), url, excerpt: txt(data.excerpt, 'קטע מהמקור', LIM.long), part: txt(data.part, 'החלק במקור', 600),
    verify: { status: url ? 'not_checked' : (data.fileId ? 'file' : 'no_link') }, assessments: [], checks: [], by: by || null, addedAt: now() };
  if (data.fileId && okId(data.fileId)) { s.fileId = data.fileId; s.fileName = txt(data.fileName, 'שם הקובץ', 200); }
  return s;
}
// הערכת אמינות: ציון 0..7 או null (אפור). לא 8, 9 או 10. הערכה חדשה לא מוחקת את הקודמות (היסטוריה).
function newAssessment(data, by, role) {
  const score = data.score === null || data.score === undefined || data.score === '' ? null : Number(data.score);
  if (!M.validScore(score)) throw new DlmError('הציון הוא מספר שלם מ־0 עד 7, או "טרם נבדק"');
  return { score, claim: txt(data.claim, 'הטענה הנבדקת', 600), criteria: arr(data.criteria, 10).filter((c) => c && M.CRITERIA.some((k) => k.k === c.k)).map((c) => ({ k: c.k, note: txt(c.note, 'הערה', 500) })),
    explanation: txt(data.explanation, 'הסבר לציון', 2000, score !== null), relevance: txt(data.relevance, 'רלוונטיות', 600), limits: txt(data.limits, 'מגבלות', 600),
    method: ['ai', 'participant', 'facilitator'].includes(data.method) ? data.method : role, by: by || null, role, human: null, rubric: M.RUBRIC_VERSION, at: now() };
}

function emptyBoard(a, g) {
  return { a, g, ver: 0, items: [], links: [], sources: [], assess: {}, checks: {}, reports: [], alerts: [], challenges: [], snapshots: [], conclusion: null, events: [], createdAt: now() };
}
function log(b, kind, by, detail) {
  b.events.push({ at: now(), kind, by: by || null, ...(detail ? { detail } : {}) });
  if (b.events.length > LIM.events) b.events.splice(0, b.events.length - LIM.events);
}
const itemExists = (b, id) => b.items.some((i) => i.id === id && !i.deleted);
// מקור קיים בלוח או של המנחה.
const sourceIn = (a, b, id) => a.sources.find((s) => s.id === id) || b.sources.find((s) => s.id === id);

// ── בדיקת קישור: האם המקור קיים ונגיש (אימות קיום מקור) ──
// רק http(s), רק כתובות ציבוריות (לא localhost ולא רשתות פנימיות), עד 3 הפניות, 7 שניות, רק את הכותרת.
const PRIVATE = [/^127\./, /^10\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[01])\./, /^169\.254\./, /^0\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, /^::1$/, /^f[cd]/i, /^fe80/i, /^::ffff:(127|10|192\.168|169\.254)\./i, /^::$/];
async function publicHost(host, resolve) {
  if (!host || /^(localhost|.*\.local|.*\.internal)$/i.test(host)) return false;
  const addrs = isIP(host) ? [{ address: host }] : await resolve(host).catch(() => []);
  return addrs.length > 0 && addrs.every((x) => !PRIVATE.some((r) => r.test(x.address)));
}
export async function verifyUrl(url, { fetchImpl = fetch, resolve = (h) => lookup(h, { all: true }) } = {}) {
  let u;
  try { u = new URL(String(url)); } catch { return { status: 'not_found', note: 'הקישור אינו תקין' }; }
  for (let hop = 0; hop < 4; hop++) {
    if (!/^https?:$/.test(u.protocol)) return { status: 'not_found', note: 'רק קישורי http(s)' };
    if (!(await publicHost(u.hostname, resolve))) return { status: 'unreachable', note: 'הכתובת אינה ציבורית' };
    let r;
    try { r = await fetchImpl(u.href, { method: 'GET', redirect: 'manual', headers: { 'user-agent': 'Begood-source-check/1.0', accept: 'text/html,application/pdf,*/*' }, signal: AbortSignal.timeout(7000) }); }
    catch { return { status: 'unreachable', note: 'הקישור לא נפתח בזמן' }; }
    if (r.status >= 300 && r.status < 400 && r.headers.get('location')) {
      try { u = new URL(r.headers.get('location'), u); } catch { return { status: 'unreachable' }; }
      continue;
    }
    if (r.status === 404 || r.status === 410) return { status: 'not_found', http: r.status };
    if (r.status >= 400) return { status: r.status === 403 || r.status === 401 ? 'exists' : 'unreachable', http: r.status, note: r.status === 403 || r.status === 401 ? 'האתר קיים אך חוסם בדיקה אוטומטית. כדאי לפתוח אותו בעצמכם.' : '' };
    let title = '';
    try {
      const type = r.headers.get('content-type') || '';
      if (/html/i.test(type) && r.body) {
        const reader = r.body.getReader(); let got = '', n = 0;
        while (n < 65536) { const { done, value } = await reader.read(); if (done) break; n += value.length; got += new TextDecoder().decode(value); if (/<\/title>/i.test(got)) break; }
        try { reader.cancel(); } catch {}
        const m = got.match(/<title[^>]*>([\s\S]{1,300}?)<\/title>/i);
        if (m) title = m[1].replace(/\s+/g, ' ').trim();
      }
    } catch {}
    return { status: 'exists', http: r.status, title, finalUrl: u.href };
  }
  return { status: 'unreachable', note: 'יותר מדי הפניות' };
}

// מגבלת קצב פשוטה לבדיקת קישורים (לכל משתתף/ת), כדי שהשרת לא ישמש לסריקה.
const verifyHits = new Map();
function verifyBudget(id) {
  const t = Date.now(), list = (verifyHits.get(id) || []).filter((x) => t - x < 3600e3);
  if (list.length >= 40) return false;
  list.push(t); verifyHits.set(id, list);
  if (verifyHits.size > 5000) verifyHits.delete(verifyHits.keys().next().value);
  return true;
}

// ── מי פונה ──
async function participantOf(store, body) {
  const a = await getActivity(store, body.a);
  const pid = String(body.p || '');
  const key = typeof body.key === 'string' && /^[a-f0-9]{48}$/.test(body.key) ? body.key : '';
  const p = okId(pid) && key ? await store.get('dlp:' + a.id + ':' + pid) : null;
  if (!p || p.keyHash !== hash(key)) throw new DlmError('כדי להמשיך, אפשר להיכנס שוב עם קוד הכיתה והקוד האישי', 401);
  if (!a.classes.some((c) => c.id === p.classId)) throw new DlmError('הכיתה הזו כבר לא פעילה', 403);
  return { a, p };
}
const boardKeyOf = (a, p) => (a.mode === 'personal' ? 'p-' + p.id : p.groupId);
function participantView(a, p) {
  return { id: p.id, code: p.pcode, classId: p.classId, groupId: p.groupId, consent: p.consent, boardKey: p.groupId || a.mode === 'personal' ? boardKeyOf(a, p) : null };
}
function boardView(a, b) {
  if (!b) return null;
  const out = structuredClone(b);
  delete out.events;
  out.items = out.items.filter((i) => !i.deleted);
  out.sourcesAll = a.sources.map(publicSource).concat(out.sources.map(publicSource));
  return out;
}

// ── מודל: משתתף/ת פונה למודל רק מדף ההשתתפות, רק כשהפעילות פתוחה (נקרא מ-authorizeModel) ──
export async function dlmModelGate(store, auth, page) {
  if (page !== DLM_JOIN_PAGE || !auth || typeof auth.dlm !== 'object') return null;
  try {
    const { a, p } = await participantOf(store, auth.dlm);
    if (a.status !== 'open') return null;
    return { principal: 'dlm:' + a.id + ':' + p.id, institution: 'dlm:' + a.id, inst: a.inst || null };
  } catch { return null; }
}

// who(token) → {principal, inst, sys} או null, לפי הרשאה חיה ל-dilemma (access.mjs)
export async function handleDilemma(store, body, { who, pause = async () => {}, fetchImpl, resolve } = {}) {
  try {
    if (body.action !== 'dlmCall') throw new DlmError('פעולה אינה נתמכת', 405);
    if (JSON.stringify(body.input || {}).length > 1_600_000) throw new DlmError('הבקשה גדולה מדי', 413);
    const op = String(body.op || '');
    const d = body.input && typeof body.input === 'object' && !Array.isArray(body.input) ? body.input : {};

    // ════════ המנחה ════════
    if (op.startsWith('f.')) {
      const me = await who(body.token);
      if (!me) throw new DlmError('כדי להמשיך, אפשר להיכנס שוב עם קוד שיש בו את הכלי בירור דילמות', 401);
      const owns = (a) => me.sys || a.owner === me.principal;
      const mine = async (id) => { const a = await getActivity(store, id); if (!owns(a)) throw new DlmError('הפעילות לא נמצאה', 404); return a; };
      const saveAct = (id, fn) => mutate(store, 'dla:' + id, async (a) => { if (!owns(a)) throw new DlmError('הפעילות לא נמצאה', 404); a.updatedAt = now(); return fn(a); });

      if (op === 'f.mine') {
        const rows = (await store.list('dla:')).map((r) => r.value).filter((a) => a && !expired(a) && owns(a))
          .sort((x, y) => String(y.updatedAt).localeCompare(String(x.updatedAt))).slice(0, LIM.mine)
          .map((a) => ({ id: a.id, title: a.title, status: a.status, mode: a.mode, createdAt: a.createdAt, updatedAt: a.updatedAt, classes: a.classes.length }));
        return [200, { activities: rows }];
      }
      if (op === 'f.create') {
        const n = (await store.list('dla:')).filter((r) => r.value && r.value.owner === me.principal && !expired(r.value)).length;
        if (n >= LIM.mine) throw new DlmError('יש כבר הרבה פעילויות. אפשר למחוק פעילויות ישנות ולנסות שוב', 429);
        const t = M.TEMPLATES.find((x) => x.id === d.template);
        const a = { id: randomUUID(), owner: me.principal, inst: me.inst || null, status: 'draft', createdAt: now(), updatedAt: now(),
          title: txt(d.title || (t && t.title), 'שם הפעילות', LIM.title, true), mode: d.mode === 'personal' ? 'personal' : 'group',
          durationMin: Math.min(240, Math.max(20, Number(d.durationMin) || 90)), challengeMode: d.challengeMode === 'group' ? 'group' : 'facilitator', challengeOpen: false,
          dilemma: dilemmaOf(t ? { ...t, ...(d.dilemma || {}) } : (d.dilemma || {})), reflectionQs: M.REFLECTION_Q.slice(),
          research: { enabled: d.research !== false, consentVersion: M.CONSENT_VERSION, sections: {}, ethics: '', contact: '' },
          sources: [], classes: [], files: [] };
        if (t) for (const s of t.sources) a.sources.push(newSource(s, 'facilitator', 'facilitator'));
        await store.set('dla:' + a.id, a);
        return [201, { activity: a }];
      }
      if (op === 'f.get') {
        const a = await mine(d.id);
        const parts = (await store.list('dlp:' + a.id + ':')).map((r) => r.value).filter(Boolean);
        const stats = { participants: parts.length, research: parts.filter((p) => p.consent && p.consent.type === 'research').length,
          learning: parts.filter((p) => p.consent && p.consent.type === 'learning').length,
          byGroup: Object.fromEntries(a.classes.flatMap((c) => c.groups).map((g) => [g.id, parts.filter((p) => p.groupId === g.id).length])) };
        return [200, { activity: a, stats }];
      }
      if (op === 'f.update') {
        const a = await saveAct(d.id, (a) => {
          if (d.title !== undefined) a.title = txt(d.title, 'שם הפעילות', LIM.title, true);
          if (d.dilemma) a.dilemma = dilemmaOf({ ...a.dilemma, ...d.dilemma });
          if (d.mode) a.mode = d.mode === 'personal' ? 'personal' : 'group';
          if (d.durationMin) a.durationMin = Math.min(240, Math.max(20, Number(d.durationMin) || 90));
          if (d.challengeMode) a.challengeMode = d.challengeMode === 'group' ? 'group' : 'facilitator';
          if (typeof d.challengeOpen === 'boolean') a.challengeOpen = d.challengeOpen;
          if (Array.isArray(d.reflectionQs)) { const q = d.reflectionQs.map((x) => txt(x, 'שאלת רפלקציה', 600)).filter(Boolean).slice(0, 12); if (q.length) a.reflectionQs = q; }
          if (d.research && typeof d.research === 'object') {
            const r = a.research, before = JSON.stringify([r.sections, r.ethics, r.contact]);
            if (typeof d.research.enabled === 'boolean') r.enabled = d.research.enabled;
            if (d.research.sections && typeof d.research.sections === 'object') for (const s of M.CONSENT.sections) if (typeof d.research.sections[s.k] === 'string') r.sections[s.k] = txt(d.research.sections[s.k], s.t, 1500);
            if (d.research.ethics !== undefined) r.ethics = txt(d.research.ethics, 'אישור האתיקה', 200);
            if (d.research.contact !== undefined) r.contact = txt(d.research.contact, 'פרטי קשר', 400);
            // שינוי בנוסח ההסכמה מקבל גרסה חדשה; ההסכמות הקודמות נשארות עם הגרסה שבה ניתנו.
            if (JSON.stringify([r.sections, r.ethics, r.contact]) !== before) r.consentVersion = M.CONSENT_VERSION + '.' + Date.now().toString(36);
          }
        });
        return [200, { activity: a }];
      }
      if (op === 'f.status') {
        if (!['draft', 'open', 'closed'].includes(d.status)) throw new DlmError('מצב לא תקין');
        const a = await saveAct(d.id, (a) => {
          if (d.status === 'open' && !a.classes.length) throw new DlmError('כדי לפתוח, אפשר להוסיף כיתה אחת לפחות');
          a.status = d.status;
        });
        return [200, { activity: a }];
      }
      if (op === 'f.classAdd') {
        let jc;
        for (let i = 0; i < 20; i++) { const c = code(10); if (!(await store.get('dlj:' + c))) { jc = c; break; } }
        if (!jc) throw new DlmError('לא ניתן להפיק קוד כרגע. אפשר לנסות שוב', 503);
        let cls;
        const a = await saveAct(d.id, (a) => {
          if (a.classes.length >= LIM.classes) throw new DlmError('הגענו למספר הכיתות המרבי');
          const groups = arr(d.groups, LIM.groups).map((g) => txt(g, 'שם קבוצה', 60)).filter(Boolean);
          cls = { id: 'c-' + code(8).toLowerCase(), name: txt(d.name, 'שם הכיתה', 120, true), code: jc, createdAt: now(),
            groups: (groups.length ? groups : ['קבוצה 1', 'קבוצה 2', 'קבוצה 3', 'קבוצה 4']).map((n) => ({ id: 'g-' + code(8).toLowerCase(), name: n })) };
          a.classes.push(cls);
        });
        await store.set('dlj:' + jc, { a: a.id, c: cls.id });
        return [200, { activity: a, class: cls }];
      }
      if (op === 'f.classCode') {
        // ביטול קוד והפקת קוד חדש: הסריקה של הקוד הישן מפסיקה מיד. משתתפים שכבר נכנסו ממשיכים עם המפתח שלהם.
        let jc;
        for (let i = 0; i < 20; i++) { const c = code(10); if (!(await store.get('dlj:' + c))) { jc = c; break; } }
        let old;
        const a = await saveAct(d.id, (a) => {
          const c = a.classes.find((x) => x.id === d.classId);
          if (!c) throw new DlmError('הכיתה לא נמצאה', 404);
          old = c.code; c.code = jc;
        });
        await store.del('dlj:' + old);
        await store.set('dlj:' + jc, { a: a.id, c: d.classId });
        return [200, { activity: a }];
      }
      if (op === 'f.classEdit') {
        const a = await saveAct(d.id, (a) => {
          const c = a.classes.find((x) => x.id === d.classId);
          if (!c) throw new DlmError('הכיתה לא נמצאה', 404);
          if (d.name) c.name = txt(d.name, 'שם הכיתה', 120, true);
          if (d.addGroup) { if (c.groups.length >= LIM.groups) throw new DlmError('הגענו למספר הקבוצות המרבי'); c.groups.push({ id: 'g-' + code(8).toLowerCase(), name: txt(d.addGroup, 'שם הקבוצה', 60, true) }); }
          if (d.renameGroup) { const g = c.groups.find((x) => x.id === d.renameGroup.id); if (g) g.name = txt(d.renameGroup.name, 'שם הקבוצה', 60, true); }
        });
        return [200, { activity: a }];
      }
      if (op === 'f.sourceAdd') {
        const a = await saveAct(d.id, (a) => {
          if (a.sources.length >= LIM.actSources) throw new DlmError('הגענו למספר המקורות המרבי');
          if (d.source && d.source.fileId && !a.files.some((f) => f.id === d.source.fileId)) throw new DlmError('הקובץ לא נמצא');
          a.sources.push(newSource(d.source || {}, 'facilitator', 'facilitator'));
        });
        return [200, { activity: a }];
      }
      if (op === 'f.sourceEdit') {
        const a = await saveAct(d.id, (a) => {
          const i = a.sources.findIndex((s) => s.id === d.sourceId);
          if (i < 0) throw new DlmError('המקור לא נמצא', 404);
          if (d.remove) { a.sources.splice(i, 1); return; }
          const s = a.sources[i], n = newSource({ ...s, ...(d.source || {}) }, 'facilitator', 'facilitator');
          a.sources[i] = { ...s, title: n.title, publisher: n.publisher, date: n.date, type: n.type, excerpt: n.excerpt, part: n.part,
            ...(n.url !== s.url ? { url: n.url, verify: n.verify } : {}) };
        });
        return [200, { activity: a }];
      }
      if (op === 'f.assess') {
        // הערכת אמינות של המנחה, או סימון בדיקה אנושית להערכה קיימת (לא משנה את הציון).
        const a = await saveAct(d.id, (a) => {
          const s = a.sources.find((x) => x.id === d.sourceId);
          if (!s) throw new DlmError('המקור לא נמצא', 404);
          if (Number.isInteger(d.reviewIndex)) {
            const as = s.assessments[d.reviewIndex];
            if (!as) throw new DlmError('ההערכה לא נמצאה', 404);
            as.human = { by: 'facilitator', note: txt(d.note, 'הערה', 800), agree: d.agree !== false, at: now() };
          } else {
            s.assessments.push(newAssessment(d.assessment || {}, 'facilitator', 'facilitator'));
            if (s.assessments.length > LIM.assess) s.assessments.shift();
          }
        });
        return [200, { activity: a }];
      }
      if (op === 'f.verify') {
        const a0 = await mine(d.id);
        const s0 = a0.sources.find((x) => x.id === d.sourceId);
        if (!s0 || !s0.url) throw new DlmError('אין קישור לבדיקה');
        const v = await verifyUrl(s0.url, { fetchImpl, resolve });
        const a = await saveAct(d.id, (a) => { const s = a.sources.find((x) => x.id === d.sourceId); if (s) s.verify = { ...v, at: now() }; });
        return [200, { activity: a, verify: v }];
      }
      if (op === 'f.file') {
        // קובץ למאגר המקורות: PDF, תמונה או טקסט, עד 1 מגה (base64). נשמר בשרת לפעילות הזו בלבד.
        const data = String(d.data || '');
        if (!/^[A-Za-z0-9+/=]+$/.test(data) || data.length * 0.75 > LIM.fileBytes) throw new DlmError('הקובץ גדול מדי (עד 1 מגה) או אינו תקין', 413);
        const type = String(d.type || '');
        if (!/^(application\/pdf|image\/(png|jpeg|webp)|text\/plain)$/.test(type)) throw new DlmError('אפשר להעלות PDF, תמונה או קובץ טקסט');
        const fid = 'f-' + code(10).toLowerCase();
        const a = await saveAct(d.id, (a) => {
          if (a.files.length >= LIM.files) throw new DlmError('הגענו למספר הקבצים המרבי');
          a.files.push({ id: fid, name: txt(d.name, 'שם הקובץ', 200, true), type, size: Math.round(data.length * 0.75), at: now() });
        });
        await store.set('dlf:' + a.id + ':' + fid, { type, data });
        return [200, { activity: a, fileId: fid }];
      }
      if (op === 'f.boards') {
        const a = await mine(d.id);
        const out = [];
        for (const c of a.classes) for (const g of c.groups) {
          const b = await store.get('dlb:' + a.id + ':' + g.id);
          out.push({ classId: c.id, groupId: g.id, name: c.name + ' · ' + g.name, ver: b ? b.ver : 0, items: b ? b.items.filter((i) => !i.deleted).length : 0,
            sources: b ? b.sources.length : 0, alerts: b ? b.alerts.length : 0, conclusion: !!(b && b.conclusion && b.conclusion.submitted) });
        }
        if (a.mode === 'personal') {
          const rows = await store.list('dlb:' + a.id + ':p-');
          for (const r of rows) if (r.value) out.push({ groupId: r.value.g, name: 'עבודה אישית', ver: r.value.ver, items: r.value.items.filter((i) => !i.deleted).length });
        }
        return [200, { boards: out }];
      }
      if (op === 'f.board') {
        const a = await mine(d.id);
        const g = String(d.g || '');
        if (!/^(g|p)-[a-z0-9-]{4,40}$/.test(g)) throw new DlmError('הקבוצה לא נמצאה', 404);
        const b = await store.get('dlb:' + a.id + ':' + g);
        return [200, { board: boardView(a, b || emptyBoard(a.id, g)) }];
      }
      if (op === 'f.reportStatus') {
        if (!/^(g|p)-[a-z0-9-]{4,40}$/.test(String(d.g || ''))) throw new DlmError('הקבוצה לא נמצאה', 404);
        await mutate(store, 'dlb:' + d.id + ':' + d.g, async (b) => {
          const a = await mine(d.id);
          if (b.a !== a.id) throw new DlmError('לא נמצא', 404);
          const r = b.reports.find((x) => x.id === d.reportId);
          if (!r) throw new DlmError('הדיווח לא נמצא', 404);
          r.status = ['new', 'reviewed', 'fixed', 'dismissed'].includes(d.status) ? d.status : r.status; r.reply = txt(d.reply, 'תגובה', 800);
        });
        return [200, { ok: true }];
      }
      if (op === 'f.export') return [200, await researchExport(store, await mine(d.id))];
      if (op === 'f.delete') {
        const a = await mine(d.id);
        for (const c of a.classes) await store.del('dlj:' + c.code);
        for (const pre of ['dlp:', 'dlpc:', 'dlx:', 'dlb:', 'dlf:']) {
          if (typeof store.delPrefix === 'function') await store.delPrefix(pre + a.id + ':');
          else for (const r of await store.list(pre + a.id + ':', { keysOnly: true })) await store.del(r.key);
        }
        await store.del('dla:' + a.id);
        return [200, { ok: true }];
      }
      throw new DlmError('פעולה אינה נתמכת', 405);
    }

    // ════════ משתתפים ════════
    if (op === 'p.open') {
      // סריקת ה־QR: מחזירים את הפעילות ואת נוסח ההסכמה, בלי ליצור משתתף/ת ובלי לאסוף מידע.
      const c = String(d.code || '').toUpperCase();
      const ref = /^[A-Z0-9]{10}$/.test(c) ? await store.get('dlj:' + c) : null;
      if (!ref) { await pause(); throw new DlmError('קוד הכיתה לא נמצא. אפשר לבקש מהמנחה קוד חדש', 404); }
      const a = await getActivity(store, ref.a);
      if (a.status !== 'open') throw new DlmError(a.status === 'closed' ? 'הפעילות הסתיימה' : 'הפעילות עוד לא נפתחה. אפשר לנסות שוב כשהמנחה תפתח אותה', 409);
      return [200, { activity: publicActivity(a, ref.c) }];
    }
    if (op === 'p.enter') {
      // אחרי בחירה בהסכמה (בלי ברירת מחדל): משתתף/ת חדש/ה עם קוד אישי אקראי. ההסכמה מתועדת עם גרסה, סוג ומועד.
      const c = String(d.code || '').toUpperCase();
      const ref = /^[A-Z0-9]{10}$/.test(c) ? await store.get('dlj:' + c) : null;
      if (!ref) { await pause(); throw new DlmError('קוד הכיתה לא נמצא', 404); }
      if (!['research', 'learning'].includes(d.consent)) throw new DlmError('אפשר לבחור אחת משתי האפשרויות');
      const a = await getActivity(store, ref.a);
      if (a.status !== 'open') throw new DlmError('הפעילות אינה פתוחה כרגע', 409);
      const type = a.research.enabled ? d.consent : 'learning';
      const count = (await store.list('dlp:' + a.id + ':', { keysOnly: true })).length;
      if (count >= LIM.participants) throw new DlmError('בפעילות הזו כבר יש מספר המשתתפים המרבי', 409);
      let pcode;
      for (let i = 0; i < 20; i++) { const x = code(4) + '-' + code(4); if (!(await store.get('dlpc:' + a.id + ':' + x))) { pcode = x; break; } }
      const key = newKey(), pid = 'p-' + code(12).toLowerCase();
      const consent = { type, version: a.research.consentVersion, at: now() };
      const p = { id: pid, pcode, keyHash: hash(key), classId: ref.c, groupId: null, consent, consentHistory: [consent], createdAt: now() };
      if (a.mode === 'personal') p.groupId = null;
      await store.set('dlp:' + a.id + ':' + pid, p);
      await store.set('dlpc:' + a.id + ':' + pcode, { p: pid });
      return [200, { a: a.id, p: pid, key, me: participantView(a, p), activity: publicActivity(a, ref.c) }];
    }
    if (op === 'p.resume') {
      // חזרה לפעילות במכשיר אחר: קוד הכיתה והקוד האישי. מקבלים מפתח חדש; המפתח הקודם מפסיק לפעול.
      const c = String(d.code || '').toUpperCase(), pc = String(d.pcode || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const ref = /^[A-Z0-9]{10}$/.test(c) ? await store.get('dlj:' + c) : null;
      const pcode = pc.length === 8 ? pc.slice(0, 4) + '-' + pc.slice(4) : '';
      const look = ref && pcode ? await store.get('dlpc:' + ref.a + ':' + pcode) : null;
      if (!ref || !look) { await pause(); throw new DlmError('לא מצאנו את הקוד האישי בכיתה הזו', 404); }
      const a = await getActivity(store, ref.a);
      const key = newKey();
      const p = await mutate(store, 'dlp:' + a.id + ':' + look.p, (p) => { if (p.classId !== ref.c) throw new DlmError('לא מצאנו את הקוד האישי בכיתה הזו', 404); p.keyHash = hash(key); });
      return [200, { a: a.id, p: p.id, key, me: participantView(a, p), activity: publicActivity(a, ref.c) }];
    }

    const { a, p } = await participantOf(store, body);
    const pv = () => participantView(a, p);
    if (op === 'p.state') {
      const x = (await store.get('dlx:' + a.id + ':' + p.id)) || {};
      const bk = boardKeyOf(a, p);
      const b = bk ? await store.get('dlb:' + a.id + ':' + bk) : null;
      return [200, { me: pv(), activity: publicActivity(a, p.classId), private: { response: x.response || null, reflection: x.reflection || null },
        board: bk ? boardView(a, b || emptyBoard(a.id, bk)) : null }];
    }
    if (op === 'p.consent') {
      // שינוי ההחלטה (למשל הפסקת השתתפות במחקר). מתועד; הנתונים מסוננים בייצוא לפי ההחלטה האחרונה.
      if (!['research', 'learning'].includes(d.consent)) throw new DlmError('אפשר לבחור אחת משתי האפשרויות');
      const np = await mutate(store, 'dlp:' + a.id + ':' + p.id, (q) => {
        q.consent = { type: a.research.enabled ? d.consent : 'learning', version: a.research.consentVersion, at: now(), ...(d.withdrawData ? { withdrawData: true } : {}) };
        q.consentHistory.push(q.consent);
      });
      return [200, { me: participantView(a, np) }];
    }
    if (op === 'p.group') {
      if (a.mode === 'personal') throw new DlmError('בפעילות אישית אין קבוצות');
      const c = a.classes.find((x) => x.id === p.classId);
      if (!c || !c.groups.some((g) => g.id === d.groupId)) throw new DlmError('הקבוצה לא נמצאה', 404);
      const np = await mutate(store, 'dlp:' + a.id + ':' + p.id, (q) => { q.groupId = d.groupId; });
      return [200, { me: participantView(a, np) }];
    }
    if (op === 'p.private') {
      // תגובה אישית או רפלקציה: נשמרות בנפרד, לא נחשפות לקבוצה ולא עוברות למודל.
      const kind = d.kind === 'reflection' ? 'reflection' : 'response';
      const x = await mutate(store, 'dlx:' + a.id + ':' + p.id, (x) => {
        if (kind === 'response') {
          const r = {}; for (const q of M.INDIVIDUAL_Q) r[q.k] = txt(d.answers && d.answers[q.k], q.t, LIM.long);
          x.response = { answers: r, at: now(), history: [...((x.response && x.response.history) || []), ...(x.response ? [{ at: x.response.at, answers: x.response.answers }] : [])].slice(-10) };
        } else {
          const ans = arr(d.answers, a.reflectionQs.length).map((v, i) => txt(v, 'תשובה ' + (i + 1), LIM.long));
          x.reflection = { questions: a.reflectionQs.slice(), answers: ans, status: d.submit ? 'submitted' : 'draft', at: now() };
        }
      }, () => ({ createdAt: now() }));
      return [200, { private: { response: x.response || null, reflection: x.reflection || null } }];
    }
    if (op === 'p.aiLog') {
      // AIInteraction: בקשה, תשובה, מקורות וסטטוס אימות. אישית (dlx) ובלוח הקבוצה כאירוע.
      const rec = { action: txt(d.action, 'פעולה', 40), request: txt(d.request, 'בקשה', LIM.long), response: txt(typeof d.response === 'string' ? d.response : JSON.stringify(d.response || {}), 'תשובה', 12000),
        sources: arr(d.sources, 20).map((s) => txt(s, 'מקור', 60)), verification: txt(d.verification, 'סטטוס אימות', 120), ok: d.ok !== false, at: now() };
      await mutate(store, 'dlx:' + a.id + ':' + p.id, (x) => { x.ai = [...(x.ai || []), rec].slice(-300); }, () => ({ createdAt: now() }));
      const bk = boardKeyOf(a, p);
      if (bk) await mutate(store, 'dlb:' + a.id + ':' + bk, (b) => { log(b, 'ai', p.pcode, { action: rec.action, ok: rec.ok, sources: rec.sources }); }, () => emptyBoard(a.id, bk));
      return [200, { ok: true }];
    }
    if (op === 'p.file') {
      const f = a.files.find((x) => x.id === d.fileId);
      if (!f) throw new DlmError('הקובץ לא נמצא', 404);
      const rec = await store.get('dlf:' + a.id + ':' + f.id);
      return [200, { name: f.name, type: rec.type, data: rec.data }];
    }
    if (op === 'p.verify') {
      // בדיקת קיום של מקור בלוח (קישור). לא משנה ציון אמינות.
      if (!verifyBudget(p.id)) throw new DlmError('נבדקו הרבה קישורים בשעה האחרונה. אפשר לנסות שוב מאוחר יותר', 429);
      const bk = boardKeyOf(a, p);
      if (!bk) throw new DlmError('אפשר לבחור קבוצה קודם');
      const b0 = await store.get('dlb:' + a.id + ':' + bk);
      const s0 = b0 && b0.sources.find((s) => s.id === d.sourceId);
      if (!s0 || !s0.url) throw new DlmError('אין קישור לבדיקה');
      const v = await verifyUrl(s0.url, { fetchImpl, resolve });
      const b = await mutate(store, 'dlb:' + a.id + ':' + bk, (b) => {
        const s = b.sources.find((x) => x.id === d.sourceId); if (s) s.verify = { ...v, at: now() };
        b.ver++; log(b, 'verify', p.pcode, { source: d.sourceId, status: v.status });
      });
      return [200, { verify: v, board: boardView(a, b) }];
    }

    // ── הלוח: קריאה וכתיבה, רק ללוח של הקבוצה שלי ──
    const bk = boardKeyOf(a, p);
    if (!bk) throw new DlmError('אפשר לבחור קבוצה קודם', 409);
    const bkey = 'dlb:' + a.id + ':' + bk;
    if (op === 'p.poll') {
      const b = await store.get(bkey);
      const since = Number.isSafeInteger(d.since) ? d.since : -1;
      const ver = b ? b.ver : 0;
      if (since === ver) return [200, { ver, status: a.status, challengeOpen: !!a.challengeOpen }];
      return [200, { ver, status: a.status, challengeOpen: !!a.challengeOpen, board: boardView(a, b || emptyBoard(a.id, bk)) }];
    }
    if (op === 'p.board') {
      if (a.status !== 'open') throw new DlmError('הפעילות אינה פתוחה לכתיבה כרגע', 409);
      const by = p.pcode;
      let result = {};
      const b = await mutate(store, bkey, async (b) => {
        const kind = String(d.kind || '');
        if (kind === 'add') {
          if (b.items.length >= LIM.items) throw new DlmError('הלוח מלא');
          const zone = M.ZONES.some((z) => z.k === d.zone) ? d.zone : 'claims';
          const item = { id: 'i-' + code(10).toLowerCase(), zone, text: txt(d.text, 'הטקסט', LIM.text, !d.source), by, at: now(), history: [],
            origin: ['participant', 'ai'].includes(d.origin) ? d.origin : 'participant', ...(d.confidence && M.CONFIDENCE.some((c) => c.k === d.confidence) ? { confidence: d.confidence } : {}) };
          if (d.source) {
            if (b.sources.length >= LIM.sources) throw new DlmError('הגענו למספר המקורות המרבי בלוח');
            const s = newSource(d.source, ['participant', 'ai', 'search', 'unverified'].includes(d.source.origin) ? d.source.origin : 'participant', by);
            b.sources.push(s); item.sourceId = s.id; item.zone = 'sources'; if (!item.text) item.text = s.title;
          } else if (d.sourceId) {
            if (!sourceIn(a, b, d.sourceId)) throw new DlmError('המקור לא נמצא', 404);
            item.sourceId = d.sourceId;
          }
          b.items.push(item); result.id = item.id; log(b, 'add', by, { id: item.id, zone, origin: item.origin });
        } else if (kind === 'edit') {
          const it = b.items.find((i) => i.id === d.id && !i.deleted);
          if (!it) throw new DlmError('הכרטיס לא נמצא', 404);
          it.history.push({ at: now(), by, text: it.text, zone: it.zone, confidence: it.confidence || null }); if (it.history.length > 30) it.history.shift();
          if (d.text !== undefined) it.text = txt(d.text, 'הטקסט', LIM.text, true);
          if (d.zone && M.ZONES.some((z) => z.k === d.zone)) it.zone = d.zone;
          if (d.confidence !== undefined) it.confidence = M.CONFIDENCE.some((c) => c.k === d.confidence) ? d.confidence : null;
          if (d.confidenceWhy !== undefined) it.confidenceWhy = txt(d.confidenceWhy, 'הסבר', 600);
          it.editedBy = by; it.editedAt = now(); log(b, 'edit', by, { id: it.id });
        } else if (kind === 'remove') {
          const it = b.items.find((i) => i.id === d.id && !i.deleted);
          if (!it) throw new DlmError('הכרטיס לא נמצא', 404);
          it.deleted = { by, at: now() }; b.links = b.links.filter((l) => l.from !== it.id && l.to !== it.id); log(b, 'remove', by, { id: it.id });
        } else if (kind === 'link') {
          if (!M.RELATIONS.some((r) => r.k === d.rel)) throw new DlmError('סוג הקשר אינו תקין');
          if (!itemExists(b, d.from) || !itemExists(b, d.to) || d.from === d.to) throw new DlmError('אפשר לבחור שני כרטיסים');
          if (b.links.length >= LIM.links) throw new DlmError('יש הרבה קשרים בלוח');
          const l = { id: 'l-' + code(8).toLowerCase(), from: d.from, to: d.to, rel: d.rel, by, at: now() };
          b.links.push(l); result.id = l.id; log(b, 'link', by, { rel: d.rel });
        } else if (kind === 'unlink') {
          b.links = b.links.filter((l) => l.id !== d.id); log(b, 'unlink', by, { id: d.id });
        } else if (kind === 'assess') {
          // הערכת אמינות של מקור בהקשר הטענה (AI או משתתף/ת). נשמרת כהיסטוריה; הציון הנוכחי הוא האחרון.
          if (!sourceIn(a, b, d.sourceId)) throw new DlmError('המקור לא נמצא', 404);
          const as = newAssessment(d.assessment || {}, by, 'participant');
          if (d.assessment && d.assessment.method === 'ai') as.method = 'ai';
          (b.assess[d.sourceId] = b.assess[d.sourceId] || []).push(as);
          if (b.assess[d.sourceId].length > LIM.assess) b.assess[d.sourceId].shift();
          log(b, 'assess', by, { source: d.sourceId, score: as.score, method: as.method });
        } else if (kind === 'checked') {
          // "בדקתי את המקור": נרשם, אבל אינו מעיד בהכרח על בדיקה איכותית.
          if (!sourceIn(a, b, d.sourceId)) throw new DlmError('המקור לא נמצא', 404);
          (b.checks[d.sourceId] = b.checks[d.sourceId] || []).push({ by, at: now(), note: txt(d.note, 'הערה', 600) });
          log(b, 'checked', by, { source: d.sourceId });
        } else if (kind === 'report') {
          // "מצאתי בעיה במקור או בתשובת ה־AI" (SourceFeedback).
          if (b.reports.length >= LIM.reports) throw new DlmError('יש הרבה דיווחים בלוח');
          const r = { id: 'r-' + code(8).toLowerCase(), target: ['source', 'ai', 'assessment', 'alert'].includes(d.target) ? d.target : 'ai', targetId: txt(d.targetId, 'מזהה', 60),
            issue: ['not_exist', 'not_support', 'misread', 'outdated', 'missing_caveat', 'wrong_score', 'other'].includes(d.issue) ? d.issue : 'other', text: txt(d.text, 'מה הבעיה', LIM.text, true), by, at: now(), status: 'new' };
          b.reports.push(r); result.id = r.id; log(b, 'report', by, { target: r.target, issue: r.issue });
        } else if (kind === 'alert') {
          // התרעת קונספירציה או מדיה: סמל נפרד, לא משנה ציון אמינות.
          if (b.alerts.length >= LIM.alerts) throw new DlmError('יש הרבה התרעות בלוח');
          const al = { id: 'al-' + code(8).toLowerCase(), type: d.type === 'media' ? 'media' : 'conspiracy', target: txt(d.target, 'מה נבדק', LIM.text, true),
            itemId: d.itemId && itemExists(b, d.itemId) ? d.itemId : null, data: d.data && typeof d.data === 'object' ? JSON.parse(JSON.stringify(d.data).slice(0, 12000)) : {},
            text: d.type === 'media' ? '' : M.CONSPIRACY.alert, status: 'open', responses: [], by, at: now() };
          b.alerts.push(al); result.id = al.id; log(b, 'alert', by, { type: al.type });
        } else if (kind === 'alertRespond') {
          const al = b.alerts.find((x) => x.id === d.id);
          if (!al) throw new DlmError('ההתרעה לא נמצאה', 404);
          al.responses.push({ by, at: now(), text: txt(d.text, 'מה בדקתם ומה המסקנה', LIM.text, true), conclusion: ['dismissed', 'needs_more', 'confirmed_concern', 'undetermined'].includes(d.conclusion) ? d.conclusion : 'undetermined' });
          al.status = d.conclusion || al.status; log(b, 'alertRespond', by, { id: al.id });
        } else if (kind === 'challenge') {
          // מידע מאתגר: רק ממקור של המנחה או ממקור שאומת בלוח. לפני ההצגה נשמרת גרסת הלוח.
          if (a.challengeMode === 'facilitator' && !a.challengeOpen) throw new DlmError('המידע המאתגר ייפתח כשהמנחה תפתח אותו', 409);
          if (b.challenges.length >= LIM.challenges) throw new DlmError('הוצג כבר הרבה מידע מאתגר');
          const s = sourceIn(a, b, d.sourceRef);
          if (!s || !(s.origin === 'facilitator' || ['exists', 'file'].includes((s.verify || {}).status))) throw new DlmError('מידע מאתגר מוצג רק ממקור של המנחה או ממקור שאומת');
          b.snapshots.push({ at: now(), reason: 'before_challenge', items: structuredClone(b.items.filter((i) => !i.deleted)), links: structuredClone(b.links) });
          if (b.snapshots.length > LIM.snapshots) b.snapshots.shift();
          const ch = { id: 'ch-' + code(8).toLowerCase(), info: txt(d.info, 'המידע', LIM.text, true), sourceRef: s.id, challenges: txt(d.challenges, 'מה הוא מאתגר', 600),
            caveats: arr(d.caveats, 6).map((x) => txt(x, 'הסתייגות', 400)), check: arr(d.check, 6).map((x) => txt(x, 'מה לבדוק', 400)),
            snapshot: b.snapshots.length - 1, by, at: now(), decision: null };
          b.challenges.push(ch); result.id = ch.id; log(b, 'challenge', by, { source: s.id });
        } else if (kind === 'challengeDecide') {
          const ch = b.challenges.find((x) => x.id === d.id);
          if (!ch) throw new DlmError('המידע לא נמצא', 404);
          ch.decision = { value: ['update', 'keep', 'open'].includes(d.value) ? d.value : 'open', note: txt(d.note, 'הסבר', 1200), by, at: now() };
          log(b, 'challengeDecide', by, { id: ch.id, value: ch.decision.value });
        } else if (kind === 'conclusion') {
          const prev = b.conclusion;
          const c = {}; for (const q of M.CONCLUSION_Q) c[q.k] = txt(d.fields && d.fields[q.k], q.t, LIM.long);
          if (d.submit && (!c.confident && !c.disputed && !c.next)) throw new DlmError('כדי להגיש, אפשר למלא לפחות חלק אחד');
          b.conclusion = { ...c, submitted: !!d.submit, by, at: now(), contributors: [...new Set([...(prev ? prev.contributors || [] : []), by])],
            history: [...((prev && prev.history) || []), ...(prev ? [{ at: prev.at, by: prev.by, fields: Object.fromEntries(M.CONCLUSION_Q.map((q) => [q.k, prev[q.k]])), submitted: prev.submitted }] : [])].slice(-20) };
          log(b, d.submit ? 'conclusionSubmit' : 'conclusion', by);
        } else throw new DlmError('פעולה אינה נתמכת', 405);
        b.ver++;
      }, () => emptyBoard(a.id, bk));
      return [200, { ...result, board: boardView(a, b) }];
    }
    throw new DlmError('פעולה אינה נתמכת', 405);
  } catch (err) {
    if (err instanceof DlmError) return [err.status, { error: err.message }];
    console.error('dilemma failed', err && err.message);
    return [500, { error: 'לא ניתן להשלים את הפעולה. הנתונים הקודמים נשמרו; אפשר לנסות שוב' }];
  }
}

function dilemmaOf(t) {
  return { topic: txt(t.topic, 'נושא הדילמה', LIM.title), title: txt(t.title, 'כותרת הדילמה', LIM.title), claim: txt(t.claim, 'הטענה המרכזית', 1200),
    background: txt(t.background, 'רקע', LIM.long), concepts: txt(t.concepts, 'מושגים', 1500),
    openingQuestions: arr(t.openingQuestions, 10).map((q) => txt(q, 'שאלת פתיחה', 400)).filter(Boolean),
    examples: txt(t.examples, 'דוגמאות', LIM.long), args: txt(t.args, 'נימוקים וטיעונים', LIM.long) };
}

// ── ייצוא מחקרי לפי ההסכמות ──
// רק משתתפים שבחרו "מחקר" (ההחלטה האחרונה, בלי בקשה למשיכת נתונים). פריטים, הערכות, בדיקות ודיווחים של אחרים לא נכללים.
// תוצר קבוצתי בלי ייחוס אישי (המסקנה, ההחלטות על מידע מאתגר) נכלל רק כשכל חברי הקבוצה הסכימו למחקר.
export async function researchExport(store, a) {
  const parts = (await store.list('dlp:' + a.id + ':')).map((r) => r.value).filter(Boolean);
  const ok = new Set(parts.filter((p) => p.consent && p.consent.type === 'research' && !p.consent.withdrawData).map((p) => p.pcode));
  const people = [];
  for (const p of parts) {
    const inR = ok.has(p.pcode);
    const x = inR ? (await store.get('dlx:' + a.id + ':' + p.id)) || {} : {};
    people.push({ code: p.pcode, classId: p.classId, groupId: p.groupId, consent: { type: p.consent.type, version: p.consent.version, at: p.consent.at },
      ...(inR ? { response: x.response || null, reflection: x.reflection || null, ai: x.ai || [] } : { excluded: 'no_research_consent' }) });
  }
  const boards = [];
  const keys = a.mode === 'personal' ? parts.map((p) => 'p-' + p.id) : a.classes.flatMap((c) => c.groups.map((g) => g.id));
  for (const g of keys) {
    const b = await store.get('dlb:' + a.id + ':' + g);
    if (!b) continue;
    const members = parts.filter((p) => (a.mode === 'personal' ? 'p-' + p.id : p.groupId) === g).map((p) => p.pcode);
    const contributors = new Set(b.events.map((e) => e.by).filter(Boolean));
    const allIn = [...contributors, ...members].every((c) => ok.has(c));
    const mineOk = (x) => !x.by || x.by === 'facilitator' || ok.has(x.by);
    const items = b.items.filter(mineOk).map((i) => ({ ...i, history: (i.history || []).filter(mineOk) }));
    const ids = new Set(items.map((i) => i.id));
    boards.push({ group: g, members: members.filter((c) => ok.has(c)), excludedMembers: members.filter((c) => !ok.has(c)).length, ver: b.ver,
      items, links: b.links.filter((l) => mineOk(l) && ids.has(l.from) && ids.has(l.to)), sources: b.sources.filter(mineOk),
      assessments: Object.fromEntries(Object.entries(b.assess).map(([k, v]) => [k, v.filter(mineOk)])),
      checks: Object.fromEntries(Object.entries(b.checks).map(([k, v]) => [k, v.filter(mineOk)])), reports: b.reports.filter(mineOk),
      alerts: b.alerts.filter(mineOk).map((al) => ({ ...al, responses: al.responses.filter(mineOk) })),
      challenges: b.challenges.filter(mineOk).map((c) => ({ ...c, decision: allIn ? c.decision : (c.decision ? { restricted: true } : null) })),
      snapshots: allIn ? b.snapshots : { restricted: true, count: b.snapshots.length },
      conclusion: allIn ? b.conclusion : (b.conclusion ? { restricted: 'group_includes_non_consenting_contributors' } : null),
      events: b.events.filter(mineOk) });
  }
  return { schema: 'BG-DLM-EXPORT-1.0', exportedAt: now(), rubricVersion: M.RUBRIC_VERSION, note: 'נתונים פסאודונימיים: קודים אישיים אקראיים, בלי שמות. רק משתתפים שהסכימו למחקר. אין לוח כתמליל של שיחה שלא הוקלטה.',
    activity: { id: a.id, title: a.title, mode: a.mode, dilemma: a.dilemma, research: { consentVersion: a.research.consentVersion, enabled: a.research.enabled },
      classes: a.classes.map((c) => ({ id: c.id, name: c.name, groups: c.groups })), sources: a.sources },
    participants: people, boards };
}

// לבדיקות
export function _resetDlm() { locks.clear(); verifyHits.clear(); }
