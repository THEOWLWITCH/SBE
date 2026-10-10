// נוהל עבודה בכלים שלכם (10/10/2026): שלד קבוע לכל כלי, מידע רגיש לא נכנס לכלים משותפים, ונוסח של הזמנה.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const P = require('../../app/lib/tools-procedure.js');
const invite = require('../../app/lib/invite-language.js');
const read = (f) => readFileSync(new URL('../../app/' + f, import.meta.url), 'utf8');

test('tool types by what they do, with another tool and "not sure yet"', () => {
  const k = P.TOOL_TYPES.map((t) => t.k);
  for (const x of ['folder', 'sheet', 'school', 'chat', 'board', 'binder', 'unsure']) assert.ok(k.includes(x), x);
  for (const t of P.TOOL_TYPES) assert.ok(t.n && t.ex, t.k);
  assert.equal(P.LEVELS.length, 3);
});

test('the prompt holds the fixed backbone for every tool and keeps sensitive items out of shared tools', () => {
  for (const kind of ['routines', 'continuity']) {
    for (const t of [P.system(kind), P.reviseSystem(kind)]) {
      for (const part of ['map', 'structure', 'roles', 'never', 'handover', 'ask', 'start', 'check']) assert.ok(t.includes('- ' + part + ':'), part);
      assert.match(t, /לעולם לא בקבוצת הודעות, בלוח בכיתה או בכלי שתלמידים רואים/);
      assert.match(t, /עוד לא יודעת/); assert.match(t, /אל תניחי פרטים על כלי מסחרי מסוים/);
      assert.match(t, /בלי שמות של אנשים/);
    }
  }
  assert.match(P.system('continuity'), /תיק רציפות/); assert.match(P.system('routines'), /מנגנון חברתי/);
  assert.match(P.reviseSystem('routines'), /"changes"/);
});

test('valid needs the map, what stays out and the handover', () => {
  assert.equal(P.valid(null), false);
  assert.equal(P.valid({ map: [{ item: 'א' }], never: ['ב'] }), false);
  const p = { title: 'נוהל', map: [{ item: 'לוח', level: 'פתוח לקבוצה', where: 'לוח בכיתה', who: 'תורן/ית', when: 'כל ראשון' }], never: ['ב'], handover: ['ג'], check: { every: 'פעם בחודש', questions: ['ד'] } };
  assert.equal(P.valid(p), true);
  const t = P.text(p); assert.match(t, /לוח · פתוח לקבוצה · לוח בכיתה/); assert.match(t, /1\. ג/); assert.match(t, /פעם בחודש/);
});

test('mounted in the routines hub and in the continuity kit; screen text invites, without long dashes', () => {
  for (const f of ['routines-hub.html', 'continuity-kit.html']) assert.match(read(f), /lib\/tools-procedure\.js/);
  assert.match(read('lib/routines-ui.js'), /SBE_PROC\.mount\(inner, \{ state: I\.proc/);
  assert.match(read('lib/continuity-kit-ui.js'), /\['proc', '🗂 נוהל עבודה'\]/);
  for (const f of ['lib/routines-ui.js', 'lib/continuity-kit-ui.js']) assert.match(read(f), /\(רגיש\)/);
  const src = read('lib/tools-procedure.js');
  const ui = src.slice(src.indexOf('// ── המסך ──'));
  const labels = P.TOOL_TYPES.map((t) => t.n + ' ' + t.ex).join(' ');
  for (const t of [ui, labels]) assert.deepEqual(invite.find(t), []);
  assert.doesNotMatch(ui + labels, /—/);
});
