// הפרומפטים נקראים מקבצי המפרט עצמם.
// המפרט הוא מקור האמת היחיד, ואין העתק שני שיכול להיסחף ממנו.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SPECS = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'prompts');

const FILES = {
  stage1: 'stage1-characters.md',
  stage2: 'stage2-turning-points.md',
  stage3: 'stage3-writing.md',
  trainee: 'trainee-opening.md',
};

// לוקח את גוש הקוד המגודר הארוך ביותר שנמצא אחרי הכותרת "הפרומפט".
// קבצי המפרט נכתבים עם סופי שורה של Windows, ולכן \r? חובה.
const FENCE = /```(?:[a-z]+)?\r?\n([\s\S]*?)```/g;

// באג אמיתי שנמצא ותוקן (19/09/2026, בהרצה חיה ראשונה של הצינור המלא):
// הפונקציה הזאת החזירה תמיד רק את גוש ההנחיות הארוך שאחרי "## הפרומפט",
// **בלי** את גוש הסכימה המדויקת שיושב מתחת לכותרת נפרדת ("## סכימת הפלט"),
// אף שההנחיות עצמן מפנות אליו במפורש ("לפי הסכימה בסוף"). המשמעות בפועל:
// המודל מעולם לא ראה את שמות המפתחות המדויקים (characters.trainee/actor,
// turningPoints וכו') וניחש מבנה סביר מהפרוזה בלבד (למשל characterA/
// characterB במקום characters.trainee/actor) — JSON תקין שעבר את
// extractJson בלי שגיאה, אבל לא תואם למה שהקוד ב-pipeline.mjs מצפה לו
// בשמות המפתחות, כך ששדות שלמים (characters/turningPoints) נעלמו בשקט
// מהתוצר הסופי. תוקן: שולפת גם את כל הגושים המגודרים תחת "## סכימת" (אם
// יש כזאת כותרת בקובץ) ומצרפת אותם בסוף הפרומפט בפועל, מתויגים בבירור.
function extractPrompt(md, file) {
  const idx = md.indexOf('## הפרומפט');
  const region = idx >= 0 ? md.slice(idx) : md;
  const blocks = [...region.matchAll(FENCE)].map((m) => m[1]);
  if (!blocks.length) throw new Error(`לא נמצא גוש פרומפט ב-${file}`);
  const mainPrompt = blocks.sort((a, b) => b.length - a.length)[0].trim();

  const schemaIdx = md.search(/## סכימ/);
  if (schemaIdx < 0) return mainPrompt;
  const schemaRegion = md.slice(schemaIdx);
  // עוצרת בכותרת ## הבאה (למשל "## בדיקות אוטומטיות"), כדי לא לגרור פנימה
  // גושי JSON לא-קשורים שמופיעים בהמשך אותו קובץ מפרט.
  const nextHeadingIdx = schemaRegion.slice(1).search(/\r?\n## /);
  const schemaSection = nextHeadingIdx >= 0 ? schemaRegion.slice(0, nextHeadingIdx + 1) : schemaRegion;
  const schemaBlocks = [...schemaSection.matchAll(FENCE)].map((m) => m[1].trim());
  if (!schemaBlocks.length) return mainPrompt;
  return mainPrompt + '\n\nהסכימה המדויקת שהוזכרה למעלה — החזירי בדיוק את מבנה המפתחות הזה, לא מבנה דומה משלך:\n\n' +
    schemaBlocks.map(b => '```json\n' + b + '\n```').join('\n\n');
}

const cache = new Map();

export function loadPrompt(stage) {
  if (cache.has(stage)) return cache.get(stage);
  const file = FILES[stage];
  if (!file) throw new Error(`שלב לא מוכר: ${stage}`);
  const p = extractPrompt(readFileSync(join(SPECS, file), 'utf8'), file);
  cache.set(stage, p);
  return p;
}

export function fill(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) =>
    k in vars ? (typeof vars[k] === 'string' ? vars[k] : JSON.stringify(vars[k], null, 2)) : ''
  );
}

export function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const s = body.indexOf('{');
  const e = body.lastIndexOf('}');
  if (s < 0 || e <= s) throw new Error('לא נמצא JSON בתשובה');
  return JSON.parse(body.slice(s, e + 1));
}
