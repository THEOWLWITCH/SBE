import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createResearchDatabase, token } from '../fixtures/research-database.mjs';
import { verifyToken } from '../lib/access.mjs';
import { createPracticeServer } from '../practice-server.mjs';
import { createModelLimits } from '../lib/model-limits.mjs';
import { accessFixture } from '../fixtures/research-scenarios.mjs';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';

const version = record => createHash('sha256').update(record.salt + ':' + record.hash).digest('hex');
test('research SQL and access authentication reject legacy and rotated owner credentials', async () => {
  const fixture = await createResearchDatabase();
  const password = {salt:'synthetic-owner-salt',hash:'synthetic-owner-hash'};
  const set = value => fixture.db.query('INSERT INTO public.access_settings VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value',['pw-sys',value]);
  const store = {async get(key) {return (await fixture.db.query('SELECT value FROM public.access_settings WHERE key=$1',[key])).rows[0]?.value || null;}};
  try {
    await set(password);
    const legacy = token({k:'sys'}), current = token({k:'sys',authVersion:version(password)});
    assert.equal(await verifyToken(store,legacy),null);
    assert.equal((await fixture.rpc(legacy,'bootstrap')).error,'unauthorized');
    assert.equal((await verifyToken(store,current)).k,'sys');
    assert.equal((await fixture.rpc(current,'bootstrap')).owner,true);
    const replacement = {...password,hash:'rotated-synthetic-hash'};
    await set(replacement);
    assert.equal(await verifyToken(store,current),null);
    assert.equal((await fixture.rpc(current,'bootstrap')).error,'unauthorized');
    const renewed = token({k:'sys',authVersion:version(replacement)});
    assert.equal((await fixture.rpc(renewed,'bootstrap')).owner,true);
    await fixture.db.query("DELETE FROM public.access_settings WHERE key='pw-sys'");
    assert.equal((await fixture.rpc(renewed,'bootstrap')).error,'unauthorized');
  } finally {await fixture.close();}
});

test('unified communication shares existing AI quota while non-AI drafts stay available', async () => {
  const f=accessFixture(), originalUrl=process.env.SUPABASE_URL, originalKey=process.env.SUPABASE_SERVICE_KEY;
  process.env.SUPABASE_URL='';process.env.SUPABASE_SERVICE_KEY='';
  f.store.rows.set('modules:Synthetic Institution',{writer:true});
  f.store.list=async(prefix)=>[...f.store.rows].filter(([key])=>key.startsWith(prefix)).map(([key,value])=>({key,value:structuredClone(value)}));
  f.store.compareSet=async(key,revision,value)=>{const current=f.store.rows.get(key);if(revision===null?!!current:current?.revision!==revision)return false;f.store.rows.set(key,structuredClone(value));return true;};
  const analysis=Object.fromEntries(['facts','interpretations','control','influence','outsideControl','responsibility','resources','barriers','agreements','openQuestions','followUp'].map(key=>[key,[]]));
  let calls=0;
  const provider={id:'synthetic',model:'synthetic-security-integration',async complete(){calls++;return {text:JSON.stringify({message:'נוסח סינתטי לבדיקה.',why:'בדיקה',next:'בדיקה',clarification:'',analysis})};}};
  const server=createPracticeServer({authStore:f.store,providerFactory:()=>provider,limits:createModelLimits({env:{MODEL_USER_RATE:'1'}})});
  try {
    server.listen(0,'127.0.0.1');await once(server,'listening');
    const post=async(path,body)=>{const response=await fetch('http://127.0.0.1:'+server.address().port+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});return {response,body:await response.json()};};
    const first=await post('/api/communication-continuity',{token:f.participant,action:'singleGenerate',requestId:randomUUID(),input:{text:'הודעה סינתטית',audience:'צוות'}});
    assert.equal(first.body.status,200,JSON.stringify(first.body));assert.equal(calls,1);
    const limited=await post('/api/complete',{system:'Synthetic test',messages:[{role:'user',content:'Synthetic input'}],_auth:{token:f.participant,page:'message-writer.html'}});
    assert.equal(limited.response.status,429);assert.equal(limited.body.code,'model_limit');assert.equal(calls,1);
    const denied=await post('/api/communication-continuity',{token:'invalid',action:'singleGenerate',requestId:randomUUID(),input:{text:'Synthetic input'}});
    assert.equal(denied.body.status,403);assert.equal(calls,1);
    const draft=await post('/api/communication-continuity',{token:f.participant,action:'create',id:randomUUID(),requestId:randomUUID(),expectedRevision:null});
    assert.equal(draft.body.status,200);assert.equal(calls,1);
  } finally {
    await new Promise(resolve=>server.close(resolve));
    if(originalUrl===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=originalUrl;
    if(originalKey===undefined)delete process.env.SUPABASE_SERVICE_KEY;else process.env.SUPABASE_SERVICE_KEY=originalKey;
  }
});
