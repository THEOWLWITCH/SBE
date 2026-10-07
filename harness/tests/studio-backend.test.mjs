import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { handleAccess, authorizePermission } from '../lib/access.mjs';
import { ACTIVITY_SCHEMA, CONSULTATION_SCHEMA, handleStudio } from '../lib/studio.mjs';
const studio = createRequire(import.meta.url)('../../app/lib/resilience-studio.js');

function memoryStore(seed = {}) {
  const data = new Map(Object.entries(seed));
  return { data, async get(k) { return data.get(k) || null; }, async set(k,v) { data.set(k,v); }, async del(k) { data.delete(k); },
    async list(prefix, options = {}) { return [...data].filter(([k])=>k.startsWith(prefix)).map(([key,value])=>options.keysOnly?{key}:{key,value}); },
    async delPrefix(prefix) { for(const k of data.keys()) if(k.startsWith(prefix)) data.delete(k); } };
}
async function signed(perms = ['studio','resilience']) {
  const store = memoryStore({ institutions:[{name:'Private institution',code:'123456',active:true}],
    'modules:Private institution':Object.fromEntries(perms.map(p=>[p,true])),
    'code:TEST1234':{code:'TEST-1234',kind:'staff',inst:'Private institution',perms,revoked:false} });
  const [status,out] = await handleAccess(store,{action:'login',kind:'code',secret:'TEST-1234'});
  assert.equal(status,200);
  return {store,token:out.token};
}
const brief = () => studio.newBrief({startingPoint:'משימה משותפת',goal:'תרגול עזרה הדדית',leaderRole:'מנחה',participants:'צוות',participantAge:'מבוגרים',count:28,duration:15,focus:'support'});
function generated(b = brief()) {
  const a = studio.exampleActivity(b);
  delete a.schemaVersion; delete a.catalogueVersion; delete a.evidenceStatus;
  a.professionalBasis=[facilitationBasis()];
  a.learningGuide.learnBefore=[{sourceId:'IAFCompetencies2026',focus:'פרק התכנון והשתתפות: איך מכינים תהליך שבו כל אחד יכול לתרום.'}];
  a.clarificationQuestions=[];
  return a;
}
function facilitationBasis() { return {sourceId:'IAFCompetencies2026',explanation:'הכנת תהליך, השתתפות נגישה וסיכום מעשי לפי עקרונות ההנחיה; אין בכך הוכחה ליעילות הפעילות.'}; }
function consultation(fields={}) {
  return {answer:'אפשר להתחיל מצעד קטן ולהכין מראש דרך השתתפות ברורה.',encouragement:'מובן שיש חשש לפני הנחיה חדשה; אפשר להתכונן בהדרגה.',
    nextSteps:['נסו את ההוראה עם שותפה ובדקו אם היא מובנת.'],questions:[],suggestedInstructions:'',professionalBasis:[facilitationBasis()],...fields};
}
const response = (data) => ({ ok:true, async json() { return {status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(data)}]}]}; } });

test('AE22: missing, revoked, expired and closed-ceiling access never calls AI', async () => {
  let calls=0;
  const fetchImpl=async()=>{calls++;return response(generated());};
  assert.equal((await handleStudio(memoryStore(),{action:'generate',brief:brief()},{fetchImpl}))[0],403);
  for (const change of ['revoked','ceiling','inactive','subscription','expiry']) {
    const {store,token}=await signed();
    if(change==='revoked') store.data.get('code:TEST1234').revoked=true;
    if(change==='ceiling') store.data.set('modules:Private institution',{});
    if(change==='inactive') store.data.get('institutions')[0].active=false;
    if(change==='subscription') store.data.get('institutions')[0].subEnd='2000-01-01';
    if(change==='expiry') store.data.get('code:TEST1234').expiresAt='2000-01-01';
    assert.equal((await handleStudio(store,{token,action:'generate',brief:brief()},{fetchImpl}))[0],403,change);
  }
  assert.equal(calls,0);
});
test('AE22: legacy access rechecks institution and ceiling; activity access cannot load a mapping', async () => {
  const {store}=await signed();
  const [,legacy]=await handleAccess(store,{action:'login',kind:'code',secret:'123456'});
  assert.ok(await authorizePermission(store,legacy.token,['studio']));
  store.data.get('institutions')[0].active=false;
  assert.equal(await authorizePermission(store,legacy.token,['studio']),null);
  // עד לאישור המקצועי: רק הרשאת studio פותחת את הסטודיו; תכנון פעילות לבד — לא
  const onlyActivity=await signed(['activity']);
  assert.equal((await handleStudio(onlyActivity.store,{token:onlyActivity.token,action:'authorize'}))[1].code,'studio_forbidden');
  const actor=await signed(['studio']);
  const denied=await handleStudio(actor.store,{token:actor.token,action:'mapping',mapping:{id:'abcdefgh',key:'key'}},{fetchImpl:()=>{throw Error('AI must not run');}});
  assert.equal(denied[0],403);assert.equal(denied[1].code,'mapping_forbidden');
  assert.deepEqual(await handleStudio(actor.store,{token:actor.token,action:'authorize'},{fetchImpl:()=>{throw Error('AI must not run');}}),[200,{ok:true}]);
  actor.store.data.get('code:TEST1234').revoked=true;
  const revoked=await handleStudio(actor.store,{token:actor.token,action:'authorize'});
  assert.equal(revoked[0],403);assert.equal(revoked[1].code,'studio_forbidden');
});
test('AE1,21,22: authorized mapping uses existing scores, deduplicates selected rounds and strips identifiers', async () => {
  const {store,token}=await signed();
  const key='mapping-secret';
  store.data.set('resil:abcdefgh',{inst:'Private institution',cls:'Named class',band:0,createdAt:'2026-01-01',keyHash:createHash('sha256').update(key).digest('hex')});
  const a=Array(62).fill(4);a[0]=0;
  const newer=Array(62).fill(4);newer[0]=3;
  for(const [rd,answers,date] of [[1,a,'2026-01-01'],[2,newer,'2026-02-01']]) store.data.set('resil:abcdefgh:r:0:private-pupil:'+rd,{v:0,k:'private-pupil',rd,a:answers,dt:date,ts:rd});
  const [status,out]=await handleStudio(store,{token,action:'mapping',mapping:{id:'abcdefgh',key,round:'latest'}});
  assert.equal(status,200);assert.equal(out.mapping.respondents,1);assert.equal(out.mapping.scope,'classroom');
  assert.equal(out.mapping.domains[0].score,100);assert.equal(out.mapping.dates.from,'2026-02-01');
  assert.ok(!/private-pupil|Named class|Private institution|mapping-secret|abcdefgh/.test(JSON.stringify(out)));
  const [,old]=await handleStudio(store,{token,action:'mapping',mapping:{id:'abcdefgh',key,round:1}});
  assert.equal(old.mapping.domains[0].score,0);
  const [forbidden]=await handleStudio(store,{token,action:'generate',brief:brief(),mapping:{id:'abcdefgh',key:'wrong'}},{fetchImpl:()=>{throw Error('AI must not run');}});
  assert.equal(forbidden,403);
  store.data.get('resil:abcdefgh').inst='Other institution';
  assert.equal((await handleStudio(store,{token,action:'mapping',mapping:{id:'abcdefgh',key}}))[0],403,'a foreign mapping is forbidden even with its old management key');
});
test('GPT-6 Responses payload is strict; source snapshots remain public and user sources stay unreviewed', async () => {
  const {store,token}=await signed();let sent;
  const b=brief();b.rawRespondents=[{name:'private-person'}];b.key='private-key';b.mapping={domains:[{name:'forged'}]};
  b.sources=Array.from({length:70},(_,i)=>({id:'u'+i,name:'סיפור '+i,role:'professional',status:'approved',url:'https://example.invalid',content:i?'השראה':'',raw:'private-source-data'}));
  const result=generated(b);result.professionalBasis=[{sourceId:'Sade2024',explanation:'רקע למנגנון משותף; אינו הוכחת יעילות לפעילות'},facilitationBasis()];
  process.env.OPENAI_API_KEY='test-key';
  const [status,out]=await handleStudio(store,{token,action:'generate',brief:b,mapping:{scope:'forged',domains:[{name:'fake'}]}},{fetchImpl:async(url,opts)=>{assert.equal(url,'https://api.openai.com/v1/responses');sent=JSON.parse(opts.body);return response(result);}});
  assert.equal(status,400,'client aggregates are rejected rather than used');
  const [ok,kit]=await handleStudio(store,{token,action:'generate',brief:b},{fetchImpl:async(url,opts)=>{sent=JSON.parse(opts.body);return response(result);}});
  assert.equal(ok,200);assert.equal(sent.model,'gpt-6.1-sol');assert.equal(sent.reasoning.effort,'medium');assert.equal(sent.store,false);assert.match(sent.instructions,/אף אחד לא צריך ולא חייב/);assert.match(sent.instructions,/בחירה, החלטה, שלבים ואחריות/);
  assert.ok(!('temperature' in sent));assert.ok(!('top_p' in sent));assert.equal(sent.text.format.strict,true);
  const input=JSON.parse(sent.input[0].content[0].text);
  assert.equal(input.brief.sources.length,70);assert.ok(input.brief.sources.every(s=>s.status==='unreviewed'&&s.role!=='professional'));
  assert.equal(input.brief.sources[0].access,'inaccessible');
  assert.ok(!/private-person|private-key|forged|private-source-data/.test(JSON.stringify(sent)));
  assert.ok(!JSON.stringify(sent).includes('SadeTools2026'));assert.ok(!JSON.stringify(sent).includes('SadeTrust2026'));
  assert.equal(kit.activity.evidenceStatus,'new-ai');assert.equal(kit.activity.professionalBasis[0].sourceId,'Sade2024');
  assert.match(kit.activity.leaderGuidance,/טיוטה/);
  delete process.env.OPENAI_API_KEY;
});
test('invalid focus, missing context, active danger, incomplete/refusal and malformed outputs do not become kits', async () => {
  const {store,token}=await signed();process.env.OPENAI_API_KEY='test-key';let calls=0;
  const mock=async()=>{calls++;return response(generated());};
  for(const b of [briefWith({focus:''}),briefWith({participantAge:''}),briefWith({crisis:'active-danger'})]) assert.equal((await handleStudio(store,{token,action:'generate',brief:b},{fetchImpl:mock}))[0],422);
  assert.equal(calls,0);
  for(const provider of [{status:'incomplete',output:[]},{status:'completed',output:'invalid'},{status:'completed',output:[{content:[{type:'refusal',refusal:'no'}]}]},{status:'completed',output:[{content:[{type:'output_text',text:'{}'}]}]}]) {
    assert.equal((await handleStudio(store,{token,action:'generate',brief:brief()},{fetchImpl:async()=>({ok:true,json:async()=>provider})}))[0],422);
  }
  const unknown=generated();unknown.professionalBasis=[{sourceId:'invented',explanation:'source'}];
  assert.equal((await handleStudio(store,{token,action:'generate',brief:brief()},{fetchImpl:async()=>response(unknown)}))[0],422);
  const changed=generated();changed.focus='hope';
  assert.equal((await handleStudio(store,{token,action:'generate',brief:brief()},{fetchImpl:async()=>response(changed)}))[0],422);
  delete process.env.OPENAI_API_KEY;
});
test('AE17,19,21: analysis accepts inspiration and mapping data stays aggregate-only in the AI request', async () => {
  const {store,token}=await signed();process.env.OPENAI_API_KEY='test-key';let sent;
  const key='private-management-key';
  store.data.set('resil:abcdefgh',{inst:'Private institution',cls:'Secret classroom',band:0,createdAt:'2026-01-01',keyHash:createHash('sha256').update(key).digest('hex')});
  store.data.set('resil:abcdefgh:r:0:secret-pupil:1',{v:0,k:'secret-pupil',rd:1,a:Array(62).fill(3),dt:'2026-01-02'});
  const answer={focus:'cooperation',rationale:'הצעה לפי פעולה משותפת; המיפוי הוא כיתתי ויש לברר התאמה לצוות',alternatives:['support'],questions:['האם המיפוי מתייחס למשתתפים הנוכחיים?']};
  const [status,out]=await handleStudio(store,{token,action:'analyze',brief:studio.newBrief({startingPoint:'רעיון לפעולה'}),mapping:{id:'abcdefgh',key}},{fetchImpl:async(url,opts)=>{sent=JSON.parse(opts.body);return response(answer);}});
  assert.equal(status,200);assert.equal(out.recommendation.focus,'cooperation');
  assert.ok(!/Secret classroom|secret-pupil|Private institution|private-management-key|abcdefgh/.test(JSON.stringify(sent)));
  assert.equal(JSON.parse(sent.input[0].content[0].text).mapping.scope,'classroom');
  delete process.env.OPENAI_API_KEY;
});
test('AE16,17: adaptation sanitizes a prior kit and keeps the acceptance decision with the user', async () => {
  const {store,token}=await signed();process.env.OPENAI_API_KEY='test-key';let sent;
  const previous=studio.exampleActivity(brief());previous.privateContext='must-never-pass';previous.sessions[0].privateContext='nested-private';
  const candidate=generated();candidate.adaptationExplanation='הזמן התקצר; נשמרו החלפת מידע והתרגול המשותף.';
  const [status,out]=await handleStudio(store,{token,action:'adapt',brief:brief(),previous},{fetchImpl:async(url,opts)=>{sent=JSON.parse(opts.body);return response(candidate);}});
  assert.equal(status,200);assert.match(out.activity.adaptationExplanation,/נשמרו/);
  assert.ok(!/must-never-pass|nested-private/.test(JSON.stringify(sent)));
  const invalid=generated();invalid.sessions[0].steps[0].minutes=50;
  assert.equal((await handleStudio(store,{token,action:'adapt',brief:brief(),previous},{fetchImpl:async()=>response(invalid)}))[0],422);
  delete process.env.OPENAI_API_KEY;
});
test('AE2,5: generation returns material clarification before creating a kit, even with manual focus', async () => {
  const {store,token}=await signed();process.env.OPENAI_API_KEY='test-key';
  const candidate=generated();candidate.sessions=[];candidate.clarificationQuestions=['האם התיאור החדש מתייחס לאותה קבוצה ובאותו זמן?'];
  const [status,out]=await handleStudio(store,{token,action:'generate',brief:brief()},{fetchImpl:async()=>response(candidate)});
  assert.equal(status,422);assert.equal(out.questions.length,1);assert.ok(!out.activity);
  const clarified={...brief(),clarifications:'זו אותה קבוצה; התיאור החדש עדכני יותר.'};
  let input;
  const [ok,kit]=await handleStudio(store,{token,action:'generate',brief:clarified},{fetchImpl:async(url,opts)=>{input=JSON.parse(JSON.parse(opts.body).input[0].content[0].text);return response(generated(clarified));}});
  assert.equal(ok,200);assert.equal(input.brief.clarifications,clarified.clarifications);assert.ok(!('clarificationQuestions' in kit.activity));
  delete process.env.OPENAI_API_KEY;
});
test('AE5,10,23: new activity evidence is never promoted to proven efficacy', async () => {
  const {store,token}=await signed();process.env.OPENAI_API_KEY='test-key';
  const fabricated=generated();fabricated.leaderGuidance='זו פעילות מוכחת: יעילותה הוכחה.';
  assert.equal((await handleStudio(store,{token,action:'generate',brief:brief()},{fetchImpl:async()=>response(fabricated)}))[0],422);
  const caveat=generated();caveat.leaderGuidance='זו אינה פעילות מוכחת; מחקר על המנגנון אינו מוכיח את יעילות הפעילות.';
  assert.equal((await handleStudio(store,{token,action:'generate',brief:brief()},{fetchImpl:async()=>response(caveat)}))[0],200);
  delete process.env.OPENAI_API_KEY;
});
function briefWith(fields) { return {...brief(),...fields}; }

test('AE1,22: a live system administrator can connect a mapping without its manager key', async()=>{
  const store=memoryStore({'resil:abcdefgh':{inst:'Another institution',cls:'Private class',band:0,createdAt:'2026-01-01',keyHash:'not-needed-for-sys'}});
  const [status,session]=await handleAccess(store,{action:'login',kind:'sys',secret:'990211'});
  assert.equal(status,200);
  const [ok,result]=await handleStudio(store,{token:session.token,action:'mapping',mapping:{id:'abcdefgh',key:'',round:'latest'}});
  assert.equal(ok,200);assert.equal(result.mapping.scope,'classroom');assert.equal(result.mapping.respondents,0);
  assert.ok(!JSON.stringify(result).includes('Private class'));
});
test('AE1,11,21: selected statement identity, polarity and measured sides survive aggregation',async()=>{
  const {store,token}=await signed(),key='mapping-key';
  const group={inst:'Private institution',cls:'Private class',band:0,sel:[0],keyHash:createHash('sha256').update(key).digest('hex')};
  store.data.set('resil:abcdefgh',group);
  const answers=Array(62).fill(4);answers[0]=0;
  const row={v:0,k:'private-person',rd:1,a:answers,dt:'2026-01-01'};
  store.data.set('resil:abcdefgh:r:0:private-person:1',row);
  const [,positive]=await handleStudio(store,{token,action:'mapping',mapping:{id:'abcdefgh',key}});
  group.sel=[1];answers[0]=3;answers[1]=0; // unselected positive answer must not be scored
  const [,reverse]=await handleStudio(store,{token,action:'mapping',mapping:{id:'abcdefgh',key}});
  assert.equal(positive.mapping.selectedStatements[0].polarity,'positive');
  assert.equal(reverse.mapping.selectedStatements[0].polarity,'reverse');
  assert.notEqual(positive.mapping.selectedStatements[0].text,reverse.mapping.selectedStatements[0].text);
  assert.equal(positive.mapping.domains[0].coverage.positiveMeasured,true);
  assert.equal(positive.mapping.domains[0].coverage.reverseMeasured,false);
  assert.equal(reverse.mapping.domains[0].coverage.positiveMeasured,false);
  assert.equal(reverse.mapping.domains[0].coverage.reverseMeasured,true);
  assert.equal(reverse.mapping.domains[0].good,0);
  assert.ok(!JSON.stringify(reverse).includes('private-person'));
});

test('new kits require complete practical facilitation and a suitable mechanism with source provenance',async()=>{
  const {store,token}=await signed();process.env.OPENAI_API_KEY='test-key';
  assert.ok(ACTIVITY_SCHEMA.required.includes('socialMechanism'));
  assert.ok(ACTIVITY_SCHEMA.required.includes('facilitationPlan'));
  assert.deepEqual(ACTIVITY_SCHEMA.properties.facilitationPlan.required,studio.FACILITATION_FIELDS);
  assert.equal(ACTIVITY_SCHEMA.properties.socialMechanism.additionalProperties,false);
  const [ok,out]=await handleStudio(store,{token,action:'generate',brief:brief()},{fetchImpl:async()=>response(generated())});
  assert.equal(ok,200);assert.equal(out.activity.socialMechanism.type,'routine');
  assert.ok(studio.FACILITATION_FIELDS.every(field=>out.activity.facilitationPlan[field].trim()));
  assert.equal(out.activity.professionalBasis[0].sourceId,'IAFCompetencies2026');
  assert.match(out.activity.professionalBasis[0].url,/iaf-world\.org/);
  assert.equal(out.activity.professionalBasis[0].status,'existing-bank');
  for(const change of ['missing-mechanism','missing-facilitation','blank-plan','no-facilitation-basis','unknown-mechanism','empty-none']) {
    const candidate=generated();
    if(change==='missing-mechanism') delete candidate.socialMechanism;
    if(change==='missing-facilitation') delete candidate.facilitationPlan;
    if(change==='blank-plan') candidate.facilitationPlan.opening=' ';
    if(change==='no-facilitation-basis') candidate.professionalBasis=[];
    if(change==='unknown-mechanism') candidate.socialMechanism.type='invented';
    if(change==='empty-none') candidate.socialMechanism=studio.socialMechanism();
    assert.equal((await handleStudio(store,{token,action:'generate',brief:brief()},{fetchImpl:async()=>response(candidate)}))[0],422,change);
  }
  const optional=generated();optional.socialMechanism=studio.socialMechanism({type:'none',mechanism:'זה מפגש הכנה חד פעמי; הקבוצה תבחר אם נדרש המשך אחרי ההתנסות.'});
  assert.equal((await handleStudio(store,{token,action:'generate',brief:brief()},{fetchImpl:async()=>response(optional)}))[0],200);
  delete process.env.OPENAI_API_KEY;
});

test('older version 1.0 activities adapt with defaults for newly added sections',async()=>{
  const {store,token}=await signed();process.env.OPENAI_API_KEY='test-key';let input;
  const previous=studio.exampleActivity(brief());delete previous.socialMechanism;delete previous.facilitationPlan;
  previous.schemaVersion='1.0';previous.mapping={key:'private-old-key'};
  const candidate=generated();candidate.adaptationExplanation='נוספה הכנה מעשית למנחה ושגרה לבדיקת הצעד המשותף.';
  const [status,out]=await handleStudio(store,{token,action:'adapt',brief:brief(),previous},{fetchImpl:async(url,opts)=>{
    input=JSON.parse(JSON.parse(opts.body).input[0].content[0].text);return response(candidate);
  }});
  assert.equal(status,200);assert.deepEqual(input.previous.socialMechanism,studio.socialMechanism());
  assert.deepEqual(input.previous.facilitationPlan,studio.facilitationPlan());
  assert.ok(!JSON.stringify(input).includes('private-old-key'));assert.ok(out.activity.facilitationPlan.preparation);
  assert.ok(!Object.hasOwn(previous,'socialMechanism'),'sanitation does not mutate the saved prior draft');
  delete process.env.OPENAI_API_KEY;
});

test('consultation starts before production context and supports repeated conversation history',async()=>{
  const {store,token}=await signed(['studio']);process.env.OPENAI_API_KEY='test-key';const sent=[];
  const fetchImpl=async(url,opts)=>{sent.push(JSON.parse(opts.body));return response(consultation({professionalBasis:[]}));};
  const [status,first]=await handleStudio(store,{token,action:'consult',brief:{startingPoint:'יש לי רק רעיון'},stage:'starting',question:'איך להתחיל?'},{fetchImpl});
  assert.equal(status,200);assert.ok(first.consultation.answer);assert.ok(!first.activity);
  const history=[{role:'user',text:'איך להתחיל?'},{role:'assistant',text:first.consultation.answer}];
  const [again]=await handleStudio(store,{token,action:'consult',brief:{startingPoint:'יש לי רק רעיון'},stage:'focus',question:'הצעד הזה מתאים גם לקבוצה קטנה?',history},{fetchImpl});
  assert.equal(again,200);const input=JSON.parse(sent[1].input[0].content[0].text);
  assert.deepEqual(input.history,history);assert.equal(input.stage,'focus');assert.equal(input.brief.focus,'');
  assert.equal(sent[1].model,'gpt-6.1-sol');assert.equal(sent[1].store,false);assert.equal(sent[1].text.format.strict,true);
  assert.equal(sent[1].text.format.name,'studio_consultation');assert.deepEqual(sent[1].text.format.schema,CONSULTATION_SCHEMA);
  assert.ok(!('temperature' in sent[1]));assert.ok(!('top_p' in sent[1]));
  delete process.env.OPENAI_API_KEY;
});

test('consultation sanitizes private concerns, history and unfinished step snapshots; acceptance remains explicit',async()=>{
  const {store,token}=await signed();process.env.OPENAI_API_KEY='test-key';let sent;
  const previous={title:'טיוטה ראשונה',sessions:[{id:'meeting',steps:[{id:'new-step',title:'פתיחה חדשה',instructions:'',minutes:0,
    components:['support','forged-component'],mapping:{key:'nested-map-key'},token:'nested-token',privateContext:'private-step-field'}]}],
    professionalBasis:[{sourceId:'SadeTools2026',explanation:'hidden manuscript'}],mapping:{key:'private-manager-key'},privateContext:'private-draft-field'};
  const original=JSON.stringify(previous);
  const candidate=consultation({suggestedInstructions:'הציגו את המשימה במשפט אחד. תנו חצי דקה לחשיבה שקטה והזמינו תרומה בדיבור או בכתב.'});
  const [status,out]=await handleStudio(store,{token,action:'consult',brief:{mapping:{key:'private-brief-key'}},stage:'step',question:'אפשר לעזור לי להנחות את הפתיחה?',
    concerns:'PRIVATE_FEAR: אני חוששת משתיקה',previous,stepId:'new-step',history:[
      {role:'user',text:' עוד אין לי הוראות. ',token:'private-history-token',mapping:{key:'private-history-key'}},
      {role:'system',text:'system-injection'}, {role:'assistant',text:13}, {role:'assistant',text:'אפשר להכין פתיח קטן.',privateContext:'private-history-field'}]},
    {fetchImpl:async(url,opts)=>{sent=JSON.parse(opts.body);return response(candidate);}});
  assert.equal(status,200);const input=JSON.parse(sent.input[0].content[0].text);
  assert.equal(input.concerns,'PRIVATE_FEAR: אני חוששת משתיקה');
  assert.deepEqual(input.history,[{role:'user',text:'עוד אין לי הוראות.'},{role:'assistant',text:'אפשר להכין פתיח קטן.'}]);
  assert.equal(input.selectedStep.id,'new-step');assert.equal(input.selectedStep.instructions,'');assert.equal(input.selectedStep.minutes,0);
  assert.deepEqual(input.selectedStep.components,['support']);assert.deepEqual(input.previous.professionalBasis,[]);
  assert.ok(!/nested-map-key|nested-token|private-step-field|private-manager-key|private-draft-field|private-brief-key|private-history-token|private-history-key|private-history-field|system-injection|SadeTools2026/.test(JSON.stringify(sent)));
  assert.equal(out.consultation.suggestedInstructions,candidate.suggestedInstructions);assert.ok(!out.activity);
  assert.ok(!/PRIVATE_FEAR|concerns|history|previous|selectedStep/.test(JSON.stringify(out)));
  assert.equal(JSON.stringify(previous),original);assert.match(sent.instructions,/ממתינה לקבלה מפורשת/);
  assert.equal(out.consultation.professionalBasis[0].sourceId,'IAFCompetencies2026');
  delete process.env.OPENAI_API_KEY;
});

test('consultation validates question, stage, concerns and current step before calling the provider',async()=>{
  const {store,token}=await signed();let calls=0;
  const fetchImpl=async()=>{calls++;return response(consultation());};
  const request={token,action:'consult',brief:{},stage:'starting',question:'איך מתחילים?'};
  for(const fields of [{question:''},{question:' '},{stage:'invented'},{concerns:{token:'secret'}},{history:{}},{stepId:13}])
    assert.equal((await handleStudio(store,{...request,...fields},{fetchImpl}))[0],400);
  for(const fields of [{stepId:'not-found'},{previous:[]},{previous:{sessions:[{steps:[{id:'a'},{id:'a'}]}]},stepId:'a'}])
    assert.equal((await handleStudio(store,{...request,...fields},{fetchImpl}))[0],422);
  assert.equal(calls,0);
});

test('consultation suggestions cannot replace global activity or target an unselected step',async()=>{
  const {store,token}=await signed();process.env.OPENAI_API_KEY='test-key';
  const request={token,action:'consult',brief:{},stage:'facilitation',question:'איך להתכונן?',previous:{sessions:[{steps:[{id:'a',instructions:''}]}]}};
  const unselected=consultation({suggestedInstructions:'הוראות חלופיות לשלב שלא נבחר.'});
  assert.equal((await handleStudio(store,request,{fetchImpl:async()=>response(unselected)}))[0],422);
  assert.equal((await handleStudio(store,request,{fetchImpl:async()=>response(consultation({suggestedInstructions:' '}))}))[0],422,'a global suggestion must be exactly empty');
  const injected=consultation();injected.activity=generated();
  assert.equal((await handleStudio(store,request,{fetchImpl:async()=>response(injected)}))[0],422,'extra activity output violates the strict consultation contract');
  const [ok,out]=await handleStudio(store,request,{fetchImpl:async()=>response(consultation())});
  assert.equal(ok,200);assert.equal(out.consultation.suggestedInstructions,'');assert.ok(!out.activity);
  delete process.env.OPENAI_API_KEY;
});

test('consultation rechecks live access, enforces mapping permission and stops active danger',async()=>{
  let calls=0;const fetchImpl=async()=>{calls++;return response(consultation());};
  const request={action:'consult',brief:{},stage:'starting',question:'איך מתחילים?'};
  assert.equal((await handleStudio(memoryStore(),request,{fetchImpl}))[0],403);
  for(const change of ['revoked','ceiling','inactive','expiry']) {
    const {store,token}=await signed();
    if(change==='revoked') store.data.get('code:TEST1234').revoked=true;
    if(change==='ceiling') store.data.set('modules:Private institution',{});
    if(change==='inactive') store.data.get('institutions')[0].active=false;
    if(change==='expiry') store.data.get('code:TEST1234').expiresAt='2000-01-01';
    assert.equal((await handleStudio(store,{...request,token},{fetchImpl}))[0],403,change);
  }
  const actor=await signed(['studio']);
  assert.equal((await handleStudio(actor.store,{...request,token:actor.token,mapping:{id:'abcdefgh',key:'private-key'}},{fetchImpl}))[0],403);
  const {store,token}=await signed();
  const [danger,out]=await handleStudio(store,{...request,token,brief:{crisis:'active-danger'}},{fetchImpl});
  assert.equal(danger,422);assert.match(out.error,/מזעיקים עזרה/);assert.equal(calls,0);
});

test('consultation uses public provenance with IAF always and UNICEF only for youth',async()=>{
  const {store,token}=await signed();process.env.OPENAI_API_KEY='test-key';
  for(const [b,question,youth] of [[{participants:'צוות',participantAge:'מבוגרים'},'איך להנחות?',false],
    [{participants:'קבוצה',participantAge:'14'},'איך להנחות?',true],[{},'איך להכין פעילות לבני נוער?',true]]) {
    let input;
    const [status,out]=await handleStudio(store,{token,action:'consult',brief:{...b,sources:[{id:'user-a',role:'professional',status:'approved',name:'מקור משתמש',content:'רעיון',raw:'private-source'}]},stage:'facilitation',question},
      {fetchImpl:async(url,opts)=>{input=JSON.parse(JSON.parse(opts.body).input[0].content[0].text);return response(consultation());}});
    assert.equal(status,200);assert.ok(input.professionalSources.some(s=>s.sourceId==='IAFCompetencies2026'));
    assert.equal(input.professionalSources.some(s=>s.sourceId==='UnicefAdolescentKit2026'),youth);
    assert.ok(input.professionalSources.every(s=>s.status==='existing-bank'));
    assert.ok(!/SadeTools2026|SadeTrust2026|private-source/.test(JSON.stringify(input)));
    assert.equal(input.brief.sources[0].status,'unreviewed');assert.equal(input.brief.sources[0].role,'context');
    assert.match(out.consultation.professionalBasis[0].version,/^sha256:/);
  }
  const request={token,action:'consult',brief:{participants:'צוות',participantAge:'מבוגרים'},stage:'facilitation',question:'איך להנחות?'};
  for(const sourceId of ['invented-source','SadeTools2026','user-a','UnicefAdolescentKit2026'])
    assert.equal((await handleStudio(store,request,{fetchImpl:async()=>response(consultation({professionalBasis:[{sourceId,explanation:'טענה מקצועית'}]}))}))[0],422,sourceId);
  delete process.env.OPENAI_API_KEY;
});

test('consultation rejects refusal, incomplete or malformed responses and false efficacy or approval claims',async()=>{
  const {store,token}=await signed();process.env.OPENAI_API_KEY='test-key';
  const request={token,action:'consult',brief:{},stage:'starting',question:'אפשר להצליח בהנחיה?'};
  for(const provider of [{status:'incomplete',output:[]},{status:'completed',output:[{content:[{type:'refusal',refusal:'no'}]}]},
    {status:'completed',output:[{content:[{type:'output_text',text:'{}'}]}]}, {status:'completed',output:[{content:[{type:'output_text',text:'invalid'}]}]}])
    assert.equal((await handleStudio(store,request,{fetchImpl:async()=>({ok:true,json:async()=>provider})}))[0],422);
  for(const answer of ['זו פעילות מוכחת: יעילותה הוכחה.','הפעילות אושרה מקצועית.','הפעילות מאושרת לשימוש.'])
    assert.equal((await handleStudio(store,request,{fetchImpl:async()=>response(consultation({answer}))}))[0],422);
  const [status]=await handleStudio(store,request,{fetchImpl:async()=>response(consultation({answer:'הפעילות אינה מוכחת; היא טרם אושרה מקצועית. הכנה והכשרה מקצועית יכולות לעזור לתכנן צעד אפשרי.'}))});
  assert.equal(status,200);delete process.env.OPENAI_API_KEY;
});

test('provider errors make no claim that a local draft was saved',async()=>{
  const {store,token}=await signed();process.env.OPENAI_API_KEY='test-key';
  for(const action of ['generate','consult']) for(const fetchImpl of [async()=>({ok:false}),async()=>{throw Error('network');}]) {
    const [status,out]=await handleStudio(store,{token,action,brief:action==='generate'?brief():{},stage:'starting',question:'איך מתחילים?'},{fetchImpl});
    assert.equal(status,503);assert.ok(!/נשמר|השמור|saved|stored/i.test(out.error));
  }
  delete process.env.OPENAI_API_KEY;
});
