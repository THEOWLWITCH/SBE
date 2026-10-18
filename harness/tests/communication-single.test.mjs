import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { handleCommunication } from '../lib/communication-continuity.mjs';
import { ilToday } from '../lib/access.mjs';
const CORE=createRequire(import.meta.url)('../../app/lib/communication-core.js');
const copy=value=>value==null?value:structuredClone(value);
function fixture() {
  const data=new Map(Object.entries({'token-secret':{secret:'synthetic-single-secret'},
    'pw-sys':{salt:'synthetic-single-owner-salt',hash:'synthetic-single-owner-hash'},
    institutions:[{name:'Synthetic School',code:'123456',active:true}],
    'modules:Synthetic School':{writer:true},
    'code:STAFFONE':{kind:'staff',inst:'Synthetic School',perms:['writer']},
    'code:STAFFTWO':{kind:'staff',inst:'Synthetic School',perms:['writer']},
    'code:COURSE':{kind:'course',inst:'Synthetic School',perms:['writer']},
    'open:synthetic':{id:'synthetic',date:ilToday(),perm:'writer',revoked:false}}));
  const writes=[];
  const store={data,writes,async get(k){return copy(data.get(k)??null);},async set(k,v){writes.push(k);data.set(k,copy(v));},
    async list(prefix){return [...data].filter(([key])=>key.startsWith(prefix)).map(([key,value])=>({key,value:copy(value)}));},
    async compareSet(k,expected,value){const old=data.get(k);if(expected===null?!!old:!old||old.revision!==expected)return false;writes.push(k);data.set(k,copy(value));return true;}};
  return store;
}
function token(store,actor={k:'code',c:'STAFFONE',kind:'staff',inst:'Synthetic School',perms:['writer']}) {
  if(actor.k==='sys'){const password=store.data.get('pw-sys');actor={...actor,authVersion:createHash('sha256').update(password.salt+':'+password.hash).digest('hex')};}
  const raw=Buffer.from(JSON.stringify({...actor,exp:Date.now()+3600000})).toString('base64url');
  return raw+'.'+createHmac('sha256',store.data.get('token-secret').secret).update(raw).digest('base64url');
}
const analysis=()=>Object.fromEntries(['facts','interpretations','control','influence','outsideControl','responsibility','resources','barriers','agreements','openQuestions','followUp'].map(k=>[k,[]]));
function provider(inspect,wait) {return {id:'synthetic',model:'single-model',async complete(request){inspect?.(request);await wait?.();return {text:JSON.stringify({message:'ניפגש מחר בשעה שמונה.',why:'הניסוח ברור.',next:'אפשר להעתיק ולשלוח.',clarification:'',analysis:analysis()}),model:'actual-single-model'};}};}
const call=(store,auth,body,deps)=>handleCommunication(store,{token:auth,...body},deps);
async function generated(store,auth=token(store),extra={},deps={providerFactory:()=>provider()}) {
  const [status,out]=await call(store,auth,{action:'singleGenerate',requestId:randomUUID(),input:{text:'כתבי הודעה לצוות: ניפגש מחר בשמונה.',audience:'צוות',format:'הודעה',localDetails:'בחדר המורים',signature:'יעל'},...extra},deps);
  assert.equal(status,200,JSON.stringify(out));return {...out,auth};
}

test('single generation uses the shared engine and returns signed versioned sources without conversation writes',async()=>{
  const store=fixture();let request;
  const {document,proof}=await generated(store,undefined,{}, {providerFactory:()=>provider(value=>{request=value;})});
  assert.equal(document.mode,'single');assert.equal(document.revision,1);assert.match(proof,/^[0-9a-f]{64}$/);
  assert.deepEqual(document.versions,CORE.VERSIONS);assert.deepEqual(document.actions[0].versions,CORE.VERSIONS);
  assert.equal(document.latestAI.model.id,'actual-single-model');
  assert.equal(document.entries.find(e=>e.id===document.latestAI.entryId).kind,'draft');
  assert.ok(document.entries.some(e=>e.text===document.input.text));
  const envelope=JSON.parse(request.messages[0].content);
  assert.equal(envelope.communicationMode,'single');assert.equal(envelope.action,'suggest');
  assert.deepEqual(envelope.composition,{format:'הודעה',localDetails:'בחדר המורים',signature:'יעל'});
  assert.ok(request.system.includes(CORE.PRINCIPLES[17]));
  assert.deepEqual(store.writes,[]);assert.equal([...store.data.keys()].some(k=>k.startsWith('cc:')),false);
  assert.equal('research' in document,false);
});

test('shared and open writer sessions can compose but cannot persist or convert',async()=>{
  const store=fixture();
  for(const actor of [{k:'code',c:'LEGACY',kind:'legacy',inst:'Synthetic School',perms:['writer']},{k:'inst',inst:'Synthetic School'},{k:'open',o:'synthetic',perms:['writer']}]) {
    const auth=token(store,actor),result=await generated(store,auth);
    const [status,out]=await call(store,auth,{action:'convert',id:randomUUID(),requestId:randomUUID(),expectedRevision:null,document:result.document,proof:result.proof});
    assert.equal(status,403);assert.equal(out.code,'ACCESS_DENIED');assert.equal(result.document.entries.at(-1).kind,'draft');
  }
  assert.deepEqual(store.writes,[]);
  // Course permissions are evaluated live; cached writer claims do not grant it.
  const [status]=await call(store,token(store,{k:'code',c:'COURSE',kind:'course',inst:'Synthetic School',s:'0123456789abcdef',perms:['writer']}),{action:'singleGenerate',requestId:randomUUID(),input:{text:'כתבי הודעה'}},{providerFactory:()=>provider()});
  assert.equal(status,403);
});

test('material extraction has signed full-text provenance and rejects tampered materials',async()=>{
  const store=fixture(),auth=token(store),source='שורה ראשונה בעברית\nשורה שנייה מלאה';
  const [status,out]=await call(store,auth,{action:'singleExtract',requestId:randomUUID(),attachment:{kind:'text',name:'מקור.txt',text:source}});
  assert.equal(status,200,JSON.stringify(out));assert.equal(out.material.text,source);assert.deepEqual(out.material.versions,CORE.VERSIONS);
  const saved=await generated(store,auth,{input:{text:'כתבי מכתב לפי המקור',materials:[out]}});
  const original=saved.document.entries.find(e=>e.id===out.material.id);
  assert.equal(original.text,source);assert.deepEqual(original.source,out.material.source);
  const tampered=copy(out);tampered.material.text='תוכן מזויף';
  const [denied,body]=await call(store,auth,{action:'singleGenerate',requestId:randomUUID(),input:{text:'כתבי מכתב',materials:[tampered]}},{providerFactory:()=>provider()});
  assert.equal(denied,400);assert.equal(body.code,'PROVENANCE_INVALID');assert.deepEqual(store.writes,[]);
});

test('manual versions and complete single provenance convert atomically without sent claims or duplicate retry rows',async()=>{
  const store=fixture(),single=await generated(store),draft=single.document.entries.at(-1);
  const [editStatus,edited]=await call(store,single.auth,{action:'singleEdit',requestId:randomUUID(),document:single.document,proof:single.proof,entryId:draft.id,text:'גרסה ידנית מדויקת.'});
  assert.equal(editStatus,200,JSON.stringify(edited));assert.equal(edited.document.entries.at(-1).revisions[0].text,draft.text);
  assert.deepEqual(store.writes,[]);
  const body={action:'convert',id:randomUUID(),requestId:randomUUID(),expectedRevision:null,document:edited.document,proof:edited.proof};
  const [status,out]=await call(store,single.auth,body);
  assert.equal(status,200,JSON.stringify(out));assert.equal(out.conversation.mode,'continuity');
  assert.deepEqual(out.conversation.entries,edited.document.entries);assert.deepEqual(out.conversation.origin.input,edited.document.input);
  assert.deepEqual(out.conversation.origin.actions,edited.document.actions);assert.deepEqual(out.conversation.origin.versions,edited.document.versions);
  assert.equal(out.conversation.entries.some(e=>e.kind==='sent'||e.sentEntryId),false);
  assert.equal(out.conversation.actions.at(-1).action,'convert');assert.deepEqual(out.conversation.actions.at(-1).versions,CORE.VERSIONS);
  assert.deepEqual(await call(store,single.auth,body),[200,out]);assert.equal(store.writes.length,1);
});

test('forged and foreign documents cannot gain provenance or be converted',async()=>{
  const store=fixture(),single=await generated(store),foreign=token(store,{k:'code',c:'STAFFTWO',kind:'staff',inst:'Synthetic School',perms:['writer']});
  const edited=copy(single.document);edited.entries.at(-1).model.id='forged-model';
  for(const [auth,document,proof] of [[single.auth,edited,single.proof],[foreign,single.document,single.proof],[single.auth,single.document,'0'.repeat(64)]]) {
    const [status,out]=await call(store,auth,{action:'convert',id:randomUUID(),requestId:randomUUID(),expectedRevision:null,document,proof});
    assert.equal(status,400);assert.equal(out.code,'PROVENANCE_INVALID');
  }
  assert.deepEqual(store.writes,[]);
});

test('single revisions use exact selected draft and current inputs while retaining prior source and model versions for conversion',async()=>{
  const store=fixture(),single=await generated(store),oldDraft=single.document.entries.at(-1);let request;
  const [status,revised]=await call(store,single.auth,{action:'singleGenerate',requestId:randomUUID(),document:single.document,proof:single.proof,
    input:{text:'כתבי הודעה חדשה לפגישה ביום שני',audience:'הורים',format:'מכתב',instruction:'קצרי בלי לשנות את העובדות'},entryId:oldDraft.id,revisionStyle:'shorter'},
    {providerFactory:()=>provider(value=>{request=JSON.parse(value.messages[0].content);})});
  assert.equal(status,200,JSON.stringify(revised));assert.equal(revised.document.revision,2);
  const {communicationMode,...expectedDraft}=oldDraft;
  assert.deepEqual(request.selectedDraft,expectedDraft);assert.equal(request.history.some(e=>e.text===single.document.input.text),false);
  assert.ok(request.history.some(e=>e.text==='כתבי הודעה חדשה לפגישה ביום שני'));
  assert.ok(revised.document.entries.some(e=>e.text===single.document.input.text));
  assert.deepEqual(revised.document.entries.find(e=>e.id===oldDraft.id),oldDraft);
  assert.equal(revised.document.entries.at(-1).draftId,oldDraft.id);assert.equal(revised.document.entries.at(-1).revisionStyle,'shorter');
  assert.deepEqual(revised.document.actions.map(a=>a.action),['singleGenerate','singleGenerate']);
  assert.deepEqual(store.writes,[]);
});

test('live access revoked during single generation or material extraction discards results without storing content',async()=>{
  for(const mode of ['singleGenerate','singleExtract']) {
    const store=fixture(),auth=token(store);let start,release;
    const began=new Promise(resolve=>{start=resolve;}),gate=new Promise(resolve=>{release=resolve;});
    const deps={providerFactory:()=>({id:'openai',model:'synthetic',async complete(){start();await gate;return {text:JSON.stringify(mode==='singleGenerate'?{message:'טיוטה זמנית',why:'',next:'',clarification:'',analysis:analysis()}:{unreadable:false,text:'',description:'תיאור נראה'})};}})};
    const input=mode==='singleGenerate'?{input:{text:'כתבי הודעה'}}:{attachment:{kind:'image',name:'תמונה.png',mediaType:'image/png',data:Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0]).toString('base64')}};
    const pending=call(store,auth,{action:mode,requestId:randomUUID(),...input},deps);
    await began;store.data.get('code:STAFFONE').revoked=true;release();
    const [status,out]=await pending;assert.equal(status,403);assert.equal(out.code,'ACCESS_DENIED');assert.deepEqual(store.writes,[]);
  }
});

test('objective image materials and exact text use the shared extraction boundary and binary data never enter the signed artifact',async()=>{
  const store=fixture(),auth=token(store);let request;
  const data=Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0]).toString('base64');
  const [status,out]=await call(store,auth,{action:'singleExtract',requestId:randomUUID(),attachment:{kind:'image',name:'ציור.png',mediaType:'image/png',data}},
    {providerFactory:()=>({id:'openai',model:'vision-model',async complete(value){request=value;return {text:JSON.stringify({unreadable:false,text:'',description:'בציור נראים שני עצים ליד בית.'}),model:'actual-vision-model'};}})});
  assert.equal(status,200,JSON.stringify(out));assert.equal(out.material.source.purpose,'communication-material');assert.equal(out.material.source.method,'vision-material');
  assert.equal(out.material.model.id,'actual-vision-model');assert.match(request.system,/visual description/i);
  assert.equal(request.messages[0].content[1].type,'image');assert.equal('data' in out.material,false);assert.equal('attachment' in out.material,false);
  assert.doesNotMatch(JSON.stringify(out),new RegExp(data));assert.deepEqual(store.writes,[]);
});

test('material proofs are identity-bound, renewals keep the same actor and system single mode is supported',async()=>{
  const store=fixture(),auth=token(store);
  const [,material]=await call(store,auth,{action:'singleExtract',requestId:randomUUID(),attachment:{kind:'text',name:'מידע.txt',text:'מקור מדויק'}});
  const otherAuth=token(store,{k:'code',c:'STAFFTWO',kind:'staff',inst:'Synthetic School',perms:['writer']});
  const [status,out]=await call(store,otherAuth,{action:'singleGenerate',requestId:randomUUID(),input:{text:'כתבי הודעה',materials:[material]}},{providerFactory:()=>provider()});
  assert.equal(status,400);assert.equal(out.code,'PROVENANCE_INVALID');
  assert.equal((await generated(store,token(store),{input:{text:'כתבי הודעה',materials:[material]}})).document.entries.find(e=>e.id===material.material.id).text,'מקור מדויק');
  assert.equal((await generated(store,token(store,{k:'sys'}))).document.mode,'single');assert.deepEqual(store.writes,[]);
});

test('single image extraction never signs an invented emotional description after failed repair',async()=>{
  const store=fixture(),auth=token(store);let calls=0;
  const data=Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0]).toString('base64');
  const [status,out]=await call(store,auth,{action:'singleExtract',requestId:randomUUID(),attachment:{kind:'image',name:'ציור.png',mediaType:'image/png',data}},
    {providerFactory:()=>({id:'openai',model:'synthetic-vision',async complete(){calls++;return {text:JSON.stringify({text:'הוא מרגיש שמחה.',description:'ההורה מרגיש שהמורה מתעלמת.',unreadable:false})};}})});
  assert.equal(status,422);assert.equal(out.code,'AI_OUTPUT_INVALID');assert.equal(calls,2);
  assert.equal('material' in out,false);assert.equal('proof' in out,false);assert.deepEqual(store.writes,[]);
});

test('forged previous document revisions are rejected before the provider is opened',async()=>{
  const store=fixture(),single=await generated(store);let calls=0;
  const deps={providerFactory(){calls++;return provider();}};
  const forged=copy(single.document);forged.entries.at(-1).text='טיוטה שמקורה לא ידוע';
  for(const body of [{document:forged,proof:single.proof},{document:single.document},{proof:single.proof}]) {
    const [status,out]=await call(store,single.auth,{action:'singleGenerate',requestId:randomUUID(),input:{text:'שפרי'},...body},deps);
    assert.equal(status,400);assert.equal(out.code,'PROVENANCE_INVALID');
  }
  assert.equal(calls,0);assert.deepEqual(store.writes,[]);
});

test('single invalid inputs and limits fail visibly without invoking the model or truncating content',async()=>{
  const store=fixture(),auth=token(store);let calls=0;const deps={providerFactory(){calls++;return provider();}};
  for(const body of [{requestId:'invalid',input:{text:'כתבי הודעה'}},{requestId:randomUUID(),input:{text:''}},{requestId:randomUUID(),input:{text:'כתבי הודעה',materials:'bad'}},
    {requestId:randomUUID(),input:{text:'כתבי הודעה'},revisionStyle:'shorter'},{requestId:randomUUID(),input:{text:'כתבי הודעה'},entryId:randomUUID()}]) {
    assert.equal((await call(store,auth,{action:'singleGenerate',...body},deps))[0],400);
  }
  const [status,out]=await call(store,auth,{action:'singleGenerate',requestId:randomUUID(),input:{text:'א'.repeat(120001)}},deps);
  assert.equal(status,413);assert.equal(out.code,'STORAGE_LIMIT');assert.equal(calls,0);assert.deepEqual(store.writes,[]);
});

test('provider failure, unreadable extraction and transient response retry never create a conversation',async()=>{
  const store=fixture(),auth=token(store),body={action:'singleGenerate',requestId:randomUUID(),input:{text:'כתבי הודעה'}};
  const [status,out]=await call(store,auth,body,{providerFactory(){throw new Error('private-provider-secret');}});
  assert.equal(status,503);assert.doesNotMatch(JSON.stringify(out),/private-provider-secret/);
  const first=await call(store,auth,body,{providerFactory:()=>provider()}),retry=await call(store,auth,body,{providerFactory:()=>provider()});
  assert.equal(first[0],200);assert.equal(retry[0],200);assert.notEqual(first[1].document.id,retry[1].document.id);
  const [bad,unreadable]=await call(store,auth,{action:'singleExtract',requestId:randomUUID(),attachment:{kind:'image',name:'לא-קריא.png',mediaType:'image/png',data:Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0]).toString('base64')}},
    {providerFactory:()=>({id:'openai',model:'synthetic',async complete(){return {text:JSON.stringify({unreadable:true,text:'',description:''})};}})});
  assert.equal(bad,422);assert.equal(unreadable.code,'ATTACHMENT_UNREADABLE');assert.deepEqual(store.writes,[]);
});

test('conversion handles dropped committed responses and conflicts without duplicate rows or resurrecting deletion',async()=>{
  const store=fixture(),single=await generated(store),body={action:'convert',id:randomUUID(),requestId:randomUUID(),expectedRevision:null,document:single.document,proof:single.proof};
  const cas=store.compareSet;let dropped=false;
  store.compareSet=async(...args)=>{const result=await cas(...args);if(result&&!dropped){dropped=true;throw new Error('synthetic dropped response');}return result;};
  assert.equal((await call(store,single.auth,body))[0],503);
  const [status,out]=await call(store,single.auth,body);assert.equal(status,200);assert.deepEqual(out.conversation.entries,single.document.entries);assert.equal(store.writes.length,1);
  const [conflict]=await call(store,single.auth,{...body,requestId:randomUUID()});assert.equal(conflict,409);
  const [deleted]=await call(store,single.auth,{action:'delete',id:body.id,requestId:randomUUID(),expectedRevision:out.conversation.revision});assert.equal(deleted,200);
  assert.equal((await call(store,single.auth,body))[0],409);assert.equal([...store.data].filter(([key])=>key.startsWith('cc:')).length,1);
  assert.equal([...store.data].find(([key])=>key.startsWith('cc:'))[1]._deleted,true);
});

test('old signed provenance survives new manual and AI revisions and conversion without rewriting the original versions',async()=>{
  const store=fixture(),single=await generated(store),old={tool:'1.0.0',prompt:'1.0.0',engine:'1.0.0',principles:'18-1.0.0',schema:1};
  const document=copy(single.document);document.versions={...old};for(const entry of document.entries)entry.versions={...old};document.actions[0].versions={...old};
  const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().filter(k=>value[k]!==undefined).map(k=>[k,stable(value[k])])):value;
  const actor=createHash('sha256').update(JSON.stringify(['code','STAFFONE','Synthetic School','staff',null])).digest('hex');
  const proof=createHmac('sha256',store.data.get('token-secret').secret).update('be-good/communication/document/'+actor+'/'+JSON.stringify(stable(document))).digest('hex');
  const [,edited]=await call(store,single.auth,{action:'singleEdit',requestId:randomUUID(),document,proof,entryId:document.latestAI.entryId,text:'עריכה בגרסה החדשה'});
  assert.deepEqual(edited.document.versions,old);assert.deepEqual(edited.document.actions[0].versions,old);assert.deepEqual(edited.document.actions[1].versions,CORE.VERSIONS);
  const draft=edited.document.entries.at(-1);assert.deepEqual(draft.revisions[0].versions,old);assert.deepEqual(draft.versions,CORE.VERSIONS);
  const [regeneratedStatus,regenerated]=await call(store,single.auth,{action:'singleGenerate',requestId:randomUUID(),document:edited.document,proof:edited.proof,input:edited.document.input,entryId:draft.id,revisionStyle:'warmer'},{providerFactory:()=>provider()});
  assert.equal(regeneratedStatus,200);assert.deepEqual(regenerated.document.actions[0].versions,old);assert.deepEqual(regenerated.document.actions.at(-1).versions,CORE.VERSIONS);
  assert.deepEqual(regenerated.document.entries.find(e=>e.id===draft.id),draft);assert.equal(regenerated.document.entries.at(-1).draftId,draft.id);
  const [status,converted]=await call(store,single.auth,{action:'convert',id:randomUUID(),requestId:randomUUID(),expectedRevision:null,document:regenerated.document,proof:regenerated.proof});
  assert.equal(status,200);assert.deepEqual(converted.conversation.origin.versions,old);assert.deepEqual(converted.conversation.entries,regenerated.document.entries);assert.deepEqual(converted.conversation.origin.actions,regenerated.document.actions);assert.deepEqual(converted.conversation.versions,CORE.VERSIONS);
});

test('conversion preserves source edits and newly uploaded full materials after AI without requiring regeneration',async()=>{
  const store=fixture(),single=await generated(store);
  const [,material]=await call(store,single.auth,{action:'singleExtract',requestId:randomUUID(),attachment:{kind:'text',name:'מידע נוסף.txt',text:'מקור מלא נוסף\nשורה נוספת שמורה'}});
  let calls=0;
  const input={...single.document.input,text:'הנחיה חדשה לאחר יצירת הטיוטה',audience:'הורים',instruction:'',localDetails:'פרט מקומי חדש',materials:[material]};
  const body={action:'convert',id:randomUUID(),requestId:randomUUID(),expectedRevision:null,document:single.document,proof:single.proof,input};
  const [status,out]=await call(store,single.auth,body,{providerFactory(){calls++;return provider();}});
  assert.equal(status,200,JSON.stringify(out));assert.deepEqual(out.conversation.origin.input,input);
  assert.ok(out.conversation.entries.some(e=>e.text===single.document.input.text));assert.ok(out.conversation.entries.some(e=>e.text===input.text));
  assert.equal(out.conversation.entries.find(e=>e.id===material.material.id).text,material.material.text);
  assert.deepEqual(out.conversation.entries.find(e=>e.id===single.document.latestAI.entryId),single.document.entries.at(-1));
  assert.equal(out.conversation.origin.actions.at(-1).action,'singleInputUpdate');assert.deepEqual(out.conversation.origin.actions.at(-1).versions,CORE.VERSIONS);
  assert.equal(calls,0);assert.deepEqual(await call(store,single.auth,body),[200,out]);
  assert.equal((await call(store,single.auth,{...body,input:{...input,text:'בקשה שונה'}}))[1].code,'REQUEST_REUSED');
  const [,same]=await call(store,single.auth,{...body,id:randomUUID(),requestId:randomUUID(),input:single.document.input});
  assert.deepEqual(same.conversation.entries,single.document.entries);assert.deepEqual(same.conversation.origin.actions,single.document.actions);
});

test('conversion can preserve a cleared source field and pending metadata/material changes in an existing signed document',async()=>{
  const store=fixture(),single=await generated(store);
  const [,material]=await call(store,single.auth,{action:'singleExtract',requestId:randomUUID(),attachment:{kind:'text',name:'מקור חדש.txt',text:'חומר שנוסף לאחר הטיוטה'}});
  let calls=0;
  const input={...single.document.input,text:'',localDetails:'פרט חדש לשיחה המתמשכת',materials:[material]};
  const [status,out]=await call(store,single.auth,{action:'convert',id:randomUUID(),requestId:randomUUID(),expectedRevision:null,document:single.document,proof:single.proof,input},{providerFactory(){calls++;return provider();}});
  assert.equal(status,200,JSON.stringify(out));assert.deepEqual(out.conversation.origin.input,input);
  assert.ok(out.conversation.entries.some(entry=>entry.text===single.document.input.text));
  assert.equal(out.conversation.entries.find(entry=>entry.id===material.material.id).text,material.material.text);
  assert.ok(out.conversation.entries.some(entry=>entry.source?.field==='composition'&&entry.text.includes(input.localDetails)));
  assert.deepEqual(out.conversation.entries.find(entry=>entry.id===single.document.latestAI.entryId),single.document.entries.at(-1));
  assert.equal(out.conversation.origin.actions.at(-1).action,'singleInputUpdate');assert.equal(calls,0);
});

test('long single materials preserve every summary model/source/version as audit provenance without feeding past audit into later writing',async()=>{
  const store=fixture(),auth=token(store),raw='מקור מלא נשמר. '.repeat(3500);
  const [,material]=await call(store,auth,{action:'singleExtract',requestId:randomUUID(),attachment:{kind:'text',name:'מקור ארוך.txt',text:raw}});
  const requests=[];let summaryCalls=0;
  const summaryProvider={id:'anthropic',model:'configured-alias',contextWindowTokens:32768,async complete(input){
    const request=JSON.parse(input.messages[0].content);requests.push(request);
    if(request.operation==='context-summary') {summaryCalls++;return {text:JSON.stringify({facts:['מקור מלא נשמר.'],commitments:[],disagreements:[],openQuestions:[],uncertainty:[],drafts:[],sourceEntryIds:request.sourceEntryIds}),raw:{model:'actual-summary-model'}};}
    return {text:JSON.stringify({message:'טיוטה מהמקור המלא.',why:'',next:'',clarification:'',analysis:analysis()}),raw:{model:'actual-final-model'}};
  }};
  const [status,out]=await call(store,auth,{action:'singleGenerate',requestId:randomUUID(),input:{text:'כתבי הודעה לפי כל המקור המצורף',materials:[material]}},{providerFactory:()=>summaryProvider});
  assert.equal(status,200,JSON.stringify(out));assert.ok(summaryCalls>0);
  const draft=out.document.entries.find(entry=>entry.id===out.document.latestAI.entryId);
  assert.equal(draft.contextSummaries?.length,summaryCalls);
  assert.equal(out.document.entries.find(entry=>entry.id===material.material.id).text,raw);
  assert.equal(out.document.entries.some(entry=>entry.kind==='summary'),false);
  assert.deepEqual(draft.model,{provider:'anthropic',id:'actual-final-model'});
  for(const summary of draft.contextSummaries) {assert.deepEqual(summary.model,{provider:'anthropic',id:'actual-summary-model'});assert.deepEqual(summary.versions,CORE.VERSIONS);assert.equal(summary.source.purpose,'context');assert.ok(summary.source.entryIds.length>0);assert.ok(summary.source.entryIds.every(id=>draft.source.entryIds.includes(id)));}
  assert.deepEqual(JSON.parse(JSON.stringify(out.document)).entries.find(entry=>entry.id===draft.id).contextSummaries,draft.contextSummaries);
  const [convertedStatus,converted]=await call(store,auth,{action:'convert',id:randomUUID(),requestId:randomUUID(),expectedRevision:null,document:out.document,proof:out.proof});
  assert.equal(convertedStatus,200);assert.deepEqual(converted.conversation.entries,out.document.entries);
  let nextRequest;
  const [nextStatus,next]=await call(store,auth,{action:'singleGenerate',requestId:randomUUID(),document:out.document,proof:out.proof,entryId:draft.id,revisionStyle:'shorter',input:{text:'קצרי את הטיוטה',materials:[]}},{providerFactory:()=>provider(value=>{nextRequest=JSON.parse(value.messages[0].content);})});
  assert.equal(nextStatus,200);assert.equal(nextRequest.selectedDraft.text,draft.text);assert.equal(nextRequest.history.some(entry=>entry.id===material.material.id),false);
  assert.doesNotMatch(JSON.stringify(nextRequest),/contextSummaries|actual-summary-model/);
  assert.deepEqual(next.document.entries.find(entry=>entry.id===draft.id).contextSummaries,draft.contextSummaries);
});
