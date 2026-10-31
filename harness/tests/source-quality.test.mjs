// ספריית המקורות לפי ההנחיה לחיפוש מקורות (31/10/2026): רמת ראיות, מרחב, רשימת כתבי העת ותיבת האישור.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const J = require('../../app/lib/quality-journals.js');
const Q = require('../../app/lib/source-quality.js');
const read = (p) => readFileSync(new URL('../../app/' + p, import.meta.url), 'utf8');
globalThis.window = globalThis.window || {};
require('../../app/lib/resilience-advisor-sources.js');
const A = globalThis.window.SBE_ADVISOR_SOURCES;
const lib = read('sources-library.html');
const SIM = (() => { const i = lib.indexOf('const SOURCES = ['); const j = lib.indexOf('];', i); return JSON.parse(lib.slice(i + 16, j + 1)); })();

test('the journal list: the 75 verified journals keep their ISSN, the new ones are marked to check', () => {
  const verified = J.LIST.filter((j) => !j.check);
  assert.equal(verified.length, 75);
  for (const j of verified) assert.ok(j.issn.length && j.issn.every((i) => /^\d{4}-\d{3}[\dX]$/.test(i)), j.name);
  for (const j of J.LIST.filter((x) => x.check)) assert.deepEqual(j.issn, [], j.name + ': an unverified ISSN is not written');
  for (const j of J.LIST) assert.ok(J.AREAS[j.area], j.name);
  const names = J.LIST.map((j) => j.name.toLowerCase());
  assert.equal(names.length, new Set(names).size, 'a journal is listed twice');
  for (const n of ['Higher Education', 'The Leadership Quarterly', 'Journal of Occupational Health Psychology', 'Work & Stress'])
    assert.ok(J.byName(n), n);
});

test('a journal is found in a citation only as the venue, not inside the title', () => {
  assert.equal(J.inCitation('Chernikova, O. (2020). Simulation-Based Learning in Higher Education: A Meta-Analysis. Review of Educational Research.').name, 'Review of Educational Research');
  assert.equal(J.inCitation('W. (2020). T. Journal of Imaginary Studies, 5'), null);
  assert.equal(J.inCitation('א׳ (2020). כותרת. מגמות, 55(1)').name, 'מגמות');
});

test('evidence level follows the order of the guideline', () => {
  const L = (apa, extra) => Q.level(Object.assign({ apa }, extra));
  assert.equal(L('A. (2024). Effects of X: A systematic review and meta-analysis. Educational Research Review, 41, 100.'), 'sr');
  assert.equal(L('A. (2023). A cluster-randomized controlled trial of X. Child Development, 94(2), 1–20.'), 'exp');
  assert.equal(L('A. (2024). A longitudinal study of societal resilience. Applied Psychology: Health and Well-Being.'), 'long');
  assert.equal(L('A. (2025). Voices of teachers: A qualitative study. Teaching and Teacher Education, 150, 104.'), 'qual');
  assert.equal(L('A. (2026). Crisis leadership in schools. Management in Education.'), 'peer');
  assert.equal(L('OECD. (2025). Results from TALIS 2024: The state of teaching. OECD Publishing.'), 'rep');
  assert.equal(L('A. (2025). Brief communication: X. EGUsphere [preprint].'), 'bg');
  assert.equal(L('Kaner, S. (2014). Facilitator\'s guide to participatory decision-making (3rd ed.). Jossey-Bass.'), 'bg');
  assert.equal(L('שדה, י׳ (2024). כותרת [עבודת דוקטורט, אוניברסיטת אריאל].'), 'bg');
  assert.equal(L('A. (2024). Anything. Some Journal.', { ev: 'rep' }), 'rep', 'an explicit ev wins');
  assert.equal(Q.level({ type: 'ספר אקדמי', citation: 'Kolb, D. A. (2015). Experiential Learning, 2nd ed. Pearson Education.' }), 'bg');
  assert.equal(Q.level({ type: 'סקירה שיטתית או מטא-אנליזה', citation: 'Craig (2021). Serious Games. Simulation & Gaming.' }), 'sr');
  // החזקים ראשונים, ובתוך כל רמה החדש קודם
  const a = { apa: 'A. (2020). A meta-analysis. Educational Research Review, 1, 1.' }, b = { apa: 'B. (2026). X. Child Development, 1(1), 1.' };
  assert.ok(Q.compare(a, b) < 0);
});

test('every record has a level and a space, and both shelves keep strong sources first', () => {
  for (const s of A.list) { assert.ok(Q.label(Q.level(s)), s.k); assert.ok(Q.SPACES[Q.space(s, 'res')], s.k); }
  for (const s of SIM) { assert.ok(Q.label(Q.level(s)), String(s.id)); assert.ok(Q.SPACES[Q.space(s, 'sim')], String(s.id)); }
  for (const g of Object.keys(A.groups)) assert.ok(Q.G_SPACE[g], 'group ' + g + ' has no space');
  assert.ok(A.list.filter((s) => Q.level(s) !== 'bg').length > A.list.length / 2);
  assert.equal(Q.space({ topic: 'שותפות עם הורים', citation: 'X', domain: 'ניהול יחסים' }, 'sim'), 'edu');
  assert.equal(Q.space({ topic: 'הקשבה', citation: 'Kluger (2022). The Power of Listening at Work. Annual Review.', domain: 'תקשורת' }, 'sim'), 'org');
  assert.ok(Q.inSpace('shared', 'org') && Q.inSpace('org', 'org') && !Q.inSpace('edu', 'org') && Q.inSpace('edu', 'all'));
});

test('the new audiences have groups, and Practi (the class) does not get them', () => {
  for (const g of ['org', 'hed', 'prep']) assert.ok(A.groups[g], g);
  const src = read('lib/resilience-advisor-sources.js');
  const not = src.slice(src.indexOf('var NOT_PRACTI_G'), src.indexOf('};', src.indexOf('var NOT_PRACTI_G')));
  for (const g of ['org', 'hed', 'prep']) assert.ok(not.includes(g + ':'), g + ' is kept out of Practi');
});

test('duplicates by DOI, link or normalized title', () => {
  assert.ok(Q.sameSource({ url: 'https://doi.org/10.1037/0022-3514.87.2.228' }, { url: 'https://doi.org/10.1037/0022-3514.87.2.228.' }));
  assert.ok(Q.sameSource({ apa: 'A. (2020). The Power of Feedback! Review, 1.' }, { citation: 'B. (2007). the power of feedback. Other.' }));
  assert.equal(Q.sameSource({ apa: 'A. (2020). Short. X.' }, { apa: 'B. (2020). Short. Y.' }), false);
});

test('the library page loads the quality libraries, and the approval box keeps its place', () => {
  assert.ok(lib.indexOf('lib/quality-journals.js') > 0 && lib.indexOf('lib/quality-journals.js') < lib.indexOf('lib/source-quality.js'));
  assert.ok(/fbSubmit[\s\S]{0,200}הצעת מקור לספרייה/.test(lib), 'a suggestion reaches the server inbox');
  const admin = read('admin.html');
  const box = admin.slice(admin.indexOf('const pending = loadSuggestions()'), admin.indexOf('innp.append(rows)'));
  assert.ok(box.indexOf('r.append(acts, nm)') > 0, 'buttons come before the details');
  assert.equal(/render\(\)/.test(box), false, 'a click does not redraw the whole list');
});
