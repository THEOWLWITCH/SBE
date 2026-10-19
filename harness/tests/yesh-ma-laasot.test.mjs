// "יש מה לעשות" (19/10/2026): מדריכון לחירום, פתוח לכולם מעמוד הכניסה, מהמפה ומדף האודות; גם מתוך המערכת;
// מהמדריכון עצמו אין מעבר לכלים אחרים; ואפשר לשלוח אותו כמתנה אישית.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const R = require('../../app/lib/readiness-groups.js');
const GIFT = require('../../app/lib/gift-link.js');
const read = (f) => readFileSync(new URL('../../app/' + f, import.meta.url), 'utf8');
const PAGE = 'yesh-ma-laasot.html';

test('the guide is open: no login guard, no tool menu, no links to other tools', () => {
  const h = read(PAGE);
  assert.doesNotMatch(h, /access-guard\.js|screens-menu\.js/);
  const hrefs = [...h.matchAll(/href="([^"]+)"/g)].map((m) => m[1]).filter((u) => !/^https:\/\/fonts\./.test(u));
  for (const u of hrefs) assert.match(u, /^(https:\/\/be-good\.co\.il|https:\/\/doi\.org\/|tel:|assets\/|#i-)/, u);
  assert.doesNotMatch(h, /location\.href\s*=/);
});

test('reachable from the entry screen, the map, the about page and my space', () => {
  assert.match(read('entry.html'), /href:"yesh-ma-laasot\.html"/);
  const map = read('map.html');
  assert.match(map, /id: 'ymd', open: true/);
  assert.match(map, /id: 'emergency', n: 'להיערך לחירום ולתגובה ראשונה'/);
  assert.match(map, /if \(t\.open\)/);
  assert.match(read('about.html'), /href="yesh-ma-laasot\.html"/);
  assert.match(read('home.html'), /"yesh-ma-laasot\.html", "🎁 יש מה לעשות/);
  assert.equal(R.groupOf(PAGE).id, 'practice');
});

test('gift links carry name, sender and dedication, and the guide shows them as text only', () => {
  const u = new URL(GIFT.link({ to: ' נועה ', from: 'ד״ר יעל שדה', msg: 'שיהיה לך <b>בטלפון</b>', lang: 'ar' }));
  assert.equal(u.pathname.endsWith(PAGE), true);
  assert.equal(u.searchParams.get('to'), 'נועה');
  assert.equal(u.searchParams.get('lang'), 'ar');
  assert.equal(u.searchParams.get('msg'), 'שיהיה לך <b>בטלפון</b>');
  assert.equal(new URL(GIFT.link({})).searchParams.get('gift'), '1');
  const h = read(PAGE);
  for (const id of ['giftTitle', 'giftFrom', 'giftMsg', 'giftRibbon']) assert.doesNotMatch(h, new RegExp('#' + id + '"\\)\\.innerHTML'), id);
  for (const f of ['home.html', 'admin.html']) assert.match(read(f), /lib\/gift-link\.js/);
});

test('no referral to professionals; only 104 and 100; regular quotes', () => {
  const h = read(PAGE);
  for (const re of [/פסיכולוג/, /עובד\/ת סוציאלי/, /איש\/אשת מקצוע/, /גורם (מקצועי|טיפולי)/, /ער״ן|ער"ן/, /יועצת/]) assert.doesNotMatch(h, re, String(re));
  assert.match(h, /tel:104/); assert.match(h, /tel:100/);
  assert.doesNotMatch(h, /—/);
  assert.doesNotMatch(h, /(^|[\s(:"])״[^״\n"]{1,160}״(?=[\s.,:;)!?<"])/, 'Hebrew gershayim used as quotation marks');
});
