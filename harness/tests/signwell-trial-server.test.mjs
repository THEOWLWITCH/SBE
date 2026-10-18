import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { startTrialServer } from '../signwell-trial-server.mjs';

test('loopback trial requires its private path and exact origin before accepting a key',async()=>{
 let calls=0;
 const trial=await startTrialServer({fetchImpl:async()=>{calls++;return Response.json({id:'synthetic-doc',test_mode:true,recipients:[{id:'owner',name:'בעלת מערכת בדויה',email:'owner@example.invalid',embedded_signing_url:'https://www.signwell.com/docs/owner'},{id:'partner',name:'חוקרת בדויה',email:'partner@example.invalid',embedded_signing_url:'https://www.signwell.com/docs/partner'}]});}});
 try{
  const page=await fetch(trial.url),html=await page.text();assert.equal(page.status,200);assert.ok(html.includes('dir="rtl"'));assert.ok(html.includes('type="password"'));assert.equal(page.headers.get('cache-control'),'no-store');
  assert.equal((await fetch(trial.origin+'/wrong-path')).status,404);
  const post=(suffix,origin,payload)=>fetch(trial.url+suffix,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(payload)});
  assert.equal((await post('/start','https://attacker.example',{apiKey:'synthetic-private-key'})).status,403);assert.equal(calls,0);
  assert.equal((await post('/start',trial.origin,{apiKey:'synthetic-private-key',test_mode:false})).status,400);assert.equal(calls,0);
  assert.equal((await post('/refresh',trial.origin,{})).status,409);
  const created=await post('/start',trial.origin,{apiKey:'synthetic-private-key'}),result=await created.json();assert.equal(created.status,200);assert.equal(result.testMode,true);assert.equal(result.legallyVerified,false);assert.ok(!JSON.stringify(result).includes('synthetic-private-key'));assert.equal(calls,1);
  assert.equal((await fetch(trial.url+'/final.pdf')).status,405);
  assert.equal((await post('/start',trial.origin,{apiKey:'synthetic-private-key'})).status,200);assert.equal(calls,1);
 }finally{await trial.close();}
});

test('loopback trial never returns a provider error body containing secrets',async()=>{
 const trial=await startTrialServer({fetchImpl:async()=>new Response('synthetic-secret-provider-body',{status:401})});
 try{const response=await fetch(trial.url+'/start',{method:'POST',headers:{origin:trial.origin,'content-type':'application/json'},body:JSON.stringify({apiKey:'synthetic-private-key'})});assert.equal(response.status,503);const text=await response.text();assert.equal(text.includes('synthetic-private-key'),false);assert.equal(text.includes('synthetic-secret-provider-body'),false);}finally{await trial.close();}
});

test('corrected keys may retry a definite authentication rejection without replaying an uncertain create',async()=>{
 let calls=0;
 const trial=await startTrialServer({fetchImpl:async()=>{calls++;if(calls===1)return new Response('',{status:401});return Response.json({id:'synthetic-doc',test_mode:true,recipients:[{id:'owner',name:'בעלת מערכת בדויה',email:'owner@example.invalid',embedded_signing_url:'https://www.signwell.com/docs/owner'},{id:'partner',name:'חוקרת בדויה',email:'partner@example.invalid',embedded_signing_url:'https://www.signwell.com/docs/partner'}]});}});
 try{const post=key=>fetch(trial.url+'/start',{method:'POST',headers:{origin:trial.origin,'content-type':'application/json'},body:JSON.stringify({apiKey:key})});assert.equal((await post('wrong-key')).status,503);assert.equal((await post('corrected-key')).status,200);assert.equal(calls,2);}finally{await trial.close();}
});

test('a provider response arriving after expiry never returns signing URLs or retained PDF',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 let release,started;const began=new Promise(resolve=>{started=resolve;});
 const trial=await startTrialServer({ttlMs:70,fetchImpl:()=>{started();return new Promise(resolve=>{release=()=>resolve(Response.json({id:'synthetic-doc',test_mode:true,recipients:[{id:'owner',name:'בעלת מערכת בדויה',email:'owner@example.invalid',embedded_signing_url:'https://www.signwell.com/docs/owner'},{id:'partner',name:'חוקרת בדויה',email:'partner@example.invalid',embedded_signing_url:'https://www.signwell.com/docs/partner'}]}));});}});
 try{const pending=fetch(trial.url+'/start',{method:'POST',headers:{origin:trial.origin,'content-type':'application/json'},body:JSON.stringify({apiKey:'synthetic-key'})});await began;t.mock.timers.tick(110);release();const response=await pending;assert.equal(response.status,410);assert.equal((await response.text()).includes('embeddedUrl'),false);assert.equal((await fetch(trial.url+'/final.pdf')).status,410);}finally{await trial.close();t.mock.timers.reset();}
});

test('completion checks cannot overlap and hide a completed PDF behind a stale response',async()=>{
 const trial=await startTrialServer();
 try{
  const html=await (await fetch(trial.url)).text(),requests=[];
  const elements=new Map(['status','key-form','refresh','result'].map(id=>[id,{hidden:id==='result',disabled:false,addEventListener(){}}]));
  runInNewContext(html.match(/<script nonce="[^"]+">([\s\S]*?)<\/script>/)[1],{document:{getElementById:id=>elements.get(id)},fetch:()=>new Promise(resolve=>requests.push(resolve))});
  const button=elements.get('refresh'),first=button.onclick(),overlap=button.onclick();
  assert.equal(requests.length,1);assert.equal(button.disabled,true);
  requests[0](Response.json({completed:false}));await Promise.all([first,overlap]);assert.equal(button.disabled,false);
  const second=button.onclick();requests[1](Response.json({completed:true}));await second;
  assert.equal(elements.get('result').hidden,false);assert.equal(button.disabled,false);
 }finally{await trial.close();}
});
