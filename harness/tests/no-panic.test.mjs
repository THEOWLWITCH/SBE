// בלי פאניקה! משחק קלפים למוכנות בחירום (22/10/2026), על המסך ולהדפסה.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const P = require('../../app/lib/no-panic.js');
const app = (f) => new URL('../../app/' + f, import.meta.url);

test('72 cards in print, 66 on the screen, and every event has two responses', () => {
  assert.equal(P.deck({ diy: true }).length, 72);
  assert.equal(P.deck().length, 66);
  const d = P.deck();
  for (let n = 1; n <= 20; n++) {
    const ev = d.find((c) => c.uid === 'e' + n), r = d.find((c) => c.uid === 'r' + n), i = d.find((c) => c.uid === 'i' + n);
    assert.ok(P.isPair(ev, r) && P.isPair(ev, i) && !P.isPair(r, i), 'pair ' + n);
    assert.equal(r.pts, 2); assert.equal(i.pts, 1);
    assert.ok(P.ART[n] && P.ART[n].length, 'art ' + n);
  }
  for (const a of P.ACTIONS) assert.ok(P.AART[a.id], a.id);
});

test('every card has the logo, a type name, a mark and a number', () => {
  for (const c of P.deck({ diy: true })) {
    const h = P.cardHTML(c);
    assert.match(h, /begood-logo-sm\.webp/); assert.match(h, /np-mark/); assert.match(h, /np-num/);
  }
  assert.match(P.backHTML(), /begood-logo-sm\.webp/);
});

test('invitation language, both genders, no em dash, no referral', () => {
  const txt = JSON.stringify([P.EVENTS, P.READY, P.IMPRO, P.ACTIONS, P.DIY, P.RULES]);
  assert.doesNotMatch(txt, /צריך|חייב|חובה|מוכרח|אסור|—/);
  assert.doesNotMatch(txt, /יועצ|פסיכולוג|איש מקצוע/);
  assert.doesNotMatch(txt, /\bאתה\b|\bשחקן\b/);
  assert.doesNotMatch(readFileSync(app('no-panic.html'), 'utf8'), /צריך|חייב|חובה|אסור/);
});

test('page, PDF and wiring', () => {
  const page = readFileSync(app('no-panic.html'), 'utf8');
  for (const s of ['lib/access-guard.js', 'lib/no-panic.js']) assert.ok(page.includes(s), s);
  assert.match(readFileSync(app('lib/access-guard.js'), 'utf8'), /"no-panic\.html"/);
  assert.match(readFileSync(new URL('../lib/access.mjs', import.meta.url), 'utf8'), /'no-panic\.html': \['games'\]/);
  assert.ok(existsSync(app('assets/no-panic-cards.pdf')) && existsSync(app('assets/games-nopanic.webp')));
  const games = readFileSync(app('games.html'), 'utf8');
  assert.match(games, /no-panic-cards\.pdf/); assert.match(games, /href="no-panic\.html"/);
});
