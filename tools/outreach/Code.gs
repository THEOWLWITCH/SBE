/**
 * Begood · מערכת הפצה (03/11/2026)
 * "מערכת הפצה מחוברת למייל שלי: לשלוח ולעקוב אחר השליחה והמענה, לשלוח את החוברת עם מכתב מלווה מותאם,
 *  לקבוצה יחד בעותק מוסתר, ומי ששלחתי לו יסומן."
 *
 * הכול רץ בחשבון הגוגל של השולחת: גיליון גוגל הוא רשימת אנשי הקשר, והמיילים יוצאים מה-Gmail שלה.
 * Begood לא שומרת את אנשי הקשר בשרת שלה, והקוד לא שולח דבר לשום מקום אחר.
 *
 * התקנה (פעם אחת): גיליון חדש ← תוספים (Extensions) ← Apps Script ← מדביקים את כל הקובץ ← שמירה ←
 * מרעננים את הגיליון ← בתפריט "📮 הפצה" בוחרים "הכנת הגיליון". ההוראות המלאות: tools/outreach/README.md
 */

const SH = { C: 'אנשי קשר', T: 'גרסאות', L: 'יומן שליחות', S: 'הגדרות', X: 'הסרות' };

const COLS = ['דוא"ל', 'שם', 'תפקיד', 'מוסד', 'סוג', 'עיר / רשות', 'מחוז', 'טלפון', 'נייד', 'אתר',
  'מקור המידע', 'קבוצה', 'גרסה', 'סטטוס', 'נשלח בתאריך', 'אופן שליחה', 'ענה בתאריך', 'קישור למענה',
  'תקציר המענה', 'הערות'];

const ST = { NEW: 'חדש', SENT: 'נשלח', REPLIED: 'ענה', FAIL: 'נכשל', OFF: 'הוסר' };

const TYPES = ['בית ספר יסודי', 'חטיבת ביניים', 'תיכון / על יסודי', 'גן ילדים', 'חינוך מיוחד',
  'אגף חינוך ברשות', 'מחוז / פיקוח', 'עמותה / ארגון חברתי', 'ארגון / חברה', 'מכללה / אוניברסיטה',
  'מתנ"ס / מרכז קהילתי', 'ניהול קהילה ביישוב / בשכונה', 'מנהיגות מקומית / קבוצת תושבים', 'אחר'];

// מפתח · ערך ברירת מחדל · הסבר
const SETTINGS = [
  ['שם השולח/ת', 'ד״ר יעל שדה · Begood', 'השם שמופיע אצל הנמענים.'],
  ['כתובת למענה', '', 'רשות. ריק: המענה מגיע לכתובת שממנה שולחים.'],
  ['כתובת לשליחת ניסיון', '', 'ריק: הכתובת שלך.'],
  ['קישור לחוברת', '', 'קישור לצפייה בחוברת (Drive או האתר). מוצג ככפתור במכתב, או במקום {קישור לחוברת}.'],
  ['קובץ החוברת ב-Drive', '', 'רשות: קישור לקובץ ב-Drive, אם רוצים לצרף אותו למייל.'],
  ['צירוף החוברת כקובץ', 'לא', 'כן / לא. קישור עדיף: מייל עם קובץ גדול מגיע לספאם לעתים קרובות יותר.'],
  ['"פרסומת" בראש הנושא', 'כן', 'כן / לא. לפי חוק התקשורת (סעיף 30א), הודעה שמציעה שירות בתשלום מסומנת "פרסומת" בראש הנושא.'],
  ['שורת הסרה', 'מעדיפים לא לקבל מאיתנו דוא"ל? אפשר להשיב "הסר", ולא נפנה שוב.', 'מופיעה בתחתית כל מכתב.'],
  ['פרטי השולח בתחתית', 'Begood · ד״ר יעל שדה · be-good.co.il', 'שם, כתובת אתר ודרך ליצירת קשר.'],
  ['נמענים בכל מייל קבוצתי', '40', 'במייל בעותק מוסתר. עד 90.'],
  ['לוגו בחתימה', 'כן', 'כן / לא. הלוגו של Begood מתחת לחתימה, כתמונה בתוך המייל.'],
];

const TPL_HEAD = ['גרסה', 'שם הגרסה', 'למי (סוגים, מופרדים בפסיק)', 'נושא', 'גוף המכתב'];

const SAMPLE_BODY = '{פנייה}\n\n' +
  'כאן יבוא נוסח המכתב המלווה.\n\n' +
  'אפשר להשתמש בשדות: {שם}, {תפקיד}, {מוסד}, {עיר}. במייל קבוצתי בעותק מוסתר רק {פנייה} מותאם ("שלום רב,").\n\n' +
  '**מילה מודגשת** בין שתי כוכביות, ושורה שמתחילה ב-"- " הופכת לתבליט.\n\n' +
  'את החוברת מצרפים כאן: {קישור לחוברת}\n\n' +
  'בברכה,\nד״ר יעל שדה\nBegood';

// גרסה 1: למנהלי ומנהלות אגפי חינוך ברשויות (03/11/2026, הנוסח של ד״ר יעל שדה)
const BODY_EDU = [
  '{פנייה}',
  'כיצד ניתן לפתח מוכנות בשגרה ובחירום בכל מוסדות החינוך ברשות, בלי להכתיב לכולם תכנית אחידה שאינה מתאימה לצורכיהם?',
  'כיצד הופכים את המוכנות לתהליך מתמשך, שמובל על ידי המנהלים והצוותים עצמם, ולא לפעילות חד־פעמית לקראת מצב חירום?',
  'אני מבקשת להציג בפניך את **Begood**, מערכת מקצועית מבוססת ידע ובינה מלאכותית, המציעה כלים ייעודיים לתרגול ולפיתוח מוכנות אישית־תפקודית, חברתית וארגונית.',
  'המערכת מאפשרת למוסדות חינוך לתרגל אתגרי שגרה וחירום באמצעות תרחישים וסימולציות, חשיבת צוות, תכנון פעילויות, הכנה לשיחות, קבלת החלטות והפקת לקחים.',
  '**ייחודה של Begood הוא בשילוב בין תשתית מקצועית משותפת לבין אחריות ועצמאות של כל מוסד.**',
  'באמצעות **מערך המוכנות**, כל בית ספר יכול לבנות את תכנית המוכנות שלו לפי מתווה מקצועי מובנה, לתרגל אותה בחמישה מפגשי צוות ולשפר אותה בסבבים חוזרים. התהליך מסייע להבהיר תפקידים, לזהות פערים, לגבש פעולות ולשמר ידע ארגוני גם כאשר בעלי תפקידים מתחלפים.',
  'עבור אגף החינוך, גישה זו מאפשרת לקדם שפה מקצועית משותפת, לעודד למידה מתמשכת ולבחון אילו אתגרים משותפים למוסדות שונים ואילו מחייבים מענה מקומי.',
  'המערכת נשענת על **מאגר ידע מקצועי ייעודי ומתעדכן**, הכולל מחקרים, תיאוריות ומודלים מישראל ומהעולם, תוך כפיפות לנהלים ולהנחיות המחייבים בישראל.',
  'Begood פותחה מתוך ידע מחקרי וניסיון של למעלה משלושה עשורים בהובלת תהליכי שינוי חינוכיים ומערכתיים.',
  '**בחוברת המצורפת מוצגים התפיסה המקצועית, הכלים, תהליכי העבודה ומערך המוכנות המאפשר לבתי הספר לקחת אחריות על התהליך בעצמם.**\n{קישור לחוברת}',
  'אשמח לקיים מפגש היכרות שבו נציג את המערכת ונבחן יחד כיצד היא יכולה להשתלב בפיתוח המוכנות של מוסדות החינוך ברשות.',
  'בברכה,\n**ד״ר יעל שדה**\nמפתחת Begood\nwww.be-good.co.il\n052-3969417',
].join('\n\n');

// גרסה 2: למנהלי ומנהלות בתי ספר (03/11/2026, הנוסח של ד״ר יעל שדה)
const BODY_SCHOOL = [
  '{פנייה}',
  'עד כמה בית הספר שלנו מוכן להתמודד עם האתגרים של מחר, בשגרה ובחירום?',
  'מנהלים וצוותים חינוכיים מתמודדים מדי יום עם מצבים מורכבים: קונפליקטים, קשר עם הורים, קבלת החלטות, עבודה משותפת, אירועים בלתי צפויים ומצבי חירום. ההתמודדות עם מצבים אלה מחייבת ידע וניסיון, אך גם הכנה ותרגול מתמשכים.',
  'אני מבקשת להכיר לך את **Begood: מערכת מקצועית לפיתוח מוכנות אישית־תפקודית, חברתית וארגונית באמצעות כלים ייעודיים לתרגול מעשי.**',
  'המערכת מבוססת על מאגר ידע מדעי ומקצועי ייעודי ומתעדכן, ומשלבת כלי בינה מלאכותית ליצירת תרחישים וסימולציות, הכנה לשיחות, חשיבת צוות, תכנון פעילויות, תרגול והפקת לקחים.',
  '**גולת הכותרת היא מערך המוכנות**, המאפשר לבית הספר לבנות בעצמו תכנית מוכנות המותאמת לצרכיו, לתרגל אותה במסגרת חמישה מפגשי צוות מובנים ולשפר אותה לאורך זמן. התהליך משלב בירור תפקידים ואחריות, תרגול מצבים מאתגרים, זיהוי פערים ותכנון פעולות לשיפור.',
  'התפיסה המנחה היא שמוכנות אינה נבנית רק לקראת אירוע חירום. היא מחייבת מודעות והקצאת זמן קבוע בשגרה. המיומנויות שמתרגלים בהתמודדות היומיומית (תקשורת, תיאום, אחריות וקבלת החלטות) הן גם הבסיס לתפקוד במצבים חריגים.',
  'Begood פותחה מתוך שילוב בין מחקר אקדמי, ידע מקצועי וניסיון רב שנים בהובלת תהליכי שינוי במערכת החינוך.',
  '**בחוברת המצורפת מוצגים כלי המערכת, דוגמאות לתהליכי עבודה ומערך המוכנות הבית־ספרי.**\n{קישור לחוברת}',
  'אשמח להיפגש, להציג את המערכת ולהדגים כיצד ניתן להשתמש בה כדי להתמודד עם אתגר ממשי מתוך עבודת בית הספר.',
  'בברכה,\n**ד״ר יעל שדה**\nמפתחת Begood\nwww.be-good.co.il\n052-3969417',
].join('\n\n');

// גרסה 3: למנהלי ומנהלות קהילות (03/11/2026, הנוסח של ד״ר יעל שדה)
const BODY_COMMUNITY = [
  '{פנייה}',
  'מה הופך קהילה לקהילה שמסוגלת להתמודד עם אתגרים, בשגרה ובחירום?',
  'תחושת שייכות ורצון טוב חשובים, אך אינם מספיקים. כדי לפעול יחד נדרשים גם תפקידים ברורים, אחריות, תקשורת, תיאום, יכולת לקבל החלטות ודרכים משותפות להתמודד עם מצבים משתנים.',
  'יכולות אלה אינן מתפתחות מעצמן. יש לטפח ולתרגל אותן כחלק מהעשייה הקהילתית השוטפת.',
  'אני מבקשת להכיר לך את **Begood: מערכת מקצועית מבוססת ידע ובינה מלאכותית לפיתוח מוכנות אישית־תפקודית, צוותית וקהילתית באמצעות תרגול מעשי.**',
  'המערכת מציעה כלים ליצירת תרחישים וסימולציות, לניהול שיח, לחשיבת צוות, לתכנון פעילויות ויוזמות, להגדרת תפקידים, לקבלת החלטות ולהפקת לקחים.',
  'הכלים יכולים להשתלב בעבודתם של צוותי מתנ"סים, מנהיגויות מקומיות, קבוצות תושבים ומתנדבים, ולסייע להם להתכונן למשימות ולפתח יכולת פעולה משותפת.',
  '**מרכיב מרכזי במערכת הוא מערך המוכנות**, המציע תהליך מובנה שבו כל ארגון או קהילה מפתחים תכנית מותאמת לצורכיהם, מתרגלים מצבים מאתגרים, מבהירים תפקידים ואחריות ולומדים מההתנסות.',
  'המערכת מבוססת על מאגר ידע מקצועי ייעודי ומתעדכן מתחומי החוסן, הקהילה, החינוך והארגון. היא פותחה מתוך מחקר בתחום החוסן הקהילתי וניסיון רב שנים בהובלת תהליכי שינוי חינוכיים וקהילתיים.',
  'Begood אינה מערכת טיפולית. היא מתמקדת בפיתוח מסוגלות תפקודית, אחריות ויכולת לפעול יחד. תפיסתה היא שמוכנות נבנית באמצעות תרגול קבוע בשגרה ולא רק בתגובה למשבר.',
  'בחוברת המצורפת ניתן להכיר את כלי המערכת, את התהליכים המשולבים ואת מערך המוכנות לארגונים ולקהילות.\n{קישור לחוברת}',
  'אשמח להזמין אותך למפגש היכרות שבו נציג את המערכת, נדגים את הכלים ונבחן יחד כיצד ניתן להשתמש בהם סביב אתגר ממשי מתוך הפעילות הקהילתית שלכם.',
  'בברכה,\nד״ר יעל שדה\nמפתחת Begood\nwww.be-good.co.il\n052-3969417',
].join('\n\n');

// גרסה 4: לארגונים, עמותות וחברות (03/11/2026, הנוסח של ד״ר יעל שדה)
const BODY_ORG = [
  '{פנייה}',
  '**עד כמה הארגון שלכם מוכן להתמודד עם האתגרים של מחר, בשגרה ובחירום?**',
  'ארגונים, עמותות וחברות פועלים בסביבה משתנה, המחייבת התמודדות מתמדת עם משימות מורכבות, שינויים, קבלת החלטות, עבודת צוות ולעיתים גם משברים ומצבי חירום.',
  'היכולת להתמודד עם אתגרים אלה אינה תלויה רק בידע ובניסיון של העובדים והמנהלים. היא תלויה גם ביכולת לתכנן, לתאם, לשתף פעולה, לקבל אחריות ולפעול יחד במצבים משתנים.',
  '**אני מבקשת להכיר לכם את Begood: מערכת מקצועית לפיתוח מוכנות אישית־תפקודית, צוותית וארגונית באמצעות כלים ייעודיים לתרגול מעשי.**',
  'המערכת מבוססת על מאגר ידע מדעי ומקצועי ייעודי ומתעדכן, ומשלבת כלי בינה מלאכותית לתרגול מצבים ואתגרים מתוך עולם העבודה: יצירת תרחישים וסימולציות, חשיבת צוות, הכנה לשיחות מורכבות, תכנון תהליכים, קבלת החלטות והפקת לקחים.',
  '**הייחוד של Begood הוא המעבר משימוש בכלים נקודתיים לתהליך מתמשך של פיתוח מוכנות.**',
  'באמצעות **מערך המוכנות**, הארגון יכול לבנות בעצמו תכנית המותאמת למשימותיו ולצרכיו, לתרגל אותה בחמישה מפגשי צוות מובנים ולשפר אותה לאורך זמן.',
  'התהליך מאפשר לבחון דרכי פעולה, להבהיר תפקידים ותחומי אחריות, לזהות פערים, לתכנן פתרונות ולשמר ידע ארגוני גם כאשר אנשים ותפקידים מתחלפים.',
  'המערכת נועדה לסייע לארגון להפוך את המוכנות לחלק משגרת העבודה, באמצעות הקצאת זמן קבוע לתרגול, ללמידה ולשיפור מתמשך.',
  '**עבור הארגון שלכם, המשמעות היא גישה לכלים מקצועיים זמינים, פיתוח שפה משותפת, חיזוק יכולת הפעולה של צוותים ותמיכה בהיערכות לשינויים ולמצבים בלתי צפויים.**',
  'Begood פותחה מתוך שילוב בין מחקר אקדמי, מאגר ידע מקצועי וניסיון של למעלה משלושה עשורים בהובלת תהליכי שינוי מערכתיים. ניתן גם לבחון התאמה של כלים קיימים או פיתוח כלים חדשים בהתאם לצרכים הייחודיים של הארגון.',
  '**בחוברת המצורפת מוצגים תפיסת המוכנות, כלי המערכת, תהליכי העבודה המשולבים ומערך המוכנות לארגונים ולקהילות.**\n{קישור לחוברת}',
  'אשמח להזמין אתכם למפגש היכרות מקצועי שבו נציג את המערכת ונדגים כיצד ניתן להשתמש בה להתמודדות עם אתגר ממשי מתוך עבודת הארגון שלכם.',
  '**כי מוכנות מתרגלים, והזמן להתכונן הוא בשגרה.**',
  'בברכה,\n**ד״ר יעל שדה**\nמפתחת Begood\nwww.be-good.co.il\n052-3969417',
].join('\n\n');

// גרסה · שם · למי · נושא · גוף · מוכן (נוסח סופי: "עדכון הנוסחים" כותב אותו לגיליון)
const TEMPLATES = [
  ['1', 'מנהלי ומנהלות אגפי חינוך', 'אגף חינוך ברשות',
    'מוכנות בשגרה ובחירום בכל מוסדות החינוך ברשות: הכרות עם Begood', BODY_EDU, true],
  ['2', 'מנהלי ומנהלות בתי ספר', 'בית ספר יסודי, חטיבת ביניים, תיכון / על יסודי, חינוך מיוחד, גן ילדים, מחוז / פיקוח',
    'מוכנות בית הספר בשגרה ובחירום: הכרות עם Begood', BODY_SCHOOL, true],
  ['3', 'מנהלי ומנהלות קהילות', 'מתנ"ס / מרכז קהילתי, ניהול קהילה ביישוב / בשכונה, מנהיגות מקומית / קבוצת תושבים',
    'מוכנות קהילתית בשגרה ובחירום: הכרות עם Begood', BODY_COMMUNITY, true],
  ['4', 'מנהלי ומנהלות עמותות, ארגונים וחברות', 'עמותה / ארגון חברתי, ארגון / חברה, מכללה / אוניברסיטה',
    'מוכנות הארגון בשגרה ובחירום: הכרות עם Begood', BODY_ORG, true],
];

/* ───────────── תפריט והכנה ───────────── */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('📮 הפצה')
    .addItem('לוח ההפצה', 'openSidebar')
    .addItem('ייבוא אנשי קשר (הדבקה מאקסל)', 'openImport')
    .addSeparator()
    .addItem('בדיקת מענים ומיילים שחזרו', 'checkRepliesMenu')
    .addItem('סיכום', 'summaryMenu')
    .addSeparator()
    .addItem('עדכון הנוסחים המוכנים בלשונית גרסאות', 'loadTemplates')
    .addItem('הכנת הגיליון (פעם אחת)', 'setup')
    .addToUi();
}

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  try { ss.setSpreadsheetLocale('iw_IL'); } catch (e) { /* לא חיוני */ }
  const make = (name, head) => {
    let s = ss.getSheetByName(name);
    if (!s) s = ss.insertSheet(name);
    s.setRightToLeft(true);
    if (head && s.getLastRow() === 0) {
      s.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold')
        .setBackground('#1d3f63').setFontColor('#ffffff');
      s.setFrozenRows(1);
    }
    return s;
  };
  const c = make(SH.C, COLS);
  const col = (n) => COLS.indexOf(n) + 1;
  const rule = (list) => SpreadsheetApp.newDataValidation().requireValueInList(list, true).setAllowInvalid(true).build();
  c.getRange(2, col('סוג'), 5000).setDataValidation(rule(TYPES));
  c.getRange(2, col('סטטוס'), 5000).setDataValidation(rule([ST.NEW, ST.SENT, ST.REPLIED, ST.FAIL, ST.OFF]));
  c.getRange(2, col('גרסה'), 5000).setDataValidation(rule(TEMPLATES.map((r) => r[0])));
  c.setColumnWidth(col('דוא"ל'), 220);
  c.setColumnWidth(col('מוסד'), 200);
  c.setColumnWidth(col('תקציר המענה'), 260);
  const statusRange = c.getRange(2, col('סטטוס'), 5000);
  const color = (txt, bg) => SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(txt).setBackground(bg).setRanges([statusRange]).build();
  c.setConditionalFormatRules([color(ST.SENT, '#e3f1fb'), color(ST.REPLIED, '#dff3e4'), color(ST.FAIL, '#fde7e4'), color(ST.OFF, '#eeeeee')]);

  const t = make(SH.T, TPL_HEAD);
  if (t.getLastRow() === 1) {
    t.getRange(2, 1, TEMPLATES.length, 5).setValues(TEMPLATES.map((r) => r.slice(0, 5)));
    t.getRange(2, 5, TEMPLATES.length, 1).setWrap(true);
    t.setColumnWidth(5, 520);
    t.setColumnWidth(3, 260);
  }

  const s = make(SH.S, ['הגדרה', 'ערך', 'הסבר']);
  if (s.getLastRow() === 1) s.getRange(2, 1, SETTINGS.length, 3).setValues(SETTINGS);
  s.setColumnWidth(1, 200); s.setColumnWidth(2, 340); s.setColumnWidth(3, 420);

  make(SH.L, ['תאריך', 'אופן', 'גרסה', 'נמענים', 'נושא', 'למי', 'הערה']);
  make(SH.X, ['דוא"ל', 'תאריך', 'סיבה']);
  const def = ss.getSheetByName('Sheet1') || ss.getSheetByName('גיליון1');
  if (def && def.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(def);
  ss.setActiveSheet(c);
  SpreadsheetApp.getUi().alert('הגיליון מוכן.\n\n1. בלשונית "גרסאות" מדביקים את שלושת הנוסחים.\n2. בלשונית "הגדרות" מוסיפים את הקישור לחוברת.\n3. בלשונית "אנשי קשר" מוסיפים אנשים (או "ייבוא אנשי קשר").\n4. "לוח ההפצה" לשליחה.');
}

// כותב לגיליון רק את הגרסאות שהנוסח שלהן מוכן בקוד; שאר השורות בלשונית נשארות כמו שהן
function loadTemplates() {
  const ui = SpreadsheetApp.getUi();
  const ready = TEMPLATES.filter((r) => r[5]);
  const ok = ui.alert('עדכון הנוסחים', 'הנוסח של ' + ready.map((r) => 'גרסה ' + r[0] + ' (' + r[1] + ')').join(', ') +
    ' ייכתב בלשונית "גרסאות" במקום מה שיש שם עכשיו באותה גרסה. שאר הגרסאות לא משתנות. להמשיך?', ui.ButtonSet.YES_NO);
  if (ok !== ui.Button.YES) return;
  const t = sheet_(SH.T);
  const ids = t.getLastRow() > 1 ? t.getRange(2, 1, t.getLastRow() - 1, 1).getValues().map((r) => String(r[0]).trim()) : [];
  ready.forEach((r) => {
    const i = ids.indexOf(r[0]);
    const row = i >= 0 ? i + 2 : t.getLastRow() + 1;
    t.getRange(row, 1, 1, 5).setValues([r.slice(0, 5)]);
    t.getRange(row, 5).setWrap(true);
  });
  const c = sheet_(SH.C);
  const col = COLS.indexOf('סוג') + 1;
  const list = (l) => SpreadsheetApp.newDataValidation().requireValueInList(l, true).setAllowInvalid(true).build();
  c.getRange(2, col, 5000).setDataValidation(list(TYPES));
  c.getRange(2, COLS.indexOf('גרסה') + 1, 5000).setDataValidation(list(TEMPLATES.map((r) => r[0])));
  ui.alert('הנוסחים עודכנו.');
}

/* ───────────── קריאת הגיליון ───────────── */

function sheet_(name) {
  const s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!s) throw new Error('חסרה הלשונית "' + name + '". אפשר להריץ "הכנת הגיליון" מהתפריט.');
  return s;
}

function settings_() {
  const out = {};
  const s = sheet_(SH.S);
  const v = s.getRange(1, 1, Math.max(1, s.getLastRow()), 2).getValues();
  v.forEach((r) => { if (r[0]) out[String(r[0]).trim()] = String(r[1] == null ? '' : r[1]).trim(); });
  SETTINGS.forEach((d) => { if (!(d[0] in out)) out[d[0]] = d[1]; });
  return out;
}

const yes_ = (v) => /^(כן|yes|true|1)$/i.test(String(v || '').trim());
const EMAIL_RE = /^[^\s@<>(),;:"']+@[^\s@<>(),;:"']+\.[a-z]{2,}$/i;
const norm_ = (e) => String(e || '').trim().toLowerCase();

function contacts_() {
  const s = sheet_(SH.C);
  const last = s.getLastRow();
  const width = s.getLastColumn();
  const head = s.getRange(1, 1, 1, width).getValues()[0].map((h) => String(h).trim());
  const idx = {};
  head.forEach((h, i) => { if (h) idx[h] = i; });
  COLS.forEach((c) => { if (!(c in idx)) throw new Error('חסרה העמודה "' + c + '" בלשונית אנשי קשר.'); });
  const values = last > 1 ? s.getRange(2, 1, last - 1, width).getValues() : [];
  const rows = values.map((v, i) => {
    const rec = {};
    head.forEach((h, j) => { if (h) rec[h] = v[j]; });
    return { row: i + 2, rec: rec };
  });
  return { sheet: s, idx: idx, rows: rows };
}

function setCells_(C, row, obj) {
  Object.keys(obj).forEach((k) => {
    if (k in C.idx) C.sheet.getRange(row, C.idx[k] + 1).setValue(obj[k]);
  });
}

function suppressed_() {
  const set = {};
  const x = sheet_(SH.X);
  if (x.getLastRow() > 1) x.getRange(2, 1, x.getLastRow() - 1, 1).getValues().forEach((r) => { if (r[0]) set[norm_(r[0])] = 1; });
  return set;
}

function templates_() {
  const t = sheet_(SH.T);
  if (t.getLastRow() < 2) return [];
  return t.getRange(2, 1, t.getLastRow() - 1, 5).getValues()
    .filter((r) => String(r[0]).trim() && String(r[4]).trim() && String(r[4]).indexOf('כאן יבוא נוסח') < 0) // נוסח לדוגמה לא נשלח
    .map((r) => ({
      id: String(r[0]).trim(), name: String(r[1]).trim(),
      who: String(r[2]).split(/[,،]/).map((x) => x.trim()).filter(Boolean),
      subject: String(r[3]).trim(), body: String(r[4]),
    }));
}

function pickTpl_(rec, version, tpls) {
  if (version && version !== 'auto') return tpls.find((t) => t.id === String(version)) || null;
  const own = String(rec['גרסה'] || '').trim();
  if (own) { const t = tpls.find((x) => x.id === own); if (t) return t; }
  const type = String(rec['סוג'] || '').trim();
  return tpls.find((t) => type && t.who.indexOf(type) >= 0) || null; // בלי גרסה מתאימה: לא שולחים
}

/* ───────────── בחירת נמענים ───────────── */

// opts: { source:'filter'|'selection', type, group, city, onlyNew, resend, version, mode:'personal'|'bcc', max }
function select_(opts, C) {
  const sup = suppressed_();
  let pool = C.rows;
  const stat = { invalid: 0, suppressed: 0, already: 0, dup: 0 };
  if (opts.source === 'selection') {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const rl = ss.getActiveRangeList();
    const want = {};
    if (rl && ss.getActiveSheet().getName() === SH.C) {
      rl.getRanges().forEach((r) => { for (let i = r.getRow(); i < r.getRow() + r.getNumRows(); i++) want[i] = 1; });
    }
    pool = pool.filter((p) => want[p.row]);
  } else {
    const eq = (a, b) => !b || String(a || '').trim() === b;
    pool = pool.filter((p) => eq(p.rec['סוג'], opts.type) && eq(p.rec['קבוצה'], opts.group) && eq(p.rec['עיר / רשות'], opts.city));
  }
  const seen = {};
  const out = [];
  pool.forEach((p) => {
    const e = norm_(p.rec['דוא"ל']);
    const status = String(p.rec['סטטוס'] || '').trim();
    if (!e && !p.rec['שם'] && !p.rec['מוסד']) return; // שורה ריקה
    if (!EMAIL_RE.test(e)) { stat.invalid++; return; }
    if (sup[e] || status === ST.OFF) { stat.suppressed++; return; }
    if (seen[e]) { stat.dup++; return; }
    const fresh = !status || status === ST.NEW;
    const allowOld = opts.source === 'selection' ? !!opts.resend : !opts.onlyNew;
    if (!fresh && !allowOld) { stat.already++; return; }
    if (status === ST.FAIL && !opts.resend) { stat.already++; return; }
    seen[e] = 1;
    out.push(p);
  });
  return { list: out, stat: stat };
}

/* ───────────── בניית המכתב ───────────── */

function esc_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fill_(text, rec, personal) {
  const name = personal ? String(rec['שם'] || '').trim() : '';
  const map = {
    'פנייה': name ? 'שלום ' + name + ',' : 'שלום רב,',
    'שם': name,
    'תפקיד': personal ? String(rec['תפקיד'] || '').trim() : '',
    'מוסד': personal ? String(rec['מוסד'] || '').trim() : '',
    'עיר': personal ? String(rec['עיר / רשות'] || '').trim() : '',
  };
  return String(text).replace(/\{(פנייה|שם|תפקיד|מוסד|עיר)\}/g, (m, k) => map[k]).replace(/[ \t]{2,}/g, ' ');
}

function inline_(s) {
  return esc_(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
}

function linkButton_(url) {
  return '<a href="' + esc_(url) + '" style="display:inline-block;background:#1d3f63;color:#ffffff;text-decoration:none;' +
    'padding:10px 22px;border-radius:999px;font-weight:600">לצפייה בחוברת</a>';
}

function compose_(tpl, rec, personal, cfg) {
  const link = cfg['קישור לחוברת'];
  let body = fill_(tpl.body, rec, personal);
  const hasSlot = body.indexOf('{קישור לחוברת}') >= 0;
  // HTML
  const blocks = body.split(/\n\s*\n/);
  const html = blocks.map((b) => {
    const lines = b.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return '';
    if (lines.every((l) => /^[-•]\s+/.test(l))) {
      return '<ul style="margin:0 0 14px;padding-right:22px">' + lines.map((l) => '<li>' + inline_(l.replace(/^[-•]\s+/, '')) + '</li>').join('') + '</ul>';
    }
    return '<p style="margin:0 0 14px">' + lines.map(inline_).join('<br>') + '</p>';
  }).join('').replace(/\{קישור לחוברת\}/g, link ? linkButton_(link) : '');
  const after = (link && !hasSlot ? '<p style="margin:18px 0">' + linkButton_(link) + '</p>' : '') +
    (yes_(cfg['לוגו בחתימה']) ? LOGO_HTML : '');
  const foot = '<hr style="border:none;border-top:1px solid #dde3ea;margin:22px 0 10px">' +
    '<p style="margin:0;color:#6b7785;font-size:12px">' + esc_(cfg['פרטי השולח בתחתית']) + '<br>' + esc_(cfg['שורת הסרה']) + '</p>';
  const htmlBody = '<div dir="rtl" style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#1f2a37;' +
    'text-align:right;max-width:640px">' + html + after + foot + '</div>';
  // טקסט רגיל
  let plain = body.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\{קישור לחוברת\}/g, link || '');
  if (link && !hasSlot) plain += '\n\nהחוברת: ' + link;
  plain += '\n\n-----\n' + cfg['פרטי השולח בתחתית'] + '\n' + cfg['שורת הסרה'];
  let subject = fill_(tpl.subject || 'Begood', rec, personal);
  if (yes_(cfg['"פרסומת" בראש הנושא']) && !/^פרסומת/.test(subject)) subject = 'פרסומת: ' + subject;
  return { subject: subject, htmlBody: htmlBody, plain: plain };
}

function attachment_(cfg) {
  if (!yes_(cfg['צירוף החוברת כקובץ'])) return null;
  const raw = cfg['קובץ החוברת ב-Drive'];
  const m = String(raw).match(/[-\w]{25,}/);
  if (!m) throw new Error('בהגדרות: "צירוף החוברת כקובץ" הוא כן, אבל חסר קישור לקובץ החוברת ב-Drive.');
  return DriveApp.getFileById(m[0]).getBlob();
}

function mailOpts_(cfg, extra) {
  const o = { name: cfg['שם השולח/ת'] || 'Begood' };
  if (EMAIL_RE.test(cfg['כתובת למענה'])) o.replyTo = cfg['כתובת למענה'];
  if (yes_(cfg['לוגו בחתימה'])) o.inlineImages = { begoodlogo: logoBlob_() };
  return Object.assign(o, extra || {});
}

// הלוגו של Begood לחתימה (PNG, 320x191, מוצג ברוחב 140): בתוך הקוד, כדי שלא יהיה תלוי באתר
const LOGO_B64 = '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';
let LOGO_BLOB_ = null;
function logoBlob_() {
  if (!LOGO_BLOB_) LOGO_BLOB_ = Utilities.newBlob(Utilities.base64Decode(LOGO_B64), 'image/png', 'begood-logo.png');
  return LOGO_BLOB_;
}
const LOGO_HTML = '<p style="margin:10px 0 0"><img src="cid:begoodlogo" alt="Begood" width="140" height="84" style="display:block;border:0;width:140px;height:84px"></p>';

const PERSON_SLOTS = /\{(שם|תפקיד|מוסד|עיר)\}/;

/* ───────────── לוח ההפצה: פעולות ───────────── */

function getMeta() {
  const C = contacts_();
  const uniq = (k) => Array.from(new Set(C.rows.map((p) => String(p.rec[k] || '').trim()).filter(Boolean))).sort();
  const daily = PropertiesService.getScriptProperties().getProperty('daily');
  return {
    me: Session.getEffectiveUser().getEmail(),
    quota: MailApp.getRemainingDailyQuota(),
    types: uniq('סוג'), groups: uniq('קבוצה'), cities: uniq('עיר / רשות'),
    tpls: templates_().map((t) => ({ id: t.id, name: t.name })),
    daily: daily ? JSON.parse(daily) : null,
    hourly: ScriptApp.getProjectTriggers().some((t) => t.getHandlerFunction() === 'checkReplies'),
    summary: summary_(C),
  };
}

function preview(opts) {
  const C = contacts_();
  const tpls = templates_();
  if (!tpls.length) throw new Error('בלשונית "גרסאות" עוד אין נוסח. מדביקים את המכתב בעמודה "גוף המכתב".');
  const cfg = settings_();
  const sel = select_(opts, C);
  const byTpl = {};
  const warn = [];
  sel.list.forEach((p) => {
    const t = pickTpl_(p.rec, opts.version, tpls);
    const key = t ? t.id + ' · ' + t.name : 'בלי גרסה';
    byTpl[key] = (byTpl[key] || 0) + 1;
  });
  const personal = opts.mode !== 'bcc';
  if (!personal && tpls.some((t) => PERSON_SLOTS.test(t.body) || PERSON_SLOTS.test(t.subject))) {
    warn.push('במייל קבוצתי השדות {שם}, {תפקיד}, {מוסד} ו-{עיר} יוצאים ריקים, ו-{פנייה} הוא "שלום רב,".');
  }
  if (yes_(cfg['צירוף החוברת כקובץ']) && !cfg['קובץ החוברת ב-Drive']) warn.push('חסר קישור לקובץ החוברת ב-Drive (בהגדרות).');
  if (!cfg['קישור לחוברת'] && !yes_(cfg['צירוף החוברת כקובץ'])) warn.push('עוד אין קישור לחוברת ואין קובץ מצורף (בהגדרות).');
  const quota = MailApp.getRemainingDailyQuota();
  const max = Math.max(0, Math.min(Number(opts.max) || quota, quota));
  const first = sel.list[0];
  let sample = '';
  if (first) {
    const t = pickTpl_(first.rec, opts.version, tpls);
    if (t) { const m = compose_(t, first.rec, personal, cfg); sample = '<div style="font:13px Arial;color:#555;margin-bottom:6px" dir="rtl">נושא: <b>' + esc_(m.subject) + '</b></div>' + m.htmlBody.replace('cid:begoodlogo', 'data:image/png;base64,' + LOGO_B64); }
  }
  const willSend = personal ? Math.min(sel.list.length, max) : Math.min(sel.list.length, Math.max(0, max - Math.ceil(max / bccSize_(cfg))));
  return {
    count: sel.list.length, willSend: willSend, quota: quota, stat: sel.stat, byTpl: byTpl, warn: warn, sample: sample,
    names: sel.list.slice(0, 12).map((p) => (p.rec['שם'] || p.rec['מוסד'] || '') + ' · ' + p.rec['דוא"ל']),
  };
}

function bccSize_(cfg) {
  return Math.max(1, Math.min(90, Number(cfg['נמענים בכל מייל קבוצתי']) || 40));
}

function sendTest(opts) {
  const C = contacts_();
  const tpls = templates_();
  const cfg = settings_();
  const to = EMAIL_RE.test(cfg['כתובת לשליחת ניסיון']) ? cfg['כתובת לשליחת ניסיון'] : Session.getEffectiveUser().getEmail();
  const sel = select_(opts, C);
  const rec = sel.list[0] ? sel.list[0].rec : { 'שם': 'שם לדוגמה', 'מוסד': 'מוסד לדוגמה', 'תפקיד': 'תפקיד', 'עיר / רשות': 'עיר' };
  const personal = opts.mode !== 'bcc';
  const used = {};
  const att = attachment_(cfg);
  let n = 0;
  (opts.version && opts.version !== 'auto' ? [pickTpl_(rec, opts.version, tpls)] : tpls).forEach((t) => {
    if (!t || used[t.id]) return;
    used[t.id] = 1;
    const m = compose_(t, rec, personal, cfg);
    GmailApp.sendEmail(to, '[ניסיון · גרסה ' + t.id + '] ' + m.subject, m.plain, mailOpts_(cfg, { htmlBody: m.htmlBody, attachments: att ? [att] : [] }));
    n++;
  });
  return 'נשלחו ' + n + ' מיילים לניסיון אל ' + to + '.';
}

function send(opts) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw new Error('שליחה אחרת רצה עכשיו. אפשר לנסות שוב בעוד דקה.');
  try { return send_(opts); } finally { lock.releaseLock(); }
}

function send_(opts) {
  const C = contacts_();
  const tpls = templates_();
  if (!tpls.length) throw new Error('בלשונית "גרסאות" עוד אין נוסח.');
  const cfg = settings_();
  const att = attachment_(cfg);
  const sel = select_(opts, C);
  let quota = MailApp.getRemainingDailyQuota();
  let budget = Math.min(Number(opts.max) || quota, quota);
  const personal = opts.mode !== 'bcc';
  const now = new Date();
  let sent = 0;
  let failed = 0;
  const notes = [];
  const extra = att ? { attachments: [att] } : {};

  if (personal) {
    for (let i = 0; i < sel.list.length && budget > 0; i++) {
      const p = sel.list[i];
      const t = pickTpl_(p.rec, opts.version, tpls);
      if (!t) { notes.push('אין גרסה מתאימה ל-' + p.rec['דוא"ל']); continue; }
      const m = compose_(t, p.rec, true, cfg);
      try {
        GmailApp.sendEmail(String(p.rec['דוא"ל']).trim(), m.subject, m.plain, mailOpts_(cfg, Object.assign({ htmlBody: m.htmlBody }, extra)));
        setCells_(C, p.row, { 'סטטוס': ST.SENT, 'נשלח בתאריך': now, 'אופן שליחה': 'אישי · גרסה ' + t.id, 'גרסה': t.id });
        sent++; budget--;
        Utilities.sleep(700);
      } catch (e) {
        if (/limit|quota|מכסה/i.test(String(e))) { notes.push('המכסה היומית של Gmail נגמרה.'); break; }
        setCells_(C, p.row, { 'סטטוס': ST.FAIL, 'הערות': 'שליחה נכשלה: ' + String(e.message || e).slice(0, 120) });
        failed++;
      }
    }
    if (sent) log_('אישי', opts.version === 'auto' ? 'לפי השורה' : opts.version, sent, '', opts);
  } else {
    const me = Session.getEffectiveUser().getEmail();
    const size = bccSize_(cfg);
    const groups = {};
    sel.list.forEach((p) => {
      const t = pickTpl_(p.rec, opts.version, tpls);
      if (!t) return;
      (groups[t.id] = groups[t.id] || { t: t, list: [] }).list.push(p);
    });
    Object.keys(groups).forEach((id) => {
      const g = groups[id];
      const m = compose_(g.t, {}, false, cfg);
      let i = 0;
      while (i < g.list.length && budget > 1) {
        const chunk = g.list.slice(i, i + Math.min(size, budget - 1));
        i += chunk.length;
        try {
          GmailApp.sendEmail(me, m.subject, m.plain, mailOpts_(cfg, Object.assign({
            htmlBody: m.htmlBody, bcc: chunk.map((p) => String(p.rec['דוא"ל']).trim()).join(','),
          }, extra)));
        } catch (e) {
          notes.push(/limit|quota/i.test(String(e)) ? 'המכסה היומית של Gmail נגמרה.' : 'מייל קבוצתי נכשל: ' + String(e.message || e).slice(0, 120));
          break;
        }
        chunk.forEach((p) => setCells_(C, p.row, { 'סטטוס': ST.SENT, 'נשלח בתאריך': now, 'אופן שליחה': 'קבוצתי בעותק מוסתר · גרסה ' + id, 'גרסה': id }));
        sent += chunk.length;
        budget -= chunk.length + 1;
        log_('קבוצתי בעותק מוסתר', id, chunk.length, m.subject, opts);
        Utilities.sleep(1200);
      }
    });
  }
  const left = select_(Object.assign({}, opts, { source: opts.source, onlyNew: true }), contacts_()).list.length;
  return { sent: sent, failed: failed, left: left, quota: MailApp.getRemainingDailyQuota(), notes: notes };
}

function log_(mode, version, n, subject, opts) {
  const who = opts.source === 'selection' ? 'שורות שסומנו' : [opts.type, opts.group, opts.city].filter(Boolean).join(' · ') || 'כולם';
  sheet_(SH.L).appendRow([new Date(), mode, version, n, subject, who, '']);
}

/* ───────────── שליחה מדורגת: ממשיכים כל בוקר ───────────── */

function startDaily(opts) {
  stopDaily();
  PropertiesService.getScriptProperties().setProperty('daily', JSON.stringify(Object.assign({}, opts, { source: 'filter', onlyNew: true })));
  ScriptApp.newTrigger('dailyRun').timeBased().everyDays(1).atHour(9).inTimezone('Asia/Jerusalem').create();
  return 'מחר בבוקר, ובכל בוקר, יישלחו עוד מיילים לפי המכסה היומית, עד שכל מי שבסינון יקבל. בסוף כל יום נשלח אלייך סיכום.';
}

function stopDaily() {
  ScriptApp.getProjectTriggers().forEach((t) => { if (t.getHandlerFunction() === 'dailyRun') ScriptApp.deleteTrigger(t); });
  PropertiesService.getScriptProperties().deleteProperty('daily');
  return 'השליחה היומית הופסקה.';
}

function dailyRun() {
  const raw = PropertiesService.getScriptProperties().getProperty('daily');
  if (!raw) return stopDaily();
  const opts = JSON.parse(raw);
  const quota = MailApp.getRemainingDailyQuota();
  const r = send_(Object.assign({}, opts, { max: Math.max(0, quota - 2) }));
  const me = Session.getEffectiveUser().getEmail();
  const done = r.left === 0;
  if (done) stopDaily();
  MailApp.sendEmail(me, 'Begood · הפצה: נשלחו היום ' + r.sent,
    'נשלחו היום: ' + r.sent + '\nנשארו בסינון: ' + r.left + (done ? '\n\nכולם קיבלו. השליחה היומית הסתיימה.' : '') +
    (r.notes.length ? '\n\n' + r.notes.join('\n') : '') + '\n\nהגיליון: ' + SpreadsheetApp.getActiveSpreadsheet().getUrl());
}

/* ───────────── מעקב: מענים ומיילים שחזרו ───────────── */

const OFF_RE = /(^|\s|")(הסר|הסירו|להסיר|הסירי|הסרה)(\s|$|"|\.|!)|unsubscribe|remove me/i;

function fromAddr_(s) {
  const m = String(s).match(/<([^>]+)>/);
  return norm_(m ? m[1] : s);
}

function checkReplies() {
  const C = contacts_();
  const props = PropertiesService.getScriptProperties();
  const sent = C.rows.filter((p) => String(p.rec['סטטוס']).trim() === ST.SENT && EMAIL_RE.test(norm_(p.rec['דוא"ל'])));
  let start = Number(props.getProperty('replyCursor') || 0);
  if (start >= sent.length) start = 0;
  const t0 = Date.now();
  let found = 0;
  let off = 0;
  let i = start;
  for (; i < sent.length && Date.now() - t0 < 4.5 * 60 * 1000; i++) {
    const p = sent[i];
    const e = norm_(p.rec['דוא"ל']);
    const d = p.rec['נשלח בתאריך'] instanceof Date ? p.rec['נשלח בתאריך'] : new Date(Date.now() - 60 * 864e5);
    const after = Utilities.formatDate(new Date(d.getTime() - 864e5), 'Asia/Jerusalem', 'yyyy/MM/dd');
    const threads = GmailApp.search('from:' + e + ' after:' + after + ' -in:sent', 0, 3);
    if (!threads.length) continue;
    let msg = null;
    threads.forEach((th) => th.getMessages().forEach((m) => {
      if (fromAddr_(m.getFrom()) === e && m.getDate() >= d && (!msg || m.getDate() < msg.getDate())) msg = m;
    }));
    if (!msg) continue;
    const text = msg.getPlainBody().split(/\n>|\nOn .*wrote:|\nב.*כתב/)[0].replace(/\s+/g, ' ').trim();
    const url = 'https://mail.google.com/mail/u/0/#all/' + msg.getThread().getId();
    const isOff = OFF_RE.test(text.slice(0, 300));
    setCells_(C, p.row, {
      'סטטוס': isOff ? ST.OFF : ST.REPLIED, 'ענה בתאריך': msg.getDate(),
      'קישור למענה': '=HYPERLINK("' + url + '","פתיחה ב-Gmail")', 'תקציר המענה': text.slice(0, 220),
    });
    if (isOff) { sheet_(SH.X).appendRow([e, new Date(), 'השיב/ה "הסר"']); off++; } else found++;
  }
  props.setProperty('replyCursor', String(i >= sent.length ? 0 : i));
  const bounced = checkBounces_(C);
  return { replied: found, off: off, bounced: bounced, checked: i - start, total: sent.length };
}

function checkBounces_(C) {
  const sentMap = {};
  C.rows.forEach((p) => { if (String(p.rec['סטטוס']).trim() === ST.SENT) sentMap[norm_(p.rec['דוא"ל'])] = p.row; });
  let n = 0;
  GmailApp.search('from:(mailer-daemon OR postmaster) newer_than:21d', 0, 60).forEach((th) => th.getMessages().forEach((m) => {
    const body = m.getPlainBody().toLowerCase();
    (body.match(/[^\s<>():;,"']+@[^\s<>():;,"']+\.[a-z]{2,}/g) || []).forEach((addr) => {
      const row = sentMap[norm_(addr)];
      if (row) {
        setCells_(C, row, { 'סטטוס': ST.FAIL, 'הערות': 'המייל חזר (' + Utilities.formatDate(m.getDate(), 'Asia/Jerusalem', 'dd.MM.yy') + '). כדאי לבדוק את הכתובת.' });
        delete sentMap[norm_(addr)];
        n++;
      }
    });
  }));
  return n;
}

function checkRepliesMenu() {
  const r = checkReplies();
  SpreadsheetApp.getUi().alert('נבדקו ' + r.checked + ' מתוך ' + r.total + ' שקיבלו.\n\nמענים חדשים: ' + r.replied +
    '\nביקשו הסרה: ' + r.off + '\nמיילים שחזרו: ' + r.bounced + (r.checked < r.total ? '\n\nהבדיקה תמשיך מהמקום הזה בפעם הבאה.' : ''));
}

function toggleHourly(on) {
  ScriptApp.getProjectTriggers().forEach((t) => { if (t.getHandlerFunction() === 'checkReplies') ScriptApp.deleteTrigger(t); });
  if (on) ScriptApp.newTrigger('checkReplies').timeBased().everyHours(1).create();
  return on ? 'המענים נבדקים מעכשיו כל שעה.' : 'הבדיקה כל שעה הופסקה.';
}

/* ───────────── סיכום ───────────── */

function summary_(C) {
  const out = { total: 0, byStatus: {}, byType: {} };
  C.rows.forEach((p) => {
    if (!p.rec['דוא"ל'] && !p.rec['שם'] && !p.rec['מוסד']) return;
    out.total++;
    const s = String(p.rec['סטטוס'] || '').trim() || ST.NEW;
    out.byStatus[s] = (out.byStatus[s] || 0) + 1;
    const t = String(p.rec['סוג'] || '').trim() || 'בלי סוג';
    const bt = out.byType[t] = out.byType[t] || { total: 0, sent: 0, replied: 0 };
    bt.total++;
    if (s === ST.SENT || s === ST.REPLIED || s === ST.OFF) bt.sent++;
    if (s === ST.REPLIED) bt.replied++;
  });
  return out;
}

function summaryMenu() {
  const s = summary_(contacts_());
  const lines = ['סך הכול: ' + s.total, ''];
  Object.keys(s.byStatus).forEach((k) => lines.push(k + ': ' + s.byStatus[k]));
  lines.push('', 'לפי סוג (קיבלו · ענו):');
  Object.keys(s.byType).forEach((k) => lines.push(k + ': ' + s.byType[k].sent + ' מתוך ' + s.byType[k].total + ' · ' + s.byType[k].replied + ' ענו'));
  SpreadsheetApp.getUi().alert(lines.join('\n'));
}

/* ───────────── ייבוא אנשי קשר ───────────── */

const ALIASES = {
  'דוא"ל': ['דוא"ל', 'דואל', 'דוא״ל', 'מייל', 'אימייל', 'email', 'e-mail', 'mail', 'כתובת דוא"ל', 'כתובת מייל'],
  'שם': ['שם', 'שם מלא', 'name', 'full name', 'איש קשר', 'שם איש הקשר', 'שם המנהל', 'שם המנהלת', 'מנהל/ת'],
  'תפקיד': ['תפקיד', 'role', 'title', 'job title'],
  'מוסד': ['מוסד', 'שם המוסד', 'בית ספר', 'ארגון', 'עמותה', 'organization', 'institution', 'שם בית הספר'],
  'סוג': ['סוג', 'סוג מוסד', 'type', 'קטגוריה'],
  'עיר / רשות': ['עיר / רשות', 'עיר', 'רשות', 'יישוב', 'ישוב', 'city', 'רשות מקומית'],
  'מחוז': ['מחוז', 'district'],
  'טלפון': ['טלפון', 'phone', 'טל', 'טל.', 'טלפון במשרד'],
  'נייד': ['נייד', 'טלפון נייד', 'mobile', 'cell'],
  'אתר': ['אתר', 'website', 'url', 'אתר אינטרנט'],
  'מקור המידע': ['מקור המידע', 'מקור', 'source'],
  'קבוצה': ['קבוצה', 'group', 'רשימה'],
  'גרסה': ['גרסה', 'version'],
  'הערות': ['הערות', 'notes', 'הערה'],
};

function openImport() {
  const html = HtmlService.createHtmlOutput(IMPORT_HTML).setWidth(620).setHeight(520);
  SpreadsheetApp.getUi().showModalDialog(html, 'ייבוא אנשי קשר');
}

function parseTable_(text) {
  const t = String(text || '').replace(/\r/g, '');
  const delim = t.indexOf('\t') >= 0 ? '\t' : ',';
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) {
      if (ch === '"' && t[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch;
    } else if (ch === '"' && cell === '') q = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => String(c).trim()));
}

function importContacts(text, extra) {
  const rows = parseTable_(text);
  if (rows.length < 2) throw new Error('כדי לייבא, מדביקים שורת כותרות ולפחות שורה אחת של אנשי קשר.');
  const head = rows[0].map((h) => String(h).trim().toLowerCase());
  const map = {};
  Object.keys(ALIASES).forEach((col) => {
    const i = head.findIndex((h) => ALIASES[col].some((a) => a.toLowerCase() === h));
    if (i >= 0) map[col] = i;
  });
  if (!('דוא"ל' in map)) throw new Error('לא נמצאה עמודת דוא"ל בשורת הכותרות (למשל: דוא"ל, מייל, email).');
  const C = contacts_();
  const byEmail = {};
  C.rows.forEach((p) => { const e = norm_(p.rec['דוא"ל']); if (e) byEmail[e] = p; });
  const sup = suppressed_();
  let added = 0, updated = 0, skipped = 0;
  const fresh = [];
  rows.slice(1).forEach((r) => {
    const rec = {};
    Object.keys(map).forEach((col) => { rec[col] = String(r[map[col]] == null ? '' : r[map[col]]).trim(); });
    if (extra && extra.group && !rec['קבוצה']) rec['קבוצה'] = extra.group;
    if (extra && extra.type && !rec['סוג']) rec['סוג'] = extra.type;
    if (extra && extra.source && !rec['מקור המידע']) rec['מקור המידע'] = extra.source;
    const e = norm_(rec['דוא"ל']);
    if (!EMAIL_RE.test(e) || sup[e]) { skipped++; return; }
    rec['דוא"ל'] = e;
    const old = byEmail[e];
    if (old) {
      const fill = {};
      Object.keys(rec).forEach((k) => { if (rec[k] && !String(old.rec[k] || '').trim()) fill[k] = rec[k]; });
      if (Object.keys(fill).length) { setCells_(C, old.row, fill); updated++; } else skipped++;
      return;
    }
    rec['סטטוס'] = ST.NEW;
    byEmail[e] = { rec: rec };
    fresh.push(COLS.map((c) => rec[c] || ''));
    added++;
  });
  if (fresh.length) C.sheet.getRange(C.sheet.getLastRow() + 1, 1, fresh.length, COLS.length).setValues(fresh);
  return 'נוספו ' + added + ' · עודכנו ' + updated + ' · דולגו ' + skipped + ' (כפולים, בלי כתובת תקינה, או ברשימת ההסרות).';
}

/* ───────────── ממשק ───────────── */

function openSidebar() {
  const html = HtmlService.createHtmlOutput(SIDEBAR_HTML).setTitle('📮 הפצת החוברת');
  SpreadsheetApp.getUi().showSidebar(html);
}

const BASE_CSS = '<style>' +
  'body{font-family:Arial,Helvetica,sans-serif;direction:rtl;color:#1f2a37;font-size:13px;margin:0;padding:12px}' +
  'h3{font-size:14px;margin:16px 0 6px;color:#1d3f63}' +
  '.card{border:1px solid #dde3ea;border-top:2px solid #2bb3b1;border-radius:10px;padding:10px;margin-bottom:10px;background:#fff}' +
  'label{display:block;margin:5px 0}select,input[type=number],input[type=text],textarea{width:100%;box-sizing:border-box;border:1px solid #cfd8e3;border-radius:8px;padding:6px;font:inherit}' +
  'button{border-radius:999px;border:1px solid #1d3f63;background:#fff;color:#1d3f63;padding:7px 14px;font-weight:600;cursor:pointer;margin:3px 0 3px 4px;font:inherit;font-weight:600}' +
  'button.main{background:#1d3f63;color:#fff}button.red{border-color:#b42318;color:#b42318}button:disabled{opacity:.5}' +
  '.muted{color:#6b7785;font-size:12px}.warn{color:#9a5b00}.ok{color:#14743b}.err{color:#b42318}' +
  'iframe{width:100%;height:340px;border:1px solid #dde3ea;border-radius:8px;background:#fff}' +
  '.row{display:flex;gap:6px}.row>*{flex:1}' +
  '</style>';

const SIDEBAR_HTML = BASE_CSS + `
<div id="quota" class="muted">טוען…</div>

<div class="card">
<h3>1. למי שולחים</h3>
<label><input type="radio" name="src" value="filter" checked> לפי סינון</label>
<label><input type="radio" name="src" value="selection"> השורות שסימנתי בגיליון</label>
<div id="filterBox">
<label>סוג<select id="type"></select></label>
<label>קבוצה<select id="group"></select></label>
<label>עיר / רשות<select id="city"></select></label>
<label><input type="checkbox" id="onlyNew" checked> רק מי שעוד לא קיבל/ה</label>
</div>
<div id="selBox" style="display:none">
<div class="muted">מסמנים שורות בלשונית "אנשי קשר" (אפשר כמה טווחים עם Ctrl), ואז לוחצים "תצוגה מקדימה".</div>
<label><input type="checkbox" id="resend"> לשלוח שוב גם למי שכבר קיבל/ה</label>
</div>
</div>

<div class="card">
<h3>2. איזה נוסח</h3>
<select id="version"></select>
<h3>3. איך שולחים</h3>
<label><input type="radio" name="mode" value="personal" checked> מייל אישי לכל אחד/ת, עם השם</label>
<label><input type="radio" name="mode" value="bcc"> מייל קבוצתי בעותק מוסתר (לא רואים זה את זה)</label>
<label>כמה לשלוח עכשיו (עד המכסה היומית)<input type="number" id="max" min="1"></label>
</div>

<div>
<button onclick="doPreview()">👁 תצוגה מקדימה</button>
<button onclick="doTest()">✉ ניסיון אליי</button>
<button class="main" onclick="askSend()">📮 שליחה</button>
</div>
<div id="confirm" class="card" style="display:none"></div>
<div id="msg"></div>
<div id="prev"></div>

<div class="card">
<h3>שליחה מדורגת</h3>
<div class="muted">Gmail מגביל את מספר הנמענים ביום. אפשר להמשיך לבד כל בוקר ב-9:00 לפי הסינון שבחרת, עד שכולם יקבלו.</div>
<div id="dailyState" class="muted"></div>
<button onclick="doDaily(true)">🌅 להמשיך כל בוקר</button>
<button class="red" onclick="doDaily(false)">עצירה</button>
</div>

<div class="card">
<h3>מעקב</h3>
<div id="sum" class="muted"></div>
<button onclick="doCheck()">🔎 בדיקת מענים עכשיו</button>
<label><input type="checkbox" id="hourly" onchange="doHourly(this.checked)"> לבדוק לבד כל שעה</label>
</div>

<script>
var META=null;
function $(id){return document.getElementById(id);}
function radio(n){var r=document.querySelector('input[name='+n+']:checked');return r?r.value:'';}
function opts(){return{source:radio('src'),type:$('type').value,group:$('group').value,city:$('city').value,onlyNew:$('onlyNew').checked,resend:$('resend').checked,version:$('version').value,mode:radio('mode'),max:Number($('max').value)||0};}
function fill(sel,list,all){sel.innerHTML='<option value="">'+all+'</option>'+list.map(function(v){return '<option>'+esc(v)+'</option>';}).join('');}
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
function say(html,cls){$('msg').innerHTML='<div class="'+(cls||'')+'" style="margin:8px 0">'+html+'</div>';}
function fail(e){say(esc(e&&e.message||e),'err');busy(false);}
function busy(b){document.querySelectorAll('button').forEach(function(x){x.disabled=b;});}
document.querySelectorAll('input[name=src]').forEach(function(r){r.onchange=function(){$('filterBox').style.display=radio('src')==='filter'?'':'none';$('selBox').style.display=radio('src')==='selection'?'':'none';};});
function load(){google.script.run.withSuccessHandler(function(m){META=m;
 $('quota').innerHTML='שולחים מ-<b>'+esc(m.me)+'</b> · נשארו היום <b>'+m.quota+'</b> נמענים';
 fill($('type'),m.types,'כל הסוגים');fill($('group'),m.groups,'כל הקבוצות');fill($('city'),m.cities,'כל הערים והרשויות');
 $('version').innerHTML='<option value="auto">לפי הסוג או הגרסה שבשורה</option>'+m.tpls.map(function(t){return '<option value="'+esc(t.id)+'">גרסה '+esc(t.id)+' · '+esc(t.name)+'</option>';}).join('');
 if(!$('max').value)$('max').value=m.quota;
 $('hourly').checked=m.hourly;
 $('dailyState').innerHTML=m.daily?'<span class="ok">פעיל: ממשיכים כל בוקר.</span>':'';
 var s=m.summary,parts=['סך הכול '+s.total];Object.keys(s.byStatus).forEach(function(k){parts.push(k+' '+s.byStatus[k]);});$('sum').innerHTML=parts.join(' · ');
}).withFailureHandler(fail).getMeta();}
function doPreview(cb){busy(true);$('confirm').style.display='none';google.script.run.withSuccessHandler(function(p){busy(false);
 var h='<div class="card"><b>'+p.count+'</b> נמענים מתאימים'+(p.count>p.willSend?' · יישלחו עכשיו <b>'+p.willSend+'</b> (המכסה היומית: '+p.quota+')':'');
 var st=p.stat,ex=[];if(st.already)ex.push(st.already+' כבר קיבלו');if(st.suppressed)ex.push(st.suppressed+' ביקשו הסרה');if(st.invalid)ex.push(st.invalid+' בלי כתובת תקינה');if(st.dup)ex.push(st.dup+' כפולים');
 if(ex.length)h+='<div class="muted">לא נכללו: '+ex.join(' · ')+'</div>';
 h+='<div class="muted">'+Object.keys(p.byTpl).map(function(k){return 'גרסה '+esc(k)+': '+p.byTpl[k];}).join('<br>')+'</div>';
 p.warn.forEach(function(w){h+='<div class="warn">⚠ '+esc(w)+'</div>';});
 if(p.names.length)h+='<div class="muted" style="margin-top:6px">'+p.names.map(esc).join('<br>')+(p.count>p.names.length?'<br>…':'')+'</div>';
 h+='</div>';if(p.sample)h+='<iframe id="fr"></iframe>';$('prev').innerHTML=h;
 if(p.sample){$('fr').srcdoc='<meta charset="utf-8"><body style="margin:10px">'+p.sample+'</body>';}
 if(cb)cb(p);}).withFailureHandler(fail).preview(opts());}
function doTest(){busy(true);google.script.run.withSuccessHandler(function(t){busy(false);say(esc(t),'ok');}).withFailureHandler(fail).sendTest(opts());}
function askSend(){doPreview(function(p){if(!p.willSend){say('אין למי לשלוח לפי הבחירה הזו.','warn');return;}
 var c=$('confirm');c.style.display='';c.innerHTML='לשלוח עכשיו ל-<b>'+p.willSend+'</b> נמענים, '+(radio('mode')==='bcc'?'במייל קבוצתי בעותק מוסתר':'במייל אישי לכל אחד/ת')+'?<br><button class="main" onclick="doSend()">כן, לשלוח</button><button onclick="this.parentNode.style.display=\\'none\\'">ביטול</button>';});}
function doSend(){$('confirm').style.display='none';busy(true);say('שולחים… השליחה נמשכת כדקה לכל 80 מיילים.','muted');
 google.script.run.withSuccessHandler(function(r){busy(false);var h='נשלחו <b>'+r.sent+'</b>'+(r.failed?' · נכשלו '+r.failed:'')+' · נשארו בסינון '+r.left+' · נשארו היום '+r.quota+' נמענים';
 r.notes.forEach(function(n){h+='<br><span class="warn">'+esc(n)+'</span>';});say(h,'ok');load();}).withFailureHandler(fail).send(opts());}
function doDaily(on){busy(true);var f=on?'startDaily':'stopDaily';google.script.run.withSuccessHandler(function(t){busy(false);say(esc(t),'ok');load();}).withFailureHandler(fail)[f](opts());}
function doCheck(){busy(true);say('בודקים ב-Gmail…','muted');google.script.run.withSuccessHandler(function(r){busy(false);say('נבדקו '+r.checked+' מתוך '+r.total+' · מענים חדשים '+r.replied+' · ביקשו הסרה '+r.off+' · חזרו '+r.bounced,'ok');load();}).withFailureHandler(fail).checkReplies();}
function doHourly(on){google.script.run.withSuccessHandler(function(t){say(esc(t),'ok');}).withFailureHandler(fail).toggleHourly(on);}
load();
</script>`;

const IMPORT_HTML = BASE_CSS + `
<div class="muted">מעתיקים טבלה מאקסל או מגיליון (כולל שורת הכותרות) ומדביקים כאן. העמודות מזוהות לפי השם: דוא"ל, שם, תפקיד, מוסד, סוג, עיר, טלפון, נייד, אתר, מקור. כתובת שכבר קיימת לא נוספת פעמיים; פרטים חסרים בה מתמלאים.</div>
<textarea id="t" rows="12" placeholder="למשל:&#10;שם&#9;מוסד&#9;דוא&quot;ל&#9;טלפון"></textarea>
<div class="row">
<label>קבוצה (רשות)<input type="text" id="g" placeholder="למשל: מנהלים צפון"></label>
<label>סוג (רשות)<input type="text" id="ty" list="types" placeholder="למשל: בית ספר יסודי"></label>
</div>
<label>מקור המידע (רשות)<input type="text" id="s" placeholder="למשל: אתר העירייה, 03.11.26"></label>
<datalist id="types">${TYPES.map((t) => '<option>' + t + '</option>').join('')}</datalist>
<button class="main" onclick="go()">ייבוא</button>
<div id="m" style="margin-top:8px"></div>
<script>
function go(){var m=document.getElementById('m');m.textContent='מייבאים…';
google.script.run.withSuccessHandler(function(t){m.className='ok';m.textContent=t;}).withFailureHandler(function(e){m.className='err';m.textContent=e.message||e;})
.importContacts(document.getElementById('t').value,{group:document.getElementById('g').value.trim(),type:document.getElementById('ty').value.trim(),source:document.getElementById('s').value.trim()});}
</script>`;
