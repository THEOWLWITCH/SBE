// Real practice-server process + native HTTP adapters + unchanged SQL, synthetic only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { createResearchIntegration } from '../fixtures/research-integrated.mjs';

test('actual gateway keeps research private and scope-authorized through HTTP and PostgreSQL', {timeout:90000},async()=>{
  const f=await createResearchIntegration(); let child,db;
  const sentinel='private-http-research-sentinel';let logs='';
  try {
    const a=await f.seedStudy('Synthetic A'), b=await f.seedStudy('Synthetic B');
    db=createServer(async(req,res)=>{
      try {
        const url=new URL(req.url,'http://fixture.invalid');let raw='';for await(const chunk of req)raw+=chunk;
        let result=[];
        if(url.pathname==='/rest/v1/rpc/research_rpc') {
          const body=JSON.parse(raw);
          try {result=await f.researchStore.rpc(body.p_token,body.p_action,body.p_payload);}
          catch(e){result={error:e.code||'unavailable',status:e.status||503};}
        } else {
          const key=url.searchParams.get('key');
          if(req.method==='GET'&&key?.startsWith('eq.')){const value=await f.accessStore.get(key.slice(3));result=value==null?[]:[{value}];}
          else if(req.method==='GET'&&key?.startsWith('like.'))result=await f.accessStore.list(key.slice(5,-1));
          else if(req.method==='POST'){const row=JSON.parse(raw);await f.accessStore.set(row.key,row.value);result=[{key:row.key}];}
          else if(req.method==='PATCH'){const row=JSON.parse(raw),name=key.slice(3),revision=Number(url.searchParams.get('value->>revision')?.slice(3));result=await f.accessStore.compareSet(name,revision,row.value)?[{key:name}]:[];}
        }
        res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(result));
      } catch {res.writeHead(500,{'content-type':'application/json'});res.end('{"error":"synthetic_fixture"}');}
    });
    db.listen(0,'127.0.0.1');await once(db,'listening');
    const probe=createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
    child=spawn(process.execPath,[fileURLToPath(new URL('../practice-server.mjs',import.meta.url)),'--port',String(port)],{
      env:{...process.env,SUPABASE_URL:'http://127.0.0.1:'+db.address().port,SUPABASE_SERVICE_KEY:'sb_secret_synthetic_http_only',
        RESEARCH_CONTACT_KEY:f.contactKey,CORS_ORIGIN:f.siteOrigin,RESEND_API_KEY:'',ANTHROPIC_API_KEY:'',OPENAI_API_KEY:'',PROVIDER:'synthetic-unconfigured'},stdio:['ignore','pipe','pipe']});
    child.stdout.on('data',value=>{logs+=value;});child.stderr.on('data',value=>{logs+=value;});
    const base='http://127.0.0.1:'+port;
    let ready=false;for(let count=0;count<50;count++){try{ready=(await fetch(base+'/health')).ok;}catch{}if(ready)break;await delay(100);}assert.ok(ready,'local gateway unavailable: '+logs);
    const post=async(path,body)=>{const response=await fetch(base+path,{method:'POST',headers:{'content-type':'application/json',origin:f.siteOrigin},body:JSON.stringify(body)});return {response,body:await response.json()};};
    const api=(token,action,payload={})=>post('/api/research',{token,action,...payload});
    const owner=f.tokens.owner;
    const draft=await api(owner,'studyCreate',{requestId:randomUUID(),config:{title:'HTTP-created draft'}});
    assert.equal(draft.response.status,200);assert.equal(draft.body.study.status,'draft');
    assert.match(draft.response.headers.get('cache-control'),/private.*no-store/);assert.match(draft.response.headers.get('vary'),/origin/i);
    assert.equal(draft.response.headers.get('access-control-allow-origin'),f.siteOrigin);
    const assigned=await api(owner,'memberSet',{studyId:a.study.id,requestId:randomUUID(),expectedRevision:a.study.revision,code:f.codes.a,role:'researcher',permissions:['view_study','view_pseudonymized_data','export_data']});assert.equal(assigned.response.status,200);
    const landing=await api(f.tokens.a,'bootstrap');assert.deepEqual(landing.body.studies.map(study=>study.id),[a.study.id]);assert.ok(!JSON.stringify(landing.body).includes('Synthetic B'));
    const foreign=await api(f.tokens.a,'studyGet',{studyId:b.study.id}), unknown=await api(f.tokens.a,'studyGet',{studyId:randomUUID()});
    assert.equal(foreign.response.status,404);assert.deepEqual(foreign.body,unknown.body);assert.match(foreign.response.headers.get('cache-control'),/no-store/);
    for(const [action,payload] of [['exportData',{studyId:b.study.id,category:'surveys'}],['sampleGet',{studyId:b.study.id,sampleId:randomUUID()}]])assert.equal((await api(f.tokens.a,action,payload)).response.status,404);
    assert.equal((await api(f.tokens.a,'contactGet',{studyId:a.study.id,participantId:randomUUID()})).response.status,403);
    assert.equal((await api(f.tokens.ordinary,'studyCreate',{requestId:randomUUID(),config:{title:'not allowed'}})).response.status,403);
    assert.equal((await api(f.tokens.a,'recordUsage',{studyId:a.study.id})).response.status,400);
    const malformed=await fetch(base+'/api/research',{method:'POST',headers:{'content-type':'application/json'},body:'{'});assert.equal(malformed.status,400);assert.match(malformed.headers.get('cache-control'),/no-store/);
    const allowed=await api(f.tokens.a,'exportData',{studyId:a.study.id,category:'surveys'});assert.equal(allowed.response.status,200);assert.ok(allowed.body.dictionary);assert.ok(allowed.body.versions);assert.ok(!JSON.stringify(allowed.body).includes('code:'));
    const entered=await api(f.tokens.participant,'enroll',{requestId:randomUUID(),invite:a.invite.token,consentVersionId:a.consent.id,consents:{participate:true,usage:true,surveys:true},preferences:{},email:'http-participant@example.invalid'});assert.equal(entered.response.status,200);
    await f.runMail();const verification=f.mailRequests.at(-1).body.text.match(/#verify=([A-Za-z0-9_-]+)/)[1];
    const verified=await api(f.tokens.participant,'verifyEmail',{studyId:a.study.id,requestId:randomUUID(),verificationToken:verification});assert.equal(verified.response.status,200);
    const communicate=(token,body)=>post('/api/communication-continuity',{token,...body});
    const cid=randomUUID();const created=await communicate(f.tokens.participant,{action:'create',id:cid,requestId:randomUUID(),expectedRevision:null});assert.equal(created.body.ok,true);
    const incoming=await communicate(f.tokens.participant,{action:'append',id:cid,requestId:randomUUID(),expectedRevision:created.body.conversation.revision,kind:'received',text:sentinel});assert.equal(incoming.body.ok,true);
    for(let attempt=0;attempt<50;attempt++){if((await f.query('SELECT count(*)::int AS n FROM research_private.usage_events')).rows[0].n===1)break;await delay(30);}
    const events=(await f.query('SELECT study_id,metadata FROM research_private.usage_events')).rows;assert.equal(events.length,1);assert.equal(events[0].study_id,a.study.id);assert.equal(JSON.stringify(events).includes(sentinel),false);
    const ordinaryId=randomUUID();const ordinary=await communicate(f.tokens.ordinary,{action:'create',id:ordinaryId,requestId:randomUUID(),expectedRevision:null});
    await communicate(f.tokens.ordinary,{action:'append',id:ordinaryId,requestId:randomUUID(),expectedRevision:ordinary.body.conversation.revision,kind:'received',text:'ordinary nonconsenting input'});await delay(100);assert.equal((await f.query('SELECT count(*)::int AS n FROM research_private.usage_events')).rows[0].n,1);
    const paused=await api(owner,'studyStatus',{studyId:a.study.id,requestId:randomUUID(),expectedRevision:assigned.body.revision,status:'paused',confirmApprovals:false});assert.equal(paused.response.status,200);
    await communicate(f.tokens.participant,{action:'append',id:cid,requestId:randomUUID(),expectedRevision:incoming.body.conversation.revision,kind:'received',text:'after pause'});await delay(100);assert.equal((await f.query('SELECT count(*)::int AS n FROM research_private.usage_events')).rows[0].n,1);
    const member=(await api(owner,'memberList',{studyId:a.study.id})).body.members[0];
    assert.equal((await api(owner,'memberRemove',{studyId:a.study.id,requestId:randomUUID(),expectedRevision:paused.body.study.revision,memberId:member.id})).response.status,200);
    assert.equal((await api(f.tokens.a,'exportData',{studyId:a.study.id,category:'surveys'})).response.status,404);
    assert.ok(!logs.includes(sentinel)&&!logs.includes('http-participant@example.invalid'));
  } finally {
    if(child){const done=child.exitCode!==null?Promise.resolve():once(child,'exit');child.kill();await done;}
    if(db)await new Promise(resolve=>db.close(resolve));await f.close();
  }
});
