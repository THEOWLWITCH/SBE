// שפה של הזמנה, לא של חובה (07/10/2026) — כלל של Begood לכל המערכת. מקור אמת יחיד:
//  - rule: הכלל למודל. השרת מוסיף אותו לכל קריאה למודל (getProvider ב-harness/lib/providers.mjs),
//    כך שכל הכלים מקבלים אותו — פרקטי, נוגי, ננה, תכנון שיחה ופעילות, משוב לעבודות, הסימולציות ועוד.
//  - apply(system): מוסיף את הכלל להנחיה (מחרוזת או מערך בלוקים), פעם אחת בלבד.
//  - WORDS / find(text): המילים שנמנעים מהן, לבדיקות.
// אף אחד לא צריך ולא חייב: מציעים, רוצים, מבקשים, מזמינים.
// חריגים: דמויות בסימולציה ובתרחיש מדברות בקולן הטבעי; "חובת דיווח" הוא מונח קבוע.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SBE_INVITE = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const WORDS = ['צריך', 'צריכה', 'צריכים', 'צריכות', 'חייב', 'חייבת', 'חייבים', 'חייבות', 'חובה', 'מוכרח', 'מוכרחה', 'מוכרחים', 'אסור'];
  const TITLE = 'שפה של הזמנה, לא של חובה';
  const rule = TITLE + ' — כלל של Begood לכל תוצר: בכל הנחיה, משוב, המלצה, הסבר, סיכום והודעה שאת כותבת, ובכל משפט לדוגמה שמוצע למשתמש/ת לומר או לכתוב — אל תשתמשי במילים "צריך", "צריכה", "צריכים", "חייב/ת", "חייבים", "חובה", "מוכרחים" או "אסור". אף אחד לא צריך ולא חייב. נסחי כהצעה, כרצון, כבקשה או כהזמנה: "אפשר...", "אני מציעה...", "כדאי לנסות...", "מה דעתך ל...", "הייתי רוצה...", "אני מבקשת...", "אני מזמינה אתכם...". הכלל חל גם על מה שאת כותבת על אחרים (למשל "המורה יכולה..." ולא "המורה צריכה..."). חריגים: דמויות בסימולציה או בתרחיש מדברות בקולן הטבעי — אל תשני דיבור או ציטוט של דמות; והמונח "חובת דיווח" נשאר כמות שהוא — כשיש חובת דיווח אומרים זאת בבהירות.';
  function apply(system) {
    if (Array.isArray(system)) {
      if (system.some(b => b && typeof b.text === 'string' && b.text.includes(TITLE))) return system;
      return system.concat([{ type: 'text', text: rule }]);
    }
    const s = typeof system === 'string' ? system : '';
    if (s.includes(TITLE)) return s;
    return s ? s + '\n\n' + rule : rule;
  }
  const RE = new RegExp('(^|[^\\u0590-\\u05FF])([ולשהמכב]{0,3})(' + WORDS.join('|') + ')(?=$|[^\\u0590-\\u05FF])', 'g');
  // מוצא את המילים בטקסט (בלי "חובת דיווח"), לבדיקות ולתיעוד
  function find(text) {
    const out = []; const t = String(text || '').replace(/חובת (ה)?דיווח/g, '');
    let m; RE.lastIndex = 0;
    while ((m = RE.exec(t))) out.push(m[3]);
    return out;
  }
  return { WORDS, TITLE, rule, apply, find };
});
