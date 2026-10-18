import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { generateCommunication, extractCommunicationAttachment } from '../lib/communication-ai.mjs';
import { providerSystem } from '../lib/provider-input.mjs';

const analysisKeys = ['facts','interpretations','control','influence','outsideControl','responsibility','resources','barriers','agreements','openQuestions','followUp'];
const output = (patch = {}) => ({ message:'אפשר לתאם שיחה ולהקשיב לשאלות שעלו.', why:'הנוסח מזמין בירור מעשי.', next:'אפשר להציע זמן מתאים לשיחה.', clarification:'', analysis:Object.fromEntries(analysisKeys.map(k=>[k,[]])), ...patch });
function provider(responses = [output()], extra = {}) {
  const calls=[];
  return {id:'anthropic',model:'configured-test-model',calls,...extra,async complete(call) {
    calls.push(call);
    const value=typeof responses==='function'?await responses(call,calls.length):responses.shift();
    if(value instanceof Error)throw value;
    return {text:typeof value==='string'?value:JSON.stringify(value),raw:{model:'configured-test-model'}};
  }};
}
function conversation(entries = [{id:'r1',kind:'received',text:'אני רוצה להבין מה קרה.',at:'2026-10-13T07:00:00Z'}]) { return {id:'conv-1',title:'שיח עם הורה',audience:'הורים',status:'active',entries}; }
const textRequest = call => call.messages.map(m=>typeof m.content==='string'?m.content:m.content.filter(x=>x.type==='text').map(x=>x.text).join('\n')).join('\n');

test('single composition uses the same eighteen-principle engine and optional writer fields',async()=>{
  const composition={format:'הודעה שוטפת',localDetails:'ספריית בית הספר',signature:'צוות בית הספר'};
  const p=provider();
  await generateCommunication({conversation:conversation([{id:'input',kind:'note',text:'כתבי הודעה על מפגש ביום חמישי.'}]),action:'suggest',communicationMode:'single',composition,provider:p});
  const request=JSON.parse(textRequest(p.calls[0]));
  assert.equal(request.communicationMode,'single');assert.deepEqual(request.composition,composition);
  const core=createRequire(import.meta.url)('../../app/lib/communication-core.js');
  assert.equal(core.PRODUCT_NAME,'תקשורת מקדמת חוסן חברתי');assert.equal(core.VERSIONS.engine,'1.1.1');
  assert.equal(core.PRINCIPLES.length,18);
  for(const principle of core.PRINCIPLES)assert.ok(p.calls[0].system.includes(principle));
  assert.equal(p.calls[0].policy,'communication-continuity');
  assert.match(p.calls[0].system,/single.*compose/i);
});

test('single image materials support objective description while ongoing OCR stays transcription',async()=>{
  const attachment={kind:'image',name:'drawing.png',mediaType:'image/png',data:Buffer.from('89504e470d0a1a0a','hex').toString('base64')};
  const materialProvider=provider([{text:'',description:'בציור נראים בית ועץ.',unreadable:false}]);
  const material=await extractCommunicationAttachment({attachment,purpose:'communication-material',provider:materialProvider});
  assert.equal(material.text,'תיאור חזותי:\nבציור נראים בית ועץ.');assert.equal(material.source.purpose,'communication-material');
  assert.match(materialProvider.calls[0].system,/objective.*visual/i);
  const ocrProvider=provider([{text:'מפגש ביום חמישי',unreadable:false}]);
  await extractCommunicationAttachment({attachment,provider:ocrProvider});
  assert.match(ocrProvider.calls[0].system,/Extract the complete visible readable text/);
  assert.doesNotMatch(ocrProvider.calls[0].system,/objective.*visual/i);
});
const summaryOutput = request => ({facts:['עובדות המקור נשמרו.'],commitments:[],disagreements:[],openQuestions:[],uncertainty:[],drafts:[],sourceEntryIds:request.sourceEntryIds});

test('image materials preserve exact emotional source text separately from the objective description',async()=>{
  const attachment={kind:'image',name:'poem.png',mediaType:'image/png',data:Buffer.from('89504e470d0a1a0a','hex').toString('base64')};
  const visible='הוא מרגיש שמחה.\nההורה מרגיש שהמורה מקשיבה.';
  const description='בציור נראים בית ועץ ירוק.';
  const p=provider([{text:visible,description,unreadable:false}]);
  const result=await extractCommunicationAttachment({attachment,purpose:'communication-material',provider:p});
  assert.equal(result.text,'טקסט נראה:\n'+visible+'\n\nתיאור חזותי:\n'+description);
  assert.equal(p.calls.length,1);assert.equal(result.source.method,'vision-material');
  const ocr=await extractCommunicationAttachment({attachment,provider:provider([{text:visible,unreadable:false}])});
  assert.equal(ocr.text,visible);
});

test('image material attribution guard repairs or rejects invented visual feelings without altering quoted text',async()=>{
  const attachment={kind:'image',name:'drawing.png',mediaType:'image/png',data:Buffer.from('89504e470d0a1a0a','hex').toString('base64')};
  const bad={text:'הוא מרגיש שמחה.',description:'ההורה מרגיש שהמורה מתעלמת.',unreadable:false};
  const good={...bad,description:'בציור נראים בית ועץ.'};
  const repaired=provider([bad,good]);
  const result=await extractCommunicationAttachment({attachment,purpose:'communication-material',provider:repaired});
  assert.equal(repaired.calls.length,2);assert.ok(result.text.includes(bad.text));assert.ok(result.text.includes(good.description));assert.ok(!result.text.includes(bad.description));
  const rejected=provider([bad,bad]);
  await assert.rejects(extractCommunicationAttachment({attachment,purpose:'communication-material',provider:rejected}),error=>error.code==='AI_OUTPUT_INVALID');
  assert.equal(rejected.calls.length,2);
});

test('compacted revisions anchor the exact canonical selected draft and exclude duplicate private metadata',async()=>{
  const selected={id:'draft-b',kind:'draft',text:'אפשר לבדוק את הקריאה ביום שני בשעה 12:00.',at:'2026-10-02',why:'בירור הקריאה יחד',next:'בדיקת מועד פנוי',analysis:{...output().analysis,facts:['הבקשה עוסקת בקריאה.']},source:{entryIds:['received-1']},versions:{prompt:'prior'}};
  const other={id:'draft-a',kind:'draft',text:'אפשר לדבר על הנוכחות ביום שישי בשעה 16:00.',at:'2026-10-01'};
  const c={...conversation([other,selected,...Array.from({length:16},(_,i)=>({id:'long-'+i,kind:'received',text:'א'.repeat(2200),at:'2026-10-03'}))]),createdAt:'2026-10-01',updatedAt:'2026-10-03',revision:8,rounds:2,versions:{tool:'1.0.0'},latestAI:{output:{message:other.text.repeat(2000)}},research:{private:'DO NOT SEND'},_requests:{private:'DO NOT SEND'},actions:[{private:'DO NOT SEND'}]};
  const p=provider(call=>{const request=JSON.parse(textRequest(call));return request.operation==='context-summary'?summaryOutput(request):output();},{contextWindowTokens:28000});
  await generateCommunication({conversation:c,action:'suggest',revisionStyle:'shorter',draft:{...selected,text:'untrusted caller copy'},provider:p});
  const request=JSON.parse(textRequest(p.calls.at(-1)));
  assert.ok(request.history.every(entry=>entry.kind==='summary'));
  assert.deepEqual(request.selectedDraft,selected);
  assert.deepEqual(Object.keys(request.conversation).sort(),['id','title','audience','status','createdAt','updatedAt','revision','rounds','versions'].sort());
  assert.ok(!JSON.stringify(request).includes('DO NOT SEND'));
  assert.ok(!Object.hasOwn(request.conversation,'latestAI'));
});

test('a selected draft beyond the fixed prompt budget fails before summaries or generation',async()=>{
  const draft={id:'oversized',kind:'draft',text:'א'.repeat(30000),at:'2026-10-13'};
  const p=provider(call=>summaryOutput(JSON.parse(textRequest(call))),{contextWindowTokens:28000});
  await assert.rejects(generateCommunication({conversation:conversation([draft]),action:'suggest',revisionStyle:'shorter',draft,provider:p}),error=>error.code==='AI_CONTEXT_LIMIT'&&error.status===413);
  assert.equal(p.calls.length,0);
});

test('maximum-size Hebrew history summaries run with bounded concurrency and retain batch order',async()=>{
  let active=0,maxActive=0,summaryIndex=0;
  const completionOrder=[],requests=[];
  const p=provider(async call=>{
    const request=JSON.parse(textRequest(call));
    if(request.operation!=='context-summary')return output();
    const index=summaryIndex++;requests.push(request);active++;maxActive=Math.max(maxActive,active);
    await new Promise(resolve=>setTimeout(resolve,index%2===0?12:1));
    active--;completionOrder.push(index);
    return {...summaryOutput(request),facts:[`סיכום אצווה ${index}`]};
  });
  const result=await generateCommunication({conversation:conversation([{id:'maximum',kind:'received',text:'א'.repeat(120000),at:'2026-10-13'}]),action:'suggest',provider:p});
  assert.ok(requests.length>2);
  assert.equal(maxActive,2);
  assert.ok(completionOrder.indexOf(1)<completionOrder.indexOf(0));
  assert.deepEqual(result.summaries.map(entry=>JSON.parse(entry.text).facts[0]),requests.map((_,i)=>`סיכום אצווה ${i}`));
  assert.deepEqual(JSON.parse(textRequest(p.calls.at(-1))).history.map(entry=>entry.context.facts[0]),requests.map((_,i)=>`סיכום אצווה ${i}`));
  assert.equal(active,0);
});

test('summary failure waits for started work and does not schedule remaining batches',async()=>{
  let active=0,started=0,completed=0;
  const p=provider(async call=>{
    const request=JSON.parse(textRequest(call));
    assert.equal(request.operation,'context-summary');
    const index=started++;active++;
    try{await new Promise(resolve=>setTimeout(resolve,index===0?1:15));if(index===0)throw new Error('summary service failure');completed++;return summaryOutput(request);}
    finally{active--;}
  });
  await assert.rejects(generateCommunication({conversation:conversation([{id:'maximum',kind:'received',text:'א'.repeat(120000),at:'2026-10-13'}]),action:'suggest',provider:p}),/summary service failure/);
  assert.equal(started,2);
  assert.equal(completed,started-1);
  assert.equal(active,0);
  await new Promise(resolve=>setTimeout(resolve,20));
  assert.equal(p.calls.length,started);
});

test('every middle fragment retains source role, date and draft or instruction links',async()=>{
  const entries=[{id:'d',kind:'draft',text:'א'.repeat(16000)+' 😀',at:'2026-10-01',draftId:'prior-draft',sentEntryId:'sent-record'}, {id:'n',kind:'note',text:'ב'.repeat(16000),at:'2026-10-02',notePurpose:'instruction'}];
  const seen=[];
  const p=provider(call=>{const request=JSON.parse(textRequest(call));if(request.operation==='context-summary'){seen.push(...request.fragments);return summaryOutput(request);}return output();},{contextWindowTokens:28000});
  await generateCommunication({conversation:conversation(entries),action:'suggest',provider:p});
  for(const entry of entries){
    const fragments=seen.filter(fragment=>fragment.entryId===entry.id);
    assert.ok(fragments.length>=3);
    assert.equal(fragments.map(fragment=>fragment.content).join(''),JSON.stringify(entry));
    for(const fragment of fragments){for(const key of ['kind','at','draftId','sentEntryId','notePurpose'])if(Object.hasOwn(entry,key))assert.equal(fragment[key],entry[key]);assert.ok(!/[\uD800-\uDBFF]$/.test(fragment.content));}
  }
});

test('full canonical ordered history, draft state, versions and configured model reach provider',async()=>{
  const entries=[{id:'old',kind:'sent',text:'אבדוק ואחזור ביום חמישי.',at:'2026-10-01',versions:{prompt:'old'}},{id:'draft',kind:'draft',text:'הצעה שלא נשלחה',revisions:[{text:'גרסה קודמת'}]},{id:'new',kind:'received',text:'מה התחדש?'}];
  const c=conversation(entries), snapshot=structuredClone(c),p=provider();
  const result=await generateCommunication({conversation:c,action:'continue',provider:p});
  assert.deepEqual(result.model,{provider:'anthropic',id:'configured-test-model'});
  assert.deepEqual(c,snapshot);
  const prompt=textRequest(p.calls[0]);
  for(const entry of entries)assert.ok(prompt.includes(entry.text));
  assert.ok(prompt.indexOf('אבדוק')<prompt.indexOf('מה התחדש'));
  assert.ok(prompt.includes('גרסה קודמת'));
  assert.ok(prompt.includes('"prompt":"old"'));
  assert.equal(p.calls[0].policy,'communication-continuity');
  assert.match(p.calls[0].system,/draft.*sent/i);
});

test('essential clarification returns no suggested draft',async()=>{
  const p=provider([output({message:'',clarification:'מה הוחלט לגבי מועד הפגישה?'})]);
  const r=await generateCommunication({conversation:conversation(),action:'suggest',provider:p});
  assert.equal(r.output.message,'');
  assert.equal(r.output.clarification,'מה הוחלט לגבי מועד הפגישה?');
});

test('invalid JSON gets exactly one repair; valid fenced JSON needs no repair',async()=>{
  const p=provider(['not JSON',output()]);
  assert.ok((await generateCommunication({conversation:conversation(),action:'suggest',provider:p})).output.message);
  assert.equal(p.calls.length,2);
  assert.match(textRequest(p.calls[1]),/repair/i);
  assert.ok(p.calls.every(c=>c.policy==='communication-continuity'));
  const valid=provider(['```json\n'+JSON.stringify(output())+'\n```']);
  await generateCommunication({conversation:conversation(),action:'suggest',provider:valid});
  assert.equal(valid.calls.length,1);
});

test('invalid shape, clarification plus message and speculative certainty are rejected after one repair',async()=>{
  const invalid=[{},output({clarification:'מה קרה?',message:'תשובה'}),output({analysis:{...output().analysis,interpretations:['ההורה כועס ורוצה לשלוט בשיחה.']}}),output({why:'ייתכן שפגישה תועיל. ההורה מרגיש שהמורה מתעלמת.'})];
  for(const value of invalid){const p=provider([value,value]);await assert.rejects(generateCommunication({conversation:conversation(),action:'suggest',provider:p}),e=>e.code==='AI_OUTPUT_INVALID');assert.equal(p.calls.length,2);}
});

test('provider failure is not reissued as an output repair',async()=>{
  const p=provider([new Error('network')]);
  await assert.rejects(generateCommunication({conversation:conversation(),action:'suggest',provider:p}),/network/);
  assert.equal(p.calls.length,1);
});

test('revision includes original facts and intent without assuming that draft was sent',async()=>{
  const draft={id:'d1',kind:'draft',text:'אפשר להיפגש ביום שני בשעה 12:00.',why:'בירור משותף',next:'המתנה לתשובה'};
  const p=provider();await generateCommunication({conversation:conversation([draft]),action:'suggest',revisionStyle:'shorter',draft,provider:p});
  assert.ok(textRequest(p.calls[0]).includes(draft.text));
  assert.ok(textRequest(p.calls[0]).includes('shorter'));
  assert.match(p.calls[0].system,/preserve.*facts.*intent/i);
});

test('ten educational scenarios exercise explicit facts, assumptions and expected modes without claiming model factuality',async()=>{
  const scenarios=JSON.parse(await readFile(new URL('../fixtures/communication-scenarios.json',import.meta.url),'utf8'));
  assert.equal(scenarios.length,10);
  for(const s of scenarios){
    const p=provider([output(s.id==='essential-clarification'?{message:'',clarification:s.review.essentialQuestion}:{})]);
    const r=await generateCommunication({conversation:s.conversation,action:s.action,instruction:s.instruction,provider:p});
    for(const e of s.conversation.entries)assert.ok(textRequest(p.calls[0]).includes(e.text),s.id);
    assert.match(p.calls[0].system,/intentions.*emotions.*uncertain/i);
    assert.match(p.calls[0].system,/polic|agreements|outcomes/i);
    if(s.id==='school-management')assert.match(p.calls[0].system,/school management/i);
    if(s.id==='essential-clarification')assert.equal(r.output.message,'');
  }
});

test('long history uses bounded ordered structured summaries with every source ID and retains raw input',async()=>{
  const c=conversation(Array.from({length:16},(_,i)=>({id:'e'+i,kind:i%2?'sent':'received',text:`עובדה ${i}: התחייבות לבירור ביום חמישי. `+'א'.repeat(1300)}))), before=structuredClone(c);
  const p=provider(call=>{
    const request=JSON.parse(textRequest(call));
    if(request.operation==='context-summary')return {facts:['נמסרה התחייבות לבירור ביום חמישי.'],commitments:['הבירור ביום חמישי.'],disagreements:[],openQuestions:['תוצאות הבירור עדיין לא נמסרו.'],uncertainty:['אין מידע על תוצאה.'],drafts:[],sourceEntryIds:request.sourceEntryIds};
    return output();
  },{contextWindowTokens:28000});
  const r=await generateCommunication({conversation:c,action:'continue',provider:p});
  assert.ok(r.summaries.length>1);
  const covered=new Set(r.summaries.flatMap(s=>s.source.entryIds));
  assert.deepEqual([...covered],c.entries.map(e=>e.id));
  assert.ok(r.summaries.every(s=>JSON.parse(s.text).commitments.includes('הבירור ביום חמישי.')));
  assert.deepEqual(c,before);
  for(const call of p.calls)assert.ok(Buffer.byteLength(providerSystem(call.system,call.policy))+Buffer.byteLength(textRequest(call))+call.maxTokens+1024<=p.contextWindowTokens);
});

test('a single very long entry is explicitly split with part provenance and completely consumed',async()=>{
  const raw='תחילה '+'א'.repeat(20000)+' סוף חשוב',seen=[];
  const p=provider(call=>{const request=JSON.parse(textRequest(call));if(request.operation==='context-summary'){seen.push(...request.fragments);return {facts:['תחילה וסוף חשוב נכללו.'],commitments:[],disagreements:[],openQuestions:[],uncertainty:[],drafts:[],sourceEntryIds:request.sourceEntryIds};}return output();},{contextWindowTokens:28000});
  await generateCommunication({conversation:conversation([{id:'large',kind:'received',text:raw}]),action:'suggest',provider:p});
  assert.ok(seen.length>1);
  assert.equal(seen.map(f=>f.content).join(''),JSON.stringify({id:'large',kind:'received',text:raw}));
  assert.ok(seen.every(f=>f.entryId==='large'&&f.part>=1&&f.totalParts===seen.length));
});

test('summary missing a source ID is repaired once instead of silently discarding context',async()=>{
  let n=0;
  const p=provider(call=>{const request=JSON.parse(textRequest(call));if(request.operation!=='context-summary')return output();n++;return {facts:['טקסט המקור נשמר.'],commitments:[],disagreements:[],openQuestions:[],uncertainty:[],drafts:[],sourceEntryIds:n===1?[]:request.sourceEntryIds};},{contextWindowTokens:28000});
  await generateCommunication({conversation:conversation([{id:'large',kind:'received',text:'א'.repeat(12000)}]),action:'suggest',provider:p});
  assert.ok(n>1);
  const requests=p.calls.map(call=>JSON.parse(textRequest(call))),repairs=requests.filter(request=>request.repair);
  assert.equal(repairs.length,1);
  assert.deepEqual(repairs[0].fragments,requests[0].fragments);
});

test('an empty summary cannot silently replace meaningful history',async()=>{
  const p=provider(call=>{const request=JSON.parse(textRequest(call));return {facts:[],commitments:[],disagreements:[],openQuestions:[],uncertainty:[],drafts:[],sourceEntryIds:request.sourceEntryIds};},{contextWindowTokens:28000});
  await assert.rejects(generateCommunication({conversation:conversation([{id:'large',kind:'received',text:'חשוב לזכור את ההתחייבות. '+'א'.repeat(12000)}]),action:'suggest',provider:p}),e=>e.code==='AI_OUTPUT_INVALID');
  const requests=p.calls.map(call=>JSON.parse(textRequest(call))),originals=requests.filter(request=>!request.repair);
  assert.equal(originals.length,2);
  assert.equal(requests.length,4);
  for(const original of originals)assert.equal(requests.filter(request=>request.repair&&JSON.stringify(request.fragments)===JSON.stringify(original.fragments)).length,1);
});

test('text extraction returns the complete original text without provider processing or truncation',async()=>{
  const text='טקסט מלא '+'א'.repeat(90000)+' קצה אחרון',p=provider();
  const r=await extractCommunicationAttachment({attachment:{kind:'text',name:'full.txt',text},provider:p});
  assert.equal(r.text,text);
  assert.equal(r.source.kind,'text');
  assert.equal(p.calls.length,0);
  assert.equal(r.model,null);
});

const png=Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000b49444154789c636000020000050001a5f645400000000049454e44ae426082','hex').toString('base64');
test('binary extraction uses supported vision blocks and returns source metadata without binary retention',async()=>{
  for(const id of ['anthropic','openai']){const p=provider([{text:'שורה ראשונה\nשורה שנייה',unreadable:false}],{id});const r=await extractCommunicationAttachment({attachment:{kind:'image',name:'message.png',mediaType:'image/png',data:png},provider:p});assert.equal(r.text,'שורה ראשונה\nשורה שנייה');assert.equal(p.calls[0].messages[0].content[1].type,'image');assert.equal(p.calls[0].policy,'communication-continuity');assert.ok(!JSON.stringify(r).includes(png));}
});

test('PDF extraction uses document blocks',async()=>{
  const data=Buffer.from('%PDF-1.4\nexample\n%%EOF').toString('base64'),p=provider([{text:'תוכן PDF',unreadable:false}]);
  await extractCommunicationAttachment({attachment:{kind:'pdf',name:'m.pdf',mediaType:'application/pdf',data},provider:p});
  assert.equal(p.calls[0].messages[0].content[1].type,'document');
});

test('unreadable or empty extraction never becomes a successful received message',async()=>{
  for(const value of [{text:'',unreadable:true},{text:'טקסט מנוחש',unreadable:true}]){const p=provider([value]);await assert.rejects(extractCommunicationAttachment({attachment:{kind:'image',name:'bad.png',mediaType:'image/png',data:png},provider:p}),e=>e.code==='ATTACHMENT_UNREADABLE');assert.equal(p.calls.length,1);}
  const p=provider([{text:'',unreadable:false},{text:'',unreadable:false}]);await assert.rejects(extractCommunicationAttachment({attachment:{kind:'image',name:'bad.png',mediaType:'image/png',data:png},provider:p}),e=>e.code==='AI_OUTPUT_INVALID');assert.equal(p.calls.length,2);
});

test('invalid binary, unsupported media and provider limitations fail before a provider call',async()=>{
  const invalid=[{kind:'image',name:'m.png',mediaType:'image/png',data:'***'},{kind:'image',name:'m.png',mediaType:'image/png',data:Buffer.from('fake').toString('base64')},{kind:'image',name:'m.svg',mediaType:'image/svg+xml',data:png},{kind:'pdf',name:'m.pdf',mediaType:'application/pdf',data:'x'.repeat(15*1024*1024)}];
  for(const attachment of invalid){const p=provider();await assert.rejects(extractCommunicationAttachment({attachment,provider:p}),e=>['ATTACHMENT_INVALID','ATTACHMENT_UNSUPPORTED','ATTACHMENT_TOO_LARGE'].includes(e.code));assert.equal(p.calls.length,0);}
  const p=provider([],{id:'other'});await assert.rejects(extractCommunicationAttachment({attachment:{kind:'image',name:'m.png',mediaType:'image/png',data:png},provider:p}),e=>e.code==='ATTACHMENT_UNSUPPORTED');assert.equal(p.calls.length,0);
});

test('live evaluation is opt-in, declares human review and fails clearly when credentials are absent',()=>{
  const script=new URL('../communication-eval.mjs',import.meta.url);
  const help=spawnSync(process.execPath,[script.pathname.replace(/^\/(.:)/,'$1'),'--help'],{encoding:'utf8'});
  assert.equal(help.status,0);
  assert.match(help.stdout,/--live/);
  assert.match(help.stdout,/not a factuality guarantee/i);
  const noKey=spawnSync(process.execPath,[script.pathname.replace(/^\/(.:)/,'$1'),'--live'],{encoding:'utf8',env:{...process.env,ANTHROPIC_API_KEY:'',OPENAI_API_KEY:''}});
  assert.equal(noKey.status,2);
  assert.match(noKey.stderr,/credentials.*absent/i);
  assert.doesNotMatch(noKey.stdout,/passed/i);
});
