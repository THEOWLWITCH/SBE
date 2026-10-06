/* Shared Studio contract: browser UI, server validation, saved work and exports. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SBE_STUDIO = api;
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';
  const VERSION = '1.0';
  // Proposed practice targets, not a validated scale or approved intervention catalogue.
  const rows = [
    ['awareness','מודעות עצמית וחוזקות','לזהות משאב אישי ולהציע איך להשתמש בו יחד','זיהוי חוזקות','שילוב משאבים'],
    ['regulation','ויסות והתארגנות','לעצור, לבחור קצב ולתאם דרך פעולה','בחירת קצב','תיאום קצב משותף'],
    ['efficacy','מסוגלות אישית','לבחור משימה קטנה ולנסות אותה עם עזרה זמינה','תכנון צעד אפשרי','מתן משוב שימושי'],
    ['optimism','אופטימיות מציאותית','לזהות אפשרות לצד קושי ולבדוק צעד אפשרי','זיהוי אפשרויות','בדיקת אפשרויות יחד'],
    ['hope','תקווה','לבחור יעד ולבנות שתי דרכים מעשיות אליו','יצירת חלופות','תכנון נתיב משותף'],
    ['meaning','משמעות וכיוון','לחבר בין ערך לבין פעולה שנבחרת יחד','זיהוי ערכים','תיאום כיוון'],
    ['flexibility','גמישות והסתגלות','לבחון חלופה אחרי שינוי בתנאים','שינוי אסטרטגיה','התאמת תכנית משותפת'],
    ['persistence','התמדה ולמידה מקושי','לבחון ניסיון ולבחור תיקון קטן','למידה מניסיון','משוב ותיקון משותף'],
    ['problem-solving','פתרון בעיות וקבלת החלטות','לברר מידע חסר ולבחור חלופה על פי שיקול משותף','בירור מידע','קבלת החלטות קבוצתית'],
    ['belonging','שייכות','להזמין תרומה של כל משתתף ולשלב אותה בתוצר','הבעת קול','הכרה בתרומות'],
    ['trust','אמון','לנסח התחייבות קטנה ולבדוק יחד אם קוימה','עמידה בהתחייבות','תיאום ציפיות'],
    ['voice','ביטחון להשמיע קול','להציע רעיון ולהגיב אליו בכבוד ללא חובה לחשיפה אישית','הבעת עמדה','תגובה מכבדת'],
    ['communication','תקשורת והקשבה','לשאול, להקשיב ולוודא הבנה לפני החלטה','הקשבה והבהרה','בניית הבנה משותפת'],
    ['empathy','אמפתיה ונקודות מבט','לתאר צורך של דמות בדויה ולבחון נקודת מבט אחרת','בחינת נקודת מבט','השוואת נקודות מבט'],
    ['support','עזרה הדדית','לבקש מידע או עזרה חסרים ולשלב תרומות של אחרים','בקשת עזרה והבהרה','החלפת מידע ועזרה'],
    ['cooperation','שיתוף פעולה','לחלק תפקידים תלויים זה בזה ולבנות תוצר משולב','מילוי תפקיד','תיאום תפקידים'],
    ['repair','מחלוקת ותיקון קשר','לנסח אי הסכמה על מקרה בדוי ולבחור הסכמה אפשרית','ניסוח אי הסכמה','בניית הסכמה'],
    ['collective-efficacy','מסוגלות משותפת','לבנות משימה שבה כל תרומה נדרשת להשלמה','תרומה ממוקדת','שילוב תרומות'],
    ['participation','השתתפות והשפעה הוגנות','לבחור דרך לתרום ולהראות מה השתנה בעקבות התרומה','בחירת דרך השתתפות','חלוקת השפעה'],
    ['backup','אחריות משותפת וגיבוי','להחליף תפקיד ולוודא שאפשר להמשיך גם בהיעדר בעל התפקיד','העברת ידע','תיאום גיבוי'],
    ['resources','גישה למשאבים ולעזרה','למפות צורך ודרך נגישה לקבל עזרה','איתור משאבים','בניית מפת עזרה'],
    ['bridges','גשרים בין קבוצות','לחבר בין צרכים ותרומות של שתי קבוצות','בירור צורך','חיבור בין קבוצות'],
    ['direction','כיוון משותף','לבחור יעד משותף ולתאם סימן להתקדמות','הצעת יעד','תיאום יעד ומדד פעולה'],
    ['learning','למידה ושיפור משותפים','לבחון מה עבד ולבחור שינוי שנבדק בפעם הבאה','תצפית ורפלקציה','הפקת לקח משותף'],
    ['continuity','רציפות והסתגלות משותפות','לבנות חלופה לשגרה ולנסות אותה בתרחיש בדוי','זיהוי תנאי שינוי','תרגול חלופה משותפת']
  ];
  const COMPONENTS = rows.map(([id,label,mechanism,individual,shared]) => ({id,label,mechanism,individual,shared,version:VERSION,status:'draft'}));
  const component = id => COMPONENTS.find(c=>c.id===id);
  const clone = x => JSON.parse(JSON.stringify(x));
  function newBrief(input) {
    const b = Object.assign({ startingPoint:'', goal:'', leaderRole:'', leaderAge:'', experience:'', participants:'', participantAge:'', count:8, duration:40, sessions:1, format:'activity', familiarity:'', relationships:'', context:'', materials:'', space:'', language:'עברית', accessibility:'', crisis:'routine', youthMode:'adult-supported', focus:'', observations:'', sources:[] }, input || {});
    b.sources = (Array.isArray(b.sources)?b.sources:[]).map((s,i)=>({id:String(s.id||'user-'+i),name:String(s.name||'מקור נוסף'),role:s.role==='inspiration'?'inspiration':'context',status:'unreviewed',content:String(s.content||''),url:String(s.url||''),date:String(s.date||''),scope:String(s.scope||''),population:String(s.population||''),version:String(s.version||'1')}));
    return b;
  }
  function recommendFocus(b) {
    if (component(b.focus)) return { focus:b.focus, rationale:'הרכיב נבחר על ידך. הוא יישאר במוקד עד שתבחרו לשנותו.', alternatives:[], questions:[] };
    const text = [b.goal,b.startingPoint,b.observations].join(' ');
    const rules = [['support',/עזרה|הדדי/],['communication',/הקשב|תקשורת/],['belonging',/שייכות/],['hope',/תקווה/],['optimism',/אופטימי/],['backup',/גיבוי|תלות/],['participation',/הוגנ|קול|השפעה/],['cooperation',/משימה|שיתוף פעולה/]];
    const focus = (rules.find(r=>r[1].test(text))||['cooperation'])[0];
    return { focus, rationale:text.trim()?'הצעה ראשונית לפי התיאור והיעד, ללא אבחון של הקבוצה. אפשר להחליף את המוקד.':'אפשר להתחיל מתרגול קטן של עבודה משותפת, ולבחור כיוון אחר מתוך ההשראה.', alternatives:['support','communication','hope'].filter(id=>id!==focus), questions:[] };
  }
  function claims(a) {
    const maps = {components:new Map(),individual:new Map(),shared:new Map()};
    (a.sessions||[]).forEach(s=>(s.steps||[]).forEach(step=>{
      [['components','components'],['individual','individualSkills'],['shared','sharedSkills']].forEach(([kind,field])=>(step[field]||[]).forEach(label=>{
        const key = String(label), value = maps[kind].get(key)||{label:key,stepIds:[]};
        value.stepIds.push(step.id); maps[kind].set(key,value);
      }));
    }));
    return Object.fromEntries(Object.entries(maps).map(([k,v])=>[k,[...v.values()]]));
  }
  function validateActivity(a,b) {
    const errors=[];
    if (!a || typeof a!=='object') return ['חסרה פעילות'];
    if (!a.title || !a.purpose || !component(a.focus)) errors.push('נדרשים שם, מטרה ורכיב מוקד מהקטלוג');
    if (b.focus && a.focus!==b.focus) errors.push('הרכיב שנבחר השתנה ללא אישור');
    if (!Array.isArray(a.sessions)||a.sessions.length!==Number(b.sessions)) errors.push('מספר המפגשים אינו תואם לתקציר');
    const ids=new Set();
    (a.sessions||[]).forEach((session,i)=>{
      if (!session.purpose || !Array.isArray(session.steps)||!session.steps.length) errors.push('חסרים מטרה ושלבים במפגש '+(i+1));
      let minutes=0;
      (session.steps||[]).forEach(step=>{
        if (!step.id || ids.has(step.id)) errors.push('מזהי שלבים אינם ייחודיים');
        ids.add(step.id);
        if (!Number.isFinite(step.minutes)||step.minutes<=0) errors.push('משך שלב אינו תקין');
        minutes+=Number(step.minutes)||0;
        if (!step.title||!step.instructions) errors.push('חסרות הוראות שלב');
        for(const f of ['materials','components','individualSkills','sharedSkills']) if(!Array.isArray(step[f])) errors.push('חסר מיפוי '+f);
        if ((step.components||[]).some(id=>!component(id))) errors.push('רכיב שאינו בקטלוג');
      });
      if(minutes>Number(b.duration)) errors.push('סך זמני מפגש '+(i+1)+' חורג מהזמן הזמין');
      if (!(session.debrief||[]).length || !session.nextStep || !session.participantMaterials) errors.push('חסרים חומרי משתתפים, עיבוד או צעד המשך');
    });
    const c=claims(a);
    if (!c.components.some(x=>x.label===a.focus)) errors.push('רכיב המוקד אינו מתורגל בשלבים');
    if (!c.individual.length || !c.shared.length) errors.push('חסר תרגול של מיומנות אישית או משותפת');
    if (!a.participationAlternative) errors.push('חסרה חלופת השתתפות ללא חשיפה אישית');
    return [...new Set(errors)];
  }
  function exampleActivity(input) {
    const b=newBrief(input), c=component(b.focus)||component(recommendFocus(b).focus);
    const duration=Math.max(5,Number(b.duration)||40), first=Math.max(1,Math.floor(duration*.15)), second=Math.max(1,Math.floor(duration*.25)), last=Math.max(1,Math.floor(duration*.2)), joint=duration-first-second-last;
    const sessions=Array.from({length:Math.max(1,Number(b.sessions)||1)},(_,i)=>({
      id:'session-'+(i+1),title:i?'מנסים, לומדים ומתאימים':'צעד ראשון יחד',purpose:b.goal||'לתרגל '+c.label+' בפעולה משותפת',link:i?'מתחילים מהתצפית והצעד שנבחרו במפגש הקודם.':'תחילת התהליך',
      steps:[
        {id:'s'+i+'-intro',title:'בוחרים דרך להשתתף',minutes:first,instructions:'מציגים את היעד ואת המשימה. אפשר לדבר, לכתוב, לצייר או להתבונן. אין חובה לספר סיפור אישי.',materials:[],components:[],individualSkills:[],sharedSkills:[]},
        {id:'s'+i+'-prepare',title:'מכינים תרומה',minutes:second,instructions:'כל משתתף בוחר תרומה קטנה למשימה: '+c.mechanism+'. משתמשים במקרה בדוי או במשימה יומיומית ללא פרטים מזהים.',materials:[],components:[c.id],individualSkills:[c.individual],sharedSkills:[]},
        {id:'s'+i+'-joint',title:'משלבים תרומות ובודקים',minutes:joint,instructions:'עובדים בזוגות או בקבוצות של עד ארבעה. '+c.mechanism+'. יוצרים תכנית משותפת שבה רואים את תרומות המשתתפים. '+(Number(b.count)>4?'אין סבב אישי במליאה; כל קבוצה בוחרת דוגמה אחת.':''),materials:[],components:[c.id],individualSkills:[c.individual],sharedSkills:[c.shared]},
        {id:'s'+i+'-reflect',title:'לומדים ובוחרים צעד המשך',minutes:last,instructions:'בכל קבוצה מציינים מה עבד בפעולה ואיזה שינוי קטן כדאי לנסות. מתעדים פעולות נצפות, ללא ציון חוסן אישי.',materials:[],components:[],individualSkills:['רפלקציה'],sharedSkills:['בחירת צעד משותף']}
      ],debrief:['איזו פעולה אפשרה לנו להתקדם יחד?','מה נרצה לשנות בניסיון הבא?'],nextStep:'מנסים את הצעד שנבחר במצב יומיומי ובודקים אם היה ישים.',participantMaterials:'משימה בדויה: בנו דרך לבצע משימה קטנה יחד. סמנו תרומה אפשרית, מידע חסר, בקשת עזרה וצעד המשך. אפשר לענות בדיבור, בכתב או בציור.'
    }));
    return {schemaVersion:VERSION,title:'צעד קטן — '+c.label,purpose:b.goal||'תרגול '+c.label,focus:c.id,selectionReason:recommendFocus(b).rationale,evidenceStatus:'example-draft',catalogueVersion:VERSION,professionalBasis:[],sessions,participationAlternative:'אפשר לתרום בכתב, בציור או באמצעות דמות בדויה; אפשר לבחור התבוננות ללא חשיפה אישית.',leaderGuidance:'זו דוגמת פיתוח שטרם אושרה לשימוש מקצועי. בחרו משימה פשוטה המתאימה לגיל ולתנאים; בני נוער אינם אחראים לניהול סכנה.',adaptationExplanation:'',goalChanged:false};
  }
  function publicActivity(a) {
    const fields=['schemaVersion','title','purpose','focus','selectionReason','evidenceStatus','catalogueVersion','professionalBasis','sessions','participationAlternative','leaderGuidance','adaptationExplanation','goalChanged'];
    const out=Object.fromEntries(fields.filter(k=>a[k]!==undefined).map(k=>[k,clone(a[k])]));
    // Context used for selection is private. Public kit explains the mechanism only.
    delete out.selectionReason;
    return out;
  }
  function workFile(state) { return Object.assign({type:'begood-resilience-studio',schemaVersion:VERSION,savedAt:new Date().toISOString()},clone(state)); }
  return {VERSION,COMPONENTS,component,newBrief,recommendFocus,claims,validateActivity,exampleActivity,publicActivity,workFile};
});
