// מסע אל החוסן: משחק לוח (22/10/2026), על המסך ולהדפסה.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const B = require('../../app/lib/board-game.js');
const app = (f) => new URL('../../app/' + f, import.meta.url);

test('a 36-step path from the start to resilience, with every kind of square', () => {
  assert.equal(B.N, 36);
  const types = {};
  for (let k = 1; k <= B.N; k++) { const s = B.square(k); types[s.type] = (types[s.type] || 0) + 1; }
  assert.deepEqual(types, { task: 20, boost: 6, setback: 6, together: 4 });
  assert.equal(B.square(0).type, 'start'); assert.equal(B.square(B.END).type, 'end');
  assert.ok(B.SETBACKS.s1.text.includes('סופה') && B.SETBACKS.s1.back === 4, 'the storm from the request');
  assert.ok(B.TASKS.some((t) => t.includes('שני משפטים מחזקים')) && B.TASKS.some((t) => t.includes('שתי יכולות של מישהו אחר')));
  for (const s of Object.values(B.SETBACKS)) assert.ok(B.bridgeBack(s.back) >= 1 && B.bridgeBack(s.back) < s.back + (s.back === 1 ? 1 : 0));
});

test('the board svg has every square, the start and the end', () => {
  const svg = B.board();
  assert.equal((svg.match(/class="bg-sq"/g) || []).length, 36);
  assert.match(svg, /יוצאים/); assert.match(svg, /חוסן/);
});

test('invitation language, no em dash, no referral', () => {
  const txt = JSON.stringify([B.TASKS, B.SETBACKS, B.BOOSTS, B.TOGETHER, B.RULES]);
  assert.doesNotMatch(txt, /צריך|חייב|חובה|מוכרח|אסור|—/);
  assert.doesNotMatch(txt, /יועצ|פסיכולוג|איש מקצוע/);
});

test('page, PDF and wiring', () => {
  const page = readFileSync(app('board-game.html'), 'utf8');
  for (const s of ['lib/access-guard.js', 'lib/memory-game.js', 'lib/board-game.js']) assert.ok(page.includes(s), s);
  assert.match(readFileSync(app('lib/access-guard.js'), 'utf8'), /"board-game\.html"/);
  assert.ok(existsSync(app('assets/resilience-journey-board.pdf')));
  const games = readFileSync(app('games.html'), 'utf8');
  assert.match(games, /resilience-journey-board\.pdf/); assert.match(games, /href="board-game\.html"/);
});
