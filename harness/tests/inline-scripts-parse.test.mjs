// A syntax error in an inline script stops the whole page (28/10/2026: "המרחב שלי" and the example library broke this way).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('every inline classic script in app/*.html parses', () => {
  const dir = new URL('../../app/', import.meta.url);
  const bad = [];
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.html'))) {
    const html = fs.readFileSync(new URL(f, dir), 'utf8');
    for (const m of html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g)) {
      if (/type=["']/.test(m[1]) && !/type=["']text\/javascript/.test(m[1])) continue;
      try { new vm.Script(m[2]); } catch (e) { bad.push(f + ': ' + e.message); }
    }
  }
  for (const f of fs.readdirSync(new URL('lib/', dir)).filter((f) => f.endsWith('.js') && f !== 'sbe-db.js')) {
    try { new vm.Script(fs.readFileSync(new URL('lib/' + f, dir), 'utf8')); } catch (e) { bad.push('lib/' + f + ': ' + e.message); }
  }
  assert.deepEqual(bad, []);
});
