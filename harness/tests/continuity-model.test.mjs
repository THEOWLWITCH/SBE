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
  for (const part of ['opening', 'routines', 'roles', 'decisions', 'procedures', 'moments', 'classTalk', 'trial', 'upkeep', 'resilience', 'sources']) assert.ok(s.includes('"' + part + '"') || s.includes('- ' + part), part);
  const e = C.emergSystem(kb, '');
  for (const part of ['readiness', 'remote', 'chain', 'emergTalk', 'drill', 'parentLetter']) assert.ok(e.includes('- ' + part), part);
  for (const tag of C.LETTER_FIELDS.map((f) => f.tag)) assert.ok(e.includes(tag), tag);
  assert.match(e, /מה שלא פועל בשגרה יקרוס בחירום/);
  assert.match(s, /אין לך את רשימת התלמידים, את פרטי ההורים או מידע רפואי/);
  assert.match(s, /לא מפנים ליועצת כברירת מחדל/);
  assert.match(s, /איך אוכל לעזור לך/);
  assert.match(s, /WRITER-RULE/);
  for (const k of kb.filter((x) => !x.hidden)) assert.ok(s.includes('[' + k.k + ']'), k.k);
  assert.match(C.reviseSystem(kb, ''), /"changes"/);
});

test('input text, parsing and validity', () => {
  assert.equal(C.inputText({ role: 'מחנכת כיתה', routines: 'מעגל בוקר', roles: '' }), 'התפקיד שלי: מחנכת כיתה\nהשגרות החשובות: מעגל בוקר');
  assert.deepEqual(C.FIELDS.filter((f) => f.main).map((f) => f.k), ['role', 'receiver', 'routines']);
  // מידע רגיש לא נכנס למה שנשלח למודל, גם אם הוא נמצא באותו אובייקט
  assert.doesNotMatch(C.inputText({ role: 'גננת', students: [{ c0: 'דנה' }], red: 'אלרגיה', local: { students: [1] } }), /דנה|אלרגיה/);
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

test('the readiness list, the parent letter and the emergency check', () => {
  assert.ok(C.DEFAULT_READINESS.length >= 6);
  assert.match(C.DEFAULT_READINESS.join(' '), /צוותי עבודה של 3 עד 5/);
  assert.deepEqual(invite.find(C.DEFAULT_READINESS.join(' ')), []);
  assert.equal(C.fillLetter('תלמד [שם המחליפה] עד [משך ההחלפה]. [הנחיות מיוחדות]', { sub: 'מיכל', duration: 'סוף החודש' }), 'תלמד מיכל עד סוף החודש. [הנחיות מיוחדות]');
  assert.ok(C.validEmerg({ remote: [{}], chain: [{}], parentLetter: 'x'.repeat(50) }));
  assert.ok(!C.validEmerg({ remote: [], chain: [{}], parentLetter: 'x'.repeat(50) }));
  assert.ok(C.ROLES.includes('מחנכת כיתה') && C.ROLES.includes('גננת'));
});

test('the student list is read in the browser: headers, no headers, quotes and teams', () => {
  const withHead = C.parseRoster('שם התלמיד\tשם ההורה\tטלפון\tהורה נוסף\tנייד\tדוא"ל\nדנה\tרונית\t050-1234567\tיוסי\t052-7654321\td@x.org');
  assert.deepEqual(withHead, [{ name: 'דנה', parent: 'רונית', phone: '050-1234567', parent2: 'יוסי', phone2: '052-7654321', email: 'd@x.org' }]);
  const noHead = C.parseRoster('אור, מיכל, 054-1112223, m@y.org\nנועם,"דוד, אבא",053-3334445');
  assert.equal(noHead.length, 2); assert.equal(noHead[0].phone, '054-1112223'); assert.equal(noHead[0].email, 'm@y.org'); assert.equal(noHead[1].parent, 'דוד, אבא');
  assert.deepEqual(C.parseRoster(''), []);
  const teams = C.splitTeams(Array.from({ length: 31 }, (_, i) => 'ת' + i), 4);
  assert.ok(teams.every((t) => t.length >= 3 && t.length <= 5)); assert.equal(teams.flat().length, 31);
  assert.deepEqual(C.splitTeams(['א', 'ב'], 4), [['א', 'ב']]);
});
