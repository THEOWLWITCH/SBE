// Opt-in staging verification at the real PostgREST/PostgreSQL RPC boundary.
// This file is syntax-checked locally; it has not been run against a database.
import assert from 'node:assert/strict';
import { randomUUID,createHash } from 'node:crypto';
import { supabaseStore,AI_LIMITS } from '../../harness/lib/access.mjs';

if(process.env.BEGOOD_STAGING_ATOMIC_TEST!=='1') throw Error('Set BEGOOD_STAGING_ATOMIC_TEST=1 only for a dedicated staging database.');
const url=process.env.BEGOOD_STAGING_SUPABASE_URL,key=process.env.BEGOOD_STAGING_SERVICE_KEY;
if(!url||!key) throw Error('Dedicated staging URL and service key are required.');
const store=supabaseStore(url,key),run=randomUUID().replaceAll('-',''),ownerId='atomic-fixture:'+run,tenantId='atomic-fixture:'+run;
const codeKey='code:FIXTURE'+run.toUpperCase(),workshopId=run,jobKey='pj:fixture'+run;
const jobKeys=[jobKey];
const requests=Array.from({length:20},(_,n)=>'fixture-'+n),ledgerKey=id=>'aiq:'+createHash('sha256').update(ownerId+'\0'+id).digest('hex');
const reserve=requestId=>store.atomicReserveUsage({ownerId,tenantId,requestId,requestHash:requestId,maxTokens:220,tokenBudget:220,now:new Date().toISOString(),
  expiresAt:new Date(Date.now()+AI_LIMITS.reservationMs).toISOString(),limits:AI_LIMITS,quota:{kind:'student',codeKey,sid:null}});
const settle=(requestId,outcome)=>store.atomicSettleUsage({ownerId,tenantId,requestId,outcome,now:new Date().toISOString()});
try {
  await store.set(codeKey,{kind:'student',inst:tenantId,maxUses:3,uses:0,revoked:false});
  await store.set('wf:'+workshopId,{w:workshopId,ownerId,tenantId,entries:[]});
  const results=await Promise.allSettled(requests.map(reserve));
  const accepted=results.flatMap((r,n)=>r.status==='fulfilled'?[requests[n]]:[]);
  assert.equal(accepted.length,3,'20 separate RPC requests must admit exactly 3');
  assert.equal((await store.get(codeKey)).uses,0);
  for(const id of accepted) {await settle(id,'commit');assert.equal((await settle(id,'commit')).duplicate,true);}
  assert.equal((await store.get(codeKey)).uses,3);
  const feedback=Array.from({length:100},(_,n)=>({workshopId,submissionId:'submission-'+n,entry:{role:'trainee',ts:Date.now(),entry:{value:n}},maxEntries:400}));
  await Promise.all(feedback.map(args=>store.atomicAppendWorkshop(args)));
  await store.atomicAppendWorkshop(feedback[0]);
  assert.equal((await store.get('wf:'+workshopId)).entries.length,100);
  const running={ownerId,tenantId,status:'running'};
  const claims=await Promise.all(Array.from({length:20},()=>store.putIfAbsent({key:jobKey,value:running})));
  assert.equal(claims.filter(r=>r.created).length,1);
  const changes=await Promise.all(['first','second'].map(candidate=>store.compareAndSet({key:jobKey,expected:running,value:{...running,status:candidate}})));
  assert.equal(changes.filter(r=>r.updated).length,1);
  await store.set(codeKey,{...(await store.get(codeKey)),maxUses:6});
  const finalId='fixture-finalize',finalKey=jobKey+'-finalize';requests.push(finalId);jobKeys.push(finalKey);
  await reserve(finalId);
  const finalRunning={...running,requestId:finalId},finalDone={...finalRunning,status:'done',output:{text:'synthetic committed result'}};
  await store.putIfAbsent({key:finalKey,value:finalRunning});
  const finalize={key:finalKey,expected:finalRunning,value:finalDone,principal:{ownerId,tenantId},requestId:finalId,outcome:'commit'};
  const completions=await Promise.all(Array.from({length:20},()=>store.finalizeAIJob(finalize)));
  assert.equal(completions.filter(result=>result.updated).length,1,'20 terminal RPCs must commit one output and one quota use');
  assert.deepEqual(await store.get(finalKey),finalDone);assert.equal((await store.get(ledgerKey(finalId))).state,'committed');
  assert.equal((await store.get(codeKey)).uses,4);
  const failureId='fixture-finalize-failure',failureKey=jobKey+'-failure';requests.push(failureId);jobKeys.push(failureKey);
  await reserve(failureId);
  const failureRunning={...running,requestId:failureId};await store.putIfAbsent({key:failureKey,value:failureRunning});
  const failureFinal={key:failureKey,expected:failureRunning,value:{...failureRunning,status:'done'},principal:{ownerId,tenantId},requestId:failureId,outcome:'commit'};
  await assert.rejects(store.finalizeAIJob({...failureFinal,principal:{ownerId:'foreign-fixture',tenantId}}));
  await store.set(codeKey,{...(await store.get(codeKey)),revoked:true});
  await assert.rejects(store.finalizeAIJob(failureFinal));
  assert.deepEqual(await store.get(failureKey),failureRunning);assert.equal((await store.get(ledgerKey(failureId))).state,'reserved');
  assert.equal((await store.get(codeKey)).uses,4);
  assert.equal((await store.finalizeAIJob({...failureFinal,value:{...failureRunning,status:'error'},outcome:'release'})).updated,true);
  assert.equal((await store.get(failureKey)).status,'error');assert.equal((await store.get(ledgerKey(failureId))).state,'released');
  console.log('Staging RPC verification passed: quota 3/20, feedback 100/100, one claim/update, atomic finalization 1/20, foreign/revoked commit denied, failed job released.');
} finally {
  // Every removed key is generated above for this synthetic staging run.
  await Promise.allSettled([store.del(codeKey),store.del('wf:'+workshopId),...jobKeys.map(key=>store.del(key)),...requests.map(id=>store.del(ledgerKey(id)))]);
}
