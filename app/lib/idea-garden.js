// גן הרעיונות (26/10/2026): "המשחק ילווה את היוצר בפיתוח רעיון עד הוצאתו לפועל או החלטה שעדיף לגדל רעיון אחר.
// יותאם לחמש קבוצות גיל... בכל שלב - בוחנים את הרעיון ומחליטים על השלב הבא... הרעיון הוא לא אני...
// המערכת תיתן משוב בכל שלב - וניתן יהיה לנהל שיחה עם המערכת על המשוב וכדי להתייעץ. שניתן לה שם "גני"."
// מקור אמת: הגילים, השלבים, תיווך היתרונות והחסרונות, הפרומפטים של גני, בדיקת התשובות, ניקוי הציור, ואיורי הגינה.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SBE_IDEA = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------- גילים ----------
  // [מזהה, שם, תיאור קצר, איך גני מדברת]
  const AGES = [
    ['k', 'גן', 'מבוגר/ת קורא/ת עם הילדים ועוזר/ת לכתוב', 'ילדים בגן (4 עד 6). משפטים של 4 עד 8 מילים, מילים מוכרות, דימויים מהחצר ומהבית. בכל רשימה עד 2 פריטים. בלי מושגים מופשטים.'],
    ['a3', 'א׳ עד ג׳', 'כותבים לבד או עם מבוגר/ת', 'ילדים בכיתות א׳ עד ג׳. משפטים קצרים ופשוטים, דוגמאות מהכיתה ומהחברים. בכל רשימה עד 2 פריטים.'],
    ['d5', 'ד׳ עד ו׳', 'כותבים לבד, בזוג או בקבוצה', 'ילדים בכיתות ד׳ עד ו׳. משפטים ברורים, אפשר מושג אחד חדש עם הסבר קצר. בכל רשימה עד 3 פריטים.'],
    ['sec', 'על יסודי', 'כותבים לבד או בצוות', 'בני ובנות נוער (ז׳ עד י״ב). שפה ישירה ומכבדת, בלי הטפה, עם נימוק לכל נקודה. בכל רשימה עד 3 פריטים.'],
    ['pro', 'אנשי ונשות מקצוע', 'לבד או בצוות', 'מבוגרים ואנשי ונשות מקצוע. שפה מקצועית ותמציתית, שיקולים של משאבים, אנשים והשפעה. בכל רשימה עד 4 פריטים.'],
  ];
  const ageOf = (id) => AGES.find((a) => a[0] === id) || AGES[2];
  const KID = (age) => age === 'k' || age === 'a3';

  // מאיפה הרעיון מתחיל
  const SOURCES = [
    ['need', '🧩', 'מצורך', 'משהו חסר או מפריע'],
    ['spark', '✨', 'מהשראה', 'ראיתי או שמעתי משהו שהדליק אותי'],
    ['thought', '💭', 'ממחשבה', 'זה פשוט עלה לי בראש'],
  ];
  // איך הרעיון נראה: דבר ממשי, או דימוי
  const LOOKS = [
    ['thing', '🚗', 'משהו שאפשר לבנות או לראות', 'למשל: מכונית, גינה, משחק, פינה בכיתה'],
    ['image', '🦄', 'דימוי: למה הרעיון דומה', 'למשל: עקשן כמו פרד ויפה כמו נסיכה ורודה'],
  ];

  // ---------- השלבים: מזרע עד פרי ----------
  const STAGES = [
    { id: 'seed', icon: '🌰', name: 'זרע', title: 'שותלים את הרעיון', ask: 'מה הרעיון, מאיפה הוא בא ואיך הוא נראה' },
    { id: 'sprout', icon: '🌱', name: 'נבט', title: 'מה טוב ומה פחות', ask: 'יתרונות וחסרונות: למי, כמה זה חשוב, ואפשר לתקן?' },
    { id: 'guard', icon: '🪴', name: 'שתיל', title: 'שומרים שלא יפגע', ask: 'האם הרעיון עלול לפגוע במישהו או במשהו, ואיך מגינים' },
    { id: 'grow', icon: '🌿', name: 'צמח', title: 'מתכננים ומנסים בקטן', ask: 'מה נדרש, ניסיון ראשון קטן, ואיך נדע שזה עובד' },
    { id: 'fruit', icon: '🍎', name: 'פרי', title: 'יוצאים לדרך', ask: 'מחליטים: מוציאים לפועל, או מגדלים רעיון אחר' },
  ];

  // תיווך היתרונות והחסרונות: לא רשימה סתמית. לכל פריט: למי, כמה חשוב, ולחסרון: אפשר לתקן?
  const FOR_WHOM = [['me', 'לי'], ['friends', 'לחברים'], ['group', 'לכיתה או לקבוצה'], ['home', 'למשפחה'], ['nature', 'לטבע ולבעלי חיים'], ['all', 'לכולם']];
  const WEIGHT = [[1, '🌱', 'קצת'], [2, '🌿', 'בינוני'], [3, '🌳', 'מאוד']];
  const FIX = [['yes', 'אפשר לתקן'], ['maybe', 'אולי'], ['no', 'קשה לתקן']];
  // מי או מה עלול להיפגע
  const HARM = [
    ['me', '🙋', 'אני'], ['friends', '🧑‍🤝‍🧑', 'חברים'], ['people', '👥', 'אנשים אחרים'], ['feelings', '💛', 'רגשות של מישהו'],
    ['animals', '🐾', 'בעלי חיים'], ['nature', '🌍', 'טבע וסביבה'], ['things', '🏠', 'חפצים ומקומות'],
  ];
  // מה עושים עם המשוב
  const MOVES = [
    ['all', '🤩', 'מקבלים את כולו בהתלהבות'],
    ['some', '👍', 'מקבלים, עם הסתייגות'],
    ['part', '✋', 'מתנגדים לחלק ממנו'],
    ['no', '🙅', 'מתנגדים לו'],
    ['think', '🤔', 'רוצים לחשוב עליו'],
    ['consult', '🗣', 'רוצים להתייעץ עליו'],
    ['try', '🧪', 'מנסים בזהירות'],
  ];
  // ההחלטה בסוף כל שלב
  const DECIDE = [
    ['next', '🌿', 'ממשיכים לשלב הבא'],
    ['improve', '✏️', 'משפרים את הרעיון בשלב הזה'],
    ['other', '🍂', 'מגדלים רעיון אחר'],
  ];
  // שאלות עזר לכל שלב, לפי הגיל (תיווך)
  const PROMPTS = {
    seed: {
      kid: ['מה הרעיון שלך?', 'למי הוא יעזור או ישמח?', 'איך הוא נראה? למה הוא דומה?'],
      big: ['מה הרעיון, במשפט אחד?', 'איזה צורך או השראה הובילו אליו?', 'למי הוא מיועד, ומה ישתנה בזכותו?'],
    },
    sprout: {
      kid: ['מה הכי טוב ברעיון?', 'מה יכול להשתבש?', 'אם משהו משתבש, אפשר לתקן?'],
      big: ['מה היתרון החשוב ביותר, ולמי?', 'מה החיסרון שהכי מטריד, ולמה?', 'איזה חיסרון אפשר להפוך לשיפור?'],
    },
    guard: {
      kid: ['האם מישהו יכול להיעלב או להיפגע?', 'האם משהו יכול להישבר או להתלכלך?', 'איך שומרים על כולם?'],
      big: ['מי או מה עלול להיפגע, גם בלי כוונה?', 'מה יקרה אם הרעיון יצליח מאוד, ומה אם ייכשל?', 'איזו הגנה פשוטה אפשר להוסיף מראש?'],
    },
    grow: {
      kid: ['מה חסר בשביל הרעיון?', 'מה הדבר הקטן הראשון שאפשר לנסות?', 'איך נדע שזה עובד?'],
      big: ['אילו משאבים, אנשים וזמן נדרשים?', 'מה הניסוי הקטן והבטוח הראשון?', 'מה הסימן שהרעיון עובד, ומתי בודקים?'],
    },
  };

  // ---------- גני: הפרומפטים ----------
  const CORE = `את גני (מהמילה גן, שבו מגדלים צמחים): מלווה מגדלים ומגדלות של רעיונות במשחק "גן הרעיונות". את חמה, סקרנית, ישרה ומעודדת.
עקרונות:
1. הרעיון הוא לא האדם. מדברים תמיד על הרעיון, בגוף שלישי ("הרעיון", "הרעיון של [שם הרעיון]"), ואף פעם לא שופטים את מי שהגה אותו. ביקורת היא על הרעיון, וכך היא עוזרת לו לגדול.
2. כל משוב מתחיל במסגור: משפט אחד שאומר שזה משוב על הרעיון, ושהמטרה שלו לעודד ולהתקדם בדרך בטוחה.
3. תיווך ולא רשימה סתמית: כל נקודה קשורה לפרט מסוים מתוך הרעיון ומה שנכתב עליו, ואומרת למה זה חשוב.
4. בודקים בכל שלב אם הרעיון עלול לפגוע במישהו או במשהו (אנשים, רגשות, בעלי חיים, טבע, חפצים). אם כן, אומרים זאת בעדינות ובבירור, ומציעים איך לשנות את הרעיון כדי שלא יפגע. כשהרעיון מסוכן, מציעים לשנות כיוון או לגדל רעיון אחר, ולשתף מבוגר/ת.
5. שינוי הוא חלק מהגידול: מעודדים לנסות אפשרויות חדשות, לשפר, ולפעמים להחליט לגדל רעיון אחר. גם זו החלטה טובה, והרעיון הישן הופך לדשן לרעיון הבא.
6. התייעצות היא מיומנות: כשזה מועיל, מציעים עם מי אפשר להתייעץ על הרעיון: חבר/ה, הורה, מורה, או מומחה/ית בתחום של הרעיון (למשל נגר/ית, גנן/ת, ספרן/ית, מהנדס/ת, טבח/ית, מתכנת/ת). רק מומחים לתחום הרעיון, לא אנשי טיפול.
7. הבחירה תמיד בידי המגדלים: מציעים, לא מחליטים במקומם. בלי "צריך", "חייב" או "אסור".
8. פונים למגדלים בלשון רבים ("אתם", "הרעיון שלכם"), כך שזה מתאים לילד/ה, לנער/ה, למבוגר/ת ולקבוצה.`;

  const PICTURE = `ציור הרעיון (picture.svg): SVG פשוט ונקי, אלמנט <svg viewBox="0 0 240 200"> אחד, עם צורות בלבד (path, circle, ellipse, rect, polygon, line, g, ובתוך defs גם linearGradient או radialGradient). בלי טקסט, בלי תמונות ובלי סקריפטים. עד 40 צורות. צבעים רכים ושמחים, קו מתאר כהה וברור.
- כשהרעיון ממשי (מכונית, גינה, משחק, פינה בכיתה): ציור פשוט ומזוהה של הדבר.
- כשהרעיון מתואר בדימוי (למשל "עקשן כמו פרד ויפה כמו נסיכה ורודה"): דמות או צורה מופשטת שמבטאת את התכונות (למשל יצור עם רגליים נטועות בקרקע וכתר ורוד), עם פנים ידידותיות.
- בכל שלב הציור משתנה לפי מה שהשתנה ברעיון ובמשוב (למשל נוספה לו הגנה, הוא גדל, השתנו לו צבעים), ומשהו מהציור הקודם נשמר כדי שיהיה אפשר לזהות אותו.
picture.caption: משפט קצר שמתאר את הציור. picture.changed: משפט קצר על מה השתנה ברעיון מאז הציור הקודם (בשלב הראשון: ריק).`;

  function feedbackSystem(age) {
    const a = ageOf(age);
    return `${CORE}

הקהל: ${a[3]}

עכשיו המגדלים סיימו שלב בגידול הרעיון, ואת נותנת משוב על הרעיון. המשוב בחמישה חלקים:
- strengths: יתרונות וחוזקות של הרעיון.
- risks: חסרונות וסכנות.
- improve: מה כדאי לשפר.
- think: על מה כדאי לחשוב.
- notice: למה כדאי לשים לב בהמשך.
כל פריט הוא משפט אחד או שניים, קשור לפרט מהרעיון. במבנה: frame (משפט המסגור), החלקים, consult (עם מי אפשר להתייעץ ולמה, רשימה ריקה כשאין צורך), question (שאלה אחת שמזמינה לחשוב או להמשיך), ו-picture.

${PICTURE}

החזירי רק JSON:
{"frame":"...","strengths":["..."],"risks":["..."],"improve":["..."],"think":["..."],"notice":["..."],"consult":[{"who":"...","why":"..."}],"question":"...","picture":{"svg":"<svg ...>...</svg>","caption":"...","changed":"..."}}`;
  }

  function chatSystem(age) {
    const a = ageOf(age);
    return `${CORE}

הקהל: ${a[3]}

עכשיו זו שיחה: המגדלים מדברים איתך על המשוב או מתייעצים על הרעיון. עני בקצרה (${KID(age) ? 'עד 50 מילים' : 'עד 110 מילים'}), בטקסט רגיל בלי כותרות ובלי כוכביות. הקשיבי למה שהם אומרים, גם כשהם לא מסכימים עם המשוב: אי הסכמה מנומקת היא מיומנות טובה. אפשר לשאול שאלה אחת בסוף. לא מחליטים במקומם.`;
  }

  function summarySystem(age) {
    const a = ageOf(age);
    return `${CORE}

הקהל: ${a[3]}

המגדלים סיימו את הגידול: יצאו לדרך עם הרעיון, או החליטו לגדל רעיון אחר. כתבי משוב מסכם בשני חלקים: על התוצר (הרעיון כפי שהוא עכשיו) ועל הדרך כולה (איך גידלו אותו).
בדרך: חזקי מי שהתייעץ הרבה, אבל לא יותר מדי (התייעצות שעוזרת להחליט, לא במקום להחליט); מי שניסה אפשרויות חדשות ושינה את הרעיון; מי שהגיב למשוב בדרכים שונות, גם כשהתנגד לו בנימוק. אם החליטו לגדל רעיון אחר, זו החלטה אמיצה: אמרי מה הרעיון השאיר להם.
על פעולות, לא על האדם. בלי ציונים.
החזירי רק JSON:
{"frame":"...","product":{"strengths":["..."],"next":["..."]},"path":{"consult":"...","trying":"...","feedback":"..."},"cheer":"...","picture":{"svg":"<svg ...>...</svg>","caption":"...","changed":"..."}}

${PICTURE}
בציור המסכם הרעיון בשיאו (פורח, עם פרי, או מוכן לדרך), או, כשבחרו לגדל רעיון אחר, זרע חדש שצומח מתוך הדשן.`;
  }

  // ---------- מה נשלח לגני ----------
  const pick = (list, id) => (list.find((x) => x[0] === id) || [])[2] || '';
  const ideaName = (I) => String((I && I.name) || '').trim() || 'הרעיון';
  function describe(I) {
    const s = I.stages || {};
    const L = [];
    L.push(`שם הרעיון: ${ideaName(I)}`);
    if (s.seed) {
      L.push(`מאיפה הרעיון בא: ${pick(SOURCES, s.seed.source) || 'לא צוין'}${s.seed.sourceText ? ' (' + s.seed.sourceText + ')' : ''}`);
      if (s.seed.what) L.push(`הרעיון: ${s.seed.what}`);
      if (s.seed.forWho) L.push(`למי הוא: ${s.seed.forWho}`);
      if (s.seed.look) L.push(`איך הוא נראה (${s.seed.lookKind === 'image' ? 'דימוי' : 'דבר ממשי'}): ${s.seed.look}`);
    }
    if (s.sprout) {
      const it = (x) => `${x.text}${x.whom ? ' · ' + ((FOR_WHOM.find((f) => f[0] === x.whom) || [])[1] || x.whom) : ''} · חשוב ${['', 'קצת', 'בינוני', 'מאוד'][x.w || 1]}${x.fix ? ' · ' + (FIX.find((f) => f[0] === x.fix) || [])[1] : ''}`;
      const pros = (s.sprout.pros || []).filter((x) => x.text), cons = (s.sprout.cons || []).filter((x) => x.text);
      if (pros.length) L.push('יתרונות:\n' + pros.map((x) => '- ' + it(x)).join('\n'));
      if (cons.length) L.push('חסרונות:\n' + cons.map((x) => '- ' + it(x)).join('\n'));
    }
    if (s.guard) {
      const h = (s.guard.items || []).filter((x) => x.on);
      if (h.length) L.push('מי או מה עלול להיפגע, ואיך מגינים:\n' + h.map((x) => `- ${pick(HARM, x.id)}: ${x.how || ''}${x.protect ? ' · הגנה: ' + x.protect : ''}`).join('\n'));
      else if (s.guard.none) L.push(`בדקו ולא מצאו פגיעה: ${s.guard.none}`);
    }
    if (s.grow) {
      if (s.grow.need) L.push(`מה נדרש: ${s.grow.need}`);
      if (s.grow.first) L.push(`הניסיון הקטן הראשון: ${s.grow.first}`);
      if (s.grow.helpers) L.push(`מי עוזר/ת: ${s.grow.helpers}`);
      if (s.grow.sign) L.push(`איך נדע שזה עובד: ${s.grow.sign}`);
    }
    return L.join('\n');
  }
  // מה קרה בדרך: תגובות למשוב, התייעצויות, גרסאות
  function journeyText(I) {
    const L = [];
    (I.log || []).forEach((e) => {
      const st = (STAGES.find((x) => x.id === e.stage) || {}).name || '';
      if (e.t === 'move') L.push(`- שלב ${st}: תגובה למשוב: ${pick(MOVES, e.move)}${e.note ? ' (' + e.note + ')' : ''}`);
      if (e.t === 'consult') L.push(`- שלב ${st}: התייעצו עם ${e.who}${e.said ? ': ' + e.said : ''}`);
      if (e.t === 'decide') L.push(`- שלב ${st}: החלטה: ${pick(DECIDE, e.d)}${e.note ? ' (' + e.note + ')' : ''}`);
    });
    return L.join('\n');
  }
  function stats(I) {
    const log = I.log || [];
    const chats = log.filter((e) => e.t === 'chat').length;
    const people = log.filter((e) => e.t === 'consult').length;
    const moves = new Set(log.filter((e) => e.t === 'move').map((e) => e.move));
    const improves = log.filter((e) => e.t === 'decide' && e.d === 'improve').length;
    const versions = (I.pics || []).length;
    const tries = log.filter((e) => e.t === 'move' && e.move === 'try').length;
    return { chats, people, consult: chats + people, moveKinds: moves.size, improves, versions, tries };
  }
  // חיזוקים לדרך (בלי ציון): מתייעצים הרבה אבל לא יותר מדי, מנסים אפשרויות חדשות, גמישים עם משוב
  function badges(I) {
    const s = stats(I), b = [];
    const stagesDone = Math.max(1, new Set((I.log || []).filter((e) => e.t === 'decide').map((e) => e.stage)).size);
    const per = s.consult / stagesDone;
    if (s.consult >= 2 && per <= 4) b.push(['🗣', 'מתייעצים בחוכמה', 'התייעצתם כדי להחליט, ואז החלטתם בעצמכם.']);
    else if (per > 4) b.push(['🗣', 'אוהבים להתייעץ', 'התייעצתם הרבה. בפעם הבאה אפשר לנסות להחליט קצת קודם, ולבדוק.']);
    if (s.people >= 1) b.push(['🤝', 'שאלו גם אנשים', 'התייעצתם גם עם אנשים מחוץ למשחק.']);
    if (s.improves >= 1 || s.versions >= 3 || s.tries >= 1) b.push(['🧪', 'מנסים אפשרויות חדשות', 'שיניתם ושיפרתם את הרעיון בדרך.']);
    if (s.moveKinds >= 2) b.push(['🌦', 'גמישים עם משוב', 'הגבתם למשוב בכמה דרכים: קיבלתם, הסתייגתם או התנגדתם בנימוק.']);
    if (I.end === 'other') b.push(['🍂', 'אומץ לגדל רעיון אחר', 'החלטתם לגדל רעיון אחר, והרעיון הזה הפך לדשן.']);
    if (I.end === 'go') b.push(['🍎', 'יוצאים לדרך', 'הבאתם רעיון עד ההחלטה להוציא אותו לפועל.']);
    return b;
  }
  function feedbackInput(I, stageId) {
    const st = STAGES.find((x) => x.id === stageId) || STAGES[0];
    const prev = (I.pics || []).slice(-1)[0];
    return `השלב שהסתיים: ${st.name} (${st.title})
${describe(I)}
${journeyText(I) ? '\nמה קרה בדרך:\n' + journeyText(I) : ''}
${prev && prev.svg ? '\nהציור הקודם של הרעיון (לשמור משהו ממנו ולשנות לפי מה שהשתנה):\n' + prev.svg : ''}
${I.lookNow ? '\nאיך הרעיון נראה עכשיו, לדברי המגדלים: ' + I.lookNow : ''}
תני משוב על הרעיון בשלב "${st.name}", וציור חדש של הרעיון.`;
  }
  function summaryInput(I) {
    const s = stats(I);
    return `${describe(I)}
ההחלטה בסוף: ${I.end === 'go' ? 'יוצאים לדרך עם הרעיון' : 'מגדלים רעיון אחר'}${I.endNote ? ' (' + I.endNote + ')' : ''}
מה קרה בדרך:
${journeyText(I) || '-'}
מספרים: ${s.chats} שיחות עם גני, ${s.people} התייעצויות עם אנשים, ${s.versions} ציורים של הרעיון, ${s.improves} פעמים שחזרו לשפר, ${s.moveKinds} סוגי תגובה שונים למשוב.`;
  }

  // ---------- בדיקת התשובות ----------
  const arr = (v, n) => (Array.isArray(v) ? v : []).map((x) => String(x == null ? '' : (typeof x === 'object' ? (x.text || '') : x)).trim()).filter(Boolean).slice(0, n || 5);
  function validFeedback(v) { return !!(v && typeof v === 'object' && v.frame && (Array.isArray(v.strengths) || Array.isArray(v.improve))); }
  function normFeedback(v) {
    return {
      frame: String(v.frame || '').trim(),
      strengths: arr(v.strengths), risks: arr(v.risks), improve: arr(v.improve), think: arr(v.think), notice: arr(v.notice),
      consult: (Array.isArray(v.consult) ? v.consult : []).filter((c) => c && (c.who || typeof c === 'string')).slice(0, 3).map((c) => (typeof c === 'string' ? { who: c, why: '' } : { who: String(c.who).trim(), why: String(c.why || '').trim() })),
      question: String(v.question || '').trim(),
      picture: normPicture(v.picture),
    };
  }
  function validSummary(v) { return !!(v && typeof v === 'object' && v.frame && v.product && v.path); }
  function normSummary(v) {
    const p = v.product || {}, d = v.path || {};
    return { frame: String(v.frame || '').trim(), product: { strengths: arr(p.strengths), next: arr(p.next) }, path: { consult: String(d.consult || '').trim(), trying: String(d.trying || '').trim(), feedback: String(d.feedback || '').trim() }, cheer: String(v.cheer || '').trim(), picture: normPicture(v.picture) };
  }
  function normPicture(p) {
    p = p || {};
    return { svg: cleanSvg(p.svg), caption: String(p.caption || '').trim(), changed: String(p.changed || '').trim() };
  }

  // ---------- ניקוי הציור: רק תגיות ותכונות מותרות, בלי טקסט, קישורים או סקריפטים ----------
  const TAGS = ['svg', 'g', 'path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon', 'defs', 'lineargradient', 'radialgradient', 'stop'];
  const ATTRS = ['d', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'width', 'height', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'opacity', 'fill-opacity', 'stroke-opacity', 'transform', 'points', 'id', 'offset', 'stop-color', 'stop-opacity', 'gradientunits', 'gradienttransform', 'fx', 'fy', 'fill-rule'];
  const CASE = { lineargradient: 'linearGradient', radialgradient: 'radialGradient', gradientunits: 'gradientUnits', gradienttransform: 'gradientTransform' };
  function cleanSvg(src) {
    const s = String(src || '');
    if (!/<svg[\s>]/i.test(s) || s.length > 40000) return '';
    const out = [];
    let shapes = 0;
    const re = /<\s*(\/?)\s*([a-zA-Z]+)([^<>]*?)(\/?)\s*>/g;
    let m;
    while ((m = re.exec(s))) {
      const close = m[1] === '/', name = m[2].toLowerCase(), self = m[4] === '/';
      if (!TAGS.includes(name) || name === 'svg') continue;
      const tag = CASE[name] || name;
      if (close) { out.push(`</${tag}>`); continue; }
      const attrs = [];
      const ar = /([a-zA-Z:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
      let a;
      while ((a = ar.exec(m[3]))) {
        const k = a[1].toLowerCase(), val = a[3] != null ? a[3] : a[4];
        if (!ATTRS.includes(k)) continue;
        if (/[<>]|javascript|expression|@import|data:/i.test(val)) continue;
        if (/url\(/i.test(val) && !/^\s*url\(\s*#[\w-]+\s*\)\s*$/.test(val)) continue;
        attrs.push(`${CASE[k] || k}="${val.replace(/"/g, '')}"`);
      }
      if (!['g', 'defs', 'lineargradient', 'radialgradient', 'stop'].includes(name)) shapes++;
      out.push(`<${tag}${attrs.length ? ' ' + attrs.join(' ') : ''}${self ? '/' : ''}>`);
    }
    if (shapes < 1) return '';
    return `<svg viewBox="0 0 240 200" xmlns="http://www.w3.org/2000/svg" role="img">${balance(out).join('')}</svg>`;
  }
  // סוגרים תגיות פתוחות, ומדלגים על סגירות יתומות
  function balance(parts) {
    const st = [], res = [];
    parts.forEach((p) => {
      const c = /^<\/(\w+)>$/.exec(p);
      if (c) { const i = st.lastIndexOf(c[1]); if (i < 0) return; while (st.length > i) res.push(`</${st.pop()}>`); return; }
      const o = /^<(\w+)[^>]*?(\/?)>$/.exec(p);
      res.push(p);
      if (o && !o[2]) st.push(o[1]);
    });
    while (st.length) res.push(`</${st.pop()}>`);
    return res;
  }

  // ---------- איורים: העציץ שגדל, וגני ----------
  function pot(stage, opt) {
    const k = Math.max(0, Math.min(5, stage | 0));
    const o = opt || {};
    const leaf = (x, y, r, s, c) => `<path d="M${x} ${y}c${8 * s} ${-14} ${22 * s} ${-16} ${30 * s} ${-12}c${-4 * s} ${12} ${-16 * s} ${18} ${-30 * s} ${12}z" fill="${c || '#3A9E6B'}" stroke="#1F5E3F" stroke-width="2" transform="rotate(${r} ${x} ${y})"/>`;
    let p = '';
    if (k === 0) p = `<path d="M80 92q-2-6 3-10" stroke="#2F7D52" stroke-width="2" fill="none"/><ellipse cx="80" cy="90" rx="9" ry="6" fill="#8B5A2B" stroke="#4A2E12" stroke-width="2"/>`;
    if (k >= 1) p += `<path d="M80 100 C80 ${92 - k * 6} 80 ${84 - k * 10} 80 ${78 - k * 12}" stroke="#2F7D52" stroke-width="${3 + k * .6}" fill="none" stroke-linecap="round"/>`;
    if (k >= 1) p += leaf(80, 92 - k * 2, -30, 1) + leaf(80, 92 - k * 2, 30, -1, '#57B97E');
    if (k >= 2) p += leaf(80, 78 - k * 3, -40, 1, '#57B97E') + leaf(80, 76 - k * 3, 40, -1);
    if (k >= 3) p += leaf(80, 60 - k * 3, -35, 1) + leaf(80, 58 - k * 3, 35, -1, '#57B97E');
    if (k === 4) p += `<g transform="translate(80 ${74 - k * 12})">${[0, 72, 144, 216, 288].map((r) => `<ellipse rx="7" ry="11" cy="-10" fill="#FFC929" stroke="#B5850B" stroke-width="1.5" transform="rotate(${r})"/>`).join('')}<circle r="6" fill="#E0603F"/></g>`;
    if (k === 5) p += `<g transform="translate(80 ${70 - k * 12})"><circle r="16" fill="#E0603F" stroke="#8E2F18" stroke-width="2.5"/><path d="M0 -16q2 -8 8 -10" stroke="#5B3A1A" stroke-width="3" fill="none"/>${leaf(2, -18, -20, 1)}<ellipse cx="-6" cy="-5" rx="4" ry="6" fill="#fff" opacity=".45"/></g>`;
    const potC = o.color || '#E0603F';
    return `<svg viewBox="0 0 160 150" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${p}<path d="M44 100h72l-9 42H53z" fill="${potC}" stroke="#7A2E18" stroke-width="2.5" stroke-linejoin="round"/><rect x="40" y="94" width="80" height="12" rx="5" fill="${potC}" stroke="#7A2E18" stroke-width="2.5"/><path d="M52 100h56" stroke="#5B3A1A" stroke-width="4" stroke-linecap="round" opacity=".6"/></svg>`;
  }
  // גני: יצורון גנן/ית ירוק/ה עם עלה על הראש ומזלף
  function geni(mood) {
    const talk = mood === 'talk';
    return `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
<ellipse cx="60" cy="112" rx="30" ry="5" fill="#1F2A36" opacity=".12"/>
<path d="M60 22c-2-12 4-18 14-18-1 10-6 16-14 18z" fill="#57B97E" stroke="#1F5E3F" stroke-width="2.5"/>
<path d="M60 24c1-8-3-13-10-14 0 7 4 12 10 14z" fill="#3A9E6B" stroke="#1F5E3F" stroke-width="2.5"/>
<path d="M60 26C34 26 22 46 22 70s14 40 38 40 38-16 38-40-12-44-38-44z" fill="#6CC492" stroke="#1F5E3F" stroke-width="3"/>
<ellipse cx="60" cy="80" rx="22" ry="20" fill="#A8E0BF" opacity=".7"/>
<circle cx="48" cy="62" r="5" fill="#1F2A36"/><circle cx="72" cy="62" r="5" fill="#1F2A36"/>
<circle cx="49.5" cy="60.5" r="1.6" fill="#fff"/><circle cx="73.5" cy="60.5" r="1.6" fill="#fff"/>
<circle cx="40" cy="72" r="5" fill="#FF9A8A" opacity=".55"/><circle cx="80" cy="72" r="5" fill="#FF9A8A" opacity=".55"/>
${talk ? '<ellipse cx="60" cy="76" rx="7" ry="6" fill="#7A2E18"/>' : '<path d="M51 74q9 8 18 0" stroke="#1F2A36" stroke-width="3" fill="none" stroke-linecap="round"/>'}
<g transform="translate(88 78) rotate(-12)"><path d="M0 0h22l-3 18H3z" fill="#1A9BB5" stroke="#0E5566" stroke-width="2.5"/><path d="M20 4l14-8" stroke="#0E5566" stroke-width="4" stroke-linecap="round"/><path d="M4 0q7-10 14 0" stroke="#0E5566" stroke-width="2.5" fill="none"/></g>
<path d="M28 84q-8 4-8 12" stroke="#1F5E3F" stroke-width="5" stroke-linecap="round" fill="none"/>
</svg>`;
  }
  // הדשן: רעיון שבחרו לגדל רעיון אחר במקומו
  function compost() {
    return `<svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M10 92q50-50 100 0z" fill="#8B5A2B" stroke="#4A2E12" stroke-width="2.5"/>${[[34, 74, '#D88A3D'], [56, 66, '#E0603F'], [78, 74, '#FFC929'], [46, 82, '#C9A24A'], [68, 84, '#B5652B']].map(([x, y, c]) => `<path d="M${x} ${y}c6-6 14-6 16 0-6 6-12 6-16 0z" fill="${c}" stroke="#4A2E12" stroke-width="1.5"/>`).join('')}<path d="M60 56c0-12 0-20 0-26" stroke="#2F7D52" stroke-width="3" stroke-linecap="round"/><path d="M60 36c6-8 14-8 18-4-6 6-12 6-18 4z" fill="#57B97E" stroke="#1F5E3F" stroke-width="1.5"/></svg>`;
  }

  return { AGES, ageOf, KID, SOURCES, LOOKS, STAGES, FOR_WHOM, WEIGHT, FIX, HARM, MOVES, DECIDE, PROMPTS, CORE,
    feedbackSystem, chatSystem, summarySystem, describe, journeyText, feedbackInput, summaryInput, stats, badges, ideaName,
    validFeedback, normFeedback, validSummary, normSummary, cleanSvg, pot, geni, compost, esc };
});
