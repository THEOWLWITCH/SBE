// מעבדת צוות (10/10/2026): ההנחיות למודל, המקורות, הפרטיות והטקסט הקבוע במסך.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const M = require('../../app/lib/team-lab-model.js');
const invite = require('../../app/lib/invite-language.js');
const ctx = { window: {} }; vm.runInNewContext(readFileSync(new URL('../../app/lib/resilience-advisor-sources.js', import.meta.url), 'utf8'), ctx);
const SRC = ctx.window.SBE_ADVISOR_SOURCES;

test('several academic sources support the team lab, including EEF professional development', () => {
  const kb = SRC.forAdvisor('teamlab');
  assert.ok(kb.length >= 20); assert.ok(kb.filter((s) => s.g === 'team').length >= 12);
  for (const k of ['EEF2021', 'Sims2021', 'Lampert2013', 'HattieTimperley2007', 'Oettingen2012', 'Edmondson1999']) assert.ok(kb.some((s) => s.k === k), k);
  for (const s of kb) assert.ok(s.apa && s.gist && s.be, s.k);
  assert.ok(!SRC.forAdvisor('practi').some((s) => s.g === 'team'), 'Practi keeps its own bank');
});

test('five stages, staff and student teams, and a prompt with every part and the sources', () => {
  assert.deepEqual(M.STAGES.map((s) => s.t), ['בוחרים מהלך', 'מתרגלים בעמיתים', 'מנסים במפגש', 'משפרים ושומרים', 'מתכננים קדימה']);
  assert.ok(M.TEAM_TYPES.some((t) => /תלמידים שמוביל את עצמו/.test(t)) && M.TEAM_TYPES.some((t) => /מנחה של צוות תלמידים/.test(t)));
  const kb = SRC.forAdvisor('teamlab'), s = M.system(kb, 'WRITER');
  for (const part of ['move', 'script', 'observe', 'trial', 'debrief', 'decision', 'forward', 'support', 'resilience']) assert.ok(s.includes('- ' + part + ':'), part);
  assert.match(s, /צופים בפעולות שהצוות בחר, לא באנשים/);
  assert.match(s, /תמונת עתיד/); assert.match(s, /תשתית החוסן/);
  for (const k of kb.filter((x) => !x.hidden)) assert.ok(s.includes('[' + k.k + ']'), k.k);
  assert.match(M.reviseSystem(kb, ''), /"recommend"/);
});

test('the private concern is sent only when asked for, and parsing checks the main parts', () => {
  const d = { teamType: 'צוות מורים', move: 'שיקוף', context: 'שיחת כיתה', concern: 'אני חוששת' };
  assert.doesNotMatch(M.inputText(d), /חוששת/); assert.match(M.inputText(d, true), /חשש פרטי/);
  const ok = { move: { steps: [{}] }, script: { rounds: [{}] }, observe: [{}], forward: { steps: [{}] } };
  assert.ok(M.valid(M.parse('הנה ' + JSON.stringify(ok)))); assert.ok(!M.valid({ ...ok, observe: [] }));
});

test('screen text is written as an invitation and without long dashes', () => {
  const html = readFileSync(new URL('../../app/team-lab.html', import.meta.url), 'utf8').replace(/<style>[\s\S]*?<\/style>/, '').replace(/<script[\s\S]*?<\/script>/g, '');
  const ui = readFileSync(new URL('../../app/lib/team-lab-ui.js', import.meta.url), 'utf8').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  const labels = M.FIELDS.map((f) => [f.l, f.ph || '', ...(f.opts || [])].join(' ')).join(' ') + Object.values(M.SECTIONS).map((x) => [x.h, x.sub, ...(x.cols || [])].join(' ')).join(' ');
  for (const t of [html, ui, labels]) assert.deepEqual(invite.find(t), []);
  assert.doesNotMatch(html + ui, /—/);
});
