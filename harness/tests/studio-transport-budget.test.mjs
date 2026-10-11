import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createPracticeServer} from '../practice-server.mjs';
import {createAtomicMemoryStore,handleAccess,AI_LIMITS} from '../lib/access.mjs';
import {applyProductPolicy} from '../lib/providers.mjs';

const studio=createRequire(import.meta.url)('../../app/lib/resilience-studio.js');
const brief=()=>studio.newBrief({startingPoint:'Synthetic team activity',goal:'Synthetic shared preparation',leaderRole:'מנחה',
  participants:'צוות',participantAge:'מבוגרים',count:5,duration:15,focus:'support'});
function generated(b=brief()) {
  const activity=studio.exampleActivity(b);
  for(const key of ['schemaVersion','catalogueVersion','evidenceStatus'])delete activity[key];
  activity.professionalBasis=[{sourceId:'IAFCompetencies2026',explanation:'Synthetic facilitation preparation, not efficacy evidence'}];
  activity.learningGuide.learnBefore=[{sourceId:'IAFCompetencies2026',focus:'Synthetic preparation and participation'}];
  activity.clarificationQuestions=[];
  activity.adaptationExplanation='Synthetic explicit adaptation';
  return activity;
}
const ready={ready:true,summary:'Synthetic clear instructions',issues:[]};
const revise={ready:false,summary:'Synthetic clarification requested',issues:[{
  where:'Opening',quote:'Synthetic instruction',problem:'Synthetic ambiguity',fix:'Synthetic concrete instruction'}]};
const providerResponse=value=>({ok:true,json:async()=>({status:'completed',output:[{
  type:'message',content:[{type:'output_text',text:JSON.stringify(value)}]}]})});
const refusedResponse=value=>({ok:true,json:async()=>{
  const response=await providerResponse(value).json();
  response.output[0].content.unshift({type:'refusal',refusal:'Synthetic provider refusal'});
  return response;
}});
function gate() {let open;const promise=new Promise(resolve=>{open=resolve;});return {promise,open};}

// Intercept only the provider URL. Local requests use the real HTTP listener and
// the default handleStudio; no replacement Studio handler or source-bank stub.
async function serving(t,respond,{longTimers=false}={}) {
  const store=createAtomicMemoryStore({institutions:[{name:'Synthetic Studio',code:'111111',active:true}],
    'modules:Synthetic Studio':{studio:true},
    'code:STUDIO111':{code:'STUDIO111',kind:'staff',inst:'Synthetic Studio',perms:['studio'],revoked:false}});
  const [status,login]=await handleAccess(store,{action:'login',kind:'code',secret:'STUDIO111'});
  assert.equal(status,200);
  const original={fetch:globalThis.fetch,setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout,
    key:process.env.OPENAI_API_KEY,review:process.env.STUDIO_CUSTOMER_REVIEW};
  process.env.OPENAI_API_KEY='synthetic-test-key';delete process.env.STUDIO_CUSTOMER_REVIEW;
  const calls=[],timers=[];
  globalThis.fetch=(url,options)=>{
    if(url!=='https://api.openai.com/v1/responses')return original.fetch(url,options);
    const request=JSON.parse(options.body);
    calls.push({request,signal:options.signal});
    return respond(request,options,calls.length,{store});
  };
  if(longTimers) {
    globalThis.setTimeout=(callback,ms,...args)=>{
      if(ms<180000)return original.setTimeout(callback,ms,...args);
      const timer={ms,active:true,unref(){},fire(){if(this.active){this.active=false;callback(...args);}}};
      timers.push(timer);return timer;
    };
    globalThis.clearTimeout=timer=>{
      if(timers.includes(timer))timer.active=false;else original.clearTimeout(timer);
    };
  }
  const server=createPracticeServer({store,providerFactory:()=>{throw Error('Studio uses its Responses transport');}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{
    try {await new Promise(resolve=>server.close(resolve));await server.waitForJobs();}
    finally {
      globalThis.fetch=original.fetch;globalThis.setTimeout=original.setTimeout;globalThis.clearTimeout=original.clearTimeout;
      for(const [name,value] of [['OPENAI_API_KEY',original.key],['STUDIO_CUSTOMER_REVIEW',original.review]])
        if(value===undefined)delete process.env[name];else process.env[name]=value;
    }
  });
  const post=async(path,body,token=login.token)=>{
    const result=await original.fetch('http://127.0.0.1:'+server.address().port+path,{method:'POST',
      headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify(body)});
    return {status:result.status,body:await result.json()};
  };
  const start=async(action,extra={})=>{
    const response=await post('/api/studio',{action,brief:brief(),async:true,requestId:'synthetic-'+action,...extra});
    assert.equal(response.status,200,JSON.stringify(response.body));assert.ok(response.body.jobId);return response.body.jobId;
  };
  const done=async jobId=>{await server.waitForJobs();return (await post('/api/studio',{action:'status',jobId})).body;};
  return {store,server,calls,timers,post,start,done};
}

const bank={window:{}};
vm.runInNewContext(readFileSync(new URL('../../app/lib/resilience-advisor-sources.js',import.meta.url),'utf8'),bank);
const adultSourceIds=Array.from(bank.window.SBE_ADVISOR_SOURCES.list)
  .filter(source=>!source.hidden&&source.k!=='UnicefAdolescentKit2026').map(source=>source.k);
function sourcesIntact(request) {
  const input=JSON.parse(request.input[0].content[0].text);
  assert.deepEqual(input.professionalSources.map(source=>source.sourceId),adultSourceIds);
  assert.ok(input.professionalSources.every(source=>source.status==='existing-bank'&&source.version.startsWith('sha256:')));
  assert.ok(!JSON.stringify(request).includes('SadeTools2026'));
  assert.ok(!JSON.stringify(request).includes('SadeTrust2026'));
}
function outputCaps(calls) {
  for(const {request,signal} of calls) {
    assert.equal(request.max_output_tokens,request.text.format.name==='customer_review'?4000:16000);
    assert.equal(request.store,false);assert.equal(request.text.format.strict,true);assert.equal(signal.aborted,false);
  }
}
function reservedAmount(request) {
  return Buffer.byteLength(JSON.stringify({...request,system:applyProductPolicy(request.system||request.instructions)}))
    +request.max_output_tokens+2048;
}

for(const action of ['analyze','consult','generate','adapt'])test('Actual Studio '+action+' is admitted with the complete public bank and bounded output',async t=>{
  const result=action==='analyze'?{focus:'support',rationale:'Synthetic rationale',alternatives:['trust'],questions:[]}:
    action==='consult'?{answer:'Synthetic answer',encouragement:'Synthetic encouragement',nextSteps:[],questions:[],suggestedInstructions:'',professionalBasis:[]}:generated();
  const fixture=await serving(t,async request=>providerResponse(request.text.format.name==='customer_review'?ready:result));
  const jobId=await fixture.start(action,action==='consult'?{stage:'starting',question:'Synthetic question'}:
    action==='adapt'?{previous:studio.exampleActivity(brief())}:{});
  const done=await fixture.done(jobId);
  assert.equal(done.status,'done');assert.equal(done.httpStatus,200,JSON.stringify(done.result));
  const expectedBudget=['analyze','consult'].includes(action)?256000:512000;
  assert.equal((await fixture.store.get('pj:'+jobId)).tokenBudget,expectedBudget);
  assert.equal((await fixture.store.list('aiq:'))[0].value.tokenBudget,expectedBudget);
  assert.equal((await fixture.store.list('aiq:'))[0].value.state,'committed');
  assert.equal(AI_LIMITS.maxTokenBudget,512000);sourcesIntact(fixture.calls[0].request);outputCaps(fixture.calls);
  assert.ok(fixture.calls.reduce((sum,call)=>sum+reservedAmount(call.request),0)<=expectedBudget);
  assert.equal(fixture.calls.length,['generate','adapt'].includes(action)?2:1);
});

for(const repair of ['validation','customer'])test('Actual Studio '+repair+' repair remains inside its shared budget',async t=>{
  const bad=generated();bad.sessions[0].steps[0].minutes=0;let kits=0;
  const fixture=await serving(t,async request=>{
    if(request.text.format.name==='customer_review')return providerResponse(repair==='customer'?revise:ready);
    kits++;const result=repair==='validation'&&kits===1?bad:generated();
    if(kits>1)result.title='Synthetic repaired kit';return providerResponse(result);
  });
  const jobId=await fixture.start('generate'),done=await fixture.done(jobId);
  assert.equal(done.httpStatus,200,JSON.stringify(done.result));assert.equal(done.result.activity.title,'Synthetic repaired kit');
  assert.equal(done.result.customerReview.revised,repair==='customer');assert.equal(fixture.calls.length,3);
  outputCaps(fixture.calls);sourcesIntact(fixture.calls[0].request);
  sourcesIntact(fixture.calls.findLast(call=>call.request.text.format.name==='studio_activity').request);
  assert.ok(fixture.calls.reduce((sum,call)=>sum+reservedAmount(call.request),0)<=512000);
});

test('A second full repair is blocked before provider fetch; the validated kit and review remain explicit',async t=>{
  const bad=generated();bad.sessions[0].steps[0].minutes=0;let kits=0;
  const fixture=await serving(t,async request=>providerResponse(request.text.format.name==='customer_review'?revise:++kits===1?bad:generated()));
  const done=await fixture.done(await fixture.start('generate'));
  assert.equal(done.httpStatus,200);assert.equal(fixture.calls.length,3);
  assert.equal(done.result.customerReview.ready,false);assert.equal(done.result.customerReview.revised,false);
  assert.ok(done.result.activity);assert.equal((await fixture.store.list('aiq:'))[0].value.state,'committed');outputCaps(fixture.calls);
});

for(const stage of ['validation','customer','revision'])test('A mixed refusal and valid JSON during Studio '+stage+' never accepts refused output',async t=>{
  const original=generated();original.title='Synthetic original kit';
  const bad=generated();bad.sessions[0].steps[0].minutes=0;
  const refused=generated();refused.title='Synthetic refused replacement';
  const fixture=await serving(t,async(request,options,index)=>{
    if(stage==='validation')return index===1?providerResponse(bad):refusedResponse(refused);
    if(request.text.format.name==='customer_review')return stage==='customer'?refusedResponse(ready):providerResponse(revise);
    return index===1?providerResponse(original):refusedResponse(refused);
  });
  const done=await fixture.done(await fixture.start('generate'));
  if(stage==='validation') {
    assert.equal(done.httpStatus,422);assert.ok(!done.result.activity);assert.ok(!done.result.customerReview);
    assert.match(done.result.error,/משך שלב אינו תקין/);
    assert.equal((await fixture.store.list('aiq:'))[0].value.state,'released');
  } else {
    assert.equal(done.httpStatus,200);assert.equal(done.result.activity.title,original.title);
    if(stage==='customer')assert.ok(!done.result.customerReview,'a refused ready:true review is not reported');
    else {
      assert.equal(done.result.customerReview.ready,false);assert.equal(done.result.customerReview.revised,false);
      assert.deepEqual(done.result.customerReview.issues,revise.issues);
    }
    assert.equal((await fixture.store.list('aiq:'))[0].value.state,'committed');
  }
  assert.equal(fixture.calls.length,stage==='revision'?3:2);outputCaps(fixture.calls);
});

test('Oversized Studio input never reaches the provider; released reservations retain their daily allowance',async t=>{
  const fixture=await serving(t,async()=>{throw Error('Over-budget provider fetch');});
  const large=brief();large.sources=[{name:'Synthetic oversized context',content:'x'.repeat(550000)}];
  const done=await fixture.done(await fixture.start('generate',{brief:large}));
  assert.equal(done.httpStatus,503);assert.equal(fixture.calls.length,0);
  const usage=(await fixture.store.list('aiq:'))[0].value;assert.equal(usage.state,'released');assert.equal(usage.tokenBudget,512000);
  const retry=await fixture.post('/api/studio',{action:'generate',brief:brief(),async:true,requestId:'synthetic-second-generation'});
  assert.equal(retry.status,429);assert.equal(retry.body.code,'quota_exceeded');assert.equal(fixture.calls.length,0);
});

test('Current daily reservation limits deny consultation after analysis and a kit; no quota bypass is introduced',async t=>{
  const fixture=await serving(t,async request=>providerResponse(request.text.format.name==='customer_review'?ready:
    request.text.format.name==='studio_focus'?{focus:'support',rationale:'Synthetic rationale',alternatives:['trust'],questions:[]}:generated()));
  assert.equal((await fixture.done(await fixture.start('analyze'))).httpStatus,200);
  assert.equal((await fixture.done(await fixture.start('generate'))).httpStatus,200);
  const reservations=await fixture.store.list('aiq:');
  assert.equal(reservations.reduce((sum,row)=>sum+row.value.tokenBudget,0),768000);
  const consultation=await fixture.post('/api/studio',{action:'consult',brief:brief(),stage:'starting',
    question:'Synthetic follow-up',async:true,requestId:'synthetic-follow-up'});
  assert.equal(consultation.status,429);assert.equal(consultation.body.code,'quota_exceeded');
  assert.equal(fixture.calls.length,3);assert.equal(AI_LIMITS.dailyTokens,1000000);
});

for(const stage of ['validation','customer','revision'])test('Cancelling during Studio '+stage+' aborts the provider and stops queued calls',async t=>{
  const reached=gate(),late=gate();let heldSignal;const bad=generated();bad.sessions[0].steps[0].minutes=0;
  const fixture=await serving(t,async(request,options,index)=>{
    const hold=stage==='validation'?index===2:stage==='customer'?request.text.format.name==='customer_review':index===3;
    if(hold){heldSignal=options.signal;reached.open();await late.promise;return providerResponse(generated());}
    return providerResponse(request.text.format.name==='customer_review'?revise:stage==='validation'?bad:generated());
  });
  const jobId=await fixture.start('generate');await reached.promise;
  const cancelled=await fixture.post('/api/pipeline-cancel',{jobId});assert.equal(cancelled.body.status,'cancelled');
  assert.equal(heldSignal.aborted,true);
  await fixture.server.waitForJobs();
  assert.equal((await fixture.done(jobId)).status,'cancelled');assert.equal(fixture.calls.length,stage==='revision'?3:2);
  assert.equal((await fixture.store.list('aiq:'))[0].value.state,'released');
  late.open();await new Promise(resolve=>setImmediate(resolve));
  const final=await fixture.done(jobId);assert.equal(final.status,'cancelled');assert.ok(!final.result);
});

test('Live Studio revocation prevents subsequent provider calls and a completed result',async t=>{
  const fixture=await serving(t,async(request,options,index,{store})=>({ok:true,json:async()=>{
    const code=await store.get('code:STUDIO111');await store.set('code:STUDIO111',{...code,revoked:true});
    return providerResponse(generated()).json();
  }}));
  const jobId=await fixture.start('generate');await fixture.server.waitForJobs();
  assert.equal(fixture.calls.length,1);assert.equal((await fixture.store.get('pj:'+jobId)).status,'error');
  assert.equal((await fixture.store.list('aiq:'))[0].value.state,'released');
  assert.equal((await fixture.post('/api/studio',{action:'status',jobId})).status,403);
});

test('One eight-minute deadline terminates a stalled later stage and clears every long timer',async t=>{
  const reached=gate(),late=gate();let heldSignal;const bad=generated();bad.sessions[0].steps[0].minutes=0;
  const fixture=await serving(t,async(request,options,index)=>{
    if(request.text.format.name==='customer_review'){heldSignal=options.signal;reached.open();await late.promise;return providerResponse(revise);}
    return providerResponse(index===1?bad:generated());
  },{longTimers:true});
  const jobId=await fixture.start('generate');await reached.promise;
  const deadlines=fixture.timers.filter(timer=>timer.ms===8*60*1000);
  assert.equal(deadlines.length,1,'later stages reuse the original whole-job deadline');
  assert.ok(deadlines[0].ms<9*60*1000);deadlines[0].fire();
  await fixture.server.waitForJobs();assert.equal(heldSignal.aborted,true);
  const done=await fixture.done(jobId);assert.equal(done.status,'done');assert.equal(done.httpStatus,503);
  assert.equal(fixture.calls.length,3);assert.equal((await fixture.store.list('aiq:'))[0].value.state,'released');
  assert.ok(fixture.timers.every(timer=>!timer.active));
  late.open();await new Promise(resolve=>setImmediate(resolve));assert.equal(fixture.calls.length,3);
});

test('A customer attempt timeout can retain a validated kit while clearing the whole-job deadline',async t=>{
  const reached=gate(),late=gate();let heldSignal;
  const fixture=await serving(t,async(request,options)=>{
    if(request.text.format.name==='customer_review'){heldSignal=options.signal;reached.open();await late.promise;return providerResponse(ready);}
    return providerResponse(generated());
  },{longTimers:true});
  const jobId=await fixture.start('generate');await reached.promise;
  const attempt=fixture.timers.find(timer=>timer.ms===3*60*1000&&timer.active);assert.ok(attempt);attempt.fire();
  const done=await fixture.done(jobId);assert.equal(done.httpStatus,200);assert.ok(done.result.activity);assert.ok(!done.result.customerReview);
  assert.equal(heldSignal.aborted,true);assert.ok(fixture.timers.every(timer=>!timer.active));
  late.open();await new Promise(resolve=>setImmediate(resolve));assert.equal(fixture.calls.length,2);
});
