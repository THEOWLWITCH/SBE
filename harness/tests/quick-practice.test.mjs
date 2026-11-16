// התנסות קצרה ככלי עצמאי (16/11/2026: "הוסף זאת גם ככלי עצמאי"): quick-practice.html מוגש מ-practice.html
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { PERMS, MODEL_PAGES, MODEL_ROUTES, OPEN_PAGES } from '../lib/access.mjs';
const app = (f) => readFileSync(new URL('../../app/' + f, import.meta.url), 'utf8');
const require = createRequire(import.meta.url);

test('quickpractice: הרשאה, מודל, קישור פתוח וניווט', () => {
  assert.ok(PERMS.includes('quickpractice'));
  assert.deepEqual(MODEL_PAGES['quick-practice.html'], ['quickpractice']);
  assert.ok(MODEL_ROUTES['/api/character-turn'].includes('quick-practice.html'));
  assert.equal(OPEN_PAGES['quick-practice.html'], 'quickpractice');
  assert.match(app('lib/access-guard.js'), /quickpractice: \["quick-practice\.html"\]/);
  for (const f of ['home.html', 'renew.html', 'admin.html', 'map.html', 'about.html', 'lib/spaces.js', 'lib/readiness-groups.js', 'lib/product-doc.js', 'lib/screens-menu.js'])
    assert.match(app(f), /quick-practice|quickpractice/, f);
  assert.match(readFileSync(new URL('../../netlify.toml', import.meta.url), 'utf8'), /from = "\/quick-practice\.html"\s+to = "\/practice\.html"\s+status = 200/);
  assert.match(app('practice.html'), /SBE_SOLO_READY/);
});

test('התרחיש המוכן תקין בשתי לשונות הפנייה', () => {
  const P = require('../../app/lib/practice-custom.js');
  for (const g of ['נקבה', 'זכר']) { const sc = P.readyScenario(g); assert.ok(P.valid(sc)); assert.equal(sc.trainee.gender, g); }
});
