// מעבדה לבניית גשר שותפות בין הבית לכיתה (10/10/2026): ההנחיות למודל, המקורות, הכינויים שנשארים במכשיר והטקסט הקבוע במסך.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const M = require('../../app/lib/family-bridge-model.js');
const invite = require('../../app/lib/invite-language.js');
const ctx = { window: {} }; vm.runInNewContext(readFileSync(new URL('../../app/lib/resilience-advisor-sources.js', import.meta.url), 'utf8'), ctx);
const SRC = ctx.window.SBE_ADVISOR_SOURCES;

test('several academic sources support the bridge lab, including the EEF parents guidance', () => {
  const kb = SRC.forAdvisor('bridge');
  assert.ok(kb.length >= 20); assert.ok(kb.filter((s) => s.g === 'family').length >= 15);
  for (const k of ['EEFParents2021', 'HooverDempsey1997', 'Moll1992', 'Lareau2003', 'KraftRogers2015', 'Sheridan2019', 'HendersonMapp2002']) assert.ok(kb.some((s) => s.k === k), k);
  for (const s of kb) assert.ok(s.apa && s.gist && s.be, s.k);
  const keys = SRC.list.map((s) => s.k); assert.equal(new Set(keys).size, keys.length, 'no duplicate keys');
  assert.ok(!SRC.forAdvisor('practi').some((s) => s.g === 'family'), 'Practi keeps its own bank');
});

test('the prompts carry the lab principles, every part and the sources', () => {
  const kb = SRC.forAdvisor('bridge');
  const plan = M.planSystem(kb, 'W', 'ערבית'), dec = M.decideSystem(kb, '', 'עברית'), rev = M.reviseSystem(kb, '', 'עברית');
  for (const part of ['goal', 'ways', 'school', 'styles', 'channels', 'card', 'resilience']) assert.ok(plan.includes('- ' + part + ':') || plan.includes('- ' + part), part);
  for (const t of [plan, dec, rev]) {
    assert.match(t, /לא מניחה מראש מה טוב להורים/); assert.match(t, /היענות אינה מדד לאיכות המשפחה/);
    assert.match(t, /על הקשר לא מוותרים/); assert.match(t, /חלופה מלאה במסגרת החינוכית/); assert.match(t, /בלי שיח מתמשך/);
  }
  assert.match(plan, /בערבית/); assert.match(dec, /"reply"/); assert.match(rev, /"learned"/);
  for (const k of kb.filter((x) => !x.hidden)) assert.ok(plan.includes('[' + k.k + ']'), k.k);
});

test('family nicknames are replaced before sending, and parsing checks the main parts', () => {
  assert.equal(M.anonymize('משפחה א ענתה, משפחת כהן לא', ['משפחה א', 'משפחת כהן']), '[משפחה] ענתה, [משפחה] לא');
  const ok = { goal: { text: 'x' }, ways: [{}, {}], school: { what: 'x' }, card: { options: ['a'] } };
  assert.ok(M.valid(M.parse('הנה ' + JSON.stringify(ok)))); assert.ok(!M.valid({ ...ok, school: {} }));
  assert.ok(M.validDecision({ options: [{}], reply: { text: 'x' }, check: {} })); assert.ok(!M.validDecision({ options: [], reply: { text: 'x' }, check: {} }));
  assert.ok(M.RESPONSES.includes('עוד לא ענתה') && M.RESPONSES.includes('לא מעשי כרגע'));
});

test('screen text and the start-of-year form are written as an invitation and without long dashes', () => {
  const html = readFileSync(new URL('../../app/family-bridge.html', import.meta.url), 'utf8').replace(/<style>[\s\S]*?<\/style>/, '').replace(/<script[\s\S]*?<\/script>/g, '');
  const ui = readFileSync(new URL('../../app/lib/family-bridge-ui.js', import.meta.url), 'utf8').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  const Y = M.YEAR_FORM, year = [Y.title, Y.intro, Y.close].concat(Y.qs.flatMap((q) => [q.q].concat(q.opts))).join(' ');
  const labels = M.FIELDS.map((f) => [f.l, f.ph || '', ...(f.opts || [])].join(' ')).join(' ') + Object.values(M.SECTIONS).map((x) => [x.h, x.sub, ...(x.cols || [])].join(' ')).join(' ');
  for (const t of [html, ui, labels, year]) assert.deepEqual(invite.find(t), []);
  assert.doesNotMatch(html + ui + labels + year, /—/);
  assert.match(year, /כרגע לא מתאים לנו, וזה בסדר/);
});
