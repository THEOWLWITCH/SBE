// התוצרים הסטטיים לדוגמה נבנים מחדש אחרי שינוי ב-doc-render.mjs (12/10/2026, בדיקת הלקוחה: "פתיחה לקבוצה" חסרה בקבצים הישנים).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const R = (f) => readFileSync(new URL('../../app/' + f, import.meta.url), 'utf8');
test('תסריטי משחק התפקידים כוללים פתיחה לקבוצה וכרטיסי דמויות', () => {
  for (const f of ['products/parents-scenario.html', 'products/youth-scenario.html']) {
    const h = R(f); assert.match(h, /פתיחה לקבוצה/, f); assert.match(h, /כרטיסי הדמויות/, f);
  }
});
test('מסמכי הסימולציה: מספרי עמודים, בלי מזהה פנימי ובלי "המערכת אינה כותבת מקורות"', () => {
  for (const f of ['doc-facilitator.html', 'doc-trainee.html', 'doc-actor.html', 'products/edu-doc-facilitator.html']) {
    const h = R(f); assert.match(h, /counter\(pages\)/, f); assert.doesNotMatch(h, /המערכת אינה כותבת מקורות/, f);
  }
});
