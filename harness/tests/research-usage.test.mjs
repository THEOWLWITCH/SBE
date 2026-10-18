import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { handleCommunication } from '../lib/communication-continuity.mjs';

const clone = value => value == null ? null : structuredClone(value);
function fixture() {
  const data = new Map(Object.entries({ 'token-secret': {secret:'synthetic-usage-secret'},
    institutions:[{name:'Usage Fixture',active:true}], 'modules:Usage Fixture':{writer:true},
    'code:USAGEONE':{kind:'staff',inst:'Usage Fixture',perms:['writer']} }));
  const store = { data, async get(key){return clone(data.get(key));}, async set(key,value){data.set(key,clone(value));},
    async list(prefix){return [...data].filter(([key])=>key.startsWith(prefix)).map(([key,value])=>({key,value:clone(value)}));},
    async compareSet(key,revision,value){const old=data.get(key);if(revision===null?!!old:old?.revision!==revision)return false;data.set(key,clone(value));return true;} };
  const raw=Buffer.from(JSON.stringify({k:'code',c:'USAGEONE',kind:'staff',inst:'Usage Fixture',perms:['writer'],exp:Date.now()+3600000})).toString('base64url');
  const token=raw+'.'+createHmac('sha256',data.get('token-secret').secret).update(raw).digest('base64url');
  const observed=[];
  const provider={id:'synthetic',model:'configured-model',async complete(){return {model:'actual-observed-model',text:JSON.stringify({
    message:'תוכן אישי סינתטי שאינו נכלל במדדים',why:'ברור',next:'בדיקה',clarification:'',
    analysis:Object.fromEntries(['facts','interpretations','control','influence','outsideControl','responsibility','resources','barriers','agreements','openQuestions','followUp'].map(key=>[key,[]]))
  })};}};
  const call = (body, options={}) => handleCommunication(store,{token,...body},{providerFactory:()=>provider,onUsage:event=>observed.push(clone(event)),...options});
  return {store,token,observed,call};
}
const settle = () => new Promise(resolve=>setImmediate(resolve));
const initial = () => ({action:'singleGenerate',requestId:randomUUID(),input:{text:'מקור פרטי סינתטי',audience:'הורים'}});

test('successful single writing emits only server-observed versioned counts, never prompt or document text', async()=>{
  const f=fixture(), body=initial(); const [status,out]=await f.call(body); await settle();
  assert.equal(status,200); assert.equal(f.observed.length,1);
  const event=f.observed[0];
  assert.equal(event.eventId,body.requestId); assert.equal(event.sourceId,out.document.id); assert.equal(event.mode,'single');
  assert.equal(event.operation,'generate'); assert.deepEqual(event.counts,{sessions:1,drafts:1,revisions:0,rounds:0});
  assert.equal(event.audience,'parent'); assert.equal(event.versions.model.id,'actual-observed-model');
  assert.equal(event.versions.tool,'1.2.0'); assert.equal(event.versions.prompt,'1.1.1');
  assert.ok(event.durationMs>=0); assert.ok(Number.isFinite(Date.parse(event.timestamp)));
  assert.equal(JSON.stringify(event).includes('פרטי'),false);
  assert.equal([...f.store.data.keys()].some(key=>key.startsWith('research:')),false);
});

test('AI and changed manual revisions are distinct observations without inventing another writing session', async()=>{
  const f=fixture(),[,first]=await f.call(initial());
  const id=first.document.latestAI.entryId;
  const [,edited]=await f.call({action:'singleEdit',requestId:randomUUID(),document:first.document,proof:first.proof,entryId:id,text:'נוסח ערוך סינתטי'});
  const [,revised]=await f.call({action:'singleGenerate',requestId:randomUUID(),document:edited.document,proof:edited.proof,input:edited.document.input,entryId:id,revisionStyle:'shorter'});
  await settle(); assert.equal(f.observed.length,3);
  assert.deepEqual(f.observed[1].counts,{sessions:0,drafts:0,revisions:1,rounds:0});
  assert.equal(f.observed[1].operation,'revise'); assert.equal(f.observed[1].versions.model,null);
  assert.deepEqual(f.observed[2].counts,{sessions:0,drafts:1,revisions:1,rounds:0});
  assert.equal(f.observed[2].operation,'revise'); assert.equal(revised.document.entries.filter(entry=>entry.kind==='draft').length,2);
  await f.call({action:'singleEdit',requestId:randomUUID(),document:edited.document,proof:edited.proof,entryId:id,text:'נוסח ערוך סינתטי'});
  await settle(); assert.equal(f.observed.length,3,'unchanged edit is not a revision');
});

test('ongoing capture follows committed input/generation; replay and conversion never recount the original draft', async()=>{
  const f=fixture(),[,single]=await f.call(initial());
  const convert={action:'convert',id:randomUUID(),requestId:randomUUID(),expectedRevision:null,document:single.document,proof:single.proof};
  const [,converted]=await f.call(convert); await settle();
  assert.equal(f.observed.length,2); assert.equal(f.observed[1].operation,'convert');
  assert.deepEqual(f.observed[1].counts,{sessions:0,drafts:0,revisions:0,rounds:0});
  await f.call(convert); await settle(); assert.equal(f.observed.length,2);
  const incoming={action:'append',id:convert.id,requestId:randomUUID(),expectedRevision:converted.conversation.revision,kind:'received',text:'תגובה אישית סינתטית'};
  const [,received]=await f.call(incoming); await f.call(incoming); await settle();
  assert.equal(f.observed.length,3); assert.equal(f.observed[2].operation,'communicationRound');
  assert.deepEqual(f.observed[2].counts,{sessions:0,drafts:0,revisions:0,rounds:1});
  const generate={action:'generate',id:convert.id,requestId:randomUUID(),expectedRevision:received.conversation.revision,mode:'suggest',instruction:''};
  await f.call(generate); await settle(); assert.equal(f.observed.length,4);
  assert.deepEqual(f.observed[3].counts,{sessions:0,drafts:1,revisions:0,rounds:0});
  assert.equal(f.observed[3].sourceId,single.document.id,'converted process preserves source grouping');
});

test('failed AI, rejected CAS, reads and unconfigured research never turn professional data into usage observations', async()=>{
  const f=fixture();
  const [failure]=await f.call(initial(),{providerFactory:()=>({async complete(){throw new Error('synthetic unavailable');}})});
  assert.equal(failure,503); await settle(); assert.equal(f.observed.length,0);
  const create={action:'create',id:randomUUID(),requestId:randomUUID(),expectedRevision:null};
  const [,made]=await f.call(create); await f.call({action:'get',id:create.id}); await settle(); assert.equal(f.observed.length,0);
  f.store.compareSet=async()=>false;
  const [conflict]=await f.call({action:'append',id:create.id,requestId:randomUUID(),expectedRevision:made.conversation.revision,kind:'received',text:'מקור שלא נשמר'});
  assert.equal(conflict,409); await settle(); assert.equal(f.observed.length,0);
  const [ok,out]=await f.call(initial(),{onUsage:undefined}); assert.equal(ok,200); assert.ok(out.proof);
});

test('research hook rejection or a pending promise cannot reverse or block a successful professional result', async()=>{
  const f=fixture();
  const [one,out]=await f.call(initial(),{onUsage(){throw new Error('private research failure');}});
  assert.equal(one,200); assert.ok(out.document);
  const timeout=setTimeout(()=>{},500); timeout.unref();
  const [two,second]=await Promise.race([f.call(initial(),{onUsage:()=>new Promise(()=>{})}),
    new Promise((_,reject)=>setTimeout(()=>reject(new Error('research hook blocked writing')),300))]);
  clearTimeout(timeout); assert.equal(two,200); assert.ok(second.proof); await settle();
});

test('generated research source uses an owned verified exact draft and preserves generation versions through later manual edits',async()=>{
  const {resolveResearchGeneratedSample}=await import('../lib/research-usage.mjs');
  const f=fixture(),[,one]=await f.call(initial());
  const draftId=one.document.latestAI.entryId;
  const [,edited]=await f.call({action:'singleEdit',requestId:randomUUID(),document:one.document,proof:one.proof,entryId:draftId,text:'נוסח מצומצם לשיתוף'});
  const source=await resolveResearchGeneratedSample(f.store,{token:f.token,generatedSource:{mode:'single',document:edited.document,proof:edited.proof,draftId}});
  assert.equal(source.text,'נוסח מצומצם לשיתוף'); assert.equal(source.sourceId,one.document.id);
  assert.equal(source.versions.model.id,'actual-observed-model');
  assert.deepEqual(source.versions.editVersions,edited.document.entries.find(e=>e.id===draftId).versions);
  assert.equal(source.versions.sourceRevision.recordRevision,edited.document.revision);
  const changed=clone(edited.document); changed.entries.find(e=>e.id===draftId).text='טקסט מזויף';
  await assert.rejects(resolveResearchGeneratedSample(f.store,{token:f.token,generatedSource:{mode:'single',document:changed,proof:edited.proof,draftId}}));
});

test('ongoing sample resolver never exposes a different individual conversation and keeps old AI recipe distinct from a new manual recipe',async()=>{
  const {resolveResearchGeneratedSample}=await import('../lib/research-usage.mjs');
  const f=fixture(),id=randomUUID();const[,created]=await f.call({action:'create',id,requestId:randomUUID(),expectedRevision:null});
  const[,generated]=await f.call({action:'generate',id,requestId:randomUUID(),expectedRevision:created.conversation.revision,mode:'suggest',instruction:''});
  const draftId=generated.conversation.latestAI.entryId;
  const stored=[...f.store.data].find(([key])=>key.endsWith(':'+id))[1];
  const original=stored.entries.find(e=>e.id===draftId); original.versions={tool:'old-tool',prompt:'old-prompt',engine:'old-engine',principles:'old-principles',schema:1};
  await f.call({action:'editDraft',id,requestId:randomUUID(),expectedRevision:stored.revision,entryId:draftId,text:'תוכן נבחר לאחר עריכה'});
  const source=await resolveResearchGeneratedSample(f.store,{token:f.token,generatedSource:{mode:'continuity',conversationId:id,entryId:draftId}});
  assert.equal(source.text,'תוכן נבחר לאחר עריכה');assert.equal(source.versions.prompt,'old-prompt');
  assert.equal(source.versions.editVersions.prompt,'1.1.1');
  f.store.data.set('code:USAGETWO',{kind:'staff',inst:'Usage Fixture',perms:['writer']});
  const raw=Buffer.from(JSON.stringify({k:'code',c:'USAGETWO',kind:'staff',inst:'Usage Fixture',exp:Date.now()+3600000})).toString('base64url');
  const other=raw+'.'+createHmac('sha256',f.store.data.get('token-secret').secret).update(raw).digest('base64url');
  await assert.rejects(resolveResearchGeneratedSample(f.store,{token:other,generatedSource:{mode:'continuity',conversationId:id,entryId:draftId}}),e=>e.status===404);
});
