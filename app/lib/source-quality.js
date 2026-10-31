// רמת הראיות והמרחב של כל מקור בספריית המקורות (31/10/2026: "שיפור הספרייה לפי ההנחיה",
// המסמך "Be Good · הנחיה לחיפוש מקורות לספרייה", ובמאגר: docs/sources-library-guideline.md).
//  - level(rec): רמת הראיות לפי סדר העדיפות שבהנחיה: סקירה שיטתית או מטא-אנליזה · ניסוי מבוקר או כמו-ניסויי ·
//    מחקר אורך · מחקר חתך · מחקר איכותני · מחקר בשיפוט עמיתים (המערך לא צוין) · דוח של גוף מוסמך · מקור רקע.
//    "מקור רקע" (ספר, פרק, כלי, דף אתר, טיוטה שלא עברה שיפוט, עבודת גמר) לא עומד בסף לפריט חדש. פריטים כאלה
//    שכבר בספרייה נשארים בה (חלקם מקורות יסוד), ומוצגים אחרי המקורות החזקים.
//    שדה ev ברשומה גובר על ההערכה האוטומטית. ההערכה האוטומטית נשענת על סוג המקור, על הציטוט ועל רשימת כתבי העת
//    (lib/quality-journals.js), ולכן מקור חדש מקבל ev מפורש מהסוכן השבועי.
//  - space(rec, shelf): חינוכי (בית ספר, גן, מורים, תלמידים, הורים), ארגוני (אוניברסיטה, חברה, עובדים, מקום עבודה)
//    או משותף (קהילה, מנהיגות, חוסן בכלל). שדה sp ברשומה גובר.
// רשומה במדף "חוסן חברתי, מנהיגות והנחיה" (lib/resilience-advisor-sources.js): k, g, apa, url, gist, be, ועכשיו גם
//   he (כותרת בעברית), sp, ev, q (נקודה לדיון), tags, oa (גרסת גישה פתוחה). רשומה במדף הסימולציות: אותם שדות חדשים.
// בדיקות: harness/tests/source-quality.test.mjs.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./quality-journals.js'));
  else root.SBE_SRCQ = factory(root.SBE_JOURNALS);
})(typeof self !== 'undefined' ? self : this, function (J) {
  'use strict';
  const LEVELS = [
    { id: 'sr', l: 'סקירה שיטתית או מטא-אנליזה' },
    { id: 'exp', l: 'ניסוי מבוקר או מחקר כמו-ניסויי' },
    { id: 'long', l: 'מחקר אורך' },
    { id: 'cross', l: 'מחקר חתך' },
    { id: 'qual', l: 'מחקר איכותני' },
    { id: 'peer', l: 'מחקר בשיפוט עמיתים' },
    { id: 'rep', l: 'דוח של גוף מוסמך' },
    { id: 'bg', l: 'מקור רקע' }
  ];
  const RANK = {}; LEVELS.forEach((x, i) => { RANK[x.id] = i; });
  const LABEL = {}; LEVELS.forEach((x) => { LABEL[x.id] = x.l; });
  const SPACES = { edu: '🎒 חינוכי', org: '🏢 ארגוני', shared: '↔ משותף' };

  // לא עומדים בסף: טיוטות, עבודות גמר, חומרים שטרם פורסמו
  const RX_DRAFT = /preprint|EGUsphere|arXiv|SSRN|medRxiv|PsyArXiv|EdArXiv|bioRxiv|טרם פורסם|טיוטה/i;
  const RX_THESIS = /dissertation|doctoral thesis|master'?s thesis|\bthesis\b|עבודת דוקטורט|עבודת גמר|עבודת מוסמך/i;
  // מערך המחקר
  const RX_SR = /systematic review|meta-?analy|scoping review|umbrella review|rapid review|evidence synthesis|systematic synthesis|integrative review|meta-?synthesis|Campbell Systematic Reviews|Cochrane Database|סקירה שיטתית|מטא-?אנליזה|מטה-?אנליזה|סקירת היקף/i;
  const RX_EXP = /randomi[sz]ed|\bRCT\b|controlled trial|quasi-?experiment|cluster trial|ניסוי מבוקר|ניסוי אקראי|כמו-?ניסויי|קבוצת ביקורת|קבוצת השוואה/i;
  const RX_LONG = /longitudinal|cohort study|panel study|over \d+ years|מחקר אורך|מחקר עוקבה|מעקב של \d+ שנים/i;
  const RX_QUAL = /qualitative|interviews? (study|with)|focus groups?|case study|ethnograph|phenomenolog|grounded theory|מחקר איכותני|ראיונות עומק|ראיונות עם|קבוצות מיקוד|חקר מקרה|מחקר אתנוגרפי/i;
  const RX_CROSS = /cross-sectional|survey of|national survey|questionnaire|סקר ארצי|סקר בקרב|מחקר חתך|שאלונים? (ל|ב)/i;
  // גופים מוסמכים (לפי ההנחיה): מהם נכנסים דוחות מחקר ומדיניות בלבד
  const RX_BODY = new RegExp([
    'OECD', 'UNESCO', 'IIEP', 'UNICEF', 'Innocenti', '\\bINEE\\b', 'GADRRRES', 'World Bank', 'World Health Organi[sz]ation', '\\bWHO\\b',
    '\\bRAND\\b', 'Education Endowment Foundation', '\\bEEF\\b', 'Global TIES', 'Brookings', 'UNDRR', '\\bIFRC\\b', '\\bILO\\b',
    'International Labour', 'Gallup', 'McKinsey Health Institute', 'Deloitte', '\\bSHRM\\b', '\\bCIPD\\b', 'Business Continuity Institute',
    'Government Office for Science', 'GO-Science', 'European University Association', 'Universities UK', 'American Council on Education',
    'National Academies', 'Samuel Neaman', 'Neaman Institute', 'Taub Center', 'MOFET',
    'מוסד שמואל נאמן', 'מרכז טאוב', 'מבקר המדינה', 'ראמ"ה', 'ראמ״ה', 'המדען הראשי', 'המדענית הראשית', 'יוזמה', 'מכון מופ"ת', 'מכון מופ״ת',
    'מרכז המחקר והמידע של הכנסת', 'המועצה להשכלה גבוהה', 'ות"ת', 'ות״ת', 'הקואליציה הישראלית לטראומה', 'רשות החירום הלאומית', 'פיקוד העורף'
  ].join('|'), 'i');
  // ציטוט של מאמר בכתב עת: כתב עת מהרשימה, או "כותרת. שם כתב עת, כרך(גיליון)"
  const RX_VOL = /[.,]\s*\d{1,4}\s*\(\s*[\dS\-–]+\s*\)|,\s*\d{1,4}\s*,\s*(e?\d+|\d+\s*[–-]\s*\d+)/;
  // מקום הפרסום: הקטע האחרון אחרי השנה והכותרת ("(2024). כותרת. מקום הפרסום."). הוצאה, מכון, ארגון, דף אתר או סדרת
  // ניירות עבודה אינם כתב עת; גם מגזין מקצועי אינו כתב עת עם שיפוט עמיתים.
  const RX_NOTJ = /Press\b|Publishing|Publications|Publishers|Foundation|Institute|Association|Laborator|Council|Center\b|Centre|Committee|Universit|Books\b|Springer VS|Working Paper|ASCD|SEDL|IASC|\bACU\b|\bEEF\b|Begood|Kagan|Macmillan|Freeman|Jossey|Routledge|Guilford|Wiley|Sage\b|Bloomsbury|Pearson|Harper|Metropolitan|Solution Tree|Plenum|Retrieved|EDUCAUSE Review|Harvard Business Review|Educational Leadership|Phi Delta Kappan|\[|\bed\.|קשר עין|ג׳וינט|ג'וינט|מכון|מרכז|הוצאת|משרד|אבני ראשה/i;
  const RX_BOOK = /Press\b|Routledge|Guilford|Wiley\b|Sage\b|SAGE Publications|Bloomsbury|Pearson|Jossey|Berrett|Harper|Simon & Schuster|Academic Press|IntechOpen|Springer VS|\(Eds?\.\)|\(\d+(st|nd|rd|th) ed\.|, \d+(st|nd|rd|th) ed\.|מהדורה|הוצאת/;
  function venue(cite) {
    const m = String(cite).match(/\(\s*(\d{4}[a-z]?|n\.d\.)[^)]*\)\.\s*(.+)$/);
    if (!m) return '';
    const parts = m[2].trim().replace(/\.\s*$/, '').split(/\.\s+(?=[A-Z֐-׿])/);
    return parts.length >= 2 ? parts[parts.length - 1].trim() : '';
  }
  const SIM_TYPE = {
    'סקירה שיטתית או מטא-אנליזה': 'sr',
    'ספר אקדמי': 'bg', 'כלי או משאב מקצועי': 'bg', 'עבודת דוקטורט': 'bg'
  };

  function text(r) { return [r.citation || r.apa || '', r.title || ''].join(' '); }
  function isJournal(cite) {
    if (J && J.inCitation(cite)) return true;
    if (RX_BOOK.test(cite)) return false;
    if (RX_VOL.test(cite)) return true;
    const v = venue(cite);
    return !!v && !RX_NOTJ.test(v) && v.split(/\s+/).length <= 10;
  }
  function design(t) {
    if (RX_EXP.test(t)) return 'exp';
    if (RX_LONG.test(t)) return 'long';
    if (RX_QUAL.test(t)) return 'qual';
    if (RX_CROSS.test(t)) return 'cross';
    return 'peer';
  }
  // רמת הראיות של רשומה (שדה ev גובר)
  function level(r) {
    if (r && RANK[r.ev] != null) return r.ev;
    const cite = text(r), all = cite + ' ' + (r.gist || '') + ' ' + (r.topic || '') + ' ' + (r.found || '');
    if (r.hidden || RX_DRAFT.test(cite) || RX_THESIS.test(cite)) return 'bg';
    const st = SIM_TYPE[r.type];
    if (st === 'bg') return 'bg';
    if (st === 'sr' || RX_SR.test(cite)) return 'sr';
    // גוף מוסמך כמחבר או כמפרסם: דוח. כתב עת מהרשימה גובר (מאמר של חוקרי OECD בכתב עת הוא מאמר).
    const byBody = RX_BODY.test(cite.split(/\(\s*(\d{4}|n\.d\.|טרם)/)[0]) || RX_BODY.test(venue(cite));
    if (J && J.inCitation(cite)) return RX_SR.test(all) ? 'sr' : design(all);
    if (byBody) return 'rep';
    if (isJournal(cite)) return RX_SR.test(all) ? 'sr' : design(all);
    return 'bg';
  }
  function rank(id) { return RANK[id] != null ? RANK[id] : LEVELS.length; }
  function label(id) { return LABEL[id] || ''; }
  function belowBar(id) { return id === 'bg'; }

  // המרחב (שדה sp גובר). במדף החוסן: לפי הקבוצה; במדף הסימולציות: לפי המילים בנושא, בציטוט ובתגיות.
  const G_SPACE = {
    il: 'edu', cls: 'edu', conf: 'edu', sel: 'edu', sys: 'edu', tech: 'edu', stu: 'edu', family: 'edu', paths: 'edu',
    comm: 'shared', ai: 'shared', lead: 'shared', leadcr: 'shared', facil: 'shared', cont: 'shared', routine: 'shared', dialog: 'shared', prep: 'shared',
    org: 'org', hed: 'org'
  };
  const RX_SCHOOL = /בית[ \-־]?ה?ספר|בתי[ \-־]?ספר|מורה|מורים|מורות|מחנכ|תלמיד|כיתה|כיתות|גן |גננ|ילדי הגן|הורים|הורות|הורי|school|teacher|pupil|classroom|kindergarten|K-12|preservice|parent/i;
  const RX_ORG = /workplace|at work|organi[sz]ation|employee|personnel|occupational|higher education|universit|college|nursing|medical|business|corporate|ארגון|ארגוני|עובדים|עובדות|מקום העבודה|מקומות עבודה|השכלה גבוהה|אוניברסיט|מכללה|סטודנט|חברות עסקיות|עסקים/i;
  const RX_EDU = /education|educational|learning|חינוך|חינוכי|למידה|הוראה/i;
  function space(r, shelf) {
    if (r && SPACES[r.sp]) return r.sp;
    if (shelf === 'res' || r.g) return G_SPACE[r.g] || 'edu';
    const t = [r.topic, r.citation, r.domain, (r.tags || []).join(' ')].join(' ');
    if (RX_SCHOOL.test(t)) return 'edu';
    if (RX_ORG.test(t)) return 'org';
    if (r.domain === 'מהות החינוך' || RX_EDU.test(t)) return 'edu';
    return 'shared';
  }
  // מה מוצג במרחב: החינוכי רואה חינוכי ומשותף, הארגוני רואה ארגוני ומשותף
  function inSpace(sp, view) { return !view || view === 'all' || sp === 'shared' || sp === view; }

  function year(r) {
    if (r.year) return +r.year || 0;
    const m = String(r.apa || r.citation || '').match(/\((\d{4})/);
    return m ? +m[1] : 0;
  }
  // דירוג לפני ההצגה: החזקים ראשונים, ובתוך כל רמה החדש קודם
  function compare(a, b) {
    return rank(level(a)) - rank(level(b)) || year(b) - year(a);
  }
  // כפילות לפי DOI, קישור או כותרת מנורמלת (אותיות קטנות, בלי סימני פיסוק)
  function normTitle(cite) {
    // אחרי "(שנה)." הכותרת היא המשפט הראשון; בלי שנה ("גוף. כותרת.") משווים את כל הציטוט, כדי ששני פריטים של אותו גוף לא ייחשבו כפולים
    const c = String(cite || ''), m = c.match(/\(\s*(\d{4}|n\.d\.|טרם)[^)]*\)\.\s*(.+)$/);
    const s = m ? m[2].split(/[.!?]\s/)[0] : c;
    return s.toLowerCase().replace(/[^a-z0-9֐-׿]+/g, '');
  }
  function doiOf(url) { const m = String(url || '').match(/10\.\d{4,9}\/[^\s"<>]+/i); return m ? m[0].toLowerCase().replace(/[.)]+$/, '') : ''; }
  function sameSource(a, b) {
    const da = doiOf(a.url), db = doiOf(b.url);
    if (da && db) return da === db;
    if (a.url && b.url && a.url === b.url) return true;
    const ta = normTitle(a.citation || a.apa), tb = normTitle(b.citation || b.apa);
    return ta.length > 12 && ta === tb;
  }
  return { LEVELS, SPACES, level, rank, label, belowBar, space, inSpace, year, compare, normTitle, doiOf, sameSource, G_SPACE };
});
