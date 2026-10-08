import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createAtomicMemoryStore } from '../lib/principal.mjs';
import { handleArtifacts } from '../lib/activity-artifact.mjs';
import { getProvider, ProviderError } from '../lib/providers.mjs';
import {agentEnvelope,validateProposal} from '../lib/agent-contract.mjs';
import { runAgentReview } from '../lib/agent-orchestrator.mjs';

const baseline = JSON.parse(readFileSync(new URL('../fixtures/baseline-cases.json', import.meta.url), 'utf8')).cases[0];
const principal = {ownerId:'fixture-user-a',tenantId:'fixture-tenant-a',permissions:['activity']};
const content = () => ({kind:'narrative',pipelineOutput:structuredClone(baseline.scenario),context:structuredClone(baseline.input),
  purpose:'תרגול בחירה בשיחה',resilienceComponents:['תקשורת ואמון'],individualSkills:['שאלה פתוחה'],sharedSkills:['בירור בחירה'],
  facilitatorGuide:'שיחה ביחידות, שאלה פתוחה וסיכום של הצעד שנבחר.',socialMechanism:'פעם בשבוע בודקים עם שותפה כיצד פעלה השיחה.',
  steps:[{id:'step-a',title:'פתיחה',instructions:'מציעים לבחור דרך להשתתף.',minutes:5}]});
const options = extra => ({sourceLibrary:baseline.sourceLibrary,...extra});
async function created(store,extra={}) {const [status,out]=await handleArtifacts(store,principal,{action:'create',content:content(),privateConcerns:'חשש פרטי סינתטי 0501234567',...extra},options());assert.equal(status,201);return out.artifact;}
function provider(log,{failRole,changes=[]}={}) {return {async complete(request) {
  const input=JSON.parse(request.messages[0].content);log.push(input);
  if(input.agent===failRole)throw Object.assign(new Error('Private error 0501234567'),{code:'timeout'});
  return {status:'completed',text:JSON.stringify({artifactId:input.artifactId,baseVersion:input.baseVersion,
    changes, rationale:'הצעה סינתטית לבדיקה אנושית.',sourceIds:['fixture-approved-source'],unknowns:[],riskFlags:[]})};
}};}

test('private versioned drafts enforce owner/tenant and fail closed without an atomic store',async()=>{
  const store=createAtomicMemoryStore(),a=await created(store);
  const [,out]=await handleArtifacts(store,principal,{action:'get',artifactId:a.id},options());
  assert.equal(out.artifact.version,1);assert.equal(out.artifact.status,'draft');
  for(const outsider of [{...principal,ownerId:'other'},{...principal,tenantId:'other'}]) {
    assert.equal((await handleArtifacts(store,outsider,{action:'get',artifactId:a.id},options()))[0],404);
  }
  assert.equal((await handleArtifacts({get:store.get,set:store.set},principal,{action:'create',content:content()},options()))[0],503);
});

test('gated artifacts preserve original renderer metadata through update and approved practice',async()=>{
  const store=createAtomicMemoryStore(),draft=content();
  const meta={id:'TR-original',institution:'בית ספר סינתטי',creator:'מנחה סינתטית',date:'07/10/26',duration:'45',age:'תיכון',audience:'צוות מורים'};
  draft.scenario={...meta,name:'untrusted override'};
  const a=await created(store,{content:draft});
  for(const [field,value] of Object.entries(meta))assert.equal(a.content.scenario[field],value);
  assert.notEqual(a.content.scenario.name,'untrusted override');
  const [,updated]=await handleArtifacts(store,principal,{action:'update',artifactId:a.id,expectedVersion:1,content:a.content},options());
  assert.equal((await handleArtifacts(store,principal,{action:'approve',artifactId:a.id,expectedVersion:2},options()))[0],200);
  const [,practice]=await handleArtifacts(store,principal,{action:'practice',artifactId:a.id,version:2},options());
  for(const [field,value] of Object.entries(meta))assert.equal(practice.content.scenario[field],value);
  assert.equal(updated.artifact.content.scenario.duration,'45');
});

test('three scoped reviewers and synthesis share one base; only facilitator receives concerns and all remain private proposals',async()=>{
  const store=createAtomicMemoryStore(),a=await created(store),log=[];
  const [status,out]=await handleArtifacts(store,principal,{action:'review',artifactId:a.id,expectedVersion:1,idempotencyKey:'review-one'},options({teamEnabled:true,provider:provider(log)}));
  assert.equal(status,200);assert.equal(log.length,4);assert.equal(out.artifact.version,1);
  assert.equal(out.artifact.status,'review_required');assert.equal(out.artifact.approvedVersions.length,0);
  assert.ok(log.every(r=>r.baseVersion===1&&r.runId===log[0].runId));
  for(const r of log) assert.equal(JSON.stringify(r).includes('0501234567'),r.agent==='resilience_facilitation');
  assert.ok(!JSON.stringify(out.artifact.traces).includes('0501234567'));
  assert.equal(out.artifact.proposals.length,4);
});

test('specialists receive distinct trusted responsibilities and traces hash the actual role prompts',async()=>{
  const store=createAtomicMemoryStore(),a=await created(store),systems=[],requests=[];
  const actual={complete:async request=>{systems.push(request.system);requests.push(JSON.parse(request.messages[0].content));return provider([]).complete(request);}};
  const [,out]=await handleArtifacts(store,principal,{action:'review',artifactId:a.id,expectedVersion:1,question:'UNTRUSTED ROLE OVERRIDE'},options({teamEnabled:true,provider:actual}));
  assert.equal(out.review.status,'complete');assert.equal(new Set(systems).size,4);
  assert.ok(systems.every(system=>!system.includes('UNTRUSTED ROLE OVERRIDE')));
  assert.ok(requests.every(request=>request.request.question==='UNTRUSTED ROLE OVERRIDE'));
  assert.equal(new Set(out.review.traces.map(trace=>trace.promptVersion)).size,4);
});

test('compact reviewers keep structured context but only readers of full prose may replace it',async()=>{
  const store=createAtomicMemoryStore(),a=await created(store);
  a.content.pipelineOutput.documents={facilitator:'full prose for privacy review'};
  const proposal={artifactId:a.id,baseVersion:a.version,changes:[{path:'pipelineOutput',value:a.content.pipelineOutput}],rationale:'synthetic review',sourceIds:[],unknowns:[],riskFlags:[]};
  for(const agent of ['pedagogy','resilience_facilitation','safety_sources','synthesis','single']) {
    const envelope=agentEnvelope(a,agent),compact=['pedagogy','resilience_facilitation'].includes(agent);
    assert.equal(Object.hasOwn(envelope.content.pipelineOutput,'documents'),!compact);
    assert.deepEqual(envelope.content.context,a.content.context);assert.deepEqual(envelope.content.steps,a.content.steps);
    assert.equal(envelope.allowedPaths.includes('pipelineOutput'),!compact);
    if(compact)assert.throws(()=>validateProposal(proposal,{artifact:a,agent}),{code:'agent_scope'});
    else assert.equal(validateProposal(proposal,{artifact:a,agent}).changes.length,1);
  }
  assert.equal(a.content.pipelineOutput.documents.facilitator,'full prose for privacy review');
});

test('partial reviewer failures persist valid candidates and retry only missing work',async()=>{
  const store=createAtomicMemoryStore(),a=await created(store),log=[];
  const body={action:'review',artifactId:a.id,expectedVersion:1,idempotencyKey:'partial'};
  const [status,out]=await handleArtifacts(store,principal,body,options({teamEnabled:true,provider:provider(log,{failRole:'resilience_facilitation'})}));
  assert.equal(status,200);assert.equal(out.review.status,'partial');
  assert.equal(out.artifact.proposals.filter(p=>p.agent!=='synthesis').length,2);
  assert.ok(out.review.proposal.riskFlags.includes('missing_reviewers:resilience_facilitation'));
  const retryLog=[];
  const [,retry]=await handleArtifacts(store,principal,{...body,retry:true},options({teamEnabled:true,provider:provider(retryLog)}));
  assert.deepEqual(retryLog.map(x=>x.agent),['resilience_facilitation','synthesis']);
  assert.equal(retry.artifact.proposals.filter(p=>p.agent!=='synthesis').length,3);
  const [,duplicate]=await handleArtifacts(store,principal,body,options({teamEnabled:true,provider:provider(retryLog)}));
  assert.equal(duplicate.duplicate,true);assert.equal(retryLog.length,2);
});

test('human accept creates a new version; stale decisions conflict and practice/observation use the approved snapshot',async()=>{
  const store=createAtomicMemoryStore(),a=await created(store),log=[];
  const [,review]=await handleArtifacts(store,principal,{action:'review',artifactId:a.id,expectedVersion:1,idempotencyKey:'edit'},options({provider:provider(log,{changes:[{path:'facilitatorGuide',value:'מדריך ערוך שנבחר בידי המחנכת.'}]})}));
  assert.equal(review.review.mode,'single');assert.equal(log.length,1);
  const proposalId=review.review.proposal.id;
  assert.equal((await handleArtifacts(store,principal,{action:'practice',artifactId:a.id,version:1},options()))[0],409);
  const [,accepted]=await handleArtifacts(store,principal,{action:'decide',artifactId:a.id,expectedVersion:1,proposalId,decision:'accept'},options());
  assert.equal(accepted.artifact.version,2);assert.equal(accepted.artifact.history[0].content.facilitatorGuide,content().facilitatorGuide);
  assert.equal((await handleArtifacts(store,principal,{action:'decide',artifactId:a.id,expectedVersion:1,proposalId,decision:'accept'},options()))[0],409);
  assert.equal((await handleArtifacts(store,principal,{action:'approve',artifactId:a.id,expectedVersion:2},options()))[0],200);
  assert.equal((await handleArtifacts(store,principal,{action:'practice',artifactId:a.id,version:1},options()))[0],409);
  const [,practice]=await handleArtifacts(store,principal,{action:'practice',artifactId:a.id,version:2},options());
  assert.equal(practice.content.facilitatorGuide,'מדריך ערוך שנבחר בידי המחנכת.');
  const observation={action:'observe',artifactId:a.id,version:2,observation:'שתי קבוצות ביקשו זמן.',chosenNextStep:'להוסיף זמן בפעם הבאה.'};
  assert.equal((await handleArtifacts(store,principal,observation,options()))[0],200);
  const [,reopened]=await handleArtifacts(store,principal,{action:'practice',artifactId:a.id,version:2},options());
  assert.equal(reopened.observations[0].chosenNextStep,observation.chosenNextStep);
  assert.ok(!JSON.stringify(practice).includes('0501234567'));
});

test('model cannot write approval/identity/locked context, cite unapproved sources, or accept an invalid artifact',async()=>{
  for(const changes of [[{path:'status',value:'approved'}],[{path:'context',value:{}}],[{path:'steps/step-missing/instructions',value:'late'}],[{path:'purpose',value:''}]]) {
    const store=createAtomicMemoryStore(),a=await created(store);
    const [status,out]=await handleArtifacts(store,principal,{action:'review',artifactId:a.id,expectedVersion:1},options({provider:provider([],{changes})}));
    assert.equal(status,200);assert.equal(out.review.status,'failed');assert.equal(out.artifact.proposals.length,0);
  }
  const store=createAtomicMemoryStore(),draft=content();delete draft.resilienceComponents;
  const a=await created(store,{content:draft});
  assert.equal((await handleArtifacts(store,principal,{action:'approve',artifactId:a.id,expectedVersion:1},options()))[0],422);
});

test('late review cannot overwrite an edit or reintroduce a removed step',async()=>{
  const store=createAtomicMemoryStore(),a=await created(store);let release,started;
  const ready=new Promise(r=>started=r),wait=new Promise(r=>release=r);
  const slow={async complete(request){started();await wait;return provider([],{changes:[{path:'steps/step-a/instructions',value:'מאוחר'}]}).complete(request);}};
  const reviewing=handleArtifacts(store,principal,{action:'review',artifactId:a.id,expectedVersion:1,idempotencyKey:'late'},options({provider:slow}));
  await ready;const edited=content();edited.steps=[];
  assert.equal((await handleArtifacts(store,principal,{action:'update',artifactId:a.id,expectedVersion:1,content:edited},options()))[0],200);
  release();const [,out]=await reviewing;assert.equal(out.artifact.version,2);assert.deepEqual(out.artifact.content.steps,[]);
  assert.equal((await handleArtifacts(store,principal,{action:'decide',artifactId:a.id,expectedVersion:2,proposalId:out.review.proposal.id,decision:'accept'},options()))[0],409);
});

test('timeouts bound a provider that ignores cancellation and never save its later result',async()=>{
  const store=createAtomicMemoryStore(),a=await created(store);let release;
  const blocked=new Promise(resolve=>release=resolve),log=[];
  const slow={async complete(request){log.push(request);await blocked;return provider([]).complete(request);}};
  const [status,out]=await handleArtifacts(store,principal,{action:'review',artifactId:a.id,expectedVersion:1,idempotencyKey:'timeout'},
    options({provider:slow,limits:{timeoutMs:20}}));
  assert.equal(status,200);assert.equal(out.review.status,'failed');assert.equal(out.artifact.proposals.length,0);
  assert.equal(out.review.results.single.status,'timeout');assert.equal(log.length,1);assert.equal(log[0].signal.aborted,true);
  release();await Promise.resolve();await Promise.resolve();
  const [,reopened]=await handleArtifacts(store,principal,{action:'get',artifactId:a.id},options());
  assert.equal(reopened.artifact.proposals.length,0);
});

test('explicit cancellation fences a result even when the adapter returns after abort',async()=>{
  const store=createAtomicMemoryStore(),a=await created(store),controller=new AbortController();let release,started;
  const ready=new Promise(resolve=>started=resolve),blocked=new Promise(resolve=>release=resolve);
  const late={async complete(request){started();await blocked;return provider([]).complete(request);}};
  const pending=handleArtifacts(store,principal,{action:'review',artifactId:a.id,expectedVersion:1,idempotencyKey:'cancel'},options({provider:late,signal:controller.signal}));
  await ready;controller.abort();const [status,out]=await pending;
  assert.equal(status,200);assert.equal(out.review.results.single.status,'cancelled');assert.equal(out.artifact.proposals.length,0);
  release();await Promise.resolve();
  assert.equal((await handleArtifacts(store,principal,{action:'approve',artifactId:a.id,expectedVersion:1},options()))[0],422);
  assert.equal((await handleArtifacts(store,principal,{action:'approve',artifactId:a.id,expectedVersion:1,acknowledgeRisks:true},options()))[0],200);
  // Approval is an explicit human operation, independent of a cancelled model result.
  const [,record]=await handleArtifacts(store,principal,{action:'get',artifactId:a.id},options());
  assert.equal(record.artifact.approvedVersions.length,1);assert.equal(record.artifact.proposals.length,0);
});

test('hard call/input/token ceilings reject excess work and never mark a proposal approved',async()=>{
  for(const [limits,expectedCalls] of [[{maxCalls:1},1],[{maxInputBytes:10},0]]) {
    const store=createAtomicMemoryStore(),a=await created(store),log=[];
    const [status,out]=await handleArtifacts(store,principal,{action:'review',artifactId:a.id,expectedVersion:1},options({teamEnabled:true,provider:provider(log),limits}));
    assert.equal(log.length,expectedCalls);
    if(limits.maxInputBytes){assert.equal(status,413);assert.equal(out.code,'review_input_too_large');continue;}
    assert.equal(status,200);assert.equal(out.review.status,'failed');
    assert.equal(out.artifact.approvedVersions.length,0);
    assert.ok(Object.values(out.review.results).some(r=>r.status==='budget_exceeded'));
  }
  const store=createAtomicMemoryStore(),a=await created(store);
  const costly={async complete(request){const response=await provider([]).complete(request);response.usage={inputTokens:5,outputTokens:2,totalTokens:7};return response;}};
  const [,out]=await handleArtifacts(store,principal,{action:'review',artifactId:a.id,expectedVersion:1},options({provider:costly,limits:{totalTokens:6}}));
  assert.equal(out.review.status,'failed');assert.equal(out.review.results.single.status,'budget_exceeded');assert.equal(out.artifact.proposals.length,0);
});

test('shipped-document-sized narrative reviews fit single and team bounds without hidden retries',async()=>{
  const edu=JSON.parse(readFileSync(new URL('../../app/products/data/edu.json',import.meta.url),'utf8'));
  const guidance=JSON.stringify(edu.facilitator);
  for(const teamEnabled of [false,true]) {
    const store=createAtomicMemoryStore(),draft=content(),log=[];
    draft.facilitatorGuide=guidance;
    const a=await created(store,{content:draft});
    const actual={complete:async request=>{const response=await provider(log).complete(request);response.usage={inputTokens:9000,outputTokens:40,totalTokens:9040};return response;}};
    const [status,out]=await handleArtifacts(store,principal,{action:'review',artifactId:a.id,expectedVersion:1},options({provider:actual,teamEnabled}));
    assert.equal(status,200);assert.equal(out.review.status,'complete');assert.equal(log.length,teamEnabled?4:1);
    assert.ok(Buffer.byteLength(JSON.stringify(log[0]))>16000);
    assert.ok(out.review.totalTokens<=100000);assert.equal(out.review.fallback,false);
  }
});

async function reservedTeam({usedTokens=9040,partialUsage=false,signal,limits={}}={}) {
  const store=createAtomicMemoryStore(),draft=content();
  draft.facilitatorGuide=JSON.stringify(JSON.parse(readFileSync(new URL('../../app/products/data/edu.json',import.meta.url),'utf8')).facilitator);
  const a=await created(store,{content:draft}),log=[],events=[];let active=0,spent=0,maxCommitted=0,release,ready;
  const blocked=new Promise(resolve=>release=resolve),firstTwo=new Promise(resolve=>ready=resolve);
  const actual={complete:async request=>{
    const input=JSON.parse(request.messages[0].content),reservation=Buffer.byteLength(request.messages[0].content)+Buffer.byteLength(request.system)+request.maxTokens+2048;
    active+=reservation;maxCommitted=Math.max(maxCommitted,active+spent);log.push(input.agent);events.push('start:'+input.agent);
    assert.equal(request.maxAttempts,1);assert.ok(active+spent<=100000,'physical work stays within outstanding reservations and spent tokens');
    if(log.length===2)ready();
    if(['pedagogy','resilience_facilitation'].includes(input.agent))await blocked;
    const response=await provider([]).complete(request);active-=reservation;spent+=partialUsage?reservation:usedTokens;events.push('settled:'+input.agent);
    response.usage=partialUsage?{inputTokens:null,outputTokens:40,totalTokens:null}:{inputTokens:usedTokens-40,outputTokens:40,totalTokens:usedTokens};return response;
  }};
  const pending=handleArtifacts(store,principal,{action:'review',artifactId:a.id,expectedVersion:1},options({provider:actual,teamEnabled:true,signal,limits}));
  return{pending,firstTwo,release,log,events,maxCommitted:()=>maxCommitted};
}

test('Reviewers wait for conservative reservations to settle instead of losing the queued safety review',async()=>{
  const run=await reservedTeam();
  await run.firstTwo;assert.deepEqual(run.log,['pedagogy','resilience_facilitation']);run.release();
  const [status,out]=await run.pending;assert.equal(status,200);assert.equal(out.review.status,'complete');
  assert.deepEqual(run.log,['pedagogy','resilience_facilitation','safety_sources','synthesis']);assert.ok(run.maxCommitted()<=100000);
  assert.ok(run.events.indexOf('start:safety_sources')>run.events.indexOf('settled:pedagogy'));assert.equal(out.review.totalTokens,4*9040);
});

test('Measured exhaustion after queued reviewers still blocks synthesis without an extra physical call',async()=>{
  const run=await reservedTeam({usedTokens:31000});await run.firstTwo;run.release();
  const [status,out]=await run.pending;assert.equal(status,200);assert.equal(out.review.status,'failed');
  assert.deepEqual(run.log,['pedagogy','resilience_facilitation','safety_sources']);assert.equal(out.review.results.synthesis.status,'budget_exceeded');
  assert.equal(out.review.totalTokens,93000);assert.ok(run.maxCommitted()<=100000);assert.equal(out.review.proposal,null);
});

test('Cancellation and the shared deadline stop queued reviewer dispatch when active adapters do not settle',async()=>{
  for(const action of ['cancel','timeout']){
    const controller=new AbortController(),run=await reservedTeam({signal:controller.signal,limits:{timeoutMs:200}});
    await run.firstTwo;if(action==='cancel')controller.abort();
    const [status,out]=await run.pending;run.release();assert.equal(status,200);assert.deepEqual(run.log,['pedagogy','resilience_facilitation']);
    assert.equal(out.review.results.safety_sources.status,action==='cancel'?'cancelled':'timeout');assert.equal(out.review.proposal,null);
    assert.equal(out.review.status,action==='cancel'?'cancelled':'failed');assert.equal(out.artifact.proposals.length,0);
  }
});

test('Partial token usage keeps whole reservations and cannot admit otherwise over-budget queued work',async()=>{
  const run=await reservedTeam({partialUsage:true});await run.firstTwo;run.release();
  const [status,out]=await run.pending;assert.equal(status,200);assert.equal(out.review.status,'failed');
  assert.deepEqual(run.log,['pedagogy','resilience_facilitation']);assert.equal(out.review.results.safety_sources.status,'budget_exceeded');
  assert.equal(out.review.results.synthesis.status,'budget_exceeded');assert.ok(out.review.totalTokens>60000);assert.ok(run.maxCommitted()<=100000);
});

test('Complete token measurements are charged while invalid counts and excessive output remain budget failures',async()=>{
  for(const [usage,expected] of [[{inputTokens:5,outputTokens:2,totalTokens:null},'complete'],[{inputTokens:null,outputTokens:2,totalTokens:7},'complete'],
    [{inputTokens:-1,outputTokens:2,totalTokens:7},'failed'],[{inputTokens:null,outputTokens:2401,totalTokens:2401},'failed'],
    [{inputTokens:5,outputTokens:2,totalTokens:3},'failed'],[{inputTokens:5,outputTokens:2,totalTokens:'7'},'failed']]){
    const store=createAtomicMemoryStore(),a=await created(store);
    const actual={complete:async request=>({...await provider([]).complete(request),usage})};
    const [,out]=await handleArtifacts(store,principal,{action:'review',artifactId:a.id,expectedVersion:1},options({provider:actual}));
    assert.equal(out.review.status,expected);if(expected==='complete')assert.equal(out.review.totalTokens,7);else assert.equal(out.review.results.single.status,'budget_exceeded');
  }
});

test('Aborting during a suspended ownership check prevents queued dispatch after that check resumes',async()=>{
  const store=createAtomicMemoryStore(),draft=content();draft.facilitatorGuide=JSON.stringify(JSON.parse(readFileSync(new URL('../../app/products/data/edu.json',import.meta.url),'utf8')).facilitator);
  const artifact=await created(store,{content:draft}),controller=new AbortController(),log=[];let checks=0,resume,parked,started,release;
  const currentGate=new Promise(resolve=>resume=resolve),parkedReady=new Promise(resolve=>parked=resolve),firstTwo=new Promise(resolve=>started=resolve),blocked=new Promise(resolve=>release=resolve);
  const actual={complete:async request=>{log.push(JSON.parse(request.messages[0].content).agent);if(log.length===2)started();await blocked;return provider([]).complete(request);}};
  const pending=runAgentReview({artifact,runId:'suspended-check',provider:actual,sourceLibrary:baseline.sourceLibrary,teamEnabled:true,signal:controller.signal,limits:{timeoutMs:200},
    validateCandidate:async()=>{},assertCurrent:async()=>{if(++checks===3){parked();await currentGate;}}});
  await Promise.all([firstTwo,parkedReady]);controller.abort();resume();const out=await pending;release();
  assert.deepEqual(log,['pedagogy','resilience_facilitation']);assert.equal(out.results.safety_sources.status,'cancelled');assert.equal(out.status,'cancelled');assert.equal(out.proposal,null);
});

test('a lost review lease can retry its base version and fences a response from the abandoned attempt',async()=>{
  const store=createAtomicMemoryStore(),a=await created(store);let time=Date.now(),release,started;
  const ready=new Promise(resolve=>started=resolve),blocked=new Promise(resolve=>release=resolve);
  const body={action:'review',artifactId:a.id,expectedVersion:1,idempotencyKey:'lost-run'};
  const oldProvider={complete:async request=>{started();await blocked;return provider([],{changes:[{path:'facilitatorGuide',value:'תגובה ישנה'}]}).complete(request);}};
  const oldAttempt=handleArtifacts(store,principal,body,options({provider:oldProvider,clock:()=>time}));
  await ready;time+=60000;
  const [,lost]=await handleArtifacts(store,principal,{action:'get',artifactId:a.id},options({clock:()=>time}));
  assert.equal(Object.values(lost.artifact.reviewRuns)[0].status,'lost');
  const [status,retried]=await handleArtifacts(store,principal,{...body,retry:true},options({provider:provider([]),clock:()=>time}));
  assert.equal(status,200);assert.equal(retried.review.status,'complete');assert.equal(retried.artifact.version,1);
  release();assert.equal((await oldAttempt)[0],409);
  const [,final]=await handleArtifacts(store,principal,{action:'get',artifactId:a.id},options({clock:()=>time}));
  assert.equal(final.artifact.proposals.length,1);assert.ok(!JSON.stringify(final.artifact.proposals).includes('תגובה ישנה'));
  assert.equal((await handleArtifacts(store,principal,{action:'approve',artifactId:a.id,expectedVersion:1},options({clock:()=>time})))[0],200);
});

test('locked goals and server-approved source IDs are checked before any candidate is stored',async()=>{
  const cases=[
    request=>{const input=JSON.parse(request.messages[0].content);return {artifactId:input.artifactId,baseVersion:input.baseVersion,changes:[{path:'purpose',value:'מטרה שונה'}],rationale:'שינוי',sourceIds:[],unknowns:[],riskFlags:[]};},
    request=>{const input=JSON.parse(request.messages[0].content);return {artifactId:input.artifactId,baseVersion:input.baseVersion,changes:[],rationale:'מקור',sourceIds:['user-unapproved-source'],unknowns:[],riskFlags:[]};},
    request=>{const input=JSON.parse(request.messages[0].content);const output=structuredClone(input.content.pipelineOutput);output.given.goals='שינוי סמוי';return {artifactId:input.artifactId,baseVersion:input.baseVersion,changes:[{path:'pipelineOutput',value:output}],rationale:'שינוי קלט נעול',sourceIds:[],unknowns:[],riskFlags:[]};},
  ];
  for(const response of cases) {
    const store=createAtomicMemoryStore(),a=await created(store);
    const malicious={async complete(request){return {status:'completed',text:JSON.stringify(response(request))};}};
    const [status,out]=await handleArtifacts(store,principal,{action:'review',artifactId:a.id,expectedVersion:1},options({provider:malicious}));
    assert.equal(status,200);assert.equal(out.review.status,'failed');assert.equal(out.artifact.proposals.length,0);
    assert.equal(out.artifact.content.purpose,content().purpose);
  }
});

test('two simultaneous human edits allow one commit and preserve the original content history',async()=>{
  const store=createAtomicMemoryStore(),a=await created(store),first=content(),second=content();
  first.facilitatorGuide='עריכה ראשונה';second.facilitatorGuide='עריכה שנייה';
  const results=await Promise.all([first,second].map(next=>handleArtifacts(store,principal,{action:'update',artifactId:a.id,expectedVersion:1,content:next},options())));
  assert.deepEqual(results.map(([status])=>status).sort(),[200,409]);
  const [,reopened]=await handleArtifacts(store,principal,{action:'get',artifactId:a.id},options());
  assert.equal(reopened.artifact.version,2);assert.equal(reopened.artifact.history.length,1);
  assert.equal(reopened.artifact.history[0].content.facilitatorGuide,content().facilitatorGuide);
  assert.ok(['עריכה ראשונה','עריכה שנייה'].includes(reopened.artifact.content.facilitatorGuide));
});

test('the real provider adapter cannot retry a reviewer behind the four-call budget',async()=>{
  const store=createAtomicMemoryStore(),a=await created(store),physicalCalls=[];
  const adapter=getProvider('openai',{apiKey:'synthetic-key',model:'gpt-4.1',retryDelayMs:0,transport:async({body})=>{
    const input=JSON.parse(body.input[0].content[0].text);physicalCalls.push(input.agent);
    if(input.agent==='resilience_facilitation')throw new ProviderError('Synthetic temporary error',{code:'transport',retryable:true});
    const proposal={artifactId:input.artifactId,baseVersion:input.baseVersion,changes:[],rationale:'בדיקה',sourceIds:['fixture-approved-source'],unknowns:[],riskFlags:[]};
    return {status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(proposal)}]}]};
  }});
  const [status,out]=await handleArtifacts(store,principal,{action:'review',artifactId:a.id,expectedVersion:1,idempotencyKey:'physical-calls'},options({teamEnabled:true,provider:adapter}));
  assert.equal(status,200);assert.equal(out.review.status,'partial');assert.equal(physicalCalls.length,4);
  assert.equal(physicalCalls.filter(role=>role==='resilience_facilitation').length,1);
});
