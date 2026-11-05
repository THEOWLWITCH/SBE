// מערך המוכנות (03/11/2026): שמירה בשרת תחת המוסד, הרשאה חיה, בלי פרטים מזהים של תלמידים,
// עדכון במייל רק לכתובות של הצוותים, והקלטה בטלפון שבה הקול עובר לתמלול ונזרק.
import test from 'node:test';
import assert from 'node:assert/strict';
import { handleAccess, PERMS, MODEL_PAGES } from '../lib/access.mjs';
import { handleReadiness, hasIdNumber } from '../lib/readiness.mjs';

function memoryStore(seed = {}) {
  const data = new Map(Object.entries(seed));
  return { data, async get(k) { return data.has(k) ? structuredClone(data.get(k)) : null; }, async set(k, v) { data.set(k, structuredClone(v)); }, async del(k) { data.delete(k); },
    async list(prefix, o = {}) { return [...data].filter(([k]) => k.startsWith(prefix)).map(([key, value]) => o.keysOnly ? { key } : { key, value: structuredClone(value) }); },
    async delPrefix(prefix) { for (const k of [...data.keys()]) if (k.startsWith(prefix)) data.delete(k); } };
}
async function setup() {
  const store = memoryStore({ institutions: [{ name: 'School', code: '123456', active: true }, { name: 'Other', code: '654321', active: true }],
    'modules:School': { readiness: true, writer: true }, 'modules:Other': { readiness: true },
    'code:AAAA1111': { code: 'AAAA-1111', kind: 'staff', inst: 'School', perms: ['readiness'], revoked: false },
    'code:BBBB2222': { code: 'BBBB-2222', kind: 'staff', inst: 'School', perms: ['readiness'], revoked: false },
    'code:CCCC3333': { code: 'CCCC-3333', kind: 'staff', inst: 'Other', perms: ['readiness'], revoked: false },
    'code:DDDD4444': { code: 'DDDD-4444', kind: 'staff', inst: 'School', perms: ['writer'], revoked: false } });
  const login = async (secret) => (await handleAccess(store, { action: 'login', kind: 'code', secret }))[1].token;
  return { store, a: await login('AAAA-1111'), b: await login('BBBB-2222'), other: await login('CCCC-3333'), noperm: await login('DDDD-4444') };
}
const call = (store, body) => handleAccess(store, body);

test('the permission and the page are registered', () => {
  assert.ok(PERMS.includes('readiness'));
  assert.deepEqual(MODEL_PAGES['readiness.html'], ['readiness']);
});

test('a staff code of the same school shares the program; another school and a code without the tool do not', async () => {
  const { store, a, b, other, noperm } = await setup();
  assert.equal((await call(store, { action: 'rdyCreate', token: noperm, profile: { name: 'x' } }))[0], 401);
  assert.equal((await call(store, { action: 'rdyCreate', token: a, profile: {} }))[0], 400);
  const [st, out] = await call(store, { action: 'rdyCreate', token: a, profile: { name: 'בית ספר הדר', lang: 'he' }, by: 'דנה' });
  assert.equal(st, 201);
  const id = out.doc.id;
  assert.equal((await call(store, { action: 'rdyGet', token: b, id }))[0], 200);
  assert.equal((await call(store, { action: 'rdyMine', token: b }))[1].items.length, 1);
  assert.equal((await call(store, { action: 'rdyGet', token: other, id }))[0], 404);
  assert.equal((await call(store, { action: 'rdyMine', token: other }))[1].items.length, 0);
  // מערך אחד לבית ספר: קוד אחר של אותו בית ספר מקבל את המערך הקיים
  const [st2, dup] = await call(store, { action: 'rdyCreate', token: b, profile: { name: 'שני' } });
  assert.equal(st2, 409); assert.equal(dup.id, id);
  assert.equal((await call(store, { action: 'rdyCreate', token: other, profile: { name: 'אחר' } }))[0], 201);
});

test('saving a part: whitelist, revision check, change log and no ID numbers', async () => {
  const { store, a, b } = await setup();
  const id = (await call(store, { action: 'rdyCreate', token: a, profile: { name: 'S' } }))[1].doc.id;
  assert.equal((await call(store, { action: 'rdySave', token: a, id, rev: 0, part: 'secret', value: 1 }))[0], 400);
  const [s1, r1] = await call(store, { action: 'rdySave', token: a, id, part: 'teams', rev: 0, value: [{ id: 't1', name: 'צוות ניהול' }], what: 'טבלת צוותים', by: 'דנה' });
  assert.equal(s1, 200); assert.equal(r1.rev, 1);
  const [s2, r2] = await call(store, { action: 'rdySave', token: b, id, part: 'teams', rev: 0, value: [] });
  assert.equal(s2, 409); assert.equal(r2.doc.parts.teams[0].name, 'צוות ניהול');
  assert.equal((await call(store, { action: 'rdySave', token: a, id, rev: 0, part: 'gaps', value: [{ text: 'תלמיד ת.ז. 000000018' }] }))[0], 400);
  assert.equal(hasIdNumber('טלפון 050-1234567'), false);
  assert.equal(hasIdNumber('טלפון קווי 039876543'), false);
  assert.equal(hasIdNumber('ת.ז. 000000018'), true);
  // תעודת זהות בקבוצות עם רווח או מקף; טלפונים ותאריכים לא נחסמים
  assert.equal(hasIdNumber('ת.ז. 123-456-782'), true);
  assert.equal(hasIdNumber('1234 5678 2'), true);
  assert.equal(hasIdNumber('123-456-783'), false);
  assert.equal(hasIdNumber('נייד 052-123-4567'), false);
  assert.equal(hasIdNumber('קווי 03-9876543'), false);
  assert.equal(hasIdNumber('05-11-2026 · 2026-11-05'), false);
  // בלי מספר גרסה: לא נשמר
  assert.equal((await call(store, { action: 'rdySave', token: a, id, part: 'gaps', value: [] }))[0], 400);
  const doc = (await call(store, { action: 'rdyGet', token: a, id }))[1].doc;
  assert.equal(doc.log.at(-1).what, 'טבלת צוותים');
  assert.equal(doc.log.at(-1).by, 'דנה');
});

test('updates by email go only to the addresses in the program teams', async () => {
  const { store, a } = await setup();
  const id = (await call(store, { action: 'rdyCreate', token: a, profile: { name: 'S' } }))[1].doc.id;
  await call(store, { action: 'rdySave', token: a, id, rev: 0, part: 'teams', value: [{ id: 't1', name: 'קשר עם הורים', members: [{ name: 'רונית', email: 'ronit@example.org' }, { email: 'bad' }] }] });
  const sent = [];
  const fetchImpl = async (url, o) => { sent.push(JSON.parse(o.body)); return { ok: true }; };
  const who = async () => ({ principal: 'p', inst: 'School', sys: false });
  const doc = (await call(store, { action: 'rdyGet', token: a, id }))[1].doc;
  const owner = (await store.get('rdy:' + id)).owner;
  assert.equal(owner, 'inst:School');
  const later = () => Date.now() + 25 * 3600e3; // כתובת בצוותים מקבלת מייל רק אחרי 24 שעות
  const [st, out] = await handleReadiness(store, { action: 'rdyMail', token: 'x', id: doc.id, subject: 'סבב 1', items: [{ teamId: 't1', text: 'בקבוצת ההורים מתחילות שאלות' }, { teamId: 'nope', text: 'x' }] },
    { who, fetchImpl, env: { RESEND_API_KEY: 'k', NOTIFY_FROM: 'Begood <n@b.il>' }, now: later });
  assert.equal(st, 200);
  assert.equal(out.sent, 1);
  assert.deepEqual(sent.map((m) => m.to[0]), ['ronit@example.org']);
  const [, none] = await handleReadiness(store, { action: 'rdyMail', token: 'x', id: doc.id, items: [{ teamId: 't1', text: 'y' }] }, { who, fetchImpl, env: {} });
  assert.equal(none.available, false); assert.equal(none.sent, 0);
});

test('recording: consent first, phone key only, audio transcribed and dropped, transcript deleted on request', async () => {
  const { store, a } = await setup();
  const id = (await call(store, { action: 'rdyCreate', token: a, profile: { name: 'S', lang: 'he' } }))[1].doc.id;
  await call(store, { action: 'rdySave', token: a, id, rev: 0, part: 'exercises', value: [{ id: 'ex-1', session: 3, round: 1 }] });
  assert.equal((await call(store, { action: 'rdyRecStart', token: a, id, exId: 'ex-1' }))[0], 400);
  const [, start] = await call(store, { action: 'rdyRecStart', token: a, id, exId: 'ex-1', consent: true });
  assert.match(start.rk, /^[a-f0-9]{48}$/);
  assert.equal((await call(store, { action: 'rdyRecPing', rk: 'f'.repeat(48) }))[0], 401);
  assert.equal((await call(store, { action: 'rdyRecPing', rk: start.rk }))[1].ok, true);

  let form;
  const fetchImpl = async (url, o) => { form = o.body; return { ok: true, json: async () => ({ text: 'נחליט אחר כך על הפינוי' }) }; };
  const env = { OPENAI_API_KEY: 'k' };
  const audio = Buffer.from('fake audio').toString('base64');
  const [cs, chunk] = await handleReadiness(store, { action: 'rdyRecChunk', rk: start.rk, seq: 0, t: 0, round: 1, mime: 'audio/webm;codecs=opus', audio }, { who: async () => null, fetchImpl, env });
  assert.equal(cs, 200); assert.ok(chunk.chars > 0);
  assert.equal(form.get('language'), 'he');
  const [dupS, dup] = await handleReadiness(store, { action: 'rdyRecChunk', rk: start.rk, seq: 0, audio }, { who: async () => null, fetchImpl, env });
  assert.equal(dupS, 200); assert.equal(dup.dup, true);
  const [noKeyS] = await handleReadiness(store, { action: 'rdyRecChunk', rk: start.rk, seq: 1, audio }, { who: async () => null, fetchImpl, env: {} });
  assert.equal(noKeyS, 503);
  await call(store, { action: 'rdyRecMark', rk: start.rk, t: 12000, round: 1, note: 'החלטה על פינוי' });

  for (const [k, v] of store.data) assert.ok(!JSON.stringify(v).includes(audio), 'audio is not stored: ' + k);
  const tr = (await call(store, { action: 'rdyTranscriptGet', token: a, id, exId: 'ex-1' }))[1].transcript;
  assert.equal(tr.segments.length, 1); assert.equal(tr.marks.length, 1);
  assert.equal((await call(store, { action: 'rdyTranscriptSave', token: a, id, exId: 'ex-1', segments: [{ seq: 0, text: 'שם 000000018' }] }))[0], 400);
  await call(store, { action: 'rdyRecStop', rk: start.rk });
  assert.equal((await call(store, { action: 'rdyRecPing', rk: start.rk }))[0], 401);
  await call(store, { action: 'rdyTranscriptDelete', token: a, id, exId: 'ex-1' });
  assert.equal((await call(store, { action: 'rdyTranscriptGet', token: a, id, exId: 'ex-1' }))[1].transcript.segments.length, 0);
});

test('deleting a program (system admin only) removes it and its transcripts', async () => {
  const { store, a } = await setup();
  const id = (await call(store, { action: 'rdyCreate', token: a, profile: { name: 'S' } }))[1].doc.id;
  await store.set('rdyt:' + id + ':ex-1', { segments: [{ text: 'x' }], marks: [] });
  assert.equal((await call(store, { action: 'rdyDelete', token: a, id }))[0], 403);
  assert.equal((await handleReadiness(store, { action: 'rdyDelete', token: 'x', id }, { who: async () => ({ principal: 'sys', sys: true }) }))[0], 200);
  assert.equal(await store.get('rdy:' + id), null);
  assert.equal(await store.get('rdyt:' + id + ':ex-1'), null);
});

test('recording a meeting: a planned meeting and one of the five sessions, but not an unknown id', async () => {
  const { store, a } = await setup();
  const id = (await call(store, { action: 'rdyCreate', token: a, profile: { name: 'S', lang: 'he' } }))[1].doc.id;
  await call(store, { action: 'rdySave', token: a, id, rev: 0, part: 'meetings', value: [{ id: 'mt-abc123', type: 'weekly', title: 'זמן מוכנות' }] });
  const [s1, m] = await call(store, { action: 'rdyRecStart', token: a, id, exId: 'mt-abc123', consent: true });
  assert.equal(s1, 200); assert.equal((await call(store, { action: 'rdyRecPing', rk: m.rk }))[1].ok, true);
  const [s2] = await call(store, { action: 'rdyRecStart', token: a, id, exId: 'sess-2', consent: true });
  assert.equal(s2, 200);
  assert.equal((await call(store, { action: 'rdyRecStart', token: a, id, exId: 'sess-9', consent: true }))[0], 404);
  assert.equal((await call(store, { action: 'rdyTranscriptGet', token: a, id, exId: 'mt-abc123' }))[0], 200);
});

test('meeting summary goes only to the people checked in at that meeting', async () => {
  const { store, a } = await setup();
  const id = (await call(store, { action: 'rdyCreate', token: a, profile: { name: 'S' } }))[1].doc.id;
  await call(store, { action: 'rdySave', token: a, id, rev: 0, part: 'teams', value: [{ id: 't1', name: 'ניהול', lead: { name: 'דנה', email: 'dana@example.org' } }] });
  await call(store, { action: 'rdySave', token: a, id, rev: 0, part: 'meetings', value: [{ id: 'mt-abc123', title: 'זמן מוכנות', attendees: [{ name: 'אורח', role: 'נציג הרשות', email: 'guest@example.org', here: true }, { name: 'לא הגיע', email: 'away@example.org', here: false }] }] });
  const sent = [];
  const fetchImpl = async (url, o) => { sent.push(JSON.parse(o.body)); return { ok: true }; };
  const who = async () => ({ principal: 'p', inst: 'School', sys: false });
  const env = { RESEND_API_KEY: 'k', NOTIFY_FROM: 'Begood <noreply@example.org>' };
  const [st, out] = await handleReadiness(store, { action: 'rdyMail', token: 'x', id, meetingId: 'mt-abc123', subject: 'סיכום', items: [{ to: ['guest@example.org', 'away@example.org', 'dana@example.org', 'evil@example.org'], text: 'סיכום המפגש' }] }, { who, fetchImpl, env, now: () => Date.now() + 25 * 3600e3 });
  assert.equal(st, 200);
  assert.deepEqual(sent.map((m) => m.to[0]).sort(), ['dana@example.org', 'guest@example.org']);
  assert.equal(out.sent, 2);
});

test('continuity binder files: clear name and date, a new file replaces the old one, sensitive items stay at school', async () => {
  const { store, a, b, other } = await setup();
  const id = (await call(store, { action: 'rdyCreate', token: a, profile: { name: 'S' } }))[1].doc.id;
  const data = Buffer.from('%PDF-1.4 map').toString('base64');
  const put = (token, extra) => call(store, Object.assign({ action: 'rdyFilePut', token, id, noStudents: true, key: 'm2', title: 'מפת המבנה, קומה א׳', date: '2026-11-01', name: 'map.pdf', mime: 'application/pdf', data }, extra));
  assert.equal((await put(a, { title: 'IMG_2034' }))[0], 400);
  assert.equal((await put(a, { title: 'map.pdf' }))[0], 400);
  assert.equal((await put(a, { date: '' }))[0], 400);
  assert.equal((await put(a, { mime: 'application/x-msdownload' }))[0], 400);
  assert.equal((await put(a, { key: 'm0' }))[0], 400); // רשימות כיתות: רגיש
  const [s1, o1] = await put(a);
  assert.equal(s1, 200); assert.equal(o1.replaced, false); assert.equal(o1.files.m2.title, 'מפת המבנה, קומה א׳');
  const data2 = Buffer.from('%PDF-1.4 map v2').toString('base64');
  const [s2, o2] = await put(b, { title: 'מפת המבנה, אחרי השיפוץ', date: '2026-11-03', data: data2 });
  assert.equal(s2, 200); assert.equal(o2.replaced, true);
  assert.equal((await store.list('rdyf:' + id + ':')).length, 1);
  const [g, got] = await call(store, { action: 'rdyFileGet', token: a, id, key: 'm2' });
  assert.equal(g, 200); assert.equal(got.file.data, data2);
  assert.equal((await call(store, { action: 'rdyFileGet', token: other, id, key: 'm2' }))[0], 404);
  // פריט שנוסף לרשימה: רגיש לא עולה, רגיל עולה
  await call(store, { action: 'rdySave', token: a, id, rev: 0, part: 'binder', value: { items: [{ key: 'cabc12345', text: 'ציוד חירום' }, { key: 'csens1234', text: 'רשימת תלמידים בהסעות', sens: true }] } });
  assert.equal((await put(a, { key: 'cabc12345', title: 'רשימת ציוד החירום' }))[0], 200);
  assert.equal((await put(a, { key: 'csens1234', title: 'רשימת ההסעות' }))[0], 400);
  assert.equal((await put(a, { key: 'cnothere1' }))[0], 404);
  const doc = (await call(store, { action: 'rdyGet', token: a, id }))[1].doc;
  assert.ok(doc.files.cabc12345 && doc.log.some((l) => /גרסה חדשה בתיקיית המוכנות/.test(l.what)));
  assert.equal((await call(store, { action: 'rdyFileDel', token: a, id, key: 'm2' }))[0], 200);
  assert.equal(await store.get('rdyf:' + id + ':m2'), null);
  assert.equal((await put(a, { noStudents: false }))[0], 400);
  assert.equal((await call(store, { action: 'rdyDelete', token: a, id }))[0], 403);
  await handleReadiness(store, { action: 'rdyDelete', token: 'x', id }, { who: async () => ({ principal: 'sys', sys: true }) });
  assert.equal((await store.list('rdyf:' + id + ':')).length, 0);
});

test('binder sensitive items match the model', async () => {
  const { BINDER_SENS } = await import('../lib/readiness.mjs');
  const { createRequire } = await import('node:module');
  const P = createRequire(import.meta.url)('../../app/lib/readiness-model.js');
  assert.deepEqual(P.BINDER_SENS, BINDER_SENS);
  assert.equal(P.content('he').BINDER_MANUAL.length, 8);
});

test('email: a new team address waits 24 hours, old addresses keep working, every send is logged without addresses', async () => {
  const { store, a } = await setup();
  const id = (await call(store, { action: 'rdyCreate', token: a, profile: { name: 'S' } }))[1].doc.id;
  // מערך מלפני השינוי: כתובת שכבר הייתה בצוותים (בלי emailSeen) נחשבת ישנה
  const d0 = await store.get('rdy:' + id);
  d0.parts.teams = [{ id: 't1', name: 'ניהול', lead: { name: 'דנה', email: 'old@example.org' } }];
  await store.set('rdy:' + id, d0);
  const sent = [];
  const fetchImpl = async (url, o) => { sent.push(JSON.parse(o.body)); return { ok: true }; };
  const who = async () => ({ principal: 'p', inst: 'School', sys: false });
  const env = { RESEND_API_KEY: 'k', NOTIFY_FROM: 'Begood <noreply@example.org>' };
  const t0 = Date.now();
  const rev = (await store.get('rdy:' + id)).revs.teams || 0;
  await call(store, { action: 'rdySave', token: a, id, part: 'teams', rev, value: [{ id: 't1', name: 'ניהול', lead: { email: 'old@example.org' }, members: [{ email: 'new@example.org' }] }] });
  const mail = (now, extra = {}) => handleReadiness(store, Object.assign({ action: 'rdyMail', token: 'x', id, subject: 'עדכון', items: [{ teamId: 't1', text: 'שלום' }] }, extra), { who, fetchImpl, env, now: () => now });
  const [s1, o1] = await mail(t0);
  assert.equal(s1, 200);
  assert.deepEqual(sent.map((m) => m.to[0]), ['old@example.org']);
  assert.equal(o1.skippedNew, 1); assert.equal(o1.reason, 'new');
  sent.length = 0;
  const [, o2] = await mail(t0 + 25 * 3600e3);
  assert.deepEqual(sent.map((m) => m.to[0]).sort(), ['new@example.org', 'old@example.org']);
  assert.equal(o2.reason, undefined);
  const log = (await store.get('rdy:' + id)).log.filter((l) => l.part === 'mail');
  assert.equal(log.length, 2);
  assert.ok(log.every((l) => /עדכון/.test(l.what) && !/@/.test(l.what)));
  // מספר זהות בטקסט המייל: לא נשלח
  assert.equal((await mail(t0 + 25 * 3600e3, { items: [{ teamId: 't1', text: 'ת.ז. 123-456-782' }] }))[0], 400);
});

test('email: at most 20 new team addresses a day per program', async () => {
  const { store, a } = await setup();
  const id = (await call(store, { action: 'rdyCreate', token: a, profile: { name: 'S' } }))[1].doc.id;
  const members = Array.from({ length: 30 }, (_, i) => ({ email: 'p' + i + '@example.org' }));
  await call(store, { action: 'rdySave', token: a, id, part: 'teams', rev: 0, value: [{ id: 't1', name: 'ניהול', members }] });
  assert.equal(Object.keys((await store.get('rdy:' + id)).emailSeen).length, 20);
  const sent = [];
  const fetchImpl = async (url, o) => { sent.push(JSON.parse(o.body)); return { ok: true }; };
  const [, o] = await handleReadiness(store, { action: 'rdyMail', token: 'x', id, items: [{ teamId: 't1', text: 'שלום' }] },
    { who: async () => ({ principal: 'p', inst: 'School', sys: false }), fetchImpl, env: { RESEND_API_KEY: 'k', NOTIFY_FROM: 'n@example.org' }, now: () => Date.now() + 25 * 3600e3 });
  assert.equal(o.sent, 20); assert.equal(o.skippedNew, 10);
});

test('transcripts keep their date (30-day sweep), also when edited or created by a decision mark', async () => {
  const { store, a } = await setup();
  const id = (await call(store, { action: 'rdyCreate', token: a, profile: { name: 'S' } }))[1].doc.id;
  await call(store, { action: 'rdySave', token: a, id, part: 'exercises', rev: 0, value: [{ id: 'ex-1', session: 3, round: 1 }] });
  const rk = (await call(store, { action: 'rdyRecStart', token: a, id, exId: 'ex-1', consent: true }))[1].rk;
  assert.equal((await call(store, { action: 'rdyRecMark', rk, t: 1, note: 'ת.ז. 1234 5678 2' }))[0], 400);
  assert.equal((await call(store, { action: 'rdyRecMark', rk, t: 1, note: 'מפנים' }))[0], 200);
  const at = (await store.get('rdyt:' + id + ':ex-1')).at;
  assert.ok(at);
  await call(store, { action: 'rdyTranscriptSave', token: a, id, exId: 'ex-1', segments: [{ seq: 0, text: 'נערך' }] });
  assert.equal((await store.get('rdyt:' + id + ':ex-1')).at, at);
  const tr = await store.get('rdyt:' + id + ':ex-1'); tr.at = new Date(Date.now() - 31 * 864e5).toISOString(); await store.set('rdyt:' + id + ':ex-1', tr);
  await call(store, { action: 'rdyMine', token: a });
  assert.equal(await store.get('rdyt:' + id + ':ex-1'), null);
});

test('one active recording key per target: a new link or deleting the transcript ends the old key', async () => {
  const { store, a } = await setup();
  const id = (await call(store, { action: 'rdyCreate', token: a, profile: { name: 'S' } }))[1].doc.id;
  await call(store, { action: 'rdySave', token: a, id, part: 'meetings', rev: 0, value: [{ id: 'mt-abc123', title: 'זמן מוכנות' }] });
  const fetchImpl = async () => ({ ok: true, json: async () => ({ text: 'דיברנו' }) });
  const env = { OPENAI_API_KEY: 'k' };
  const audio = Buffer.from('fake').toString('base64');
  const chunk = (rk, seq) => handleReadiness(store, { action: 'rdyRecChunk', rk, seq, audio }, { who: async () => null, fetchImpl, env });
  const k1 = (await call(store, { action: 'rdyRecStart', token: a, id, exId: 'mt-abc123', consent: true }))[1].rk;
  const k2 = (await call(store, { action: 'rdyRecStart', token: a, id, exId: 'mt-abc123', consent: true }))[1].rk;
  assert.equal((await call(store, { action: 'rdyRecPing', rk: k1 }))[0], 410);
  assert.equal((await chunk(k1, 0))[0], 410);
  assert.equal((await chunk(k2, 0))[0], 200);
  // המפגש סומן כהושלם: התמליל נמחק והמפתח מבוטל, וקטע מאוחר לא יוצר אותו מחדש
  await call(store, { action: 'rdyTranscriptDelete', token: a, id, exId: 'mt-abc123' });
  assert.equal((await chunk(k2, 1))[0], 410);
  assert.equal((await call(store, { action: 'rdyRecMark', rk: k2, t: 1 }))[0], 410);
  assert.equal(await store.get('rdyt:' + id + ':mt-abc123'), null);
  // קטע שהתמלול שלו נגמר אחרי שהמפתח בוטל: לא נשמר
  const k3 = (await call(store, { action: 'rdyRecStart', token: a, id, exId: 'mt-abc123', consent: true }))[1].rk;
  const slow = async () => { await call(store, { action: 'rdyRecStart', token: a, id, exId: 'mt-abc123', consent: true }); return { ok: true, json: async () => ({ text: 'מאוחר' }) }; };
  const [ls] = await handleReadiness(store, { action: 'rdyRecChunk', rk: k3, seq: 0, audio }, { who: async () => null, fetchImpl: slow, env });
  assert.equal(ls, 410);
  assert.equal(await store.get('rdyt:' + id + ':mt-abc123'), null);
  // קטע גדול ממגבלת הבקשה: 413
  const k4 = (await call(store, { action: 'rdyRecStart', token: a, id, exId: 'mt-abc123', consent: true }))[1].rk;
  assert.equal((await handleReadiness(store, { action: 'rdyRecChunk', rk: k4, seq: 0, audio: 'A'.repeat(1_950_000) }, { who: async () => null, fetchImpl, env }))[0], 413);
});
