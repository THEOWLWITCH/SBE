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
