// מחקר שיחות מאתגרות: מסלול הסטודנטיות (18/11/2026: "הוסף לכאן קישור לכלי השיחות המאתגרות והתאם אותו למחקר...
// אפשר כניסת סטודנטיות לכלי זה בלבד... ודא שהכלי מחובר למרכז המחקר").
// מרכז המחקר (מנהלת המערכת) יוצר קישור לקבוצה (tsc:<קוד>), ולכל מי שנכנס/ה בקישור: קוד משתתף/ת אקראי ומפתח במכשיר,
// בלי שם ובלי קוד Begood (tsp:<קוד>:<משתתף/ת>). המייל לדו"ח האישי, רק למי שביקש/ה, נשמר בנפרד (tse:).
// השרת שומר רק את מה שהמשתתף/ת שלח/ה: הסכמה, שאלונים, המקרה, בחירת המודל, תמליל התרגול והמשוב, ורפלקציה.
// פנייה למודל: רק מ-talk-practice.html ומ-talk-plan.html, רק כשהקבוצה פתוחה ורק עם המפתח האישי (tsModelGate ב-authorizeModel).
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const TS_PRACTICE_PAGE = 'talk-practice.html';
// תכנון השיחה במסלול (23/11/2026: "המסלול עם טופס תכנון השיחה"): talk-plan.html = conversation-planner.html במצב מחקר
export const TS_PLAN_PAGE = 'talk-plan.html';
const TS_PAGES = [TS_PRACTICE_PAGE, TS_PLAN_PAGE];
const LIM = { classes: 60, participants: 400, part: 220_000, text: 4000 };
// autosave: התרגול נשמר תוך כדי (24/11/2026: "תוסיף שמירה אוטומטית"); extra: תרגיל נוסף שהסטודנט/ית פתח/ה מעבר לשלבי המפגש ("סטודנטית שולטת בתרגילים שלה")
const PARTS = ['pre', 'case', 'model', 'practice', 'post', 'reflection', 'autosave', 'extra'];
const ALPH = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const genCode = (n) => { let s = ''; for (const b of randomBytes(n)) s += ALPH[b % ALPH.length]; return s; };
const hash = (v) => createHash('sha256').update(String(v)).digest('hex');
const now = () => new Date().toISOString();
const okCode = (v) => typeof v === 'string' && /^[A-Z2-9]{8}$/.test(v);
const okPid = (v) => typeof v === 'string' && /^[A-Z2-9]{6}$/.test(v);
const clip = (v, n = LIM.text) => String(v == null ? '' : v).replace(/\u0000/g, '').slice(0, n).trim();
const pause = () => new Promise((r) => setTimeout(r, 250));
export class TsError extends Error { constructor(msg, status = 400) { super(msg); this.status = status; } }

const keyOk = (p, key) => {
  if (!p || typeof key !== 'string' || key.length < 20) return false;
  const a = Buffer.from(hash(key)), b = Buffer.from(String(p.keyHash || ''));
  return a.length === b.length && timingSafeEqual(a, b);
};
const classView = (c) => ({ code: c.code, studyId: c.studyId, studyTitle: c.studyTitle, group: c.group, label: c.label, status: c.status, createdAt: c.createdAt });
const participantView = (p) => ({ pid: p.pid, code: p.code, group: p.group, createdAt: p.createdAt, consent: p.consent, report: !!p.report, sessions: p.sessions || {} });

async function participant(store, d) {
  const code = String(d.code || ''), pid = String(d.pid || '');
  if (!okCode(code) || !okPid(pid)) throw new TsError('הקישור אינו שלם', 404);
  const [c, p] = await Promise.all([store.get('tsc:' + code), store.get('tsp:' + code + ':' + pid)]);
  if (!c || !p || !keyOk(p, d.key)) { await pause(); throw new TsError('ההשתתפות לא נמצאה', 404); }
  return { c, p };
}

export async function tsModelGate(store, auth, page) {
  if (!TS_PAGES.includes(page) || !auth || typeof auth.ts !== 'object') return null;
  try {
    const { c, p } = await participant(store, { code: auth.ts.c, pid: auth.ts.p, key: auth.ts.key });
    if (c.status !== 'open') return null;
    return { principal: 'ts:' + c.code + ':' + p.pid, institution: 'ts:' + c.code };
  } catch { return null; }
}

// isSys: מנהלת המערכת (מרכז המחקר). notify(subject, text): הודעה למנהלת המערכת (רשות)
// tester: מי שמותר לו/ה קוד הבדיקה 7777 (מנהלת המערכת, ועינת ואיבנה לפי הרשאת dilemma או credibility). רק f.test.
export async function handleTalkStudy(store, body, { isSys = false, tester = false } = {}) {
  try {
    if (body.action !== 'tsCall') throw new TsError('פעולה אינה נתמכת', 405);
    if (JSON.stringify(body.input || {}).length > 400_000) throw new TsError('הבקשה גדולה מדי', 413);
    const op = String(body.op || ''), d = body.input && typeof body.input === 'object' ? body.input : {};

    // ═══ מרכז המחקר ═══
    // קוד הבדיקה 7777 (22/11/2026, זמני): מוצא או פותח את קבוצת הבדיקה הקבועה, מחוץ לכל מחקר, ומחזיר רק את הקוד שלה
    if (op === 'f.test') {
      if (!isSys && !tester) { await pause(); throw new TsError('אין הרשאה', 403); }
      let c = (await store.list('tsc:')).map((r) => r.value).find((x) => x && x.studyId === 'sys-test' && x.status === 'open');
      if (!c) {
        let code = genCode(8); while (await store.get('tsc:' + code)) code = genCode(8);
        c = { code, studyId: 'sys-test', studyTitle: 'פעילות בדיקה', group: 'בדיקה', label: 'כניסת בדיקה 7777', status: 'open', createdAt: now() };
        await store.set('tsc:' + code, c);
      }
      return [200, { class: { code: c.code } }];
    }
    if (op.startsWith('f.')) {
      if (!isSys) { await pause(); throw new TsError('אין הרשאה', 403); }
      if (op === 'f.create') {
        const studyId = clip(d.studyId, 64);
        if (!studyId) throw new TsError('חסר מחקר');
        if ((await store.list('tsc:', { keysOnly: true })).length >= LIM.classes) throw new TsError('יש כבר הרבה קישורים. אפשר למחוק קישורים ישנים', 429);
        let code = genCode(8); while (await store.get('tsc:' + code)) code = genCode(8);
        const c = { code, studyId, studyTitle: clip(d.studyTitle, 300), group: clip(d.group, 80) || 'כללי', label: clip(d.label, 160), status: 'open', createdAt: now() };
        await store.set('tsc:' + code, c);
        return [200, { class: classView(c) }];
      }
      if (op === 'f.list') {
        const studyId = clip(d.studyId, 64);
        const classes = (await store.list('tsc:')).map((r) => r.value).filter((c) => c && (!studyId || c.studyId === studyId))
          .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
        const parts = (await store.list('tsp:')).map((r) => r.value).filter(Boolean);
        return [200, { classes: classes.map((c) => {
          const mine = parts.filter((p) => p.code === c.code);
          const step = (n, part) => mine.filter((p) => p.sessions?.[n]?.[part]).length;
          return { ...classView(c), participants: mine.length,
            progress: [1, 2, 3].map((n) => ({ session: n, pre: n === 1 ? step(1, 'pre') : null, model: step(n, 'model'), practice: step(n, 'practice'), post: n > 1 ? step(n, 'post') : null, reflection: n === 3 ? step(3, 'reflection') : null })) };
        }) }];
      }
      const code = String(d.code || '');
      const c = okCode(code) ? await store.get('tsc:' + code) : null;
      if (!c) throw new TsError('הקישור לא נמצא', 404);
      if (op === 'f.status') {
        c.status = d.status === 'closed' ? 'closed' : 'open'; await store.set('tsc:' + code, c);
        return [200, { class: classView(c) }];
      }
      if (op === 'f.delete') {
        for (const r of await store.list('tsp:' + code + ':', { keysOnly: true })) await store.del(r.key);
        for (const r of await store.list('tse:' + code + ':', { keysOnly: true })) await store.del(r.key);
        await store.del('tsc:' + code);
        return [200, { ok: true }];
      }
      if (op === 'f.export') {
        const rows = (await store.list('tsp:' + code + ':')).map((r) => r.value).filter(Boolean).map(participantView);
        return [200, { class: classView(c), participants: rows }];
      }
      if (op === 'f.emails') {
        const rows = (await store.list('tse:' + code + ':')).map((r) => r.value).filter(Boolean);
        return [200, { emails: rows.map((r) => ({ pid: r.pid, email: r.email })) }];
      }
      throw new TsError('פעולה אינה נתמכת', 405);
    }

    // ═══ המשתתפים ═══
    if (op === 'p.info') {
      const code = String(d.code || '').toUpperCase();
      const c = okCode(code) ? await store.get('tsc:' + code) : null;
      if (!c) { await pause(); throw new TsError('הקישור לא נמצא. אפשר לבקש קישור חדש מהמרצה.', 404); }
      return [200, { class: { code: c.code, studyTitle: c.studyTitle, group: c.group, label: c.label, status: c.status, ...(c.studyId === 'sys-test' ? { test: true } : {}) } }];
    }
    if (op === 'p.join') {
      const code = String(d.code || '').toUpperCase();
      const c = okCode(code) ? await store.get('tsc:' + code) : null;
      if (!c) { await pause(); throw new TsError('הקישור לא נמצא', 404); }
      if (c.status !== 'open') throw new TsError('ההצטרפות סגורה כרגע. אפשר לפנות למרצה.', 403);
      if ((await store.list('tsp:' + code + ':', { keysOnly: true })).length >= LIM.participants) throw new TsError('הקבוצה מלאה', 429);
      let pid = genCode(6); while (await store.get('tsp:' + code + ':' + pid)) pid = genCode(6);
      const key = randomBytes(24).toString('hex');
      const email = clip(d.report?.email, 200);
      const wants = d.report?.want === true && /^\S+@\S+\.\S+$/.test(email);
      const p = { pid, code, group: c.group, keyHash: hash(key), createdAt: now(), report: wants,
        sessions: {} };
      await store.set('tsp:' + code + ':' + pid, p);
      if (wants) await store.set('tse:' + code + ':' + pid, { pid, email, at: now() });
      return [200, { pid, key, participant: participantView(p) }];
    }
    if (op === 'p.get') {
      const { c, p } = await participant(store, d);
      return [200, { class: { code: c.code, studyTitle: c.studyTitle, group: c.group, status: c.status, ...(c.studyId === 'sys-test' ? { test: true } : {}) }, participant: participantView(p) }];
    }
    if (op === 'p.save') {
      const { c, p } = await participant(store, d);
      if (c.status !== 'open') throw new TsError('הקבוצה סגורה כרגע. מה שכתבתם נשמר במכשיר.', 403);
      const n = Number(d.session), part = String(d.part || '');
      if (![1, 2, 3].includes(n) || !PARTS.includes(part)) throw new TsError('חלק לא מוכר');
      // 18/11/2026: שאלון עמדות בפתיחת מפגש 1 ובסוף מפגש 3 (22/11/2026: גם בסוף מפגש 2); רפלקציה רק במפגש 3; משוב אחרי כל תרגול
      if ((part === 'pre' && n !== 1) || ((part === 'post' && n === 1) || (part === 'reflection' && n !== 3))) throw new TsError('החלק הזה לא שייך למפגש הזה');
      const data = d.data && typeof d.data === 'object' && !Array.isArray(d.data) ? d.data : null;
      if (!data) throw new TsError('אין מה לשמור');
      if (JSON.stringify(data).length > LIM.part) throw new TsError('התוכן ארוך מדי', 413);
      p.sessions = p.sessions || {};
      const s = p.sessions[n] = p.sessions[n] || { startedAt: now() };
      if (part === 'extra') s.extras = (s.extras || []).concat([{ ...structuredClone(data), at: now() }]).slice(-20);
      else s[part] = { ...structuredClone(data), at: now() };
      if (part === 'reflection' || (part === 'practice' && n === 1) || (part === 'post' && n === 2)) s.doneAt = s.doneAt || now();
      p.updatedAt = now();
      await store.set('tsp:' + c.code + ':' + p.pid, p);
      return [200, { participant: participantView(p) }];
    }
    if (op === 'p.withdraw') {
      const { c, p } = await participant(store, d);
      await store.del('tsp:' + c.code + ':' + p.pid); await store.del('tse:' + c.code + ':' + p.pid);
      return [200, { ok: true }];
    }
    throw new TsError('פעולה אינה נתמכת', 405);
  } catch (e) {
    if (e instanceof TsError) return [e.status, { error: e.message }];
    throw e;
  }
}
