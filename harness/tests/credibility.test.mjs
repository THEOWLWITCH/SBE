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
  const team = async (cls, name, consents = ['research', 'research'], noPre = false) => {
    const [s, r] = await run('p.teamCreate', { code: cls.code, name, members: consents.map((c, i) => ({ name: 'משתתפת ' + i, consent: 'research' })) });
    assert.equal(s, 201, JSON.stringify(r));
    if (consents.includes('learning')) {
      const ed = await fac('f.teamEdit', { id: activity.id, teamId: r.t, members: r.team.members.map((m, i) => ({ ...m, consent: consents[i] })) });
      r.team = ed.team;
    }
    const cred = { a: r.a, t: r.t, key: r.key };
    const pre = Object.fromEntries(['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8'].map((k, i) => [k, i % 2 ? 4 : 2]));
    if (!noPre) for (const m of r.team.members) await run('p.reflect', { member: m.id, pre, initial: 'עמדה' }, cred);
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
  assert.ok(M.FIELDS.length >= 12 && M.FIELDS[0].k === 'claim');
  assert.match(M.assessSystem('final'), /process/);
  assert.deepEqual(M.REFLECT.map((q) => q.k), ['feel', 'think', 'changed', 'why', 'could', 'free']);
});

test('team entry: up to 15 teams per class, consent per member, join only with the team code', async () => {
  const E = await setup();
  const [s0] = await E.run('p.teamCreate', { code: E.c1.code, name: 'א', members: [{ name: 'רונית' }] });
  assert.equal(s0, 400, 'consent required');
  const t1 = await E.team(E.c1, 'צוות 1');
  const [sj, rj] = await E.run('p.teamJoin', { code: E.c1.code, tcode: t1.r.team.code });
  assert.equal(sj, 200); assert.equal(rj.t, t1.r.t);
  const [sx] = await E.run('p.teamJoin', { code: E.c2.code, tcode: t1.r.team.code });
  assert.equal(sx, 404, 'team code from another class');
  for (let i = 2; i <= 15; i++) await E.team(E.c1, 'צוות ' + i);
  const [sf] = await E.run('p.teamCreate', { code: E.c1.code, name: 'צוות 16', members: [{ name: 'x', consent: 'research' }] });
  assert.equal(sf, 409);
  const [, info] = await E.run('p.class', { code: E.c1.code });
  assert.equal(info.full, true); assert.equal(info.teams.length, 15);
  assert.ok(!JSON.stringify(info).includes('משתתפת'), 'class view shows no names');
});

const P8 = Object.fromEntries(['a1','a2','a3','a4','a5','a6','a7','a8'].map((k) => [k, 3]));
const FEEL = { f1: 4, f2: 3, f3: 2, f4: 3, f5: 2, f6: 5, f7: 2 }, THINK = { t1: 4, t2: 3, t3: 4, t4: 2, t5: 3, t6: 4 };
test('separation: a team sees only itself; reflections are shared within the team, AI level only to the lecturer', async () => {
  const E = await setup();
  const t1 = await E.team(E.c1, 'צוות 1'), t2 = await E.team(E.c1, 'צוות 2');
  const [, k] = await t1.P('p.check', { kind: 'new', url: 'https://example.org/a', title: 'פוסט' });
  const [s2] = await E.run('p.check', { kind: 'fields', id: k.id, fields: { claim: 'x' } }, { ...t2.cred });
  assert.equal(s2, 404);
  const [sb] = await E.run('p.get', {}, { a: t1.cred.a, t: t1.cred.t, key: t2.cred.key });
  assert.equal(sb, 401);
  const m = t1.r.team.members[0].id;
  // פתוחה מראש (26/11/2026: "פתח מראש את השאלונים"); המרצה יכולה לסגור
  await E.fac('f.update', { id: E.A.id, reflectOpen: false });
  { const [sx] = await t1.P('p.reflect', { member: m, post: P8, reflect: { feel: FEEL, think: THINK, changed: 'yes', why: 'מקור רשמי', free: '' } }); assert.equal(sx, 409, 'closed by the lecturer'); }
  await E.fac('f.update', { id: E.A.id, reflectOpen: true });
  { const [sp] = await t1.P('p.reflect', { member: m, reflect: { feel: FEEL, think: THINK, changed: 'no' } }); assert.equal(sp, 400, 'post questionnaire is required'); }
  { const [sh] = await t1.P('p.reflect', { member: m, post: P8, reflect: { feel: { f1: 3 }, think: THINK, changed: 'no' } }); assert.equal(sh, 400, 'every feeling statement is required'); }
  await t1.P('p.reflect', { member: m, post: P8, reflect: { feel: FEEL, think: THINK, changed: 'yes', why: 'מקור רשמי', free: '' } });
  const [sn] = await t1.P('p.reflect', { member: m, ai: { criteria: [], level: null } });
  assert.equal(sn, 400, 'empty analysis rejected');
  await t1.P('p.reflect', { member: m, ai: { criteria: [{ k: 'cross', found: true, note: 'בדקה מקור רשמי' }], level: 75, levelWhy: 'בלי דוגמה', strength: 'כנות', question: 'מה עוד?' } });
  const [, g] = await t1.P('p.get');
  assert.deepEqual(g.reflections[m].reflect.feel, FEEL, 'reflection saved');
  assert.equal(g.reflections[m].ai.criteria.find((c) => c.k === 'cross').found, true);
  assert.equal(g.reflections[m].ai.level, undefined, 'suggested level hidden from the team');
  const [, g2] = await t2.P('p.get');
  assert.ok(!JSON.stringify(g2).includes('סקרנות'), 'another team does not see it');
  const ft = await E.fac('f.team', { id: E.A.id, teamId: t1.r.t });
  assert.equal(ft.reflections[m].ai.level, 75, 'lecturer sees the suggested level');
  await t1.P('p.reflect', { member: m, post: P8, reflect: { feel: FEEL, think: THINK, changed: 'no' } });
  const [, g3] = await t1.P('p.get');
  assert.equal(g3.reflections[m].ai, null, 'new reflection clears the old analysis');
});

test('stages: 1 details and team score · 2 AI · 3 more items until "no more" · 4 AI again with process feedback', async () => {
  const E = await setup();
  const t = await E.team(E.c1, 'צוות 1');
  const [, k] = await t.P('p.check', { kind: 'new', url: 'https://example.org/a' });
  assert.equal(k.check.verify.status, 'exists');
  { const [sx] = await t.P('p.check', { kind: 'ai', id: k.id, stage: 'first', result: { score: 3, summary: 'x' } }); assert.equal(sx, 409, 'AI only after the team score'); }
  { const [sx] = await t.P('p.check', { kind: 'team', id: k.id, score: 3, why: 'x' }); assert.equal(sx, 409, 'team score needs the claim'); }
  await t.P('p.check', { kind: 'fields', id: k.id, fields: { claim: 'מדענים ממציאים נתונים', who: 'חשבון אנונימי' } });
  const [s6] = await t.P('p.check', { kind: 'team', id: k.id, score: 6, why: 'x' }); assert.equal(s6, 400);
  await t.P('p.check', { kind: 'team', id: k.id, score: 2, why: 'אין מקור' });
  { const [sx] = await t.P('p.check', { kind: 'ext', id: k.id, found: 'x' }); assert.equal(sx, 409, 'items only after the AI check'); }
  const [sa] = await t.P('p.check', { kind: 'ai', id: k.id, stage: 'first', result: { score: 9, summary: 'x', missing: ['מקור ראשוני'] } });
  assert.equal(sa, 200);
  let [, g] = await t.P('p.get');
  assert.equal(g.checks[0].first.score, 5, 'clamped to 1..5');
  { const [sx] = await t.P('p.check', { kind: 'fields', id: k.id, fields: { claim: 'y' } }); assert.equal(sx, 409, 'details locked after AI'); }
  { const [sx] = await t.P('p.check', { kind: 'team', id: k.id, score: 4, why: 'x' }); assert.equal(sx, 409, 'team score locked after AI'); }
  { const [sx] = await t.P('p.check', { kind: 'ai', id: k.id, stage: 'final', result: { score: 3, summary: 'x' } }); assert.equal(sx, 409, 'final only after no more info'); }
  await t.P('p.check', { kind: 'ext', id: k.id, url: 'https://example.org/b', title: 'אתר הכנסת', extKind: 'official', found: 'החוק קיים' });
  await t.P('p.check', { kind: 'ext', id: k.id, found: 'אתר בדיקת עובדות מצא שהציטוט חתוך' });
  await t.P('p.check', { kind: 'done', id: k.id });
  { const [sx] = await t.P('p.check', { kind: 'ext', id: k.id, found: 'z' }); assert.equal(sx, 409); }
  await t.P('p.check', { kind: 'ai', id: k.id, stage: 'final', result: { score: 4, summary: 'מסכים', vsTeam: 'קרוב', changed: 'עלה', process: { strong: ['הצליבו עם מקור רשמי'], improve: ['לחפש את המקור הראשוני'], tip: 'להתחיל מהמפרסם' } } });
  [, g] = await t.P('p.get');
  assert.deepEqual([g.checks[0].team.score, g.checks[0].first.score, g.checks[0].final.score], [2, 5, 4]);
  assert.equal(g.checks[0].external.length, 2);
  assert.deepEqual(g.checks[0].final.process.strong, ['הצליבו עם מקור רשמי']);
  const [sr] = await t.P('p.check', { kind: 'reopen', id: k.id });
  assert.equal(sr, 409);
  const [, k2] = await t.P('p.check', { kind: 'new', url: 'https://example.org/c' }); assert.ok(k2.id, 'several checks per team');
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
  await part.P('p.reflect', { member: part.r.team.members[1].id, post: P8, reflect: { feel: FEEL, think: THINK, changed: 'no' } });
  const a = await E.store.get('cra:' + E.A.id);
  const x = await researchExport(E.store, a);
  const s = JSON.stringify(x);
  // ראשי התיבות רק של מי שהסכים/ה למחקר (המשתתפים כותבים ראשי תיבות בלבד)
  const tpx = x.teams.find((t) => !t.allConsented); assert.equal(tpx.members[1].initials, undefined, 'no initials for learning-only'); assert.ok(tpx.members[0].initials);
  assert.equal(x.teams[0].members[0].initials, all.r.team.members[0].name);
  assert.ok(x.teams.every((t) => t.className === 'גורדון' || t.className), 'class name');
  assert.ok(!s.includes('פרטי'), 'learning-only reflection excluded');
  const tp = x.teams.find((t) => !t.allConsented); assert.equal(tp.checks, null); assert.equal(tp.summary, null);
  const ta = x.teams.find((t) => t.allConsented); assert.equal(ta.checks.length, 1);
  const [, k2] = await all.P('p.check', { kind: 'new', url: 'https://example.org/y', title: 'שני' });
  await all.P('p.check', { kind: 'remove', id: k2.id });
  const x2 = await researchExport(E.store, await E.store.get('cra:' + E.A.id));
  const ta2 = x2.teams.find((t) => t.allConsented); assert.equal(ta2.checks.length, 1); assert.equal(ta2.removedChecks.length, 1, 'restart keeps the check for research');
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

test('שאלון עמדות ראשוני: עבודת הצוות מתחילה רק אחרי שכולם מילאו', async () => {
  const E = await setup();
  const t = await E.team(E.c1, 'לפני', ['research', 'research'], true);
  const [s1, b1] = await t.P('p.check', { kind: 'new', url: 'https://example.org/a' });
  assert.equal(s1, 409); assert.match(b1.error, /שאלון העמדות/);
  const [m1, m2] = t.r.team.members.map((m) => m.id);
  const [sb] = await t.P('p.reflect', { member: m1, pre: { a1: 3 } }); assert.equal(sb, 400);
  const full = { a1: 1, a2: 2, a3: 3, a4: 4, a5: 5, a6: 4, a7: 3, a8: 2 };
  { const [sx] = await t.P('p.reflect', { member: m1, pre: full }); assert.equal(sx, 400, 'stance question is required'); }
  await t.P('p.reflect', { member: m1, pre: full, initial: 'עמדה' });
  const [s2] = await t.P('p.check', { kind: 'new', url: 'https://example.org/a' }); assert.equal(s2, 409);
  { const t2 = await E.team(E.c1, 'פתיחה', ['research', 'research'], true);
    const [so0] = await t2.P('p.openWork', {}); assert.equal(so0, 409, 'needs one questionnaire');
    await t2.P('p.reflect', { member: t2.r.team.members[0].id, pre: full, initial: 'עמדה' });
    const [so, bo] = await t2.P('p.openWork', {}); assert.equal(so, 200); assert.equal(bo.team.workOpen, true);
    const [sc] = await t2.P('p.check', { kind: 'new', url: 'https://example.org/b' }); assert.equal(sc, 200, 'work area opened'); }
  await t.P('p.reflect', { member: m2, pre: full, initial: 'עמדה' });
  const [s3] = await t.P('p.check', { kind: 'new', url: 'https://example.org/a' }); assert.equal(s3, 200);
  const [, g] = await t.P('p.get');
  assert.equal(g.reflections[m1].pre, true); assert.equal(typeof g.reflections[m1].pre, 'boolean');
  const x = await E.fac('f.export', { id: E.A.id });
  assert.equal(x.teams[0].members[0].pre.a1, 1);
});

test('one QR for all classes: picks a class, then enters only that class', async () => {
  const { run, fac, A, c1, c2 } = await setup();
  const { activity } = await fac('f.get', { id: A.id });
  assert.ok(activity.allCode, 'shared code created with the second class');
  const [s, b] = await run('p.class', { code: activity.allCode });
  assert.equal(s, 200);
  assert.deepEqual(b.pick.classes.map((c) => c.code), [c1.code, c2.code]);
  assert.equal(b.activity, undefined);
  const [st] = await run('p.teamCreate', { code: activity.allCode, name: 'x', members: [{ name: 'א', consent: 'research' }] });
  assert.equal(st, 404, 'shared code cannot open a team directly');
  const old = activity.allCode;
  const { activity: a2 } = await fac('f.allCode', { id: A.id });
  assert.notEqual(a2.allCode, old);
  const [so] = await run('p.class', { code: old }); assert.equal(so, 404);
});

test('ההנחיה ל־AI: אותו נוסח בפנקס ובמודל, ובגירסה לסטודנטיות.ים', async () => {
  const vm = await import('node:vm');
  const nb = read('credibility-notebook.html');
  const a = nb.indexOf('  var SCALE = ['), b = nb.indexOf("  ].join('\\n');", nb.indexOf('  var PROMPT = [')) + "  ].join('\\n');".length;
  const ctx = {}; vm.runInNewContext(nb.slice(a, b) + '\nthis.P = PROMPT;', ctx);
  assert.equal(ctx.P, M.AI_PROMPT);
  assert.match(M.AI_PROMPT, /אין לי עוד מידע/);
  for (const l of M.SCALE) assert.ok(M.AI_PROMPT.includes(l.score + ' = ' + l.name + ': ' + l.d));
  assert.match(read('credibility-pocket.html'), /M\.AI_PROMPT/);
  const n = read('credibility-notebook.html');
  for (const w of ['ד״ר איבנה רטנר', 'ד״ר עינת שושן־רפאלי', 'ד״ר יעל שדה', 'המכללה האקדמית גורדון', 'המכללה האקדמית אורנים ומוסד שמואל נאמן', 'mailto:yael.sade@gmail.com', 'mailto:ei0509000408@gmail.com', 'mailto:ratnere@gmail.com']) assert.ok(n.includes(w), w);
});

test('מאגר הידיעות: שתי קבוצות, פריטים שלמים, טקסט לבדיקה, סדר לפי הדילמה', () => {
  const req = createRequire(import.meta.url);
  const B = req('../../app/lib/credibility-bank.js');
  assert.equal(B.GROUPS.length, 3);
  assert.equal(B.all().length, 15);
  const ids = new Set();
  for (const x of B.all()) {
    assert.match(x.id, /^[a-z]\d{1,2}$/); assert.ok(!ids.has(x.id)); ids.add(x.id);
    for (const f of ['title', 'who', 'outlet', 'date', 'link', 'body']) assert.ok(x[f], x.id + ' ' + f);
    if (x.url) assert.match(x.url, /^https:\/\//);
    assert.ok(!/—/.test(x.title + x.body), 'בלי מקף ארוך ' + x.id);
    assert.ok(B.text(x).includes(x.body));
  }
  assert.equal(B.ordered('האם כולם מושחתים?')[0].key, 'corrupt');
  assert.equal(B.ordered('התקשורת שמאלנית?')[0].key, 'media');
  assert.equal(B.ordered('האם ההתחממות הגלובלית היא הונאה?')[0].key, 'climate');
  assert.deepEqual(B.GROUPS.map((g) => g.t), ['שחיתות שלטונית', 'התחממות גלובלית', 'תקשורת שמאלנית']);
  const html = fs.readFileSync(new URL('../../app/credibility-join.html', import.meta.url), 'utf8');
  assert.ok(html.indexOf('lib/credibility-bank.js') > 0 && html.indexOf('lib/credibility-bank.js') < html.indexOf('lib/credibility-join.js'));
});

test('צוותים מוכנים: 7 צוותים לכל כיתה, קוד של 3 ספרות, ומי שמצטרף/ת נוסף/ה לרשימה', async () => {
  const E = await setup();
  const r1 = await E.fac('f.teamsMake', { id: E.A.id, classId: E.c1.id, college: '1', cls: '1', n: 7 });
  assert.deepEqual(r1.made, ['111', '112', '113', '114', '115', '116', '117']);
  const r2 = await E.fac('f.teamsMake', { id: E.A.id, classId: E.c2.id, college: '2', cls: '1', n: 7 });
  assert.equal(r2.made[0], '211');
  assert.deepEqual((await E.fac('f.teamsMake', { id: E.A.id, classId: E.c1.id, college: '1', cls: '1', n: 7 })).made, [], 'again: nothing new');
  const ca = await E.fac('f.classAdd', { id: E.A.id, name: 'כיתה 3' }); const c3 = ca.activity.classes.find((x) => x.name === 'כיתה 3');
  const r3 = await E.fac('f.teamsMake', { id: E.A.id, classId: c3.id, college: '2', cls: '3', n: 15 });
  assert.equal(r3.made.length, 15); assert.equal(r3.made[14], '2315');
  const [s15] = await E.run('p.teamJoin', { code: c3.code, tcode: '2315', name: 'א.ב' });
  assert.equal(s15, 200, 'four-digit team code');
  const [sc] = await E.run('f.teamsMake', { id: E.A.id, classId: E.c2.id, college: '1', cls: '1', n: 7 }, { token: 'T1' });
  assert.equal(sc, 409, 'code of another class');
  const [sj, rj] = await E.run('p.teamJoin', { code: E.c1.code, tcode: '113', name: 'י.ש' });
  assert.equal(sj, 200); assert.equal(rj.team.name, 'צוות 3'); assert.deepEqual(rj.team.members.map((m) => m.name), ['י.ש']);
  const [, rj2] = await E.run('p.teamJoin', { code: E.c1.code, tcode: '113', name: 'יש' });
  assert.equal(rj2.team.members.length, 1, 'same initials are not added twice');
  const [sx] = await E.run('p.teamJoin', { code: E.c2.code, tcode: '113', name: 'א.ב' });
  assert.equal(sx, 404);
  const [, g] = await E.run('p.get', {}, { a: rj.a, t: rj.t, key: rj.key });
  assert.equal(g.team.code, '113');
});

test('מרכז המחקר: רשימת הפעילויות עם התקדמות, שיוך למחקר, וטבלאות הייצוא', async () => {
  const E = await setup();
  const t = await E.team(E.c1, 'צוות 1', ['research', 'research']);
  await t.P('p.check', { kind: 'new', url: 'https://example.org/x', title: 'מקור' });
  const l = await E.fac('f.researchList', {});
  const a = l.activities.find((x) => x.id === E.A.id); assert.ok(a);
  const c = a.classes.find((x) => x.teams === 1); assert.equal(c.members, 2); assert.equal(c.checks, 1);
  await E.fac('f.linkStudy', { id: E.A.id, studyId: 'study-1' });
  const l2 = await E.fac('f.researchList', {}); assert.equal(l2.activities.find((x) => x.id === E.A.id).studyId, 'study-1');
  const M = (await import('../../app/lib/credibility-model.js')).default;
  const x = await researchExport(E.store, await E.store.get('cra:' + E.A.id));
  assert.equal(x.activity.studyId, 'study-1');
  const pr = M.participantsRows(x); assert.equal(pr.length, 3); assert.ok(pr[0].includes('initials'));
  const cr = M.checksRows(x); assert.equal(cr.length, 2); assert.equal(cr[1][2], x.teams.find((t) => t.summary && t.summary.length).code);
  assert.ok(M.toCsv(pr).startsWith('﻿'));
});

test('ייצוא לפי מכללה וכיתה', () => {
  const M = require('../../app/lib/credibility-model.js');
  assert.equal(M.collegeOf('גורדון · כיתה 3'), 'גורדון'); assert.equal(M.classOf('גורדון · כיתה 3'), 'כיתה 3');
  assert.equal(M.classOf('אורנים'), 'כיתה 1'); assert.ok(M.isTestClass('כיתת בדיקה'));
  const r = M.checksRows({ teams: [{ className: 'גורדון · כיתה 2', code: '2210', summary: [{ title: 'x', ext: 0, turns: 0 }] }] });
  assert.deepEqual(r[1].slice(0, 3), ['גורדון', 'כיתה 2', '2210']);
});

test('כניסה בקוד צוות בלבד: הקוד מוביל לכיתה שלו', async () => {
  const E = await setup();
  await E.fac('f.teamsMake', { id: E.A.id, classId: E.c1.id, college: '2', cls: '1', n: 4 });
  const [s, r] = await E.run('p.findTeam', { tcode: '214' });
  assert.equal(s, 200); assert.equal(r.code, E.c1.code);
  const [s2] = await E.run('p.findTeam', { tcode: '299' }); assert.equal(s2, 404);
  await E.fac('f.status', { id: E.A.id, status: 'closed' });
  const [s3] = await E.run('p.findTeam', { tcode: '214' }); assert.equal(s3, 404, 'closed activity');
});
