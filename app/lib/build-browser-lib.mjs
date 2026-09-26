// מייצר את lib/narrative-doc.js — גרסת הדפדפן של מנוע הרינדור.
//   node lib/build-browser-lib.mjs
//
// מקור האמת היחיד הוא doc-render.mjs. הקובץ הזה רק מסיר את מילות ה-export,
// עוטף ב-IIFE, מזריק את הלוגו, ומפרסם window.SBE_DOC. **אין לערוך את
// narrative-doc.js ידנית** — כל שינוי ב-doc-render.mjs, ואז להריץ שוב.
//
// מסכי הקלט (input-screen / parent-input-screen / student-input-screen)
// טוענים אותו ב-<script src="lib/narrative-doc.js"> ומרנדרים איתו את
// התוצר בלחיצה על "בנייה" — אותה תבנית בדיוק כמו ב-build-docs.mjs.

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(HERE, 'doc-render.mjs'), 'utf8');
const MARK = 'data:image/png;base64,' +
  readFileSync(join(HERE, '..', '..', 'assets', 'logo', 'sbe-mark.png')).toString('base64');

const body = src
  .replace(/^export function /gm, 'function ')
  .replace(/^export const /gm, 'const ');

const out = `// נוצר אוטומטית מ-lib/doc-render.mjs על ידי lib/build-browser-lib.mjs — לא לערוך ידנית.
// window.SBE_DOC: { renderEduDocs(s), renderRoleDocs(s), page, card, tpCard, CSS, ... , MARK }
(function(){
${body}
var R = createRenderer({ MARK: ${JSON.stringify(MARK)}, REPORT_WIDGET: '' });
R.MARK = ${JSON.stringify(MARK)};
window.SBE_DOC = R;
})();
`;
writeFileSync(join(HERE, 'narrative-doc.js'), out, 'utf8');
console.log(`lib/narrative-doc.js נוצר (${(out.length / 1024).toFixed(1)}KB)`);
