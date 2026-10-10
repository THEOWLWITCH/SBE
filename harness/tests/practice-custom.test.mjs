// תרגול עצמי על מקרה משלך (10/10/2026): שאלות הבהרה, תרחיש באותו מבנה כמו המאגר, ושמות שלא עוברים לתרחיש.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const P = require('../../app/lib/practice-custom.js');
const invite = require('../../app/lib/invite-language.js');
const html = readFileSync(new URL('../../app/practice.html', import.meta.url), 'utf8');

const tp = (i) => ({ name: 'ת' + i, trigger: 'כש...', does: { line: 'שורה ' + i, stage: '' }, missed: '', keywords: ['מילה'], branches: i < 2 ? [{ move: 'm', effect: 'פותח', quality: 'מקדם', keywords: ['k'], line: 'l', stage: '' }] : [{ move: 'x' }] });
const sample = () => ({ name: 'שם', subtitle: 'בין מי למי', trainee: { role: 'מחנכת', opening: ['א', 'ב', 'כעת תיפגשי'] },
  actor: { name: 'יואב', entrance: { firstLine: 'שלום' }, valve: 'המשפט האמיתי' }, turningPoints: [0, 1, 2, 3, 4].map(tp),
  endings: ['1', '2', '3', '4'], endingNotes: ['1', '2', '3', '4'], skills: [{ text: 'שאלה פתוחה', keywords: ['ספרי לי'] }] });

test('clarifying questions ask only what is missing, up to four, without names', () => {
  const t = P.clarifySystem();
  assert.match(t, /רק את מה שחסר/); assert.match(t, /לכל היותר ארבע שאלות/); assert.match(t, /אל תשאלי על שמות/);
  assert.equal(P.validQuestions({ questions: [] }), true); assert.equal(P.validQuestions({}), false);
  const c = P.caseText({ story: 'מה קרה', role: 'מחנכת', answers: [{ q: 'בן כמה?', a: 'כיתה ו' }, { q: 'ריק', a: '' }] });
  assert.match(c, /המקרה: מה קרה/); assert.match(c, /בן כמה\? כיתה ו/); assert.doesNotMatch(c, /ריק/);
});

test('the story is built in the same structure as the bank, with five turning points in the engine order', () => {
  const t = P.buildSystem();
  for (const k of ['trainee', 'actor', 'turningPoints', 'endings', 'endingNotes', 'skills', 'trustCondition', 'valve']) assert.ok(t.includes(k), k);
  assert.match(t, /אל תשתמשי באף שם שמופיע במקרה/);
  assert.match(P.reviseSystem(), /שני רק את מה שביקשה/);
  const sc = P.normalize(sample());
  assert.deepEqual(sc.turningPoints.map((x) => x.type), ['פתיחה', 'מותנה', 'סגירה', 'היפוך', 'פתיחה עמוקה']);
  assert.equal(sc.turningPoints[0].core, true); assert.equal(sc.turningPoints[2].core, true);
  assert.equal(sc.turningPoints[3].requiresTrust, true); assert.equal(sc.turningPoints[4].viaPressure, true);
  assert.equal(sc.turningPoints[2].branches.length, 0, 'only the first two have branches');
  assert.equal(sc.redLine, P.RED_LINE); assert.equal(sc.meta.approach, 'המקרה שלי');
  assert.ok(sc.skills.some((s) => s.detectShort) && sc.skills.some((s) => s.undetectable));
  assert.equal(P.valid(sample()), true);
  const bad = sample(); bad.turningPoints.pop(); assert.equal(P.valid(bad), false);
  const bad2 = sample(); bad2.actor.entrance.firstLine = ''; assert.equal(P.valid(bad2), false);
});

test('practice screen: own case, three steps, saved per user, inviting language', () => {
  assert.match(html, /lib\/practice-custom\.js/); assert.match(html, /lib\/ai-call\.js/);
  for (const id of ['bOwnCase', 'ownStory', 'ownQs', 'ownPreview', 'ownApprove', 'ownRevise', 'myCases']) assert.ok(html.includes('id="' + id + '"'), id);
  assert.match(html, /sbeUserKey\("sbe\.practice\.custom\.v1"\)/);
  assert.doesNotMatch(html, /רננה מהנהנת/);
  const a = html.indexOf('<section id="screen-custom"'), b = html.indexOf('</section>', a);
  const block = html.slice(a, b) + html.slice(html.indexOf('// ── מקרה משלך'), html.indexOf('renderFilters();\nrenderScenarioList();'));
  assert.deepEqual(invite.find(block), []); assert.doesNotMatch(block, /—/);
});
