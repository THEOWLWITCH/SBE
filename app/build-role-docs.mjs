// בונה את תוצרי מסלולי ההורים והנוער מקובץ נתונים אחד.
//   node build-role-docs.mjs scenarios/parents-od-shtei-dakot.json
//   node build-role-docs.mjs            (בונה את כל scenarios/*.json)
//
// מקביל ל-build-docs.mjs (מסלול אנשי חינוך), על אותו מנוע רינדור
// (lib/doc-render.mjs). ההבדל המבני: כאן שתי הדמויות שוות — אין "שחקנית"
// מול "מתנסה" — ולכן לכל דמות כרטיס דמות בגוף שני, ולתסריט (למנחה / למי
// שמעבירה) שתי הדמויות בגוף שלישי.
//
// מבנה הקלט (scenarios/*.json) והעקרונות שכל שדה טקסט בו חייב לעמוד בהם:
// prompts/narrative-products.md. אותו JSON בדיוק הוא מה שמסכי הקלט של
// ההורים/הנוער מבקשים מהמודל בלחיצה על "בנייה" (lib/narrative-doc.js).

import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderRoleDocs } from './lib/doc-template.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'downloads');
mkdirSync(OUT, { recursive: true });

const files = process.argv[2]
  ? [process.argv[2]]
  : readdirSync(join(HERE, 'scenarios')).filter((f) => f.endsWith('.json')).map((f) => join('scenarios', f));

for (const rel of files) {
  const s = JSON.parse(readFileSync(join(HERE, rel), 'utf8'));
  for (const [file, html, label] of renderRoleDocs(s).files) {
    writeFileSync(join(OUT, file), html, 'utf8');
    console.log(`${label.padEnd(30)} → downloads/${file}`);
  }
}
