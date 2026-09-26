// בונה את ארבעת תוצרי מסלול אנשי החינוך מקובץ נתונים אחד.
//   node build-docs.mjs [scenario.json]
//
// זה המימוש של ההחלטה שהתבנית נקבעת בקוד ולא בניסוח של המודל.
// המודל ממלא שדות, והקוד מרכיב מהם מסמך. אותם סעיפים, באותו סדר, תמיד.
// הרינדור עצמו ב-lib/doc-render.mjs (משותף להורים/נוער ולדפדפן).
//
// מ-21/09/2026 המסמכים הם פרוזה בגוף שני, לא רשימות שדות (המשתמשת:
// "התוצרים מרגישים מכניים... צריך שיחה דינמית ואנושית"). שדות הפרוזה
// ב-scenario.json: actor.portrait / askAndBeneath / arc / endingsProse,
// trainee.portraitForActor / stakesForTrainee, facilitator.charactersProse /
// dynamics. שדות הרשימה הישנים (material/visible/hidden/knows...) נשארים
// כמקור לכרטיס, לבדיקת הדלף ולמנוע התרגול. תרחיש שיצא מהצינור
// (harness/lib/to-scenario.mjs) כבר בפורמט הזה.

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderEduDocs } from './lib/doc-template.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const s = JSON.parse(readFileSync(join(HERE, process.argv[2] || 'scenario.json'), 'utf8'));

const { files, leaked } = renderEduDocs(s);
for (const [file, html, label] of files) {
  writeFileSync(join(HERE, file), html, 'utf8');
  console.log(`${label.padEnd(16)} → ${file}  (${(html.length / 1024).toFixed(1)}KB)`);
}
console.log(leaked.length ? `\n⚠ דלף בגרסת המתנסה: ${leaked[0]}` : '\n✓ אין דלף בגרסת המתנסה');
