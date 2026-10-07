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
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const text = x => typeof x === 'string' && x.trim().length > 0;
const textLeaves = x => typeof x === 'string' ? [x] : Array.isArray(x) ? x.flatMap(textLeaves) : object(x) ? Object.values(x).flatMap(textLeaves) : [];
const at = (value, path) => path.split('.').reduce((v,k) => object(v) || Array.isArray(v) ? v[k] : undefined, value);
const equal = (a,b) => typeof a === 'string' && typeof b === 'string' ? a === b : JSON.stringify(a) === JSON.stringify(b);
const LOCK_ALIASES = { who: 'characters.trainee.role', actorRole: 'characters.actor.role', whatHappened: 'given.whatHappened', goals: 'given.goals' };

export class OutputContractError extends Error {
  constructor(stage, details) { super(`שלב ${stage}: סכמה או שער נכשלו: ${details.join('; ')}`); this.name = 'OutputContractError'; this.code = 'output_contract'; this.stage = stage; this.details = details; }
}

export function approvedSources(sourceLibrary = []) {
  if (!Array.isArray(sourceLibrary)) throw new OutputContractError('sources', ['בנק המקורות אינו מערך']);
  const sources = sourceLibrary.filter(s => object(s) && s.approved === true && s.hidden !== true && text(s.sourceId) && text(s.citation || s.title));
  if (new Set(sources.map(s => s.sourceId)).size !== sources.length) throw new OutputContractError('sources', ['sourceId כפול בבנק המאושר']);
  return sources.map(s => ({ sourceId: s.sourceId, title: s.title || s.citation, citation: s.citation || s.title }));
}

function fields(value, names, prefix, errors) {
  if (!object(value)) { errors.push(`${prefix} חייב להיות אובייקט`); return; }
  for (const name of names) if (!text(value[name])) errors.push(`${prefix}.${name} חסר או אינו טקסט`);
}
function stringArray(value, path, errors, min = 1) {
  if (!Array.isArray(value) || value.length < min || value.some(x => !text(x))) errors.push(`${path} חייב להיות מערך טקסט לא ריק`);
}
function characterSchema(value, path, errors) {
  fields(value, ['role','nameAndAge','gender','verbalTic','wontSay','pressureValve'], path, errors);
  if (!object(value)) return;
  if (!['זכר','נקבה','אחר'].includes(value.gender)) errors.push(`${path}.gender אינו נתמך`);
  fields(value.domainMaterial, ['thisWeek','object','lineUnderPressure'], `${path}.domainMaterial`, errors);
  stringArray(value.domainMaterial?.syntax, `${path}.domainMaterial.syntax`, errors);
  fields(value.register, ['answerLength','insteadOfAnswering','whenLong'], `${path}.register`, errors);
  for (const layer of ['visibleLayer','hiddenLayer']) {
    fields(value[layer], [layer === 'visibleLayer' ? 'statedPosition' : 'fear'], `${path}.${layer}`, errors);
    stringArray(value[layer]?.emotions, `${path}.${layer}.emotions`, errors);
    stringArray(value[layer]?.needs, `${path}.${layer}.needs`, errors);
  }
  fields(value.trustCondition, ['form','what','whyItWorks'], `${path}.trustCondition`, errors);
  fields(value.contradiction, ['fact','howItCanSurface'], `${path}.contradiction`, errors);
}
function stage1Schema(value, errors) {
  fields(value, ['conflictNote','priorRelationship'], 'stage1', errors);
  stringArray(value?.rejectedDirections, 'rejectedDirections', errors, 3);
  fields(value?.conflict, ['surface','real'], 'conflict', errors);
  fields(value?.conflict?.asymmetry, ['traineeDoesntKnow','actorDoesntKnow'], 'conflict.asymmetry', errors);
  fields(value?.conflict?.stakes, ['trainee','actor'], 'conflict.stakes', errors);
  fields(value?.setting, ['place','timeAndCircumstance'], 'setting', errors);
  characterSchema(value?.characters?.trainee, 'characters.trainee', errors);
  characterSchema(value?.characters?.actor, 'characters.actor', errors);
}
function stage2Schema(value, errors) {
  if (!Array.isArray(value?.turningPoints) || !value.turningPoints.length) errors.push('turningPoints חסר');
  else value.turningPoints.forEach((p,i) => {
    const path = `turningPoints.${i}`;
    fields(p, ['name','type','derivedFrom','trigger','demands','ifMissed','skill'], path, errors);
    if (!['פתיחה','פתיחה עמוקה','סגירה','מותנה','היפוך','ניתוק'].includes(p?.type)) errors.push(`${path}.type אינו נתמך`);
    if (typeof p?.coreTurn !== 'boolean') errors.push(`${path}.coreTurn אינו boolean`);
    fields(p?.characterDoes, ['line','action'], `${path}.characterDoes`, errors);
    if (!Array.isArray(p?.branches) || !p.branches.length) errors.push(`${path}.branches חסר`);
    else p.branches.forEach((b,j) => {
      fields(b, ['traineeMove','exampleWording','saidAloud','underneath','effect','quality','next'], `${path}.branches.${j}`, errors);
      if (!['פותח','מחזיק','סוגר'].includes(b?.effect)) errors.push(`${path}.branches.${j}.effect אינו נתמך`);
      if (!['מקדם','שגוי','נכון אך כואב'].includes(b?.quality)) errors.push(`${path}.branches.${j}.quality אינו נתמך`);
    });
  });
  if (!Array.isArray(value?.endings) || value.endings.length < 4) errors.push('endings דורש ארבעה סיומים לפחות');
  else value.endings.forEach((e,i) => fields(e, ['name','howItLooks','whatItSays'], `endings.${i}`, errors));
}
function sourcesSchema(value, sourceLibrary, errors) {
  if (!Array.isArray(value?.sources)) { errors.push('sources חייב להיות מערך'); return; }
  const allowed = new Map(approvedSources(sourceLibrary).map(s => [s.sourceId,s]));
  const seen = new Set();
  for (const cited of value.sources) {
    if (!object(cited) || !text(cited.sourceId)) { errors.push('כל citation דורש sourceId'); continue; }
    const source = allowed.get(cited.sourceId);
    if (seen.has(cited.sourceId)) errors.push(`sourceId מצוטט פעמיים: ${cited.sourceId}`);
    seen.add(cited.sourceId);
    if (!source) errors.push(`sourceId אינו בבנק המאושר: ${cited.sourceId}`);
    else if (cited.citation !== undefined && cited.citation !== source.citation) errors.push(`citation אינו תואם לבנק: ${cited.sourceId}`);
    if (cited.title !== undefined && cited.title !== source?.title) errors.push(`title אינו תואם לבנק: ${cited.sourceId}`);
    if (Object.keys(cited).some(k => !['sourceId','citation','title'].includes(k))) errors.push('citation מכיל שדה לא מורשה');
  }
}
function stage3Schema(value, sourceLibrary, errors) {
  fields(value, ['scenarioName','scenarioSubtitle'], 'stage3', errors);
  fields(value?.documents?.actor, ['story','portrait','askAndBeneath','arc','endingsProse','whoSitsAcross','expectThis'], 'documents.actor', errors);
  fields(value?.documents?.actor?.entrance, ['posture','doing','firstLine'], 'documents.actor.entrance', errors);
  fields(value?.documents?.facilitator, ['fullBackground','charactersProse','whatTheApproachSaysHere','dynamics','skillsToTrain','observationPoints','preSessionQuestions','debriefQuestions','reflectionQuestions'], 'documents.facilitator', errors);
  sourcesSchema(value, sourceLibrary, errors);
}

function lockErrors(value, ctx, stage = 'final') {
  const errors = [];
  if (ctx.locked !== undefined && !object(ctx.locked)) return ['locked חייב להיות אובייקט'];
  for (const [key, expected] of Object.entries(ctx.locked || {})) {
    const path = LOCK_ALIASES[key] || key;
    if (expected === undefined || typeof expected === 'function' || typeof expected === 'symbol') { errors.push(`locked.${key} אינו ערך נעול תקין`); continue; }
    // Stage-specific outputs never get to authorize or overwrite the server-owned given snapshot.
    if (stage !== 'final' && (stage !== 'stage1' || !/^(characters|conflict|setting|priorRelationship|conflictNote|rejectedDirections)\b/.test(path))) continue;
    if (!equal(at(value, path), expected)) errors.push(`לא נשמר בדיוק: ${key}`);
  }
  if (stage === 'final' && ctx.given !== undefined && !equal(value?.given, ctx.given)) errors.push('given אינו זהה לצילום הקלט');
  return errors;
}

export function assertGenerationInput(input) {
  const errors = [];
  if (!object(input)) throw new OutputContractError('input', ['input חסר']);
  fields(input.given, ['who','whatHappened','goals'], 'given', errors);
  if (input.language !== undefined && !['עברית','אנגלית'].includes(input.language)) errors.push('שפה אינה נתמכת');
  if (input.locked !== undefined && !object(input.locked)) errors.push('locked חייב להיות אובייקט');
  if (errors.length) throw new OutputContractError('input', errors);
  return input;
}

export function validateStage(stage, value, ctx = {}, { sourceLibrary = [] } = {}) {
  const errors = [];
  if (stage === 'stage1') stage1Schema(value, errors);
  else if (stage === 'stage2') stage2Schema(value, errors);
  else if (stage === 'stage3') stage3Schema(value, sourceLibrary, errors);
  else if (stage === 'trainee') {
    if (!text(value)) errors.push('פסקת המתנסה ריקה');
    else { const parts = value.trim().split(/\n\s*-{3,}\s*\n/); if (parts.length !== 2 || parts.some(p => !text(p))) errors.push('נדרשים פתיחה ומה על הפרק, מופרדים ב---'); }
  } else if (stage === 'final') {
    stage1Schema(value, errors); stage2Schema(value, errors); stage3Schema(value, sourceLibrary, errors);
    fields(value?.given, ['who','whatHappened','goals'], 'given', errors);
    fields(value?.documents, ['trainee','traineeStakes'], 'documents', errors);
  } else errors.push(`שלב אינו נתמך: ${stage}`);
  errors.push(...lockErrors(value, ctx, stage));
  if (ctx.language !== undefined && !['עברית','אנגלית'].includes(ctx.language)) errors.push('שפה אינה נתמכת');
  return { id: 'schema', name: `סכמה ${stage}`, kind: 'exact', pass: errors.length === 0, detail: errors.join('; ') };
}
export function assertStageContract(stage, value, ctx, options) {
  const gate = validateStage(stage, value, ctx, options);
  if (!gate.pass) throw new OutputContractError(stage, [gate.detail]);
  return value;
}

function contains(haystack, needle, minLen = 12) {
  const n = norm(needle);
  if (n.length < minLen) return false;
  return norm(haystack).includes(n);
}

export function runGates(scenario, ctx = {}, { sourceLibrary = [] } = {}) {
  scenario = object(scenario) ? scenario : {};
  const g = [];
  const add = (id, name, pass, detail = '', kind = 'exact') => g.push({ id, name, pass, detail, kind });
  g.push(validateStage('final', scenario, ctx, { sourceLibrary }));
  const points = Array.isArray(scenario.turningPoints) ? scenario.turningPoints : [];

  const trainee = norm(scenario.documents?.trainee) + ' ' + norm(scenario.documents?.traineeStakes) + ' ' + norm(scenario.scenarioName) + ' ' + norm(scenario.scenarioSubtitle);
  const a = scenario.characters?.actor || {};
  const secrets = [a.wontSay, a.pressureValve, a.trustCondition?.what, a.contradiction?.fact,
                   a.hiddenLayer?.fear, ...points.map(t => t?.characterDoes?.line)];

  // ש1 דלף
  const leaked = secrets.filter(s => s && contains(trainee, s));
  add(1, 'דלף', leaked.length === 0, leaked.length ? `דלף: ${leaked[0].slice(0, 60)}` : '');

  // ש2 ערכים
  const all = flat(scenario);
  const badWord = VIOLENT.find(w => all.includes(w));
  const intimidation = INTIMIDATION.find(re => re.test(all));
  const lang = ctx.language === 'אנגלית' ? 'en' : 'he';
  const redOk = ['trainee','actor','facilitator'].every(key => textLeaves(scenario.documents?.[key]).some(d => norm(d).includes(norm(RED_LINE[lang]))));
  add(2, 'ערכים', !badWord && !intimidation && redOk,
      badWord ? `מילה אסורה: ${badWord}` : intimidation ? 'ניסוח מפחיד ולא הסלמה' : redOk ? '' : 'הקו האדום חסר או משונה');

  // ש3 שדה נעול
  const missing = lockErrors(scenario, ctx);
  add(3, 'שדה נעול', missing.length === 0, missing.join('; '));

  // ש4 מקורות
  const sourceErrors = []; sourcesSchema(scenario, sourceLibrary, sourceErrors);
  add(4, 'מקורות', sourceErrors.length === 0, sourceErrors.join('; '));

  // ש5 שפה
  let langOk = ctx.language === undefined || ['עברית','אנגלית'].includes(ctx.language), langDetail = langOk ? '' : 'שפה אינה נתמכת';
  const documentText = textLeaves(scenario.documents).join('\n') + ' ' + norm(scenario.scenarioName) + ' ' + norm(scenario.scenarioSubtitle);
  if (ctx.language === 'אנגלית' && HEB.test(documentText)) { langOk = false; langDetail = 'תו עברי בתוצר אנגלי'; }
  add(5, 'שפה', langOk, langDetail);

  // ש6א ייחודיות השם — ודאי
  const unique = !(Array.isArray(ctx.existingNames) ? ctx.existingNames : []).map(norm).includes(norm(scenario.scenarioName));
  add(6, 'ייחודיות השם', unique, unique ? '' : 'שם לא ייחודי');

  // ש6ב דלף בשם — מילולי בלבד.
  // דלף משמעותי, כמו שם שרומז על האסימטריה בלי לצטט אותה, אינו נתפס כאן.
  // "מה שראית מהחלון" עובר את הבדיקה הזו ובכל זאת מדליף. חייב עין אנושית.
  const title = norm(scenario.scenarioName) + ' ' + norm(scenario.scenarioSubtitle);
  const nameLeak = secrets.some(s => s && contains(title, s, 10));
  add('6b', 'דלף בשם', !nameLeak, nameLeak ? 'השם מצטט שדה סמוי' : 'מילולי בלבד. דלף משמעותי אינו נתפס', 'heuristic');

  // ש7 קוהרנטיות — היוריסטי
  const paragraph = norm(scenario.documents?.trainee);
  const orphans = points.filter(t => {
    const words = norm(t?.trigger).split(' ').filter(w => w.length > 3);
    return !words.some(w => paragraph.includes(w));
  });
  add(7, 'קוהרנטיות', orphans.length === 0,
      orphans.length ? `טריגר בלי עוגן בפסקה: ${orphans[0]?.name || ''}` : '', 'heuristic');

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
      .concat(points.flatMap(t =>
        [t?.characterDoes?.line, ...(Array.isArray(t?.branches) ? t.branches : []).map(b => b?.saidAloud)]))
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
