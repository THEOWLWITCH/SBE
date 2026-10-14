import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createPracticeServer } from '../practice-server.mjs';
import { handleAccess } from '../lib/access.mjs';
import { createModelLimits } from '../lib/model-limits.mjs';
import { seedOwnerPassword, SYNTHETIC_OWNER_PASSWORD } from './synthetic-access.mjs';

function memoryStore(seed = {}) {
  const data = new Map(Object.entries(seed));
  return {data,async get(k){return data.get(k)||null;},async set(k,v){data.set(k,structuredClone(v));},async del(k){data.delete(k);},
    async list(prefix){return [...data].filter(([k])=>k.startsWith(prefix)).map(([key,value])=>({key,value}));}};
}
async function fixture() {
  const store=memoryStore({institutions:[{name:'School A',active:true}],
    'modules:School A':{writer:true,fac_trainee:true,studio:true},
    'code:TEST1234':{kind:'staff',inst:'School A',perms:['writer','fac_trainee','studio'],revoked:false},
    'code:OTHER123':{kind:'staff',inst:'School A',perms:['writer'],revoked:false}});
  const login = async code => (await handleAccess(store,{action:'login',kind:'code',secret:code}))[1].token;
  return {store,token:await login('TEST-1234'),other:await login('OTHER-123'),sameCode:await login('TEST-1234')};
}
async function serve(t, options) {
  const server=createPracticeServer(options);
  server.listen(0,'127.0.0.1'); await once(server,'listening');
  t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));
  return async (route,body) => {
    const response=await fetch(`http://127.0.0.1:${server.address().port}`+route,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
    assert.equal(response.headers.get('cache-control'),'private, no-store');
    return {status:response.status,body:await response.json(),headers:response.headers};
  };
}
const auth = (token,page='message-writer.html') => ({token,page});

test('missing auth storage and MODEL_AUTH=off block every model route before provider lookup',async t=>{
  const saved=Object.fromEntries(['SUPABASE_URL','SUPABASE_SERVICE_KEY','MODEL_AUTH'].map(k=>[k,process.env[k]]));
  let calls=0;
  try {
    delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_KEY; process.env.MODEL_AUTH='off';
    const post=await serve(t,{providerFactory:()=>{calls++;throw Error('provider must not run');}});
    for (const route of ['/api/complete','/api/character-turn','/api/pipeline','/api/pipeline-status','/api/studio','/api/backup-status'])
      assert.equal((await post(route,{system:'synthetic',jobId:'known-id',action:'generate'})).status,503,route);
    assert.equal(calls,0);
  } finally {for(const[k,v]of Object.entries(saved)){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
});

test('HTTP authorization rejects missing, forged, wrong-route and revoked access without provider calls',async t=>{
  const {store,token}=await fixture(); let calls=0;
  const post=await serve(t,{authStore:store,providerFactory:()=>{calls++;return{complete:async()=>({text:'synthetic'})};}});
  for (const _auth of [undefined,auth(token+'x'),auth(token,'activity-planner.html')])
    assert.equal((await post('/api/complete',{system:'synthetic',_auth})).status,401);
  assert.equal((await post('/api/pipeline',{input:{given:{}},_auth:auth(token)})).status,401);
  assert.equal((await post('/api/character-turn',{system:'synthetic',_auth:auth(token)})).status,401);
  store.data.get('code:TEST1234').revoked=true;
  assert.equal((await post('/api/complete',{system:'synthetic',_auth:auth(token)})).status,401);
  assert.equal(calls,0);
});

test('jobs survive a restart with ownership; another code/session cannot read; revocation prevents owner polling',async t=>{
  const {store,token,other,sameCode}=await fixture();
  assert.notEqual(token,sameCode,'two logins of one shared code are separate sessions');
  const post=await serve(t,{authStore:store,providerFactory:()=>({complete:async()=>({text:'private synthetic result'})})});
  const started=await post('/api/complete',{system:'synthetic',async:true,_auth:auth(token)});
  assert.equal(started.status,200);assert.ok(started.body.jobId);
  const poll = (token) => post('/api/pipeline-status',{jobId:started.body.jobId,_auth:auth(token)});
  assert.equal((await poll(other)).body.status,'unknown');
  assert.equal((await poll(sameCode)).body.status,'unknown');
  const owned=await poll(token); assert.equal(owned.body.text,'private synthetic result');
  const record=await store.get('pj:'+started.body.jobId);
  assert.ok(record.owner && record.page && record.route);
  assert.ok(!JSON.stringify(record).includes(token));
  const afterRestart=await serve(t,{authStore:store,providerFactory:()=>{throw Error('no model call');}});
  assert.equal((await afterRestart('/api/pipeline-status',{jobId:started.body.jobId,_auth:auth(token)})).body.text,'private synthetic result');
  store.data.get('code:TEST1234').revoked=true;
  assert.equal((await poll(token)).status,401);
  assert.equal((await afterRestart('/api/pipeline-status',{jobId:started.body.jobId,_auth:auth(token)})).status,401);
});

test('shared user/institution quotas block parallel requests, release on completion, and reject invalid config',async t=>{
  const {store,token,other}=await fixture(); let resolveProvider,calls=0;
  const limits=createModelLimits({env:{MODEL_USER_CONCURRENT:'1',MODEL_INSTITUTION_CONCURRENT:'1'}});
  const post=await serve(t,{authStore:store,limits,providerFactory:()=>({complete:()=>{calls++;return new Promise(resolve=>{resolveProvider=resolve;});}})});
  const first=await post('/api/complete',{system:'synthetic',async:true,_auth:auth(token)});
  try {
    assert.equal(first.status,200);
    assert.equal((await post('/api/complete',{system:'synthetic',_auth:auth(other)})).status,429);
    assert.equal((await post('/api/character-turn',{system:'synthetic',_auth:auth(token,'practice.html')})).status,429);
    assert.equal(calls,1);
  } finally {resolveProvider?.({text:'synthetic'});}
  await new Promise(resolve=>setImmediate(resolve));
  const invalid=await serve(t,{authStore:store,limits:createModelLimits({env:{MODEL_USER_RATE:'0'}}),providerFactory:()=>{calls++;throw Error('must not run');}});
  assert.equal((await invalid('/api/complete',{system:'synthetic',_auth:auth(token)})).status,503);
  assert.equal(calls,1);
});

test('owner password setup fails closed and replacing a configured password invalidates the old owner session',async()=>{
  const store=memoryStore();
  assert.equal((await handleAccess(store,{action:'login',kind:'sys',secret:SYNTHETIC_OWNER_PASSWORD}))[0],403);
  await seedOwnerPassword(store);
  const [,out]=await handleAccess(store,{action:'login',kind:'sys',secret:SYNTHETIC_OWNER_PASSWORD});
  const [status]=await handleAccess(store,{action:'setPassword',kind:'sys',token:out.token,newPassword:'different-synthetic-owner-password'});
  assert.equal(status,200);
  assert.equal((await handleAccess(store,{action:'status',token:out.token}))[0],403);
});
