// ארבעה מרחבים (28/10/2026): כל דף שנפתח בהרשאה שייך למרחב אחד, ומי שבמרחב אחד לא רואה את הכלים של המרחב השני.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const S = createRequire(import.meta.url)('../../app/lib/spaces.js');

test('every page that a permission opens belongs to exactly one space', () => {
  const guard = readFileSync(new URL('../../app/lib/access-guard.js', import.meta.url), 'utf8');
  const block = guard.slice(guard.indexOf('var PAGES_BY_PERM'), guard.indexOf('var SIM_DOCS'));
  const pages = [...new Set([...block.matchAll(/"([a-z0-9-]+\.html)"/g)].map((m) => m[1]))];
  assert.ok(pages.length > 30);
  for (const p of pages) assert.ok(S.spaceOf(p), p + ' has no space');
  const all = Object.values(S.PAGES).flat();
  assert.equal(all.length, new Set(all).size, 'a page is listed in two spaces');
});

test('a work space shows its own tools and the shared ones, never the other space', () => {
  assert.ok(S.visibleIn('org', 'hl-voice.html'));
  assert.ok(S.visibleIn('edu', 'hl-voice.html'));
  assert.ok(S.visibleIn('edu', 'practice.html'));
  assert.equal(S.visibleIn('org', 'practice.html'), false);
  assert.equal(S.visibleIn('edu', 'examples-org.html'), false);
  assert.ok(S.visibleIn('org', 'examples-org.html'));
});

test('the tagline exists in three languages, and the coming-to-org list names real pages', () => {
  assert.deepEqual(Object.keys(S.TAGLINE).sort(), ['ar', 'en', 'he']);
  for (const c of S.COMING_TO_ORG) assert.equal(S.spaceOf(c.page), 'edu', c.page);
});
