// חמש שאלות של מוכנות יומיומית (10/10/2026): אותה חלוקה בתפריט, במרחב שלי, במפת הכלים, בספריית התוצרים ובדף האודות.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const R = require('../../app/lib/readiness-groups.js');
const invite = require('../../app/lib/invite-language.js');
const read = (f) => readFileSync(new URL('../../app/' + f, import.meta.url), 'utf8');

test('five readiness questions, in the order of the cycle', () => {
  assert.deepEqual(R.GROUPS.map((g) => g.n), ['לראות', 'להתאמן', 'לתכנן ולפעול', 'ללמוד מהעשייה', 'לעגן בשגרה']);
  assert.equal(R.title(R.GROUPS[1]), '🎭 2. להתאמן: מוכנים לרגע המאתגר?');
  assert.equal(R.groupOf('academic-review.html?x=1').id, 'learn');
  const all = Object.values(R.PAGES).flat(); assert.equal(new Set(all).size, all.length, 'each page in one group');
});

test('the ☰ menu uses the same groups for every tool page', () => {
  const ctx = { window: {} }; vm.runInNewContext(read('lib/screens-menu.js'), ctx);
  const others = ctx.window.SBE_SCREENS.find((p) => p.part === 'others');
  for (const [id, pages] of Object.entries(R.PAGES)) {
    const g = R.GROUPS.find((x) => x.id === id);
    for (const f of pages) {
      const grp = others.groups.find((x) => x.items.some((it) => it.file === f));
      assert.ok(grp, f); assert.ok(grp.title.startsWith(g.i + ' ' + (R.GROUPS.indexOf(g) + 1) + '. ' + g.n), f + ' in ' + grp.title);
    }
  }
});

test('about page and tool map follow the five questions, in inviting language', () => {
  const about = read('about.html'), map = read('map.html');
  for (const g of R.GROUPS) assert.ok(about.includes('<h3 class="grp">' + R.title(g) + '</h3>'), g.n);
  assert.match(about, /את המוכנות אפשר לבדוק כל יום/);
  for (const f of ['home.html', 'map.html', 'examples.html']) assert.match(read(f), /lib\/readiness-groups\.js/);
  assert.doesNotMatch(map, /(?<!ב)קשה|לא רק ללמד|משוב על עבודה|הורים ונוער/);
  for (const n of ['להתכונן להגשת עבודה', 'כתיבה יומיומית מכוונת חוסן חברתי', 'שפת החוסן עבור הורים', 'להתכונן לשיחה מאתגרת']) assert.ok(map.includes("n: '" + n + "'"), n);
  assert.doesNotMatch(map, /placeholder="[^"]*הורים/);
  const script = map.slice(map.indexOf('<script>'));
  assert.deepEqual(invite.find(script.replace(/kw: \/[^/]*\//g, '')), []);
  assert.doesNotMatch(map, /—/);
});
