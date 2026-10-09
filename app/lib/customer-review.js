// הסוכנת-הלקוחה של Begood (08/10/2026: "בנה סוכן שהוא הלקוח ותפקידו לוודא שהתוצר מובן ועונה לציפיות הלקוח").
// קוראת תוצר כמו מי שתשתמש בו מחר בבוקר: מחנכת, מנחה או רכזת, בלי הסברים נוספים ובלי לשאול אף אחד.
// מחזירה מה לא ברור ומה חסר, עם הצעה לתיקון. מקור אמת יחיד לדפדפן ולשרת:
//  - system: ההנחיה לסוכנת.
//  - schema: מבנה התשובה (JSON) — ready, summary, issues[{where, quote, problem, fix}].
//  - reviseNote(issues): ההנחיה לגרסה מתוקנת (בסטודיו, אחרי שהסוכנת מצאה בעיות).
//  - textOf(node|html): הטקסט של תוצר לקריאה (בדפדפן).
// שימוש: סטודיו חוסן בודק כל ערכה ומתקן פעם אחת (harness/lib/studio.mjs); במעבדת הדמו "🧐 בדיקת הלקוחה" לכל תוצר.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SBE_CUSTOMER = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const CHECKS = [
    ['כותרת ותוכן', 'התוכן שמתחת לכל כותרת, ובכל תא בטבלה, עונה בדיוק על הכותרת ועל כותרת העמודה.'],
    ['הנחיה שאפשר לבצע', 'בכל הנחיה ברור מי עושה, מה עושים, עם מה, ומה יוצא בסוף.'],
    ['מטרה', 'מטרה היא משפט קצר אחד של פעולה ותוצר, ולא רשימת מושגים.'],
    ['שאלות', 'לכל שאלה או רשימת שאלות ברור מתי שואלים, מי שואל את מי, ובשביל מה. כל שאלה מובנת בלי הסבר נוסף.'],
    ['מהלך', 'במפגש או בפעילות ברור המהלך: פתיחה, פעילות מרכזית, סיכום, ומה קורה אחרי המפגש.'],
    ['פערי מידע', 'אין מילים או הפניות שהקוראת לא יכולה להבין בלי מידע שלא נמסר (למשל "הדף", "התרומה", "הכיתה הבדויה" בלי שהוסבר מה הם).'],
    ['ניסוח', 'עברית פשוטה ויומיומית, משפטים מלאים, בלי מונחים מופשטים ובלי ניסוחים מליציים.'],
    ['מענה לבקשה', 'התוצר עונה למה שהתבקש בקלט: לקהל, לגיל, לזמן, למטרה ולתנאים שנמסרו.']
  ];
  const system = [
    'את הלקוחה של Begood: מחנכת, מנחה או רכזת שקיבלה את התוצר הזה ותשתמש בו מחר בבוקר. אין לך את מי לשאול. קראי אותו מההתחלה ועד הסוף כמו שהוא.',
    'התפקיד שלך: לוודא שהתוצר מובן, שאפשר לעבוד איתו בלי לנחש, ושהוא עונה למה שביקשתי. את לא כותבת את התוצר מחדש ולא שופטת את מי שכתב אותו.',
    'בדקי:',
    CHECKS.map((c, i) => (i + 1) + '. ' + c[0] + ': ' + c[1]).join('\n'),
    'לכל בעיה: where (איפה בתוצר, לפי הכותרת), quote (ציטוט קצר ומדויק מהתוצר), problem (מה לא ברור או חסר, מנקודת המבט שלך כלקוחה, במשפט אחד), fix (ניסוח מוצע או מה להוסיף, קצר ומעשי).',
    'כתבי רק בעיות אמיתיות שיפריעו לך לעבוד, לפי סדר חשיבות, עד 8. בלי הערות על עיצוב, בלי מחמאות ובלי חזרות.',
    'ready = true רק כשאין בעיה שתפריע לעבוד עם התוצר. summary: משפט אחד, מה הרושם הכללי שלך כלקוחה.',
    'החזירי אך ורק JSON: {"ready":true,"summary":"","issues":[{"where":"","quote":"","problem":"","fix":""}]}'
  ].join('\n\n');
  const S = { type: 'string' };
  const schema = { type: 'object', additionalProperties: false, required: ['ready', 'summary', 'issues'], properties: {
    ready: { type: 'boolean' }, summary: S,
    issues: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['where', 'quote', 'problem', 'fix'],
      properties: { where: S, quote: S, problem: S, fix: S } } } } };
  function reviseNote(issues) {
    return 'הלקוחה קראה את הגרסה הקודמת ומצאה את הבעיות האלה. תקני בדיוק אותן, ושמרי את כל השאר כפי שהוא: אותו מבנה, אותו תוכן, אותם מקורות ואותם מזהים. ' +
      (issues || []).map((x, i) => (i + 1) + '. ' + [x.where, x.problem, x.fix && ('הצעה: ' + x.fix)].filter(Boolean).join(' · ')).join(' ');
  }
  function textOf(x) {
    if (x == null) return '';
    if (typeof x === 'string') {
      if (typeof DOMParser === 'undefined') return x.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, ' ').replace(/<(br|\/p|\/li|\/tr|\/h\d|\/div)[^>]*>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
      const d = new DOMParser().parseFromString(x, 'text/html'); d.querySelectorAll('style,script,img').forEach((n) => n.remove()); x = d.body;
    }
    // טבלה: כל שורה עם כותרות העמודות, כדי שהסוכנת תראה איזה תוכן נמצא מתחת לאיזו כותרת
    const out = [];
    const walk = (n) => {
      if (n.nodeType === 3) { const t = n.textContent.replace(/\s+/g, ' ').trim(); if (t) out.push(t); return; }
      if (n.nodeType !== 1) return;
      const tag = n.tagName;
      if (tag === 'TABLE') {
        const heads = [...n.querySelectorAll('thead th')].map((h) => h.textContent.trim());
        n.querySelectorAll('tbody tr, :scope > tr').forEach((tr) => {
          const cells = [...tr.children];
          out.push('\n' + cells.map((c, i) => {
            const label = heads.length && cells.length === heads.length ? heads[i] : (c.tagName === 'TH' ? '' : (c.getAttribute('data-label') || ''));
            const t = c.textContent.replace(/\s+/g, ' ').trim();
            return label ? '[' + label + '] ' + t : (c.tagName === 'TH' ? '## ' + t : t);
          }).join(' | '));
        });
        return;
      }
      if (/^H[1-4]$/.test(tag)) { out.push('\n# ' + n.textContent.trim()); return; }
      n.childNodes.forEach(walk);
      if (/^(P|LI|DIV|BR|SECTION)$/.test(tag)) out.push('\n');
    };
    walk(x);
    return out.join(' ').replace(/ *\n */g, '\n').replace(/\n{2,}/g, '\n').trim();
  }
  return { CHECKS, system, schema, reviseNote, textOf };
});
