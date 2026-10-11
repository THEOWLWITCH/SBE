import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createPracticeServer} from '../practice-server.mjs';
import {createAtomicMemoryStore,handleAccess,AI_LIMITS,resolvePrincipal,reserveAIUsage,settleAIUsage} from '../lib/access.mjs';

const studio=createRequire(import.meta.url)('../../app/lib/resilience-studio.js');
const brief=()=>studio.newBrief({startingPoint:'Synthetic team activity',goal:'Synthetic shared preparation',leaderRole:'מנחה',
  participants:'צוות',participantAge:'מבוגרים',count:5,duration:15,focus:'support'});
function kit() {
  const value=studio.exampleActivity(brief());
  for(const key of ['schemaVersion','catalogueVersion','evidenceStatus'])delete value[key];
  value.professionalBasis=[{sourceId:'IAFCompetencies2026',explanation:'Synthetic preparation'}];
  value.learningGuide.learnBefore=[{sourceId:'IAFCompetencies2026',focus:'Synthetic participation'}];
  value.clarificationQuestions=[];value.adaptationExplanation='Synthetic adaptation';return value;
}
const ready={ready:true,summary:'Synthetic clear instructions',issues:[]};
const consult={answer:'Synthetic answer',encouragement:'Synthetic encouragement',nextSteps:[],questions:[],suggestedInstructions:'',professionalBasis:[]};
const response=value=>({ok:true,json:async()=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(value)}]}]})});
const wireCharge=call=>Buffer.byteLength(call.body)+JSON.parse(call.body).max_output_tokens+2048;
function gate(){let open;const promise=new Promise(resolve=>{open=resolve;});return {promise,open};}

// Actual production listener and full public bank. Only the provider URL is
// intercepted; there is no replacement handler, quota service or source bank.
async function serving(t,respond,{clock=Date.now}={}) {
  const store=createAtomicMemoryStore({institutions:[{name:'Synthetic Quota',code:'222222',active:true}],
    'modules:Synthetic Quota':{studio:true},
    'code:STUDIO222':{code:'STUDIO222',kind:'staff',inst:'Synthetic Quota',perms:['studio'],revoked:false}});
  const [status,login]=await handleAccess(store,{action:'login',kind:'code',secret:'STUDIO222'});assert.equal(status,200);
  const original={fetch:globalThis.fetch,key:process.env.OPENAI_API_KEY,review:process.env.STUDIO_CUSTOMER_REVIEW};
  process.env.OPENAI_API_KEY='synthetic-quota-key';delete process.env.STUDIO_CUSTOMER_REVIEW;
  const calls=[];
  globalThis.fetch=(url,options)=>{
    if(url!=='https://api.openai.com/v1/responses')return original.fetch(url,options);
    calls.push({body:options.body,signal:options.signal});
    return respond(JSON.parse(options.body),options,calls.length,store);
  };
  const server=createPracticeServer({store,clock});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{
    try{await new Promise(resolve=>server.close(resolve));await server.waitForJobs();}
    finally{globalThis.fetch=original.fetch;for(const [name,value] of [['OPENAI_API_KEY',original.key],['STUDIO_CUSTOMER_REVIEW',original.review]])
      if(value===undefined)delete process.env[name];else process.env[name]=value;}
  });
  const post=async(path,body)=>{const r=await original.fetch('http://127.0.0.1:'+server.address().port+path,{method:'POST',
    headers:{'content-type':'application/json',authorization:'Bearer '+login.token},body:JSON.stringify(body)});return {status:r.status,body:await r.json()};};
  const run=async(action,requestId,extra={})=>{
    const start=await post('/api/studio',{action,brief:brief(),async:true,requestId,...extra});
    if(start.status!==200)return start;
    await server.waitForJobs();return post('/api/studio',{action:'status',jobId:start.body.jobId});
  };
  return {store,server,post,run,calls,login};
}
const normal=request=>response(request.text.format.name==='studio_focus'?{focus:'support',rationale:'Synthetic rationale',alternatives:['trust'],questions:[]}:
  request.text.format.name==='studio_consultation'?consult:request.text.format.name==='customer_review'?ready:kit());

test('Full-bank analysis, kit and two meaningful consultations fit daily quota; a third is denied before dispatch',async t=>{
  const f=await serving(t,normal);
  const analysis=await f.run('analyze','quota-flow-analysis');assert.equal(analysis.body.httpStatus,200,JSON.stringify(analysis));
  const generated=await f.run('generate','quota-flow-generation');assert.equal(generated.body.httpStatus,200,JSON.stringify(generated));
  const history=[];
  for(let n=1;n<=2;n++) {
    const extra={stage:'starting',question:'How can we improve our shared activity?',previous:generated.body.result.activity,history:[...history]};
    const turn=await f.run('consult','quota-flow-consult-'+n,extra);assert.equal(turn.body.httpStatus,200,JSON.stringify(turn));
    const sent=JSON.parse(JSON.parse(f.calls.at(-1).body).input[0].content[0].text);
    assert.equal(sent.previous.title,generated.body.result.activity.title);
    assert.deepEqual(sent.previous.sessions,generated.body.result.activity.sessions);
    assert.deepEqual(sent.history,history);
    assert.ok(!Object.hasOwn(sent.previous,'evidenceStatus'),'consultation sends the normalized domain projection');
    history.push({role:'user',text:extra.question},{role:'assistant',text:turn.body.result.consultation.answer});
  }
  const before=f.calls.length;
  const denied=await f.run('consult','quota-flow-consult-3',{stage:'starting',question:'How can we improve our shared activity?',previous:generated.body.result.activity,history});
  assert.equal(denied.status,429);assert.equal(denied.body.code,'quota_exceeded');assert.equal(f.calls.length,before);
  const rows=await f.store.list('aiq:');assert.equal(rows.length,f.calls.length);
  const charged=rows.reduce((sum,row)=>sum+row.value.tokenBudget,0);
  assert.equal(charged,f.calls.reduce((sum,call)=>sum+wireCharge(call),0));assert.ok(charged<=1000000);
  assert.equal(AI_LIMITS.dailyTokens,1000000);assert.equal(AI_LIMITS.maxTokenBudget,512000);
  const auxiliary=rows.filter(row=>row.value.requestId.includes('.studio.'));
  assert.equal(auxiliary.length,1);assert.equal(auxiliary[0].value.state,'released');
});

test('Invalid and oversized Studio requests consume no reservations and make no provider calls',async t=>{
  const f=await serving(t,normal);
  const invalid=await f.post('/api/studio',{action:'generate',brief:{},async:true,requestId:'quota-invalid-request'});
  assert.equal(invalid.status,422);
  const large=brief();large.sources=[{name:'Synthetic oversized context',content:'x'.repeat(550000)}];
  const oversized=await f.post('/api/studio',{action:'generate',brief:large,async:true,requestId:'quota-oversized-request'});
  assert.equal(oversized.status,413);assert.equal(f.calls.length,0);assert.deepEqual(await f.store.list('aiq:'),[]);assert.deepEqual(await f.store.list('pj:'),[]);
  assert.equal((await f.run('generate','quota-after-invalid')).body.httpStatus,200);
});

test('Failed auxiliary provider calls keep their daily charge; duplicate root requests never replay them',async t=>{
  const f=await serving(t,request=>request.text.format.name==='customer_review'?{ok:false,json:async()=>({})}:normal(request));
  const body={action:'generate',brief:brief(),async:true,requestId:'quota-failed-customer'};
  const start=await f.post('/api/studio',body);assert.equal(start.status,200);await f.server.waitForJobs();
  const result=await f.post('/api/studio',{action:'status',jobId:start.body.jobId});assert.equal(result.body.httpStatus,200);assert.ok(result.body.result.activity);
  assert.ok(!result.body.result.customerReview);assert.equal(f.calls.length,2);
  const prior=await f.store.list('aiq:');assert.equal(prior.length,2);assert.equal(prior.reduce((sum,row)=>sum+row.value.tokenBudget,0),f.calls.reduce((sum,call)=>sum+wireCharge(call),0));
  assert.equal(prior.find(row=>row.value.requestId.includes('.studio.')).value.state,'released');
  const duplicate=await f.post('/api/studio',body);assert.equal(duplicate.status,200);assert.equal(duplicate.body.jobId,start.body.jobId);
  assert.equal(f.calls.length,2);assert.deepEqual(await f.store.list('aiq:'),prior);
});

for(const stop of ['cancel','revoke'])test('Studio '+stop+' during child reservation prevents dispatch and releases the late reservation',{timeout:10000},async t=>{
  const f=await serving(t,normal),reached=gate(),late=gate(),released=gate();t.after(()=>late.open());
  const reserve=f.store.atomicReserveUsage.bind(f.store);
  const settle=f.store.atomicSettleUsage.bind(f.store);
  f.store.atomicSettleUsage=async args=>{const row=await settle(args);if(args.requestId.endsWith('.studio.2'))released.open();return row;};
  f.store.atomicReserveUsage=async args=>{
    if(args.requestId.endsWith('.studio.2')){reached.open();await late.promise;}
    return reserve(args);
  };
  const started=await f.post('/api/studio',{action:'generate',brief:brief(),async:true,requestId:'quota-pending-'+stop});assert.equal(started.status,200);
  await reached.promise;
  const pending=await f.store.get('pj:'+started.body.jobId);assert.deepEqual(pending.studioReservations,['quota-pending-'+stop+'.studio.2']);
  assert.equal((await f.store.list('aiq:')).length,1,'child ID is durable before reserve starts');
  if(stop==='cancel')assert.equal((await f.post('/api/pipeline-cancel',{jobId:started.body.jobId})).body.status,'cancelled');
  else {const code=await f.store.get('code:STUDIO222');await f.store.set('code:STUDIO222',{...code,revoked:true});}
  // Cancellation can finish the root while the storage request is pending.
  // Wait for the late reservation's own settlement acknowledgement.
  late.open();await released.promise;await f.server.waitForJobs();assert.equal(f.calls.length,1);
  const rows=await f.store.list('aiq:');assert.equal(rows.length,2);assert.ok(rows.every(row=>row.value.state==='released'));
  assert.equal(rows[0].value.tokenBudget,wireCharge(f.calls[0]));assert.ok(rows[1].value.tokenBudget>0,'late reserved attempt retains its daily charge');
  assert.equal((await f.store.get('pj:'+started.body.jobId)).status,stop==='cancel'?'cancelled':'error');
});

test('Cancellation closes the local dispatch gate before slow finalization storage returns',{timeout:10000},async t=>{
  const reached=gate(),lateProvider=gate(),finalizing=gate(),lateFinalize=gate();t.after(()=>{lateProvider.open();lateFinalize.open();});let heldSignal;
  const f=await serving(t,async(request,options)=>{
    if(request.text.format.name==='customer_review'){heldSignal=options.signal;reached.open();await lateProvider.promise;}
    return normal(request);
  });
  const finalize=f.store.finalizeAIJob.bind(f.store);
  f.store.finalizeAIJob=async args=>{finalizing.open();await lateFinalize.promise;return finalize(args);};
  const start=await f.post('/api/studio',{action:'generate',brief:brief(),async:true,requestId:'quota-slow-cancel'});await reached.promise;
  const cancelling=f.post('/api/pipeline-cancel',{jobId:start.body.jobId});await finalizing.promise;
  assert.equal(heldSignal.aborted,true);assert.equal(f.calls.length,2);lateFinalize.open();
  const result=await cancelling;assert.ok(['cancelled','error'].includes(result.body.status));await f.server.waitForJobs();
  assert.ok((await f.store.list('aiq:')).every(row=>row.value.state==='released'));lateProvider.open();
});

for(const recovery of ['lost','expired','terminal'])test('Durable '+recovery+' Studio jobs release orphan child capacity without replay',{timeout:10000},async t=>{
  let now=Date.now();const f=await serving(t,normal,{clock:()=>now}),reached=gate(),late=gate();t.after(()=>late.open());
  const reserve=f.store.atomicReserveUsage.bind(f.store);
  f.store.atomicReserveUsage=async args=>{
    const value=await reserve(args);
    if(args.requestId.endsWith('.studio.2')){reached.open();await late.promise;}
    return value;
  };
  const start=await f.post('/api/studio',{action:'generate',brief:brief(),async:true,requestId:'quota-orphan-'+recovery});await reached.promise;
  const key='pj:'+start.body.jobId,job=await f.store.get(key);assert.equal((await f.store.list('aiq:')).filter(row=>row.value.state==='reserved').length,2);
  if(recovery==='terminal')await f.store.finalizeAIJob({key,expected:job,value:{...job,status:'cancelled'},
    principal:{ownerId:job.ownerId,tenantId:job.tenantId},requestId:job.requestId,outcome:'release'});
  else await f.store.set(key,{...job,boot:'synthetic-stopped-process',leaseUntil:now-1,...(recovery==='expired'?{expiresAt:now-1}:{})});
  const status=await f.post('/api/studio',{action:'status',jobId:start.body.jobId});
  assert.equal(status.status,recovery==='expired'?410:200);assert.equal(status.body.status,recovery==='terminal'?'cancelled':recovery);
  assert.ok((await f.store.list('aiq:')).every(row=>row.value.state==='released'));assert.equal(f.calls.length,1);
  late.open();await f.server.waitForJobs();assert.equal(f.calls.length,1);
  assert.ok((await f.store.list('aiq:')).every(row=>row.value.tokenBudget>0&&row.value.state==='released'));
});

test('Terminal polling retries a failed child cleanup after atomic root finalization',{timeout:10000},async t=>{
  const reached=gate(),late=gate();t.after(()=>late.open());let cleanupUnavailable=true;
  const f=await serving(t,async(request,options)=>{
    if(request.text.format.name==='customer_review'){reached.open();await late.promise;}
    return normal(request);
  });
  const settle=f.store.atomicSettleUsage.bind(f.store);
  f.store.atomicSettleUsage=async args=>{if(args.requestId.endsWith('.studio.2')&&cleanupUnavailable)throw Error('Synthetic cleanup outage');return settle(args);};
  const start=await f.post('/api/studio',{action:'generate',brief:brief(),async:true,requestId:'quota-cleanup-retry'});await reached.promise;
  assert.equal((await f.post('/api/pipeline-cancel',{jobId:start.body.jobId})).body.status,'cancelled');await f.server.waitForJobs();
  assert.equal((await f.store.get('pj:'+start.body.jobId)).status,'cancelled');
  assert.equal((await f.store.list('aiq:')).find(row=>row.value.requestId.endsWith('.studio.2')).value.state,'reserved');
  cleanupUnavailable=false;const status=await f.post('/api/studio',{action:'status',jobId:start.body.jobId});assert.equal(status.body.status,'cancelled');
  assert.ok((await f.store.list('aiq:')).every(row=>row.value.state==='released'));assert.equal(f.calls.length,2);late.open();
});
test('daily allowance can admit a Studio kit but deny its optional customer review without losing the kit',async t=>{
  const f=await serving(t,normal),principal=await resolvePrincipal(f.store,f.login.token);
  // Completed prior attempts retain conservative daily charge. Use the same
  // production admission/settlement helpers, under unchanged per-call ceilings.
  for(let n=1;n<=2;n++) {
    const requestId='quota-prior-charge-'+n;
    await reserveAIUsage(f.store,principal,{requestId,maxTokens:1,tokenBudget:370000,requestHash:requestId});
    await settleAIUsage(f.store,principal,{requestId,outcome:'release'});
  }
  const started=await f.post('/api/studio',{action:'generate',brief:brief(),async:true,requestId:'quota-root-only'});
  assert.equal(started.status,200);await f.server.waitForJobs();
  const done=await f.post('/api/studio',{action:'status',jobId:started.body.jobId});
  assert.equal(done.body.httpStatus,200);assert.ok(done.body.result.activity);
  assert.equal(done.body.result.customerReview.ready,false);
  assert.ok(done.body.result.customerReview.issues.length);
  assert.equal(done.body.result.customerReview.revised,false);
  assert.equal(f.calls.length,1,'no customer or replacement fetch');
  const rows=await f.store.list('aiq:');assert.equal(rows.length,3);
  const root=rows.find(row=>row.value.requestId==='quota-root-only');assert.equal(root.value.state,'committed');
  assert.ok(rows.every(row=>row.value.state!=='reserved'));
  assert.ok(!rows.some(row=>row.value.requestId.includes('.studio.')),'denied child consumes no reservation');
  const repeated=await f.post('/api/studio',{action:'generate',brief:brief(),async:true,requestId:'quota-root-only'});
  assert.equal(repeated.body.jobId,started.body.jobId);assert.equal(f.calls.length,1);
});
