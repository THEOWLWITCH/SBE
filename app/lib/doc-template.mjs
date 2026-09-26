// עטיפת Node למנוע הרינדור (doc-render.mjs): טוענת את הלוגו ואת כפתור
// הדיווח מהדיסק ומחזירה מרנדר מוכן. הלוגיקה עצמה — CSS, כותרת ממותגת,
// כרטיסי תפנית, ארבעת מסמכי אנשי החינוך, תסריט+כרטיסים להורים/נוער —
// חיה ב-doc-render.mjs, שהוא טהור ומשמש גם את הדפדפן (narrative-doc.js).
//
// משתמשים: build-docs.mjs, build-role-docs.mjs. כל בונה עתידי של תוצר
// מודפס עובר דרך כאן — לא מעתיק CSS לקובץ משלו.

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRenderer } from './doc-render.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

export const MARK = 'data:image/png;base64,' +
  readFileSync(join(HERE, '..', '..', 'assets', 'logo', 'sbe-mark.png')).toString('base64');

// כפתור הדיווח הגלובלי — אותו רכיב שבכל מסכי app/. מוצמד לכל תוצר בבנייה,
// כך שאין צורך להצמיד אותו ידנית אחרי כל הרצה (עד 21/09/2026 build-docs
// דרס אותו בכל הרצה והיה צריך להוסיף מחדש).
export const REPORT_WIDGET = readFileSync(join(HERE, 'report-widget.html'), 'utf8');
// תפריט הניווט הגלובלי ("→ חזרה / ☰ תפריט") — אותו רכיב שבכל מסכי app/.
// נעלם מארבעת מסמכי התוצר בכל הרצה של build-docs.mjs עד 21/09/2026 (הוחזר
// ידנית רק כפתור הדיווח) — עכשיו חלק מהתבנית, לא יכול להיעלם שוב.
export const NAV_WIDGET = readFileSync(join(HERE, 'nav-widget.html'), 'utf8');

const R = createRenderer({ MARK, REPORT_WIDGET, NAV_WIDGET });
export const { page, card, renderEduDocs, renderRoleDocs, esc, sec, paras, list, rows, red, blk, tpCard, CSS, CARD_CSS, FONTS } = R;
export default R;
