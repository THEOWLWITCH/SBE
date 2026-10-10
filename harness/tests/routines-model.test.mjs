// מרכז שגרות ויוזמות חברתיות (10/10/2026): ההנחיות למודל, המקורות, השמות שנשארים במכשיר והטקסט הקבוע במסך.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const M = require('../../app/lib/routines-model.js');
const invite = require('../../app/lib/invite-language.js');
const ctx = { window: {} }; vm.runInNewContext(readFileSync(new URL('../../app/lib/resilience-advisor-sources.js', import.meta.url), 'utf8'), ctx);
const SRC = ctx.window.SBE_ADVISOR_SOURCES;

test('several academic sources support the routines hub', () => {
  const kb = SRC.forAdvisor('routines');
  assert.ok(kb.length >= 25); assert.ok(kb.filter((s) => s.g === 'routine').length >= 15);
  for (const k of ['Ostrom1990', 'Lundy2007', 'Hart1992', 'Lally2010', 'Langley2009', 'Seligman2011', 'Oettingen2012', 'Sade2024']) assert.ok(kb.some((s) => s.k === k), k);
  for (const s of kb) assert.ok(s.apa && s.gist && s.be, s.k);
  const keys = SRC.list.map((s) => s.k); assert.equal(new Set(keys).size, keys.length, 'no duplicate keys');
  assert.ok(!SRC.forAdvisor('practi').some((s) => s.g === 'routine'), 'Practi keeps its own bank');
});

test('four stages, the five mechanisms, and prompts with every part and the sources', () => {
  assert.deepEqual(M.STAGES.map((s) => s.t), ['בוחרים פעולה', 'מאשרים אחריות', 'מנסים פעמיים', 'פותחים לשינוי']);
  assert.deepEqual(M.MECH_TYPES, ['מועצת כיתה', 'לוח עזרה', 'ועדה', 'צוות פעולה', 'מפגש חוסן קבוע']);
  const kb = SRC.forAdvisor('routines'), plan = M.planSystem(kb, 'WRITER');
  for (const part of ['action', 'board', 'roles', 'agreement', 'run', 'after', 'future', 'resilience', 'skills']) assert.ok(plan.includes('- ' + part + ':'), part);
  for (const t of [plan, M.optionsSystem(kb), M.reviseSystem(kb, '')]) {
    assert.match(t, /לא אחת על חשבון השנייה/); assert.match(t, /בלי שמות של אנשים/);
    for (const r of M.RESILIENCE) assert.ok(t.includes(r), r);
  }
  for (const k of kb.filter((x) => !x.hidden)) assert.ok(plan.includes('[' + k.k + ']'), k.k);
  assert.match(M.reviseSystem(kb, ''), /"answers"/); assert.match(M.optionsSystem(kb), /"options"/);
});

test('names typed on the device are replaced before anything goes to the model', () => {
  const t = M.anonymize('נועה עזרה לדניאל, ונועה ביקשה לשנות', ['נועה', ' דניאל ', '', 'א']);
  assert.doesNotMatch(t, /נועה|דניאל/); assert.match(t, /\[משתתף\/ת\]/);
  assert.doesNotMatch(M.inputText({ mechType: 'ועדה', purpose: 'x' }), /undefined/);
});

test('parsing checks the main parts', () => {
  const ok = { board: [{}], roles: [{}], agreement: { what: 'x' }, run: [{}] };
  assert.ok(M.valid(M.parse('הנה ' + JSON.stringify(ok)))); assert.ok(!M.valid({ ...ok, roles: [] })); assert.ok(!M.valid({ ...ok, agreement: {} }));
  assert.ok(M.validOptions({ options: [{ name: 'א' }, { name: 'ב' }] })); assert.ok(!M.validOptions({ options: [{ name: 'א' }] }));
});

test('screen text is written as an invitation and without long dashes', () => {
  const html = readFileSync(new URL('../../app/routines-hub.html', import.meta.url), 'utf8').replace(/<style>[\s\S]*?<\/style>/, '').replace(/<script[\s\S]*?<\/script>/g, '');
  const ui = readFileSync(new URL('../../app/lib/routines-ui.js', import.meta.url), 'utf8').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  const labels = M.FIELDS.map((f) => [f.l, f.ph || '', ...(f.opts || [])].join(' ')).join(' ') + Object.values(M.SECTIONS).map((x) => [x.h, x.sub, ...(x.cols || [])].join(' ')).join(' ') +
    M.AGREEMENT_ROWS.concat(M.ROLE_ROWS).map((r) => r[1]).join(' ');
  for (const t of [html, ui, labels]) assert.deepEqual(invite.find(t), []);
  assert.doesNotMatch(html + ui + labels, /—/);
});
