import test from 'node:test';
import assert from 'node:assert/strict';
import * as access from '../lib/access.mjs';

export function fixtureStore(seed = {}) {
  const data = new Map(Object.entries(structuredClone(seed)));
  return { data, async get(k) { return structuredClone(data.get(k) ?? null); }, async set(k,v) { data.set(k,structuredClone(v)); },
    async del(k) { data.delete(k); }, async list(prefix,{keysOnly=false}={}) { return [...data].filter(([k])=>k.startsWith(prefix)).map(([key,value])=>keysOnly?{key}:{key,value:structuredClone(value)}); },
    async delPrefix(prefix) { for (const k of data.keys()) if(k.startsWith(prefix)) data.delete(k); } };
}
export const seed = () => ({ institutions:[{name:'Institution A',code:'123456',active:true},{name:'Institution B',code:'654321',active:true}],
  'modules:Institution A':{journey:true,fac_trainee:true,academic:true,studio:true}, 'modules:Institution B':{journey:true,fac_trainee:true,academic:true},
  'code:STAFFAAA':{code:'STAFFAAA',kind:'staff',inst:'Institution A',perms:['journey','fac_trainee','academic','studio'],revoked:false},
  'code-academic':{code:'OLDACADEMIC',createdAt:'2020-01-01T00:00:00Z'} });
export async function login(store,secret,kind='code') {
  const [status,result]=await access.handleAccess(store,{action:'login',kind,secret});assert.equal(status,200);return result.token;
}

test('F02: legacy institutions retain their own journeys and cannot read each other',async()=>{
  const store=fixtureStore(seed()), a=await login(store,'123456'), b=await login(store,'654321');
  const [created,j]=await access.handleAccess(store,{action:'jrCreate',token:a,unit:'school',unitName:'Private journey'});assert.equal(created,200);
  assert.equal((await access.handleAccess(store,{action:'jrGet',token:a,id:j.id}))[0],200);
  assert.equal((await access.handleAccess(store,{action:'jrGet',token:b,id:j.id}))[0],403);
  assert.equal((await access.handleAccess(store,{action:'jrMine',token:b}))[1].items.length,0);
});
test('F02: workshop tenant is server-derived; foreign legacy sessions cannot list or delete',async()=>{
  const store=access.createAtomicMemoryStore(seed()), a=await login(store,'123456'), b=await login(store,'654321');
  assert.equal((await access.handleAccess(store,{action:'wfOpen',token:a,w:'workshopaaa',inst:'Institution B'}))[0],200);
  assert.equal((await access.handleAccess(store,{action:'wfList',token:b}))[1].items.length,0);
  assert.equal((await access.handleAccess(store,{action:'wfDelete',token:b,w:'workshopaaa'}))[0],403);
  assert.equal((await access.handleAccess(store,{action:'wfDelete',token:a,w:'workshopaaa'}))[0],200);
});
test('F03: private actions revalidate revoked code, institution subscription and module ceiling',async()=>{
  for(const change of ['revoked','inactive','subscription','ceiling']) {
    const store=fixtureStore(seed()), token=await login(store,'STAFFAAA');
    const [,j]=await access.handleAccess(store,{action:'jrCreate',token,unitName:'Own journey'});
    if(change==='revoked') store.data.get('code:STAFFAAA').revoked=true;
    if(change==='inactive') store.data.get('institutions')[0].active=false;
    if(change==='subscription') store.data.get('institutions')[0].subEnd='2000-01-01';
    if(change==='ceiling') store.data.get('modules:Institution A').journey=false;
    assert.equal((await access.handleAccess(store,{action:'jrGet',token,id:j.id}))[0],403,change);
    if(change!=='ceiling') assert.equal((await access.handleAccess(store,{action:'wfOpen',token,w:'workshopaaa'}))[0],403,change);
  }
});
test('supported academic legacy entry has live academic authorization and code rotation revokes it',async()=>{
  const store=fixtureStore(seed());
  for(const kind of ['code','academic']) {
    const token=await login(store,'OLDACADEMIC',kind);
    assert.ok(await access.authorizePermission(store,token,['academic']));
    store.data.set('code-academic',{code:'NEWACADEMIC',createdAt:new Date().toISOString()});
    assert.equal(await access.authorizePermission(store,token,['academic']),null);
    store.data.set('code-academic',seed()['code-academic']);
  }
});
test('system password replacement revokes already signed administrator sessions',async()=>{
  const store=fixtureStore(seed()), token=await login(store,'990211','sys');
  assert.equal((await access.handleAccess(store,{action:'setPassword',token,kind:'sys',newPassword:'new-secret-password'}))[0],200);
  assert.equal((await access.handleAccess(store,{action:'listInstitutions',token}))[0],403);
});
test('public exceptions preserve certificates, questionnaires and workshop forms, while private reads need live entry',async()=>{
  const store=access.createAtomicMemoryStore({...seed(),
    'jr:journey1':{id:'journey1',unit:'school',unitName:'Certificate school',milestones:[{title:'Milestone',stage:2,status:'approved',cert:{code:'certificate-code',at:'2026-01-01'}}]},
    'wf:workshopaaa':{w:'workshopaaa',inst:'Institution A',owner:'LEGACY',entries:[]},'wfc:111111':{w:'workshopaaa',at:new Date().toISOString()},
    'resil:abcdefgh':{inst:'Institution A',cls:'Questionnaire',band:0,open:true} });
  for(const request of [{action:'jrCert',id:'journey1',code:'certificate-code'},{action:'wfJoin',code:'111111'},
    {action:'wfGet',w:'workshopaaa'},{action:'wfSubmit',w:'workshopaaa',role:'trainee',record:{}},
    {action:'resilInfo',id:'abcdefgh'},{action:'resilSubmit',id:'abcdefgh',v:0,k:'abcd',a:Array(62).fill(3)}]) {
    assert.equal((await access.handleAccess(store,request))[0],200,request.action);
  }
  for(const action of ['jrGet','jrMine','wfList','wfDelete','resilResults','critList','listGet','renewInstitutions','getModules','status']) {
    assert.equal((await access.handleAccess(store,{action,id:'journey1',w:'workshopaaa',inst:'Institution A',name:'writer-kind'}))[0],403,action);
  }
});
test('public renewal intake records a validated request and cannot grant or enumerate access',async()=>{
  const store=access.createAtomicMemoryStore(seed());
  assert.equal((await access.handleAccess(store,{action:'renewRequest',type:'new',fullName:'Synthetic person',instName:'Institution A',systems:['academic'],period:'year',email:'synthetic@example.invalid',phone:'0501234567'}))[0],200);
  assert.equal((await access.handleAccess(store,{action:'renewRequest',fullName:'Invalid',instName:'A',systems:['academic']}))[0],400);
  assert.equal((await access.handleAccess(store,{action:'renewInstitutions'}))[0],403);
  assert.equal((await access.handleAccess(store,{action:'renewCreateInst'}))[0],403);
  assert.equal((await store.list('code:')).length,1);
});
test('old legacy records with proven tenant remain accessible; unknown ownership never gets inferred',async()=>{
  const store=access.createAtomicMemoryStore({...seed(), 'jr:journey1':{id:'journey1',code:'LEGACY',inst:'Institution A',unitName:'Own old journey'},
    'jr:journey2':{id:'journey2',code:'LEGACY',unitName:'Unknown tenant'},'wf:workshopaaa':{w:'workshopaaa',owner:'',inst:'Institution A',entries:[]} });
  const token=await login(store,'123456','inst-code');
  assert.equal((await access.handleAccess(store,{action:'jrGet',token,id:'journey1'}))[0],200);
  assert.equal((await access.handleAccess(store,{action:'jrGet',token,id:'journey2'}))[0],403);
  assert.equal((await access.handleAccess(store,{action:'wfDelete',token,w:'workshopaaa'}))[0],200);
});
test('workshop participants have signed bounded roles, distinct owners, and live expiry/host revocation',async()=>{
  const store=access.createAtomicMemoryStore(seed()),host=await login(store,'STAFFAAA');
  assert.equal((await access.handleAccess(store,{action:'wfOpen',token:host,w:'workshopaaa',code:'111111'}))[0],200);
  const [,session]=await access.handleAccess(store,{action:'wfJoin',code:'111111',role:'parent',sid:'aaaaaaaaaaaaaaaa'});
  const [,other]=await access.handleAccess(store,{action:'wfJoin',code:'111111',role:'trainee',sid:'bbbbbbbbbbbbbbbb'});
  const p=await access.resolvePrincipal(store,session.token),q=await access.resolvePrincipal(store,other.token);
  assert.equal(p.tenantId,'Institution A');assert.notEqual(p.ownerId,q.ownerId);
  assert.deepEqual(p.permissions,['practice','conv']);assert.ok(q.permissions.includes('academic'));
  assert.ok(!JSON.stringify(p).includes(session.token));
  assert.equal(await access.authorizePermission(store,session.token,['journey','studio','fac_trainee']),null);
  store.data.get('code:STAFFAAA').revoked=true;
  assert.equal(await access.resolvePrincipal(store,session.token),null);
  store.data.get('code:STAFFAAA').revoked=false;
  store.data.get('wfc:111111').at='2000-01-01T00:00:00Z';
  assert.equal(await access.resolvePrincipal(store,session.token),null);
});
test('F04/F11: twenty reservations for a three-use code admit exactly three and commit once',async()=>{
  const store=access.createAtomicMemoryStore({...seed(),'code:STUDENT1':{code:'STUDENT1',kind:'student',inst:'Institution A',maxUses:3,uses:0}});
  const token=await login(store,'STUDENT1'),principal=await access.resolvePrincipal(store,token);
  const outcomes=await Promise.allSettled(Array.from({length:20},(_,n)=>access.reserveAIUsage(store,principal,{requestId:'request-'+n,maxTokens:220,requestHash:'content-'+n})));
  const accepted=outcomes.flatMap((r,n)=>r.status==='fulfilled'?[n]:[]);assert.equal(accepted.length,3);
  assert.equal((await store.get('code:STUDENT1')).uses,0,'reservation does not bill');
  for(const n of accepted) {
    const requestId='request-'+n;
    await access.settleAIUsage(store,principal,{requestId,outcome:'commit'});
    assert.equal((await access.settleAIUsage(store,principal,{requestId,outcome:'commit'})).duplicate,true);
  }
  assert.equal((await store.get('code:STUDENT1')).uses,3);
  assert.ok(await access.resolvePrincipal(store,token),'last successful result remains readable');
  await assert.rejects(access.reserveAIUsage(store,principal,{requestId:'over-limit',maxTokens:220}),e=>e.status===429);
});
test('release, expiry, idempotency conflict, token cap, and unsupported persistence fail safely',async()=>{
  const store=access.createAtomicMemoryStore(seed()),token=await login(store,'STAFFAAA'),p=await access.resolvePrincipal(store,token);
  const request={requestId:'same-request',maxTokens:100,tokenBudget:200,requestHash:'same'};
  await access.reserveAIUsage(store,p,request);
  assert.equal((await access.reserveAIUsage(store,p,request)).duplicate,true);
  await assert.rejects(access.reserveAIUsage(store,p,{...request,requestHash:'changed'}),e=>e.status===409);
  await access.settleAIUsage(store,p,{requestId:request.requestId,outcome:'release'});
  await assert.rejects(access.settleAIUsage(store,p,{requestId:request.requestId,outcome:'commit'}),e=>e.code==='reservation_closed');
  await assert.rejects(access.reserveAIUsage(store,p,{requestId:'too-large',maxTokens:500000}),e=>e.status===400);
  await assert.rejects(access.reserveAIUsage(store,p,{requestId:'too-large-budget',maxTokens:220,tokenBudget:600000}),e=>e.status===400);
  await access.reserveAIUsage(store,p,{requestId:'expired',maxTokens:100});
  const expired=[...store.data.values()].find(v=>v?.requestId==='expired');expired.expiresAt='2000-01-01T00:00:00Z';
  await access.reserveAIUsage(store,p,{requestId:'after-expiry',maxTokens:100});assert.equal(expired.state,'released');
  const unsupported=fixtureStore(seed()),u=await access.resolvePrincipal(unsupported,await login(unsupported,'STAFFAAA'));
  await assert.rejects(access.reserveAIUsage(unsupported,u,{requestId:'unsupported',maxTokens:220}),e=>e.code==='atomic_storage_required');
});
test('course seat reservations include pending students and failed generations return capacity',async()=>{
  const store=access.createAtomicMemoryStore({...seed(),'code:COURSEAA':{code:'COURSEAA',kind:'course',inst:'Institution A',seats:1,usesPer:2,taken:{},uses:0}});
  async function actor(sid) {const [,session]=await access.handleAccess(store,{action:'login',kind:'code',secret:'COURSEAA',sid});return access.resolvePrincipal(store,session.token);}
  const a=await actor('aaaaaaaaaaaaaaaa'),b=await actor('bbbbbbbbbbbbbbbb');
  await access.reserveAIUsage(store,a,{requestId:'a-first',maxTokens:100});
  await assert.rejects(access.reserveAIUsage(store,b,{requestId:'b-first',maxTokens:100}),e=>e.code==='full');
  await access.settleAIUsage(store,a,{requestId:'a-first',outcome:'release'});
  await access.reserveAIUsage(store,b,{requestId:'b-second',maxTokens:100});
  await access.settleAIUsage(store,b,{requestId:'b-second',outcome:'commit'});
  assert.deepEqual((await store.get('code:COURSEAA')).taken,{'bbbbbbbbbbbbbbbb':1});
});
test('durable job claim and finalization settle quota in the same atomic operation',async()=>{
  const store=access.createAtomicMemoryStore(seed()),p=await access.resolvePrincipal(store,await login(store,'STAFFAAA'));
  const record={ownerId:p.ownerId,tenantId:p.tenantId,status:'running',requestId:'job-request'};
  const claims=await Promise.all(Array.from({length:20},()=>store.putIfAbsent({key:'pj:job1',value:record})));
  assert.equal(claims.filter(r=>r.created).length,1);
  await access.reserveAIUsage(store,p,{requestId:'job-request',maxTokens:100});
  const finished=await store.finalizeAIJob({key:'pj:job1',expected:record,value:{...record,status:'done'},principal:p,requestId:'job-request',outcome:'commit'});
  assert.equal(finished.updated,true);assert.equal(finished.usage.state,'committed');
  assert.equal((await store.finalizeAIJob({key:'pj:job1',expected:record,value:{...record,status:'cancelled'},principal:p,requestId:'job-request',outcome:'release'})).updated,false);
  assert.equal((await store.get('pj:job1')).status,'done');
});
test('Supabase atomic operations use dedicated RPCs and a missing migration never falls back to read/write',async()=>{
  const calls=[];
  const store=access.supabaseStore('https://example.invalid','synthetic-service-key',{fetchImpl:async(url,options)=>{
    calls.push({url,input:JSON.parse(options.body)});return {ok:true,json:async()=>({created:true,updated:true,value:{},state:'reserved',duplicate:false})};
  }});
  await store.putIfAbsent({key:'pj:job1',value:{}});await store.compareAndSet({key:'pj:job1',expected:{},value:{status:'done'}});
  await store.atomicAppendWorkshop({workshopId:'workshopaaa',submissionId:'submission1',entry:{},maxEntries:400});
  await store.atomicReserveUsage({ownerId:'a',tenantId:'A',requestId:'job1'});await store.atomicSettleUsage({ownerId:'a',tenantId:'A',requestId:'job1',outcome:'release'});
  await store.finalizeAIJob({key:'pj:job1',principal:{ownerId:'a',tenantId:'A'},requestId:'job1'});
  assert.equal(calls.length,6);assert.ok(calls.every(c=>c.url.startsWith('https://example.invalid/rest/v1/rpc/be_good_')&&c.input.p_input));
  assert.ok(calls[3].input.p_input.reservationKey.startsWith('aiq:'));
  let failedCalls=0;
  const unavailable=access.supabaseStore('https://example.invalid','synthetic-service-key',{fetchImpl:async()=>{failedCalls++;return {ok:false,status:404};}});
  await assert.rejects(unavailable.atomicReserveUsage({ownerId:'a',tenantId:'A',requestId:'job1'}),e=>e.code==='atomic_storage_required');
  assert.equal(failedCalls,1);
});
test('workshop creation claims code and owner atomically across competing institutions',async()=>{
  const store=access.createAtomicMemoryStore(seed()),a=await login(store,'123456'),b=await login(store,'654321');
  const responses=await Promise.all([a,b].map((token,n)=>access.handleAccess(store,{action:'wfOpen',token,w:'workshopaaa',code:n?'222222':'111111'})));
  assert.deepEqual(responses.map(([status])=>status).sort(),[200,403]);
  assert.equal((await store.list('wfc:')).length,1);
  const ws=await store.get('wf:workshopaaa');assert.equal((await store.get('wfc:'+ws.code)).w,ws.w);
});
test('Supabase listings fetch all pages with a key cursor even when the server caps pages below 500',async()=>{
  const calls=[];
  const pages=[[{key:'code:A',value:1},{key:'code:B',value:2}],[{key:'code:C',value:3}],[]];
  const store=access.supabaseStore('https://example.invalid','synthetic-key',{fetchImpl:async(url)=>{calls.push(url);return {ok:true,json:async()=>pages.shift()};}});
  assert.deepEqual((await store.list('code:')).map(r=>r.value),[1,2,3]);
  assert.equal(calls.length,3);assert.ok(calls[1].includes('key=gt.code%3AB'));assert.ok(calls.every(url=>url.includes('limit=500')));
});
test('failed and expired attempts exhaust daily owner admission without consuming academic productions',async()=>{
  const store=access.createAtomicMemoryStore({...seed(),'code:STUDENT1':{code:'STUDENT1',kind:'student',inst:'Institution A',maxUses:3,uses:0}});
  const p=await access.resolvePrincipal(store,await login(store,'STUDENT1'));
  for(let n=0;n<access.AI_LIMITS.dailyRequests;n++) {
    const requestId='failure-'+n;
    await access.reserveAIUsage(store,p,{requestId,maxTokens:100});
    if(n===0) {
      const ledger=[...store.data.values()].find(v=>v?.requestId===requestId);ledger.expiresAt='2000-01-01T00:00:00Z';
    } else await access.settleAIUsage(store,p,{requestId,outcome:'release'});
  }
  await assert.rejects(access.reserveAIUsage(store,p,{requestId:'after-failure-cap',maxTokens:100}),e=>e.code==='quota_exceeded');
  assert.equal((await store.get('code:STUDENT1')).uses,0);
  assert.ok(await access.authorizePermission(store,p.token,['academic']));
});
test('released attempts retain conservative daily token budgets across new IDs',async()=>{
  const store=access.createAtomicMemoryStore(seed()),p=await access.resolvePrincipal(store,await login(store,'STAFFAAA'));
  for(let n=0;n<4;n++) {
    await access.reserveAIUsage(store,p,{requestId:'costly-failure-'+n,maxTokens:100,tokenBudget:250000});
    await access.settleAIUsage(store,p,{requestId:'costly-failure-'+n,outcome:'release'});
  }
  await assert.rejects(access.reserveAIUsage(store,p,{requestId:'after-token-cap',maxTokens:100}),e=>e.code==='quota_exceeded');
});
test('tenant daily admission retains released attempts across different owners',async()=>{
  const store=access.createAtomicMemoryStore(),now=new Date().toISOString();
  const args={tenantId:'synthetic-tenant',requestHash:'same',maxTokens:100,tokenBudget:100,now,expiresAt:new Date(Date.now()+60000).toISOString(),
    limits:{...access.AI_LIMITS,tenantDailyRequests:2},quota:null};
  for(const ownerId of ['synthetic-owner-a','synthetic-owner-b']) {
    await store.atomicReserveUsage({...args,ownerId,requestId:ownerId});
    await store.atomicSettleUsage({ownerId,tenantId:args.tenantId,requestId:ownerId,outcome:'release',now});
  }
  await assert.rejects(store.atomicReserveUsage({...args,ownerId:'synthetic-owner-c',requestId:'third-owner'}),e=>e.code==='quota_exceeded');
});
