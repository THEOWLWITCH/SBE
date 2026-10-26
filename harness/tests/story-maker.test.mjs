// מחולל סיפורי חוסן (22/10/2026): דמויות, נושא ותפניות, סיפור מאויר ו-PDF עם לוגו והקדשה.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const S = require('../../app/lib/story-maker.js');
const app = (f) => new URL('../../app/' + f, import.meta.url);
const form = { chars: [{ name: 'נועה', g: 'f', color: 'teal', body: 'round', extra: '', traits: ['אמיץ/ה'] }, { name: 'שקד', g: 'm', color: 'coral', body: 'tall', extra: 'bunny', traits: [] }], theme: 'הפסקת חשמל בלילה', place: 'home', twists: ['ואז פתאום כבה האור'], ending: 'party', age: 'g34' };

test('the prompt carries the characters, the theme, the twists and the picture vocabulary', () => {
  const sys = S.system('g34'), inp = S.input(form);
  for (const k of ['place', 'mood', 'pose', 'prop', 'resilience', 'questions']) assert.match(sys, new RegExp(k));
  assert.match(inp, /נועה \(היא\)/); assert.match(inp, /שקד \(הוא\)/); assert.match(inp, /הפסקת חשמל/); assert.match(inp, /1\. ואז פתאום כבה האור/);
  assert.doesNotMatch(sys, /יועצ|פסיכולוג|איש מקצוע/);
});

test('normalize keeps only valid picture choices, and every page gets a scene', () => {
  const v = S.normalize({ title: 'ט', pages: [{ text: 'עמוד ראשון ארוך מספיק כדי להיחשב', place: 'moon', mood: 'x', cast: [{ who: 5, pose: 'fly' }, { who: 1, pose: 'sad' }], prop: 'sword' }, { text: 'עמוד שני ארוך מספיק כדי להיחשב' }, { text: 'עמוד שלישי ארוך מספיק כדי להיחשב' }], questions: ['מה?'] }, form);
  assert.equal(v.pages[0].place, 'home'); assert.equal(v.pages[0].mood, 'sunny'); assert.equal(v.pages[0].prop, 'none');
  assert.deepEqual(v.pages[0].cast, [{ who: 1, pose: 'sad' }]);
  assert.ok(v.pages[1].cast.length >= 1);
  assert.ok(S.valid(v));
  for (const p of v.pages) assert.match(S.scene(p, form.chars), /^<svg/);
  for (const [pl] of S.PLACES) assert.match(S.scene({ place: pl, mood: 'rain', cast: [{ who: 0, pose: 'hug' }], prop: 'umbrella' }, form.chars), /<svg/);
});

test('the dedication is to the child who created the story, in their gender', () => {
  assert.match(S.dedication({ name: 'אלה', g: 'f' }).head, /לאלה, שיצרה/);
  assert.match(S.dedication({ name: 'יואב', g: 'm' }).head, /ליואב, שיצר/);
});

test('page, print with logo, and wiring', () => {
  const page = readFileSync(app('story-maker.html'), 'utf8');
  for (const s of ['lib/access-guard.js', 'lib/ai-call.js', 'lib/memory-game.js', 'lib/story-maker.js', 'begood-logo', 'sbeCallAIJson']) assert.ok(page.includes(s), s);
  assert.doesNotMatch(page, /צריך|חייב|חובה|אסור|—/);
  assert.match(readFileSync(app('lib/access-guard.js'), 'utf8'), /"story-maker\.html"/);
  assert.match(readFileSync(new URL('../lib/access.mjs', import.meta.url), 'utf8'), /'story-maker\.html': \['games'\]/);
  assert.match(readFileSync(app('games.html'), 'utf8'), /href="story-maker\.html"/);
});

test('הקדשה מהדמויות, ועד שש דמויות', () => {
  assert.equal(S.MAX_CHARS, 6);
  const d = S.dedication({ name: 'יעל', g: 'f' }, [{ name: 'נוני' }, { name: 'פופי' }, { name: 'בוב' }]);
  assert.equal(d.head, 'ליעל, שיצרה את הסיפור הזה');
  assert.equal(d.from, 'באהבה, נוני, פופי ובוב');
  assert.match(d.line, /אותנו/);
  const one = S.dedication({ name: 'דן', g: 'm' }, [{ name: 'זיזי' }]);
  assert.equal(one.head, 'לדן, שיצר את הסיפור הזה');
  assert.match(one.line, /אותי/);
  const n = S.normalize({ title: 'x', pages: [{ text: 'עמוד עם שש דמויות', cast: [0,1,2,3,4,5].map((w) => ({ who: w })) }] }, { ...form, chars: Array.from({ length: 6 }, (_, i) => ({ name: 'ד' + i })) });
  assert.equal(n.pages[0].cast.length, 6);
});

test('סיפורים לבוגרים: גיל, נושאים, תפניות ופרומפט משלהם', () => {
  assert.ok(S.AGES.some((a) => a[0] === 'adult' && a[1] === 'בוגרים'));
  assert.ok(S.isAdult('adult') && !S.isAdult('teen'));
  assert.notDeepEqual(S.themes('adult'), S.themes('g34'));
  assert.notDeepEqual(S.twists('adult'), S.twists('g34'));
  const sys = S.system('adult');
  assert.match(sys, /לבוגרים/);
  assert.match(sys, /בצוות, בקבוצת הורים/);
  assert.doesNotMatch(sys, /סופרת ילדים/);
  assert.match(S.system('g34'), /סופרת ילדים/);
  const page = readFileSync(app('story-maker.html'), 'utf8');
  assert.ok(page.includes('S.themes(f.age)') && page.includes('qIntro()'));
});
