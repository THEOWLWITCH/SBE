// תרגול עצמי על מקרה משלך (10/10/2026: "מקום להקליד את המקרה עליו רוצים להתאמן, כשהתרגול אינו על תרחיש שקיים במאגר.
// המערכת תשאל כמה שאלות בסיסיות והכרחיות כדי שהמודל ידע על מה מדובר, ייווצר סיפור, המשתמשת תאשר ותתחיל להתאמן").
// שלושה שלבים: 1 מספרים על המקרה · 2 עונים על שאלות הבהרה (רק מה שחסר, עד ארבע) · 3 מאשרים את הסיפור ומתחילים.
// התוצר הוא תרחיש באותו מבנה בדיוק כמו SCENARIOS ב-practice.html, כך שמנוע התרגול והמשוב פועלים עליו בלי שינוי.
// שמות: לא משתמשים בשמות שהמשתמשת כתבה. הדמות מקבלת שם פרטי בדוי.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SBE_PCUSTOM = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const RED_LINE = 'קו אדום: גם במצבים מתוחים, אלימות מכל סוג, השפלה, זלזול או מניפולציה של סכום אפס אינם לגיטימיים.';
  const ROLES = ['מחנכת', 'מורה מקצועית', 'גננת', 'רכזת', 'יועצת', 'מנהלת', 'סטודנטית להוראה', 'הורה'];
  const OTHERS = ['הורה', 'תלמיד/ה', 'עמית/ה לצוות', 'מנהל/ת', 'סייעת', 'קבוצת הורים'];
  const arr = (x) => Array.isArray(x) ? x : [];
  const str = (x) => String(x == null ? '' : x).trim();

  function caseText(f) {
    return [['התפקיד שלי', f.role], ['מי מולי', f.other], ['המקרה', f.story], ['מה הייתי רוצה שיקרה בסוף השיחה', f.goal], ['מה מאתגר אותי בשיחה', f.hard]]
      .filter(([, v]) => str(v)).map(([k, v]) => k + ': ' + str(v)).join('\n') +
      (arr(f.answers).length ? '\n\nתשובות לשאלות ההבהרה:\n' + f.answers.filter((a) => str(a.a)).map((a) => '- ' + a.q + ' ' + str(a.a)).join('\n') : '');
  }

  function clarifySystem() {
    return [
      'את עוזרת לאשת חינוך לבנות תרגול של שיחה מאתגרת על מקרה שלה. היא תתאמן מול דמות שהמודל משחק.',
      'קראי את המקרה, ושאלי רק את מה שחסר באמת כדי לכתוב תרחיש אמין: מי הצד השני (תפקיד, קשר, גיל אם זה ילד/ה), מה קרה בפועל (רגע קונקרטי אחד), איפה ומתי השיחה מתקיימת, ומה היא רוצה שיקרה בסוף השיחה.',
      'אם כל זה כבר כתוב, החזירי רשימה ריקה. לכל היותר ארבע שאלות. כל שאלה קצרה, מובנת בלי הסבר, ובלשון פנייה לאישה. לכל שאלה שתיים עד ארבע תשובות אפשריות קצרות (options), ואפשר תמיד לכתוב אחרת.',
      'אל תשאלי על שמות, ואל תבקשי פרטים מזהים.',
      'החזירי אך ורק JSON במבנה: {"questions":[{"q":"","options":[""]}]}'
    ].join('\n\n');
  }

  const SHAPE = '{"name":"","subtitle":"","meta":{"age":"","conflictType":""},' +
    '"trainee":{"role":"","roleLabel":"","opening":[""]},' +
    '"actor":{"name":"","nameAndAge":"","roleLabel":"","gender":"","role":"","entrance":{"posture":"","doing":"","firstLine":""},"valve":"","wontSay":"",' +
    '"story":[""],"material":[["",""]],"hidden":[""],"knows":"","doesntKnow":"","trustCondition":"","speech":{"answerLength":"","whenLong":"","insteadOfAnswering":"","tic":""}},' +
    '"turningPoints":[{"n":1,"name":"","type":"פתיחה","trigger":"","does":{"line":"","stage":""},"missed":"","keywords":[""],' +
    '"branches":[{"move":"","effect":"פותח","quality":"מקדם","keywords":[""],"line":"","stage":""}]}],' +
    '"endings":["","","",""],"endingNotes":["","","",""],"skills":[{"text":"","keywords":[""]}]}';

  function buildSystem() {
    return [
      'את כותבת תרחיש לתרגול עצמי של שיחה מאתגרת, על מקרה שאשת חינוך סיפרה. היא המתנסה ("את"), והמודל ישחק את הדמות שמולה. התרחיש נכתב לפי המקרה שלה, בלי להוסיף עובדות שסותרות אותו ובלי דרמה מיותרת.',
      'שמות: אל תשתמשי באף שם שמופיע במקרה. לדמות שמולה תני שם פרטי בדוי ופשוט. למתנסה אין שם.',
      'החלקים:',
      '- name: כותרת קצרה לתרחיש, ציטוט או ביטוי מהשיחה. subtitle: משפט אחד: בין מי למי ועל מה.',
      '- meta.age: הגיל או השכבה, אם רלוונטי. meta.conflictType: אחד מ- ערכי / מבני / בין־אישי / מידע.',
      '- trainee: role (התפקיד שלה), roleLabel (מילה או שתיים), opening: שלוש עד חמש פסקאות קצרות בגוף שני ("את..."), מה שהיא יודעת לפני השיחה בלבד. הפסקה האחרונה: "כעת תיפגשי עם [שם הדמות] ב[מקום]. לרשותך חמש דקות."',
      '- actor: הדמות שמולה. role, roleLabel, gender, nameAndAge ("שם, גיל"), entrance (posture, doing, firstLine: המשפט הראשון שלה), story (שתי פסקאות בגוף שני: מה קרה מנקודת המבט שלה), material (שלוש שורות [תווית, תוכן]: השבוע שלה, מה ראתה או שמעה, איך היא מנסחת), hidden (שניים או שלושה רגשות או חששות שהיא לא אומרת), knows (מה היא יודעת שהמתנסה לא יודעת), doesntKnow (מה המתנסה יודעת והיא לא), trustCondition (מה המתנסה יכולה לעשות כדי שהיא תיפתח), valve (המשפט האמיתי שהיא תגיד רק בלחץ שלישי), wontSay (מה שלא תגיד לעולם), speech (answerLength, whenLong, insteadOfAnswering, tic: ביטוי חוזר).',
      '- turningPoints: בדיוק חמש תפניות, n מ-1 עד 5, בסדר הזה: 1 "פתיחה" (תפנית ליבה, עם שני ענפים: אחד "פותח" ו"מקדם", ואחד "מחזיק" ו"שגוי") · 2 "מותנה" (עם שני ענפים) · 3 "סגירה" (תפנית ליבה: מה שסוגר אותה, למשל הרגעה כללית או קפיצה לפתרון; בלי ענפים) · 4 "היפוך" (רק אחרי שתנאי האמון התקיים: היא מתגלה כאדם; בלי ענפים) · 5 "פתיחה עמוקה" (אחרי לחץ שלישי היא אומרת את ה-valve; בלי ענפים).',
      '  לכל תפנית: name (ציטוט קצר), trigger (מה המתנסה עושה), does.line (מה הדמות אומרת), does.stage (פעולה גופנית אחת או ריק), missed (מה קורה אם זה לא קורה), keywords (שלושה עד שישה ביטויים קצרים בעברית מדוברת שהמתנסה עשויה לכתוב). לכל ענף: move, effect (פותח / מחזיק / סוגר), quality (מקדם / שגוי / נכון אך כואב), keywords, line, stage.',
      '- endings: ארבעה סיומים אפשריים, מהטוב לפחות טוב (הסכמה על צעד · "אחשוב על זה" שסוגר · הסתייגות שהתרככה · פנייה לגורם אחר). endingNotes: ארבעה משפטים קצרים, משפט לכל סיום, מה הסיום אומר על השיחה, בלי לשפוט את המתנסה.',
      '- skills: חמש או שש מיומנויות שיחה שהמקרה הזה מזמין (למשל הכרה בנקודת מבט אחרת בלי לוותר על העמדה, שיקוף רגש, שאלה פתוחה, הבחנה בין עובדה לפרשנות, אמירה ברורה של מה אפשר לעשות), ולכל אחת keywords: שלושה עד חמישה ביטויים קצרים בעברית מדוברת.',
      'כתבי בעברית פשוטה, משפטים קצרים. המתנסה בלשון נקבה. החזירי אך ורק JSON במבנה הזה: ' + SHAPE
    ].join('\n\n');
  }
  function reviseSystem() {
    return buildSystem() + '\n\nעכשיו מעדכנים תרחיש קיים לפי בקשה של המתנסה. שני רק את מה שביקשה, ושמרי את השאר. החזירי את התרחיש המלא באותו מבנה.';
  }

  // השלמות קבועות, כדי שהמנוע יפעל גם אם המודל השמיט שדה טכני
  const TYPES = ['פתיחה', 'מותנה', 'סגירה', 'היפוך', 'פתיחה עמוקה'];
  const FIXED_SKILLS = [
    { text: 'החזקת שתיקה בלי מיהור למילויה', detectShort: true },
    { text: 'טון קול מותאם למצב', undetectable: true },
    { text: 'גוף פתוח ולא מתגונן', undetectable: true }
  ];
  function normalize(o) {
    if (!o || typeof o !== 'object') return o;
    const sc = JSON.parse(JSON.stringify(o));
    sc.redLine = RED_LINE;
    sc.meta = Object.assign({ lang: 'עברית' }, sc.meta || {}, { approach: 'המקרה שלי' });
    sc.trainee = Object.assign({ name: null }, sc.trainee || {}); sc.trainee.opening = arr(sc.trainee.opening).map(str).filter(Boolean);
    const a = sc.actor = sc.actor || {};
    a.name = str(a.name) || str(a.nameAndAge).split(',')[0];
    a.entrance = Object.assign({ posture: '', doing: '', firstLine: '' }, a.entrance || {});
    a.story = arr(a.story); a.hidden = arr(a.hidden); a.material = arr(a.material).filter((m) => Array.isArray(m) && m.length === 2);
    a.speech = a.speech || {};
    sc.turningPoints = arr(sc.turningPoints).slice(0, 5).map((tp, i) => {
      const t = Object.assign({}, tp, { n: i + 1, type: TYPES[i] });
      t.core = i === 0 || i === 2;
      t.keywords = arr(t.keywords).map(str).filter(Boolean);
      t.does = Object.assign({ line: '', stage: null }, t.does || {}); if (!str(t.does.stage)) t.does.stage = null;
      t.branches = (i < 2 ? arr(t.branches) : []).map((b) => Object.assign({}, b, { keywords: arr(b.keywords).map(str).filter(Boolean), stage: str(b.stage) || null }));
      if (i === 2) t.effect = 'סוגר';
      if (i === 3) { t.requiresTrust = true; t.effect = 'פותח'; }
      if (i === 4) { t.viaPressure = true; t.effect = 'פותח עמוק'; if (!t.does.line) t.does.line = a.valve || ''; }
      return t;
    });
    sc.endings = arr(sc.endings).slice(0, 4); sc.endingNotes = arr(sc.endingNotes).slice(0, 4);
    sc.skills = arr(sc.skills).filter((s) => s && str(s.text)).map((s) => ({ text: str(s.text), keywords: arr(s.keywords).map(str).filter(Boolean) }))
      .filter((s) => s.keywords.length).concat(FIXED_SKILLS);
    return sc;
  }
  function valid(o) {
    const sc = normalize(o);
    return !!(sc && str(sc.name) && sc.trainee.opening.length >= 2 && str(sc.actor.name) && str(sc.actor.entrance.firstLine) &&
      sc.turningPoints.length === 5 && sc.turningPoints.every((t) => str(t.trigger) && str(t.does.line)) &&
      sc.endings.length === 4 && sc.endingNotes.length === 4 && sc.skills.length > FIXED_SKILLS.length);
  }
  const validQuestions = (o) => !!(o && Array.isArray(o.questions));

  return { RED_LINE, ROLES, OTHERS, caseText, clarifySystem, buildSystem, reviseSystem, normalize, valid, validQuestions };
});
