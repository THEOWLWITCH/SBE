// מערך המוכנות: תוכן הכלי (app/lib/readiness-model.js) והערבית (readiness-ar.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const P = require('../../app/lib/readiness-model.js');

const leaves = (o, out = []) => { if (typeof o === 'string') out.push(o); else if (o && typeof o === 'object') for (const v of Object.values(o)) leaves(v, out); return out; };
const TEXT = ['TEAMS', 'TEAM_NOTES', 'TASKS', 'EM', 'REPORT', 'REMS', 'ANNEXES', 'SESSIONS', 'MAPPING', 'TABLETOP_NOTE', 'SIRENS', 'ROUND_DEBRIEF', 'DEBRIEF', 'PILLARS', 'INDEPENDENCE', 'ROUTINE', 'UI'];

test('structure follows the outline: seven teams, 23 tasks, five sessions, three rounds, eight debrief steps', () => {
  assert.equal(P.TEAMS.length, 7);
  assert.equal(P.TASKS.length, 23);
  assert.equal(P.SESSIONS.length, 5);
  assert.equal(P.REMS.length, 6);
  assert.equal(P.SIRENS.rounds.length, 3);
  assert.equal(P.DEBRIEF.reduce((a, d) => a + d.min, 0), 33);
  for (const r of P.SIRENS.rounds) { assert.equal(r.alts.length, 3); for (const id of Object.keys(r.teams)) assert.ok(P.TEAMS.some((t) => t.id === id), id); }
  for (const t of P.TASKS) assert.ok(t.team === 'all' || P.TEAMS.some((x) => x.id === t.team), t.text);
  for (const t of P.TEAMS) assert.ok((P.MAPPING[t.id] || []).length >= 3, t.id);
});

test('fixed text: invitation language, no long dash, no referral to professionals', () => {
  const all = TEXT.flatMap((k) => leaves(P[k]));
  for (const s of all) {
    assert.ok(!/(^|[\s"(])(צריך|צריכה|צריכים|חייב|חייבת|חייבים|חובה|אסור)(?=[\s.,:;!?")]|$)/.test(s), 'invitation language: ' + s);
    assert.ok(!s.includes('—'), 'long dash: ' + s);
    assert.ok(!/פסיכולוג|עובד\/ת סוציאלי|גורם טיפולי|איש\/אשת מקצוע|אנשי מקצוע|רווחה נפשית|שלומות/.test(s), 'no referral: ' + s);
  }
  assert.match(P.TABLETOP_NOTE, /לא בא במקום/);
});

test('Arabic covers every text leaf and keeps the ids', () => {
  const A = P.content('ar');
  assert.equal(A.TEAMS[0].id, 'mgmt');
  assert.equal(A.TASKS.length, P.TASKS.length);
  const he = TEXT.flatMap((k) => leaves(P[k])), ar = TEXT.flatMap((k) => leaves(A[k]));
  assert.equal(ar.length, he.length);
  const left = ar.filter((s, i) => /[֐-׿]/.test(s) && s === he[i] && s !== 'עברית');
  assert.deepEqual(left, []);
  assert.ok(!readFileSync(new URL('../../app/lib/readiness-ar.js', import.meta.url), 'utf8').includes('—'));
});

test('open ends: phrases from the outline are found, and the escalation rules', () => {
  const found = P.detectEnds('הגענו למרחב. אני אבדוק את המפתח. נחליט אחר כך על הפינוי. מחכים לתשובה מהרשות.');
  assert.equal(found.length, 3);
  const past = new Date(Date.now() - 864e5).toISOString().slice(0, 10), future = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  assert.equal(P.endState({ text: 'x', status: 'open' }), 'noOwner');
  assert.equal(P.endState({ owner: 'קשר עם הורים', next: future }), 'ok');
  assert.equal(P.endState({ owner: 'קשר עם הורים', next: past }), 'late');
  assert.equal(P.endState({ owner: 'קשר עם הורים', next: past, missed: 1 }), 'escalate');
  assert.equal(P.endState({ status: 'closed' }), 'closed');
});

test('independence and pillars are counted from what the team did', () => {
  const doc = { log: [{}, {}], parts: { teams: [{ lead: { name: 'א' }, deputy: { name: 'ב' } }, { lead: { name: '' } }], partners: [{}],
    actions: [{ status: 'tested' }, { status: 'todo' }], gaps: [{}, {}, {}], ends: [{ status: 'closed' }, { status: 'open', owner: '' }],
    exercises: [{ finishedAt: 'x', builtByTeam: true, ledByDeputy: true, report: { approvedAt: 'y' }, ideasDecidedAt: 'z' }] } };
  const s = P.stats(doc), i = P.independence(doc);
  assert.deepEqual([s.rel.withDeputy, s.inst.staffed, s.openEnds, s.escalate], [1, 1, 1, 1]);
  assert.deepEqual([i.built, i.led, i.deputy, i.gaps, i.closed, i.tested, i.cycles], [1, 1, 1, 3, 1, 1, 1]);
});

test('the debrief prompt keeps the system rules and asks only for JSON', () => {
  const s = P.debriefSystem('he');
  assert.match(s, /בלי "למה"/); assert.match(s, /אין הפניה לאנשי מקצוע/); assert.match(s, /נוהל חסר: כדאי לברר/); assert.match(s, /JSON/);
  assert.ok(P.validDebrief({ gaps: [], worked: [] })); assert.ok(!P.validDebrief({ gaps: [] }));
  const input = P.debriefInput({ rounds: [{ decision: 'פינוי האגף' }] }, { segments: [{ round: 1, text: 'אבדוק' }], marks: [{ round: 1, t: 60000 }] }, [{ k: 'Moktan2026', gist: 'x' }]);
  assert.match(input, /פינוי האגף/); assert.match(input, /Moktan2026/);
  assert.ok(P.PII_RX.test('054-1234567')); assert.ok(P.PII_RX.test('ת.ז 123456789')); assert.ok(!P.PII_RX.test('סבב 2 בשעה 10:40'));
});

test('session 5 scenario and the binding guidelines: no self-harm, no referral, keys resolve', () => {
  assert.equal(P.DISCONNECT.rounds.length, 3);
  assert.ok(P.DISCONNECT.emAbsent);
  const keys = new Set(P.MANDATORY.map((m) => m.key));
  for (const r of P.DISCONNECT.rounds) for (const k of r.procedures || []) assert.ok(keys.has(k), k);
  const text = JSON.stringify(P.MANDATORY) + JSON.stringify(P.DISCONNECT) + JSON.stringify(P.CRISIS);
  assert.ok(!/פגיעה עצמית|אובדנ|פסיכולוג|גורמי מקצוע/.test(text));
  assert.ok(P.CRISIS.find((c) => c.k === 'emo').sensitive);
  assert.ok(P.MANDATORY.filter((m) => m.sensitive).every((m) => ['sexual', 'loss'].includes(m.key)));
  assert.match(P.PROC_KIND.missing, /כדאי לברר/);
});

test('generator: selection check, prompt rules, and the scenario check keeps only known guidelines', () => {
  const chk = P.checkSelection({ complications: ['שמועה ברשתות', 'הורים בשער'], missingRole: 'מנהל/ת מצב החירום', level: '4: x', time: 'חודש אחרי: הסתגלות ולמידה' });
  assert.deepEqual(chk.pillars, { rel: true, info: true, inst: true });
  assert.ok(chk.domains.find((d) => d.k === 'eval').hit);
  assert.deepEqual(P.checkSelection({}).pillars, { rel: false, info: false, inst: false });
  const sys = P.generatorSystem('he');
  for (const rx of [/בלי פגיעה עצמית/, /אין הפניה לאנשי מקצוע/, /לא ממציאים נהלים/, /בדיוק שלושה סבבים/, /adapt/]) assert.match(sys, rx);
  const input = P.generatorInput({ tests: 'ספירה תוך 5 דקות', crisis: 'ביטחוני' }, { parts: { profile: { name: 'הדר' }, plan: { annexes: [{ name: 'פינוי', text: 'מסלול א' }] }, teams: [] } });
  assert.match(input, /ספירה תוך 5 דקות/); assert.match(input, /פינוי: מסלול א/); assert.ok(!/sexual:/.test(input));
  assert.match(P.generatorInput({ crisis: 'רגשי־חברתי' }, {}), /sexual:/);
  const round = (i) => ({ time: '10:0' + i, title: 't' + i, all: 'עדכון', teams: { mgmt: 'א', nope: 'ב', adapt: 'ג' }, decision: 'מה עושים?', procedures: ['siren', 'invented'], missing: ['אין נוהל לשחרור'] });
  const o = { title: 'תרחיש', intro: 'פתיחה', rounds: [round(1), round(2), round(3)], characters: [{ id: 'p!', name: 'הורה', brief: 'לחוץ' }] };
  assert.ok(P.validScenario(o));
  const n = P.normalizeScenario(o);
  assert.deepEqual(n.rounds[0].procedures, ['siren']);
  assert.deepEqual(Object.keys(n.rounds[0].teams), ['mgmt', 'adapt']);
  assert.equal(n.characters[0].id, 'p');
  assert.ok(!P.validScenario({ ...o, rounds: [round(1), round(2)] }));
  assert.ok(!P.validScenario({ ...o, intro: 'מומלץ לפנות לפסיכולוג' }));
  assert.ok(P.validAlts({ alts: [['a', 'b', 'c']] })); assert.ok(!P.validAlts({ alts: [['a']] }));
  assert.match(P.roleSystem(P.DISCONNECT.characters[0], P.DISCONNECT, P.DISCONNECT.rounds[1], 'he'), /הורה בפארק/);
  assert.match(P.compareSystem('he'), /closed/);
});
