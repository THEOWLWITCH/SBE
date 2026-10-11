// מסלולי השתתפות בלמידה (10/10/2026): הרשימה, ההנחיות למודל, המעקב, המקורות והטקסט הקבוע.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const M = require('../../app/lib/participation-model.js');
const invite = require('../../app/lib/invite-language.js');
const ctx = { window: {} }; vm.runInNewContext(readFileSync(new URL('../../app/lib/resilience-advisor-sources.js', import.meta.url), 'utf8'), ctx);
const SRC = ctx.window.SBE_ADVISOR_SOURCES;

test('a long list of paths in every mode: alone, pair, group and whole class', () => {
  assert.ok(M.CATALOG.length >= 30);
  for (const m of M.MODES) assert.ok(M.CATALOG.filter((x) => x.m === m).length >= 6, m);
  const names = M.CATALOG.map((x) => x.n); assert.equal(new Set(names).size, names.length);
});

test('sources include CAST and the evidence on choice, formative assessment and learning styles', () => {
  const kb = SRC.forAdvisor('paths');
  assert.ok(kb.filter((s) => s.g === 'paths').length >= 15);
  for (const k of ['CAST2024', 'RoseMeyer2002', 'KatzAssor2007', 'Patall2008', 'BlackWiliam1998', 'Pashler2008', 'CohenLotan2014']) assert.ok(kb.some((s) => s.k === k), k);
  for (const s of kb) assert.ok(s.apa && s.gist && s.be, s.k);
  assert.ok(!SRC.forAdvisor('practi').some((s) => s.g === 'paths'));
});

test('the prompts keep the goal fixed, the way open, and the observation on conditions', () => {
  const kb = SRC.forAdvisor('paths'), s = M.suggestSystem(kb), a = M.adjustSystem(kb);
  for (const t of [s, a]) { assert.match(t, /אין דרך אחת ללמוד/); assert.match(t, /אינן שקולות בכל יעד/); assert.match(t, /אינם "סגנונות למידה"/); assert.match(t, /לתנאים ולפעולות, לא לתלמידים/); }
  assert.match(s, /must/); assert.match(s, /evidence/); assert.match(a, /"options"/);
  for (const k of kb.filter((x) => !x.hidden)) assert.ok(s.includes('[' + k.k + ']'), k.k);
  assert.ok(M.valid({ must: 'x', cards: [{ name: 'a', how: 'b' }, { name: 'c', how: 'd' }, { name: 'e', how: 'f' }] }));
  assert.ok(!M.valid({ must: 'x', cards: [{ name: 'a', how: 'b' }] }));
});

test('tracking shows what was offered and chosen, what was never chosen, and lessons with one mode only', () => {
  const t = M.track([{ offered: ['חשוב, זוג, שתף', 'מפת מושגים'], used: { 'חשוב, זוג, שתף': 5, 'מפת מושגים': 0 } }, { offered: ['מפת מושגים', 'כרטיס יציאה: משפט אחד שלמדתי'], used: {} }]);
  assert.deepEqual(t.rows.find((r) => r.name === 'חשוב, זוג, שתף').cells, ['●', '']);
  assert.deepEqual(t.never, ['מפת מושגים', 'כרטיס יציאה: משפט אחד שלמדתי']);
  assert.deepEqual(t.single, [2]);
});

test('screen text is written as an invitation and without long dashes', () => {
  const ui = readFileSync(new URL('../../app/lib/participation-ui.js', import.meta.url), 'utf8').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  const labels = M.CATALOG.map((x) => x.n).join(' ') + Object.values(M.SECTIONS).map((x) => [x.h, x.sub, ...(x.cols || [])].join(' ')).join(' ');
  for (const t of [ui, labels]) assert.deepEqual(invite.find(t), []);
  assert.doesNotMatch(ui + labels, /—/);
});
