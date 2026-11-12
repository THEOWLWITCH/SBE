// בירור דילמות (12/11/2026): בדיקות הקבלה של הכלי: המחוון, ההסכמה, ה־QR, ההפרדה בשרת, הלוח, המידע המאתגר,
// הייצוא המחקרי לפי ההסכמות, הפנייה למודל, בדיקת הקישורים, ניקוי תשובות ה־AI והשילוב במערכת.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { handleDilemma, dlmModelGate, verifyUrl, researchExport, _resetDlm } from '../lib/dilemma.mjs';
import { authorizeModel, MODEL_PAGES, PERMS } from '../lib/access.mjs';
const require = createRequire(import.meta.url);
const M = require('../../app/lib/dilemma-model.js');
const read = (f) => fs.readFileSync(new URL('../../app/' + f, import.meta.url), 'utf8');

function memoryStore() {
  const data = new Map();
  return { data, async get(k) { return data.has(k) ? structuredClone(data.get(k)) : null; }, async set(k, v) { data.set(k, structuredClone(v)); }, async del(k) { data.delete(k); },
    async list(prefix, o = {}) { return [...data].filter(([k]) => k.startsWith(prefix)).map(([key, value]) => (o.keysOnly ? { key } : { key, value: structuredClone(value) })); },
    async delPrefix(prefix) { for (const k of [...data.keys()]) if (k.startsWith(prefix)) data.delete(k); } };
}
const WHO = { T1: { principal: 'fac-1', inst: 'מכללה' }, T2: { principal: 'fac-2', inst: 'מכללה' } };
const who = async (t) => WHO[t] || null;
const fetchOk = async () => new Response('<html><head><title>IPCC AR6</title></head></html>', { status: 200, headers: { 'content-type': 'text/html' } });
const resolvePublic = async () => [{ address: '93.184.216.34' }];
function mk() {
  _resetDlm();
  const store = memoryStore();
  const run = (op, input, extra = {}) => handleDilemma(store, { action: 'dlmCall', op, input, ...extra }, { who, fetchImpl: fetchOk, resolve: resolvePublic });
  const fac = async (op, input, t = 'T1') => { const [s, b] = await run(op, input, { token: t }); assert.equal(s < 300, true, op + ': ' + JSON.stringify(b)); return b; };
  return { store, run, fac };
}
async function setup(opts = {}) {
  const env = mk();
  const { activity } = await env.fac('f.create', { template: 'climate', mode: opts.mode || 'group' });
  const a1 = await env.fac('f.classAdd', { id: activity.id, name: 'כיתה א', groups: ['קבוצה 1', 'קבוצה 2'] });
  const a2 = await env.fac('f.classAdd', { id: activity.id, name: 'כיתה ב' });
  await env.fac('f.status', { id: activity.id, status: 'open' });
  const A = a2.activity;
  const join = async (cls, consent = 'research', groupIdx = 0) => {
    const [s, r] = await env.run('p.enter', { code: cls.code, consent });
    assert.equal(s, 200, JSON.stringify(r));
    const cred = { a: r.a, p: r.p, key: r.key };
    if ((opts.mode || 'group') === 'group') { const [gs] = await env.run('p.group', { groupId: cls.groups[groupIdx].id }, cred); assert.equal(gs, 200); }
    const P = async (op, input) => env.run(op, input || {}, cred);
    return { cred, code: r.me.code, P };
  };
  return { ...env, A, c1: A.classes[0], c2: A.classes[1], join };
}

// ── המחוון ──
test('rubric: 0–7 and grey only, exact colors, number next to the color', () => {
  assert.deepEqual(M.RUBRIC.map((r) => r.score), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(M.RUBRIC.map((r) => r.color), ['#8B0000', '#C62828', '#F44336', '#EF6C00', '#F9A825', '#8BC34A', '#2E9E32', '#006B3C']);
  assert.equal(M.GREY.color, '#909399'); assert.equal(M.GREY.label, 'טרם נבדק');
  for (const bad of [8, 9, 10, -1, 3.5, '7']) assert.equal(M.validScore(bad), false, String(bad));
  assert.equal(M.scoreOf(9).score, null, 'out of range shows grey');
  assert.match(M.dotHTML(5), />5<\/span>/); assert.match(M.dotHTML(null), />—<\/span>/); assert.match(M.dotHTML(3), /aria-label="אמינות המקור: ציון 3/);
  const legend = M.legendHTML();
  assert.match(legend, /מקרא אמינות מקורות/); for (const r of M.RUBRIC) assert.ok(legend.includes(r.label));
  assert.doesNotMatch(M.aboutHTML() + legend, /(^|[^0-9])(8|9|10) ?·|ציון (8|9|10)/);
  assert.match(M.aboutHTML(), /ציון האמינות אינו ציון האמת/);
});

// ── QR, הסכמה וקוד אישי ──
test('class QR holds only a random class code; revoke stops the old code at once', async () => {
  const s = await setup();
  assert.match(s.c1.code, /^[A-Z0-9]{10}$/);
  assert.notEqual(s.c1.code, s.c2.code);
  const before = s.c1.code;
  const { P } = await s.join(s.c1);
  const r = await s.fac('f.classCode', { id: s.A.id, classId: s.c1.id });
  const after = r.activity.classes[0].code;
  assert.notEqual(after, before);
  assert.equal((await s.run('p.open', { code: before }))[0], 404, 'old code no longer opens');
  assert.equal((await s.run('p.open', { code: after }))[0], 200);
  assert.equal((await P('p.state'))[0], 200, 'participants who already entered keep working');
});

test('consent: a choice is required, nothing is chosen by default, and the version is recorded', async () => {
  const s = await setup();
  const [os, o] = await s.run('p.open', { code: s.c1.code });
  assert.equal(os, 200);
  assert.equal(o.activity.consent.research, 'אני מסכים/ה להשתתף במחקר ולהשתמש בנתוניי בהתאם להסבר.');
  assert.equal(o.activity.consent.learning, 'אני מעוניין/ת להשתתף בפעילות הלימודית בלבד, ללא שימוש מחקרי בנתוניי.');
  assert.equal(o.activity.class.code, undefined, 'class codes are not sent to participants');
  assert.equal(o.activity.owner, undefined);
  assert.equal((await s.run('p.enter', { code: s.c1.code }))[0], 400, 'no consent choice → no entry');
  assert.equal((await s.run('p.enter', { code: s.c1.code, consent: 'yes' }))[0], 400);
  const { P } = await s.join(s.c1, 'learning');
  const [, st] = await P('p.state');
  assert.equal(st.me.consent.type, 'learning'); assert.ok(st.me.consent.version); assert.ok(st.me.consent.at);
  const js = read('lib/dilemma-join.js');
  assert.doesNotMatch(js.match(/function consentView[\s\S]*?\n  }\n/)[0], /type="radio"[^>]*checked/, 'consent radios are not pre-checked');
});

test('personal codes are random, and resume works from another device (the old key stops)', async () => {
  const s = await setup();
  const a = await s.join(s.c1), b = await s.join(s.c1);
  assert.match(a.code, /^[A-Z0-9]{4}-[A-Z0-9]{4}$/); assert.notEqual(a.code, b.code);
  const [rs, r] = await s.run('p.resume', { code: s.c1.code, pcode: a.code.toLowerCase().replace('-', '') });
  assert.equal(rs, 200); assert.equal(r.p, a.cred.p);
  assert.equal((await a.P('p.state'))[0], 401, 'old key no longer works');
  assert.equal((await s.run('p.state', {}, { a: r.a, p: r.p, key: r.key }))[0], 200);
  assert.equal((await s.run('p.resume', { code: s.c2.code, pcode: a.code }))[0], 404, 'personal code is bound to its class');
});

// ── ההפרדה בשרת ──
test('separation: each group sees only its board; classes and private answers stay apart', async () => {
  const s = await setup();
  const a = await s.join(s.c1, 'research', 0), b = await s.join(s.c1, 'research', 1), c = await s.join(s.c2, 'research', 0);
  await a.P('p.board', { kind: 'add', zone: 'claims', text: 'טענה של קבוצה 1' });
  await a.P('p.private', { kind: 'response', answers: { know: 'סוד אישי' } });
  const [, sb] = await b.P('p.state'), [, sc] = await c.P('p.state');
  for (const st of [sb, sc]) {
    assert.equal(st.board.items.length, 0, 'other group / class does not see the card');
    assert.doesNotMatch(JSON.stringify(st), /סוד אישי/);
  }
  assert.equal(sc.activity.class.name, 'כיתה ב'); assert.doesNotMatch(JSON.stringify(sc.activity), /כיתה א/);
  // cannot pick a group of another class
  assert.equal((await c.P('p.group', { groupId: s.c1.groups[0].id }))[0], 404);
  // a forged key for another participant fails
  assert.equal((await s.run('p.state', {}, { a: a.cred.a, p: b.cred.p, key: a.cred.key }))[0], 401);
  // board read never contains private data
  const [, poll] = await a.P('p.poll', { since: -1 });
  assert.doesNotMatch(JSON.stringify(poll), /סוד אישי/);
  // another facilitator cannot open the activity or its boards
  assert.equal((await s.run('f.get', { id: s.A.id }, { token: 'T2' }))[0], 404);
  assert.equal((await s.run('f.board', { id: s.A.id, g: s.c1.groups[0].id }, { token: 'T2' }))[0], 404);
  assert.equal((await s.run('f.mine', {}, { token: 'nope' }))[0], 401);
  // the facilitator sees boards but not private answers
  const [, fb] = await s.run('f.board', { id: s.A.id, g: s.c1.groups[0].id }, { token: 'T1' });
  assert.equal(fb.board.items.length, 1); assert.doesNotMatch(JSON.stringify(fb), /סוד אישי/);
});

test('personal mode: a board per participant', async () => {
  const s = await setup({ mode: 'personal' });
  const a = await s.join(s.c1), b = await s.join(s.c1);
  await a.P('p.board', { kind: 'add', zone: 'claims', text: 'שלי' });
  const [, sb] = await b.P('p.state');
  assert.equal(sb.board.items.length, 0);
  assert.equal((await a.P('p.group', { groupId: s.c1.groups[0].id }))[0], 400);
});

// ── הלוח ──
test('board: zones, relations, assessments 0–7 with explanation, history kept, closed activity is read-only', async () => {
  const s = await setup();
  const a = await s.join(s.c1);
  const [, r1] = await a.P('p.board', { kind: 'add', zone: 'claims', text: 'טענה' });
  const [, r2] = await a.P('p.board', { kind: 'add', source: { title: 'מקור', url: 'https://example.org/x' } });
  const src = r2.board.items.find((i) => i.id === r2.id);
  assert.equal(src.zone, 'sources');
  assert.equal(r2.board.sourcesAll.find((x) => x.id === src.sourceId).verify.status, 'not_checked', 'new source is unverified');
  assert.equal((await a.P('p.board', { kind: 'link', from: r1.id, to: r2.id, rel: 'supports' }))[0], 200);
  assert.equal((await a.P('p.board', { kind: 'link', from: r1.id, to: r2.id, rel: 'loves' }))[0], 400);
  assert.equal((await a.P('p.board', { kind: 'add', zone: 'nowhere', text: 'x' }))[1].board.items.at(-1).zone, 'claims');
  for (const bad of [8, 9, 10, -1, 2.5]) assert.equal((await a.P('p.board', { kind: 'assess', sourceId: src.sourceId, assessment: { score: bad, explanation: 'x' } }))[0], 400, 'score ' + bad);
  assert.equal((await a.P('p.board', { kind: 'assess', sourceId: src.sourceId, assessment: { score: 5 } }))[0], 400, 'a score needs an explanation');
  await a.P('p.board', { kind: 'assess', sourceId: src.sourceId, assessment: { score: null } });
  const [, r3] = await a.P('p.board', { kind: 'assess', sourceId: src.sourceId, assessment: { score: 5, explanation: 'גוף מקצועי עם נתונים', method: 'ai' } });
  assert.deepEqual(r3.board.assess[src.sourceId].map((x) => x.score), [null, 5], 'assessment history kept');
  assert.equal(r3.board.assess[src.sourceId][1].method, 'ai');
  assert.equal(r3.board.assess[src.sourceId][1].rubric, M.RUBRIC_VERSION);
  await a.P('p.board', { kind: 'checked', sourceId: src.sourceId, note: 'פתחנו' });
  const [rs] = await a.P('p.board', { kind: 'report', target: 'ai', targetId: 'find_sources', issue: 'not_exist', text: 'המקור לא קיים' });
  assert.equal(rs, 200);
  await a.P('p.board', { kind: 'edit', id: r1.id, text: 'טענה מתוקנת', confidence: 'low' });
  const [, st] = await a.P('p.state');
  const it = st.board.items.find((i) => i.id === r1.id);
  assert.equal(it.history[0].text, 'טענה'); assert.equal(it.confidence, 'low');
  // alert: the exact conspiracy text, separate from the score
  const [, al] = await a.P('p.board', { kind: 'alert', type: 'conspiracy', itemId: r1.id, target: 'טענה', data: { signs: [{ k: 'secret_plan' }] } });
  assert.equal(al.board.alerts[0].text, 'זוהו מאפיינים שעשויים להתאים לטיעון קונספירטיבי. מומלץ לבחון את הראיות ואת האפשרויות לבדוק או להפריך את הטענה.');
  assert.deepEqual(al.board.assess[src.sourceId].map((x) => x.score), [null, 5], 'alert does not change the score');
  await s.fac('f.status', { id: s.A.id, status: 'closed' });
  assert.equal((await a.P('p.board', { kind: 'add', zone: 'claims', text: 'מאוחר' }))[0], 409);
  assert.equal((await a.P('p.state'))[0], 200, 'still readable after closing');
});

test('verify: a participant can check a source link; private hosts are refused', async () => {
  const s = await setup();
  const a = await s.join(s.c1);
  const [, r] = await a.P('p.board', { kind: 'add', source: { title: 'IPCC', url: 'https://www.ipcc.ch/report/ar6/syr/' } });
  const sid = r.board.items.find((i) => i.id === r.id).sourceId;
  const [vs, v] = await a.P('p.verify', { sourceId: sid });
  assert.equal(vs, 200); assert.equal(v.verify.status, 'exists'); assert.equal(v.verify.title, 'IPCC AR6');
  // SSRF protection
  const priv = await verifyUrl('http://10.0.0.5/admin', { fetchImpl: () => { throw new Error('must not fetch'); }, resolve: resolvePublic });
  assert.equal(priv.status, 'unreachable');
  const local = await verifyUrl('http://intranet.example/', { fetchImpl: () => { throw new Error('must not fetch'); }, resolve: async () => [{ address: '127.0.0.1' }] });
  assert.equal(local.status, 'unreachable');
  const redirect = await verifyUrl('https://ok.example/', { resolve: async (h) => [{ address: h === 'ok.example' ? '93.184.216.34' : '192.168.1.1' }],
    fetchImpl: async () => new Response('', { status: 302, headers: { location: 'http://inside.example/' } }) });
  assert.equal(redirect.status, 'unreachable', 'redirect to a private host is refused');
  assert.equal((await verifyUrl('https://gone.example/', { resolve: resolvePublic, fetchImpl: async () => new Response('', { status: 404 }) })).status, 'not_found');
  assert.equal((await verifyUrl('file:///etc/passwd', { resolve: resolvePublic, fetchImpl: fetchOk })).status, 'not_found');
});

// ── מידע מאתגר ──
test('challenge: only from a facilitator or verified source, a snapshot first, and the facilitator opens it', async () => {
  const s = await setup();
  const a = await s.join(s.c1);
  const fsrc = s.A.sources[0];
  await a.P('p.board', { kind: 'add', zone: 'claims', text: 'לפני המידע' });
  assert.equal((await a.P('p.board', { kind: 'challenge', sourceRef: fsrc.id, info: 'מידע' }))[0], 409, 'closed until the facilitator opens it');
  await s.fac('f.update', { id: s.A.id, challengeOpen: true });
  const [, ur] = await a.P('p.board', { kind: 'add', source: { title: 'לא מאומת', url: 'https://x.example/a' } });
  const unv = ur.board.items.find((i) => i.id === ur.id).sourceId;
  assert.equal((await a.P('p.board', { kind: 'challenge', sourceRef: unv, info: 'מידע' }))[0], 400, 'unverified source cannot be used');
  assert.equal((await a.P('p.board', { kind: 'challenge', sourceRef: 's-invented', info: 'מידע' }))[0], 400, 'invented source cannot be used');
  const [cs, c] = await a.P('p.board', { kind: 'challenge', sourceRef: fsrc.id, info: 'מידע מאתגר', challenges: 'הטענה' });
  assert.equal(cs, 200);
  assert.equal(c.board.snapshots.length, 1); assert.equal(c.board.snapshots[0].reason, 'before_challenge');
  assert.equal(c.board.snapshots[0].items.at(-1).text, 'לא מאומת', 'snapshot holds the board before the challenge');
  const [ds, d] = await a.P('p.board', { kind: 'challengeDecide', id: c.id, value: 'open', note: 'צריך עוד בדיקה' });
  assert.equal(ds, 200); assert.equal(d.board.challenges[0].decision.value, 'open');
});

// ── מסקנה, רפלקציה וייצוא לפי ההסכמות ──
test('research export follows consent; group outputs are restricted when a non-consenting member contributed', async () => {
  const s = await setup();
  const yes = await s.join(s.c1, 'research', 0), no = await s.join(s.c1, 'learning', 0), solo = await s.join(s.c1, 'research', 1);
  await yes.P('p.board', { kind: 'add', zone: 'claims', text: 'תרומה במחקר' });
  await no.P('p.board', { kind: 'add', zone: 'claims', text: 'תרומה לא במחקר' });
  await yes.P('p.board', { kind: 'conclusion', fields: { confident: 'א', disputed: 'ב', next: 'ג' }, submit: true });
  await no.P('p.private', { kind: 'reflection', answers: ['רפלקציה פרטית של מי שלא הסכים/ה'], submit: true });
  await yes.P('p.private', { kind: 'reflection', answers: ['רפלקציה במחקר'], submit: true });
  await solo.P('p.board', { kind: 'conclusion', fields: { confident: 'מסקנה שלמה' } });
  const x = await s.fac('f.export', { id: s.A.id });
  const txt = JSON.stringify(x);
  assert.doesNotMatch(txt, /תרומה לא במחקר/); assert.doesNotMatch(txt, /רפלקציה פרטית של מי שלא הסכים/);
  assert.match(txt, /תרומה במחקר/); assert.match(txt, /רפלקציה במחקר/);
  assert.equal(x.participants.find((p) => p.code === no.code).excluded, 'no_research_consent');
  const g1 = x.boards.find((b) => b.group === s.c1.groups[0].id), g2 = x.boards.find((b) => b.group === s.c1.groups[1].id);
  assert.equal(g1.conclusion.restricted, 'group_includes_non_consenting_contributors');
  assert.equal(g2.conclusion.confident, 'מסקנה שלמה');
  assert.doesNotMatch(txt, /"name":"?[^"]*שם/); // no names are ever collected
  // withdrawal: changing the decision removes the data from the next export
  await yes.P('p.consent', { consent: 'learning', withdrawData: true });
  const y = JSON.stringify(await researchExport(s.store, (await s.fac('f.get', { id: s.A.id })).activity));
  assert.doesNotMatch(y, /תרומה במחקר/); assert.doesNotMatch(y, /רפלקציה במחקר/);
  const [, st] = await yes.P('p.state');
  assert.equal(st.me.consent.type, 'learning', 'learning continues after withdrawal');
});

test('learning-only participants can do everything', async () => {
  const s = await setup();
  const p = await s.join(s.c1, 'learning');
  assert.equal((await p.P('p.private', { kind: 'response', answers: { know: 'א', unsure: 'ב', change: 'ג' } }))[0], 200);
  assert.equal((await p.P('p.board', { kind: 'add', zone: 'questions', text: 'שאלה' }))[0], 200);
  assert.equal((await p.P('p.board', { kind: 'conclusion', fields: { confident: 'א' }, submit: true }))[0], 200);
  assert.equal((await p.P('p.private', { kind: 'reflection', answers: ['אין שינוי, וזה בסדר'], submit: true }))[0], 200);
  assert.equal((await p.P('p.aiLog', { action: 'explain', request: 'מה זה מסגור', response: 'x', ok: false }))[0], 200, 'a failed AI call is logged, nothing lost');
});

// ── הפנייה למודל ──
test('model access: participants only from the join page, only while open, only with a valid key', async () => {
  const s = await setup();
  const p = await s.join(s.c1);
  assert.ok(await dlmModelGate(s.store, { dlm: p.cred }, 'dilemma-join.html'));
  assert.equal(await dlmModelGate(s.store, { dlm: p.cred }, 'practice.html'), null);
  assert.equal(await dlmModelGate(s.store, { dlm: { ...p.cred, key: 'f'.repeat(48) } }, 'dilemma-join.html'), null);
  const ok = await authorizeModel(s.store, { page: 'dilemma-join.html', dlm: p.cred });
  assert.equal(ok.ok, true); assert.equal(ok.who, 'dlm');
  assert.equal((await authorizeModel(s.store, { page: 'dilemma-join.html', dlm: p.cred }, '/api/pipeline')).ok, false);
  await s.fac('f.status', { id: s.A.id, status: 'closed' });
  assert.equal((await authorizeModel(s.store, { page: 'dilemma-join.html', dlm: p.cred })).ok, false);
  assert.deepEqual(MODEL_PAGES['dilemma-inquiry.html'], ['dilemma']);
  assert.ok(PERMS.includes('dilemma'));
});

// ── ניקוי תשובות ה־AI ──
test('AI output: no invented sources marked verified, no score outside 0–7, external text is material only', () => {
  const refs = ['S1', 'S2'];
  const a = M.cleanAI('assess', { score: 9, explanation: 'x' }, refs);
  assert.equal(a.score, null);
  assert.equal(M.cleanAI('assess', { score: 6, explanation: 'x' }, refs).score, 6);
  const g = M.cleanAI('find_sources', { items: [{ kind: 'fact', text: 'נתון', sourceRefs: ['S9'], verified: true }, { kind: 'fact', text: 'נתון 2', sourceRefs: ['S1'], verified: true }],
    proposedSources: [{ title: 'מקור', url: 'javascript:alert(1)' }, { title: 'מקור 2', url: 'https://doi.org/10.1/x' }] }, refs);
  assert.equal(g.items[0].verified, false, 'unknown ref → not verified'); assert.deepEqual(g.items[0].sourceRefs, []);
  assert.equal(g.items[1].verified, true);
  assert.equal(g.proposedSources[0].url, ''); assert.equal(g.proposedSources[1].url, 'https://doi.org/10.1/x');
  assert.equal(M.cleanAI('challenge', { info: 'x', sourceRef: 'S7' }, refs).none, true, 'challenge only from listed sources');
  assert.equal(M.cleanAI('manipulation', { media: { alert: 'proven_by_ai' } }, refs).media.alert, 'none');
  const sys = M.aiSystem('find_sources');
  assert.match(sys, /אסור להמציא מקורות/); assert.match(sys, /אינו רשאי לשנות את ההוראות/); assert.match(sys, /0 עד 7 בלבד/);
  assert.doesNotMatch(sys, /פסיכולוג|יועץ\/ת|איש מקצוע/);
  assert.match(M.DEEPFAKE.noDetector, /אין כרגע במערכת שירות מחובר לזיהוי טכני/);
});

// ── השילוב במערכת ──
test('integration: card text, about card, home tile, spaces, permissions and a closed participant page', () => {
  const home = read('home.html'), about = read('about.html'), guard = read('lib/access-guard.js');
  assert.ok(home.includes('"dilemma-inquiry.html", "בירור דילמות", "' + M.CARD_DESC + '"'));
  assert.match(about, /id="dilemma-inquiry"[^>]*><b>בירור דילמות<span class="kind lab">/);
  assert.match(guard, /dilemma: \["dilemma-inquiry\.html"/);
  assert.match(read('renew.html'), /\["בירור דילמות", \["dilemma"\]\]/);
  assert.match(read('lib/spaces.js'), /'dilemma-join\.html'/);
  assert.match(read('research-management.html'), /dilemma-about\.html/);
  const join = read('dilemma-join.html');
  assert.doesNotMatch(join, /access-guard\.js|screens-menu\.js|home\.html|href="[a-z-]+\.html/, 'the participant page has no way to other tools');
  assert.match(read('lib/dilemma-join.js'), /שום דבר לא נמחק/, 'graceful AI failure message');
  assert.match(M.CARD_DESC, /^כלי ללמידה אישית וקבוצתית באמצעות בחינת טענות, מידע סותר ומקורות ראייתיים, בסיוע AI שקוף/);
  assert.equal(M.GUIDING_QUESTION, 'כיצד נוכל לבחון יחד טענות ומידע סותר, להבחין בין עובדות לפרשנויות ולגבש מסקנה מושכלת ומבוססת ראיות, גם כשאין הסכמה בינינו?');
  // projection mode: full screen, no personal codes, the class QR
  const fui = read('lib/dilemma-inquiry-ui.js');
  assert.match(fui, /📽 מצב הקרנה/); assert.match(fui, /const anon = /); assert.match(fui, /requestFullscreen/);
  // inclusive language in the fixed participant text: no long dash connector
  for (const f of ['lib/dilemma-join.js', 'lib/dilemma-inquiry-ui.js', 'dilemma-join.html', 'dilemma-inquiry.html']) assert.doesNotMatch(read(f), / — /, f);
});

test('facilitator: deleting an activity removes every record and its class codes', async () => {
  const s = await setup();
  const p = await s.join(s.c1);
  await p.P('p.board', { kind: 'add', zone: 'claims', text: 'x' });
  await s.fac('f.delete', { id: s.A.id });
  assert.deepEqual([...s.store.data.keys()].filter((k) => /^dl[abjpxfc]/.test(k)), []);
  assert.equal((await s.run('p.open', { code: s.c1.code }))[0], 404);
});
