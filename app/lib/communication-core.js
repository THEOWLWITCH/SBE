(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SBE_COMMUNICATION = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const VERSIONS = Object.freeze({ tool: '1.0.0', prompt: '1.0.0', principles: '18-1.0.0', schema: 1 });
  const PRINCIPLES = Object.freeze([
    'גוף ראשון רבים ליצירת שייכות, כשיש בסיס משותף אמיתי',
    'מסר מרגיע עם הזמנה לפעולה אפשרית',
    'ניהול אחראי: מה נעשה ומה מתוכנן, לפי המידע שנמסר',
    'קשר בין הפרט לקהילה, כשזה רלוונטי',
    'סיפורים ודימויים מקומיים רק על בסיס עובדות שנמסרו',
    'הומור עדין רק כשהוא מתאים להקשר',
    'דמויות ומקומות מוכרים רק כשהפרטים אומתו והשימוש אושר',
    'הזמנה להשתתפות, לשיתוף פעולה ולמעורבות',
    'שפה פשוטה, נגישה ומקצועית',
    'סיום בונה ומעורר תקווה, כשההקשר מאפשר זאת',
    'הבחנה בין שליטה, השפעה ואחריות מקצועית',
    'יוזמה מעשית לפני שהבעיה מסלימה',
    'מנהיגות אמפתית ומשתפת: הבנת הצרכים ותכנון משותף',
    'זיהוי משאבים וחסמים בלי להמציא מידע',
    'השקעה מציאותית בהווה למוכנות ולחוסן בהמשך',
    'הנחיה ברורה עם צעדים שאפשר לבצע',
    'אחריות, תזמון ומעקב לפי ההסכמות שנמסרו',
    'למידה, התאמה ושיפור של מיומנויות אישיות ומשותפות'
  ]);
  const STATUSES = Object.freeze({ active: 'פעיל', awaiting_response: 'ממתין לתגובה', meeting_proposed: 'הוצעה פגישה', resolved: 'הסתיים', archived: 'בארכיון' });
  const KINDS = Object.freeze({ received: 'הודעה שהתקבלה', sent: 'הודעה שנשלחה', draft: 'טיוטת BE GOOD', note: 'החלטה או הערה', summary: 'סיכום BE GOOD', analysis: 'הצעת BE GOOD' });
  const ACTIONS = Object.freeze({ suggest: 'הציעי תשובה', continue: 'המשך השיחה', understand: 'נתחי את מצב השיח', next: 'הציעי דרך פעולה', boundaries: 'הציבי גבולות', summarize: 'סיכום השיחה', close: 'סיום השיחה' });
  const REVISIONS = Object.freeze({ shorter: 'קצר יותר', warmer: 'חם יותר', assertive: 'אסרטיבי יותר', formal: 'רשמי יותר', empathetic: 'אמפתי יותר', boundaries: 'גבולות ברורים יותר', another: 'גרסה נוספת' });
  return Object.freeze({ VERSIONS, PRINCIPLES, STATUSES, KINDS, ACTIONS, REVISIONS });
});
