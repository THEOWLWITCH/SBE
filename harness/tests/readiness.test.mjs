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
  assert.equal((await call(store, { action: 'rdySave', token: a, id, part: 'secret', value: 1 }))[0], 400);
  const [s1, r1] = await call(store, { action: 'rdySave', token: a, id, part: 'teams', rev: 0, value: [{ id: 't1', name: 'צוות ניהול' }], what: 'טבלת צוותים', by: 'דנה' });
  assert.equal(s1, 200); assert.equal(r1.rev, 1);
  const [s2, r2] = await call(store, { action: 'rdySave', token: b, id, part: 'teams', rev: 0, value: [] });
  assert.equal(s2, 409); assert.equal(r2.doc.parts.teams[0].name, 'צוות ניהול');
  assert.equal((await call(store, { action: 'rdySave', token: a, id, part: 'gaps', value: [{ text: 'תלמיד ת.ז. 123456789' }] }))[0], 400);
  assert.equal(hasIdNumber('טלפון 050-1234567'), false);
  const doc = (await call(store, { action: 'rdyGet', token: a, id }))[1].doc;
  assert.equal(doc.log.at(-1).what, 'טבלת צוותים');
  assert.equal(doc.log.at(-1).by, 'דנה');
});

test('updates by email go only to the addresses in the program teams', async () => {
  const { store, a } = await setup();
  const id = (await call(store, { action: 'rdyCreate', token: a, profile: { name: 'S' } }))[1].doc.id;
  await call(store, { action: 'rdySave', token: a, id, part: 'teams', value: [{ id: 't1', name: 'קשר עם הורים', members: [{ name: 'רונית', email: 'ronit@example.org' }, { email: 'bad' }] }] });
  const sent = [];
  const fetchImpl = async (url, o) => { sent.push(JSON.parse(o.body)); return { ok: true }; };
  const who = async () => ({ principal: 'p', inst: 'School', sys: false });
  const doc = (await call(store, { action: 'rdyGet', token: a, id }))[1].doc;
  const owner = (await store.get('rdy:' + id)).owner;
  assert.equal(owner, 'inst:School');
  const [st, out] = await handleReadiness(store, { action: 'rdyMail', token: 'x', id: doc.id, subject: 'סבב 1', items: [{ teamId: 't1', text: 'בקבוצת ההורים מתחילות שאלות' }, { teamId: 'nope', text: 'x' }] },
    { who, fetchImpl, env: { RESEND_API_KEY: 'k', NOTIFY_FROM: 'Begood <n@b.il>' } });
  assert.equal(st, 200);
  assert.equal(out.sent, 1);
  assert.deepEqual(sent.map((m) => m.to[0]), ['ronit@example.org']);
  const [, none] = await handleReadiness(store, { action: 'rdyMail', token: 'x', id: doc.id, items: [{ teamId: 't1', text: 'y' }] }, { who, fetchImpl, env: {} });
  assert.equal(none.available, false); assert.equal(none.sent, 0);
});

test('recording: consent first, phone key only, audio transcribed and dropped, transcript deleted on request', async () => {
  const { store, a } = await setup();
  const id = (await call(store, { action: 'rdyCreate', token: a, profile: { name: 'S', lang: 'he' } }))[1].doc.id;
  await call(store, { action: 'rdySave', token: a, id, part: 'exercises', value: [{ id: 'ex-1', session: 3, round: 1 }] });
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
  assert.equal((await call(store, { action: 'rdyTranscriptSave', token: a, id, exId: 'ex-1', segments: [{ seq: 0, text: 'שם 123456789' }] }))[0], 400);
  await call(store, { action: 'rdyRecStop', rk: start.rk });
  assert.equal((await call(store, { action: 'rdyRecPing', rk: start.rk }))[0], 401);
  await call(store, { action: 'rdyTranscriptDelete', token: a, id, exId: 'ex-1' });
  assert.equal((await call(store, { action: 'rdyTranscriptGet', token: a, id, exId: 'ex-1' }))[1].transcript.segments.length, 0);
});

test('deleting a program removes it and its transcripts', async () => {
  const { store, a } = await setup();
  const id = (await call(store, { action: 'rdyCreate', token: a, profile: { name: 'S' } }))[1].doc.id;
  await store.set('rdyt:' + id + ':ex-1', { segments: [{ text: 'x' }], marks: [] });
  assert.equal((await call(store, { action: 'rdyDelete', token: a, id }))[0], 200);
  assert.equal(await store.get('rdy:' + id), null);
  assert.equal(await store.get('rdyt:' + id + ':ex-1'), null);
});
