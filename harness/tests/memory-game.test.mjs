// זיכרון חוסן (21/10/2026): 20 זוגות, שני סטים, גרסה לכל שכבת גיל, במסך ולהדפסה.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const M = require('../../app/lib/memory-game.js');
const app = (f) => new URL('../../app/' + f, import.meta.url);

test('20 concepts, each with art, names and a situation for every age', () => {
  assert.equal(M.ITEMS.length, 20);
  assert.equal(new Set(M.ITEMS.map((i) => i.id)).size, 20);
  for (const it of M.ITEMS) {
    assert.equal(typeof M.ART[it.id], 'function', it.id);
    for (const k of ['young', 'mid', 'adult']) assert.ok(it.name[k], it.id + ' name ' + k);
    for (const a of M.AGES) assert.ok(it.sit[a.id] && it.sit[a.id].length < 90, it.id + ' sit ' + a.id);
    assert.ok(it.info);
  }
  assert.deepEqual(M.AGES.map((a) => a.id), ['young', 'mid', 'teen', 'staff']);
});

test('decks: identical pairs and concept + situation', () => {
  const same = M.deck('same', 'young', 10);
  assert.equal(same.length, 20);
  assert.ok(same.every((c) => c.kind === 'pic'));
  const match = M.deck('match', 'teen', 20);
  assert.equal(match.length, 40);
  assert.equal(match.filter((c) => c.kind === 'sit').length, 20);
  assert.match(M.face(match[1], 'teen'), /mg-sit/);
});

test('invitation language, no em dash, no referral', () => {
  const txt = JSON.stringify([M.ITEMS, M.RULES]);
  assert.doesNotMatch(txt, /צריך|חייב|חובה|מוכרח|אסור|—/);
  assert.doesNotMatch(txt, /יועצ|פסיכולוג|איש מקצוע/);
});

test('page, PDFs and wiring', () => {
  const page = readFileSync(app('memory-game.html'), 'utf8');
  assert.match(page, /lib\/access-guard\.js/);
  assert.match(page, /lib\/memory-game\.js/);
  assert.match(readFileSync(app('lib/access-guard.js'), 'utf8'), /"memory-game\.html"/);
  const games = readFileSync(app('games.html'), 'utf8');
  for (const f of ['same', 'young', 'mid', 'teen', 'staff']) {
    assert.ok(existsSync(app(`assets/resilience-memory-${f}.pdf`)), f);
    assert.match(games, new RegExp(`resilience-memory-${f}\\.pdf`));
  }
  assert.match(games, /href="memory-game\.html"/);
});
