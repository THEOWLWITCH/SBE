// Actual practice-server HTTP route, isolated PostgREST fixture and deliberately
// unavailable provider. No production URLs, data or credentials are used.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { createHmac,randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

test('actual HTTP route exposes post-keepalive failure status in explicit result envelope', {timeout:15000}, async()=>{
  const secret='synthetic-http-secret';
  const data=new Map(Object.entries({'token-secret':{secret},institutions:[{name:'HTTP QA',active:true}],
    'modules:HTTP QA':{writer:true},'code:HTTPQA':{kind:'staff',inst:'HTTP QA',perms:['writer']}}));
  const db=createServer(async(req,res)=>{
    const url=new URL(req.url,'http://fixture.invalid');
    let raw='';for await(const chunk of req)raw+=chunk;
    let result=[];const key=url.searchParams.get('key');
    if(req.method==='GET'&&key?.startsWith('eq.'))result=data.has(key.slice(3))?[{value:data.get(key.slice(3))}]:[];
    if(req.method==='POST') {const row=JSON.parse(raw);data.set(row.key,row.value);result=[{key:row.key}];}
    res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(result));
  });
  db.listen(0,'127.0.0.1');await once(db,'listening');
  const portProbe=createServer();portProbe.listen(0,'127.0.0.1');await once(portProbe,'listening');
  const port=portProbe.address().port;await new Promise(resolve=>portProbe.close(resolve));
  const child=spawn(process.execPath,[fileURLToPath(new URL('../practice-server.mjs',import.meta.url)),'--port',String(port)],{
    env:{...process.env,SUPABASE_URL:'http://127.0.0.1:'+db.address().port,SUPABASE_SERVICE_KEY:'synthetic-only',PROVIDER:'synthetic-unconfigured',ANTHROPIC_API_KEY:'',OPENAI_API_KEY:''},
    stdio:['ignore','pipe','pipe']
  });
  let logs='';child.stdout.on('data',chunk=>{logs+=chunk;});child.stderr.on('data',chunk=>{logs+=chunk;});
  const base='http://127.0.0.1:'+port;
  try {
    let ready=false;
    for(let attempt=0;attempt<50;attempt++){try{ready=(await fetch(base+'/health')).ok;}catch{}if(ready)break;await delay(100);}
    assert.ok(ready,'isolated practice-server did not become ready: '+logs);
    const actor=Buffer.from(JSON.stringify({k:'code',c:'HTTPQA',kind:'staff',inst:'HTTP QA',perms:['writer'],exp:Date.now()+3600000})).toString('base64url');
    const token=actor+'.'+createHmac('sha256',secret).update(actor).digest('base64url');
    const call=body=>fetch(base+'/api/communication-continuity',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token,...body})});
    const createdResponse=await call({action:'create',id:randomUUID(),requestId:randomUUID(),expectedRevision:null});
    const created=await createdResponse.json();assert.equal(created.ok,true);assert.equal(created.status,200);
    const response=await call({action:'generate',id:created.conversation.id,requestId:randomUUID(),expectedRevision:created.conversation.revision,mode:'suggest',instruction:'private synthetic instruction'});
    assert.equal(response.status,200); // transport is committed before provider failure
    assert.match(response.headers.get('cache-control'),/no-store/);
    const result=await response.json();assert.equal(result.ok,false);assert.equal(result.status,503);
    assert.equal(result.code,'SERVICE_UNAVAILABLE');assert.equal('conversation' in result,false);
    assert.ok(!logs.includes('private synthetic instruction'));
    const rowsBefore=[...data.keys()].filter(key=>key.startsWith('cc:'));
    const materialResponse=await call({action:'singleExtract',requestId:randomUUID(),attachment:{kind:'text',name:'synthetic.txt',text:'private single source'}});
    const material=await materialResponse.json();assert.equal(material.ok,true);assert.equal(material.status,200);
    assert.equal(material.material.text,'private single source');assert.match(material.proof,/^[0-9a-f]{64}$/);
    const singleResponse=await call({action:'singleGenerate',requestId:randomUUID(),input:{text:'private single instruction',materials:[{material:material.material,proof:material.proof}]}});
    assert.equal(singleResponse.status,200);
    assert.match(singleResponse.headers.get('cache-control'),/no-store/);
    const single=await singleResponse.json();assert.equal(single.ok,false);assert.equal(single.status,503);
    assert.equal(single.code,'SERVICE_UNAVAILABLE');assert.equal('document' in single,false);
    assert.deepEqual([...data.keys()].filter(key=>key.startsWith('cc:')),rowsBefore);
    assert.ok(!logs.includes('private single source')&&!logs.includes('private single instruction'));
  } finally {
    const exited=child.exitCode!==null?Promise.resolve():once(child,'exit');child.kill();await exited;
    await new Promise(resolve=>db.close(resolve));
  }
});
