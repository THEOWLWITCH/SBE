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
function jsonOf(text) {
  const m = String(text || '').match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { const v = JSON.parse(m[0]); return v && typeof v === 'object' && !Array.isArray(v) ? v : null; } catch { return null; }
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
  try {
    const r = await provider.complete({
      system,
      messages: [...msgs, { role: 'assistant', content: String(text) },
        { role: 'user', content: CUSTOMER.reviseNote(review.issues) + '\nהחזירי את התוצר המלא והמתוקן, באותו מבנה ובאותו פורמט בדיוק' +
          (asJson ? ' (JSON תקין, עם אותם שדות), בלי טקסט נוסף.' : ', בלי הקדמה ובלי הסבר על התיקונים.') }],
      variation: 'medium', maxTokens: maxTokens || 4000,
    });
    const fixed = String(r.text || '').trim();
    if (!fixed) return { text, review: { ...review, revised: false } };
    if (asJson) {
      const v = jsonOf(fixed);
      if (!v || Object.keys(asJson).some((k) => !(k in v))) return { text, review: { ...review, revised: false } };
    }
    return { text: fixed, review: { ...review, revised: true } };
  } catch { return { text, review: { ...review, revised: false } }; }
}
