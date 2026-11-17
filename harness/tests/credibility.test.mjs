// בדיקת אמינות של מקורות (17/11/2026): הסולם, הכניסה לצוות, ההפרדה בין צוותים, השלבים, הרפלקציה, הייצוא והפנייה למודל.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { handleCredibility, crdModelGate, researchExport, _resetCrd } from '../lib/credibility.mjs';
import { MODEL_PAGES, PERMS } from '../lib/access.mjs';
const require = createRequire(import.meta.url);
const M = require('../../app/lib/credibility-model.js');
const read = (f) => fs.readFileSync(new URL('../../app/' + f, import.meta.url), 'utf8');

function memoryStore() {
  const data = new Map();
  return { data, async get(k) { return data.has(k) ? structuredClone(data.get(k)) : null; }, async set(k, v) { data.set(k, structuredClone(v)); }, async del(k) { data.delete(k); },
    async list(prefix, o = {}) { return [...data].filter(([k]) => k.startsWith(prefix)).map(([key, value]) => (o.keysOnly ? { key } : { key, value: structuredClone(value) })); } };
}
const WHO = { T1: { principal: 'fac-1' }, T2: { principal: 'fac-2' } };
const fetchOk = async () => new Response('<html><head><title>Knesset</title></head></html>', { status: 200, headers: { 'content-type': 'text/html' } });
const resolvePublic = async () => [{ address: '93.184.216.34' }];
async function setup() {
  _resetCrd();
  const store = memoryStore();
  const run = (op, input, extra = {}) => handleCredibility(store, { action: 'crdCall', op, input, ...extra }, { who: async (t) => WHO[t] || null, fetchImpl: fetchOk, resolve: resolvePublic });
  const fac = async (op, input, t = 'T1') => { const [s, b] = await run(op, input, { token: t }); assert.ok(s < 300, op + ': ' + JSON.stringify(b)); return b; };
  const { activity } = await fac('f.create', { title: 'גורדון', dilemma: 'האם התקשורת שמאלנית?' });
  const c1 = (await fac('f.classAdd', { id: activity.id, name: 'כיתה א' })).class;
  const c2 = (await fac('f.classAdd', { id: activity.id, name: 'כיתה ב' })).class;
  const team = async (cls, name, consents = ['research', 'research']) => {
    const [s, r] = await run('p.teamCreate', { code: cls.code, name, members: consents.map((c, i) => ({ name: 'משתתפת ' + i, consent: 'research' })) });
    assert.equal(s, 201, JSON.stringify(r));
    if (consents.includes('learning')) {
      const ed = await fac('f.teamEdit', { id: activity.id, teamId: r.t, members: r.team.members.map((m, i) => ({ ...m, consent: consents[i] })) });
      r.team = ed.team;
    }
    const cred = { a: r.a, t: r.t, key: r.key };
    return { r, cred, P: (op, input) => run(op, input || {}, cred) };
  };
  return { store, run, fac, A: activity, c1, c2, team };
}

test('scale: five levels, merged from 0–7, grey is not a score', () => {
  assert.deepEqual(M.SCALE.map((l) => l.score), [1, 2, 3, 4, 5]);
  assert.deepEqual(M.FROM_OLD, { 0: 1, 1: 1, 2: 2, 3: 3, 4: 3, 5: 4, 6: 5, 7: 5 });
  for (const bad of [0, 6, 7, 2.5, '3']) assert.equal(M.validScore(bad), false);
  assert.match(M.dotHTML(null), /—/);
  for (const l of M.SCALE) assert.equal(M.EXAMPLES[l.score].length, 4);
  for (const l of M.SCALE) assert.deepEqual(M.EXAMPLES[l.score].map((e) => e[0]), ['✓', '✓', '✗', '✗']);
  assert.ok(M.QUESTIONS.length >= 5 && M.QUESTIONS.length <= 10);
  assert.equal(M.GRADE.criteria.reduce((s, c) => s + c.w, 0), 100);
  assert.equal(M.gradeTotal({ desc: 100, cross: 100, reason: 100, ai: 100, update: 100, reflect: 100 }), 100);
  assert.match(M.BASE, /אין לך גישה לאינטרנט/);
  assert.match(M.chatSystem(), /רק הצוות מחליט מתי אין לו יותר מידע/);
  assert.deepEqual(M.REFLECT.map((q) => q.k), ['feel', 'think', 'changed', 'why', 'could', 'free']);
});

test('team entry: up to 10 teams per class, consent per member, join only with the team code', async () => {
  const E = await setup();
  const [s0] = await E.run('p.teamCreate', { code: E.c1.code, name: 'א', members: [{ name: 'רונית' }] });
  assert.equal(s0, 400, 'consent required');
  const t1 = await E.team(E.c1, 'צוות 1');
  const [sj, rj] = await E.run('p.teamJoin', { code: E.c1.code, tcode: t1.r.team.code });
  assert.equal(sj, 200); assert.equal(rj.t, t1.r.t);
  const [sx] = await E.run('p.teamJoin', { code: E.c2.code, tcode: t1.r.team.code });
  assert.equal(sx, 404, 'team code from another class');
  for (let i = 2; i <= 10; i++) await E.team(E.c1, 'צוות ' + i);
  const [sf] = await E.run('p.teamCreate', { code: E.c1.code, name: 'צוות 11', members: [{ name: 'x', consent: 'research' }] });
  assert.equal(sf, 409);
  const [, info] = await E.run('p.class', { code: E.c1.code });
  assert.equal(info.full, true); assert.equal(info.teams.length, 10);
  assert.ok(!JSON.stringify(info).includes('משתתפת'), 'class view shows no names');
});

test('separation: a team sees only itself; reflections are shared within the team, AI level only to the lecturer', async () => {
  const E = await setup();
  const t1 = await E.team(E.c1, 'צוות 1'), t2 = await E.team(E.c1, 'צוות 2');
  const [, k] = await t1.P('p.check', { kind: 'new', url: 'https://example.org/a', title: 'פוסט' });
  const [s2] = await E.run('p.check', { kind: 'fields', id: k.id, fields: { claim: 'x' } }, { ...t2.cred });
  assert.equal(s2, 404);
  const [sb] = await E.run('p.get', {}, { a: t1.cred.a, t: t1.cred.t, key: t2.cred.key });
  assert.equal(sb, 401);
  const m = t1.r.team.members[0].id;
  await t1.P('p.reflect', { member: m, reflect: { feel: 'סקרנות', think: 'צריך לבדוק', changed: 'partly', why: 'מקור רשמי', free: '' } });
  const [sn] = await t1.P('p.reflect', { member: m, ai: { criteria: [], level: null } });
  assert.equal(sn, 400, 'empty analysis rejected');
  await t1.P('p.reflect', { member: m, ai: { criteria: [{ k: 'cross', found: true, note: 'בדקה מקור רשמי' }], level: 75, levelWhy: 'בלי דוגמה', strength: 'כנות', question: 'מה עוד?' } });
  const [, g] = await t1.P('p.get');
  assert.equal(g.reflections[m].reflect.feel, 'סקרנות', 'team sees the reflection');
  assert.equal(g.reflections[m].ai.criteria.find((c) => c.k === 'cross').found, true);
  assert.equal(g.reflections[m].ai.level, undefined, 'suggested level hidden from the team');
  const [, g2] = await t2.P('p.get');
  assert.ok(!JSON.stringify(g2).includes('סקרנות'), 'another team does not see it');
  const ft = await E.fac('f.team', { id: E.A.id, teamId: t1.r.t });
  assert.equal(ft.reflections[m].ai.level, 75, 'lecturer sees the suggested level');
  await t1.P('p.reflect', { member: m, reflect: { feel: 'אחר', think: 'x', changed: 'no' } });
  const [, g3] = await t1.P('p.get');
  assert.equal(g3.reflections[m].ai, null, 'new reflection clears the old analysis');
});

test('stages: team score only after "no more information", AI final only after team score', async () => {
  const E = await setup();
  const t = await E.team(E.c1, 'צוות 1');
  const [, k] = await t.P('p.check', { kind: 'new', url: 'https://example.org/a' });
  assert.equal(k.check.verify.status, 'exists');
  await t.P('p.check', { kind: 'fields', id: k.id, fields: { claim: 'מדענים ממציאים נתונים' } });
  const [sa] = await t.P('p.check', { kind: 'ai', id: k.id, stage: 'first', result: { score: 9, summary: 'x' } });
  assert.equal(sa, 200);
  let [, g] = await t.P('p.get');
  assert.equal(g.checks[0].first.score, 5, 'clamped to 1..5');
  const [sf] = await t.P('p.check', { kind: 'ai', id: k.id, stage: 'final', result: { score: 3, summary: 'x' } });
  assert.equal(sf, 409);
  const [st] = await t.P('p.check', { kind: 'team', id: k.id, score: 3, why: 'x' });
  assert.equal(st, 409);
  await t.P('p.check', { kind: 'ext', id: k.id, url: 'https://example.org/b', title: 'אתר הכנסת', extKind: 'official', found: 'החוק קיים' });
  await t.P('p.check', { kind: 'msg', id: k.id, role: 'team', text: 'מצאנו' });
  await t.P('p.check', { kind: 'done', id: k.id });
  const [s6] = await t.P('p.check', { kind: 'team', id: k.id, score: 6, why: 'x' });
  assert.equal(s6, 400);
  await t.P('p.check', { kind: 'team', id: k.id, score: 4, why: 'יש מסמך רשמי' });
  await t.P('p.check', { kind: 'ai', id: k.id, stage: 'final', result: { score: 4, summary: 'מסכים', vsTeam: 'קרוב', changed: 'עלה' } });
  [, g] = await t.P('p.get');
  assert.deepEqual([g.checks[0].first.score, g.checks[0].team.score, g.checks[0].final.score], [5, 4, 4]);
  const [sr] = await t.P('p.check', { kind: 'reopen', id: k.id });
  assert.equal(sr, 409);
});

test('closed activity: teams can read but not change', async () => {
  const E = await setup();
  const t = await E.team(E.c1, 'צוות 1');
  await E.fac('f.status', { id: E.A.id, status: 'closed' });
  const [sg] = await t.P('p.get'); assert.equal(sg, 200);
  const [sc] = await t.P('p.check', { kind: 'new', url: 'https://example.org/a' }); assert.equal(sc, 409);
});

test('facilitators: only owner and co-facilitators; grade by rubric', async () => {
  const E = await setup();
  const t = await E.team(E.c1, 'צוות 1');
  const [s] = await E.run('f.get', { id: E.A.id }, { token: 'T2' }); assert.equal(s, 404);
  const { coCode } = await E.fac('f.coCode', { id: E.A.id });
  await E.fac('f.coJoin', { code: coCode }, 'T2');
  const r = await E.fac('f.get', { id: E.A.id }, 'T2'); assert.equal(r.teams.length, 1);
  const [sd] = await E.run('f.delete', { id: E.A.id }, { token: 'T2' }); assert.equal(sd, 403);
  const g = await E.fac('f.grade', { id: E.A.id, teamId: t.r.t, grade: { desc: 100, cross: 50, reason: 75, ai: 100, update: 100, reflect: 25 } });
  assert.equal(g.grade.total, Math.round(15 + 12.5 + 18.75 + 15 + 10 + 2.5));
});

test('research export: only consented people, team work only when all consented, no names', async () => {
  const E = await setup();
  const all = await E.team(E.c1, 'כולם', ['research', 'research']);
  const part = await E.team(E.c1, 'חלק', ['research', 'learning']);
  for (const t of [all, part]) { const [, k] = await t.P('p.check', { kind: 'new', url: 'https://example.org/x', title: 'סוד' }); }
  await part.P('p.reflect', { member: part.r.team.members[1].id, reflect: { feel: 'פרטי', changed: 'no' } });
  const a = await E.store.get('cra:' + E.A.id);
  const x = await researchExport(E.store, a);
  const s = JSON.stringify(x);
  assert.ok(!s.includes('משתתפת'), 'no names');
  assert.ok(!s.includes('פרטי'), 'learning-only reflection excluded');
  const tp = x.teams.find((t) => !t.allConsented); assert.equal(tp.checks, null); assert.equal(tp.summary, null);
  const ta = x.teams.find((t) => t.allConsented); assert.equal(ta.checks.length, 1);
});

test('model gate: only the team page, only while open', async () => {
  const E = await setup();
  const t = await E.team(E.c1, 'צוות 1');
  assert.ok(await crdModelGate(E.store, { crd: t.cred }, 'credibility-join.html'));
  assert.equal(await crdModelGate(E.store, { crd: t.cred }, 'dilemma-join.html'), null);
  assert.equal(await crdModelGate(E.store, { crd: { ...t.cred, key: 'a'.repeat(48) } }, 'credibility-join.html'), null);
  await E.fac('f.status', { id: E.A.id, status: 'closed' });
  assert.equal(await crdModelGate(E.store, { crd: t.cred }, 'credibility-join.html'), null);
});

test('integration: permission, pages, about, map, pocket', () => {
  assert.ok(PERMS.includes('credibility'));
  assert.deepEqual(MODEL_PAGES['credibility-check.html'], ['credibility', 'dilemma']);
  assert.match(read('lib/access-guard.js'), /credibility: \["credibility-check.html"\]/);
  assert.match(read('about.html'), /id="credibility-check"/);
  assert.match(read('map.html'), /credibility-check.html/);
  assert.match(read('home.html'), /has\("credibility"\)/);
  const pocket = read('credibility-pocket.html');
  assert.match(pocket, /credibility-join.html/); assert.doesNotMatch(pocket, /access-guard/);
  const join = read('credibility-join.html');
  assert.doesNotMatch(join, /access-guard|screens-menu|home\.html/);
});

test('consent: teams sign; "learning only" is a lecturer exception that a team cannot set or undo', async () => {
  const E = await setup();
  const [sl] = await E.run('p.teamCreate', { code: E.c1.code, name: 'א', members: [{ name: 'רונית', consent: 'learning' }] });
  assert.equal(sl, 400, 'a team cannot choose learning only');
  const t = await E.team(E.c1, 'צוות 1', ['research', 'learning']);
  assert.equal(t.r.team.members[1].consent, 'learning');
  const [, r] = await t.P('p.members', { members: t.r.team.members.map((m) => ({ id: m.id, name: m.name, consent: 'research' })) });
  assert.equal(r.team.members[1].consent, 'learning', 'the exception stays when the team saves again');
  assert.ok(!M.CONSENT.text.join(' ').includes('בלי להסכים'), 'no opt-out wording');
});
