// תרגול חי מול המודל לגרסה שאושרה (9 באוקטובר 2026): פעילות או שיחה.
// בפעילות המודל משחק את הקבוצה, ובשיחה את הצד השני. בסוף: משוב קצר בלי ציון ובלי שיפוט של אדם.
// מקור אמת יחיד לדפדפן (app/lib/artifact-practice.js) ולבדיקות (harness/tests/rehearsal-model.test.mjs):
//  - MAX_TURNS: כמה תורות של המתרגלת לפני שמציעים לסיים.
//  - contentText(content, kind, stepId): הגרסה המאושרת כטקסט קצר למודל (בלי המסמך ובלי חששות פרטיים). ברצף: רק המפגש של השלב.
//  - turnSystem(kind, content, stepId): ההנחיה למודל בזמן התרגול.
//  - feedbackSystem(kind, content, stepId): ההנחיה למשוב בסוף.
//  - transcript(turns): השיחה כטקסט, למשוב ולהדפסה.
// השרת מוסיף לכל קריאה את השפה של הזמנה, הניסוח הפשוט, בחירה ואחריות ואי־שיפוטיות (getProvider).
// התרגול הוא שיחה עם דמויות, ולכן לא עובר דרך הסוכנת-הלקוחה.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SBE_REHEARSAL = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const MAX_TURNS = 6;
  const LIMIT = 6000;
  const FIELD_LABELS = {
    activity: { age: 'גיל המשתתפים', domain: 'תחום', duration: 'משך', groupStyle: 'אופי הקבוצה', specialNotes: 'הערות מיוחדות', outcome: 'התוצר', resources: 'משאבים' },
    conversation: { myself: 'מי אני בשיחה', otherParty: 'הצד השני', otherPerspective: 'נקודת המבט של הצד השני', relationshipHistory: 'הקשר עד היום',
      eventHistory: 'מה קרה עד עכשיו', meetingLogistics: 'איפה ומתי', challenges: 'מה עלול להיות קשה', productType: 'סוג השיחה' },
    sequence: { topic: 'נושא הרצף', audience: 'קהל היעד', ageRange: 'גילאים', participants: 'מספר משתתפים', space: 'מרחב', framework: 'מסגרת' }
  };
  function str(v) {
    if (v == null) return '';
    if (Array.isArray(v)) return v.map(str).filter(Boolean).join(', ');
    if (typeof v === 'object') return Object.values(v).map(str).filter(Boolean).join(', ');
    return String(v).trim();
  }
  function cut(t, n) { t = String(t || ''); return t.length > n ? t.slice(0, n) + '…' : t; }
  // ברצף מפגשים נשלח רק המפגש שמתרגלים (לפי השלב שנבחר), עם היעד והתוצר שלו.
  function contentText(content, kind, stepId) {
    content = content || {};
    const k = kind || content.kind;
    const chosen = k === 'sequence' ? stepOf(content, stepId) : null;
    const steps = chosen ? (content.steps || []).filter((s) => s.session === chosen.session) : (content.steps || []);
    const L = [];
    const add = (label, v) => { const t = str(v); if (t) L.push(label + ': ' + cut(t, 900)); };
    add(k === 'conversation' ? 'מטרת השיחה' : k === 'sequence' ? 'מטרות הרצף' : 'מטרת הפעילות', content.purpose);
    const labels = FIELD_LABELS[k] || {};
    Object.keys(labels).forEach((f) => add(labels[f], content.fields && content.fields[f]));
    if (k !== 'conversation') {
      add('רכיבי החוסן', content.resilienceComponents);
      add('מיומנויות אישיות', content.individualSkills);
      add('מיומנויות משותפות', content.sharedSkills);
      add('המנגנון החברתי', content.socialMechanism);
    }
    add(k === 'conversation' ? 'הנחיה לשיחה' : 'הנחיה למנחה', content.facilitatorGuide);
    if (chosen) {
      const info = (content.sessions || []).find((x) => x.n === chosen.session) || {};
      add('המפגש שמתרגלים', 'מפגש ' + chosen.session + ' מתוך ' + (content.sessions || []).length);
      add('היעד של המפגש', info.goal); add('התוצר של המפגש', info.product);
    }
    steps.forEach((s) => add('שלב "' + s.title + '"' + (s.phase && s.phase !== s.title ? ' (' + s.phase + ')' : ''), s.instructions));
    return cut(L.join('\n'), LIMIT);
  }
  function stepOf(content, stepId) { return ((content && content.steps) || []).find((s) => s.id === stepId) || null; }
  function stepLine(content, stepId) {
    const s = stepOf(content, stepId);
    return s ? 'השלב שמתרגלים: "' + s.title + '"' + (s.session ? ' במפגש ' + s.session : '') + '. מה כתוב בו: ' + cut(s.instructions, 900) : 'מתרגלים את כל המהלך מההתחלה.';
  }
  function turnSystem(kind, content, stepId) {
    const common = [
      '- בתור הראשון: הציגי את הרגע עצמו, מה קורה עכשיו, בלי הקדמה ובלי להסביר את התרגול.',
      '- כל תור קצר: עד 70 מילים. אל תצאי מהדמות ואל תתני עצות בזמן התרגול.',
      '- בלי תוכן פוגעני, בלי אלימות מפורטת ובלי פרטים מזהים. שמות בדויים בלבד. נושא כואב מוצג בעדינות וברמז.',
      '- אם המתרגלת כותבת שהיא רוצה לעצור, עצרי מיד ואמרי במשפט אחד שאפשר לחזור לתרגל בכל רגע.'
    ];
    if (kind === 'conversation') {
      return [
        'מצב תרגול לשיחה אישית. את משחקת את הצד השני בשיחה, כדי שאשת החינוך תתרגל את השיחה שתכננה ואישרה.',
        'הגרסה שאושרה:\n' + contentText(content, 'conversation'),
        stepLine(content, stepId),
        'כללי המשחק:',
        '- דברי כמו הצד השני באמת: בגוף ראשון, בשפה טבעית, עם רגשות ועם מה שחשוב לו או לה. בלי שם התפקיד לפני הדברים. אפשר תיאור קצר בסוגריים של מה שקורה, למשל (שותקת, מסתכלת על השעון).',
        '- אל תהיי קלה מדי, אבל הגיבי בכנות: הקשבה, שיקוף, שאלה פתוחה והצעה ("אני מציעה ש... מה דעתך?") פותחים את השיחה בהדרגה; האשמה, הרצאה או "למה" סוגרים אותה.'
      ].concat(common).join('\n');
    }
    return [
      'מצב תרגול למפגש קבוצתי. את משחקת את הקבוצה, כדי שהמנחה תתרגל את הפעילות שתכננה ואישרה.',
      'הגרסה שאושרה:\n' + contentText(content, kind === 'sequence' ? 'sequence' : 'activity', stepId),
      stepLine(content, stepId),
      'כללי המשחק:',
      '- בכל תור 1 עד 3 משתתפים מגיבים, כל אחד בשורה משלו: **שם בדוי**: מה הוא או היא אומרים. שמות פשוטים שמתאימים לגיל. אפשר תיאור קצר בסוגריים של מה שקורה בחדר, למשל (שתיקה, שניים לוחשים).',
      '- דברו כמו קבוצה אמיתית בגיל הזה: קצר וטבעי, לפעמים מתחמקים או מתנגדים. הגיבו בכנות למהלכי ההנחיה: שאלה פתוחה, שיקוף, הזמנת קול, זמן המתנה ובחירה פותחים את הקבוצה בהדרגה; הרצאה, שיפוט או "למה" סוגרים אותה.'
    ].concat(common).join('\n');
  }
  function feedbackSystem(kind, content, stepId) {
    const conv = kind === 'conversation';
    return [
      'התרגול הסתיים. צאי מהדמות. קראי את התרגול וכתבי משוב קצר ' + (conv ? 'לאשת החינוך שתרגלה את השיחה.' : 'למנחה שתרגלה את המפגש.'),
      'המשוב מתייחס לפעולות ולמשפטים בתרגול, לא לאדם. בלי ציון ובלי דירוג. חם, מעשי וקצר: עד 160 מילים בסך הכול.',
      'ארבעה חלקים, כל אחד עם כותרת מודגשת בשורה נפרדת, בכותרות האלה בדיוק:',
      '**מה עבד**: שניים או שלושה מהלכים מהתרגול, עם ציטוט קצר של מה שנאמר.',
      '**מה אפשר לנסות בפעם הבאה**: מהלך אחד או שניים, לכל אחד משפט לדוגמה במירכאות.',
      conv ? '**מה זה מאפשר בקשר**: מה המהלכים האלה פותחים בקשר עם הצד השני ובהמשך השיחה.' : '**מה זה בונה בחוסן החברתי**: מה המהלכים האלה בונים בשייכות, באמון, בהשתתפות או במנגנון המשותף של הקבוצה.',
      (conv ? '**לפני השיחה האמיתית**' : '**לפני המפגש האמיתי**') + ': צעד אחד קטן שאפשר להכין, ושתי אפשרויות לבחירה כשאפשר.',
      'הגרסה שאושרה:\n' + contentText(content, kind, stepId),
      stepLine(content, stepId)
    ].join('\n');
  }
  function transcript(turns, kind) {
    const me = kind === 'conversation' ? 'אני' : 'המנחה';
    const other = kind === 'conversation' ? 'הצד השני' : 'הקבוצה';
    return (turns || []).map((t) => (t.role === 'user' ? me : other) + ': ' + t.content).join('\n\n');
  }
  return { MAX_TURNS, contentText, turnSystem, feedbackSystem, transcript };
});
