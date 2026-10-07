import test from 'node:test';
import assert from 'node:assert/strict';
import * as access from '../lib/access.mjs';

function storeFixture(seed={}) {
  const data=new Map(Object.entries(structuredClone(seed)));
  return {data,async get(k){return structuredClone(data.get(k)??null);},async set(k,v){data.set(k,structuredClone(v));},async del(k){data.delete(k);},
    async list(prefix){return [...data].filter(([k])=>k.startsWith(prefix)).map(([key,value])=>({key,value:structuredClone(value)}));},async delPrefix(prefix){for(const k of data.keys())if(k.startsWith(prefix))data.delete(k);}};
}
test('F05: research export contains only closed fields and excludes all free text and identity',async()=>{
  const secret='Private pupil 0501234567 unique incident';
  const store=storeFixture({'jr:journey1':{id:'journey1',unit:'school',unitName:secret,inst:secret,by:secret,contact:{email:secret},consent:{research:true},
    events:[{at:'2026-01-01T09:10:11Z',stage:2,type:'choice',key:secret,choice:secret,reasons:[secret],explain:secret,who:[secret],effect:secret,again:secret,learned:secret}]} });
  const [,session]=await access.handleAccess(store,{action:'login',kind:'sys',secret:'990211'});
  const [status,result]=await access.handleAccess(store,{action:'jrExport',token:session.token});assert.equal(status,200);
  assert.ok(!JSON.stringify(result).includes(secret));assert.equal(result.rows[0].stage,2);
  store.data.get('jr:journey1').consent.research=false;
  assert.equal((await access.handleAccess(store,{action:'jrExport',token:session.token}))[1].rows.length,0);
});
test('F04: parallel workshop feedback preserves all distinct submissions',async()=>{
  const store=access.createAtomicMemoryStore({'wf:workshopaaa':{w:'workshopaaa',entries:[]}});
  const results=await Promise.all(Array.from({length:100},(_,i)=>access.handleAccess(store,{action:'wfSubmit',w:'workshopaaa',role:'trainee',submissionId:'submission-'+i,record:{value:i}})));
  assert.ok(results.every(([status])=>status===200));
  assert.equal((await store.get('wf:workshopaaa')).entries.length,100);
});
test('F04: feedback retries are idempotent, content changes conflict, and unsupported storage fails closed',async()=>{
  const store=access.createAtomicMemoryStore({'wf:workshopaaa':{w:'workshopaaa',entries:[]}});
  const request={action:'wfSubmit',w:'workshopaaa',role:'trainee',submissionId:'same-submission',record:{value:1}};
  assert.equal((await access.handleAccess(store,request))[0],200);
  assert.equal((await access.handleAccess(store,request))[1].duplicate,true);
  assert.equal((await access.handleAccess(store,{...request,record:{value:2}}))[0],409);
  assert.equal((await store.get('wf:workshopaaa')).entries.length,1);
  assert.equal((await access.handleAccess(storeFixture({'wf:workshopaaa':{w:'workshopaaa',entries:[]}}),request))[0],503);
});
test('F04: optimistic journey writes conflict and preserve the saved input',async()=>{
  const store=access.createAtomicMemoryStore({institutions:[{name:'A',code:'123456',active:true}],'modules:A':{journey:true}});
  const [,session]=await access.handleAccess(store,{action:'login',kind:'code',secret:'123456'});
  const [,created]=await access.handleAccess(store,{action:'jrCreate',token:session.token,unitName:'Private journey'});
  const results=await Promise.all(['first','second'].map(value=>access.handleAccess(store,{action:'jrSaveMapping',id:created.id,token:session.token,mapping:{value},baseVersion:1})));
  assert.deepEqual(results.map(([status])=>status).sort(),[200,409]);
  assert.ok(['first','second'].includes((await store.get('jr:'+created.id)).mapping.value));
  assert.equal((await access.handleAccess(store,{action:'jrSaveMapping',id:created.id,token:session.token,mapping:{value:'stale'},baseVersion:1}))[0],409);
});
