// בלי הפניה לאנשי מקצוע בכל המערכת (12/10/2026: "לא מפנים לאיש מקצועי!!! לא שואלים ולא מציעים... אין כל הפניה לא.נשי מקצוע בכל המערכת").
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const INVITE = require('../../app/lib/invite-language.js');
const R = (f) => readFileSync(new URL('../../app/' + f, import.meta.url), 'utf8');

test('השרת מוסיף לכל קריאה את הכלל "בלי הפניה לאנשי מקצוע"', () => {
  const s = INVITE.apply('הנחיה');
  assert.ok(s.includes(INVITE.EDU_TITLE));
  assert.match(INVITE.educator, /אל תפני, אל תציעי ואל תשאלי/);
  assert.equal(INVITE.apply(s), s, 'פעם אחת בלבד');
});

const FILES = ['resilience-advisor.html', 'leadership-advisor.html', 'conversation-planner.html', 'resilience-team.html',
  'facilitation-advisor.html', 'practice.html', 'lib/facilitation-model.js', 'lib/continuity-model.js',
  'lib/resilience-leadership.js', 'lib/resilience-advisor-sources.js', 'lib/resilience-demo.js', 'lib/resilience-studio.js',
  'lib/family-bridge-model.js', 'lib/routines-model.js', 'lib/resilience-writer.js', 'lib/journey-model.js'];
const BAD = [/מוכנ\S* להיפגש עם איש/, /פגישה עם איש\/אשת מקצוע/, /הפניה (ל)?גורם (מקצועי|טיפולי)/, /הפניה מקצועית/,
  /מסלולי הפניה/, /מערך הפניה/, /ליידע את הגורמים המקצועיים/, /(אינה|לא) מחליפה (מענה )?טיפול/, /ער״ן|ער"ן/,
  /עם גורם מקצועי/, /תיאום עם היועצת/];
test('אין הפניה, הצעה או שאלה על פגישה עם איש/אשת מקצוע בכלים', () => {
  for (const f of FILES) {
    const h = R(f);
    for (const re of BAD) assert.doesNotMatch(h, re, f + ' ' + re);
  }
});

// 12/10/2026: "חובת דיווח רק אם הצד השני יזכיר זאת. התייעצות עם גורם מקצועי - רק אם הצד השני מבקש. סכנה מיידית - אתה לא יוזם".
test('חובת דיווח, התייעצות וסכנה מיידית רק כשהמשתמש/ת מעלה אותן', () => {
  assert.match(INVITE.educator, /רק אם המשתמש\/ת מזכיר\/ה אותה/);
  assert.match(INVITE.educator, /רק אם המשתמש\/ת מבקש\/ת/);
  assert.match(INVITE.educator, /אל תיזמי תרחישים או מצבים של סכנה מיידית/);
  for (const f of FILES) {
    const h = R(f);
    assert.doesNotMatch(h, /כשיש חובת דיווח (לפי הנהלים (והחוק )?)?לא מבטיחים/, f);
    assert.doesNotMatch(h, /(אם יש|וכשיש|בסכנה|במצב) סכנה מיידית[:,]? (הישארו|נשארים)/, f);
    assert.doesNotMatch(h, /בסכנה מיידית נשארים/, f);
  }
});
