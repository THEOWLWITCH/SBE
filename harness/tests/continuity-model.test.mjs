// תיק רציפות (09/10/2026): ההנחיות למודל, המקורות והטקסט הקבוע במסך.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const C = require('../../app/lib/continuity-model.js');
const invite = require('../../app/lib/invite-language.js');
const ctx = { window: {} }; vm.runInNewContext(readFileSync(new URL('../../app/lib/resilience-advisor-sources.js', import.meta.url), 'utf8'), ctx);
const SRC = ctx.window.SBE_ADVISOR_SOURCES;

test('the continuity bank has several academic sources, all with a key, citation and finding', () => {
  const kb = SRC.forAdvisor('continuity');
  assert.ok(kb.length >= 15, 'several supporting sources');
  assert.ok(kb.filter((s) => s.g === 'cont').length >= 10);
  for (const s of kb) { assert.match(s.k, /^[A-Za-z][A-Za-z]+[0-9]{4}[a-z]?$/); assert.ok(s.apa && s.gist && s.be, s.k); }
  assert.ok(!SRC.forAdvisor('practi').some((s) => s.g === 'cont'), 'Practi keeps its own bank');
});

test('the prompt asks for the kit parts, privacy, conversation guidance and cites only the bank', () => {
  const kb = SRC.forAdvisor('continuity'), s = C.system(kb, 'WRITER-RULE');
  for (const part of ['opening', 'routines', 'roles', 'decisions', 'moments', 'classTalk', 'trial', 'upkeep', 'resilience', 'sources']) assert.ok(s.includes('"' + part + '"') || s.includes('- ' + part), part);
  assert.match(s, /בלי שמות מלאים של תלמידים ובלי מידע רפואי/);
  assert.match(s, /לא מפנים ליועצת כברירת מחדל/);
  assert.match(s, /איך אוכל לעזור לך/);
  assert.match(s, /WRITER-RULE/);
  for (const k of kb.filter((x) => !x.hidden)) assert.ok(s.includes('[' + k.k + ']'), k.k);
  assert.match(C.reviseSystem(kb, ''), /"changes"/);
});

test('input text, parsing and validity', () => {
  assert.equal(C.inputText({ kitFor: 'הכיתה שלי', routines: 'מעגל בוקר', roles: '' }), 'על מה התיק: הכיתה שלי\nהשגרות החשובות: מעגל בוקר');
  assert.deepEqual(C.FIELDS.filter((f) => f.main).map((f) => f.k), ['kitFor', 'receiver', 'routines']);
  const kit = { opening: [{ h: 'א', t: 'ב' }], routines: [{ name: 'ג' }], trial: [{ task: 'ד' }] };
  assert.ok(C.valid(C.parse('הנה: ' + JSON.stringify(kit))));
  assert.ok(!C.valid(C.parse('אין JSON')));
  assert.ok(!C.valid({ opening: [], routines: [], trial: [] }));
});

test('screen text is written as an invitation (no "חייב", "צריך", "אסור")', () => {
  const html = readFileSync(new URL('../../app/continuity-kit.html', import.meta.url), 'utf8').replace(/<style>[\s\S]*?<\/style>/, '').replace(/<script[\s\S]*?<\/script>/g, '');
  const ui = readFileSync(new URL('../../app/lib/continuity-kit-ui.js', import.meta.url), 'utf8').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  const labels = C.FIELDS.map((f) => [f.l, f.ph || '', ...(f.opts || [])].join(' ')).join(' ');
  for (const t of [html, ui, labels, Object.values(C.SECTIONS).map((x) => [x.h, x.sub, ...(x.cols || [])].join(' ')).join(' ')])
    assert.deepEqual(invite.find(t), []);
  assert.doesNotMatch(html + ui, /—/, 'no long dash in fixed screen text');
});
