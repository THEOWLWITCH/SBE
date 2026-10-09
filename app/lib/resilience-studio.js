/* Shared Studio contract: browser UI, server validation, saved work and exports. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SBE_STUDIO = api;
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';
  const VERSION = '1.0';
  const CONSULTATION_STAGES = ['starting','focus','activity','step','adaptation','facilitation','mechanism','learning'];
  const MECHANISM_TYPES = {none:'עוד לא בחרנו',routine:'שגרה חוזרת',board:'לוח משותף', 'monthly-day':'יום חוסן קבוע',agreement:'הסכמות ותקנון', 'action-team':'צוות פעולה',committee:'ועדה',other:'מנגנון אחר'};
  const MECHANISM_FIELDS = ['name','cadence','roles','participation','firstAction','review','mechanism'];
  const FACILITATION_FIELDS = ['preparation','opening','participation','questions','difficulties','closing','followUp'];
  function socialMechanism(value) {
    const v=value&&typeof value==='object'?value:{};
    return {type:Object.hasOwn(MECHANISM_TYPES,v.type)?v.type:'none',...Object.fromEntries(MECHANISM_FIELDS.map(k=>[k,typeof v[k]==='string'?v[k]:'']))};
  }
  // Facilitator learning guide: why the activity is expected to work (a design hypothesis, not proven efficacy),
  // what to study first (public bank sources only — the server checks sourceId), how to apply, what to observe and the limits.
  const LEARNING_FIELDS = ['mechanism','apply','watchFor','limits'];
  const LEARN_SOURCE_FIELDS = ['sourceId','focus','name','url','version','status'];
  function learningGuide(value) {
    const v=value&&typeof value==='object'?value:{};
    const out=Object.fromEntries(LEARNING_FIELDS.map(k=>[k,typeof v[k]==='string'?v[k]:'']));
    out.learnBefore=(Array.isArray(v.learnBefore)?v.learnBefore:[]).filter(x=>x&&typeof x==='object'&&typeof x.sourceId==='string'&&x.sourceId.trim())
      .map(x=>Object.fromEntries(LEARN_SOURCE_FIELDS.map(k=>[k,typeof x[k]==='string'?x[k]:''])));
    return out;
  }
  function facilitationPlan(value) { const v=value&&typeof value==='object'?value:{};return Object.fromEntries(FACILITATION_FIELDS.map(k=>[k,typeof v[k]==='string'?v[k]:''])); }
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
    ['voice','ביטחון להשמיע קול','להציע רעיון ולהגיב אליו בכבוד, וחשיפה אישית רק למי שרוצה','הבעת עמדה','תגובה מכבדת'],
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
    const b = Object.assign({ startingPoint:'', goal:'', leaderRole:'', leaderAge:'', experience:'', participants:'', participantAge:'', count:8, duration:40, sessions:1, format:'פעילות', familiarity:'', relationships:'', context:'', materials:'', space:'', language:'עברית', accessibility:'', crisis:'routine', youthMode:'adult-supported', focus:'', observations:'', sources:[] }, input || {});
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
      if(step.requiresReview)return;
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
        // "אחרי המפגש" קורה מחוץ למפגש: אפשר 0 דקות, ולא נספר בזמן המפגש (09/10/2026, תקלה בהפקה)
        const after=step.phase==='אחרי המפגש', m=Number(step.minutes);
        if (!Number.isFinite(m)||m<0||(!after&&m===0)) errors.push('משך שלב אינו תקין');
        if (!after) minutes+=Number.isFinite(m)?m:0;
        if (!step.title||!step.instructions) errors.push('חסרות הוראות שלב');
        if (step.requiresReview) errors.push('נדרשת בדיקה מחודשת של רכיבים ומיומנויות לאחר שינוי המטרה או ההוראות');
        for(const f of ['materials','components','individualSkills','sharedSkills']) if(!Array.isArray(step[f])) errors.push('חסר מיפוי '+f);
        if ((step.components||[]).some(id=>!component(id))) errors.push('רכיב שאינו בקטלוג');
      });
      if(minutes>Number(b.duration)) errors.push('סך זמני מפגש '+(i+1)+' חורג מהזמן הזמין');
      if (!(session.debrief||[]).length || !session.nextStep || !session.participantMaterials) errors.push('חסרים דף למשתתפים, שאלות לסיכום או מה עושים אחרי המפגש');
    });
    const c=claims(a);
    if (!c.components.some(x=>x.label===a.focus)) errors.push('רכיב המוקד אינו מתורגל בשלבים');
    if (!c.individual.length || !c.shared.length) errors.push('חסר תרגול של מיומנות אישית או משותפת');
    if (!a.participationAlternative) errors.push('חסרה חלופת השתתפות ללא חשיפה אישית');
    if(a.socialMechanism&&a.socialMechanism.type!=='none') {
      if(!Object.hasOwn(MECHANISM_TYPES,a.socialMechanism.type)||MECHANISM_FIELDS.some(k=>!String(a.socialMechanism[k]||'').trim()))errors.push('השלימו את המנגנון החברתי: תפקידים, השתתפות, פעולה ראשונה, קצב ובחינת ההמשך');
    }
    return [...new Set(errors)];
  }
  function exampleActivity(input) {
    const b=newBrief(input), c=component(b.focus)||component(recommendFocus(b).focus);
    const duration=Math.max(5,Number(b.duration)||40), first=Math.max(1,Math.floor(duration*.15)), second=Math.max(1,Math.floor(duration*.25)), last=Math.max(1,Math.floor(duration*.2)), joint=duration-first-second-last;
    const sessions=Array.from({length:Math.max(1,Number(b.sessions)||1)},(_,i)=>({
      id:'session-'+(i+1),title:i?'מנסים, לומדים ומתאימים':'צעד ראשון יחד',purpose:b.goal||'לתרגל '+c.label+' בפעולה משותפת',link:i?'מתחילים מהתצפית והצעד שנבחרו במפגש הקודם.':'תחילת התהליך',
      steps:[
        {id:'s'+i+'-intro',title:'בוחרים דרך להשתתף',phase:'פתיחה',minutes:first,instructions:'מציגים את היעד ואת המשימה. אפשר לדבר, לכתוב, לצייר או להתבונן. סיפור אישי: רק למי שרוצה.',facilitation:'פותחים: "היום נבנה יחד משהו קטן. כל אחד בוחר איך להשתתף." מראים את דרכי ההשתתפות ומחכים לבחירה, בלי לחץ.',space:'מעגל, כולם רואים את כולם',materials:[],components:[],individualSkills:[],sharedSkills:[]},
        {id:'s'+i+'-prepare',title:'מכינים תרומה',phase:'פעילות מרכזית',minutes:second,instructions:'כל משתתף בוחר תרומה קטנה למשימה: '+c.mechanism+'. משתמשים במקרה בדוי או במשימה יומיומית ללא פרטים מזהים.',facilitation:'מזמינים חשיבה שקטה של דקה, ושואלים: "מה התרומה הקטנה שלך?" עוברים בין המשתתפים ומקשיבים.',space:'כל אחד במקומו, עם דף',materials:[],components:[c.id],individualSkills:[c.individual],sharedSkills:[]},
        {id:'s'+i+'-joint',title:'בונים תכנית משותפת',phase:'פעילות מרכזית',minutes:joint,instructions:'עובדים בזוגות או בקבוצות של עד ארבעה. '+c.mechanism+'. כותבים יחד תכנית אחת, שבה רואים מה כל אחת ואחד תורמים. '+(Number(b.count)>4?'אין סבב אישי במליאה; כל קבוצה בוחרת דוגמה אחת.':''),facilitation:'מזכירים שכל תרומה נכנסת לתכנית. שמים לב למי שלא נשמע, ומזמינים: "מה עוד חסר כאן?"',space:'זוגות או שולחנות של ארבעה',materials:[],components:[c.id],individualSkills:[c.individual],sharedSkills:[c.shared]},
        {id:'s'+i+'-reflect',title:'לומדים ובוחרים צעד המשך',phase:'סיכום',minutes:last,instructions:'בכל קבוצה מציינים מה עבד בפעולה ואיזה שינוי קטן כדאי לנסות. מתעדים פעולות נצפות, ללא ציון חוסן אישי.',facilitation:'שואלים: "מה עבד לנו?" ו"מה ננסה אחרת?" מסכמים בקול את הצעד שנבחר, מי אחראי ועד מתי.',space:'חוזרים למעגל',materials:[],components:[],individualSkills:['רפלקציה'],sharedSkills:['בחירת צעד משותף']}
      ],debrief:['איזו פעולה אפשרה לנו להתקדם יחד?','מה נרצה לשנות בניסיון הבא?'],nextStep:'מנסים את הצעד שנבחר במצב יומיומי ובודקים אם היה ישים.',participantMaterials:'הקבוצה מקבלת משימה קטנה לעשות יחד, למשל לתכנן פינת עזרה בכיתה. על הדף כל אחת ואחד כותבים או מציירים מה הם יכולים לתרום ומה הם צריכים כדי להצליח. בסוף בוחרים יחד צעד אחד שעושים השבוע.'
    }));
    return {schemaVersion:VERSION,title:'צעד קטן: '+c.label,purpose:b.goal||'תרגול '+c.label,focus:c.id,selectionReason:recommendFocus(b).rationale,evidenceStatus:'example-draft',catalogueVersion:VERSION,professionalBasis:[],sessions,participationAlternative:'אפשר לתרום בכתב, בציור או באמצעות דמות בדויה; אפשר לבחור התבוננות ללא חשיפה אישית.',leaderGuidance:'זו דוגמת פיתוח שטרם אושרה לשימוש מקצועי. בחרו משימה פשוטה המתאימה לגיל ולתנאים; בני נוער אינם אחראים לניהול סכנה.',adaptationExplanation:'',goalChanged:false,
      socialMechanism:socialMechanism({type:'routine',name:'שגרת פעולה משותפת',cadence:'פעם בשבוע במועד שהקבוצה תבחר',roles:'מובילת השגרה מתאמת זמן; משתתפים בוחרים תרומה וגיבוי',participation:'בחירה בתרומה בדיבור, בכתב או בציור; אפשר לדלג',firstAction:'בוחרים יחד משימה קטנה ומועד לניסיון ראשון',review:'אחרי שני ניסיונות בודקים מה היה ישים ומה כדאי לשנות',mechanism:c.mechanism}),
      learningGuide:learningGuide({mechanism:'ההשערה שמאחורי הפעילות: '+c.mechanism+'. זו השערת תכנון לתרגול '+c.label+', לא ממצא שנבדק על הפעילות הזאת.',learnBefore:[],apply:'לפני המפגש נסו את המשימה בעצמכם, וכתבו משפט אחד: איזו פעולה של המשתתפים תראה שהמנגנון פועל. במפגש הזמינו את הפעולה הזו במפורש, ותנו לה זמן.',watchFor:'פעולות נצפות: מי תרם, האם תרומות שולבו בתוצר המשותף, האם התבקשה או ניתנה עזרה. לא מסיקים מכך על חוסן של אדם.',limits:'דוגמת פיתוח שטרם אושרה. אינה טיפול ואינה אבחון. בקושי רגשי עוצרים, משוחחים באופן אישי ומבררים יחד מה יעזור; בסכנה מיידית נשארים ומזעיקים עזרה.'}),
      facilitationPlan:facilitationPlan({preparation:'נסו בעצמכם את המשימה והכינו חלופה ללא ציוד. תכננו עבודה בקבוצות קטנות לפי הזמן הזמין.',opening:'הציגו מטרה, זמן ודרך להשתתף בלי לחשוף סיפור אישי. בדקו שההוראה מובנת לפני שמתחילים.',participation:'אפשרו חשיבה שקטה לפני שיחה. הזמינו תרומות שונות בלי לכפות דיבור.',questions:'שאלו: מה אפשר לנו להתקדם יחד? איזה שינוי קטן ננסה?',difficulties:'בשתיקה תנו זמן או כתיבה. במחלוקת החזירו להקשבה ולהסכמות. בפגיעה עצרו את הפעולה ובקשו תמיכה מתאימה.',closing:'סכמו פעולה שנלמדה ובחרו צעד המשך אחד עם אחריות ברורה.',followUp:'במועד שנבחר בדקו מה נעשה בפועל והתאימו את השגרה יחד.'})};
  }
  function publicActivity(a) {
    const fields=['schemaVersion','title','purpose','focus','evidenceStatus','catalogueVersion','professionalBasis','sessions','participationAlternative','leaderGuidance','adaptationExplanation','goalChanged','socialMechanism','facilitationPlan','learningGuide'];
    const out=Object.fromEntries(fields.filter(k=>a[k]!==undefined).map(k=>[k,clone(a[k])]));
    // Context used for selection is private. Public kit explains the mechanism only.
    return out;
  }
  function workFile(state) { return Object.assign({type:'begood-resilience-studio',schemaVersion:VERSION,savedAt:new Date().toISOString()},clone(state)); }
  const STEP_PHASES=['פתיחה','פעילות מרכזית','סיכום','אחרי המפגש'];
  return {STEP_PHASES,VERSION,CONSULTATION_STAGES,MECHANISM_TYPES,MECHANISM_FIELDS,FACILITATION_FIELDS,LEARNING_FIELDS,socialMechanism,facilitationPlan,learningGuide,COMPONENTS,component,newBrief,recommendFocus,claims,validateActivity,exampleActivity,publicActivity,workFile};
});
