// הפקה ברקע בסטודיו: הבדיקות (הרשאה, מיפוי, תקציר) רצות לפני שמוחזר מזהה עבודה; רק הקריאה למודל ממשיכה ברקע.
// העבודה נשמרת בזיכרון בלבד, קשורה לאסימון שהתחיל אותה, ואינה נשמרת במאגר.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { handleAccess } from '../lib/access.mjs';
import { studioRequest } from '../lib/studio.mjs';
const studio = createRequire(import.meta.url)('../../app/lib/resilience-studio.js');

function memoryStore(seed = {}) {
  const data = new Map(Object.entries(seed));
  return { data, async get(k) { return data.get(k) || null; }, async set(k,v) { data.set(k,v); }, async del(k) { data.delete(k); },
    async list(prefix, options = {}) { return [...data].filter(([k])=>k.startsWith(prefix)).map(([key,value])=>options.keysOnly?{key}:{key,value}); },
    async delPrefix(prefix) { for(const k of data.keys()) if(k.startsWith(prefix)) data.delete(k); } };
}
async function signed(code='BACK-123', perms=['studio']) {
  const id=code.replace('-','');
  const store = memoryStore({ institutions:[{name:'Test institution',code:'123456',active:true}],
    'modules:Test institution':Object.fromEntries(perms.map(p=>[p,true])),
    ['code:'+id]:{code,kind:'staff',inst:'Test institution',perms,revoked:false} });
  const [status,out] = await handleAccess(store,{action:'login',kind:'code',secret:code});
  assert.equal(status,200);
  return {store,token:out.token};
}
const brief = () => studio.newBrief({startingPoint:'משימה משותפת',goal:'תרגול עזרה הדדית',leaderRole:'מנחה',participants:'צוות',participantAge:'מבוגרים',count:12,duration:40,focus:'support'});
function generated() {
  const a = studio.exampleActivity(brief());
  delete a.schemaVersion; delete a.catalogueVersion; delete a.evidenceStatus;
  a.professionalBasis=[{sourceId:'IAFCompetencies2026',explanation:'עקרונות הכנת תהליך והשתתפות; אין בכך הוכחה ליעילות הפעילות.'}];
  a.learningGuide.learnBefore=[{sourceId:'IAFCompetencies2026',focus:'פרק התכנון וההשתתפות: איך מכינים תהליך שבו כל אחד יכול לתרום.'}];
  a.clarificationQuestions=[];
  return a;
}
const response = (data) => ({ ok:true, async json() { return {status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(data)}]}]}; } });
function gate() { let open; const p=new Promise(r=>{open=r;}); return {p,open}; }
const tick = () => new Promise(r=>setImmediate(r));
async function withKey(fn) { process.env.OPENAI_API_KEY='test-key'; try { return await fn(); } finally { delete process.env.OPENAI_API_KEY; } }

test('async generate returns a job id, runs the model in the background and only its owner can read it', () => withKey(async () => {
  const {store,token}=await signed();
  const before=[...store.data.keys()].sort();
  const g=gate(); let calls=0;
  const fetchImpl=async()=>{calls++; await g.p; return response(generated());};
  const [status,out]=await studioRequest(store,{token,action:'generate',brief:brief(),async:true},{fetchImpl});
  assert.equal(status,200); assert.match(out.jobId,/^[0-9a-f-]{36}$/); assert.equal(calls,1);
  const running=await studioRequest(store,{token,action:'status',jobId:out.jobId});
  assert.equal(running[1].status,'running');
  const other=await signed('OTHR-456');
  assert.deepEqual(await studioRequest(store,{token:other.token,action:'status',jobId:out.jobId}),[200,{status:'unknown'}]);
  assert.deepEqual(await studioRequest(store,{action:'status',jobId:out.jobId}),[200,{status:'unknown'}]);
  g.open(); await tick(); await tick();
  const [,done]=await studioRequest(store,{token,action:'status',jobId:out.jobId});
  assert.equal(done.status,'done'); assert.equal(done.httpStatus,200);
  assert.equal(done.result.activity.evidenceStatus,'new-ai');
  assert.equal(done.result.activity.learningGuide.learnBefore[0].sourceId,'IAFCompetencies2026');
  assert.deepEqual([...store.data.keys()].sort(),before,'the job and its result are not written to storage');
  assert.deepEqual(await studioRequest(store,{token,action:'status',jobId:'no-such-job'}),[200,{status:'unknown'}]);
}));

test('async requests that fail before the model answer directly, without a job or an AI call', () => withKey(async () => {
  let calls=0; const fetchImpl=async()=>{calls++;return response(generated());};
  assert.equal((await studioRequest(memoryStore(),{action:'generate',brief:brief(),async:true},{fetchImpl}))[0],403);
  const {store,token}=await signed();
  store.data.get('code:BACK123').revoked=true;
  const [status,out]=await studioRequest(store,{token,action:'generate',brief:brief(),async:true},{fetchImpl});
  assert.equal(status,403); assert.equal(out.jobId,undefined);
  const live=await signed();
  const empty=await studioRequest(live.store,{token:live.token,action:'generate',brief:studio.newBrief({}),async:true},{fetchImpl});
  assert.equal(empty[0],422); assert.equal(empty[1].jobId,undefined);
  assert.deepEqual(await studioRequest(live.store,{token:live.token,action:'authorize',async:true},{fetchImpl}),[200,{ok:true}]);
  assert.equal(calls,0);
}));

test('model failures and invalid kits arrive as the job result with their status', () => withKey(async () => {
  const {store,token}=await signed();
  const waitDone=async jobId=>{ for(let i=0;i<20;i++){ const [,s]=await studioRequest(store,{token,action:'status',jobId}); if(s.status==='done') return s; await tick(); } throw Error('job did not finish'); };
  const down=await studioRequest(store,{token,action:'generate',brief:brief(),async:true},{fetchImpl:async()=>({ok:false,status:500,async json(){return {};}})});
  const s1=await waitDone(down[1].jobId); assert.equal(s1.httpStatus,503); assert.match(s1.result.error,/אינו זמין/);
  const bad=generated(); bad.learningGuide.learnBefore=[];
  const invalid=await studioRequest(store,{token,action:'generate',brief:brief(),async:true},{fetchImpl:async()=>response(bad)});
  const s2=await waitDone(invalid[1].jobId); assert.equal(s2.httpStatus,422); assert.match(s2.result.error,/מדריך הלמידה/);
  const thrown=await studioRequest(store,{token,action:'generate',brief:brief(),async:true},{fetchImpl:async()=>{throw Error('network');}});
  const s3=await waitDone(thrown[1].jobId); assert.equal(s3.httpStatus,503);
}));

test('one login can run at most three model jobs at once', () => withKey(async () => {
  const {store,token}=await signed('MANY-789');
  const g=gate(); const fetchImpl=async()=>{await g.p;return response(generated());};
  for(let i=0;i<3;i++) assert.ok((await studioRequest(store,{token,action:'generate',brief:brief(),async:true},{fetchImpl}))[1].jobId);
  const [status,out]=await studioRequest(store,{token,action:'generate',brief:brief(),async:true},{fetchImpl});
  assert.equal(status,429); assert.match(out.error,/כמה בקשות/);
  g.open(); await tick(); await tick();
  assert.ok((await studioRequest(store,{token,action:'generate',brief:brief(),async:true},{fetchImpl:async()=>response(generated())}))[1].jobId);
}));
