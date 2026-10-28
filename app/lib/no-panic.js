// בלי פאניקה! משחק קלפים למוכנות בחירום (22/10/2026), על המסך ולהדפסה.
// "תכין את המשחק הזה עם עיצובים חדשים ומרעננים שלא חוזרים על עצמם כמו במשחקים שכבר עשית. גירסת הדפסה וגירסת מסך"
// מקור אמת אחד לקלפים, לאיורים, לחוקים ולעיצוב הקלף. העיצוב: איורי ריזו (צבע מוסט מקו כהה) על רקע נקודות, פס עליון בדוגמה לכל סוג.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SBE_NOPANIC = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const LOGO = 'assets/begood-logo-sm.webp';

  // ---------- התוכן ----------
  // אירוע: מה קרה. הכנה מראש: 2 נקודות. אלתור: נקודה אחת. אותו מספר = זוג.
  const EVENTS = [
    ['הפסקת חשמל בליל סערה', 'גשם שוטף ורוחות עזות בחוץ, ופתאום כל הבית והרחוב חשוכים לגמרי. השקט בסלון מחריש אוזניים.'],
    ['אין מים ל־12 שעות', 'פותחים את הברז לצחצח שיניים, ויוצאת רק לחישה יבשה: פששש... אין טיפת מים בבניין.'],
    ['האינטרנט נפל', 'האינטרנט בבית נפל ל־24 שעות. אין סרטונים, אין סדרות ואין משחקים ברשת. בהלת מסכים!'],
    ['תקועים במעלית', 'המעלית נעצרה בחריקה בין קומה 2 לקומה 3. איתך השכן הלחוץ והכלב הקטן שלו, שנובח בלי הפסקה.'],
    ['סוללה על 2%', 'באמצע שיחה משפחתית חשובה, המסך מהבהב באדום: הטלפון ייכבה בעוד 30 שניות.'],
    ['טוסט שרוף ועשן במטבח', 'הטוסט נשכח בטוסטר. עשן סמיך ממלא את המטבח, וגלאי העשן בתקרה מצפצף בלי הפסקה.'],
    ['חתך קטן באצבע', 'המכסה החד של קופסת התירס החליק והשאיר חתך קטן באצבע, בדיוק כשהארוחה עולה לשולחן.'],
    ['המפתח נתקע במנעול', 'שתיים בלילה, חוזרים הביתה מאירוע, והמפתח נתקע בחור המנעול ולא זז אפילו מילימטר.'],
    ['פנצ\'ר בערב גשום', 'חבטה מהגלגל הימני, הרכב מתחיל לרעוד, ובחוץ חושך וגשם. עוצרים בשולי הדרך.'],
    ['הגז נגמר בערב שישי', 'הסירים רותחים, האורחים מגיעים בעוד 45 דקות, ופתאום הלהבות בכיריים כבות בבת אחת.'],
    ['נזילה מהתקרה', 'טיפ... טיפ... טיפ... מים מתחילים לטפטף מהתקרה, בדיוק מעל הכורסה האהובה בסלון.'],
    ['רעידת אדמה קלה', 'הרצפה רועדת קלות, הכוסות בארון מקשקשות, והמנורה בסלון מתנדנדת הלוך וחזור.'],
    ['גל חום של 42 מעלות', 'חמסין לוהט בחוץ, המזגן קפץ בגלל עומס בחשמל, והבית הופך לסאונה.'],
    ['יוצאים מהבניין', 'צוותי העירייה מבקשים ברמקול מכל הדיירים לצאת מהבניין ברוגע, בגלל תקלה בצנרת בצומת הסמוך.'],
    ['אורחים בהפתעה', 'ארבעה חברים רעבים קופצים לביקור בחג. כל החנויות סגורות, והמקרר נראה ריק.'],
    ['סתימה בכיור', 'המים בכיור המטבח לא יורדים. הם עולים, עולים, ומתקרבים לשפה.'],
    ['חום באמצע הלילה', 'שלוש לפנות בוקר. מישהו בבית קודח מחום ורועד, ובית המרקחת התורן רחוק מאוד.'],
    ['הדלת לא נפתחת', 'רוצים לצאת מהחדר, אבל הדלת נתקעת במשהו כבד שמונח מאחוריה.'],
    ['חיות מבוהלות מרעמים', 'רעם חזק מרעיד את התריסים. הכלב רועד מתחת למיטה, והחתול קופץ על הווילונות.'],
    ['חדשות בלי מסכים', 'יש הודעה חשובה של העירייה על מזג האוויר, אבל המסכים כבויים ואין קליטה בבית.']
  ];
  const READY = [
    ['פנס ותה חם', 'שלפת את פנס החירום הנטען מהמגירה הקבועה, ומזגת תה חם מתרמוס שהוכן מראש. אווירה נעימה ומנחמת!'],
    ['מים בבקבוקים ודלי', 'שלפת שישיית מים מהמזווה ודלי מים שמילאת מראש. צחצוח שיניים ושטיפה קלה, בנחת.'],
    ['משחקי קופסה וערב משפחתי', 'הוצאתם משחקי קופסה וחפיסת קלפים, וגיליתם כמה כיף לשחק יחד בלי מסכים.'],
    ['לחצן מצוקה ורוגע', 'לחצת על לחצן המצוקה, דיווחת ברוגע, שלפת בקבוק מים וחטיף, והרגעת את השכן ואת הכלב.'],
    ['מטען נייד טעון', 'חיברת מטען נייד שהטענת מראש, עם הכבל המתאים, מהכיס הקבוע בתיק.'],
    ['מנתקים, מאווררים ומטף', 'ניתקת את הטוסטר מהחשמל, פתחת חלונות, ובדקת שהמטף בבית נגיש ותקין.'],
    ['ערכת עזרה ראשונה', 'שלפת מארון התרופות ערכה מסודרת: חיטוי, פד וגזה ופלסטר. האצבע מטופלת, והארוחה ממשיכה.'],
    ['מפתח אצל השכנים', 'השארת מראש מפתח נוסף אצל השכנים שסומכים עליהם. תוך 3 דקות היית בבית, בפיג\'מה ובמיטה.'],
    ['אפוד זוהר ומשולש', 'לבשת אפוד זוהר, הצבת משולש אזהרה, וניפחת את הגלגל עם משאבה ניידת.'],
    ['כירה ניידת', 'שלפת כירה ניידת עם מיכל קטן, וסיימת את הבישול כמו שף שמוכן לכל אתגר.'],
    ['גיגית והזזת רהיטים', 'הנחת גיגית רחבה מתחת לטפטוף, והזזת את הכורסה והשטיח למקום יבש.'],
    ['מחסה מתחת לשולחן', 'התרחקת מחלונות וממראות, נכנסת מתחת לשולחן כבד ואחזת ברגל שלו עד שהרעידה עברה.'],
    ['תריסים ומאוורר נטען', 'סגרת תריסים בשעות החמות, שתית מים קרים, והפעלת מאוורר נטען בחדר מוצל.'],
    ['תיק חירום מוכן', 'לקחת את תיק החירום מהמקום הקבוע: מסמכים, תרופות, מטען ומים, ויצאת ברוגע תוך 90 שניות.'],
    ['מזווה חירום', 'שימורי טונה ותירס, רוטב עגבניות ופסטה מהמזווה, ותוך רבע שעה יש ארוחה חגיגית לכולם.'],
    ['ברז ומשאבת כיור', 'סגרת את הברז שמתחת לכיור, ופתחת את הסתימה עם משאבת הכיור תוך שתי דקות.'],
    ['מדחום ותרופות בתוקף', 'שלפת מארון התרופות מדחום דיגיטלי ותרופה מוכרת להורדת חום, בתוקף ובמקום הקבוע.'],
    ['מעברים פנויים', 'המעברים והדלתות בבית פנויים מראש מארגזים ומחוטים, והדרך החוצה פתוחה.'],
    ['פינה רגועה לחיות', 'הכנסת את הכלב והחתול לחדר פנימי, סגרת תריסים, פרסת שמיכה מוכרת וליטפת בקול רך.'],
    ['רדיו על סוללות', 'הדלקת רדיו קטן שעובד על סוללות רגילות, ושמעת את ההודעה הרשמית בקול צלול.']
  ];
  const IMPRO = [
    ['מצתים ובוהן כואבת', 'הדלקת 40 מצתים, גילית שאין סוללות באף שלט, ובדרך למטבח נתקלת עם הבוהן ברגל השולחן. אאוץ\'!'],
    ['צחצוח בסודה לימון', 'צחצחת שיניים בסודה בטעם לימון, ושטפת פנים במים מקוביות קרח שהפשרת בצלחת.'],
    ['הראוטר 27 פעמים', 'כיבית והדלקת את הראוטר שוב ושוב, ולבסוף ישבת שעה בחושך וניהלת שיחה עמוקה עם המקרר.'],
    ['"הצילו" אל הפיר', 'צעקת "הצילו" אל הפיר החשוך, וניסית לפתוח את דלתות הפלדה עם כרטיס קופת חולים, כמו בסרטים.'],
    ['בהירות אפס והודעה קטועה', 'הורדת את הבהירות לאפס ושלחת הודעה בהולה: "תקשיבו, אני ב..." והטלפון כבה.'],
    ['מגבת וקרמל', 'נפנפת על הגלאי עם מגבת מטבח, הפלת כוס, והכרזת: "זה לא שרוף, זה קרמל!"'],
    ['סלוטייפ של חד־קרן', 'עטפת את האצבע בנייר סופג, והדבקת סביבו סלוטייפ צבעוני עם ציורים של חד־קרן.'],
    ['תקועים בין הסדינים', 'ניסית להיכנס דרך מסתור הכביסה של השכנים, ונתקעת בין סדינים תלויים מול כל השכונה.'],
    ['גלגל רזרבי מ־2018', 'פתחת את תא המטען וגילית שהגלגל הרזרבי ריק מאוויר כבר שנים.'],
    ['בישול על הרדיאטור', 'הנחת את הסירים על הרדיאטור והודעת לאורחים: "הערב מגישים קרפצ\'יו חם וספונטני".'],
    ['ספל אספרסו וריצה', 'שמת ספל אספרסו קטן מתחת לטפטוף, ורצת לרוקן אותו בכיור כל 20 שניות.'],
    ['שידור חי וצעקות', 'עמדת באמצע החדר, פתחת שידור חי וצעקת "אתם מרגישים?!", והפלת עציץ מהמדף.'],
    ['הראש במקפיא', 'פתחת את המקפיא ועמדת מולו עם הראש בפנים, עד שכל הארטיקים נמסו.'],
    ['נעליים לא תואמות', 'אספת בבהלה את השלט של הטלוויזיה, נעל בית אחת וכפכף ים, ויצאת בלי מפתחות.'],
    ['קרקר ורוטב סויה', 'הגשת על צלחת חד־פעמית חצי קרקר, זית בודד ורוטב סויה שפג תוקפו מזמן.'],
    ['קולה ומטאטא', 'שפכת בקבוק קולה לכיור, דחפת מקל מטאטא לניקוז, וסדקת את הצינור.'],
    ['אפונה ומדחום של מנגל', 'שמת שקית אפונה קפואה על המצח, וניסית למדוד חום עם מדחום של סטייק.'],
    ['זחילה בין הקופסאות', 'ערמת קופסאות נעליים מאחורי הדלת, וזחלת החוצה דרך הסדק הצר.'],
    ['מרדף אחרי החתול', 'רצת אחרי החתול בכל הסלון, ונכנסת עם הכלב מתחת לשמיכה, רועדים יחד.'],
    ['צעקות מהמרפסת', 'יצאת למרפסת, ניסית להבין את צעקות השכן מהבניין הסמוך, והבנת בדיוק הפוך.']
  ];
  // קלפי פעולה (כחול): עזרה הדדית ושכנות
  const ACTIONS = [
    { id: 'gold', n: 2, title: 'שכנים מזהב', glyph: 'עזרה', text: 'השכנים הגיעו עם חיוך והשאילו בדיוק את מה שחסר! זוג אלתור שלך (נקודה אחת) עולה ל־2 נקודות.' },
    { id: 'battery', n: 2, title: 'סוללת גיבוי חברתית', glyph: 'בונוס', text: 'חברים הביאו בדיוק את מה שחסר! לוקחים עוד 2 קלפים מהקופה.' },
    { id: 'group', n: 1, title: 'קבוצת הבניין', glyph: 'מעבירים', text: 'הודעה חשובה בקבוצת הבניין! כל משתתף/ת מעביר/ה קלף אחד מהיד לשכן/ה משמאל.' },
    { id: 'drill', n: 1, title: 'תרגיל עזרה הדדית', glyph: 'פותרים יחד', text: 'לוקחים אירוע פתוח משולחן הקהילה, מוסיפים לו תגובה מתאימה מהיד, והזוג והנקודות שלך.' }
  ];
  // כרטיסים אישיים: ממלאים בכתב יד (רק בהדפסה)
  const DIY = [
    { kind: 'event', title: 'אירוע מהבית', text: 'אפשר לכתוב כאן אירוע מפתיע שקרה אצלכם בבית או בשכונה...' },
    { kind: 'ready', title: 'הכנה מראש שלנו', text: 'אפשר לכתוב כאן איך התכוננתם מראש, כמו אלופים... (2 נקודות)' },
    { kind: 'impro', title: 'האלתור שלנו', text: 'אפשר לכתוב כאן את האלתור הכי מצחיק שעשיתם... (נקודה אחת)' }
  ];

  const TYPES = {
    event: { name: 'אירוע', c: '#EE7D1E', d: '#9A4B08', t: '#FFF1E2', pat: 'tape' },
    ready: { name: 'הכנה מראש', c: '#2B9C68', d: '#16613F', t: '#E5F6EC', pat: 'solid', pts: 2 },
    impro: { name: 'אלתור', c: '#8A5CC7', d: '#553187', t: '#F1EAFB', pat: 'wave', pts: 1 },
    action: { name: 'פעולה', c: '#1A86B5', d: '#114E72', t: '#E3F2F9', pat: 'dots' },
    diy: { name: 'כרטיס אישי', c: '#5E7381', d: '#2F414C', t: '#F1F5F7', pat: 'dash' }
  };
  const pad = (n) => (n < 10 ? '0' : '') + n;

  // ---------- איורים: ריזוגרף. כל צורה פעמיים: מילוי צבעוני מוסט, וקו כהה מעליו ----------
  const C = { Y: '#F7C23A', B: '#5BB8E0', O: '#F28B2E', G: '#4DB37A', P: '#F4A3B5', V: '#A07ED8', K: '#CBD5DC', W: '#FFFFFF', R: '#E5563D', T: '#2BA8B8', S: '#E8C99A', N: '#5D7D99' };
  const INK = '#1F2A36';
  const cloud = (x, y, s, f) => ['path', { d: `M${x} ${y}a${9 * s} ${9 * s} 0 0 1 ${14 * s}-${7 * s}a${10 * s} ${10 * s} 0 0 1 ${18 * s} ${4 * s}a${7 * s} ${7 * s} 0 0 1 ${2 * s} ${14 * s}h-${30 * s}a${7 * s} ${7 * s} 0 0 1 -${4 * s}-${11 * s}z` }, f];
  const bolt = (x, y, s) => ['path', { d: `M${x} ${y}l-${6 * s} ${12 * s}h${6 * s}l-${4 * s} ${11 * s}l${12 * s}-${15 * s}h-${7 * s}l${4 * s}-${8 * s}z` }, 'Y'];
  const drop = (x, y, s, f) => ['path', { d: `M${x} ${y}c${4 * s} ${6 * s} ${6 * s} ${9 * s} ${6 * s} ${12 * s}a${6 * s} ${6 * s} 0 0 1 -${12 * s} 0c0-${3 * s} ${2 * s}-${6 * s} ${6 * s}-${12 * s}z` }, f || 'B'];
  const L = (d) => ['path', { d }, null]; // קו בלבד
  const thermo = (x, y, s) => [['rect', { x: x - 4 * s, y, width: 8 * s, height: 30 * s, rx: 4 * s }, 'W'], ['circle', { cx: x, cy: y + 34 * s, r: 7 * s }, 'R'], ['rect', { x: x - 1.6 * s, y: y + 12 * s, width: 3.2 * s, height: 20 * s, rx: 1.6 * s }, 'R']];
  const ART = {
    1: [['path', { d: 'M24 50L52 28L80 50Z' }, 'R'], ['rect', { x: 30, y: 50, width: 44, height: 30 }, 'K'], ['rect', { x: 44, y: 57, width: 16, height: 14 }, 'N'], cloud(74, 30, 1.05, 'K'), bolt(96, 40, .9), drop(28, 12, .5), drop(40, 8, .5), drop(104, 66, .5)],
    2: [['rect', { x: 18, y: 26, width: 52, height: 12, rx: 4 }, 'K'], ['path', { d: 'M58 38h14v18h-14z' }, 'K'], ['rect', { x: 30, y: 14, width: 16, height: 10, rx: 3 }, 'B'], ['rect', { x: 36, y: 22, width: 4, height: 6 }, 'K'], drop(65, 62, .55, 'W'), L('M86 54l16 16M102 54l-16 16'), L('M80 78h30')],
    3: [['rect', { x: 28, y: 56, width: 64, height: 20, rx: 6 }, 'K'], ['circle', { cx: 40, cy: 66, r: 3 }, 'R'], ['circle', { cx: 50, cy: 66, r: 3 }, 'Y'], ['rect', { x: 34, y: 42, width: 4, height: 14 }, 'K'], ['rect', { x: 82, y: 42, width: 4, height: 14 }, 'K'], L('M38 34a32 32 0 0 1 44 0'), L('M46 26a20 20 0 0 1 28 0'), ['circle', { cx: 60, cy: 18, r: 4 }, 'T'], L('M92 10l14 14M106 10l-14 14')],
    4: [['rect', { x: 30, y: 8, width: 48, height: 76, rx: 4 }, 'K'], ['rect', { x: 35, y: 18, width: 18, height: 62 }, 'B'], ['rect', { x: 55, y: 18, width: 18, height: 62 }, 'B'], ['path', { d: 'M48 13l6-4l6 4z' }, 'Y'], ['circle', { cx: 94, cy: 68, r: 13 }, 'O'], ['path', { d: 'M82 62l-4-12l12 6z' }, 'O'], ['path', { d: 'M106 62l4-12l-12 6z' }, 'O'], ['circle', { cx: 90, cy: 67, r: 1.8 }, 'K'], ['circle', { cx: 99, cy: 67, r: 1.8 }, 'K'], ['circle', { cx: 94.5, cy: 73, r: 2.6 }, 'N'], L('M84 34l6 4M100 30l-2 8M108 38l-6 4')],
    5: [['rect', { x: 42, y: 6, width: 36, height: 78, rx: 8 }, 'N'], ['rect', { x: 47, y: 16, width: 26, height: 56, rx: 3 }, 'W'], ['rect', { x: 51, y: 36, width: 16, height: 12, rx: 2 }, 'W'], ['rect', { x: 67, y: 39, width: 3, height: 6 }, 'K'], ['rect', { x: 53, y: 38, width: 3, height: 8 }, 'R'], L('M24 30l8 4M22 44h9M24 58l8-4M96 30l-8 4M98 44h-9M96 58l-8-4')],
    6: [['rect', { x: 34, y: 18, width: 14, height: 30, rx: 4 }, 'O'], ['rect', { x: 52, y: 14, width: 14, height: 34, rx: 4 }, 'O'], ['rect', { x: 22, y: 40, width: 76, height: 38, rx: 14 }, 'K'], ['rect', { x: 86, y: 52, width: 14, height: 6, rx: 3 }, 'R'], L('M74 30c-6-6 6-10 0-16s4-10 0-14'), L('M86 34c-6-6 6-10 0-16'), L('M40 14c-4-4 4-7 0-12')],
    7: [['rect', { x: 18, y: 36, width: 36, height: 44, rx: 3 }, 'K'], ['ellipse', { cx: 36, cy: 36, rx: 18, ry: 6 }, 'Y'], ['rect', { x: 22, y: 48, width: 28, height: 18 }, 'G'], ['rect', { x: 66, y: 18, width: 22, height: 62, rx: 11 }, 'P'], ['rect', { x: 70, y: 22, width: 14, height: 10, rx: 4 }, 'W'], L('M66 50l22 0'), drop(98, 36, .45, 'R')],
    8: [['rect', { x: 30, y: 6, width: 62, height: 80, rx: 3 }, 'S'], ['rect', { x: 38, y: 14, width: 46, height: 28, rx: 2 }, 'S'], ['circle', { cx: 80, cy: 54, r: 7 }, 'Y'], ['circle', { cx: 50, cy: 54, r: 11 }, 'Y'], ['circle', { cx: 50, cy: 54, r: 3.5 }, 'S'], ['rect', { x: 60, y: 51.5, width: 18, height: 5 }, 'Y'], L('M96 30l10-4M98 44h12M96 58l10 4')],
    9: [['path', { d: 'M14 62v-12c0-6 4-8 10-8l10-14h46l14 14h8c6 0 10 4 10 10v10z' }, 'B'], ['path', { d: 'M40 30h16v12h-22zM62 30h14l10 12h-24z' }, 'W'], ['circle', { cx: 36, cy: 64, r: 10 }, 'N'], ['ellipse', { cx: 88, cy: 70, rx: 13, ry: 6 }, 'N'], drop(26, 8, .45), drop(60, 4, .45), drop(98, 10, .45)],
    10: [['rect', { x: 30, y: 30, width: 50, height: 28, rx: 4 }, 'R'], ['rect', { x: 22, y: 34, width: 8, height: 6, rx: 2 }, 'R'], ['rect', { x: 80, y: 34, width: 8, height: 6, rx: 2 }, 'R'], ['rect', { x: 26, y: 24, width: 58, height: 6, rx: 3 }, 'K'], ['rect', { x: 14, y: 64, width: 82, height: 10, rx: 3 }, 'K'], ['path', { d: 'M48 64c-4-6 2-8 0-14c6 4 8 8 4 14M62 64c-4-6 2-8 0-14c6 4 8 8 4 14', 'stroke-dasharray': '3 3' }, null], ['rect', { x: 100, y: 40, width: 14, height: 34, rx: 6 }, 'T'], ['rect', { x: 104, y: 34, width: 6, height: 6 }, 'K']],
    11: [['rect', { x: 6, y: 4, width: 108, height: 10 }, 'K'], drop(52, 16, .55), drop(64, 30, .55), drop(56, 42, .5), ['path', { d: 'M30 60h60v16H30z' }, 'V'], ['rect', { x: 22, y: 52, width: 12, height: 26, rx: 5 }, 'V'], ['rect', { x: 86, y: 52, width: 12, height: 26, rx: 5 }, 'V'], ['rect', { x: 34, y: 50, width: 52, height: 12, rx: 5 }, 'P'], ['ellipse', { cx: 60, cy: 84, rx: 18, ry: 3 }, 'B']],
    12: [['rect', { x: 40, y: 14, width: 40, height: 66, rx: 2 }, 'K'], ['rect', { x: 46, y: 22, width: 10, height: 10 }, 'Y'], ['rect', { x: 64, y: 22, width: 10, height: 10 }, 'Y'], ['rect', { x: 46, y: 40, width: 10, height: 10 }, 'B'], ['rect', { x: 64, y: 40, width: 10, height: 10 }, 'Y'], ['rect', { x: 54, y: 62, width: 12, height: 18 }, 'O'], L('M28 24l-6 6l6 6l-6 6M92 24l6 6l-6 6l6 6M30 54l-8 6l8 6M90 54l8 6l-8 6'), L('M20 84h80')],
    13: [['circle', { cx: 48, cy: 42, r: 18 }, 'Y'], L('M48 10v8M48 66v8M16 42h8M72 42h8M25 19l6 6M65 59l6 6M25 65l6-6M65 25l6-6'), ...thermo(92, 14, 1)],
    14: [['rect', { x: 10, y: 20, width: 46, height: 62, rx: 2 }, 'K'], ['rect', { x: 16, y: 28, width: 10, height: 10 }, 'Y'], ['rect', { x: 36, y: 28, width: 10, height: 10 }, 'Y'], ['rect', { x: 26, y: 58, width: 14, height: 24 }, 'O'], ['path', { d: 'M62 50h26v-10l20 18l-20 18v-10h-26z' }, 'G'], L('M66 20l6-4v12zM74 16a8 8 0 0 1 0 12')],
    15: [['circle', { cx: 60, cy: 64, r: 20 }, 'W'], ['circle', { cx: 60, cy: 64, r: 12 }, 'K'], ['rect', { x: 30, y: 48, width: 4, height: 34, rx: 2 }, 'K'], ['rect', { x: 86, y: 48, width: 4, height: 34, rx: 2 }, 'K'], ['circle', { cx: 30, cy: 20, r: 9 }, 'O'], ['circle', { cx: 50, cy: 16, r: 9 }, 'G'], ['circle', { cx: 70, cy: 16, r: 9 }, 'V'], ['circle', { cx: 90, cy: 20, r: 9 }, 'B']],
    16: [['path', { d: 'M16 40h88l-8 34H24z' }, 'K'], ['path', { d: 'M20 44h80l-2 8H22z' }, 'B'], ['rect', { x: 54, y: 12, width: 8, height: 22 }, 'K'], ['path', { d: 'M54 12h28v8h-8' }, null], drop(78, 24, .4), L('M30 30c4-4 8 4 12 0M84 32c4-4 8 4 12 0')],
    17: [['path', { d: 'M40 10a24 24 0 1 0 22 34a18 18 0 1 1 -22 -34z' }, 'Y'], ['circle', { cx: 80, cy: 20, r: 2 }, 'Y'], ['circle', { cx: 100, cy: 34, r: 2 }, 'Y'], ...thermo(88, 40, .9), ['rect', { x: 10, y: 74, width: 64, height: 10, rx: 4 }, 'B'], ['rect', { x: 12, y: 66, width: 16, height: 10, rx: 4 }, 'W']],
    18: [['rect', { x: 40, y: 6, width: 44, height: 80, rx: 2 }, 'S'], ['circle', { cx: 76, cy: 48, r: 3 }, 'K'], ['rect', { x: 18, y: 56, width: 30, height: 28, rx: 2 }, 'Y'], ['rect', { x: 26, y: 34, width: 22, height: 22, rx: 2 }, 'O'], L('M18 70h30M33 56v28'), L('M92 30l10-4M94 44h12')],
    19: [cloud(14, 26, .9, 'K'), bolt(30, 34, .8), ['circle', { cx: 52, cy: 64, r: 15 }, 'O'], ['path', { d: 'M38 56l-6 16l10-4z' }, 'O'], ['path', { d: 'M66 56l6 16l-10-4z' }, 'O'], ['circle', { cx: 92, cy: 56, r: 13 }, 'V'], ['path', { d: 'M81 50l2-14l9 9z' }, 'V'], ['path', { d: 'M103 50l-2-14l-9 9z' }, 'V'], ['circle', { cx: 47, cy: 62, r: 1.8 }, 'K'], ['circle', { cx: 57, cy: 62, r: 1.8 }, 'K'], ['circle', { cx: 87, cy: 55, r: 1.8 }, 'K'], ['circle', { cx: 97, cy: 55, r: 1.8 }, 'K']],
    20: [['rect', { x: 22, y: 34, width: 68, height: 44, rx: 8 }, 'T'], ['circle', { cx: 42, cy: 56, r: 12 }, 'W'], ['circle', { cx: 42, cy: 56, r: 5 }, 'K'], ['rect', { x: 62, y: 44, width: 20, height: 8, rx: 2 }, 'Y'], ['circle', { cx: 66, cy: 66, r: 4 }, 'K'], ['circle', { cx: 78, cy: 66, r: 4 }, 'K'], L('M34 34l-10-24'), L('M98 46a10 10 0 0 1 0 20M104 40a18 18 0 0 1 0 32')]
  };
  const AART = {
    gold: [['path', { d: 'M8 52L30 34L52 52Z' }, 'O'], ['rect', { x: 14, y: 52, width: 32, height: 28 }, 'K'], ['rect', { x: 25, y: 62, width: 10, height: 18 }, 'B'], ['path', { d: 'M68 52L90 34L112 52Z' }, 'G'], ['rect', { x: 74, y: 52, width: 32, height: 28 }, 'K'], ['rect', { x: 85, y: 62, width: 10, height: 18 }, 'B'], ['path', { d: 'M60 10l5 10l11 1.5l-8 7.5l2 11l-10-5.5l-10 5.5l2-11l-8-7.5l11-1.5z' }, 'Y'], L('M46 70c6-6 22-6 28 0')],
    battery: [['rect', { x: 26, y: 26, width: 62, height: 38, rx: 6 }, 'G'], ['rect', { x: 88, y: 38, width: 8, height: 14, rx: 2 }, 'K'], ['rect', { x: 32, y: 32, width: 14, height: 26, rx: 2 }, 'W'], ['rect', { x: 50, y: 32, width: 14, height: 26, rx: 2 }, 'W'], L('M76 38v14M69 45h14'), ['circle', { cx: 20, cy: 80, r: 6 }, 'O'], ['circle', { cx: 40, cy: 80, r: 6 }, 'V'], ['circle', { cx: 60, cy: 80, r: 6 }, 'B'], ['circle', { cx: 80, cy: 80, r: 6 }, 'Y'], ['circle', { cx: 100, cy: 80, r: 6 }, 'P']],
    group: [['path', { d: 'M12 14h56a8 8 0 0 1 8 8v20a8 8 0 0 1-8 8H30l-12 10v-10h-6a8 8 0 0 1-8-8v-20a8 8 0 0 1 8-8z' }, 'G'], ['path', { d: 'M52 44h56a8 8 0 0 1 8 8v18a8 8 0 0 1-8 8h-6v10l-12-10H52a8 8 0 0 1-8-8v-18a8 8 0 0 1 8-8z' }, 'W'], L('M16 28h44M16 38h30M56 58h44M56 68h30')],
    drill: [['rect', { x: 28, y: 12, width: 52, height: 72, rx: 5 }, 'W'], ['rect', { x: 42, y: 6, width: 24, height: 12, rx: 4 }, 'K'], ['circle', { cx: 54, cy: 52, r: 18 }, 'R'], ['circle', { cx: 54, cy: 52, r: 11 }, 'W'], ['circle', { cx: 54, cy: 52, r: 4 }, 'R'], ['path', { d: 'M80 36l18-8l4 8l-18 10z' }, 'Y'], L('M36 24h36')],
    diy: [['path', { d: 'M30 78l6-20l50-50l14 14l-50 50z' }, 'Y'], ['path', { d: 'M86 8l14 14l6-6l-14-14z' }, 'P'], ['path', { d: 'M30 78l6-20l14 14z' }, 'S'], L('M60 84h44'), L('M20 30c6-8 14 8 20 0')]
  };
  // תגים על איור התגובה, כדי לזהות את הסוג גם בלי צבע
  const BADGE = {
    ready: `<g transform="translate(92 62)"><path d="M0 -15l13 5v9c0 9-6 15-13 18c-7-3-13-9-13-18v-9z" fill="#fff" stroke="${INK}" stroke-width="2.6"/><path d="M-6 1l4 4l8-9" fill="none" stroke="#16613F" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></g>`,
    impro: `<g transform="translate(92 62)"><circle r="14" fill="#fff" stroke="${INK}" stroke-width="2.6"/><text y="6" text-anchor="middle" font-family="Rubik,Assistant,Arial,sans-serif" font-weight="800" font-size="17" fill="#553187">?!</text></g>`
  };

  let uid = 0;
  function art(key, kind) {
    const els = typeof key === 'number' ? ART[key] : AART[key];
    if (!els) return '';
    const T = TYPES[kind] || TYPES.event;
    const id = 'np' + (++uid);
    const attr = (o) => Object.keys(o).map((k) => `${k}="${o[k]}"`).join(' ');
    const fills = els.filter((e) => e[2]).map(([t, o, f]) => `<${t} ${attr(o)} fill="${C[f] || f}"/>`).join('');
    const lines = els.map(([t, o]) => `<${t} ${attr(o)} fill="none"/>`).join('');
    return `<svg viewBox="0 0 120 90" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><pattern id="${id}" width="7" height="7" patternUnits="userSpaceOnUse"><circle cx="3.5" cy="3.5" r="1.25" fill="${T.c}" opacity=".32"/></pattern></defs>` +
      `<rect width="120" height="90" fill="${T.t}"/><rect width="120" height="90" fill="url(#${id})"/>` +
      `<g transform="translate(2.6 2.6)" opacity=".92">${fills}</g>` +
      `<g stroke="${INK}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${lines}</g>` +
      (BADGE[kind] || '') + `</svg>`;
  }

  // ---------- הקלפים ----------
  function deck(opts) {
    const o = opts || {};
    const d = [];
    for (let n = 1; n <= 20; n++) {
      d.push({ uid: 'e' + n, kind: 'event', n, title: EVENTS[n - 1][0], text: EVENTS[n - 1][1] });
      d.push({ uid: 'r' + n, kind: 'ready', n, title: READY[n - 1][0], text: READY[n - 1][1], pts: 2 });
      d.push({ uid: 'i' + n, kind: 'impro', n, title: IMPRO[n - 1][0], text: IMPRO[n - 1][1], pts: 1 });
    }
    ACTIONS.forEach((a) => { for (let k = 0; k < a.n; k++) d.push({ uid: 'a' + a.id + k, kind: 'action', act: a.id, title: a.title, text: a.text, glyph: a.glyph }); });
    if (o.diy) DIY.forEach((x, i) => { for (let k = 0; k < 2; k++) d.push({ uid: 'd' + i + k, kind: 'diy', sub: x.kind, title: x.title, text: x.text }); });
    return d;
  }
  function shuffle(a, rnd) { const r = rnd || Math.random; const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }
  const isPair = (a, b) => a && b && ((a.kind === 'event' && (b.kind === 'ready' || b.kind === 'impro') && a.n === b.n) || (b.kind === 'event' && (a.kind === 'ready' || a.kind === 'impro') && a.n === b.n));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // סימן לכל סוג (גם בלי צבע): משולש, מגן, בועה, משושה, עיפרון
  const MARK = {
    event: '<svg viewBox="0 0 24 24"><path d="M12 2.5L22.5 21h-21z" fill="currentColor"/><path d="M12 9v5.5" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><circle cx="12" cy="17.6" r="1.5" fill="#fff"/></svg>',
    ready: '<svg viewBox="0 0 24 24"><path d="M12 2l9 3.5v6.2c0 5.6-3.8 9.4-9 10.8c-5.2-1.4-9-5.2-9-10.8V5.5z" fill="currentColor"/><path d="M7.6 12.2l3 3l6-6.4" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    impro: '<svg viewBox="0 0 24 24"><path d="M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-8l-5 4v-4H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" fill="currentColor"/><text x="12" y="14.6" text-anchor="middle" font-family="Rubik,Arial" font-weight="800" font-size="9.5" fill="#fff">?!</text></svg>',
    action: '<svg viewBox="0 0 24 24"><path d="M12 1.8l9 5.1v10.2l-9 5.1l-9-5.1V6.9z" fill="currentColor"/><path d="M13.2 5.5l-5 7.4h3.6l-1 5.6l5-7.4h-3.6z" fill="#fff"/></svg>',
    diy: '<svg viewBox="0 0 24 24"><path d="M4 20l1.4-5L16 4.4l3.6 3.6L9 18.6z" fill="currentColor"/><path d="M15 5.4l3.6 3.6" stroke="#fff" stroke-width="1.6"/></svg>'
  };
  function cardHTML(c, opt) {
    const o = opt || {};
    const T = TYPES[c.kind];
    const num = c.kind === 'action' ? '⚡' : c.kind === 'diy' ? '#__' : '#' + pad(c.n);
    const pic = c.kind === 'action' ? art(c.act, 'action') : c.kind === 'diy' ? art('diy', 'diy') : art(c.n, c.kind);
    let foot = '';
    if (c.kind === 'event') foot = `<span>מחפשים תגובה ${num}</span>`;
    else if (c.kind === 'ready' || c.kind === 'impro') foot = `<span>מתאים לאירוע ${num}</span><b class="np-pts">${c.pts === 2 ? '2 נקודות' : 'נקודה אחת'}</b>`;
    else if (c.kind === 'action') foot = `<span>אפשר להפעיל בתור, כפעולה</span>`;
    else foot = `<span>${esc(TYPES[c.sub].name)} · מספר: ____</span>`;
    const typeName = c.kind === 'diy' ? 'כרטיס אישי · ' + TYPES[c.sub].name : T.name;
    const body = c.kind === 'diy' ? `<p class="np-tx np-lines">${esc(c.text)}</p>` : `<p class="np-tx">${esc(c.text)}</p>`;
    return `<div class="np-card np-${c.kind}${o.cls ? ' ' + o.cls : ''}" style="--c:${T.c};--d:${T.d};--t:${T.t}" data-uid="${c.uid}">` +
      `<div class="np-band np-pat-${T.pat}"><i class="np-mark">${MARK[c.kind]}</i><span class="np-type">${esc(typeName)}</span><b class="np-num">${num}</b></div>` +
      `<div class="np-art">${pic}</div>` +
      `<h4 class="np-title">${esc(c.title)}</h4>${body}` +
      `<div class="np-foot">${foot}</div><img class="np-logo" src="${LOGO}" alt="Begood"></div>`;
  }
  function backHTML() {
    return `<div class="np-card np-back"><div class="np-back-in"><img src="${LOGO}" alt="Begood"><strong>בלי<br>פאניקה!</strong><span>משחק קלפים למוכנות בחירום</span><div class="np-back-marks">${['event', 'ready', 'impro', 'action'].map((k) => `<i style="color:${TYPES[k].c}">${MARK[k]}</i>`).join('')}</div></div></div>`;
  }

  // עיצוב הקלף: משותף למסך ולהדפסה. גודל לפי font-size של הקלף (1em = רוחב/16)
  const CSS = `
.np-card{position:relative;display:flex;flex-direction:column;width:16em;height:23em;background:#fff;border-radius:1em;overflow:hidden;color:#1F2A36;border:.12em solid var(--d);box-shadow:0 .06em 0 var(--d);font-family:Assistant,Arial,sans-serif;direction:rtl;text-align:right}
.np-band{display:flex;align-items:center;gap:.45em;padding:.5em .7em;background:var(--c);color:#fff;font:800 1em/1 Rubik,Assistant,Arial,sans-serif;position:relative}
.np-pat-tape{background:repeating-linear-gradient(-45deg,var(--c) 0 .9em,var(--d) .9em 1.25em)}
.np-pat-wave{background:radial-gradient(circle at 50% 120%,transparent .55em,var(--c) .58em) 0 0/1.4em 1em,var(--d)}
.np-pat-dots{background:radial-gradient(circle,rgba(255,255,255,.35) .14em,transparent .17em) 0 0/.7em .7em,var(--c)}
.np-pat-dash{background:var(--c);border-bottom:.15em dashed #fff}
.np-band .np-type{background:var(--d);padding:.22em .5em;border-radius:.5em}
.np-mark{display:inline-flex;width:1.6em;height:1.6em;background:#fff;border-radius:50%;padding:.18em;color:var(--d);flex:none}
.np-mark svg{width:100%;height:100%}
.np-num{margin-inline-start:auto;background:#fff;color:var(--d);border-radius:.45em;padding:.2em .42em;font:800 1.05em/1 Rubik,Assistant,Arial,sans-serif;direction:ltr}
.np-art{margin:.55em .6em 0;border-radius:.6em;overflow:hidden;border:.1em solid var(--d);aspect-ratio:4/3;flex:none}
.np-art svg{display:block;width:100%;height:100%}
.np-title{margin:.5em .7em .2em;font:800 1.2em/1.15 Rubik,Assistant,Arial,sans-serif;color:var(--d)}
.np-tx{margin:0 .7em;font:400 .86em/1.38 Assistant,Arial,sans-serif;text-align:right;flex:1;overflow:hidden}
.np-lines{background:repeating-linear-gradient(transparent 0 1.3em,#c9d3da 1.3em 1.36em);color:#7b8b95}
.np-foot{display:flex;align-items:center;justify-content:space-between;gap:.4em;margin:.3em .7em 1.95em;padding-top:.3em;border-top:.08em dashed var(--d);font:700 .74em/1.2 Assistant,Arial,sans-serif;color:var(--d)}
.np-pts{background:var(--c);color:#fff;border-radius:2em;padding:.18em .55em;white-space:nowrap;font-weight:800}
.np-logo{position:absolute;bottom:.4em;left:50%;transform:translateX(-50%);height:1.5em;width:auto}
.np-back{background:#1F2A36;border-color:#1F2A36;align-items:center;justify-content:center}
.np-back::before{content:'';position:absolute;inset:0;background:repeating-linear-gradient(-45deg,#EE7D1E 0 1em,#1F2A36 1em 2.6em);opacity:.9}
.np-back-in{position:relative;background:#fff;border-radius:1em;width:76%;padding:1em .6em;display:flex;flex-direction:column;align-items:center;gap:.4em;text-align:center;box-shadow:.3em .3em 0 #8A5CC7}
.np-back-in img{width:7.5em;height:auto}
.np-back-in strong{font:800 2.3em/1 Rubik,Assistant,Arial,sans-serif;color:#1F2A36}
.np-back-in span{font:700 .8em/1.2 Assistant,Arial,sans-serif;color:#4a5a64}
.np-back-marks{display:flex;gap:.3em}.np-back-marks i{width:1.6em;height:1.6em;display:inline-flex}.np-back-marks svg{width:100%;height:100%}
`;

  const RULES = {
    title: 'בלי פאניקה!',
    sub: 'משחק קלפים למוכנות בחירום · 2 עד 6 משתתפים · מגיל 8 · 20 עד 30 דקות',
    goal: 'בחירום אמיתי אין גיבורי על. יש מי שהכינו מראש פנס, מים ומטען, ויש שכנים שעוזרים זה לזה. במשחק יוצרים זוגות: אירוע מפתיע ותגובה אליו. הכנה מראש שווה 2 נקודות, ואלתור מצחיק שווה נקודה אחת.',
    kinds: [
      ['event', '20', 'בסיס לזוג', 'משהו לא צפוי קרה: הפסקת חשמל, אין מים, חתך באצבע ועוד.'],
      ['ready', '20', '2 נקודות', 'התכוננו מראש עם ציוד, ידע ורוגע, והבעיה נפתרה בקלות.'],
      ['impro', '20', 'נקודה אחת', 'לא התכוננו, ואלתרו פתרון מצחיק. עברנו את זה, וכולם צוחקים.'],
      ['action', '6', 'מיד', 'עזרה הדדית ושכנות: שכנים מזהב, סוללת גיבוי חברתית, קבוצת הבניין ותרגיל עזרה הדדית.'],
      ['diy', '6', 'לפי הסוג', 'כרטיסים ריקים לאירועים ולתגובות שלכם, מהבית ומהשכונה (רק בהדפסה).']
    ],
    ready: ['מערבבים את כל הקלפים ומחלקים 5 קלפים לכל משתתף/ת.', 'פותחים 3 קלפים גלויים במרכז: "שולחן הקהילה".', 'שאר הקלפים הם הקופה, הפוכה במרכז.'],
    turn: [
      ['לוקחים קלף', 'מהקופה, או קלף גלוי משולחן הקהילה. כשלוקחים משולחן הקהילה, פותחים מיד קלף חדש מהקופה במקומו.'],
      ['עושים פעולה אחת לבחירה', '']
    ],
    actions: [
      ['מניחים זוג', 'קלף אירוע וקלף תגובה עם אותו מספר. מקריאים בקול לכולם את האירוע ואת התגובה.'],
      ['מבקשים עזרה מהשכנים', 'מניחים אירוע גלוי במרכז ושואלים: "למי יש פתרון ל...?" מי שיש לו/ה תגובה מתאימה יכול/ה להציע אותה. הזוג והנקודות של מי שביקש/ה, ומי שעזר/ה לוקח/ת 2 קלפים מהקופה. אם אין פתרון, האירוע נשאר פתוח בשולחן הקהילה.'],
      ['מפעילים קלף פעולה', 'מניחים את הקלף הכחול ועושים מה שכתוב בו.'],
      ['מחליפים קלפים', 'מניחים עד 2 קלפים בערימת ההשלכה ולוקחים במקומם מהקופה.']
    ],
    end: 'המשחק נגמר כשמישהו משלים/ה 5 זוגות, או כשהקופה נגמרת. כל אחד/ת סופר/ת את הנקודות בזוגות שלו/ה.',
    modes: [
      ['תחרות ידידותית', 'מי שצבר/ה הכי הרבה נקודות מקבל/ת את התואר "אלופי המוכנות של השכונה". ומי שעזר/ה הכי הרבה פעמים מקבל/ת את התואר "השכנים מזהב".'],
      ['שכונה אחת', 'כולם משחקים יחד, והנקודות של כולם נספרות יחד. המטרה: להגיע יחד ל־30 נקודות לפני שהקופה נגמרת. אפשר לבקש עזרה ולהציע עזרה בכל תור.']
    ],
    after: 'אחרי כל זוג של הכנה מראש אפשר לעצור לרגע: "יש לנו את זה בבית?" ואחרי כל אלתור: "מה הייתה ההכנה מראש?" כך נבנית במשחק רשימת המוכנות שלנו.',
    closingWho: 'בסוף המשחק, מי שמנחה את המשחק שואל/ת את כל המשתתפים, כדי להפוך את המשחק להכנה אמיתית:',
    closing: ['איזו הכנה מראש הכי הצחיקה או הפתיעה אותך?', 'מה מהרשימה כבר יש אצלנו, ומה עוד אפשר להכין השבוע?', 'מי השכנים או החברים שאפשר לפנות אליהם, ומי יכול לפנות אלינו?'],
    print: 'מדפיסים בצבע, עדיף על נייר עבה, וגוזרים לאורך הקו המקווקו. את גב הקלפים מדפיסים על הצד השני של דפי הקלפים. אפשר לעטוף בניילון שקוף כדי שהקלפים יחזיקו מעמד.'
  };
  const TARGET = 30;

  return { EVENTS, READY, IMPRO, ACTIONS, DIY, TYPES, ART, AART, MARK, CSS, RULES, TARGET, LOGO, art, deck, shuffle, isPair, cardHTML, backHTML, pad };
});
