import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../../app/lib/ai-call.js',import.meta.url),'utf8');
function env(){
  let acknowledge,status;const startup=new Promise(resolve=>acknowledge=resolve),sent=[],headers={Authorization:'Bearer synthetic'};
  const context={window:{sbeAIHeaders:()=>headers},crypto:{randomUUID:()=> 'synthetic-request'},document:{hidden:false},AbortController,DOMException,Date,setTimeout:(fn,ms)=>setTimeout(fn,ms===3000?0:ms),clearTimeout,
    fetch:async(url,init)=>{
      sent.push({url,body:JSON.parse(init.body),signal:init.signal,headers:{...init.headers}});
      if(url.endsWith('/api/complete')) {
        const data=await Promise.race([startup,new Promise((_,reject)=>init.signal.addEventListener('abort',()=>reject(new DOMException('Cancelled','AbortError')),{once:true}))]);
        return {ok:true,status:200,text:async()=>JSON.stringify(data)};
      }
      if(url.endsWith('/api/pipeline-cancel')) return {ok:true,status:200,text:async()=>JSON.stringify({status:'cancelled'})};
      if(url.endsWith('/api/pipeline-status')&&status) return {ok:false,status:404,text:async()=>JSON.stringify(status)};
      throw Error('Obsolete request must never poll');
    }};
  vm.runInNewContext(source,context);return {call:context.window.sbeCallAI,sent,acknowledge,setOwner:value=>headers.Authorization='Bearer '+value,setStatus:value=>status=value};
}
test('Cancelling before startup acknowledgment releases the caller and cancels the subsequently accepted job',async()=>{
  const e=env(),ctrl=new AbortController(),pending=e.call('http://synthetic.test',{},60000,{signal:ctrl.signal});ctrl.abort();
  await assert.rejects(pending,{name:'AbortError'});
  assert.equal(e.sent[0].signal.aborted,false,'bounded startup acknowledgment remains readable');
  e.acknowledge({jobId:'accepted-after-cancel'});await new Promise(resolve=>setTimeout(resolve,0));
  assert.deepEqual(e.sent.map(c=>c.url.split('/').at(-1)),['complete','pipeline-cancel']);
  assert.equal(e.sent[1].body.jobId,'accepted-after-cancel');
});

test('Late acknowledged cancellation keeps copied credentials of the submitting owner after A to B',async()=>{
  const e=env(),ctrl=new AbortController();e.setOwner('A');const pending=e.call('http://synthetic.test',{},60000,{signal:ctrl.signal});e.setOwner('B');ctrl.abort();await assert.rejects(pending,{name:'AbortError'});e.acknowledge({jobId:'A-job'});await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(e.sent[0].headers.Authorization,'Bearer A');assert.equal(e.sent[1].headers.Authorization,'Bearer A');assert.equal(e.sent[1].body.jobId,'A-job');
});

test('Polling uses live identity and cleans up with original-owner credentials when B cannot read A',async()=>{
  const e=env();e.setOwner('A');const pending=e.call('http://synthetic.test',{},60000);e.setOwner('B');e.setStatus({error:'not this owner'});e.acknowledge({jobId:'A-job'});await assert.rejects(pending,{status:404});
  assert.deepEqual(e.sent.map(c=>c.url.split('/').at(-1)),['complete','pipeline-status','pipeline-cancel']);assert.equal(e.sent[1].headers.Authorization,'Bearer B');assert.equal(e.sent[2].headers.Authorization,'Bearer A');
});
test('An already cancelled request is never sent to the server',async()=>{
  const e=env(),ctrl=new AbortController();ctrl.abort();
  await assert.rejects(e.call('http://synthetic.test',{},60000,{signal:ctrl.signal}),{name:'AbortError'});
  assert.equal(e.sent.length,0);
});
