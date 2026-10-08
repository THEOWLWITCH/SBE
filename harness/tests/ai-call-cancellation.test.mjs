import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../../app/lib/ai-call.js',import.meta.url),'utf8');
function env(){
  let acknowledge;const startup=new Promise(resolve=>acknowledge=resolve),sent=[];
  const context={window:{sbeAIHeaders:()=>({Authorization:'Bearer synthetic'})},crypto:{randomUUID:()=> 'synthetic-request'},document:{hidden:false},AbortController,DOMException,Date,setTimeout,clearTimeout,
    fetch:async(url,init)=>{
      sent.push({url,body:JSON.parse(init.body),signal:init.signal});
      if(url.endsWith('/api/complete')) {
        const data=await Promise.race([startup,new Promise((_,reject)=>init.signal.addEventListener('abort',()=>reject(new DOMException('Cancelled','AbortError')),{once:true}))]);
        return {ok:true,status:200,text:async()=>JSON.stringify(data)};
      }
      if(url.endsWith('/api/pipeline-cancel')) return {ok:true,status:200,text:async()=>JSON.stringify({status:'cancelled'})};
      throw Error('Obsolete request must never poll');
    }};
  vm.runInNewContext(source,context);return {call:context.window.sbeCallAI,sent,acknowledge};
}
test('Cancelling before startup acknowledgment releases the caller and cancels the subsequently accepted job',async()=>{
  const e=env(),ctrl=new AbortController(),pending=e.call('http://synthetic.test',{},60000,{signal:ctrl.signal});ctrl.abort();
  await assert.rejects(pending,{name:'AbortError'});
  assert.equal(e.sent[0].signal.aborted,false,'bounded startup acknowledgment remains readable');
  e.acknowledge({jobId:'accepted-after-cancel'});await new Promise(resolve=>setTimeout(resolve,0));
  assert.deepEqual(e.sent.map(c=>c.url.split('/').at(-1)),['complete','pipeline-cancel']);
  assert.equal(e.sent[1].body.jobId,'accepted-after-cancel');
});
test('An already cancelled request is never sent to the server',async()=>{
  const e=env(),ctrl=new AbortController();ctrl.abort();
  await assert.rejects(e.call('http://synthetic.test',{},60000,{signal:ctrl.signal}),{name:'AbortError'});
  assert.equal(e.sent.length,0);
});
