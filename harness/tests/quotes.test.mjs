import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const Q = createRequire(import.meta.url)('../../app/lib/quotes.js');

test('Hebrew quotes become plain quotes, once; gershayim inside words stay', () => {
  assert.equal(Q.fix('"„שמעתי שלושה כיוונים חוזרים. מה חסר כאן?״"'), '"שמעתי שלושה כיוונים חוזרים. מה חסר כאן?"');
  assert.equal(Q.fix('ד״ר שדה אמרה ״שלום״ ו“תודה”.'), 'ד״ר שדה אמרה "שלום" ו"תודה".');
  assert.equal(Q.wrap('„שתי אפשרויות״'), '"שתי אפשרויות"');
  assert.equal(Q.wrap('שתי אפשרויות'), '"שתי אפשרויות"');
});

test('JSON answers keep their structure: quotes are fixed only inside values', () => {
  const out = Q.text('הנה: {"a":"„עד עכשיו שוחחנו.״","b":["“x”"]} סוף');
  const j = JSON.parse(out.slice(out.indexOf('{'), out.lastIndexOf('}') + 1));
  assert.equal(j.a, '"עד עכשיו שוחחנו."'); assert.equal(j.b[0], '"x"');
  assert.equal(Q.text('{"a":"לא נסגר'), '{"a":"לא נסגר'); // JSON שבור: לא נוגעים
});

test('demoTidy: saved products show "תרומה לחוסן החברתי" and plain quotes, scripts untouched', async () => {
  const { demoTidy } = await import('../lib/access.mjs');
  const out = demoTidy('<th>מה זה מפתח</th><td>מה זה בונה בחוסן החברתי</td><p>מה זה בונה: x „שלום”</p><script>var a="";</script>');
  assert.match(out, /<th>תרומה לחוסן החברתי<\/th><td>תרומה לחוסן החברתי<\/td>/);
  assert.match(out, /<p>תרומה לחוסן החברתי: x "שלום"<\/p>/);
  assert.match(out, /var a="";/);
});

test('Hebrew gender agreement: "וזו לא הפעם הראשונה", not "וזה"', () => {
  assert.equal(Q.fix('אני כבר אמרתי לו, וזה לא הפעם הראשונה.'), 'אני כבר אמרתי לו, וזו לא הפעם הראשונה.');
  assert.equal(Q.fix('זה הפעם השלישית. שזה הדרך שלנו'), 'זו הפעם השלישית. שזו הדרך שלנו');
  assert.equal(Q.fix('"זה לא השאלה"'), '"זו לא השאלה"');
  assert.equal(Q.fix('עשיתי את זה הפעם לבד'), 'עשיתי את זה הפעם לבד');
  assert.equal(Q.fix('זה הפעמון של בית הספר'), 'זה הפעמון של בית הספר');
  assert.equal(Q.fix('זה הספר שלי'), 'זה הספר שלי');
});

test('"עד ש" only before a verb: "עד הצלצול.", "עד שהצלצול ניער אותי" stays', () => {
  assert.equal(Q.fix('עמדתי שם שבע דקות עד שהצלצול, כי לא רציתי.'), 'עמדתי שם שבע דקות עד הצלצול, כי לא רציתי.');
  assert.equal(Q.fix('חיכיתי עד שההפסקה.'), 'חיכיתי עד ההפסקה.');
  assert.equal(Q.fix('עד שהצלצול ניער אותי וחזרתי לכיתה.'), 'עד שהצלצול ניער אותי וחזרתי לכיתה.');
});
