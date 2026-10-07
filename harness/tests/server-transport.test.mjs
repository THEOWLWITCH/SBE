import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createPracticeServer} from '../practice-server.mjs';
import {createAtomicMemoryStore,handleAccess} from '../lib/access.mjs';

async function account(perms=['activity']) {
  const store = createAtomicMemoryStore({institutions:[{name:'A',code:'111111',active:true},{name:'B',code:'222222',active:true}],
    'modules:A':Object.fromEntries(perms.map(p=>[p,true])), 'modules:B':{activity:true},
    'code:STAFF111':{code:'STAFF111',kind:'staff',inst:'A',perms,revoked:false},
    'code:STAFF222':{code:'STAFF222',kind:'staff',inst:'B',perms:['activity'],revoked:false}});
  const [,a]=await handleAccess(store,{action:'login',kind:'code',secret:'STAFF111'});
  const [,b]=await handleAccess(store,{action:'login',kind:'code',secret:'STAFF222'});
  assert.ok(a.token); assert.ok(b.token);
  return {store,a:a.token,b:b.token};
}

async function serving(t,options) {
  const server=createPracticeServer(options);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{await server.waitForJobs();await new Promise(resolve=>server.close(resolve));});
  const post=async(path,token,body)=>{
    const res=await fetch(`http://127.0.0.1:${server.address().port}${path}`,{method:'POST',
      headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify(body)});
    return {status:res.status,body:await res.json()};
  };
  return {server,post};
}

test('F01: every model and polling alias authenticates before provider access', async t => {
  let calls = 0;
  const data = new Map();
  const store = {get: async k => data.get(k), set: async (k,v) => data.set(k,v)};
  const server = createPracticeServer({store, providerFactory: () => {calls++; throw Error('must not run');}});
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  for (const path of ['/api/complete','/api/character-turn','/api/pipeline','/api/pipeline-status','/api/pipeline-cancel']) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({system:'synthetic',jobId:'fake',input:{given:{who:'synthetic'}},maxTokens:500000})
    });
    assert.equal(response.status,403,path);
  }
  assert.equal(calls,0);
});

test('owner/tenant, module and output bound checks survive valid login',async t=>{
  const {store,a,b}=await account(); let finish,calls=0;
  const {server,post}=await serving(t,{store,providerFactory:()=>({complete:()=>{calls++;return new Promise(resolve=>finish=resolve);}})});
  assert.equal((await post('/api/pipeline',a,{input:{given:{who:'x'}}})).status,403);
  assert.equal((await post('/api/character-turn',a,{messages:[{role:'user',content:'x'}]})).status,403);
  assert.equal((await post('/api/complete',a,{messages:[{role:'user',content:'x'}],maxTokens:500000})).status,400);
  const body={requestId:'request-001',async:true,messages:[{role:'user',content:'synthetic'}],maxTokens:100};
  const start=await post('/api/complete',a,body); assert.equal(start.status,200);
  const duplicate=await post('/api/complete',a,body);assert.equal(duplicate.body.jobId,start.body.jobId);assert.equal(calls,1);
  assert.equal((await post('/api/complete',a,{...body,messages:[{role:'user',content:'different'}]})).status,409);
  assert.equal((await post('/api/pipeline-status',b,{jobId:start.body.jobId})).status,404);
  assert.equal((await post('/api/pipeline-cancel',b,{jobId:start.body.jobId})).status,404);
  assert.equal((await post('/api/pipeline-cancel',a,{jobId:start.body.jobId})).body.status,'cancelled');
  finish({status:'completed',text:'late private response',toolCalls:[],usage:{outputTokens:1}});
  await server.waitForJobs();
  const cancelled=await post('/api/pipeline-status',a,{jobId:start.body.jobId});
  assert.equal(cancelled.body.status,'cancelled');assert.ok(!JSON.stringify(cancelled.body).includes('late private'));
});

test('successful async tool calls persist; expiry and revocation close polling',async t=>{
  const {store,a}=await account();let now=Date.now();
  const {server,post}=await serving(t,{store,clock:()=>now,jobTtlMs:1000,
    providerFactory:()=>({complete:async()=>({status:'completed',text:'',toolCalls:[{name:'report_turn',input:{spokenLine:'synthetic'}}],usage:{outputTokens:4}})})});
  const start=await post('/api/complete',a,{requestId:'request-002',async:true,messages:[{role:'user',content:'synthetic'}]});
  assert.equal(start.status,200);await server.waitForJobs();
  const done=await post('/api/pipeline-status',a,{jobId:start.body.jobId});assert.equal(done.body.status,'done');assert.equal(done.body.toolCalls[0].name,'report_turn');
  now+=2000;assert.equal((await post('/api/pipeline-status',a,{jobId:start.body.jobId})).status,410);
  const code=await store.get('code:STAFF111');await store.set('code:STAFF111',{...code,revoked:true});
  assert.equal((await post('/api/pipeline-status',a,{jobId:start.body.jobId})).status,403);
});

test('Studio terminal polling preserves its existing success and structured-error envelope',async t=>{
  const {store,a}=await account(['studio']);let outcome=[200,{activity:{title:'פעילות סינתטית'}}];
  const {server,post}=await serving(t,{store,studioHandler:async()=>outcome});
  for(const [requestId,status,result] of [
    ['studio-success',200,{activity:{title:'פעילות סינתטית'}}],
    ['studio-invalid',422,{error:'חסר מדריך הנחיה',code:'studio_invalid',details:['facilitatorGuide']}],
    ['studio-denied',403,{error:'אין הרשאה',code:'studio_forbidden'}]
  ]) {
    outcome=[status,result];const start=await post('/api/studio',a,{action:'generate',async:true,requestId});
    assert.equal(start.status,200);await server.waitForJobs();
    const done=await post('/api/studio',a,{action:'status',jobId:start.body.jobId});
    assert.equal(done.body.status,'done');assert.equal(done.body.httpStatus,status);assert.deepEqual(done.body.result,result);
    const alias=await post('/api/pipeline-status',a,{jobId:start.body.jobId});assert.deepEqual(alias.body,done.body);
  }
});

test('Transient terminal storage failure is retried without another provider call',async t=>{
  const {store,a}=await account(),finalize=store.finalizeAIJob.bind(store);let writes=0,calls=0;
  store.finalizeAIJob=async input=>{writes++;if(writes===1)throw Error('temporary storage outage');return finalize(input);};
  const {server,post}=await serving(t,{store,providerFactory:()=>({complete:async()=>{calls++;return {status:'completed',text:'kept completion',usage:{outputTokens:2}};}})});
  const start=await post('/api/complete',a,{async:true,requestId:'retry-final-write',messages:[{role:'user',content:'synthetic'}]});
  await server.waitForJobs();const done=await post('/api/pipeline-status',a,{jobId:start.body.jobId});
  assert.equal(done.body.status,'done');assert.equal(done.body.text,'kept completion');assert.equal(writes,2);assert.equal(calls,1);
  assert.equal((await store.list('aiq:'))[0].value.state,'committed');
});

test('The actual Studio browser client consumes server success and clarification responses',async t=>{
  const {store,a}=await account(['studio']);let outcome=[200,{consultation:{answer:'תשובה סינתטית'}}];
  const {server}=await serving(t,{store,studioHandler:async()=>outcome});
  const source=readFileSync(new URL('../../app/lib/resilience-studio-ui.js',import.meta.url),'utf8');
  const start=source.indexOf('  const MODEL_ACTIONS'),end=source.indexOf('  async function ensureAuthorized()',start);
  const state={brief:{focus:'שייכות'},confirmed:true};
  const context={state,API:'http://127.0.0.1:'+server.address().port+'/api/studio',token:()=>a,
    AbortController,Date,fetch,setTimeout:(fn,ms)=>setTimeout(fn,ms<10000?0:ms),clearTimeout,document:{hidden:false},
    $:()=>({checked:true,scrollIntoView(){}}),lockWorkspace(){},renderRecommendation(){},updateControls(){},persist(){}};
  const api=vm.runInNewContext('(function(){'+source.slice(start,end)+';return api;})()',context);
  assert.equal((await api({action:'consult',requestId:'actual-studio-client'})).consultation.answer,'תשובה סינתטית');
  outcome=[422,{error:'נדרשת הבהרה',questions:['מה גיל המשתתפים?'],focus:'שייכות'}];
  await assert.rejects(api({action:'generate',requestId:'actual-studio-clarify'}),/נדרשת הבהרה/);
  assert.deepEqual(Array.from(state.recommendation.questions),['מה גיל המשתתפים?']);assert.equal(state.confirmed,false);
});

test('A same-boot job without a local executor is reconciled after its lease expires',async t=>{
  const {store,a}=await account(),finalize=store.finalizeAIJob.bind(store);let unavailable=true,now=Date.now();
  store.finalizeAIJob=async input=>{if(unavailable)throw Error('storage unavailable');return finalize(input);};
  const {server,post}=await serving(t,{store,clock:()=>now,providerFactory:()=>({complete:async()=>({status:'completed',text:'lost write',usage:{outputTokens:2}})})});
  const start=await post('/api/complete',a,{async:true,requestId:'same-boot-orphan',messages:[{role:'user',content:'synthetic'}]});await server.waitForJobs();
  assert.equal((await store.get('pj:'+start.body.jobId)).status,'running');
  unavailable=false;now+=91000;
  assert.equal((await post('/api/pipeline-status',a,{jobId:start.body.jobId})).body.status,'lost');
  assert.equal((await store.get('pj:'+start.body.jobId)).status,'lost');assert.equal((await store.list('aiq:'))[0].value.state,'released');
});
