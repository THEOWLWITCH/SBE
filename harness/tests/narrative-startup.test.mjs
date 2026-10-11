import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../../app/lib/narrative-build.js',import.meta.url),'utf8');
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const flush=()=>new Promise(resolve=>setTimeout(resolve,0));
const reply=data=>({ok:true,status:200,text:async()=>JSON.stringify(data),json:async()=>data});
function delayedResponse(hold,signal) {
  return new Promise((resolve,reject)=>{
    const stop=()=>reject(Object.assign(new Error('request aborted'),{name:'AbortError'}));
    if(signal.aborted) {stop();return;}
    signal.addEventListener('abort',stop,{once:true});
    hold.promise.then(data=>{signal.removeEventListener('abort',stop);resolve(reply(data));});
  });
}
function environment(fetchImpl) {
  const data=new Map([['sbe.edu.built.v1:owner-a','previous human draft']]),shown=[],sent=[],watchdogs=[];
  let serial=0;
  const button={textContent:'בנייה',disabled:false},cancel={hidden:true};
  const context={window:{sbeUserKey:key=>key+':owner-a',sbeAIHeaders:()=>({'Content-Type':'application/json',Authorization:'Bearer synthetic'}),crypto:{randomUUID:()=> 'request-'+(++serial)}},
    document:{hidden:false,getElementById:id=>id==='bCancelBuild'?cancel:null},
    localStorage:{getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)},
    AbortController,Date,console,clearTimeout,setTimeout:(fn,ms)=>{if(ms>=30000)watchdogs.push(ms);return setTimeout(fn,ms<30000?0:ms);},
    fetch:async(url,init)=>{const call={url,body:JSON.parse(init.body),headers:init.headers,signal:init.signal};sent.push(call);return fetchImpl(call);}};
  vm.runInNewContext(source,context);
  const build=()=>context.window.SBE_BUILD.buildEdu({fields:{traineeRole:'מורה',actorRole:'הורה',event:'אירוע',skills:'הקשבה'},labels:{},button,server:'http://local.test',show:(...args)=>shown.push(args)});
  return {context,data,shown,sent,watchdogs,button,cancel,build};
}

test('cancel/reset/source edits before delayed startup acknowledgment still cancel the accepted server job',async()=>{
  const hold=deferred(),started=deferred();
  const env=environment(call=>{
    if(call.url.endsWith('/api/pipeline')) {started.resolve();return delayedResponse(hold,call.signal);}
    if(call.url.endsWith('/api/pipeline-cancel')) return reply({status:'cancelled'});
    throw Error('An obsolete startup must never poll');
  });
  const building=env.build();await started.promise;
  env.context.window.SBE_BUILD.invalidateEdu();await building;
  assert.equal(env.button.disabled,false,'cancellation restores the UI before the delayed acknowledgment');
  assert.equal(env.cancel.hidden,true);
  assert.equal(env.sent[0].signal.aborted,false,'the bounded acknowledgment remains recoverable after UI cancellation');
  hold.resolve({jobId:'late-accepted-job'});await flush();
  const cancellation=env.sent.find(call=>call.url.endsWith('/api/pipeline-cancel'));
  assert.ok(cancellation,'a job accepted before cancellation is cancelled as soon as its ID arrives');
  assert.equal(cancellation.body.jobId,'late-accepted-job');assert.equal(cancellation.headers.Authorization,'Bearer synthetic');
  assert.equal(env.shown.length,0);assert.equal(env.sent.filter(call=>call.url.endsWith('/api/pipeline-status')).length,0);
  assert.equal(env.data.has('sbe.edu.job.v1:owner-a'),false);assert.equal(env.data.get('sbe.edu.built.v1:owner-a'),'previous human draft');
  assert.ok(env.watchdogs.includes(90000),'startup acknowledgment keeps its independent timeout');
});

test('a late obsolete acknowledgment cancels only its job and preserves a newer run and its saved job ID',async()=>{
  const oldAck=deferred(),newAck=deferred(),oldStarted=deferred(),newStarted=deferred(),pollStarted=deferred(),poll=deferred();
  let starts=0;
  const env=environment(call=>{
    if(call.url.endsWith('/api/pipeline')) {starts++;(starts===1?oldStarted:newStarted).resolve();return delayedResponse(starts===1?oldAck:newAck,call.signal);}
    if(call.url.endsWith('/api/pipeline-status')) {pollStarted.resolve();return delayedResponse(poll,call.signal);}
    if(call.url.endsWith('/api/pipeline-cancel')) return reply({status:'cancelled'});
    throw Error('Unexpected request');
  });
  const first=env.build();await oldStarted.promise;env.context.window.SBE_BUILD.invalidateEdu();await first;
  const second=env.build();await newStarted.promise;newAck.resolve({jobId:'new-active-job'});await pollStarted.promise;
  oldAck.resolve({jobId:'old-obsolete-job'});await flush();
  assert.deepEqual(env.sent.filter(call=>call.url.endsWith('/api/pipeline-cancel')).map(call=>call.body.jobId),['old-obsolete-job']);
  assert.equal(JSON.parse(env.data.get('sbe.edu.job.v1:owner-a')).jobId,'new-active-job');
  assert.equal(env.button.disabled,true);assert.equal(env.sent.find(call=>call.url.endsWith('/api/pipeline-status')).signal.aborted,false);
  env.context.window.SBE_BUILD.invalidateEdu();await second;await flush();
  assert.deepEqual(env.sent.filter(call=>call.url.endsWith('/api/pipeline-cancel')).map(call=>call.body.jobId),['old-obsolete-job','new-active-job']);
  assert.equal(env.shown.length,0);assert.equal(env.data.has('sbe.edu.job.v1:owner-a'),false);
});
