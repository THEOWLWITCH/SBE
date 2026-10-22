// שבעה משחקי חוסן נוספים (22/10/2026): לאן זה שייך?, חידות חוסן, בינגו חוסן, 20 שאלות, אמת או אתגר, סימני דרך, רכבת המוכנות.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const app = (f) => new URL('../../app/' + f, import.meta.url);
const SORT = require('../../app/lib/statement-sort.js'), RID = require('../../app/lib/riddles.js'), BIN = require('../../app/lib/bingo.js');
const TW = require('../../app/lib/twenty-q.js'), TD = require('../../app/lib/truth-dare.js'), TR = require('../../app/lib/trail-signs.js'), SEQ = require('../../app/lib/readiness-seq.js');
const BAD = /צריך|חייב|חובה|מוכרח|אסור|—/;

test('content counts', () => {
  assert.equal(SORT.GROUPS.length, 5); assert.equal(SORT.STATEMENTS.length, 30);
  for (const g of SORT.GROUPS) assert.equal(SORT.STATEMENTS.filter((s) => s.g === g.id).length, 6);
  assert.equal(RID.LEVELS.length, 4);
  for (const l of RID.LEVELS) assert.equal(RID.RIDDLES.filter((r) => r.l === l.id).length, 12, l.id);
  assert.equal(new Set(RID.LEVELS.map((l) => l.mark)).size, 4, 'a different mark for every level');
  assert.equal(BIN.ITEMS.length, 36);
  assert.equal(TW.ITEMS.length, 20); for (const it of TW.ITEMS) assert.ok(TW.CLUE[it.id], it.id);
  assert.equal(TD.TRUTH.length, 30); assert.equal(TD.DARE.length, 30);
  assert.deepEqual([...new Set(TD.WHEEL.map((w) => w.k))].sort(), ['again', 'dare', 'pass', 'truth']);
  assert.equal(TR.AGES.length, 4); for (const a of TR.AGES) assert.equal(a.tasks.length, 10);
  assert.deepEqual(SEQ.STAGES.map((s) => s.name), ['תכנון', 'היערכות', 'תרגול', 'ביצוע', 'תחקור']);
  for (const k of ['kids', 'teen']) { assert.equal(SEQ.SEQ[k].length, 15); for (const s of SEQ.SEQ[k]) assert.equal(s.cards.length, 5); }
  assert.equal(new Set(SEQ.COLORS).size, 15, 'a color for every sequence');
  assert.equal(SEQ.TASKS.length, 30);
});

test('bingo boards: 24 terms and a free center, and the check finds a full line', () => {
  const b = BIN.board(7); assert.equal(b.length, 25); assert.equal(b[12], null); assert.equal(new Set(b.filter(Boolean).map((x) => x.n)).size, 24);
  assert.notDeepEqual(BIN.board(1).map((x) => x && x.n), BIN.board(2).map((x) => x && x.n));
  const row = new Set([0, 1, 2, 3, 4].map((i) => b[i].n));
  assert.equal(BIN.check(7, row).full.length, 1);
});

test('invitation language, no em dash, no referral', () => {
  const txt = JSON.stringify([SORT.GROUPS, SORT.STATEMENTS, SORT.RULES, RID.RIDDLES, RID.RULES, BIN.ITEMS, BIN.RULES, TW.ASK, TW.CLUE, TW.RULES, TW.MODES, TD.TRUTH, TD.DARE, TD.RULES, TD.WHEEL, TR.AGES, TR.RULES, SEQ.SEQ, SEQ.TASKS, SEQ.RULES, SEQ.STAGES.map((s) => [s.name, s.what])]);
  assert.doesNotMatch(txt, BAD);
  assert.doesNotMatch(txt, /יועצ|פסיכולוג|איש מקצוע|אשת מקצוע/);
});

test('pages: logo on every card and board, print with margins, and wiring', () => {
  const guard = readFileSync(app('lib/access-guard.js'), 'utf8'), auth = readFileSync(new URL('../lib/access.mjs', import.meta.url), 'utf8'), games = readFileSync(app('games.html'), 'utf8');
  assert.match(readFileSync(app('lib/game-kit.js'), 'utf8'), /margin:24mm 24mm/);
  for (const f of ['statement-sort.html', 'riddles.html', 'bingo.html', 'twenty-q.html', 'truth-dare.html', 'trail-signs.html', 'readiness-train.html']) {
    const page = readFileSync(app(f), 'utf8');
    assert.ok(page.includes('lib/access-guard.js') && page.includes('lib/game-kit.js'), f);
    assert.ok((page.match(/K\.LOGO/g) || []).length >= 2, f + ': logo');
    assert.doesNotMatch(page.replace(/<script>[\s\S]*?<\/script>/g, ''), /צריך|חייב|חובה|אסור/, f);
    assert.ok(guard.includes(`"${f}"`), f + ' in access-guard');
    assert.ok(auth.includes(`'${f}': ['games']`), f + ' in MODEL_PAGES');
    assert.ok(games.includes(`href="${f}"`), f + ' in games.html');
  }
  for (const p of ['game-where-it-belongs', 'game-riddles', 'game-bingo', 'game-twenty-questions', 'game-truth-challenge', 'game-trail-k2', 'game-trail-g34', 'game-trail-g56', 'game-trail-teen', 'game-readiness-train-kids', 'game-readiness-train-teen'])
    assert.ok(existsSync(app('assets/' + p + '.pdf')), p);
});
