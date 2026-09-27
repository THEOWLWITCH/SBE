// עשרת השערים. רצים בקוד, לא במודל.
// exact = בדיקה ודאית. heuristic = מסמנת לבדיקה אנושית ואינה פוסלת לבד.

const HEB = /[\u0590-\u05FF]/;
const RED_LINE = {
  he: 'קו אדום: גם במצבים מתוחים, אלימות מכל סוג, השפלה, זלזול או מניפולציה של סכום אפס אינם לגיטימיים.',
  en: 'Red line: even under pressure, violence of any kind, humiliation, contempt or zero-sum manipulation are never legitimate.',
};
const VIOLENT = ['תזדיין','מטומטמת','אידיוטית','אכסח','אשבור','תסתמי','שתקי כבר'];
const INTIMIDATION = [/את תצטער/, /תצטערי על זה/, /אני יודע איפה את/, /יהיה לך רע/, /תשלמי על זה/];
const ESCALATION_OK = /^(אני|אנחנו)\s/;

// היוריסטי: מסמן ולא פוסל, כי "שלך", "אמרת" וכדומה כתובים זהה בשני המגדרים
// בעברית לא מנוקדת, ורק חלק מהצורות שונות בכתיב. זו בדיקת דגימה, לא מיצוי.
// \b אינו עובד סביב אותיות עבריות ב-JS (הן אינן \w), ולכן גבול המילה כאן
// נבנה ידנית מול אות עברית או סופה.
const heWord = (w) => new RegExp(`(?<![\\u0590-\\u05FF])${w}(?![\\u0590-\\u05FF])`);
const MASC_ONLY = ['בוא','תגיד','תראה','תשמע','תבין','תקשיב','שמע'].map(heWord);
const FEM_ONLY  = ['בואי','תגידי','תראי','תשמעי','תביני','תקשיבי','שמעי'].map(heWord);

// שסתום לחץ שהוא הרמת קול: ברירת מחדל שהופכת את הווליום לסיפור, לא ריאלית
// בהקשר מוסדי, ולרוב מסמנת שהשדה נכתב בלי גזירה מהדמות הספציפית.
const LOUD_VALVE = [/מרימ[הים]?\s+את\s+הקול/, /צועק[תים]?/, /קול[הו]\s+עול[הה]/];

const norm = s => String(s || '').replace(/\s+/g, ' ').trim();
const flat = o => JSON.stringify(o || {});

function contains(haystack, needle, minLen = 12) {
  const n = norm(needle);
  if (n.length < minLen) return false;
  return norm(haystack).includes(n);
}

export function runGates(scenario, ctx) {
  const g = [];
  const add = (id, name, pass, detail = '', kind = 'exact') => g.push({ id, name, pass, detail, kind });

  const trainee = norm(scenario.documents?.trainee) + ' ' + norm(scenario.scenarioName) + ' ' + norm(scenario.scenarioSubtitle);
  const a = scenario.characters?.actor || {};
  const secrets = [a.wontSay, a.pressureValve, a.trustCondition?.what, a.contradiction?.fact,
                   a.hiddenLayer?.fear, ...(scenario.turningPoints || []).map(t => t.characterDoes?.line)];

  // ש1 דלף
  const leaked = secrets.filter(s => s && contains(trainee, s));
  add(1, 'דלף', leaked.length === 0, leaked.length ? `דלף: ${leaked[0].slice(0, 60)}` : '');

  // ש2 ערכים
  const all = flat(scenario);
  const badWord = VIOLENT.find(w => all.includes(w));
  const intimidation = INTIMIDATION.find(re => re.test(all));
  const lang = ctx.language === 'אנגלית' ? 'en' : 'he';
  const redOk = Object.values(scenario.documents || {}).every(d => norm(d).includes(norm(RED_LINE[lang])));
  add(2, 'ערכים', !badWord && !intimidation && redOk,
      badWord ? `מילה אסורה: ${badWord}` : intimidation ? 'ניסוח מפחיד ולא הסלמה' : redOk ? '' : 'הקו האדום חסר או משונה');

  // ש3 שדה נעול
  const missing = Object.entries(ctx.locked || {}).filter(([, v]) => v && !all.includes(norm(v)));
  add(3, 'שדה נעול', missing.length === 0, missing.length ? `לא נשמר: ${missing[0][0]}` : '');

  // ש4 מקורות
  const cited = scenario.sources || [];
  const allowed = new Set((ctx.sourceLibrary || []).map(norm));
  const invented = cited.filter(s => !allowed.has(norm(s)));
  add(4, 'מקורות', invented.length === 0, invented.length ? `מקור שאינו בספרייה: ${invented[0]}` : '');

  // ש5 שפה
  let langOk = true, langDetail = '';
  if (ctx.language === 'אנגלית' && HEB.test(all)) { langOk = false; langDetail = 'תו עברי בתוצר אנגלי'; }
  add(5, 'שפה', langOk, langDetail);

  // ש6א ייחודיות השם — ודאי
  const unique = !(ctx.existingNames || []).map(norm).includes(norm(scenario.scenarioName));
  add(6, 'ייחודיות השם', unique, unique ? '' : 'שם לא ייחודי');

  // ש6ב דלף בשם — מילולי בלבד.
  // דלף משמעותי, כמו שם שרומז על האסימטריה בלי לצטט אותה, אינו נתפס כאן.
  // "מה שראית מהחלון" עובר את הבדיקה הזו ובכל זאת מדליף. חייב עין אנושית.
  const title = norm(scenario.scenarioName) + ' ' + norm(scenario.scenarioSubtitle);
  const nameLeak = secrets.some(s => s && contains(title, s, 10));
  add('6b', 'דלף בשם', !nameLeak, nameLeak ? 'השם מצטט שדה סמוי' : 'מילולי בלבד. דלף משמעותי אינו נתפס', 'heuristic');

  // ש7 קוהרנטיות — היוריסטי
  const paragraph = norm(scenario.documents?.trainee);
  const orphans = (scenario.turningPoints || []).filter(t => {
    const words = norm(t.trigger).split(' ').filter(w => w.length > 3);
    return !words.some(w => paragraph.includes(w));
  });
  add(7, 'קוהרנטיות', orphans.length === 0,
      orphans.length ? `טריגר בלי עוגן בפסקה: ${orphans[0].name}` : '', 'heuristic');

  // ש8 כיוון וכתיב
  let dirOk = true, dirDetail = '';
  if (ctx.language === 'אנגלית') {
    if (/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/.test(all)) { dirOk = false; dirDetail = 'תאריך במספרים'; }
  }
  add(8, 'כיוון וכתיב', dirOk, dirDetail);

  // ש9 התאמת מגדר — היוריסטי. סורק כל דמות מול הצורות הבלעדיות למגדר הנגדי
  // בשדות הציטוט והביטוי החוזר שלה בלבד, לא בפרוזה הכללית של המסמך.
  const genderMismatches = [];
  for (const [key, c] of Object.entries(scenario.characters || {})) {
    if (!c?.gender) continue;
    const quoted = [c.verbalTic, c.wontSay, c.pressureValve, c.statedPosition,
                    c.trustCondition?.what, c.contradiction?.howItCanSurface]
      .concat((scenario.turningPoints || []).flatMap(t =>
        [t.characterDoes?.line, ...(t.branches || []).map(b => b.saidAloud)]))
      .filter(Boolean).join(' ');
    const bad = c.gender === 'נקבה' ? MASC_ONLY.find(re => re.test(quoted))
              : c.gender === 'זכר'  ? FEM_ONLY.find(re => re.test(quoted))
              : null;
    if (bad) genderMismatches.push(`${key}: ${bad}`);
  }
  add(9, 'התאמת מגדר', genderMismatches.length === 0,
      genderMismatches.length ? `ניקוד לא תואם: ${genderMismatches[0]}` : '', 'heuristic');

  // ש10 שסתום קלישאתי — היוריסטי
  const loudValves = Object.entries(scenario.characters || {})
    .filter(([, c]) => c?.pressureValve && LOUD_VALVE.some(re => re.test(c.pressureValve)))
    .map(([key]) => key);
  add(10, 'שסתום קלישאתי', loudValves.length === 0,
      loudValves.length ? `הרמת קול כשסתום: ${loudValves[0]}` : '', 'heuristic');

  return { gates: g, passed: g.filter(x => x.kind === 'exact').every(x => x.pass), flagged: g.filter(x => !x.pass) };
}
