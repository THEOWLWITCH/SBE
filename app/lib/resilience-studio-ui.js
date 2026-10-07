/* Studio UI: structured edits, owner-scoped work, and an authenticated AI boundary. */
(function () {
  'use strict';
  const D = window.SBE_STUDIO;
  if (!D) return;
  const $ = id => document.getElementById(id);
  const copy = value => JSON.parse(JSON.stringify(value));
  const uid = prefix => prefix + '-' + (window.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  const ownerKey = base => window.sbeUserKey ? window.sbeUserKey(base) : base + ':anon';
  const STORE = ownerKey('sbe.studio.v1');
  const HANDOFF = ownerKey('sbe.studio.mapping');
  const API = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) ? 'http://localhost:8790/api/studio' : 'https://sbe-server.onrender.com/api/studio';
  const BRIEF_FIELDS = ['startingPoint','goal','leaderRole','leaderAge','experience','participants','participantAge','count','duration','sessions','format','familiarity','relationships','context','materials','space','language','accessibility','crisis','youthMode','focus','observations','clarifications'];
  const NUMBERS = new Set(['count','duration','sessions']);
  const EVIDENCE = {'example-draft':'דוגמת פיתוח — טרם אושרה','new-ai':'פעילות חדשה בבינה מלאכותית — טיוטה; יעילותה לא נבדקה'};
  const MECHANISM_LABELS={name:'שם המנגנון',cadence:'מתי ובאיזו תדירות?',roles:'מי אחראית, מי שותף ומי מגבה?',participation:'איך משתתפים ומשפיעים?',firstAction:'הפעולה הראשונה',review:'מתי ואיך בודקים ומשפרים?',mechanism:'איך המנגנון מתרגל את מוקד החוסן?'};
  const LEARNING_LABELS={mechanism:'איך הפעילות אמורה לעבוד (השערת התכנון)',apply:'איך מיישמים במפגש',watchFor:'מה נראה בפועל אם המנגנון פועל',limits:'גבולות: מה הפעילות אינה, ומתי עוצרים'};
  const FACILITATION_LABELS={preparation:'לפני המפגש: הכנה וחזרה',opening:'פתיחה והסכמות',participation:'הזמנת השתתפות',questions:'שאלות והקשבה',difficulties:'שתיקה, התנגדות או מחלוקת',closing:'סגירה ועיבוד',followUp:'המשך ולמידה מההנחיה'};
  const IDEAS = [
    {id:'education',audience:'חינוך',title:'מידע חסר, פתרון משותף',focus:'support',purpose:'לתרגל בקשת עזרה והחלפת מידע במשימה משותפת.',individual:['זיהוי מידע חסר','בקשת עזרה והבהרה'],shared:['החלפת מידע ועזרה','בניית תכנית משולבת'],steps:['בקבוצות קטנות כל משתתף מקבל חלק אחר של משימה בדויה.','שואלים ומחליפים מידע כדי לבנות תכנית אחת.','מזהים איזו בקשת עזרה אפשרה להתקדם.'],participants:'קבוצת תלמידים',age:'לפי גיל הקבוצה',goal:'לבקש מידע ועזרה ולבנות פתרון משותף',duration:40},
    {id:'youth',audience:'נוער מוביל',title:'יוזמה קטנה שאנחנו מובילים',focus:'direction',purpose:'לבחור יעד חיובי ולחבר תרומות של שותפים בדרך אליו.',individual:['הצעת יעד','בחירת תרומה'],shared:['תיאום יעד ומדד פעולה','חלוקת אחריות'],steps:['מציעים יוזמה פשוטה לשיפור דבר יומיומי.','בוחרים יעד ומחלקים תפקידים עם שותף וגיבוי.','קובעים פעולה ראשונה וסימן שניתן לראות שהתקדמנו.'],participants:'בני ובנות נוער ושותפים ליוזמה',age:'נוער',goal:'לקדם יוזמה קטנה באמצעות יעד ותפקידים משותפים',duration:40,leaderRole:'נער/ה שמוביל/ה יוזמה'},
    {id:'family',audience:'הורים ומשפחה',title:'רבע שעה של עזרה הדדית',focus:'support',purpose:'לתאם עזרה הדדית במשימה קצרה שמתאימה לבית.',individual:['בקשת עזרה והבהרה'],shared:['החלפת מידע ועזרה'],steps:['בוחרים יחד משימה ביתית קטנה ללא חשיפה אישית.','כל אחד מציע תרומה ומבקש מידע או עזרה שחסרים לו.','מבצעים חלק קטן ומציינים מה עזר לנו להתקדם יחד.'],participants:'בני משפחה',age:'ילדים ומבוגרים — לפי המשפחה',goal:'לבקש ולהציע עזרה במשימה יומיומית בבית',duration:15,count:4,leaderRole:'הורה או בן/בת משפחה'},
    {id:'work',audience:'צוות עבודה',title:'מישהו יכול להמשיך במקומי',focus:'backup',purpose:'ליצור גיבוי למשימה שבה יש תלות בבעל תפקיד אחד.',individual:['העברת ידע'],shared:['תיאום גיבוי'],steps:['בוחרים משימה יומיומית בלי מידע ארגוני רגיש.','בזוגות כותבים הוראות קצרות ומנסים להחליף תפקיד.','מעדכנים יחד את ההוראות ובוחרים דרך לבדוק את הגיבוי.'],participants:'צוות עבודה',age:'מבוגרים',goal:'לבנות ולנסות גיבוי למשימה יומיומית',duration:30,leaderRole:'מוביל/ת צוות'},
    {id:'community',audience:'קהילה',title:'מפת עזרה שאפשר להשתמש בה',focus:'resources',purpose:'לחבר בין צרכים לבין דרכים נגישות לבקש ולהציע עזרה.',individual:['איתור משאבים','בירור צורך'],shared:['בניית מפת עזרה','תיאום דרך פנייה'],steps:['עובדים עם צרכים בדויים או כלליים ללא פרטים מזהים.','בקבוצות מציעים משאב זמין ודרך פנייה נגישה.','בודקים יחד חסם אחד ומתקנים את דרך קבלת העזרה.'],participants:'קבוצה קהילתית',age:'לפי קבוצת המשתתפים',goal:'לבנות מפת עזרה נגישה ולבחון כיצד משתמשים בה',duration:40,leaderRole:'מוביל/ת קבוצה קהילתית'}
  ];
  const emptyState = () => ({brief:D.newBrief(),activity:null,activityBrief:null,versions:[],ideas:[],variants:[],mapping:null,recommendation:null,confirmed:false,currentId:null,coach:{stage:'starting',concerns:'',variantConcerns:{},messages:[]}});
  let state = emptyState(), saved = [], busy = false, authorized = false, mappingCredentials = null, candidate = null, editingBaseArchived = false, persistenceFailed = false, coachTarget = null, coachProposal = null;

  function el(tag, className, text) { const n=document.createElement(tag); if(className)n.className=className; if(text!==undefined)n.textContent=String(text); return n; }
  function clear(node) { node.replaceChildren(); return node; }
  function button(text, handler, className) { const b=el('button',className||'btn secondary small',text); b.type='button'; b.addEventListener('click',handler); return b; }
  function list(lines, ordered) { const n=el(ordered?'ol':'ul'); (lines||[]).forEach(x=>n.append(el('li','',x))); return n; }
  function labelText(label, text) { const p=el('p'); p.append(el('b','',label+' '),document.createTextNode(String(text||'—'))); return p; }
  function paragraph(parent, title, value) { if(title)parent.append(el('h3','',title));parent.append(window.SBE_DOC ? SBE_DOC.rich(value||'') : el('p','',value||'')); }
  function safeLink(url, name) { try{const u=new URL(url); if(!['https:','http:'].includes(u.protocol))return null; const a=el('a','',name||url); a.href=u.href; a.target='_blank'; a.rel='noopener noreferrer'; return a;}catch{return null;} }
  function componentLabel(id) { return (D.component(id)||{}).label||id; }
  function evidenceLabel(a) { return EVIDENCE[a.evidenceStatus] || 'פעילות חדשה או מותאמת — יעילותה לא נבדקה'; }
  function dateLabel(date) { const n=new Date(date); return Number.isNaN(n.getTime())?'':n.toLocaleString('he-IL',{dateStyle:'short',timeStyle:'short'}); }
  function notice(text) { const n=$('studio-status'); n.textContent=text ? text+(persistenceFailed?' השינויים האחרונים קיימים רק במסך; השמירה במכשיר לא הצליחה.':'') : ''; n.hidden=!text; }
  function error(text) { const n=$('studio-error'); n.textContent=text||''; n.hidden=!text; if(text)n.scrollIntoView({block:'nearest'}); }
  function token() { try{return sessionStorage.getItem('sbe.session.token')||'';}catch{return '';} }
  function setBusy(value, message) { busy=value; document.body.classList.toggle('busy',value); document.querySelectorAll('button,input,textarea,select').forEach(n=>{n.disabled=value;}); if(message)notice(message); updateControls(); }
  function lockWorkspace() {
    authorized=false; state=emptyState(); saved=[]; setCandidate(null); mappingCredentials=null; coachTarget=null;coachProposal=null;render();
    $('saved-work-list').replaceChildren(el('p','muted','כדי לפתוח עבודה שמורה נדרשת כניסה פעילה והרשאה לסטודיו.'));
  }
  // Model actions run as a background job on the server: one long request was cut by proxies, sleeping
  // phones and redeploys. The server checks permissions first, returns a jobId and keeps the result in
  // memory; we ask for its status every few seconds. A server restart mid-job ('unknown') retries once.
  const MODEL_ACTIONS=['analyze','generate','adapt','consult'];
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  async function post(body, ms) {
    const ctrl=new AbortController(), timeout=setTimeout(()=>ctrl.abort(),ms);
    try {
      const response=await fetch(API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...body,token:token()}),signal:ctrl.signal});
      const data=await response.json().catch(()=>({error:'השרת לא החזיר תשובה תקינה'}));
      return {ok:response.ok,status:response.status,data};
    } finally{clearTimeout(timeout);}
  }
  async function background(body, retried) {
    const started=await post({...body,async:true},90*1000);
    if(!started.ok||!started.data.jobId) return started;
    const t0=Date.now(); let misses=0;
    while(Date.now()-t0<9*60*1000) {
      await sleep(document.hidden?8000:3000);
      let d;
      try { const r=await post({action:'status',jobId:started.data.jobId},30*1000); if(!r.ok)throw new Error(); d=r.data; misses=0; }
      catch { if(++misses>=20)throw new Error('החיבור לשרת נקטע לזמן ארוך. התוכן הקיים נשמר; אפשר לנסות שוב.'); continue; }
      if(d.status==='done') return {ok:d.httpStatus>=200&&d.httpStatus<300,status:d.httpStatus,data:d.result||{}};
      if(d.status==='unknown') { if(!retried)return background(body,true); throw new Error('השרת הופעל מחדש באמצע. התוכן הקיים נשמר; אפשר לנסות שוב.'); }
    }
    throw new Error('הבנייה נמשכה מעבר לזמן ההמתנה. התוכן הקיים נשמר; אפשר לנסות שוב.');
  }
  async function api(body) {
    let reply;
    try { reply=MODEL_ACTIONS.includes(body.action)?await background(body,false):await post(body,90*1000); }
    catch(e) { if(e.name==='AbortError')throw new Error('השרת לא ענה בזמן. התוכן הקיים נשמר; אפשר לנסות שוב.'); throw e; }
    const {ok,status,data}=reply;
    if(!ok||data.error) {
      if(data.code==='mapping_forbidden') {
        mappingCredentials=null;state.mapping=null;state.confirmed=false;
        $('brief-confirmed').checked=false;renderMapping();updateControls();persist();
        throw new Error(data.error+' העבודה נשמרה; אפשר להמשיך ללא מיפוי או לחבר מיפוי מורשה ממסך המיפוי.');
      }
      if(status===401||status===403)lockWorkspace();
      if(Array.isArray(data.questions)&&data.questions.length) {
        state.recommendation={focus:data.focus||state.brief.focus,rationale:data.rationale||'נדרשת הבהרה על הקלט לפני בחירת הפעולה.',alternatives:[],questions:data.questions.map(String)};
        state.brief.clarifications='';$('clarifications').value='';state.confirmed=false;$('brief-confirmed').checked=false;
        renderRecommendation();updateControls();persist();$('clarification-panel').scrollIntoView({block:'start'});
      }
      throw new Error(data.error||'שגיאת שרת '+status);
    }
    authorized=true;
    return data;
  }
  async function ensureAuthorized() { const d=await api({action:'authorize'}); if(d.ok!==true)throw new Error('לא ניתן לאמת הרשאה לפתיחת העבודה.'); return true; }
  async function operation(message, fn) {
    if(busy)return;
    error(''); setBusy(true,message);
    const began=Date.now(), tick=setInterval(()=>{if(busy)notice(message+' · חלפו '+Math.floor((Date.now()-began)/1000)+' שניות');},1000);
    try { await fn(); }
    catch(e) { notice(''); error(e.message||'הפעולה לא הצליחה. אפשר לנסות שוב.'); }
    finally {clearInterval(tick);setBusy(false);}
  }
  function cleanBrief(value) {
    const input={}; BRIEF_FIELDS.forEach(k=>{if(value&&value[k]!==undefined)input[k]=NUMBERS.has(k)?Number(value[k]):String(value[k]);});
    input.sources=value&&Array.isArray(value.sources)?value.sources:[];
    return D.newBrief(input);
  }
  function cleanReply(value) {
    const v=value&&typeof value==='object'?value:{};
    const out=Object.fromEntries(['answer','encouragement','suggestedInstructions'].map(k=>[k,typeof v[k]==='string'?v[k]:'']));
    ['nextSteps','questions'].forEach(k=>out[k]=(Array.isArray(v[k])?v[k]:[]).filter(x=>typeof x==='string'));
    out.professionalBasis=(Array.isArray(v.professionalBasis)?v.professionalBasis:[]).map(s=>Object.fromEntries(['sourceId','explanation','name','url','version','status'].map(k=>[k,typeof s?.[k]==='string'?s[k]:''])));
    return out;
  }
  function cleanCoach(value) {
    const v=value&&typeof value==='object'?value:{};
    return {stage:D.CONSULTATION_STAGES.includes(v.stage)?v.stage:'starting',concerns:typeof v.concerns==='string'?v.concerns:'',variantConcerns:Object.fromEntries(Object.entries(v.variantConcerns&&typeof v.variantConcerns==='object'?v.variantConcerns:{}).filter(([k,text])=>/^coach-/.test(k)&&typeof text==='string')),messages:(Array.isArray(v.messages)?v.messages:[]).filter(m=>m&&['user','assistant'].includes(m.role)&&typeof m.text==='string').map(m=>({role:m.role,text:m.text,stage:String(m.stage||'starting'),scope:String(m.scope||'general'),context:String(m.context||''),...(m.role==='assistant'?{reply:cleanReply(m.reply)}:{})}))};
  }
  function selectedCoachActivity() { return coachTarget?.isCandidate ? candidate?.activity : state.activity; }
  function setCandidate(value) {
    if(candidate===value)return;
    candidate=value;
    if(coachTarget?.isCandidate||coachProposal?.isCandidate){coachTarget=null;coachProposal=null;if(state.coach.stage==='step')state.coach.stage='activity';renderCoach();}
  }
  function selectedCoachStep() { return coachTarget ? selectedCoachActivity()?.sessions.flatMap(s=>s.steps).find(s=>s.id===coachTarget.stepId) : null; }
  function linkedCoach() { return coachTarget?.isCandidate&&candidate?.kind==='variant'; }
  function coachConcerns() { return linkedCoach() ? state.coach.variantConcerns[candidate.coachScope]||'' : state.coach.concerns; }
  function setCoachConcerns(value) { if(linkedCoach())state.coach.variantConcerns[candidate.coachScope]=value;else state.coach.concerns=value; }
  function openCoach(stage,step,isCandidate) {
    if(isCandidate&&candidate&&!candidate.coachScope)candidate.coachScope=uid('coach');
    state.coach.stage=stage;coachTarget=step||isCandidate?{stepId:step?.id||null,isCandidate:!!isCandidate}:null;coachProposal=null;
    renderCoach();persist();$('coach-section').scrollIntoView({block:'start',behavior:'smooth'});$('coach-question').focus({preventScroll:true});
  }
  function renderCoach() {
    $('coach-stage').value=state.coach.stage;$('coach-concerns').value=coachConcerns();
    if(!authorized)$('coach-question').value='';
    const step=selectedCoachStep(),target=$('coach-target');target.hidden=!coachTarget;target.textContent=(step?'השיחה עוסקת בשלב: '+step.title:coachTarget?.isCandidate&&!coachTarget.stepId?'השיחה עוסקת בגרסה המוצעת של הפעילות.':'השלב הקודם אינו פתוח כעת. בחרי שלב מתוך הפעילות כדי לבקש שיפור.')+(linkedCoach()?' התקציר והשיחה של הפעילות המקורית אינם מצורפים. אפשר לכתוב כאן חשש חדש לגרסה הזאת.':'');
    const messages=clear($('coach-messages'));
    state.coach.messages.forEach(m=>{const item=el('article',m.role==='user'?'coach-message coach-user':'coach-message');item.append(el('b','',m.role==='user'?'את · '+(m.context||'התכנון שלנו'):'שותפה לתכנון'));paragraph(item,'',m.text);if(m.reply){const r=m.reply;if(r.encouragement)paragraph(item,'לקראת הצעד הבא',r.encouragement);if(r.suggestedInstructions.trim()&&(!coachProposal||coachProposal.instructions!==r.suggestedInstructions))paragraph(item,'נוסח שהוצע בשיחה — לעיון, ללא שינוי אוטומטי',r.suggestedInstructions);if(r.nextSteps.length)item.append(el('h4','','צעדים שאפשר לנסות'),list(r.nextSteps));if(r.questions.length)item.append(el('h4','','אפשר להמשיך מכאן'),list(r.questions));if(r.professionalBasis.length)item.append(renderBasis({consultation:true,professionalBasis:r.professionalBasis}));}messages.append(item);});
    const proposal=clear($('coach-proposal'));proposal.hidden=!coachProposal;
    if(coachProposal){proposal.append(el('h3','','נוסח מוצע לשלב — לבחירתך'),el('p','',coachProposal.instructions),button('קבלת הנוסח המוצע לשלב',acceptCoachProposal),button('המשך בלי לשנות את השלב',()=>{coachProposal=null;renderCoach();}));}
    $('ask-coach').disabled=busy||!authorized;
  }
  function askCoach() {
    if(busy)return;const question=$('coach-question').value.trim();if(!question){error('כתבי שאלה או שיפור שנרצה לחשוב עליהם.');return;}
    if(coachTarget?.isCandidate&&!candidate){coachTarget=null;coachProposal=null;renderCoach();error('ההצעה הזאת כבר נסגרה. בחרי את הפעילות או השלב שעליהם תרצי לשאול.');return;}
    collectBrief();setCoachConcerns($('coach-concerns').value);
    const stage=state.coach.stage,step=selectedCoachStep(),activity=selectedCoachActivity();
    if(stage==='step'&&!step){error('בחרי בשלב את הכפתור שאלות ושיפור לשלב.');return;}
    const scope=coachTarget?.isCandidate?candidate.coachScope+':'+(step?.id||'general'):step?'activity:'+step.id:'general';
    const context=step?step.title:$('coach-stage').selectedOptions[0].textContent;
    const history=state.coach.messages.filter(m=>m.scope===scope&&m.stage===stage).map(m=>({role:m.role,text:m.role==='assistant'?[m.text,m.reply?.encouragement,...(m.reply?.nextSteps||[]),...(m.reply?.questions||[])].filter(Boolean).join('\n'):m.text}));
    const brief=coachTarget?.isCandidate?candidate.brief:state.brief;
    const request=linkedCoach()?{action:'consult',brief:cleanBrief(brief),...(activity?{previous:cleanActivity(activity)}:{})}:requestBody('consult',brief,activity);
    const body={...request,question,stage,concerns:coachConcerns(),history,...(step?{stepId:step.id}:{})};
    const target=coachTarget?{...coachTarget,candidateRef:coachTarget.isCandidate?candidate:null}:null,baseInstructions=step?.instructions;
    state.coach.messages.push({role:'user',text:question,stage,scope,context});coachProposal=null;renderCoach();persist();
    operation('חושבים יחד על השאלה שלך…',async()=>{const data=await api(body);if(!data.consultation?.answer)throw new Error('לא התקבלה תשובה לשיחה. השאלה נשארה פתוחה.');const reply=cleanReply(data.consultation);state.coach.messages.push({role:'assistant',text:reply.answer,stage,scope,context,reply});if(target&&reply.suggestedInstructions.trim())coachProposal={...target,baseInstructions,instructions:reply.suggestedInstructions};$('coach-question').value='';renderCoach();persist();notice('התשובה מוכנה. אפשר לשאול עוד, לבחור שינוי או להמשיך בתכנון.');});
  }
  function acceptCoachProposal() {
    if(!coachProposal||busy)return;const p=coachProposal,a=p.isCandidate?candidate?.activity:state.activity,step=a?.sessions.flatMap(s=>s.steps).find(s=>s.id===p.stepId);
    if(p.isCandidate&&p.candidateRef!==candidate){coachProposal=null;renderCoach();error('ההצעה לפעילות השתנתה. אפשר לבקש שיפור חדש לגרסה הפתוחה.');return;}
    if(!step||step.instructions!==p.baseInstructions){error('השלב השתנה מאז ההצעה. אפשר לבקש שיפור חדש לפי הנוסח הנוכחי.');return;}
    prepareActivityEdit(p.isCandidate);step.instructions=p.instructions;step.requiresReview=true;coachProposal=null;persist();
    if(p.isCandidate)renderCandidate();else renderActivity();renderCoach();updateControls();notice('הנוסח נבחר. בדקי מחדש את רכיבי החוסן והמיומנויות של השלב לפני הייצוא.');
  }
  function renderFacilitationGuide() {
    const host=clear($('facilitation-guide'));
    const topics=[
      ['מכינים תהליך, לא רק תוכן','בחרי תוצאה אפשרית, בדקי זמן ומרחב ונסי את ההוראות בעצמך. הגדירי מה אפשר לבחור ואיך משתתפים.','IAFCompetencies2026'],
      ['פותחים בהסכמות ובהוראה קצרה','הציגי את המטרה, הזמן ודרכי ההשתתפות. בקשי ממשתתפת לנסח את ההוראה במילים שלה ובדקי שהקבוצה מבינה.','IAFCompetencies2026'],
      ['מזמינים קול בלי לכפות חשיפה','שלבי חשיבה שקטה, כתיבה וזוגות. תני מקום לקולות שונים ואפשרי לבחור לא לשתף סיפור אישי.','IAFCompetencies2026'],
      ['מקשיבים ומבררים','שאלי מה קרה בפעולה ומה אפשר ללמוד. שקפי את מה ששמעת ובדקי עם הקבוצה אם הבנת.','IAFCompetencies2026'],
      ['מתמודדים עם קושי בתהליך','בשתיקה אפשר לתת זמן או דרך כתובה. במחלוקת הזמיני הקשבה והחזירי להסכמות; בפגיעה עצרי ובקשי תמיכה מתאימה.','IAFCompetencies2026'],
      ['סוגרים ומכינים המשך','סכמי עם הקבוצה פעולה שנלמדה, תפקידים וצעד ראשון. בהמשך בדקו מה היה ישים ומה כדאי לשנות.','IAFCompetencies2026'],
      ['כשהמשתתפים בני נוער','התאימי גיל, מבנה, בחירה ותמיכה. בדקי שההשתתפות נגישה ובטוחה והיעזרי במבוגר ובנהלי המסגרת לפי הצורך.','UnicefAdolescentKit2026']
    ];
    topics.forEach(([title,text,key])=>{const card=el('details','guide-topic');card.append(el('summary','',title),el('p','',text));const source=window.SBE_ADVISOR_SOURCES?.byKey[key];if(source)card.append(safeLink(source.url,source.apa));host.append(card);});
  }
  function cleanActivity(value) {
    // Work-file imports have the same explicit data boundary as generated activities.
    const text = key => typeof value[key]==='string'?value[key]:'';
    const a={schemaVersion:text('schemaVersion'),title:text('title'),purpose:text('purpose'),focus:text('focus'),selectionReason:text('selectionReason'),evidenceStatus:text('evidenceStatus'),catalogueVersion:text('catalogueVersion'),participationAlternative:text('participationAlternative'),leaderGuidance:text('leaderGuidance'),adaptationExplanation:text('adaptationExplanation'),goalChanged:value.goalChanged===true};
    a.socialMechanism=D.socialMechanism(value.socialMechanism);a.facilitationPlan=D.facilitationPlan(value.facilitationPlan);a.learningGuide=D.learningGuide(value.learningGuide);
    const array = input => (Array.isArray(input)?input:[]).map(String);
    a.professionalBasis=(Array.isArray(value.professionalBasis)?value.professionalBasis:[]).map(s=>typeof s==='string'?s:{sourceId:String(s.sourceId||''),explanation:String(s.explanation||''),name:String(s.name||''),url:String(s.url||''),version:String(s.version||''),status:String(s.status||'')});
    a.sessions=(Array.isArray(value.sessions)?value.sessions:[]).map(s=>({id:String(s.id||''),title:String(s.title||''),purpose:String(s.purpose||''),link:String(s.link||''),debrief:array(s.debrief),nextStep:String(s.nextStep||''),participantMaterials:String(s.participantMaterials||''),steps:(Array.isArray(s.steps)?s.steps:[]).map(step=>({id:String(step.id||''),title:String(step.title||''),minutes:Number(step.minutes),instructions:String(step.instructions||''),requiresReview:step.requiresReview===true,materials:array(step.materials),components:array(step.components),individualSkills:array(step.individualSkills),sharedSkills:array(step.sharedSkills)}))}));
    return a;
  }
  function safeMapping(value) {
    // Only the aggregate response is kept. Tokens, management keys and respondent rows never enter work files.
    if(!value||typeof value!=='object')return null;
    const out={};
    ['title','scope','population','date','createdAt','band','ageBand','round','roundLabel','count','respondents','respondentCount','responseCount','selectedItems','limitations','sourceVersion','version','semantics','scale'].forEach(k=>{if(value[k]!==undefined)out[k]=copy(value[k]);});
    if(value.dates&&typeof value.dates==='object')out.dates={from:String(value.dates.from||''),to:String(value.dates.to||'')};
    if(Array.isArray(value.selectedStatements))out.selectedStatements=value.selectedStatements.map(s=>({id:Number(s.id),position:Number(s.position),group:String(s.group||''),domain:String(s.domain||''),text:String(s.text||''),polarity:s.polarity==='reverse'?'reverse':'positive'}));
    if(Array.isArray(value.voices))out.voices=value.voices.map(v=>({voice:v.voice,label:String(v.label||''),count:Number(v.count)||0}));
    if(Array.isArray(value.domains))out.domains=value.domains.map(d=>({group:String(d.group||d.g||''),name:String(d.name||d.d||d.domain||''),label:String(d.label||''),score:Number(d.score),good:Number(d.good),harm:Number(d.harm),cap:Number(d.cap),capped:!!d.capped,unknownRate:Number(d.unknownRate),gap:Number(d.gap),flags:(Array.isArray(d.flags)?d.flags:[]).map(String),coverage:d.coverage?{positiveItems:Number(d.coverage.positiveItems)||0,reverseItems:Number(d.coverage.reverseItems)||0,positiveMeasured:d.coverage.positiveMeasured===true,reverseMeasured:d.coverage.reverseMeasured===true}:null}));
    return out;
  }
  function snapshot() {
    return {brief:cleanBrief(state.brief),activity:state.activity?cleanActivity(state.activity):null,activityBrief:state.activityBrief?cleanBrief(state.activityBrief):null,versions:state.versions.map(v=>({id:v.id,at:v.at,reason:v.reason,brief:cleanBrief(v.brief),activity:cleanActivity(v.activity),mapping:safeMapping(v.mapping)})),ideas:copy(state.ideas),variants:state.variants.map(v=>({id:v.id,at:v.at,brief:cleanBrief(v.brief),activity:D.publicActivity(cleanActivity(v.activity))})),mapping:safeMapping(state.mapping),currentId:state.currentId,coach:cleanCoach(state.coach)};
  }
  function persist() {
    if(!authorized)return false;
    try{localStorage.setItem(STORE,JSON.stringify({state:snapshot(),saved}));if(persistenceFailed)error('');persistenceFailed=false;return true;}
    catch{persistenceFailed=true;error('לא הצלחנו לשמור במכשיר. העריכה עדיין פתוחה כאן. אפשר להוריד קובץ עבודה אישי לפני סגירת המסך.');return false;}
  }
  function readWork(value, strict) {
    if(!value||typeof value!=='object')throw new Error('מבנה קובץ העבודה אינו תקין.');
    const s=emptyState(); s.brief=cleanBrief(value.brief); s.activity=value.activity?cleanActivity(value.activity):null; s.activityBrief=cleanBrief(value.activityBrief||value.brief);
    s.coach=cleanCoach(value.coach);
    if(s.activity) {
      if(s.activity.schemaVersion!==D.VERSION)throw new Error('גרסת הפעילות אינה נתמכת בקובץ העבודה הזה.');
      const problems=D.validateActivity(s.activity,s.activityBrief);
      if(strict&&problems.length)throw new Error('בקובץ יש פעילות שאינה תקינה: '+problems.join('; '));
    }
    s.versions=(Array.isArray(value.versions)?value.versions:[]).map(v=>{
      if(!v||!v.activity||v.activity.schemaVersion!==D.VERSION)throw new Error('בקובץ יש גרסה קודמת שאינה נתמכת.');
      const b=cleanBrief(v.brief||s.activityBrief);
      // Archived edits may be incomplete; they remain editable drafts and cannot be exported until valid.
      return {id:String(v.id||uid('version')),at:String(v.at||''),reason:String(v.reason||''),brief:b,activity:cleanActivity(v.activity),mapping:safeMapping(v.mapping)};
    });
    s.ideas=(Array.isArray(value.ideas)?value.ideas:[]).filter(id=>IDEAS.some(x=>x.id===id));
    s.variants=(Array.isArray(value.variants)?value.variants:[]).map(v=>{
      if(!v||!v.activity||v.activity.schemaVersion!==D.VERSION)throw new Error('גרסה מקושרת בקובץ אינה נתמכת.');
      const b=cleanBrief(v.brief);
      if(strict&&D.validateActivity(v.activity,b).length)throw new Error('גרסה מקושרת בקובץ אינה תקינה.');
      return {id:String(v.id||uid('variant')),at:String(v.at||''),brief:b,activity:D.publicActivity(cleanActivity(v.activity))};
    });
    s.mapping=safeMapping(value.mapping); s.currentId=typeof value.currentId==='string'?value.currentId:null;
    return s;
  }
  function fillBrief() { BRIEF_FIELDS.forEach(k=>{const n=$(k);if(n)n.value=state.brief[k]===undefined?'':state.brief[k];}); $('brief-confirmed').checked=state.confirmed; }
  function collectBrief() { BRIEF_FIELDS.forEach(k=>{const n=$(k);if(n)state.brief[k]=NUMBERS.has(k)?Number(n.value):n.value;}); return state.brief; }
  function markBriefChanged(field) {
    collectBrief(); state.confirmed=false; $('brief-confirmed').checked=false;
    if(field!=='clarifications'){state.recommendation=null;renderRecommendation();}
    renderFocus();updateControls();persist();
  }
  function briefProblems(brief) {
    const problems=[];
    if(!String(brief.participants||'').trim())problems.push('מי המשתתפים?');
    if(!String(brief.participantAge||'').trim())problems.push('מה גיל המשתתפים?');
    if(!Number.isInteger(brief.count)||brief.count<2)problems.push('אפשר להזין מספר משתתפים שלם — שניים לפחות.');
    if(!Number.isFinite(brief.duration)||brief.duration<5)problems.push('נדרש זמן של לפחות חמש דקות לכל מפגש.');
    if(!Number.isInteger(brief.sessions)||brief.sessions<1)problems.push('נדרש לפחות מפגש אחד, במספר שלם.');
    if(brief.crisis==='active-danger')problems.push('בסכנה מיידית עוצרים את הפעילות ופועלים לפי הנחיות הבטיחות המוסמכות למקום. חוזרים לתכנון לאחר שהמצב בטוח.');
    if(!D.component(brief.focus))problems.push('בחרו רכיב מוקד.');
    return problems;
  }
  function updateControls() {
    const questions=(state.recommendation&&state.recommendation.questions)||[];
    const answered=!questions.length||String(state.brief.clarifications||'').trim().length>0;
    $('generate-activity').disabled=busy||!state.confirmed||!answered;
    $('adapt-activity').disabled=busy||!state.activity;
    $('generate-variant').disabled=busy||!state.activity||!$('variant-opt-in').checked;
    $('accept-candidate').disabled=busy||!candidate||D.validateActivity(candidate.activity,candidate.brief).length>0;
    ['save-activity','print-kit','print-participant','download-work'].forEach(id=>$(id).disabled=busy||!state.activity);
    $('brief-confirmed').disabled=busy||!answered;
    $('ask-coach').disabled=busy||!authorized;
    $('generation-hint').textContent=questions.length&&!answered?'נדרשת התייחסות לשאלות שלמעלה לפני אישור התקציר והבנייה.':'הפעילות נבנית לפי התקציר שאישרתם. דוגמת הפיתוח נפרדת מהפקה בבינה מלאכותית ומסומנת כטיוטה.';
  }
  function renderFocus() {
    const c=D.component(state.brief.focus), box=clear($('focus-description'));
    if(!c){box.append(el('p','','בחרו רכיב או בקשו הצעה לפי התקציר.'));return;}
    box.append(labelText('איך מתרגלים?',c.mechanism),labelText('מיומנות אישית:',c.individual),labelText('מיומנות משותפת:',c.shared));
  }
  function renderRecommendation() {
    const r=state.recommendation, box=clear($('recommendation')); box.hidden=!r;
    const questions=r&&Array.isArray(r.questions)?r.questions:[]; $('clarification-panel').hidden=!questions.length;
    clear($('clarification-questions')); questions.forEach(q=>$('clarification-questions').append(el('li','',q)));
    if(!r)return;
    box.append(el('h3','','הצעת מוקד: '+componentLabel(r.focus)),el('p','',r.rationale||'ההצעה ניתנת לשינוי.'));
    const actions=el('div','actions');
    if(D.component(r.focus))actions.append(button('בחירת ההצעה',()=>chooseFocus(r.focus)));
    (r.alternatives||[]).forEach(id=>{if(D.component(id))actions.append(button(componentLabel(id),()=>chooseFocus(id)));});
    box.append(actions,el('p','privacy-note','הסבר הבחירה מתייחס לקלט שלכם. ההסבר המקצועי מופיע בנפרד בערכת הפעילות.'));
  }
  function chooseFocus(id) { state.brief.focus=id; $('focus').value=id; state.confirmed=false; $('brief-confirmed').checked=false; renderFocus();updateControls();persist(); }
  function renderIdeas() {
    const box=clear($('inspiration-cards'));
    IDEAS.forEach(idea=>{
      // כרטיס מצומצם בצד (07/10/2026): קהל, שם ומטרה; שאר הפרטים נפתחים בלחיצה
      const n=el('article','idea-card'); n.append(el('p','eyebrow',idea.audience),el('h3','',idea.title),el('p','idea-purpose',idea.purpose));
      const more=el('details','idea-more'); more.append(el('summary','','פרטים'),el('span','tag draft','דוגמת פיתוח'),labelText('רכיב:',componentLabel(idea.focus)),labelText('מיומנויות אישיות:',idea.individual.join(' · ')),labelText('מיומנויות משותפות:',idea.shared.join(' · ')),list(idea.steps,true));n.append(more);
      const actions=el('div','actions'); actions.append(button('התאמה לקבוצה שלי',()=>personalize(idea),'btn small'),button(state.ideas.includes(idea.id)?'הרעיון שמור':'שמירת רעיון',()=>operation('בודקים הרשאה ושומרים את הרעיון…',async()=>{
        await ensureAuthorized();if(!state.ideas.includes(idea.id))state.ideas.push(idea.id);const stored=persist();renderIdeas();renderSavedIdeas();if(stored)notice('הרעיון נשמר. אפשר לחזור אליו ולהתאים אותו בהמשך.');
      })));n.append(actions);box.append(n);
    });
  }
  function personalize(idea) {
    state.brief=D.newBrief({...state.brief,startingPoint:idea.title+' — '+idea.steps.join(' '),goal:idea.goal,participants:idea.participants,participantAge:idea.age,leaderRole:idea.leaderRole||'',duration:idea.duration,count:idea.count||state.brief.count,focus:idea.focus});
    state.confirmed=false;state.recommendation={focus:idea.focus,rationale:'בחרתם ברעיון הזה כנקודת מוצא. הוא אינו מעיד על קושי או על אבחון של הקבוצה; כעת מתאימים אותו לתנאים שלכם.',alternatives:[],questions:[]};
    fillBrief();renderFocus();renderRecommendation();updateControls();persist();$('brief-section').scrollIntoView({behavior:'smooth',block:'start'});$('participants').focus({preventScroll:true});notice('התאימו את גיל המשתתפים, מספרם ותנאי הפעולה לפני הבנייה.');
  }
  function renderSavedIdeas() {
    $('idea-count').textContent='('+state.ideas.length+')';const box=clear($('saved-ideas'));
    if(!state.ideas.length)box.append(el('p','muted','אפשר לשמור רעיון ולהתאים אותו כשיתאים לכם.'));
    state.ideas.forEach(id=>{const idea=IDEAS.find(x=>x.id===id);if(!idea)return;const n=el('div','idea-saved');n.append(el('h3','',idea.title),labelText('מטרה:',idea.purpose),button('התאמה לקבוצה',()=>personalize(idea)),button('הסרה מהרעיונות',()=>{state.ideas=state.ideas.filter(x=>x!==id);persist();renderIdeas();renderSavedIdeas();},'btn danger small'));box.append(n);});
  }
  function field(label,value,onChange,options) {
    options=options||{};const l=el('label','',label), n=document.createElement(options.multiline?'textarea':'input');
    if(!options.multiline)n.type=options.type||'text';else n.rows=options.rows||2;
    if(options.min!==undefined)n.min=options.min;
    n.value=value===undefined?'':value;n.addEventListener('input',()=>onChange(options.type==='number'?Number(n.value):n.value));l.append(n);return l;
  }
  function sourceField(s,label,key,options) { return field(label,s[key],v=>{s[key]=v;markBriefChanged('source');},options); }
  function renderSources() {
    const box=clear($('source-cards'));
    state.brief.sources.forEach((source,index)=>{
      const n=el('article','source-card'), head=el('div','section-head'); head.append(el('h3','','מקור '+(index+1)),button('הסרת מקור',()=>{state.brief.sources.splice(index,1);state.confirmed=false;$('brief-confirmed').checked=false;state.recommendation=null;renderSources();renderRecommendation();updateControls();persist();},'btn danger small'));n.append(head);
      const grid=el('div','field-grid');grid.append(sourceField(source,'שם המקור','name'));
      const roleLabel=el('label','','לשם מה הוא מצורף?'), role=el('select');[['context','תיאור מצב / הקשר'],['inspiration','השראה']].forEach(([value,text])=>{const option=el('option','',text);option.value=value;role.append(option);});role.value=source.role;role.addEventListener('change',()=>{source.role=role.value;markBriefChanged('source');});roleLabel.append(role);grid.append(roleLabel,sourceField(source,'קישור, אם יש','url',{type:'url'}),sourceField(source,'תאריך / תקופה','date'),sourceField(source,'היקף המקור','scope'),sourceField(source,'האוכלוסייה שאליה הוא מתייחס','population'));n.append(grid,sourceField(source,'התוכן הרלוונטי שנמסר לנו','content',{multiline:true,rows:3}),el('p','source-read-note','המקור צורף על ידכם וטרם נבדק מקצועית. קישור לבדו אינו נקרא; תוכן שסיפקתם ישמש כהקשר או כהשראה בלבד.'));box.append(n);
    });
    if(!state.brief.sources.length)box.append(el('p','muted','אפשר להתחיל גם מהתיאור שלכם, בלי מקור נוסף.'));
  }
  function mappingText(value) { if(value===null||value===undefined)return '';if(typeof value==='object')return Object.entries(value).map(([k,v])=>k+': '+(typeof v==='object'?JSON.stringify(v):v)).join(' · ');return String(value); }
  function renderMapping() {
    const box=clear($('mapping-panel'));box.hidden=!state.mapping&&!mappingCredentials;if(box.hidden)return;
    box.append(el('h3','','מיפוי מחובר לתקציר'));
    if(state.mapping) {
      const m=state.mapping;
      const dates=m.dates&&typeof m.dates==='object'?[m.dates.from,m.dates.to].filter(Boolean).join(' – '):m.date||m.createdAt;
      [['היקף:',m.scope==='classroom'?'מיפוי כיתתי':m.scope||'מיפוי החוסן של הקבוצה'],['אוכלוסייה:',m.population||m.ageBand||m.band],['מועד:',dates],['סבב:',m.roundLabel||(m.round==='latest'?'המילוי האחרון של כל משיב/ה':m.round)],['משתתפים במיפוי:',m.respondents===undefined?m.respondentCount||m.count:m.respondents]].forEach(([k,v])=>{if(v!==undefined&&v!==null&&v!=='')box.append(labelText(k,mappingText(v)));});
      if(Array.isArray(m.voices))box.append(labelText('קבוצות המשיבים:',m.voices.filter(v=>v.count).map(v=>v.label+' '+v.count).join(' · ')));
      if(Array.isArray(m.selectedStatements)&&m.selectedStatements.length){const questions=el('details');questions.append(el('summary','','ההיגדים שנכללו במיפוי'),list(m.selectedStatements.map(s=>s.text+' · '+(s.polarity==='reverse'?'היגד על פגיעה או קושי':'היגד על פעולה או חוזקה'))));box.append(questions);}
      if(Array.isArray(m.domains)&&m.domains.length) {
        const details=el('details'), sm=el('summary','','ממצאים לפי תחום');details.append(sm);
        const table=el('table','mapping-table'),head=el('thead'),row=el('tr');['תחום','תמונה מצטברת','הערות'].forEach(x=>row.append(el('th','',x)));head.append(row);table.append(head);const body=el('tbody');
        m.domains.forEach(d=>{const r=el('tr'),notes=[...(d.flags||[])];if(d.coverage){if(!d.coverage.positiveMeasured)notes.push('צד החוזקה לא נמדד; אין להסיק ממנה היעדר חוזקה');if(!d.coverage.reverseMeasured)notes.push('צד הפגיעה לא נמדד; אין להסיק ממנה היעדר פגיעה');}r.append(el('td','',d.name||d.d||d.domain||d.label||''),el('td','',(Number.isFinite(d.score)?Math.round(d.score):'')+(d.label?' · '+d.label:'')),el('td','',notes.join(' · ')));body.append(r);});table.append(body);details.append(table);box.append(details);
      }
      if(m.limitations)box.append(el('p','',Array.isArray(m.limitations)?m.limitations.join(' '):m.limitations));
    }
    box.append(el('p','privacy-note',mappingCredentials?'השרת בודק הרשאה למיפוי לפני שליחת נתונים מצטברים למודל. הנתונים אינם ציון אישי; מפתח הניהול אינו נשמר בעבודה.':'זהו תיעוד מצטבר שנשמר עם העבודה. להפקה נוספת מהמיפוי יש לחבר אותו מחדש ממסך המיפוי כדי שהשרת יבדוק הרשאה ונתונים עדכניים.'));
    const actions=el('div','actions');if(mappingCredentials)actions.append(button('רענון המיפוי',()=>loadMapping()));actions.append(button('ניתוק המיפוי',()=>{mappingCredentials=null;state.mapping=null;state.confirmed=false;$('brief-confirmed').checked=false;state.recommendation=null;renderMapping();renderRecommendation();updateControls();persist();}));box.append(actions);
  }
  function claimsBox(activity, session, prefix) {
    const claims=D.claims(session?{sessions:[session]}:activity), box=el('div','claims-box');
    [['components','רכיבי החוסן שמתורגלים'],['individual','מיומנויות אישיות'],['shared','מיומנויות משותפות']].forEach(([kind,title])=>{
      box.append(el('h4','',title));const ul=el('ul');
      if(!claims[kind].length)ul.append(el('li','','לא סומן תרגול בשלבים שנותרו.'));
      claims[kind].forEach(c=>{const li=el('li','',kind==='components'?componentLabel(c.label):c.label);c.stepIds.forEach(id=>{const step=activity.sessions.flatMap(s=>s.steps).find(s=>s.id===id),text='↳ '+(step&&step.title||'שלב');if(prefix){const a=el('a','',text);a.href='#'+prefix+'-'+id;li.append(a);}else li.append(el('span','',text));});if(kind==='components'){const component=D.component(c.label);if(component)li.append(el('div','muted',component.mechanism));}ul.append(li);});box.append(ul);
    });return box;
  }
  function archive(reason) {
    if(!state.activity)return;
    state.versions.unshift({id:uid('version'),at:new Date().toISOString(),reason,brief:cleanBrief(state.activityBrief||state.brief),activity:copy(state.activity),mapping:safeMapping(state.mapping)});
  }
  function prepareActivityEdit(isCandidate) {
    if(!isCandidate&&!editingBaseArchived){archive('לפני עריכה ידנית');editingBaseArchived=true;renderVersions();}
  }
  function editField(target,label,key,isCandidate,options) { return field(label,target[key],v=>{prepareActivityEdit(isCandidate);if(target[key]!==v&&(key==='instructions'||key==='purpose')){const steps=target.sessions?target.sessions.flatMap(s=>s.steps):target.steps||[target];steps.forEach(s=>s.requiresReview=true);}target[key]=v;persist();refreshClaims(isCandidate);refreshReviewControls(isCandidate);renderValidation(isCandidate);updateControls();},options); }
  function editArray(target,label,key,isCandidate) { return field(label,(target[key]||[]).join('\n'),v=>{prepareActivityEdit(isCandidate);target[key]=v.split(/\n/).map(x=>x.trim()).filter(Boolean);persist();refreshClaims(isCandidate);renderValidation(isCandidate);updateControls();},{multiline:true,rows:2}); }
  function renderBasis(activity) {
    const box=el('div','professional-basis');box.append(el('h3','',activity.consultation?'מקורות לתשובה':'הבסיס המקצועי'));
    if(!activity.consultation)box.append(el('p','',evidenceLabel(activity)),el('p','muted','יעדי התרגול מוצעים לפיתוח. בסיס מקצועי לרכיב או למנגנון אינו מאמת את יעילות הפעילות המסוימת. קטלוג רכיבים: גרסה '+(activity.catalogueVersion||D.VERSION)+' · טיוטה.'));
    const basis=Array.isArray(activity.professionalBasis)?activity.professionalBasis:[];
    if(!basis.length)box.append(el('p','muted','לא צורף בסיס מקצועי מאושר לפעילות הזאת.'));
    else {const ul=el('ul');basis.forEach(s=>{const li=el('li');if(typeof s==='string')li.textContent=s;else {const link=safeLink(s.url,s.name||s.sourceId||s.title||'מקור');li.append(link||el('b','',s.name||s.sourceId||s.title||'מקור'),el('p','',s.explanation||s.mechanism||''),el('span','muted','גרסה '+(s.version||'לא צוינה')+' · '+(s.status==='existing-bank'?'מקור מבנק הידע הקיים':s.status||'מעמד לא צוין')));}ul.append(li);});box.append(ul);}
    return box;
  }
  // מדריך למידה למנחה — לכל פעילות: מנגנון, מה ללמוד לפני (מקורות מבנק הידע בלבד), יישום, מה לראות וגבולות.
  // למוביל/ה בלבד: לא נכנס לחומרי המשתתפים.
  function learnSourcesList(guide,isCandidate) {
    const box=el('div','learn-sources');
    if(!guide.learnBefore.length){box.append(el('p','muted','עוד לא נבחרו מקורות ללמידה. אפשר לבקש בשיחה עם ה-AI מקורות מתוך בנק הידע.'));return box;}
    const ol=el('ol');guide.learnBefore.forEach(src=>{const li=el('li');const link=safeLink(src.url,src.name||src.sourceId);li.append(link||el('b','',src.name||src.sourceId));
      li.append(field('מה ללמוד במקור הזה ולמה',src.focus,v=>{prepareActivityEdit(isCandidate);src.focus=v;persist();updateControls();},{multiline:true,rows:2}));
      li.append(el('span','muted',src.status==='existing-bank'?'מקור מבנק הידע הקיים · גרסה '+(src.version||'לא צוינה'):'מקור שלא אומת בבנק'));ol.append(li);});
    box.append(ol);return box;
  }
  function renderLearningGuide(activity,isCandidate) {
    const guide=activity.learningGuide, box=el('details','activity-guide learning-guide');
    box.append(el('summary','','מדריך למידה למנחה — לפני שמנחים את הפעילות הזאת'));
    box.append(el('p','muted','המדריך מסביר את ההיגיון של הפעילות ומפנה למקורות מבנק הידע. זו השערת תכנון — לא הוכחה שהפעילות יעילה, ולא תחליף להכשרה בהנחיה.'));
    box.append(editField(guide,LEARNING_LABELS.mechanism,'mechanism',isCandidate,{multiline:true}));
    box.append(el('h4','','מה כדאי ללמוד לפני ההנחיה'),learnSourcesList(guide,isCandidate));
    ['apply','watchFor','limits'].forEach(k=>box.append(editField(guide,LEARNING_LABELS[k],k,isCandidate,{multiline:true})));
    box.append(button('שאלות על המדריך',()=>openCoach('learning',null,isCandidate)));
    return box;
  }
  function renderActivityEditor(activity,brief,host,isCandidate) {
    clear(host);const prefix=isCandidate?'candidate':'activity';
    const overview=el('div','activity-overview');overview.append(editField(activity,'שם הפעילות','title',isCandidate),editField(activity,'המטרה שלנו','purpose',isCandidate,{multiline:true}),labelText('רכיב המוקד:',componentLabel(activity.focus)));
    const claims=claimsBox(activity,null,prefix);claims.id=prefix+'-claims';overview.append(claims);
    const privateDetails=el('details');privateDetails.append(el('summary','','מה הוביל לבחירת הפעילות?'),editField(activity,'הסבר הבחירה לפי הקלט שלכם','selectionReason',isCandidate,{multiline:true}));overview.append(privateDetails,renderBasis(activity),editField(activity,'הנחיה למוביל/ה','leaderGuidance',isCandidate,{multiline:true}),editField(activity,'חלופות להשתתפות בלי חשיפה אישית','participationAlternative',isCandidate,{multiline:true}));
    activity.facilitationPlan=D.facilitationPlan(activity.facilitationPlan);activity.socialMechanism=D.socialMechanism(activity.socialMechanism);activity.learningGuide=D.learningGuide(activity.learningGuide);
    overview.append(renderLearningGuide(activity,isCandidate));
    const guide=el('details','activity-guide');guide.append(el('summary','','תכנית ההנחיה לפעילות הזאת'));D.FACILITATION_FIELDS.forEach(k=>guide.append(editField(activity.facilitationPlan,FACILITATION_LABELS[k],k,isCandidate,{multiline:true})));guide.append(button('שאלות על ההנחיה',()=>openCoach('facilitation',null,isCandidate)));overview.append(guide);
    const mechanism=el('section','social-mechanism');mechanism.append(el('h3','','מהפעילות למנגנון חברתי'),el('p','','בחרו יחד שגרה או מבנה שיעזרו להמשיך לתרגל: יום ראשון קבוע, לוח מודעות, יום חוסן חודשי, הסכמות, צוות פעולה או ועדה. מגדירים אחריות, השתתפות וקצב שמתאימים לקבוצה.'));
    const type=el('select');type.setAttribute('aria-label','סוג המנגנון החברתי');Object.entries(D.MECHANISM_TYPES).forEach(([value,label])=>{const option=el('option','',label);option.value=value;type.append(option);});type.value=activity.socialMechanism.type;type.addEventListener('change',()=>{prepareActivityEdit(isCandidate);activity.socialMechanism.type=type.value;persist();renderValidation(isCandidate);updateControls();});mechanism.append(type);
    D.MECHANISM_FIELDS.forEach(k=>mechanism.append(editField(activity.socialMechanism,MECHANISM_LABELS[k],k,isCandidate,{multiline:true})));mechanism.append(button('שאלות על השגרה והמנגנון',()=>openCoach('mechanism',null,isCandidate)));overview.append(mechanism);host.append(overview);
    (activity.sessions||[]).forEach((session,si)=>{
      const n=el('section','session-card');n.dataset.sessionIndex=si;const head=el('div','session-head');head.append(el('h3','','מפגש '+(si+1)),editField(session,'שם המפגש','title',isCandidate),editField(session,'מטרת המפגש','purpose',isCandidate,{multiline:true}),editField(session,'הקשר למפגש הקודם ולתהליך','link',isCandidate,{multiline:true}));n.append(head);
      const time=el('p','session-time','');time.dataset.sessionTime=si;n.append(time);const sc=claimsBox(activity,session,prefix);sc.id=prefix+'-session-claims-'+si;n.append(sc);
      (session.steps||[]).forEach((step,sti)=>{
        const st=el('article','step-card');st.id=prefix+'-'+step.id;const sh=el('div','section-head');sh.append(el('span','step-code','שלב '+(sti+1)),button('מחיקת שלב',()=>{prepareActivityEdit(isCandidate);session.steps.splice(sti,1);persist();renderActivityEditor(activity,brief,host,isCandidate);renderValidation(isCandidate);updateControls();renderCoach();},'btn danger small'));st.append(sh,button('שאלות ושיפור לשלב',()=>openCoach('step',step,isCandidate)));
        const fields=el('div','step-fields');fields.append(editField(step,'שם השלב','title',isCandidate),editField(step,'דקות','minutes',isCandidate,{type:'number',min:1}));st.append(fields,editField(step,'מה עושים ואיך?','instructions',isCandidate,{multiline:true,rows:3}));
        const review=el('div','privacy-note');review.dataset.reviewStep=step.id;review.hidden=!step.requiresReview;review.append(el('p','','המטרה או ההוראות השתנו. בדקו את רכיבי החוסן והמיומנויות של השלב לפני שיוצגו שוב כיעדי תרגול.'),button('אישור יעדי התרגול של השלב',()=>{step.requiresReview=false;persist();refreshClaims(isCandidate);refreshReviewControls(isCandidate);renderValidation(isCandidate);updateControls();}));st.append(review);
        const details=el('details');details.append(el('summary','','רכיבים, מיומנויות וחומרים של השלב'));const componentChecks=el('div','step-components');
        D.COMPONENTS.forEach(c=>{const label=el('label','component-check'),check=el('input');check.type='checkbox';check.checked=(step.components||[]).includes(c.id);check.addEventListener('change',()=>{prepareActivityEdit(isCandidate);step.components=check.checked?[...new Set([...(step.components||[]),c.id])]:(step.components||[]).filter(id=>id!==c.id);persist();refreshClaims(isCandidate);renderValidation(isCandidate);});label.append(check,document.createTextNode(c.label));componentChecks.append(label);});details.append(el('h4','','רכיבים שהשלב מתרגל בפועל'),componentChecks,editArray(step,'מיומנויות אישיות — מיומנות אחת בשורה','individualSkills',isCandidate),editArray(step,'מיומנויות משותפות — מיומנות אחת בשורה','sharedSkills',isCandidate),editArray(step,'חומרים לשלב — פריט אחד בשורה','materials',isCandidate));st.append(details);n.append(st);
      });
      const actions=el('div','actions');actions.append(button('+ הוספת שלב',()=>{prepareActivityEdit(isCandidate);session.steps.push({id:uid('step'),title:'שלב נוסף',minutes:1,instructions:'',materials:[],components:[],individualSkills:[],sharedSkills:[]});persist();renderActivityEditor(activity,brief,host,isCandidate);renderValidation(isCandidate);updateControls();}));n.append(actions,editField(session,'חומרי המשתתפים','participantMaterials',isCandidate,{multiline:true,rows:3}),editArray(session,'שאלות לעיבוד — שאלה אחת בשורה','debrief',isCandidate),editField(session,'צעד המשך','nextStep',isCandidate,{multiline:true}));host.append(n);
    });
    refreshClaims(isCandidate);
  }
  function refreshReviewControls(isCandidate) {
    const activity=isCandidate&&candidate?candidate.activity:state.activity,host=isCandidate?$('candidate-content'):$('activity-content');
    if(!activity)return;
    host.querySelectorAll('[data-review-step]').forEach(n=>{const step=activity.sessions.flatMap(s=>s.steps).find(s=>s.id===n.dataset.reviewStep);n.hidden=!step||!step.requiresReview;});
  }
  function refreshClaims(isCandidate) {
    const a=isCandidate&&candidate?candidate.activity:state.activity;if(!a)return;const prefix=isCandidate?'candidate':'activity',overall=$(prefix+'-claims');if(overall){const box=claimsBox(a,null,prefix);box.id=overall.id;overall.replaceWith(box);}
    (a.sessions||[]).forEach((session,i)=>{const previous=$(prefix+'-session-claims-'+i);if(previous){const next=claimsBox(a,session,prefix);next.id=previous.id;previous.replaceWith(next);}const host=isCandidate?$('candidate-content'):$('activity-content'),time=host.querySelector('[data-session-time="'+i+'"]');if(time){const available=isCandidate&&candidate?candidate.brief.duration:(state.activityBrief||state.brief).duration;time.textContent='סך שלבי המפגש: '+session.steps.reduce((sum,s)=>sum+(Number(s.minutes)||0),0)+' דקות · זמן זמין: '+available+' דקות';}});
  }
  function renderValidation(isCandidate) {
    const a=isCandidate&&candidate?candidate.activity:state.activity,b=isCandidate&&candidate?candidate.brief:state.activityBrief||state.brief,host=$(isCandidate?'candidate-validation':'activity-validation');clear(host);if(!a)return;
    const problems=D.validateActivity(a,b),box=el('div',problems.length?'validation-errors':'validation-good');
    if(problems.length)box.append(el('b','','נדרש תיקון לפני יצוא או אישור:'),list(problems));else box.textContent='הערכה כוללת מטרה, תרגול מקושר לשלבים וחומרים, והזמנים מתאימים לתקציר. התאמה ויעילות מקצועית עדיין נבחנות.';host.append(box);
  }
  function renderActivity() {
    $('activity-section').hidden=!state.activity;$('adapt-section').hidden=!state.activity;
    if(!state.activity){clear($('activity-content'));return;}
    $('activity-badge').textContent=evidenceLabel(state.activity);$('activity-badge').classList.toggle('draft',state.activity.evidenceStatus==='example-draft');
    renderActivityEditor(state.activity,state.activityBrief||state.brief,$('activity-content'),false);renderValidation(false);renderVariants();renderVersions();
  }
  function renderCandidate() {
    $('candidate-panel').hidden=!candidate;if(!candidate)return;
    $('candidate-title').textContent=candidate.kind==='variant'?'הצעת גרסה מקושרת לבדיקה':'הצעת התאמה לבדיקה';const box=clear($('candidate-explanation'));
    box.append(el('p','candidate-explanation',candidate.activity.adaptationExplanation||'בדקו את המטרה, התרגול והתנאים לפני אישור הגרסה.'));
    if(candidate.activity.goalChanged)box.append(el('p','error','ההצעה משנה את מטרת הפעילות. אישור ההצעה הוא גם אישור המטרה החדשה.'));
    if(candidate.activity.focus!==state.activity.focus)box.append(el('p','candidate-explanation','מוקד ההצעה: '+componentLabel(candidate.activity.focus)+'. המוקד הקודם: '+componentLabel(state.activity.focus)+'.'));
    if(candidate.kind==='variant')box.append(el('p','privacy-note','הצעה זו נבנתה מהמטרה והמוקד המשותפים ומהתנאים החדשים בלבד.'));
    renderActivityEditor(candidate.activity,candidate.brief,$('candidate-content'),true);renderValidation(true);updateControls();
  }
  function renderVersions() {
    $('version-count').textContent='('+state.versions.length+')';const box=clear($('versions-list'));
    if(!state.versions.length)box.append(el('p','muted','גרסאות קודמות נשמרות כשעורכים או מאשרים התאמה.'));
    state.versions.forEach(v=>{const n=el('div','version-item');n.append(el('h3','',v.activity.title),el('p','muted',v.reason+' · '+dateLabel(v.at)),labelText('מטרה:',v.activity.purpose),button('חזרה לגרסה זו',()=>operation('בודקים הרשאה לפתיחת הגרסה…',async()=>{await ensureAuthorized();archive('לפני חזרה לגרסה קודמת');state.activity=copy(v.activity);state.activityBrief=cleanBrief(v.brief);state.brief=cleanBrief(v.brief);state.mapping=safeMapping(v.mapping);mappingCredentials=null;setCandidate(null);editingBaseArchived=false;state.confirmed=false;state.recommendation=null;render();persist();notice('הגרסה נפתחה כפי שנשמרה, ללא הפקה מחדש.');})));box.append(n);});
  }
  function renderVariants() {
    const box=clear($('linked-variants'));if(!state.variants.length)return;box.append(el('h3','','גרסאות מקושרות שאושרו'));
    state.variants.forEach(v=>{const n=el('div','variant-card');n.append(el('h3','',v.activity.title),labelText('משתתפים:',v.brief.participants),labelText('מטרה:',v.activity.purpose),claimsBox(v.activity,null,null));const actions=el('div','actions');actions.append(button('הצגת הגרסה המקושרת',()=>{setCandidate({kind:'variant',activity:copy(v.activity),brief:cleanBrief(v.brief),existingId:v.id});renderCandidate();$('candidate-panel').scrollIntoView({block:'start'});}),button('חומרי המשתתפים / PDF',()=>printActivity(true,v.activity,v.brief)));n.append(actions);box.append(n);});
  }
  function renderSaved() {
    const box=clear($('saved-work-list'));if(!saved.length)box.append(el('p','muted','עדיין אין עבודות שמורות במכשיר הזה.'));
    saved.forEach(item=>{const n=el('div','saved-item');n.append(el('h3','',item.title||'פעילות שמורה'),el('p','muted',dateLabel(item.at)));const actions=el('div','actions');actions.append(button('פתיחה',()=>operation('בודקים הרשאה לפתיחת העבודה…',async()=>{await ensureAuthorized();state=readWork(item.work,false);state.currentId=item.id;setCandidate(null);mappingCredentials=null;editingBaseArchived=false;render();persist();notice('העבודה נפתחה כפי שנשמרה. אין הפקה חדשה.');if(state.activity)$('activity-section').scrollIntoView({block:'start'});})),button('מחיקה',()=>{saved=saved.filter(x=>x.id!==item.id);if(state.currentId===item.id)state.currentId=null;persist();renderSaved();},'btn danger small'));n.append(actions);box.append(n);});
  }
  function render() { coachTarget=null;coachProposal=null;fillBrief();renderIdeas();renderSavedIdeas();renderSources();renderFocus();renderRecommendation();renderMapping();renderActivity();renderSaved();renderCandidate();renderCoach();updateControls(); }
  function requestBody(action,brief,previous) { const body={action,brief:cleanBrief(brief)};if(previous)body.previous=copy(previous);if(mappingCredentials)body.mapping=copy(mappingCredentials);return body; }
  async function loadMapping() {
    if(!mappingCredentials)return;
    await operation('בודקים הרשאה ומביאים ממצאים מצטברים מהמיפוי…',async()=>{const data=await api({action:'mapping',mapping:copy(mappingCredentials)});if(!data.mapping)throw new Error('לא התקבלו ממצאי מיפוי.');state.mapping=safeMapping(data.mapping);state.confirmed=false;$('brief-confirmed').checked=false;state.recommendation=null;renderMapping();renderRecommendation();updateControls();persist();notice('המיפוי מחובר. בדקו את המועד, האוכלוסייה והיקף המדידה ביחס לפעילות המתוכננת.');});
  }
  function analyze() {
    collectBrief();operation('בודקים את התקציר ואת אפשרויות התרגול…',async()=>{
      const data=await api(requestBody('analyze',state.brief));if(!data.recommendation)throw new Error('לא התקבלה הצעת מוקד מהשרת.');
      state.recommendation=data.recommendation;state.confirmed=false;$('brief-confirmed').checked=false;if(!D.component(state.brief.focus)&&D.component(data.recommendation.focus)){state.brief.focus=data.recommendation.focus;$('focus').value=state.brief.focus;}
      if(data.mapping)state.mapping=safeMapping(data.mapping);renderRecommendation();renderFocus();renderMapping();updateControls();persist();notice('התקציר נבדק. בחרו מוקד, השלימו הבהרות אם נדרשו ואשרו את התקציר.');
    });
  }
  function installActivity(a,b,reason) {
    if(state.activity)archive(reason||'לפני יצירת פעילות חדשה');state.activity=copy(a);state.activityBrief=cleanBrief(b);setCandidate(null);editingBaseArchived=false;renderActivity();renderCandidate();persist();$('activity-section').scrollIntoView({behavior:'smooth',block:'start'});updateControls();
  }
  function generate() {
    collectBrief();const problems=briefProblems(state.brief);if(problems.length){error(problems.join('\n'));return;}if(!state.confirmed){error('קראו ואשרו את התקציר לפני הבנייה.');return;}
    if((state.recommendation&&state.recommendation.questions||[]).length&&!String(state.brief.clarifications||'').trim()){error('השיבו לשאלות ההבהרה לפני הבנייה.');return;}
    const b=cleanBrief(state.brief);operation('בונים פעילות לפי התקציר שאישרתם…',async()=>{const data=await api(requestBody('generate',b));if(!data.activity)throw new Error('לא התקבלה פעילות מהשרת.');const failures=D.validateActivity(data.activity,b);if(failures.length)throw new Error('הפעילות שהתקבלה דורשת תיקון: '+failures.join('; '));if(data.mapping)state.mapping=safeMapping(data.mapping);installActivity(data.activity,b);notice('הפעילות נבנתה. אפשר לערוך את ההנחיה, השלבים והחומרים, ולבדוק את הקשר בין התרגול למטרה.');});
  }
  function example() {
    collectBrief();if(!D.component(state.brief.focus)){const r=D.recommendFocus(state.brief);state.brief.focus=r.focus;state.recommendation=r;fillBrief();renderFocus();renderRecommendation();}
    const problems=briefProblems(state.brief);if(problems.length){error('לדוגמה מותאמת נדרשים כמה פרטים:\n'+problems.join('\n'));return;}
    operation('בודקים הרשאה לפתיחת דוגמת הפיתוח…',async()=>{await ensureAuthorized();installActivity(D.exampleActivity(state.brief),state.brief,'לפני פתיחת דוגמת פיתוח');notice('זו דוגמת פיתוח מקומית, ולא תוצר שהופק מהמודל. היא מוצגת לבחינה ולעריכה ואינה מאושרת לשימוש מקצועי.');});
  }
  function adapt() {
    collectBrief();if(!state.activity)return;const failures=briefProblems(state.brief);if(failures.length){error(failures.join('\n'));return;}
    const b=cleanBrief(state.brief);operation('מציעים התאמה ומסבירים את השינוי בתרגול…',async()=>{const data=await api(requestBody('adapt',b,state.activity));if(!data.activity)throw new Error('לא התקבלה הצעת התאמה.');setCandidate({kind:'adapt',brief:b,activity:copy(data.activity),mapping:data.mapping?safeMapping(data.mapping):safeMapping(state.mapping)});renderCandidate();notice('ההתאמה היא הצעה. אפשר לערוך אותה לפני האישור; הגרסה הקיימת נשמרת.');$('candidate-panel').scrollIntoView({behavior:'smooth',block:'start'});});
  }
  function generateVariant() {
    if(!state.activity||!$('variant-opt-in').checked){error('בחרו במפורש להכין גרסה מקושרת.');return;}
    const b=D.newBrief({goal:state.activity.purpose,focus:state.activity.focus,participants:$('variant-participants').value,participantAge:$('variant-age').value,count:Number($('variant-count').value),duration:Number($('variant-duration').value),sessions:1,format:'activity',language:state.brief.language||'עברית',youthMode:'adult-supported',startingPoint:'גרסה מקושרת לתרגול המטרה המשותפת'});
    const problems=briefProblems(b);if(problems.length){error(problems.join('\n'));return;}
    operation('בונים הצעה לגרסה המקושרת מהמטרה המשותפת…',async()=>{const data=await api({action:'generate',brief:b});if(!data.activity)throw new Error('לא התקבלה גרסה מקושרת.');setCandidate({kind:'variant',brief:b,activity:D.publicActivity(data.activity)});renderCandidate();notice('הגרסה המקושרת מוכנה לבדיקה ולעריכה. היא תישמר רק אם תאשרו אותה.');$('candidate-panel').scrollIntoView({block:'start'});});
  }
  function acceptCandidate() {
    if(!candidate)return;const problems=D.validateActivity(candidate.activity,candidate.brief);if(problems.length){error(problems.join('\n'));return;}
    if(candidate.kind==='variant') {
      const item={id:candidate.existingId||uid('variant'),at:new Date().toISOString(),brief:cleanBrief(candidate.brief),activity:D.publicActivity(candidate.activity)};state.variants=state.variants.filter(v=>v.id!==item.id);state.variants.push(item);setCandidate(null);renderVariants();renderCandidate();if(persist())notice('הגרסה המקושרת אושרה ונשמרה לצד הפעילות המקורית.');else notice('הגרסה המקושרת אושרה ומוצגת לצד הפעילות המקורית.');
    } else {
      archive('לפני התאמה שאושרה');state.activity=copy(candidate.activity);state.activityBrief=cleanBrief(candidate.brief);state.brief=cleanBrief(candidate.brief);state.mapping=safeMapping(candidate.mapping);setCandidate(null);editingBaseArchived=false;render();if(persist())notice('ההתאמה אושרה. הגרסה הקודמת נשמרה בהיסטוריה.');else notice('ההתאמה וההיסטוריה מוצגות כאן.');
    }
  }
  function checkExport(activity,brief) { const problems=D.validateActivity(activity,brief);if(problems.length)throw new Error('נדרש תיקון לפני יצוא: '+problems.join('; ')); }
  function printDocument(activity,participantOnly,includeReason) {
    const a=D.publicActivity(activity),n=el('div','print-document');n.append(el('h2','',a.title),labelText('מטרה:',a.purpose),labelText('רכיב המוקד:',componentLabel(a.focus)),el('p','',evidenceLabel(a)),claimsBox(a,null,'print'));
    n.querySelectorAll('.claims-box a').forEach(link=>{link.replaceWith(document.createTextNode(' [שלב '+link.textContent.replace('↳ ','')+']'));});
    if(!participantOnly){n.append(renderBasis(a));if(includeReason)paragraph(n,'הסבר הבחירה האישי',activity.selectionReason);paragraph(n,'הנחיה למוביל/ה',a.leaderGuidance);const guide=el('section','session-card');guide.append(el('h3','','תכנית הנחיית הקבוצה'));D.FACILITATION_FIELDS.forEach(k=>paragraph(guide,FACILITATION_LABELS[k],a.facilitationPlan?.[k]));n.append(guide);
      const lg=D.learningGuide(a.learningGuide);if(D.LEARNING_FIELDS.some(k=>lg[k].trim())||lg.learnBefore.length){const learn=el('section','session-card');learn.append(el('h3','','מדריך למידה למנחה'));paragraph(learn,LEARNING_LABELS.mechanism,lg.mechanism);if(lg.learnBefore.length){learn.append(el('h4','','מה ללמוד לפני ההנחיה'));const ul=el('ul');lg.learnBefore.forEach(src=>{const li=el('li');li.append(safeLink(src.url,src.name||src.sourceId)||el('b','',src.name||src.sourceId));if(src.focus)li.append(el('p','',src.focus));ul.append(li);});learn.append(ul);}['apply','watchFor','limits'].forEach(k=>paragraph(learn,LEARNING_LABELS[k],lg[k]));n.append(learn);}}
    if(a.socialMechanism&&a.socialMechanism.type!=='none'){const mechanism=el('section','session-card');mechanism.append(el('h3','','מנגנון חברתי להמשך'),labelText('סוג:',D.MECHANISM_TYPES[a.socialMechanism.type]));D.MECHANISM_FIELDS.forEach(k=>mechanism.append(labelText(MECHANISM_LABELS[k]+':',a.socialMechanism[k])));n.append(mechanism);}
    paragraph(n,'דרכים להשתתף ללא חשיפה אישית',a.participationAlternative);
    (a.sessions||[]).forEach((session,si)=>{
      const block=el('section','session-card');block.append(el('h3','','מפגש '+(si+1)+': '+(session.title||'')),labelText('מטרת המפגש:',session.purpose),labelText('קשר לתהליך:',session.link));const claims=claimsBox(a,session,'print');claims.querySelectorAll('a').forEach(link=>link.replaceWith(document.createTextNode(' [שלב '+link.textContent.replace('↳ ','')+']')));block.append(claims);
      if(!participantOnly) (session.steps||[]).forEach((step,stepIndex)=>{const st=el('article','step-card');st.append(el('h4','',step.title+' · '+step.minutes+' דקות'),el('p','muted','שלב '+(stepIndex+1)),window.SBE_DOC?SBE_DOC.rich(step.instructions):el('p','',step.instructions),labelText('רכיבים:',(step.components||[]).map(componentLabel).join(' · ')),labelText('מיומנויות אישיות:',(step.individualSkills||[]).join(' · ')),labelText('מיומנויות משותפות:',(step.sharedSkills||[]).join(' · ')));if((step.materials||[]).length)st.append(labelText('חומרים:',step.materials.join(' · ')));block.append(st);});
      paragraph(block,'חומרי המשתתפים',session.participantMaterials);block.append(el('h4','','שאלות לעיבוד'),list(session.debrief),labelText('צעד המשך:',session.nextStep));n.append(block);
    });return n;
  }
  function printActivity(participantOnly,activity,brief) {
    activity=activity||state.activity;brief=brief||state.activityBrief||state.brief;if(!activity)return;
    operation('בודקים הרשאה ותקינות לפני ההדפסה…',async()=>{await ensureAuthorized();checkExport(activity,brief);const node=printDocument(activity,participantOnly,!participantOnly&&$('include-selection-reason').checked);SBE_DOC.print({title:activity.title,subtitle:participantOnly?'חומרי משתתפים · מטרה, תרגול וחומרים משותפים':'ערכת הנחיה · '+evidenceLabel(activity),node,inline:true});notice('נפתחה תצוגה מקדימה עם הנוסח הערוך להדפסה או לשמירה כ-PDF.');});
  }
  function downloadJson(name,value) {const blob=new Blob([JSON.stringify(value,null,2)],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function saveActivity() {
    if(!state.activity)return;
    operation('בודקים הרשאה ושומרים את העבודה במכשיר…',async()=>{await ensureAuthorized();const previousSaved=saved,previousId=state.currentId;state.currentId=state.currentId||uid('work');const item={id:state.currentId,title:state.activity.title,at:new Date().toISOString(),work:snapshot()};saved=saved.filter(x=>x.id!==item.id);saved.unshift(item);const stored=persist();if(!stored){saved=previousSaved;state.currentId=previousId;}renderSaved();if(stored)notice('הפעילות, המקורות והגרסאות נשמרו במכשיר לפי המשתמש/ת שנכנסו.');});
  }
  function downloadWork() { if(!state.activity)return;operation('בודקים הרשאה ותקינות לקובץ העבודה…',async()=>{await ensureAuthorized();checkExport(state.activity,state.activityBrief||state.brief);downloadJson('begood-studio-'+new Date().toISOString().slice(0,10)+'.json',D.workFile(snapshot()));notice('קובץ העבודה האישי כולל את התקציר, המקורות והגרסאות. מפתח הניהול של המיפוי אינו כלול.');}); }
  function importWork(file) {
    if(!file)return;operation('בודקים הרשאה ואת מבנה קובץ העבודה…',async()=>{
      await ensureAuthorized();if(!/\.json$/i.test(file.name))throw new Error('קובץ עבודה נתמך בפורמט JSON בלבד.');let data;try{data=JSON.parse(await file.text());}catch{throw new Error('הקובץ אינו JSON תקין.');}
      if(data.type!=='begood-resilience-studio'||data.schemaVersion!==D.VERSION)throw new Error('זה אינו קובץ עבודה נתמך של סטודיו חוסן.');
      const imported=readWork(data,true);state=imported;state.currentId=null;setCandidate(null);mappingCredentials=null;editingBaseArchived=false;render();persist();notice('קובץ העבודה נפתח עם התוכן והגרסאות שנשמרו, ללא הפקה מחדש.');if(state.activity)$('activity-section').scrollIntoView({block:'start'});
    });$('import-work').value='';
  }
  async function importSource(file) {
    if(!file)return;
    const sourceState=state,sourceBrief=state.brief;
    try {
      if(!/\.(txt|md|json)$/i.test(file.name))throw new Error('לצירוף זה נתמכים TXT, Markdown או JSON. העתיקו טקסט רלוונטי מקובץ אחר.');
      const content=await file.text();
      if(!authorized||state!==sourceState||state.brief!==sourceBrief)throw new Error('העבודה השתנתה בזמן קריאת הקובץ. המקור לא צורף; אפשר לצרף אותו מחדש לעבודה המתאימה.');
      if(/\.json$/i.test(file.name)){try{JSON.parse(content);}catch{throw new Error('קובץ המקור אינו JSON תקין.');}}
      state.brief.sources.push({id:uid('source'),name:file.name,role:'context',status:'unreviewed',content,url:'',date:'',scope:'',population:'',version:'1'});markBriefChanged('source');renderSources();$('source-details').open=true;notice('תוכן הקובץ צורף כמקור הקשר שלא נבדק מקצועית. הוא אינו נשמר בשרת.');
    }catch(e){error(e.message);}finally{$('source-file').value='';}
  }
  function bind() {
    const home=(()=>{try{return sessionStorage.getItem('sbe.session.homeUrl')||'home.html';}catch{return 'home.html';}})();$('studio-home').href=home;
    if(home==='admin.html?role=sys'&&window.SBE_SCREENS_RENDER)SBE_SCREENS_RENDER($('studio-screens'),{here:'resilience-studio.html'});
    D.COMPONENTS.forEach(c=>{const option=el('option','',c.label);option.value=c.id;$('focus').append(option);});const blank=el('option','','נבחר מוקד או נבקש הצעה');blank.value='';$('focus').prepend(blank);
    $('brief-form').addEventListener('submit',e=>e.preventDefault());$('brief-form').addEventListener('input',e=>{if(BRIEF_FIELDS.includes(e.target.id))markBriefChanged(e.target.id);});$('brief-form').addEventListener('change',e=>{if(e.target.tagName==='SELECT')markBriefChanged(e.target.id);});
    $('focus').addEventListener('change',()=>chooseFocus($('focus').value));$('clarifications').addEventListener('input',()=>markBriefChanged('clarifications'));
    $('coach-stage').addEventListener('change',()=>{state.coach.stage=$('coach-stage').value;coachTarget=coachTarget?.isCandidate&&candidate?{stepId:null,isCandidate:true}:null;coachProposal=null;renderCoach();persist();});
    $('coach-concerns').addEventListener('input',()=>{setCoachConcerns($('coach-concerns').value);persist();});$('ask-coach').addEventListener('click',askCoach);$('ask-facilitation').addEventListener('click',()=>openCoach('facilitation'));renderFacilitationGuide();
    $('brief-confirmed').addEventListener('change',()=>{collectBrief();const problems=briefProblems(state.brief);if($('brief-confirmed').checked&&problems.length){error(problems.join('\n'));$('brief-confirmed').checked=false;}state.confirmed=$('brief-confirmed').checked;updateControls();});
    $('analyze-brief').addEventListener('click',analyze);$('generate-activity').addEventListener('click',generate);$('example-activity').addEventListener('click',example);
    $('add-source').addEventListener('click',()=>{state.brief.sources.push({id:uid('source'),name:'',role:'context',content:'',url:'',date:'',scope:'',population:'',version:'1'});state.confirmed=false;$('brief-confirmed').checked=false;state.recommendation=null;renderSources();renderRecommendation();updateControls();persist();});$('source-file').addEventListener('change',()=>importSource($('source-file').files[0]));
    $('save-activity').addEventListener('click',saveActivity);$('download-work').addEventListener('click',downloadWork);$('import-work').addEventListener('change',()=>importWork($('import-work').files[0]));$('print-kit').addEventListener('click',()=>printActivity(false));$('print-participant').addEventListener('click',()=>printActivity(true));
    $('adapt-activity').addEventListener('click',adapt);$('generate-variant').addEventListener('click',generateVariant);$('variant-opt-in').addEventListener('change',updateControls);$('accept-candidate').addEventListener('click',acceptCandidate);$('reject-candidate').addEventListener('click',()=>{setCandidate(null);renderCandidate();notice('הגרסה הקיימת נשארה.');});
    $('new-work').addEventListener('click',()=>{const ideas=state.ideas;state=emptyState();state.ideas=ideas;setCandidate(null);mappingCredentials=null;coachTarget=null;coachProposal=null;editingBaseArchived=false;render();persist();notice('נפתחה עבודה חדשה. עבודות שנשמרו מופיעות בצד.');$('startingPoint').focus();});
  }
  async function initialize() {
    bind();render();$('saved-work-list').replaceChildren(el('p','muted','בודקים הרשאה לפתיחת עבודות שמורות…'));
    try {
      await ensureAuthorized();
      let stored=null;try{stored=JSON.parse(localStorage.getItem(STORE)||'null');}catch{}
      if(stored&&stored.state) {
        try{state=readWork(stored.state,false);saved=(Array.isArray(stored.saved)?stored.saved:[]).map(x=>({id:String(x.id),title:String(x.title||'פעילות שמורה'),at:String(x.at||''),work:snapshotFromWork(x.work)}));}
        catch(e){error('השמירה המקומית לא נפתחה: '+e.message+' אפשר לפתוח קובץ עבודה תקין.');state=emptyState();saved=[];}
      }
      try {
        const handoff=JSON.parse(sessionStorage.getItem(HANDOFF)||'null');sessionStorage.removeItem(HANDOFF);
        if(handoff&&typeof handoff.id==='string'&&typeof handoff.key==='string'){mappingCredentials={id:handoff.id,key:handoff.key,round:handoff.round==='latest'?'latest':Number(handoff.round)||'latest'};}
      }catch{}
      render();if(mappingCredentials)await loadMapping();
    }catch(e){error('לא הצלחנו לבדוק את ההרשאה לפתיחת העבודה: '+e.message);$('saved-work-list').replaceChildren(el('p','muted','העבודות השמורות יוצגו לאחר בדיקת הרשאה מוצלחת.'));}
  }
  function snapshotFromWork(value) {const s=readWork(value,false);return {brief:s.brief,activity:s.activity,activityBrief:s.activityBrief,versions:s.versions,ideas:s.ideas,variants:s.variants,mapping:s.mapping,currentId:s.currentId,coach:s.coach};}
  initialize();
})();
