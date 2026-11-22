// מחקר שיחות מאתגרות, מסלול הסטודנטיות (18/11/2026): קישור לקבוצה ממרכז המחקר, הצטרפות בהסכמה בלי קוד Begood,
// שמירה לפי חלקים, ופנייה למודל רק מהתרגול של המסלול.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { handleAccess, authorizeModel } from '../lib/access.mjs';
import { seedOwnerPassword, SYNTHETIC_OWNER_PASSWORD } from './synthetic-access.mjs';

function memoryStore() {
  const data = new Map();
  return { data, async get(k) { return data.get(k) || null; }, async set(k, v) { data.set(k, structuredClone(v)); }, async del(k) { data.delete(k); },
    async list(prefix, o = {}) { return [...data].filter(([k]) => k.startsWith(prefix)).map(([key, value]) => o.keysOnly ? { key } : { key, value }); } };
}
const call = (store, op, input, extra = {}) => handleAccess(store, { action: 'tsCall', op, input, ...extra });
const consent = { version: 'v1', required: ['read', 'stop', 'data', 'names', 'agree'], items: { read: true, stop: true, data: true, names: true, agree: true } };

test('research center creates a link; students join with consent only; data saved by part; model gate', async () => {
  const store = memoryStore(); await seedOwnerPassword(store);
  const [, sys] = await handleAccess(store, { action: 'login', kind: 'sys', secret: SYNTHETIC_OWNER_PASSWORD });
  assert.equal((await call(store, 'f.create', { studyId: 's1' }))[0], 403);
  const [st, made] = await call(store, 'f.create', { studyId: 's1', studyTitle: 'הכנה לשיחות מאתגרות', group: 'ייעוץ חינוכי' }, { token: sys.token });
  assert.equal(st, 200);
  const code = made.class.code;
  assert.match(code, /^[A-Z2-9]{8}$/);
  assert.equal((await call(store, 'p.info', { code }))[1].class.group, 'ייעוץ חינוכי');
  assert.equal((await call(store, 'p.join', { code, consent: { ...consent, items: { ...consent.items, agree: false } } }))[0], 400);
  const [js, joined] = await call(store, 'p.join', { code, consent, report: { want: true, email: 'a@b.co' } });
  assert.equal(js, 200);
  const cred = { code, pid: joined.pid, key: joined.key };
  assert.equal((await call(store, 'p.get', { ...cred, key: 'x'.repeat(48) }))[0], 404);
  const [, saved] = await call(store, 'p.save', { ...cred, session: 1, part: 'pre', data: { answers: { M1: 4 } } });
  assert.equal(saved.participant.sessions[1].pre.answers.M1, 4);
  assert.equal((await call(store, 'p.save', { ...cred, session: 4, part: 'pre', data: {} }))[0], 400);
  assert.equal((await call(store, 'p.save', { ...cred, session: 1, part: 'secret', data: {} }))[0], 400);
  // רפלקציה ושאלון מסכם רק במפגש 3; מפגש 1 ו־2 נגמרים בתרגול (משוב אחרי כל תרגול)
  assert.equal((await call(store, 'p.save', { ...cred, session: 1, part: 'reflection', data: { contribution: 'עזר' } }))[0], 400);
  assert.equal((await call(store, 'p.save', { ...cred, session: 2, part: 'pre', data: { answers: {} } }))[0], 400);
  const [, p1] = await call(store, 'p.save', { ...cred, session: 1, part: 'practice', data: { tries: 1 } });
  assert.ok(p1.participant.sessions[1].doneAt);
  assert.equal((await call(store, 'p.save', { ...cred, session: 1, part: 'post', data: { answers: {} } }))[0], 400);
  const [, p2] = await call(store, 'p.save', { ...cred, session: 2, part: 'practice', data: { tries: 2 } });
  assert.ok(!p2.participant.sessions[2].doneAt);
  const [, p2b] = await call(store, 'p.save', { ...cred, session: 2, part: 'post', data: { answers: { M1: 4 } } });
  assert.ok(p2b.participant.sessions[2].doneAt);
  await call(store, 'p.save', { ...cred, session: 3, part: 'post', data: { answers: { M1: 5 } } });
  await call(store, 'p.save', { ...cred, session: 3, part: 'reflection', data: { contribution: 'עזר' } });
  // מרכז המחקר: התקדמות וייצוא בלי מפתחות ובלי מיילים; המיילים בנפרד
  const [, list] = await call(store, 'f.list', { studyId: 's1' }, { token: sys.token });
  assert.equal(list.classes[0].participants, 1);
  assert.equal(list.classes[0].progress[2].reflection, 1);
  assert.equal(list.classes[0].progress[0].reflection, null);
  const [, exp] = await call(store, 'f.export', { code }, { token: sys.token });
  assert.equal(exp.participants.length, 1);
  assert.ok(!JSON.stringify(exp).includes('keyHash') && !JSON.stringify(exp).includes('a@b.co'));
  assert.equal((await call(store, 'f.emails', { code }, { token: sys.token }))[1].emails[0].email, 'a@b.co');
  // פנייה למודל: רק מהתרגול של המסלול, רק עם המפתח, רק כשהקבוצה פתוחה
  const ts = { c: code, p: joined.pid, key: joined.key };
  assert.equal((await authorizeModel(store, { page: 'talk-practice.html', ts }, '/api/character-turn')).ok, true);
  assert.equal((await authorizeModel(store, { page: 'practice.html', ts }, '/api/character-turn')).ok, false);
  assert.equal((await authorizeModel(store, { page: 'talk-practice.html', ts: { ...ts, key: 'z'.repeat(48) } }, '/api/complete')).ok, false);
  await call(store, 'f.status', { code, status: 'closed' }, { token: sys.token });
  assert.equal((await authorizeModel(store, { page: 'talk-practice.html', ts }, '/api/complete')).ok, false);
  assert.equal((await call(store, 'p.join', { code, consent }))[0], 403);
  // יציאה מהמחקר מוחקת את הנתונים
  assert.equal((await call(store, 'p.withdraw', cred))[0], 200);
  assert.equal((await call(store, 'p.get', cred))[0], 404);
});

test('the student flow page stands alone: no login, no navigation to other tools', () => {
  const html = readFileSync(new URL('../../app/talk-study.html', import.meta.url), 'utf8');
  assert.ok(!html.includes('access-guard.js') && !html.includes('screens-menu.js') && !html.includes('top-bar.js'));
  assert.match(html, /name="viewport"/);
  const model = readFileSync(new URL('../../app/lib/talk-study-model.js', import.meta.url), 'utf8').replace(/\/\/.*$/gm, '');
  for (const w of ['צריך', 'חייב', '—', 'פסיכולוג', 'איש מקצוע', 'אשת מקצוע']) assert.ok(!model.includes(w), w);
});
