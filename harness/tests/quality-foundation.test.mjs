import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createPracticeServer} from '../practice-server.mjs';
import {createAtomicMemoryStore,handleAccess} from '../lib/access.mjs';
import {handleArtifacts} from '../lib/activity-artifact.mjs';

const fixture=JSON.parse(readFileSync(new URL('../fixtures/baseline-cases.json',import.meta.url))).cases[0];
const principal={ownerId:'fixture-owner',tenantId:'fixture-tenant',permissions:['fac_trainee']};
const content=()=>({kind:'narrative',pipelineOutput:structuredClone(fixture.scenario),context:structuredClone(fixture.input),purpose:'מטרה סינתטית',
  resilienceComponents:['שייכות'],individualSkills:['הקשבה'],sharedSkills:['בחירה'],facilitatorGuide:'פותחים בהצעה להשתתף ושואלים שאלה.',
  socialMechanism:'טרם נבחר; נברר עם הקבוצה מה מתאים.',steps:[{id:'first',title:'פתיחה',instructions:'שואלים את המשתתפים מה מתאים.',minutes:5}]});
async function http(t,provider,options={}) {
  const store=createAtomicMemoryStore({institutions:[{name:'Fixture',code:'111111',active:true}],'modules:Fixture':{fac_trainee:true,activity:true},
    'code:FIXTURE1':{code:'FIXTURE1',inst:'Fixture',kind:'staff',perms:['fac_trainee','activity']}});
  const [,session]=await handleAccess(store,{action:'login',kind:'code',secret:'FIXTURE1'});
  const server=createPracticeServer({store,providerFactory:()=>provider,sourceLibrary:fixture.sourceLibrary,...options});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{await server.waitForJobs();await new Promise(resolve=>server.close(resolve));});
  const post=async(path,body)=>{const res=await fetch('http://127.0.0.1:'+server.address().port+path,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+session.token},body:JSON.stringify(body)});return {status:res.status,body:await res.json()};};
  return {post,store,server};
}

test('the real four-stage pipeline fits its reserved budget and has one physical attempt per stage',async t=>{
  const requests=[];
  const provider={complete:async request=>{requests.push(request);return {status:'completed',
    text:requests.length===3?fixture.scenario.documents.trainee+'\n---\n'+fixture.scenario.documents.traineeStakes:JSON.stringify(fixture.scenario),usage:{inputTokens:500,outputTokens:500,totalTokens:1000}};}};
  const {post,store,server}=await http(t,provider);
  const started=await post('/api/pipeline',{async:true,requestId:'pipeline-contract',input:fixture.input});
  assert.equal(started.status,200);await server.waitForJobs();
  const completed=await post('/api/pipeline-status',{jobId:started.body.jobId});
  assert.equal(completed.body.status,'done',JSON.stringify({result:completed.body,calls:requests.length}));assert.equal(requests.length,4);
  assert.ok(requests.every(request=>request.maxAttempts===1&&request.maxTokens===32000));
  assert.equal((await store.list('aiq:'))[0].value.state,'committed');
});
test('a released reservation with a missing job never starts a new paid call under the old request ID',async t=>{
  let calls=0;const {post,store,server}=await http(t,{complete:async()=>{calls++;throw Error('synthetic failure');}});
  const body={async:true,requestId:'orphan-request',messages:[{role:'user',content:'synthetic'}]};
  const started=await post('/api/complete',body);await server.waitForJobs();assert.equal(calls,1);
  await store.del('pj:'+started.body.jobId);
  assert.equal((await post('/api/complete',body)).status,409);assert.equal(calls,1);
});
test('input costs reserve a conservative budget and oversized requests fail before provider access',async t=>{
  let calls=0;const {post,store,server}=await http(t,{complete:async()=>{calls++;return {status:'completed',text:'synthetic',usage:{inputTokens:25001,outputTokens:1}};}});
  const started=await post('/api/complete',{async:true,requestId:'large-request',messages:[{role:'user',content:'x'.repeat(100000)}],maxTokens:220});
  assert.equal(started.status,200);await server.waitForJobs();
  const records=await store.list('aiq:');assert.ok(records[0].value.tokenBudget>200000);assert.equal(calls,1);
  const denied=await post('/api/complete',{async:true,requestId:'too-large-request',messages:[{role:'user',content:'x'.repeat(300000)}],maxTokens:220});
  assert.equal(denied.status,413);assert.equal(calls,1);
});
test('a failed artifact review preserves the private draft and releases production instead of reporting done',async t=>{
  const {post,store,server}=await http(t,{complete:async()=>({status:'completed',text:'{}'})});
  const created=await post('/api/artifacts',{action:'create',content:content()});assert.equal(created.status,201);
  const started=await post('/api/artifacts',{action:'review',artifactId:created.body.artifact.id,expectedVersion:1,idempotencyKey:'failed-review',requestId:'failed-request',async:true});
  assert.equal(started.status,200);await server.waitForJobs();
  const result=await post('/api/pipeline-status',{jobId:started.body.jobId});assert.equal(result.body.status,'error');
  const draft=await post('/api/artifacts',{action:'get',artifactId:created.body.artifact.id});
  assert.equal(draft.body.artifact.version,1);assert.equal(draft.body.artifact.approvedVersions.length,0);
  assert.equal((await store.list('aiq:'))[0].value.state,'released');
});

test('lost durable jobs reconcile their artifact run and a retry cannot receive an abandoned response',async t=>{
  let release,started,calls=0;
  const ready=new Promise(resolve=>started=resolve),blocked=new Promise(resolve=>release=resolve);
  const provider={complete:async request=>{
    const input=JSON.parse(request.messages[0].content);calls++;
    const abandoned=calls===1;if(abandoned){started();await blocked;}
    return {status:'completed',text:JSON.stringify({artifactId:input.artifactId,baseVersion:input.baseVersion,
      changes:abandoned?[{path:'facilitatorGuide',value:'abandoned response'}]:[],rationale:'בדיקה סינתטית',sourceIds:[],unknowns:[],riskFlags:[]})};
  }};
  const {post,store,server}=await http(t,provider);
  const created=await post('/api/artifacts',{action:'create',content:content()}),id=created.body.artifact.id;
  const request={action:'review',artifactId:id,expectedVersion:1,idempotencyKey:'worker-loss',requestId:'worker-old-request',async:true};
  const old=await post('/api/artifacts',request);await ready;
  const jobKey='pj:'+old.body.jobId,job=await store.get(jobKey);
  assert.equal(job.artifactId,id);assert.equal(job.baseVersion,1);assert.match(job.reviewRunId,/^run-/);
  await store.set(jobKey,{...job,boot:'abandoned-boot',leaseUntil:Date.now()-1});
  assert.equal((await post('/api/pipeline-status',{jobId:old.body.jobId})).body.status,'lost');
  const recovered=await post('/api/artifacts',{action:'get',artifactId:id});
  assert.equal(Object.values(recovered.body.artifact.reviewRuns)[0].status,'lost');
  const retry=await post('/api/artifacts',{...request,retry:true,requestId:'worker-new-request'});
  let completed;
  for(let attempt=0;attempt<20;attempt++) {
    completed=await post('/api/pipeline-status',{jobId:retry.body.jobId});
    if(completed.body.status!=='running')break;
  }
  assert.equal(completed.body.status,'done');release();await server.waitForJobs();
  const final=await post('/api/artifacts',{action:'get',artifactId:id});
  assert.equal(final.body.artifact.version,1);assert.equal(final.body.artifact.proposals.length,1);
  assert.ok(!JSON.stringify(final.body.artifact.proposals).includes('abandoned response'));
  assert.equal((await post('/api/artifacts',{action:'approve',artifactId:id,expectedVersion:1})).status,200);
});

test('revocation during a team review stops synthesis and prevents late proposal persistence',async t=>{
  const waiting=[];let threeStarted;
  const ready=new Promise(resolve=>threeStarted=resolve),requests=[];
  const provider={complete:async request=>{
    const input=JSON.parse(request.messages[0].content);requests.push(input.agent);
    await new Promise(resolve=>{waiting.push(resolve);if(waiting.length===3)threeStarted();});
    return {status:'completed',text:JSON.stringify({artifactId:input.artifactId,baseVersion:input.baseVersion,
      changes:[],rationale:'late revoked proposal',sourceIds:[],unknowns:[],riskFlags:[]})};
  }};
  const {post,store,server}=await http(t,provider,{teamEnabled:true});
  const created=await post('/api/artifacts',{action:'create',content:content()}),id=created.body.artifact.id;
  const started=await post('/api/artifacts',{action:'review',artifactId:id,expectedVersion:1,idempotencyKey:'revoke-review',requestId:'revoke-job',async:true});
  await ready;const code=await store.get('code:FIXTURE1');await store.set('code:FIXTURE1',{...code,revoked:true});
  waiting.forEach(resolve=>resolve());await server.waitForJobs();
  assert.equal(requests.length,3);assert.ok(!requests.includes('synthesis'));
  const artifact=await store.get('artifact:'+id),job=await store.get('pj:'+started.body.jobId);
  assert.equal(artifact.proposals.length,0);assert.equal(artifact.version,1);
  assert.equal(Object.values(artifact.reviewRuns)[0].status,'failed');assert.equal(job.status,'error');
  assert.equal((await store.list('aiq:'))[0].value.state,'released');
  assert.equal((await post('/api/artifacts',{action:'get',artifactId:id})).status,403);
});
test('missing reviewers require explicit acknowledgment even when accepting an individual reviewer',async()=>{
  const store=createAtomicMemoryStore(),opts={sourceLibrary:fixture.sourceLibrary,teamEnabled:true};
  const [,created]=await handleArtifacts(store,principal,{action:'create',content:content()},opts);
  const provider={complete:async request=>{const input=JSON.parse(request.messages[0].content);if(input.agent==='safety_sources')throw Error('synthetic');
    return {status:'completed',text:JSON.stringify({artifactId:input.artifactId,baseVersion:input.baseVersion,changes:[],rationale:'בדיקה סינתטית',sourceIds:[],unknowns:[],riskFlags:[]})};}};
  const [,review]=await handleArtifacts(store,principal,{action:'review',artifactId:created.artifact.id,expectedVersion:1},{...opts,provider});
  const pedagogy=review.artifact.proposals.find(p=>p.agent==='pedagogy');
  const [,accepted]=await handleArtifacts(store,principal,{action:'decide',artifactId:created.artifact.id,expectedVersion:1,proposalId:pedagogy.id,decision:'accept'},opts);
  assert.equal(accepted.artifact.version,2);
  const approve={action:'approve',artifactId:created.artifact.id,expectedVersion:2};
  assert.equal((await handleArtifacts(store,principal,approve,opts))[0],422);
  const [,approved]=await handleArtifacts(store,principal,{...approve,acknowledgeRisks:true},opts);
  assert.ok(approved.artifact.approvedVersions[0].acknowledgedRisks.includes('missing_reviewers:safety_sources'));
});
test('private concern questions stay with the coaching role and cannot enter synthesis through flags',async()=>{
  const store=createAtomicMemoryStore(),opts={sourceLibrary:fixture.sourceLibrary,teamEnabled:true},secret='PRIVATE CONCERN 0501234567',seen=[];
  const [,created]=await handleArtifacts(store,principal,{action:'create',content:content(),privateConcerns:secret},opts);
  const provider={complete:async request=>{const input=JSON.parse(request.messages[0].content);seen.push(input);
    return {status:'completed',text:JSON.stringify({artifactId:input.artifactId,baseVersion:input.baseVersion,changes:[],rationale:'עידוד פרטי',sourceIds:[],unknowns:input.agent==='resilience_facilitation'?[secret]:[],riskFlags:[]})};}};
  const [,review]=await handleArtifacts(store,principal,{action:'review',artifactId:created.artifact.id,expectedVersion:1,requestType:'concern',question:secret},{...opts,provider});
  for(const envelope of seen)assert.equal(JSON.stringify(envelope).includes(secret),envelope.agent==='resilience_facilitation');
  assert.equal(review.review.results.resilience_facilitation.errorCode,'private_leak');
  assert.ok(!JSON.stringify(review.artifact.traces).includes(secret));
});
test('observation retries are idempotent and changing a submitted observation conflicts',async()=>{
  const store=createAtomicMemoryStore(),opts={sourceLibrary:fixture.sourceLibrary};
  const [,created]=await handleArtifacts(store,principal,{action:'create',content:content()},opts);
  await handleArtifacts(store,principal,{action:'approve',artifactId:created.artifact.id,expectedVersion:1},opts);
  const body={action:'observe',artifactId:created.artifact.id,version:1,submissionId:'observation-once',observation:'תצפית סינתטית',chosenNextStep:'בחירה סינתטית'};
  assert.equal((await handleArtifacts(store,principal,body,opts))[0],200);
  assert.equal((await handleArtifacts(store,principal,body,opts))[1].duplicate,true);
  assert.equal((await handleArtifacts(store,principal,{...body,observation:'changed'},opts))[0],409);
  const [,practice]=await handleArtifacts(store,principal,{action:'practice',artifactId:created.artifact.id,version:1},opts);assert.equal(practice.observations.length,1);
});
