// מערך המוכנות (03/11/2026; docs/readiness-program).
// כל בית ספר פותח מערך מוכנות משלו. המערך נשמר בשרת תחת הקוד של המוסד (כמו תרגול צוותים ומעבדת האופק),
// כי המתווה מבקש עדכונים במייל לכל צוות, קצוות פתוחים ומעקב לאורך שנה (00-screen-plan.md, סעיף 3).
//  - rdy:<id>            המערך: פרופיל, תוכנית ונספחים, צוותים, משימות, פערים, קצוות פתוחים, פעולות, תרגילים, רישום שינויים.
//  - rdyt:<id>:<exId>    תמליל התרגיל (נמחק כשהדוח מאושר).
//  - rdyk:<sha>          מפתח ההקלטה בטלפון של הרשם/ת (6 שעות), בלי קוד Begood.
// לא נשמרים שמות ופרטים של תלמידים (החלטה 7): מספר בן 9 ספרות (תעודת זהות) נפסל בשמירה.
// הקול לא נשמר בשום מקום: קטע עובר לתמלול ונזרק (החלטה 28, 03/11/2026: "להוסיף במכשיר נייד").
import { createHash, randomBytes, randomUUID } from 'node:crypto';

export const RDY_PARTS = ['profile', 'plan', 'teams', 'tasks', 'em', 'mapping', 'gaps', 'ends', 'actions', 'exercises', 'sessions', 'partners', 'ideas', 'scenarios', 'learning', 'compare', 'decmap', 'meetings'];
const MAX_PART = 400_000, MAX_DOC = 1_800_000, MAX_MINE = 30, MAX_LOG = 400;
const MAX_MAIL_DAY = 300, REC_HOURS = 6, MAX_CHUNKS = 400, MAX_AUDIO_B64 = 3_000_000, MAX_TRANSCRIPT = 600_000;

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
const EMAIL_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]{2,}$/;
const str = (v, max = 200) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max);
const err = (status, error) => [status, { error }];

// פרטים מזהים של תלמידים לא נכנסים: תעודת זהות (9 ספרות רצופות) בשום שדה.
export function hasIdNumber(value) {
  return /(^|[^\d])\d{9}([^\d]|$)/.test(typeof value === 'string' ? value : JSON.stringify(value));
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
const publicDoc = (d) => ({ id: d.id, createdAt: d.createdAt, updatedAt: d.updatedAt, rev: d.rev, revs: d.revs, parts: d.parts, log: d.log.slice(-120) });

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

    // ההקלטה בטלפון: מפתח בלבד, בלי קוד Begood.
    if (/^rdyRec(Chunk|Mark|Stop|Ping)$/.test(action)) {
      const rk = typeof body.rk === 'string' && /^[a-f0-9]{48}$/.test(body.rk) ? body.rk : '';
      const ref = rk ? await store.get('rdyk:' + hash(rk)) : null;
      if (!ref || ref.exp < now()) return err(401, 'הקישור להקלטה הסתיים. אפשר לפתוח קישור חדש ממסך התרגיל');
      return await locked(ref.id, async () => {
        const d = await store.get('rdy:' + ref.id);
        const ex = recTarget(d, ref.exId);
        if (!ex) return err(404, 'התרגיל או המפגש לא נמצאו');
        const tKey = 'rdyt:' + ref.id + ':' + ref.exId;
        const tr = (await store.get(tKey)) || { segments: [], marks: [] };
        if (action === 'rdyRecPing') return [200, { ok: true, title: str(d.parts.profile?.name, 120), round: ex.round || 1, lang: d.parts.profile?.lang === 'ar' ? 'ar' : 'he', segments: tr.segments.length, marks: tr.marks.length }];
        if (action === 'rdyRecStop') { ex.rec = { ...(ex.rec || {}), on: false, stoppedAt: new Date(now()).toISOString() }; await store.set('rdy:' + d.id, d); await store.del('rdyk:' + hash(rk)); return [200, { ok: true }]; }
        if (action === 'rdyRecMark') {
          if (tr.marks.length >= 300) return err(409, 'הגענו למספר הסימונים המרבי בתרגיל');
          const t = Math.max(0, Math.min(36e6, Number(body.t) || 0));
          tr.marks.push({ t, round: Math.max(1, Math.min(9, Number(body.round) || ex.round || 1)), note: str(body.note, 300), at: new Date(now()).toISOString() });
          await store.set(tKey, tr);
          return [200, { ok: true, marks: tr.marks.length }];
        }
        // rdyRecChunk
        const seq = Number(body.seq);
        if (!Number.isInteger(seq) || seq < 0 || seq >= MAX_CHUNKS) return err(400, 'הקטע אינו תקין');
        if (tr.segments.some((s) => s.seq === seq)) return [200, { ok: true, dup: true }];
        const audio = typeof body.audio === 'string' ? body.audio : '';
        if (!audio || audio.length > MAX_AUDIO_B64 || !/^[A-Za-z0-9+/=]+$/.test(audio)) return err(413, 'הקטע גדול מדי או אינו תקין');
        const out = await transcribe(fetchImpl, env, audio, str(body.mime, 60), d.parts.profile?.lang);
        if (out.error) return err(503, out.error);
        tr.segments.push({ seq, t: Math.max(0, Number(body.t) || 0), round: Math.max(1, Math.min(9, Number(body.round) || 1)), text: out.text });
        tr.segments.sort((a, b) => a.seq - b.seq);
        if (JSON.stringify(tr).length > MAX_TRANSCRIPT) return err(413, 'התמליל ארוך מדי. אפשר לסיים את ההקלטה');
        await store.set(tKey, tr);
        return [200, { ok: true, chars: out.text.length }];
      });
    }

    const me = await who(body.token);
    if (!me) return err(401, 'כדי להמשיך, אפשר להיכנס עם קוד שיש בו את מערך המוכנות');

    if (action === 'rdyMine') {
      const rows = await store.list('rdy:');
      const mine = rows.map((r) => r.value).filter((d) => d && d.id && canSee(d, me))
        .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0, 60).map(summary);
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

    const id = body.id;
    return await locked(okId(id) ? id : 'none', async () => {
      const d = await loadDoc(store, id, me);
      if (!d) return err(404, 'המערך לא נמצא');

      if (action === 'rdyGet') return [200, { doc: publicDoc(d) }];

      if (action === 'rdyDelete') {
        for (const r of await store.list('rdyt:' + d.id + ':', { keysOnly: true })) await store.del(r.key);
        await store.del('rdy:' + d.id);
        return [200, { ok: true }];
      }

      if (action === 'rdySave') {
        const part = String(body.part || '');
        if (!RDY_PARTS.includes(part)) return err(400, 'החלק אינו מוכר');
        const base = Number(body.rev);
        if (Number.isFinite(base) && base !== (d.revs[part] || 0)) return [409, { error: 'מישהו אחר עדכן את החלק הזה. המסך נטען מחדש עם הגרסה העדכנית', doc: publicDoc(d) }];
        const value = body.value;
        const json = JSON.stringify(value === undefined ? null : value);
        if (json.length > MAX_PART) return err(413, 'החלק גדול מדי');
        if (hasIdNumber(value)) return err(400, 'נראה שיש כאן מספר זהות. פרטים של תלמידים לא נשמרים במערך');
        if (part === 'profile' && !str(value && value.name, 120)) return err(400, 'שם בית הספר או הארגון הוא שדה עיקרי');
        const before = d.parts[part];
        d.parts[part] = value;
        if (JSON.stringify(d).length > MAX_DOC) { d.parts[part] = before; return err(413, 'המערך גדול מדי. אפשר לקצר טקסטים ארוכים'); }
        d.revs[part] = (d.revs[part] || 0) + 1;
        d.rev = (d.rev || 1) + 1;
        d.updatedAt = new Date(now()).toISOString();
        const what = str(body.what, 200);
        if (what) { d.log.push({ at: d.updatedAt, by: str(body.by, 60) || 'צוות', part, what }); if (d.log.length > MAX_LOG) d.log = d.log.slice(-MAX_LOG); }
        await store.set('rdy:' + d.id, d);
        return [200, { rev: d.revs[part], updatedAt: d.updatedAt }];
      }

      // עדכון לכל צוות במייל (החלטה 5): רק לכתובות שרשומות בצוותים של המערך.
      if (action === 'rdyMail') {
        const items = Array.isArray(body.items) ? body.items.slice(0, 20) : [];
        const day = new Date(now()).toISOString().slice(0, 10);
        d.mail = d.mail && d.mail.day === day ? d.mail : { day, n: 0 };
        const teams = Array.isArray(d.parts.teams) ? d.parts.teams : [];
        const subject = str(body.subject, 140) || 'עדכון בתרגיל';
        let sent = 0, skipped = 0;
        for (const it of items) {
          const team = teams.find((t) => t && t.id === it.teamId);
          const text = str(it.text, 4000);
          if (!team || !text) { skipped++; continue; }
          const emails = [...new Set((team.members || []).concat(team.lead || [], team.deputy || []).map((m) => str(m && m.email, 254)).filter((e) => EMAIL_RE.test(e)))];
          for (const to of emails) {
            if (d.mail.n >= MAX_MAIL_DAY) { skipped++; continue; }
            const head = (str(d.parts.profile?.name, 120) || 'מערך המוכנות') + ' · ' + str(team.name, 80);
            const html = '<div dir="rtl" style="font-family:Arial,Helvetica,sans-serif;font-size:17px;line-height:1.7;color:#14212B;max-width:560px">' +
              '<p style="color:#2F7D7A;font-weight:700;margin:0 0 6px">' + esc(head) + '</p>' +
              '<p style="font-size:20px;font-weight:700;margin:0 0 10px">' + esc(subject) + '</p>' +
              '<p>' + esc(text).replace(/\n/g, '<br>') + '</p>' +
              '<p style="font-size:12.5px;color:#5B6873;border-top:1px solid #ddd;padding-top:8px">זה עדכון מתרגיל צוות במערך המוכנות של Begood. העדכון מגיע רק לצוות שלך. מה לשתף עם שאר הצוותים, מחליטים אתם.</p></div>';
            const ok = await sendMail(fetchImpl, env, to, subject + ' · ' + str(team.name, 60), head + '\n\n' + subject + '\n\n' + text, html);
            if (ok) { sent++; d.mail.n++; } else skipped++;
          }
        }
        await store.set('rdy:' + d.id, d);
        return [200, { sent, skipped, available: !!(env.RESEND_API_KEY && env.NOTIFY_FROM) }];
      }

      // הקלטה בטלפון: פתיחת קישור לרשם/ת, אחרי הסכמה של כל המשתתפים.
      if (action === 'rdyRecStart') {
        const ex = recTarget(d, body.exId);
        if (!ex) return err(404, 'התרגיל או המפגש לא נמצאו');
        if (body.consent !== true) return err(400, 'ההקלטה מתחילה רק אחרי שכולם הסכימו');
        const rk = randomBytes(24).toString('hex');
        await store.set('rdyk:' + hash(rk), { id: d.id, exId: body.exId, exp: now() + REC_HOURS * 3600e3 });
        ex.rec = { on: true, consentAt: new Date(now()).toISOString() };
        await store.set('rdy:' + d.id, d);
        return [200, { rk, hours: REC_HOURS }];
      }

      if (/^rdyTranscript(Get|Save|Delete)$/.test(action)) {
        if (!recTarget(d, body.exId)) return err(404, 'התרגיל או המפגש לא נמצאו');
        const tKey = 'rdyt:' + d.id + ':' + body.exId;
        if (action === 'rdyTranscriptDelete') { await store.del(tKey); return [200, { ok: true }]; }
        const tr = (await store.get(tKey)) || { segments: [], marks: [] };
        if (action === 'rdyTranscriptGet') return [200, { transcript: tr }];
        // עריכת התמליל לפני שהוא משמש לדוח (למשל שם שנאמר בטעות)
        const segs = Array.isArray(body.segments) ? body.segments.slice(0, MAX_CHUNKS).map((s, i) => ({ seq: Number(s && s.seq) || i, t: Number(s && s.t) || 0, round: Number(s && s.round) || 1, text: str(s && s.text, 20000) })) : tr.segments;
        const next = { segments: segs, marks: tr.marks, edited: new Date(now()).toISOString() };
        if (JSON.stringify(next).length > MAX_TRANSCRIPT) return err(413, 'התמליל ארוך מדי');
        if (hasIdNumber(segs)) return err(400, 'נראה שיש כאן מספר זהות. אפשר למחוק אותו לפני השמירה');
        await store.set(tKey, next);
        return [200, { ok: true }];
      }

      return err(405, 'פעולה אינה נתמכת');
    });
  } catch (e) {
    console.error('readiness failed');
    return err(500, 'לא ניתן להשלים את הפעולה. הנתונים הקודמים נשמרו; אפשר לנסות שוב');
  }
}
