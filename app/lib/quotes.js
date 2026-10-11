// מרכאות אחידות בעברית (11/10/2026: "בעברית לא להשתמש במרכאות למטה ולמעלה. שים לב שיש פעמיים מרכאות. לתקן בכל התוצרים").
// fix(s): „ “ ” ‟ « » ומרכאות עבריות (״ ″) סביב ציטוט הופכות ל-" רגילות; גרשיים בתוך מילה (ד״ר, צה״ל) נשארים;
// ומרכאות כפולות ("") הופכות לאחת. text(t): גם כשבתשובה יש JSON, מתקן רק בתוך ערכי הטקסט, כך שהמבנה לא נשבר.
// בשימוש בשרת לכל תשובה של המודל (getProvider ב-harness/lib/providers.mjs), ובמסכים לפני הוספת מרכאות.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SBE_QUOTES = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const HEB = 'א-ת';
  const GERSH = new RegExp('(?<![' + HEB + '])[״″]|[״″](?![' + HEB + '])', 'g');
  function fix(s) {
    if (typeof s !== 'string' || !s) return s;
    return s
      .replace(/[„“”‟«»❝❞〝〞]/g, '"')
      .replace(GERSH, '"')
      .replace(/"{2,}/g, '"');
  }
  function deep(x) {
    if (typeof x === 'string') return fix(x);
    if (Array.isArray(x)) return x.map(deep);
    if (x && typeof x === 'object') { const o = {}; for (const k of Object.keys(x)) o[k] = deep(x[k]); return o; }
    return x;
  }
  function balancedEnd(x, i) {
    let depth = 0, str = false, esc = false;
    for (let j = i; j < x.length; j++) {
      const c = x[j];
      if (str) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') str = false; continue; }
      if (c === '"') str = true;
      else if (c === '{' || c === '[') depth++;
      else if (c === '}' || c === ']') { depth--; if (depth === 0) return j; }
    }
    return -1;
  }
  function text(t) {
    if (typeof t !== 'string' || !t) return t;
    const i = t.search(/[{[]/);
    if (i >= 0) {
      const end = balancedEnd(t, i);
      if (end > i) {
        try {
          const v = JSON.parse(t.slice(i, end + 1));
          if (v && typeof v === 'object') return fix(t.slice(0, i)) + JSON.stringify(deep(v)) + fix(t.slice(end + 1));
        } catch (e) { /* לא JSON: טקסט רגיל */ }
      }
      // נראה כמו JSON שלא נקרא: לא נוגעים, כדי לא לשבור אותו יותר
      if (/^\s*[{[]/.test(t)) return t;
    }
    return fix(t);
  }
  // "מה אומרים": עוטפים במרכאות פעם אחת בלבד
  function wrap(s) { const b = fix(String(s || '')).trim().replace(/^"+|"+$/g, '').trim(); return b ? '"' + b + '"' : ''; }
  return { fix, deep, text, wrap };
});
