// מערך המוכנות (03/11/2026; docs/readiness-program).
// כל בית ספר פותח מערך מוכנות משלו. המערך נשמר בשרת תחת הקוד של המוסד (כמו תרגול צוותים ומעבדת האופק),
// כי המתווה מבקש עדכונים במייל לכל צוות, קצוות פתוחים ומעקב לאורך שנה (00-screen-plan.md, סעיף 3).
//  - rdy:<id>            המערך: פרופיל, תוכנית ונספחים, צוותים, משימות, פערים, קצוות פתוחים, פעולות, תרגילים, רישום שינויים.
//  - rdyt:<id>:<exId>    תמליל התרגיל (נמחק כשהדוח מאושר).
//  - rdyk:<sha>          מפתח ההקלטה בטלפון של הרשם/ת (6 שעות), בלי קוד Begood.
//                        מפתח פעיל אחד לכל תרגיל או מפגש (d.recKeys); קישור חדש או מחיקת התמליל מבטלים את הקודם.
// לא נשמרים שמות ופרטים של תלמידים (החלטה 7): מספר בן 9 ספרות (תעודת זהות) נפסל בשמירה.
// הקול לא נשמר בשום מקום: קטע עובר לתמלול ונזרק (החלטה 28, 03/11/2026: "להוסיף במכשיר נייד").
import { createHash, randomBytes, randomUUID } from 'node:crypto';

export const RDY_PARTS = ['profile', 'plan', 'teams', 'tasks', 'em', 'mapping', 'gaps', 'ends', 'actions', 'exercises', 'sessions', 'partners', 'ideas', 'scenarios', 'learning', 'compare', 'decmap', 'meetings', 'binder'];
const MAX_PART = 400_000, MAX_DOC = 1_800_000, MAX_MINE = 30, MAX_LOG = 400;
// תיקיית המוכנות: קובץ אחד לכל פריט, קובץ חדש מחליף את הקודם (הגרסה הקודמת נמחקת). פריטים רגישים לא עולים.
// BINDER_SENS: אותם מספרים כמו C.BINDER_SENS ב-readiness-model.js (רשימות כיתות, פרטי הורים, מענה מותאם, תיקי המחנכים).
export const BINDER_SENS = [0, 1, 4, 7];
const BINDER_N = 8, MAX_FILE_B64 = 5_600_000, MAX_FILES = 40;
const FILE_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'text/plain', 'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/msword', 'application/vnd.ms-excel'];
const okDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
// שם ברור: לא שם קובץ אוטומטי (IMG_1234, scan, document) ולא רק סיומת
export function vagueTitle(t) {
  const s = String(t || '').trim();
  return s.length < 4 || /\.(pdf|docx?|xlsx?|pptx?|png|jpe?g|webp|txt|csv)$/i.test(s) || /^(img|dsc|scan|scanned|document|doc|file|image|photo|whatsapp|screenshot|צילום|מסמך|קובץ|תמונה|סריקה)[\s_\-\d.()]*$/i.test(s);
}
function binderItem(d, key) {
  const m = /^m(\d)$/.exec(key || '');
  if (m) { const i = Number(m[1]); return i < BINDER_N ? { key, sens: BINDER_SENS.includes(i) } : null; }
  if (!/^c[a-z0-9]{4,14}$/.test(key || '')) return null;
  const items = d.parts.binder && Array.isArray(d.parts.binder.items) ? d.parts.binder.items : [];
  const it = items.find((x) => x && x.key === key);
  return it ? { key, sens: !!it.sens } : null;
}
// MAX_AUDIO_B64 מתחת למגבלת הבקשה ב-/api/access (2,000,000 תווים), כדי שקטע גדול יקבל 413 ברור ולא ייחתך בדרך
const MAX_MAIL_DAY = 300, REC_HOURS = 6, MAX_CHUNKS = 400, MAX_AUDIO_B64 = 1_900_000, MAX_TRANSCRIPT = 600_000;

const hash = (v) => createHash('sha256').update(String(v)).digest('hex');
const okId = (id) => typeof id === 'string' && /^[a-f0-9-]{36}$/.test(id);
const okExId = (id) => typeof id === 'string' && /^[a-z0-9-]{4,40}$/i.test(id);
// מה מוקלט: תרגיל, מפגש שתוכנן (meetings), או אחד מחמשת המפגשים (sess-1 עד sess-5). 04/11/2026: "המשתתפים מדברים ולא כותבים".
function recTarget(d, id) {
  if (!d || !okExId(id)) return null;
  const ex = (d.parts.exercises || []).find((x) => x && x.id === id); if (ex) return ex;
  const m = (Array.isArray(d.parts.meetings) ? d.parts.meetings : []).find((x) => x && x.id === id); if (m) return m;
  const n = /^sess-([1-5])$/.exec(id);
  if (n) { const ss = d.parts.sessions && typeof d.parts.sessions === 'object' && !Array.isArray(d.parts.sessions) ? d.parts.sessions : (d.parts.sessions = {}); return (ss[n[1]] = ss[n[1]] && typeof ss[n[1]] === 'object' ? ss[n[1]] : {}); }
  return null;
}
// החלק שמחזיק את התרגיל או המפגש: כדי לעדכן את מספר הגרסה כשההקלטה מתחילה או נגמרת (בדיקת המומחים, סבב 2)
function recPart(d, id) {
  if ((d.parts.exercises || []).some((x) => x && x.id === id)) return 'exercises';
  if ((Array.isArray(d.parts.meetings) ? d.parts.meetings : []).some((x) => x && x.id === id)) return 'meetings';
  return /^sess-[1-5]$/.test(id) ? 'sessions' : '';
}
const bumpRev = (d, part) => { if (!part) return; d.revs = d.revs || {}; d.revs[part] = (d.revs[part] || 0) + 1; d.rev = (d.rev || 1) + 1; };
const EMAIL_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]{2,}$/;
const str = (v, max = 200) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max);
const err = (status, error) => [status, { error }];

// פרטים מזהים של תלמידים לא נכנסים: תעודת זהות בשום שדה. 9 ספרות רצופות שעוברות את ספרת הביקורת של תעודת זהות ישראלית;
// מספר טלפון קווי של 9 ספרות (למשל 039876543) לא נחסם (בדיקת המומחים, 04/11/2026).
export function validIsraeliId(d) {
  if (!/^\d{9}$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) { let x = Number(d[i]) * (i % 2 ? 2 : 1); if (x > 9) x -= 9; sum += x; }
  return sum % 10 === 0;
}
// גם תעודת זהות שנכתבה בקבוצות עם רווח או מקף ("123-456-782", "1234 5678 2"): כל רצף של קבוצות ספרות
// (עד חמש קבוצות) שיש בו בדיוק 9 ספרות ועובר את ספרת הביקורת. טלפון נייד (10 ספרות), קווי (0 וקידומת) ותאריך (8 ספרות) לא נחסמים.
export function hasIdNumber(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  if (!text) return false;
  const bad = (d) => d.length === 9 && !/^0[234589]/.test(d) && validIsraeliId(d);
  for (const m of text.matchAll(/(?:^|[^\d])(\d{9})(?=[^\d]|$)/g)) if (bad(m[1])) return true;
  for (const run of text.match(/\d+(?:[ \-]\d+)+/g) || []) {
    const g = run.split(/[ \-]/);
    for (let i = 0; i < g.length; i++) {
      let d = '';
      for (let j = i; j < g.length && j < i + 5; j++) { d += g[j]; if (d.length > 9) break; if (j > i && bad(d)) return true; }
    }
  }
  return false;
}

const locks = new Map();
function locked(id, fn) {
  const prev = locks.get(id) || Promise.resolve();
  const run = prev.catch(() => {}).then(fn);
  const tail = run.catch(() => {});
  locks.set(id, tail);
  tail.then(() => { if (locks.get(id) === tail) locks.delete(id); });
  return run;
}

const ownerOf = (me) => (me.sys ? 'sys' : me.inst ? 'inst:' + me.inst : 'p:' + me.principal);
const canSee = (doc, me) => !!doc && (me.sys || doc.owner === ownerOf(me));
function summary(d) {
  const ends = (d.parts.ends || []).filter((e) => e && e.status !== 'closed').length;
  const sessions = d.parts.sessions || {};
  return { id: d.id, name: d.parts.profile?.name || '', updatedAt: d.updatedAt, createdAt: d.createdAt,
    sessionsDone: [1, 2, 3, 4, 5].filter((n) => sessions[n] && sessions[n].done).length, openEnds: ends };
}
const publicDoc = (d) => ({ id: d.id, createdAt: d.createdAt, updatedAt: d.updatedAt, rev: d.rev, revs: d.revs, parts: d.parts, files: d.files || {}, log: d.log.slice(-120) });

async function loadDoc(store, id, me) {
  if (!okId(id)) return null;
  const d = await store.get('rdy:' + id);
  return canSee(d, me) ? d : null;
}

// שליחת עדכון במייל (Resend). מחזיר true/false; בלי מפתח או שולח מוגדר: false.
async function sendMail(fetchImpl, env, to, subject, text, html) {
  if (!env.RESEND_API_KEY || !env.NOTIFY_FROM || !fetchImpl) return false;
  try {
    const r = await fetchImpl('https://api.resend.com/emails', { method: 'POST',
      headers: { authorization: 'Bearer ' + env.RESEND_API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ from: env.NOTIFY_FROM, to: [to], subject, text, html }) });
    return !!(r && r.ok);
  } catch { return false; }
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// כתובות בצוותים: מייל רק לכתובת שנמצאת בצוותים לפחות 24 שעות, ועד 20 כתובות חדשות ביום לכל מערך,
// כדי שקוד צוות לא יוכל לכתוב כתובת כלשהי בטבלת הצוותים ולשלוח אליה מיד (בדיקת המומחים, 05/11/2026).
// d.emailSeen = { כתובת: מתי נראתה לראשונה }. כתובות שכבר היו בצוותים לפני השינוי נחשבות ישנות.
const MAIL_MATURE_MS = 24 * 3600e3, MAX_NEW_MAIL_DAY = 20, MAX_SEEN = 1000, OLD_SEEN = '2000-01-01T00:00:00.000Z';
const teamEmails = (teams) => (Array.isArray(teams) ? teams : []).flatMap((t) => (t && [].concat(t.members || [], t.lead || [], t.deputy || [])) || [])
  .map((m) => str(m && m.email, 254).toLowerCase()).filter((e) => EMAIL_RE.test(e));
function seenMap(d) {
  if (!d.emailSeen || typeof d.emailSeen !== 'object' || Array.isArray(d.emailSeen)) {
    d.emailSeen = {};
    for (const e of teamEmails(d.parts.teams)) d.emailSeen[e] = OLD_SEEN;
  }
  return d.emailSeen;
}
function noteEmails(d, addrs, nowMs) {
  const seen = seenMap(d), day = new Date(nowMs).toISOString().slice(0, 10);
  d.newMail = d.newMail && d.newMail.day === day ? d.newMail : { day, n: 0 };
  for (const e of new Set(addrs)) {
    if (seen[e]) continue;
    if (d.newMail.n >= MAX_NEW_MAIL_DAY) continue; // נרשמת ביום אחר, כשהצוותים נשמרים או כששולחים שוב
    seen[e] = new Date(nowMs).toISOString(); d.newMail.n++;
  }
  const keys = Object.keys(seen);
  if (keys.length > MAX_SEEN) { const keep = new Set(addrs); for (const k of keys) if (!keep.has(k)) delete seen[k]; }
}
const mature = (d, e, nowMs) => { const at = d.emailSeen && d.emailSeen[e]; return !!at && Date.parse(at) <= nowMs - MAIL_MATURE_MS; };
const ID_MSG = 'נראה שיש כאן מספר זהות. פרטים של תלמידים לא נשמרים במערך';
const KEY_GONE = 'הקישור להקלטה הוחלף או הסתיים. אפשר לפתוח קישור חדש ממסך התרגיל או המפגש';

// תמלול קטע קול (OpenAI). הקול לא נשמר: הוא נשלח לתמלול ונזרק.
async function transcribe(fetchImpl, env, b64, mime, lang) {
  if (!env.OPENAI_API_KEY || !fetchImpl) return { error: 'התמלול לא זמין כרגע. הקטעים נשמרים בטלפון ויעלו כשיהיה אפשר' };
  const bytes = Buffer.from(b64, 'base64');
  const type = /^audio\/[a-z0-9.+-]+/i.test(mime || '') ? mime.split(';')[0] : 'audio/webm';
  const ext = type.includes('mp4') || type.includes('m4a') || type.includes('aac') ? 'm4a' : type.includes('ogg') ? 'ogg' : type.includes('wav') ? 'wav' : 'webm';
  const form = new FormData();
  form.append('file', new Blob([bytes], { type }), 'part.' + ext);
  form.append('model', env.TRANSCRIBE_MODEL || 'gpt-4o-transcribe');
  form.append('language', lang === 'ar' ? 'ar' : 'he');
  form.append('response_format', 'json');
  try {
    const r = await fetchImpl('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { authorization: 'Bearer ' + env.OPENAI_API_KEY }, body: form });
    if (!r || !r.ok) return { error: 'התמלול לא הצליח הפעם. הקטע נשמר בטלפון ויישלח שוב' };
    const j = await r.json();
    return { text: str(j && j.text, 20000) };
  } catch { return { error: 'התמלול לא הצליח הפעם. הקטע נשמר בטלפון ויישלח שוב' }; }
}

// who(token) → { principal, inst, sys } לפי הרשאה חיה ל-readiness, או null.
export async function handleReadiness(store, body, { who, fetchImpl = globalThis.fetch, env = (typeof process !== 'undefined' && process.env) || {}, now = () => Date.now() } = {}) {
  try {
    const action = body.action;
    // ביטול המפתח הפעיל של תרגיל או מפגש (בתוך הנעילה של המערך). מחזיר true כשהיה מפתח.
    const cancelKey = async (d, exId) => {
      const h = d.recKeys && d.recKeys[exId];
      if (!h) return false;
      const ref = await store.get('rdyk:' + h);
      if (ref) await store.set('rdyk:' + h, { ...ref, cancelled: true });
      delete d.recKeys[exId];
      return true;
    };

    // ההקלטה בטלפון: מפתח בלבד, בלי קוד Begood.
    // לכל תרגיל או מפגש מפתח פעיל אחד (d.recKeys[exId] = גיבוב המפתח). מפתח שהוחלף או בוטל מקבל 410 ולא יוצר תמליל מחדש.
    if (/^rdyRec(Chunk|Mark|Stop|Ping)$/.test(action)) {
      const rk = typeof body.rk === 'string' && /^[a-f0-9]{48}$/.test(body.rk) ? body.rk : '';
      const kKey = rk ? 'rdyk:' + hash(rk) : '';
      // בודקים שוב בתוך הנעילה: המפתח לא בוטל, והוא עדיין המפתח הפעיל של התרגיל או המפגש
      const check = async () => {
        const ref = kKey ? await store.get(kKey) : null;
        if (!ref || ref.exp < now()) return { e: err(401, 'הקישור להקלטה הסתיים. אפשר לפתוח קישור חדש ממסך התרגיל או המפגש') };
        if (ref.cancelled) return { e: err(410, KEY_GONE) };
        const d = await store.get('rdy:' + ref.id);
        const ex = recTarget(d, ref.exId);
        if (!ex) return { e: err(404, 'התרגיל או המפגש לא נמצאו') };
        const active = d.recKeys && d.recKeys[ref.exId];
        if (active && active !== hash(rk)) return { e: err(410, KEY_GONE) };
        // מפתח מלפני הרישום ב-recKeys: תקף רק כל עוד ההקלטה פתוחה (אחרי מחיקת התמליל היא סגורה)
        if (!active && !(ex.rec && ex.rec.on)) return { e: err(410, KEY_GONE) };
        return { ref, d, ex, tKey: 'rdyt:' + ref.id + ':' + ref.exId };
      };
      const first = await (async () => { const r0 = kKey ? await store.get(kKey) : null; return r0 ? r0.id : 'none'; })();
      if (action !== 'rdyRecChunk') {
        return await locked(first, async () => {
          const c = await check(); if (c.e) return c.e;
          const { ref, d, ex, tKey } = c;
          const tr = (await store.get(tKey)) || { segments: [], marks: [] };
          if (action === 'rdyRecPing') return [200, { ok: true, title: str(d.parts.profile?.name, 120), round: ex.round || 1, lang: d.parts.profile?.lang === 'ar' ? 'ar' : 'he', segments: tr.segments.length, nextSeq: tr.segments.reduce((m, x) => Math.max(m, (Number(x.seq) || 0) + 1), 0), marks: tr.marks.length }];
          if (action === 'rdyRecStop') {
            ex.rec = { ...(ex.rec || {}), on: false, stoppedAt: new Date(now()).toISOString() }; bumpRev(d, recPart(d, ref.exId));
            if (d.recKeys && d.recKeys[ref.exId] === hash(rk)) delete d.recKeys[ref.exId];
            await store.set('rdy:' + d.id, d); await store.del(kKey); return [200, { ok: true }];
          }
          // rdyRecMark
          if (tr.marks.length >= 300) return err(409, 'הגענו למספר הסימונים המרבי בתרגיל');
          const note = str(body.note, 300);
          if (hasIdNumber(note)) return err(400, 'נראה שיש כאן מספר זהות. אפשר למחוק אותו ולסמן שוב');
          const t = Math.max(0, Math.min(36e6, Number(body.t) || 0));
          tr.at = tr.at || new Date(now()).toISOString();
          tr.marks.push({ t, round: Math.max(1, Math.min(9, Number(body.round) || ex.round || 1)), note, at: new Date(now()).toISOString() });
          await store.set(tKey, tr);
          return [200, { ok: true, marks: tr.marks.length }];
        });
      }
      // rdyRecChunk: בדיקה, תמלול מחוץ לנעילה (קריאה איטית לשירות חיצוני), ואז בדיקה חוזרת והוספה בתוך הנעילה
      const seq = Number(body.seq);
      if (!Number.isInteger(seq) || seq < 0 || seq >= MAX_CHUNKS) { const c = await check(); return c.e || err(400, 'הקטע אינו תקין'); }
      const audio = typeof body.audio === 'string' ? body.audio : '';
      const pre = await check(); if (pre.e) return pre.e;
      const tr0 = (await store.get(pre.tKey)) || { segments: [] };
      if ((tr0.segments || []).some((x) => x.seq === seq)) return [200, { ok: true, dup: true }];
      if (!audio || audio.length > MAX_AUDIO_B64 || !/^[A-Za-z0-9+/=]+$/.test(audio)) return err(413, 'הקטע גדול מדי או אינו תקין');
      const out = await transcribe(fetchImpl, env, audio, str(body.mime, 60), pre.d.parts.profile?.lang);
      if (out.error) return err(503, out.error);
      return await locked(pre.ref.id, async () => {
        const c = await check(); if (c.e) return c.e;
        const tr = (await store.get(c.tKey)) || { segments: [], marks: [] };
        if (tr.segments.some((x) => x.seq === seq)) return [200, { ok: true, dup: true }];
        tr.at = tr.at || new Date(now()).toISOString();
        tr.segments.push({ seq, t: Math.max(0, Number(body.t) || 0), round: Math.max(1, Math.min(9, Number(body.round) || 1)), text: out.text });
        tr.segments.sort((a, b) => a.seq - b.seq);
        if (JSON.stringify(tr).length > MAX_TRANSCRIPT) return err(413, 'התמליל ארוך מדי. אפשר לסיים את ההקלטה');
        await store.set(c.tKey, tr);
        return [200, { ok: true, chars: out.text.length }];
      });
    }

    const me = await who(body.token);
    if (!me) return err(401, 'כדי להמשיך, אפשר להיכנס עם קוד שיש בו את מערך המוכנות');

    if (action === 'rdyMine') {
      const rows = await store.list('rdy:');
      const docs = rows.map((r) => r.value).filter((d) => d && d.id && canSee(d, me));
      // תמלילים ישנים (מעל 30 יום) נמחקים גם בלי שמישהו פותח אותם
      for (const d of docs) for (const t of await store.list('rdyt:' + d.id + ':')) if (t.value && t.value.at && Date.parse(t.value.at) < now() - 30 * 864e5) await store.del(t.key);
      const mine = docs.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0, 60).map(summary);
      return [200, { items: mine }];
    }

    if (action === 'rdyCreate') {
      const profile = body.profile && typeof body.profile === 'object' ? body.profile : {};
      const name = str(profile.name, 120);
      if (!name) return err(400, 'כדי לפתוח מערך, אפשר לכתוב את שם בית הספר או הארגון');
      if (hasIdNumber(profile)) return err(400, 'נראה שיש כאן מספר זהות. פרטים של תלמידים לא נשמרים במערך');
      const owner = ownerOf(me);
      const count = (await store.list('rdy:')).filter((r) => r.value && r.value.owner === owner).length;
      // לבית ספר (או לארגון) יש מערך מוכנות אחד (04/11/2026: "לבי"ס יש מערך מוכנות אחד"). רק מנהלת המערכת פותחת כמה.
      if (owner !== 'sys' && count >= 1) {
        const have = (await store.list('rdy:')).find((r) => r.value && r.value.owner === owner);
        return [409, { error: 'לבית הספר כבר יש מערך מוכנות. הוא נפתח עכשיו.', id: have && have.value.id }];
      }
      if (count >= MAX_MINE) return err(429, 'יש כבר הרבה מערכים. אפשר למחוק מערך ישן ולנסות שוב');
      const at = new Date(now()).toISOString();
      const d = { id: randomUUID(), owner, createdAt: at, updatedAt: at, rev: 1, revs: {}, log: [{ at, by: str(body.by, 60) || 'צוות', what: 'פתיחת מערך המוכנות' }],
        parts: { profile: { ...profile, name } } };
      for (const p of RDY_PARTS) d.revs[p] = 0;
      await store.set('rdy:' + d.id, d);
      return [201, { doc: publicDoc(d) }];
    }

    // עדכון לכל צוות במייל (החלטה 5): רק לכתובות שרשומות בצוותים של המערך (לפחות 24 שעות), ולאורחים שנרשמו במפגש.
    // ההכנה והספירה בתוך הנעילה, השליחה עצמה מחוץ לה, ואז רישום בתוך הנעילה.
    if (action === 'rdyMail') {
      const id = body.id;
      if (!okId(id)) return err(404, 'המערך לא נמצא');
      const items = Array.isArray(body.items) ? body.items.slice(0, 20) : [];
      const subject = str(body.subject, 140) || 'עדכון בתרגיל';
      const available = !!(env.RESEND_API_KEY && env.NOTIFY_FROM);
      const plan = await locked(id, async () => {
        const d = await loadDoc(store, id, me);
        if (!d) return { e: err(404, 'המערך לא נמצא') };
        if (hasIdNumber(subject) || items.some((it) => hasIdNumber(str(it && it.text, 4000)))) return { e: err(400, ID_MSG) };
        if (!available) return { e: [200, { sent: 0, skipped: 0, available: false }] };
        const nowMs = now(), day = new Date(nowMs).toISOString().slice(0, 10);
        d.mail = d.mail && d.mail.day === day ? d.mail : { day, n: 0 };
        const teams = Array.isArray(d.parts.teams) ? d.parts.teams : [];
        const teamList = teamEmails(teams), teamSet = new Set(teamList);
        noteEmails(d, teamList, nowMs);
        // סיכום מפגש: נשלח רק למי שנרשם/ה כמשתתף/ת במפגש (צ'ק־אין), וכתובת רק מתוך הצוותים או מרשימת המשתתפים של המפגש
        const rec = body.meetingId ? recTarget(d, body.meetingId) : null;
        const here = rec && Array.isArray(rec.attendees) ? rec.attendees.filter((a) => a && a.here).map((a) => str(a.email, 254).toLowerCase()).filter((e) => EMAIL_RE.test(e)) : [];
        const hereSet = new Set(here);
        // אורחים: עד 10 למפגש, ועד 30 כתובות שונות ביום לכל מערך. כתובת חדשה בצוותים שנרשמה במפגש נספרת כאורח/ת.
        const isGuest = (e) => hereSet.has(e) && (!teamSet.has(e) || !mature(d, e, nowMs));
        const guests = [...hereSet].filter(isGuest).slice(0, 10);
        d.guestMail = d.guestMail && d.guestMail.day === day ? d.guestMail : { day, list: [] };
        const okGuest = new Set();
        for (const e of guests) { if (d.guestMail.list.includes(e)) okGuest.add(e); else if (d.guestMail.list.length < 30) { d.guestMail.list.push(e); okGuest.add(e); } }
        let skipped = 0, skippedNew = 0;
        const can = (e) => okGuest.has(e) || (teamSet.has(e) && mature(d, e, nowMs));
        const isNew = (e) => teamSet.has(e) && !mature(d, e, nowMs) && !okGuest.has(e);
        const sends = [];
        for (const it of items) {
          const team = teams.find((t) => t && t.id === (it && it.teamId));
          const text = str(it && it.text, 4000);
          const direct = it && Array.isArray(it.to) ? [...new Set(it.to.map((e) => str(e, 254).toLowerCase()).filter((e) => teamSet.has(e) || hereSet.has(e)))].slice(0, 60) : null;
          if (!text || (!team && !direct)) { skipped++; continue; }
          const cands = direct || [...new Set(teamEmails([team]))];
          const head = (str(d.parts.profile?.name, 120) || 'מערך המוכנות') + (team ? ' · ' + str(team.name, 80) : '');
          const html = '<div dir="rtl" style="font-family:Arial,Helvetica,sans-serif;font-size:17px;line-height:1.7;color:#14212B;max-width:560px">' +
            '<p style="color:#2F7D7A;font-weight:700;margin:0 0 6px">' + esc(head) + '</p>' +
            '<p style="font-size:20px;font-weight:700;margin:0 0 10px">' + esc(subject) + '</p>' +
            '<p>' + esc(text).replace(/\n/g, '<br>') + '</p>' +
            '<p style="font-size:12.5px;color:#5B6873;border-top:1px solid #ddd;padding-top:8px">' + (direct ? 'זה סיכום מפגש במערך המוכנות של Begood. הוא נשלח למי שהשתתף/ה במפגש.' : 'זה עדכון מתרגיל צוות במערך המוכנות של Begood. העדכון מגיע רק לצוות שלך. מה לשתף עם שאר הצוותים, מחליטים אתם.') + '</p></div>';
          for (const to of cands) {
            if (!can(to)) { if (isNew(to)) skippedNew++; else skipped++; continue; }
            if (d.mail.n >= MAX_MAIL_DAY) { skipped++; continue; }
            d.mail.n++;
            sends.push({ to, subject: subject + (team ? ' · ' + str(team.name, 60) : ''), text: head + '\n\n' + subject + '\n\n' + text, html });
          }
        }
        await store.set('rdy:' + d.id, d);
        return { sends, skipped, skippedNew, day };
      });
      if (plan.e) return plan.e;
      let sent = 0, failed = 0;
      for (const m of plan.sends) { if (await sendMail(fetchImpl, env, m.to, m.subject, m.text, m.html)) sent++; else failed++; }
      await locked(id, async () => {
        const d = await store.get('rdy:' + id);
        if (!d) return;
        if (failed && d.mail && d.mail.day === plan.day) d.mail.n = Math.max(0, d.mail.n - failed);
        // רישום בשינויים: כמה נשלחו ועל מה, בלי כתובות
        if (sent || failed) {
          const at = new Date(now()).toISOString();
          d.log = Array.isArray(d.log) ? d.log : [];
          d.log.push({ at, by: str(body.by, 60) || 'צוות', part: 'mail', what: 'מייל: ' + sent + ' נשלחו' + (failed ? ', ' + failed + ' לא נשלחו' : '') + ' · ' + subject });
          if (d.log.length > MAX_LOG) d.log = d.log.slice(-MAX_LOG);
        }
        await store.set('rdy:' + d.id, d);
      });
      const res = { sent, skipped: plan.skipped + failed + plan.skippedNew, available: true };
      // כתובות שנוספו לצוותים בתוך 24 השעות האחרונות מקבלות מייל רק מחר
      if (plan.skippedNew) { res.skippedNew = plan.skippedNew; res.reason = 'new'; }
      return [200, res];
    }

    const id = body.id;
    return await locked(okId(id) ? id : 'none', async () => {
      const d = await loadDoc(store, id, me);
      if (!d) return err(404, 'המערך לא נמצא');

      if (action === 'rdyGet') return [200, { doc: publicDoc(d) }];

      if (action === 'rdyDelete') {
        // מחיקת המערך כולו (כולל תמלילים וקבצים): רק מנהלת המערכת
        if (!me.sys) return err(403, 'מחיקת המערך נעשית רק דרך Begood');
        for (const r of await store.list('rdyt:' + d.id + ':', { keysOnly: true })) await store.del(r.key);
        for (const r of await store.list('rdyf:' + d.id + ':', { keysOnly: true })) await store.del(r.key);
        await store.del('rdy:' + d.id);
        return [200, { ok: true }];
      }

      if (action === 'rdySave') {
        const part = String(body.part || '');
        if (!RDY_PARTS.includes(part)) return err(400, 'החלק אינו מוכר');
        // בלי מספר גרסה אין שמירה: אחרת שמירה ישנה מוחקת בשקט את מה שמישהו אחר כתב (המסך תמיד שולח rev)
        if (body.rev === undefined || body.rev === null || body.rev === '' || !Number.isFinite(Number(body.rev))) return err(400, 'השמירה צריכה את מספר הגרסה. אפשר לטעון את המסך מחדש ולנסות שוב');
        const base = Number(body.rev);
        if (base !== (d.revs[part] || 0)) return [409, { error: 'מישהו אחר עדכן את החלק הזה. המסך נטען מחדש עם הגרסה העדכנית', doc: publicDoc(d) }];
        const value = body.value;
        if (value === undefined) return err(400, 'אין מה לשמור');
        const json = JSON.stringify(value);
        if (json.length > MAX_PART) return err(413, 'החלק גדול מדי');
        if (hasIdNumber(value)) return err(400, 'נראה שיש כאן מספר זהות. פרטים של תלמידים לא נשמרים במערך');
        if (part === 'profile' && !str(value && value.name, 120)) return err(400, 'שם בית הספר או הארגון הוא שדה עיקרי');
        const before = d.parts[part];
        if (part === 'teams') seenMap(d); // לפני ההחלפה: כתובות שכבר היו נחשבות ישנות
        d.parts[part] = value;
        if (part === 'teams') noteEmails(d, teamEmails(value), now());
        if (JSON.stringify(d).length > MAX_DOC) { d.parts[part] = before; return err(413, 'המערך גדול מדי. אפשר לקצר טקסטים ארוכים'); }
        d.revs[part] = (d.revs[part] || 0) + 1;
        d.rev = (d.rev || 1) + 1;
        d.updatedAt = new Date(now()).toISOString();
        const what = str(body.what, 200);
        if (what) { d.log.push({ at: d.updatedAt, by: str(body.by, 60) || 'צוות', part, what }); if (d.log.length > MAX_LOG) d.log = d.log.slice(-MAX_LOG); }
        await store.set('rdy:' + d.id, d);
        return [200, { rev: d.revs[part], updatedAt: d.updatedAt }];
      }

      // הקלטה בטלפון: פתיחת קישור לרשם/ת, אחרי הסכמה של כל המשתתפים.
      if (action === 'rdyRecStart') {
        const ex = recTarget(d, body.exId);
        if (!ex) return err(404, 'התרגיל או המפגש לא נמצאו');
        if (body.consent !== true) return err(400, 'ההקלטה מתחילה רק אחרי שכולם הסכימו');
        const rk = randomBytes(24).toString('hex');
        // מפתח פעיל אחד לכל תרגיל או מפגש: קישור חדש מבטל את הקודם
        await cancelKey(d, body.exId);
        await store.set('rdyk:' + hash(rk), { id: d.id, exId: body.exId, exp: now() + REC_HOURS * 3600e3 });
        d.recKeys = d.recKeys && typeof d.recKeys === 'object' ? d.recKeys : {};
        d.recKeys[body.exId] = hash(rk);
        ex.rec = { on: true, consentAt: new Date(now()).toISOString() }; bumpRev(d, recPart(d, body.exId));
        await store.set('rdy:' + d.id, d);
        return [200, { rk, hours: REC_HOURS }];
      }

      if (/^rdyTranscript(Get|Save|Delete)$/.test(action)) {
        if (!recTarget(d, body.exId)) return err(404, 'התרגיל או המפגש לא נמצאו');
        const tKey = 'rdyt:' + d.id + ':' + body.exId;
        if (action === 'rdyTranscriptDelete') {
          // גם המפתח של הטלפון מבוטל, כדי שקטע שמגיע אחר כך לא ייצור את התמליל מחדש
          const had = await cancelKey(d, body.exId);
          const ex = recTarget(d, body.exId);
          if (had || (ex && ex.rec && ex.rec.on)) {
            if (ex && ex.rec && ex.rec.on) { ex.rec = { ...ex.rec, on: false, stoppedAt: new Date(now()).toISOString() }; bumpRev(d, recPart(d, body.exId)); }
            await store.set('rdy:' + d.id, d);
          }
          await store.del(tKey); return [200, { ok: true }];
        }
        const tr = (await store.get(tKey)) || { segments: [], marks: [] };
        // תמליל נשמר עד 30 יום, גם כשהתרגיל או המפגש לא הושלמו
        if (tr.at && Date.parse(tr.at) < now() - 30 * 864e5) { await store.del(tKey); return [200, { transcript: { segments: [], marks: [] }, expired: true }]; }
        if (action === 'rdyTranscriptGet') return [200, { transcript: tr }];
        // עריכת התמליל לפני שהוא משמש לדוח (למשל שם שנאמר בטעות)
        const segs = Array.isArray(body.segments) ? body.segments.slice(0, MAX_CHUNKS).map((s, i) => ({ seq: Number(s && s.seq) || i, t: Number(s && s.t) || 0, round: Number(s && s.round) || 1, text: str(s && s.text, 20000) })) : tr.segments;
        const next = { segments: segs, marks: tr.marks, edited: new Date(now()).toISOString(), at: tr.at || new Date(now()).toISOString() };
        if (JSON.stringify(next).length > MAX_TRANSCRIPT) return err(413, 'התמליל ארוך מדי');
        if (hasIdNumber(segs)) return err(400, 'נראה שיש כאן מספר זהות. אפשר למחוק אותו לפני השמירה');
        await store.set(tKey, next);
        return [200, { ok: true }];
      }

      // תיקיית המוכנות: העלאה (מחליפה את הגרסה הקודמת), פתיחה ומחיקה
      if (/^rdyFile(Put|Get|Del)$/.test(action)) {
        let it = binderItem(d, body.key);
        // קובץ של פריט שכבר הוסר מהרשימה: אפשר עדיין לפתוח ולמחוק אותו
        if (!it && action !== 'rdyFilePut' && d.files && d.files[body.key] && /^(m\d|c[a-z0-9]{4,14})$/.test(body.key)) it = { key: body.key, sens: false };
        if (!it) return err(404, 'הפריט לא נמצא ברשימה');
        const fKey = 'rdyf:' + d.id + ':' + it.key;
        d.files = d.files && typeof d.files === 'object' ? d.files : {};
        if (action === 'rdyFileGet') {
          const f = await store.get(fKey);
          return f ? [200, { file: f, meta: d.files[it.key] || null }] : err(404, 'הקובץ לא נמצא');
        }
        const at = new Date(now()).toISOString(), by = str(body.by, 60) || 'צוות';
        const logIt = (what) => { d.log.push({ at, by, part: 'binder', what }); if (d.log.length > MAX_LOG) d.log = d.log.slice(-MAX_LOG); };
        if (action === 'rdyFileDel') {
          const old = d.files[it.key];
          await store.del(fKey); delete d.files[it.key];
          d.updatedAt = at; if (old) logIt('מחיקת קובץ מתיקיית המוכנות: ' + str(old.title, 120));
          await store.set('rdy:' + d.id, d);
          return [200, { ok: true, files: d.files }];
        }
        // rdyFilePut
        if (body.noStudents !== true) return err(400, 'לפני ההעלאה, אפשר לאשר שאין בקובץ פרטים של תלמידים או הורים');
        if (it.sens) return err(400, 'זה פריט עם פרטים של תלמידים, הורים או אנשי צוות. הוא נשמר בבית הספר, ובמערך רק כותבים איפה הוא נמצא ומתי עודכן');
        const title = str(body.title, 120);
        if (vagueTitle(title)) return err(400, 'כדי שכולם ימצאו את הקובץ, אפשר לתת לו שם ברור, למשל: מפת המבנה, קומה א׳ וב׳');
        if (hasIdNumber(title)) return err(400, 'נראה שיש בשם מספר זהות. אפשר למחוק אותו');
        if (!okDate(body.date)) return err(400, 'תאריך העדכון של הקובץ הוא שדה עיקרי');
        if (Date.parse(body.date) > now() + 2 * 864e5) return err(400, 'תאריך העדכון לא יכול להיות בעתיד');
        const mime = str(body.mime, 120).toLowerCase();
        if (!FILE_TYPES.includes(mime)) return err(400, 'אפשר להעלות PDF, תמונה, Word, Excel, PowerPoint או טקסט');
        const data = typeof body.data === 'string' ? body.data : '';
        if (!data || data.length > MAX_FILE_B64 || !/^[A-Za-z0-9+/=]+$/.test(data)) return err(413, 'הקובץ גדול מדי (עד כ־4 מגה) או אינו תקין');
        const bytes = Buffer.from(data, 'base64');
        const head = bytes.subarray(0, 8).toString('latin1');
        const magicOk = mime === 'application/pdf' ? head.startsWith('%PDF') : mime === 'image/png' ? head.startsWith('\x89PNG') : mime === 'image/jpeg' ? bytes[0] === 0xff && bytes[1] === 0xd8 : mime === 'image/webp' ? head.startsWith('RIFF')
          : /openxmlformats/.test(mime) ? head.startsWith('PK') : /msword|ms-excel/.test(mime) ? bytes[0] === 0xd0 && bytes[1] === 0xcf : true;
        if (!magicOk) return err(400, 'סוג הקובץ לא תואם לתוכן שלו. אפשר לשמור אותו שוב בתוכנה המקורית ולהעלות');
        if (/^text\//.test(mime) && hasIdNumber(bytes.toString('utf8'))) return err(400, 'נראה שיש בקובץ מספר זהות. פרטים של תלמידים לא נשמרים במערך');
        // קבצי Word ו-Excel: בודקים את הטקסט שבתוכם (רק קבצים שלא דחוסים לגמרי נבדקים כך; השאר נשען על האישור של המעלה/ת)
        if (/openxmlformats/.test(mime) && hasIdNumber(bytes.toString('latin1').replace(/[^\x20-\x7e]/g, ' '))) return err(400, 'נראה שיש בקובץ מספר זהות. פרטים של תלמידים לא נשמרים במערך');
        if (!d.files[it.key] && Object.keys(d.files).length >= MAX_FILES) return err(409, 'הגענו למספר הקבצים המרבי בתיקייה. אפשר למחוק קובץ שכבר לא בשימוש');
        const replaced = !!d.files[it.key];
        await store.set(fKey, { data, mime, name: str(body.name, 160) });
        d.files[it.key] = { title, date: body.date, name: str(body.name, 160), mime, size: Math.round(data.length * 0.75), at, by };
        d.updatedAt = at; logIt((replaced ? 'גרסה חדשה בתיקיית המוכנות: ' : 'קובץ חדש בתיקיית המוכנות: ') + title);
        await store.set('rdy:' + d.id, d);
        return [200, { ok: true, replaced, files: d.files }];
      }

      return err(405, 'פעולה אינה נתמכת');
    });
  } catch (e) {
    console.error('readiness failed');
    return err(500, 'לא ניתן להשלים את הפעולה. הנתונים הקודמים נשמרו; אפשר לנסות שוב');
  }
}
