// הסוכנת-הלקוחה בכל הכלים (09/10/2026: "הסוכנת תרוץ אוטומטית גם בשאר הכלים").
// כל קריאה ל-/api/complete שמסומנת customerReview:true (רק קריאות שמפיקות תוצר, לא שיחות ולא דברי דמויות):
//  1. הסוכנת קוראת את התוצר כמו מי שתשתמש בו (app/lib/customer-review.js) ומחזירה מה לא ברור.
//  2. אם משהו לא ברור, המודל מתקן פעם אחת, באותו מבנה ובאותו פורמט בדיוק.
//  3. התיקון נכנס רק אם הוא תקין: לא ריק, ובתוצר JSON — JSON תקין עם אותם שדות עליונים. אחרת חוזר התוצר המקורי.
// כל כשל של הסוכנת (מודל לא זמין, תשובה לא תקינה) לא עוצר את התוצר. CUSTOMER_REVIEW=off מכבה.
import { createRequire } from 'node:module';
const CUSTOMER = createRequire(import.meta.url)('../../app/lib/customer-review.js');

const MAX_PRODUCT = 60000, MAX_REQUEST = 8000;

function contentText(c) {
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) return c.map((p) => (p && typeof p.text === 'string' ? p.text : p && p.type ? '[' + p.type + ']' : '')).join('\n');
  return '';
}
// האובייקט הראשון השלם, גם כשאחריו יש עוד טקסט
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
export function jsonOf(text) {
  const x = String(text || '');
  for (let i = x.indexOf('{'); i >= 0; i = x.indexOf('{', i + 1)) {
    const end = balancedEnd(x, i);
    if (end < 0) continue;
    try { const v = JSON.parse(x.slice(i, end + 1)); if (v && typeof v === 'object' && !Array.isArray(v)) return v; } catch {}
  }
  return null;
}
export function reviewEnabled(payload) {
  return !!(payload && payload.customerReview) && process.env.CUSTOMER_REVIEW !== 'off';
}

// provider.complete({system, messages, maxTokens, variation}) → {text}
export async function customerPass(provider, { system, messages, maxTokens, text }) {
  const msgs = Array.isArray(messages) && messages.length ? messages : [{ role: 'user', content: '' }];
  const request = msgs.filter((m) => m.role === 'user').map((m) => contentText(m.content)).join('\n\n').slice(0, MAX_REQUEST);
  const asJson = jsonOf(text);
  let review = null;
  try {
    const r = await provider.complete({
      system: CUSTOMER.system,
      messages: [{ role: 'user', content: 'מה ביקשתי (הקלט):\n' + request + '\n\nהתוצר שקיבלתי' +
        (asJson ? ' (מגיע כנתונים: שמות השדות הם הכותרות שיופיעו בתוצר)' : '') + ':\n' + String(text).slice(0, MAX_PRODUCT) }],
      variation: 'low', maxTokens: 4000,
    });
    const v = jsonOf(r.text);
    if (v && typeof v.ready === 'boolean' && Array.isArray(v.issues)) review = { ready: v.ready, summary: String(v.summary || ''), issues: v.issues.slice(0, 8) };
  } catch { return { text, review: null }; }
  if (!review || review.ready || !review.issues.length) return { text, review: review && { ...review, revised: false } };
  // תיקון ממוקד (11/10/2026: "ההפקה מתבצעת כבר 10 דקות"): במקום לכתוב את כל התוצר מחדש (פי שניים זמן),
  // המודל מחזיר עריכות {find, replace} לפי ההערות, והן מוחלות כאן. ב-JSON רק בתוך ערכי טקסט, כך שהמבנה לא נשבר.
  try {
    const r = await provider.complete({
      system: CUSTOMER.fixSystem,
      messages: [{ role: 'user', content: CUSTOMER.fixRequest(String(text).slice(0, MAX_PRODUCT), review.issues, request) }],
      variation: 'low', maxTokens: 4000,
    });
    const v = jsonOf(r.text);
    const edits = v && Array.isArray(v.edits) ? v.edits : [];
    const { text: fixed, applied } = applyTextEdits(String(text), edits, !!asJson);
    if (!applied) return { text, review: { ...review, revised: false } };
    if (asJson) {
      const o = jsonOf(fixed);
      if (!o || Object.keys(asJson).some((k) => !(k in o))) return { text, review: { ...review, revised: false } };
    }
    return { text: fixed, review: { ...review, revised: true, applied } };
  } catch { return { text, review: { ...review, revised: false } }; }
}

// מחילה עריכות על התוצר. JSON: בערכי הטקסט בלבד (המופע הראשון), ומחזירה JSON תקין. טקסט: החלפה של המופע הראשון.
export function applyTextEdits(text, edits, asJson) {
  const norm = (t) => String(t == null ? '' : t).replace(/\s+/g, ' ').trim();
  const list = (edits || []).map((e) => ({ find: norm(e && e.find), rep: norm(e && e.replace) }))
    .filter((e) => e.find.length >= 3 && e.find !== e.rep).slice(0, 16);
  let applied = 0;
  if (asJson) {
    const start = text.indexOf('{'); const end = start >= 0 ? balancedEnd(text, start) : -1;
    let obj; try { obj = JSON.parse(text.slice(start, end + 1)); } catch { return { text, applied: 0 }; }
    for (const e of list) {
      let done = false;
      const walk = (x) => {
        if (done || !x || typeof x !== 'object') return;
        for (const k of Object.keys(x)) {
          if (done) return;
          const val = x[k];
          if (typeof val === 'string') {
            const t = val.replace(/\s+/g, ' '); const i = t.indexOf(e.find);
            if (i >= 0) { x[k] = t.slice(0, i) + e.rep + t.slice(i + e.find.length); done = true; applied++; }
          } else walk(val);
        }
      };
      walk(obj);
    }
    return { text: applied ? JSON.stringify(obj) : text, applied };
  }
  let out = text;
  for (const e of list) {
    const i = out.indexOf(e.find);
    if (i >= 0) { out = out.slice(0, i) + e.rep + out.slice(i + e.find.length); applied++; }
  }
  return { text: out, applied };
}
