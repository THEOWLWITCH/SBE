(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./journey-analysis-model.js'));
  else root.SBE_JOURNEY_WORKSPACE = factory(root.SBE_JOURNEY_ANALYSIS);
})(typeof window !== 'undefined' ? window : this, function (A) {
  'use strict';
  const options = pairs => pairs.map(([value, label]) => ({ value, label }));
  const PRINCIPLES = options([['enable','אפשור'],['regulate','הסדרה'],['coordinate','תיאום'],['mediate','תיווך'],['meaning','יצירת משמעות'],['preserve','שימור והעברה'],['renew','שינוי והתארגנות מחדש']]);
  const QUALITIES = options([['q_access','נגישות'],['q_legitimacy','לגיטימיות'],['q_reliability','אמינות'],['q_fairness','הוגנות'],['q_flexibility','גמישות'],['q_continuity','המשכיות'],['q_learning','יכולת למידה']]);
  const LENSES = options([['existence','קיום'],['realization','מימוש'],['renewal','התחדשות']]);
  const LINK_TYPES = options([['info','מידע'],['authority','סמכות'],['resources','משאבים'],['coordination','תיאום'],['backup','גיבוי'],['normative','תמיכה או הגבלה נורמטיבית']]);
  const LINK_STATUSES = options([['formal','מוסדר רשמית'],['observed','נצפה בפועל'],['proposed','מוצע לבדיקה']]);
  const FINDING_KINDS = options([['strength','נקודת חוזק'],['gap','פער'],['question','שאלה לבירור'],['tension','מתח או עמדות סותרות']]);
  const FINDING_STATES = options([['draft','טיוטה לדיון'],['confirmed','אושר בצוות'],['rejected','לא התקבל']]);
  const ACTION_STATUSES = options([['planned','בתכנון'],['active','בפעולה'],['paused','בהשהיה'],['completed','הושלם']]);
  const text = (key, label, type = 'text') => ({ key, label, type });
  const long = (key, label) => text(key, label, 'long');
  const date = (key, label) => text(key, label, 'date');
  const select = (key, label, values) => ({ key, label, type: 'select', options: values });
  const refs = (key, label, target, max = 40) => ({ key, label, type: 'refs', target, max });
  const title = text('title','שם הפריט');
  const note = long('note','הערות והבדלי עמדות');
  const evidenceIds = refs('evidenceIds','ראיות ומקורות','evidence');
  const CONTEXT_FIELDS = [long('goal','מה רוצים לקדם'),long('preserve','מה חשוב לשמר'),long('scope','גבולות המסגרת ומי שותפים'),long('mandate','מנדט הצוות וסמכותו'),long('meeting','מועדי מפגש ובחינה מחדש'),long('privacy','פרטיות, גישה ומיקום חומרי המקור'),long('delegation','חלוקת אחריות והעברת תפקידים')];
  const SECTIONS = [
    { key:'roles',label:'בעלי תפקידים',fields:[title,text('person','שם תפקיד או כינוי'),long('authority','סמכות ואחריות'),text('time','זמן שהוקצה'),text('backup','גיבוי והעברה'),note,evidenceIds] },
    { key:'mechanisms',label:'מנגנונים חברתיים',fields:[title,long('purpose','התפקיד המארגן והמטרה'),long('participants','מי משתתפים ומי חסרים'),text('owner','אחריות לתפעול'),text('backup','גיבוי והמשכיות'),long('activation','איך ומתי המנגנון פועל'),{key:'principles',label:'עקרונות פעולה',type:'multi',options:PRINCIPLES},...QUALITIES.map(q => long(q.value,q.label)),...LENSES.map(l => long(l.value,l.label)),refs('roleIds','בעלי תפקידים מקושרים','roles'),refs('infrastructureIds','תשתיות תומכות','infrastructures'),refs('resourceIds','משאבים נוספים','resources'),evidenceIds,note] },
    { key:'infrastructures',label:'תשתיות תומכות',fields:[title,long('availability','זמינות ומצב'),long('access','מי יכולים להשתמש ובאילו תנאים'),long('maintenance','תחזוקה ורציפות'),text('owner','אחריות'),note,evidenceIds] },
    { key:'resources',label:'משאבים נוספים',fields:[title,long('availability','מה קיים ובאיזו מידה זמין'),long('access','למי נגיש ובאילו תנאים'),text('owner','אחריות או מקור המשאב'),note,evidenceIds] },
    { key:'evidence',label:'ראיות ומקורות',fields:[title,text('source','מקור או הפניה לחומר מאושר'),date('observedAt','מועד התצפית או האיסוף'),text('collectedBy','מי אספו'),long('details','מה נצפה או נאסף'),long('limits','גבולות הראיה ומה עדיין לא ידוע'),note] },
    { key:'links',label:'רשת המנגנונים',fields:[title,refs('from','ממנגנון מקור','mechanisms',1),refs('to','אל מנגנון יעד','mechanisms',1),select('type','מה עובר בקשר',LINK_TYPES),select('status','מעמד הקשר',LINK_STATUSES),evidenceIds,note] },
    { key:'findings',label:'תמונת מצב',fields:[title,select('kind','סוג הממצא',FINDING_KINDS),evidenceIds,long('interpretation','פירוש והקשר'),long('uncertainty','מה לא ידוע ואילו פירושים נוספים אפשריים'),select('origin','מקור ההצעה',options([['team','הצוות'],['ai','סיוע AI']])),select('state','מצב הדיון',FINDING_STATES),text('approvedBy','מי אישרו בצוות'),note] },
    { key:'decisions',label:'יומן החלטות',fields:[title,long('alternatives','החלופות שנשקלו'),long('reason','הנימוק לבחירה'),long('criteria','שיקולי חשיבות, הוגנות, השפעה, ישימות ומשאבים'),evidenceIds,long('uncertainty','מידע חסר ואי ודאות'),text('authority','סמכות להחלטה'),text('owner','אחריות לקידום'),text('backup','גיבוי'),text('approvedBy','מי אישרו'),date('decidedAt','מועד ההחלטה'),date('reviewAt','מועד בחינה מחדש'),long('disagreement','עמדות אחרות והסתייגויות'),note] },
    { key:'actions',label:'תכנית עבודה',fields:[title,refs('decisionId','החלטה מקושרת','decisions',1),text('owner','אחריות'),text('backup','גיבוי'),long('partners','שותפים וקבוצות מושפעות'),long('authority','סמכות נדרשת'),long('resources','זמן ומשאבים שהוקצו'),long('stopDoing','מה מצמצמים או מפסיקים כדי לפנות מקום'),date('startAt','מועד התחלה'),date('dueAt','מועד מתוכנן'),long('presentOutcome','השינוי המבוקש באיכות החיים בהווה'),long('futureOutcome','השינוי המבוקש במוכנות לעתיד'),long('processEvidence','איך נבדוק שהפעולה מתקיימת'),long('outcomeEvidence','איך נבדוק מה השתנה'),date('reviewAt','מועד למידה ובדיקה'),select('status','מצב הפעולה',ACTION_STATUSES),evidenceIds,note] },
    { key:'reviews',label:'למידה והתחדשות',fields:[title,refs('actionId','פעולה מקושרת','actions',1),date('observedAt','מועד הבחינה'),evidenceIds,long('learned','מה למדנו על המנגנון ועל הקשרים'),long('presentChange','מה השתנה באיכות החיים בהווה'),long('futureChange','מה השתנה במוכנות לעתיד'),long('unintended','תוצאות נוספות, עומס או השפעה לא צפויה'),long('next','מה נשמר, מה משתנה ומה עוד נבדוק'),text('approvedBy','שותפים לאישור הלמידה'),note] }
  ];
  CONTEXT_FIELDS.push(...A.INPUT_FIELDS.context.filter(f => !CONTEXT_FIELDS.some(x => x.key === f.key)).map(f => ({...f,type:f.type === 'date' ? 'date' : 'long'})));
  for (const section of SECTIONS.slice(0,4)) section.fields.push(...A.INPUT_FIELDS[section.key].filter(f => !section.fields.some(x => x.key === f.key)).map(f => ({...f,type:f.type === 'text' ? 'long' : f.type})));
  for (const key of ['evidence','links']) {
    const section = SECTIONS.find(s => s.key === key);
    section.fields.push(...A.INPUT_FIELDS[key].filter(f => !section.fields.some(x => x.key === f.key)).map(f => ({...f,type:f.type === 'text' ? 'long' : f.type})));
  }
  for (const key of ['decisions','actions']) SECTIONS.find(s => s.key === key).fields.push(text('analysisId','ניתוח המקור','id'),text('priorityId','מוקד המקור','id'),text('optionId','חלופת המקור','id'));
  const ID = /^[a-z0-9_-]{1,64}$/;
  const forbidden = new Set(['__proto__','prototype','constructor']);
  function object(value, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error(label + ': אפשר להזין אובייקט נתונים');
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) throw Error(label + ': מבנה נתונים לא נתמך');
  }
  function keys(value, allowed, label) {
    for (const key of Object.keys(value)) if (forbidden.has(key) || !allowed.has(key)) throw Error(label + ': השדה ' + key + ' אינו חלק מהמבנה');
  }
  function string(value, label) {
    if (value === undefined) return '';
    if (typeof value !== 'string') throw Error(label + ': אפשר להזין טקסט');
    if (value.length > 4000) throw Error(label + ': עד 4000 תווים');
    return value.trim();
  }
  function values(value, label, max) {
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.length > max) throw Error(label + ': עד ' + max + ' פריטים ברשימה');
    const list = value.map(v => string(v,label));
    if (new Set(list).size !== list.length) throw Error(label + ': כל הפניה מופיעה פעם אחת');
    return list;
  }
  function field(value, f, label) {
    if (f.type === 'refs') {
      const list = values(value,label,f.max);
      for (const id of list) if (!ID.test(id)) throw Error(label + ': מזהה הפניה לא תקין ' + id);
      return list;
    }
    if (f.type === 'multi') {
      const list = values(value,label,f.options.length);
      for (const v of list) if (!f.options.some(o => o.value === v)) throw Error(label + ': אפשרות לא מוכרת ' + v);
      return list;
    }
    const s = string(value === undefined || (value === '' && f.default) ? f.default : value,label);
    if (f.type === 'select' && s && !f.options.some(o => o.value === s)) throw Error(label + ': אפשרות לא מוכרת ' + s);
    if (f.type === 'id' && s && !ID.test(s)) throw Error(label + ': מזהה לא תקין');
    if (f.type === 'date' && s && (!/^\d{4}-\d{2}-\d{2}$/.test(s) || !Number.isFinite(Date.parse(s)) || new Date(s).toISOString().slice(0,10) !== s)) throw Error(label + ': אפשר להזין תאריך תקין');
    return s;
  }
  function empty() {
    const result = { context: Object.fromEntries(CONTEXT_FIELDS.map(f => [f.key,''])), analyses:[] };
    for (const section of SECTIONS) result[section.key] = [];
    return result;
  }
  function clean(value) {
    object(value,'מרחב העבודה');
    keys(value,new Set(['context','analyses',...SECTIONS.map(s => s.key)]),'מרחב העבודה');
    const result = empty(), ids = new Set();
    const context = value.context === undefined ? {} : value.context;
    object(context,'מסגרת העבודה'); keys(context,new Set(CONTEXT_FIELDS.map(f => f.key)),'מסגרת העבודה');
    for (const f of CONTEXT_FIELDS) result.context[f.key] = field(context[f.key],f,f.label);
    for (const section of SECTIONS) {
      const list = value[section.key] === undefined ? [] : value[section.key];
      if (!Array.isArray(list) || list.length > 80) throw Error(section.label + ': עד 80 פריטים');
      result[section.key] = list.map(record => {
        object(record,section.label); keys(record,new Set(['id',...section.fields.map(f => f.key)]),section.label);
        const id = string(record.id,section.label + ' מזהה');
        if (!ID.test(id)) throw Error(section.label + ': מזהה תקין מכיל עד 64 אותיות לטיניות קטנות, ספרות, קו תחתון או מקף');
        if (ids.has(id)) throw Error(section.label + ': המזהה ' + id + ' כבר קיים');
        ids.add(id);
        const out = {id};
        for (const f of section.fields) out[f.key] = field(record[f.key],f,section.label + ' ' + f.label);
        if (section.key === 'findings' && out.state === 'confirmed' && !out.approvedBy) throw Error('ממצא שאושר: אפשר לציין מי נתנו אישור בצוות');
        return out;
      });
    }
    for (const section of SECTIONS) for (const record of result[section.key]) for (const f of section.fields.filter(f => f.type === 'refs')) {
      for (const id of record[f.key]) if (!result[f.target].some(r => r.id === id)) throw Error(section.label + ' ' + (record.title || record.id) + ': ההפניה ' + id + ' אינה קיימת ברשימת ' + SECTIONS.find(s => s.key === f.target).label + '. אפשר לעדכן את הקישור לפני מחיקת הפריט');
    }
    result.analyses = A.cleanAnalyses(value.analyses);
    return result;
  }
  const AI_SYSTEM = A.AI_SYSTEM;
  return { SCHEMA:SECTIONS,SECTIONS,CONTEXT_FIELDS,PRINCIPLES,QUALITIES,LENSES,LINK_TYPES,LINK_STATUSES,FINDING_KINDS,FINDING_STATES,ACTION_STATUSES,empty,clean,validate:clean,AI_SYSTEM,aiSystem:() => AI_SYSTEM };
});
