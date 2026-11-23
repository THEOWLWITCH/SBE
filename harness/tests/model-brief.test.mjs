// לב התדריך: המודל שנבחר, שלב אחר שלב (23/11/2026)
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const T = require('../../app/lib/talk-study-model.js');
const B = require('../../app/lib/model-brief.js');
test('rule lists every step of the chosen model, NURSE for SPIKES, and the row format', () => {
  const spikes = T.MODELS.find((m) => m.id === 'spikes');
  const r = B.rule([spikes]);
  for (const s of spikes.steps) assert.ok(r.includes(s[0] + ' · ' + s[1]), s[1]);
  assert.match(r, /NURSE/); assert.match(r, /בשיחה שלך:/); assert.match(r, /סימן שאפשר להמשיך:/);
  assert.ok(!/NURSE: N/.test(B.rule([T.MODELS.find((m) => m.id === 'nvc')])));
  assert.match(B.rule(T.MODELS, { choose: true }), /לא נבחר מודל/);
});
test('split reads the model rows and leaves the other sections alone', () => {
  const txt = '**מה המטרה**\nא\n**השיחה שלך לפי המודל: תקשורת מקרבת (NVC)**\nפתיחה.\n- 1 · תצפית (בלי שיפוט) | בשיחה שלך: א | איך זה בא לידי ביטוי: "ב" | סימן שאפשר להמשיך: ג\n- 2 · רגש | בשיחה שלך: ד | איך זה בא לידי ביטוי: ה | סימן שאפשר להמשיך: ו\nמסגרת.\n**איך לפתוח**\nשלום';
  const s = B.split(txt);
  assert.equal(s.rows.length, 2); assert.deepEqual(s.rows[1], ['2 · רגש', 'ד', 'ה', 'ו']);
  assert.match(s.title, /NVC/); assert.deepEqual(s.notes, ['פתיחה.', 'מסגרת.']);
});
test('both briefings use the model rule and the model table', () => {
  for (const f of ['conversation-planner.html', 'practice.html']) {
    const h = readFileSync(new URL('../../app/' + f, import.meta.url), 'utf8');
    assert.match(h, /lib\/model-brief\.js/); assert.match(h, /SBE_MODELBRIEF\.rule/); assert.match(h, /SBE_MODELBRIEF\.render/);
  }
});
