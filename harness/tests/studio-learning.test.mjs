// מדריך למידה למנחה: מבוסס מקורות ציבוריים מבנק הידע בלבד, נשמר בעבודה ובגרסה לשיתוף, ואינו נכנס לחומרי המשתתפים.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { handleAccess } from '../lib/access.mjs';
import { ACTIVITY_SCHEMA, handleStudio } from '../lib/studio.mjs';
const studio = createRequire(import.meta.url)('../../app/lib/resilience-studio.js');

function memoryStore(seed = {}) {
  const data = new Map(Object.entries(seed));
  return { data, async get(k) { return data.get(k) || null; }, async set(k,v) { data.set(k,v); }, async del(k) { data.delete(k); },
    async list(prefix, options = {}) { return [...data].filter(([k])=>k.startsWith(prefix)).map(([key,value])=>options.keysOnly?{key}:{key,value}); },
    async delPrefix(prefix) { for(const k of data.keys()) if(k.startsWith(prefix)) data.delete(k); } };
}
async function signed(perms = ['studio']) {
  const store = memoryStore({ institutions:[{name:'Test institution',code:'123456',active:true}],
    'modules:Test institution':Object.fromEntries(perms.map(p=>[p,true])),
    'code:LEARN123':{code:'LEARN-123',kind:'staff',inst:'Test institution',perms,revoked:false} });
  const [status,out] = await handleAccess(store,{action:'login',kind:'code',secret:'LEARN-123'});
  assert.equal(status,200);
  return {store,token:out.token};
}
const brief = () => studio.newBrief({startingPoint:'משימה משותפת',goal:'תרגול עזרה הדדית',leaderRole:'מנחה',participants:'צוות',participantAge:'מבוגרים',count:12,duration:40,focus:'support'});
const FOCUS = 'פרק התכנון וההשתתפות: איך מכינים תהליך שבו כל אחד יכול לתרום.';
function generated() {
  const a = studio.exampleActivity(brief());
  delete a.schemaVersion; delete a.catalogueVersion; delete a.evidenceStatus;
  a.professionalBasis=[{sourceId:'IAFCompetencies2026',explanation:'עקרונות הכנת תהליך והשתתפות; אין בכך הוכחה ליעילות הפעילות.'}];
  a.learningGuide.learnBefore=[{sourceId:'IAFCompetencies2026',focus:FOCUS}];
  a.clarificationQuestions=[];
  return a;
}
const response = (data) => ({ ok:true, async json() { return {status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(data)}]}]}; } });
const run = async (candidate, extra={}) => {
  const {store,token}=await signed();process.env.OPENAI_API_KEY='test-key';
  try { return await handleStudio(store,{token,action:'generate',brief:brief(),...extra},{fetchImpl:async()=>response(candidate)}); }
  finally { delete process.env.OPENAI_API_KEY; }
};

test('the activity schema requires a learning guide with sources and practical fields',()=>{
  assert.ok(ACTIVITY_SCHEMA.required.includes('learningGuide'));
  const g=ACTIVITY_SCHEMA.properties.learningGuide;
  assert.deepEqual([...g.required].sort(),[...studio.LEARNING_FIELDS,'learnBefore'].sort());
  assert.deepEqual(g.properties.learnBefore.items.required,['sourceId','focus']);
  assert.equal(g.additionalProperties,false);
});

test('a generated kit links the guide to bank sources (name, link, version, status)',async()=>{
  const [status,out]=await run(generated());
  assert.equal(status,200);
  const lb=out.activity.learningGuide.learnBefore;
  assert.equal(lb.length,1);assert.equal(lb[0].sourceId,'IAFCompetencies2026');assert.equal(lb[0].focus,FOCUS);
  assert.match(lb[0].url,/iaf-world\.org/);assert.equal(lb[0].status,'existing-bank');assert.match(lb[0].version,/^sha256:/);
  assert.ok(studio.LEARNING_FIELDS.every(k=>out.activity.learningGuide[k].trim()));
});

test('incomplete guides, invented or hidden sources and efficacy claims are rejected',async()=>{
  const cases={
    'missing-guide':a=>{delete a.learningGuide;},
    'blank-apply':a=>{a.learningGuide.apply=' ';},
    'blank-limits':a=>{a.learningGuide.limits='';},
    'no-sources':a=>{a.learningGuide.learnBefore=[];},
    'invented-source':a=>{a.learningGuide.learnBefore=[{sourceId:'Invented2026',focus:'משהו'}];},
    'hidden-manuscript':a=>{a.learningGuide.learnBefore=[{sourceId:'SadeTools2026',focus:'כתב יד'}];},
    'blank-focus':a=>{a.learningGuide.learnBefore[0].focus=' ';},
    'proven-claim':a=>{a.learningGuide.mechanism='הפעילות מאושרת מקצועית ויעילותה הוכחה.';},
  };
  for(const [name,change] of Object.entries(cases)) {
    const c=generated();change(c);
    assert.equal((await run(c))[0],422,name);
  }
});

test('older work files without a guide adapt; hidden sources in a saved guide never reach the model',async()=>{
  const {store,token}=await signed();process.env.OPENAI_API_KEY='test-key';let input;
  const previous=studio.exampleActivity(brief());delete previous.learningGuide;
  const candidate=generated();candidate.adaptationExplanation='נוסף מדריך למידה למנחה.';
  const fetchImpl=async(url,opts)=>{input=JSON.parse(JSON.parse(opts.body).input[0].content[0].text);return response(candidate);};
  let [status]=await handleStudio(store,{token,action:'adapt',brief:brief(),previous},{fetchImpl});
  assert.equal(status,200);
  assert.deepEqual(input.previous.learningGuide,{mechanism:'',apply:'',watchFor:'',limits:'',learnBefore:[]});
  const withHidden=studio.exampleActivity(brief());
  withHidden.learningGuide.learnBefore=[{sourceId:'SadeTools2026',focus:'כתב יד'},{sourceId:'IAFCompetencies2026',focus:FOCUS}];
  [status]=await handleStudio(store,{token,action:'adapt',brief:brief(),previous:withHidden},{fetchImpl});
  assert.equal(status,200);
  assert.deepEqual(input.previous.learningGuide.learnBefore.map(s=>s.sourceId),['IAFCompetencies2026']);
  [status]=await handleStudio(store,{token,action:'consult',brief:brief(),stage:'learning',question:'מה כדאי לקרוא קודם?',previous:withHidden},
    {fetchImpl:async(url,opts)=>{input=JSON.parse(JSON.parse(opts.body).input[0].content[0].text);
      return response({answer:'כדאי להתחיל בפרק ההשתתפות.',encouragement:'',nextSteps:[],questions:[],suggestedInstructions:'',professionalBasis:[]});}});
  assert.equal(status,200);assert.equal(input.stage,'learning');
  assert.ok(!JSON.stringify(input).includes('SadeTools2026'));
  delete process.env.OPENAI_API_KEY;
});

test('the guide is kept in the shared version but contains no private coaching material',()=>{
  const a=studio.exampleActivity(brief());
  a.learningGuide=studio.learningGuide({...a.learningGuide,learnBefore:[{sourceId:'IAFCompetencies2026',focus:FOCUS,name:'IAF',url:'https://iaf-world.org/discover-the-iaf/'}]});
  a.coach={concerns:'חשש פרטי',messages:[{role:'user',text:'שיחה פרטית'}]};
  const shared=studio.publicActivity(a);
  assert.equal(shared.learningGuide.learnBefore[0].focus,FOCUS);
  assert.ok(!JSON.stringify(shared).includes('חשש פרטי'));assert.ok(!JSON.stringify(shared).includes('שיחה פרטית'));
  const normalized=studio.learningGuide({mechanism:5,learnBefore:[null,{sourceId:''},{sourceId:'X',focus:7,extra:'drop'}]});
  assert.deepEqual(normalized,{mechanism:'',apply:'',watchFor:'',limits:'',learnBefore:[{sourceId:'X',focus:'',name:'',url:'',version:'',status:''}]});
  assert.ok(studio.CONSULTATION_STAGES.includes('learning'));
});
