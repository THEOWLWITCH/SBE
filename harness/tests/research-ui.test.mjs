import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const require = createRequire(import.meta.url);
const clientPath = '../../app/lib/research-client.js';
class Node {
  constructor(tag = 'div') { this.tagName=tag; this.children=[]; this.listeners={}; this.value=''; this.checked=false; this.hidden=false; this.dataset={}; this.attributes={}; this.style={}; }
  append(...ns) { for(const n of ns){n.parentNode=this;this.children.push(n);} }
  replaceChildren(...ns) { this.children=[]; this._text='';this.append(...ns); }
  set textContent(t) { this._text=String(t); this.children=[]; }
  get textContent() { return (this._text||'')+this.children.map(n=>n.textContent||'').join(' '); }
  addEventListener(k,f) { this.listeners[k]=f; }
  setAttribute(k,v) { this.attributes[k]=v; }
  getAttribute(k) { return this.attributes[k]; }
  remove() { this.removed=true;if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(n=>n!==this); }
  click() { return this.listeners.click?.({preventDefault(){}}); }
}
function doc() { const root=new Node(); return {root,body:new Node('body'),createElement:t=>new Node(t),getElementById:()=>root}; }
function nodes(root){const out=[];const visit=n=>{out.push(n);n.children.forEach(visit);};visit(root);return out;}
const control=(root,label,index=0)=>nodes(root).filter(n=>n.attributes['data-research-field']===label)[index];
const button=(root,label,index=0)=>nodes(root).filter(n=>n.tagName==='button'&&n.textContent===label)[index];
const response=(data,status=200)=>({ok:status<400,status,json:async()=>({ok:status<400,...data})});
test('research client rejects internal actions and clears stale private responses after scope/account changes', async()=>{
  const R=require(clientPath); let token='A', resolve; const clears=[]; const requests=[];
  const c=R.create({getToken:()=>token,onClear:r=>clears.push(r),fetchImpl:(u,o)=>{requests.push(JSON.parse(o.body)); return new Promise(r=>resolve=r);},uuid:()=> '00000000-0000-4000-8000-000000000001'});
  await assert.rejects(c.call('recordUsage',{}),/invalid/); assert.equal(requests.length,0);
  c.setScope('study-a'); const pending=c.call('studyGet',{studyId:'study-a'});
  c.setScope('study-b'); resolve(response({study:{id:'study-a',config:{title:'PRIVATE'}}}));
  await assert.rejects(pending,/stale/);
  const pending2=c.call('studyGet',{studyId:'study-b'}); token='B'; resolve(response({study:{id:'study-b'}}));
  await assert.rejects(pending2,/stale/); assert.ok(clears.length>=2);
});
test('research denial clears scope while a recoverable validation error preserves it; POST has no browser cache', async()=>{
  const R=require(clientPath); let status=400, clears=0, options;
  const c=R.create({getToken:()=> 'A',onClear:()=>clears++,fetchImpl:async(u,o)=>{options=o;return response({error:status===400?'invalid':'not_found'},status);}});
  c.setScope('a'); const initial=clears;
  await assert.rejects(c.call('studyGet',{studyId:'a'}),/invalid/); assert.equal(clears,initial);
  status=404; await assert.rejects(c.call('studyGet',{studyId:'a'}),/not_found/); assert.equal(clears,initial+1);
  assert.equal(options.cache,'no-store'); assert.equal(options.credentials,'omit');
});
test('one assigned researcher opens directly and sees no owner, contact, content or export controls',async()=>{
  const UI=require('../../app/lib/research-management-ui.js'); const d=doc(); const calls=[];
  const study={id:'a',status:'active',revision:1,config:{title:'המחקר שלי'},permissions:['view_study','view_aggregate_results']};
  const client={setScope(){},call:async(a)=>{calls.push(a);return a==='bootstrap'?{owner:false,studies:[study]}:{study};}};
  const page=UI.mount({document:d,root:d.root,client,confirm:()=>true}); await page.load();
  assert.deepEqual(calls,['bootstrap','studyGet']); assert.match(d.root.textContent,/המחקר שלי/);
  for (const forbidden of ['מחקר חדש','הרשאות צוות המחקר','פרטי קשר','ייצוא נתונים','פתיחת תוכן']) assert.ok(!d.root.textContent.includes(forbidden),forbidden);
  page.clear(); assert.equal(d.root.textContent,'');
});
test('owner form exposes thirteen individual permissions and activation requires explicit confirmation',async()=>{
  const UI=require('../../app/lib/research-management-ui.js'); const d=doc(); const calls=[];
  const study={id:'a',status:'pending_approval',revision:1,config:{title:'מחקר א'},permissions:[]};
  const client={setScope(){},call:async(a,p)=>{calls.push([a,p]);return a==='bootstrap'?{owner:true,studies:[study]}:{study};}};
  const page=UI.mount({document:d,root:d.root,client,confirm:()=>false}); await page.load(); await page.openStudy('a');
  assert.match(d.root.textContent,/מחקר חדש/); assert.match(d.root.textContent,/אישור הפעלה/);
  const all=[]; const walk=n=>{all.push(n);n.children.forEach(walk)}; walk(d.root);
  const activate=all.find(n=>n.tagName==='button' && n.textContent==='אישור הפעלה'); await activate.click();
  assert.ok(!calls.some(([a])=>a==='studyStatus'));
  const team=all.find(n=>n.tagName==='button' && n.textContent==='הרשאות צוות המחקר'); await team.click();
  const boxes=[]; const walk2=n=>{if(n.attributes['data-permission'])boxes.push(n);n.children.forEach(walk2)}; walk2(d.root);
  assert.equal(new Set(boxes.map(n=>n.attributes['data-permission'])).size,13);
});
test('opening an opaque consent or verification URL performs read-only calls and leaves all consents unchecked',async()=>{
  const UI=require('../../app/lib/research-participation-ui.js'); const d=doc(); const calls=[];
  const client={setScope(){},call:async(a)=>{calls.push(a);return {study:{id:'a',title:'מחקר'},consent:{id:'v',definition:{title:'הסכמה',text:'תיאור',categories:['surveys','usage','historical','generated']}},instruments:[]};}};
  const page=UI.mount({document:d,root:d.root,client,search:'?invite=opaque&study=a',hash:'#verify=secret'}); await page.load();
  assert.deepEqual(calls,['inviteInfo']); const boxes=[]; const walk=n=>{if(n.type==='checkbox')boxes.push(n);n.children.forEach(walk)};walk(d.root);
  assert.ok(boxes.length>=5); assert.ok(boxes.every(n=>!n.checked));
  assert.ok(!calls.includes('verifyEmail')); assert.ok(!calls.includes('enroll'));
});
test('verification fragment is submitted only by explicit action, never by portal load',async()=>{
  const UI=require('../../app/lib/research-participation-ui.js');const d=doc(),calls=[];
  const data={study:{id:'a',title:'מחקר א',schedule:[]},participation:{id:'p',status:'pending',verified:false,consentVersionId:'v',consents:{},preferences:{}},consent:{id:'v',definition:{text:'הסכמה',categories:[],contactKinds:[]}},instruments:[],responses:[]};
  const client={setScope(){},call:async(a,p)=>{calls.push([a,p]);return data;}};
  const page=UI.mount({document:d,root:d.root,client,search:'?study=a',hash:'#verify=opaque-secret'});await page.load();
  assert.deepEqual(calls.map(([a])=>a),['participationGet']);assert.equal(control(d.root,'קוד האימות מהקישור בדוא״ל').value,'opaque-secret');
  await button(d.root,'אימות הכתובת').click();const sent=calls.find(([a])=>a==='verifyEmail');assert.equal(sent[1].verificationToken,'opaque-secret');assert.equal(sent[1].studyId,'a');
});
test('instruments start blank and an added item preserves its own configured type and bounds',async()=>{
  const UI=require('../../app/lib/research-management-ui.js');const d=doc(),calls=[];
  const study={id:'a',status:'draft',revision:2,config:{title:'מחקר'},permissions:['view_study','manage_questionnaires']};
  const client={setScope(){},call:async(a,p)=>{calls.push([a,p]);return a==='bootstrap'?{owner:false,studies:[study]}:a==='studyGet'?{study}:a==='versionSave'?{revision:3,version:{id:'v'}}:{versions:[]};}};
  const page=UI.mount({document:d,root:d.root,client});await page.load();await button(d.root,'שאלונים').click();
  assert.ok(!control(d.root,'מזהה הפריט'));assert.match(d.root.textContent,/ללא טענת תיקוף או ציון כולל/);await button(d.root,'הוספת פריט').click();
  control(d.root,'כותרת').value='מדידה מקומית';control(d.root,'מזהה הפריט').value='confidence';control(d.root,'נוסח הפריט').value='שאלה מקומית';control(d.root,'סוג תשובה').value='number';control(d.root,'ערך מינימלי').value='1';control(d.root,'ערך מרבי').value='5';
  await button(d.root,'שמירת גרסה חדשה').click();const payload=calls.find(([a])=>a==='versionSave')[1];
  assert.equal(payload.definition.validationStatus,'under-development');assert.deepEqual(payload.definition.items,[{id:'confidence',type:'number',label:'שאלה מקומית',required:false,min:1,max:5}]);
});
test('draft creation sends entered partial fields and does not activate or enroll',async()=>{
  const UI=require('../../app/lib/research-management-ui.js');const d=doc(),calls=[];const study={id:'new',status:'draft',revision:1,config:{title:'טיוטה'}};
  const client={setScope(){},call:async(a,p)=>{calls.push([a,p]);return a==='bootstrap'?{owner:true,studies:[]}:{study};}};
  const page=UI.mount({document:d,root:d.root,client});await page.load();await button(d.root,'מחקר חדש').click();control(d.root,'כותרת המחקר').value='טיוטה';await button(d.root,'שמירת טיוטה').click();
  assert.equal(calls.find(([a])=>a==='studyCreate')[1].config.title,'טיוטה');assert.ok(!calls.some(([a])=>['studyStatus','enroll'].includes(a)));
});
test('recoverable participant error keeps own entered text and does not force optional historical samples',async()=>{
  const UI=require('../../app/lib/research-participation-ui.js');const d=doc(),calls=[];
  const state={study:{id:'a',title:'מחקר א',schedule:[]},participation:{id:'p',status:'enrolled',verified:true,consentVersionId:'v',consents:{historical:true},preferences:{}},consent:{id:'v',definition:{text:'הסכמה',categories:['historical'],contactKinds:[]}},instruments:[],responses:[]};
  const client={setScope(){},call:async(a,p)=>{calls.push([a,p]);if(a==='sampleSubmit')throw Object.assign(new Error('invalid'),{code:'invalid',status:400});return state;}};
  const page=UI.mount({document:d,root:d.root,client,search:'?study=a'});await page.load();control(d.root,'המסר לשיתוף').value='נוסח שלי';control(d.root,'המסר נכתב או נערך על ידך עבור התקשורת שלך').checked=true;control(d.root,'נבדקו וצומצמו פרטים מזהים של צדדים אחרים').checked=true;
  await button(d.root,'שיתוף הדוגמה במחקר').click();assert.equal(control(d.root,'המסר לשיתוף').value,'נוסח שלי');assert.match(d.root.textContent,/היעדר דוגמה אינו משנה/);
  assert.equal(calls.find(([a])=>a==='sampleSubmit')[1].ownAuthorship,true);
});
test('generated sample is readonly and supplies only selected owned canonical source',async()=>{
  const UI=require('../../app/lib/research-participation-ui.js');const d=doc(),calls=[];
  const state={study:{id:'a',title:'מחקר א',schedule:[]},participation:{id:'p',status:'enrolled',verified:true,consentVersionId:'v',consents:{generated:true},preferences:{}},consent:{id:'v',definition:{categories:['generated'],contactKinds:[]}},instruments:[],responses:[]};
  const client={setScope(){},call:async(a,p)=>{calls.push([a,p]);return a==='sampleSubmit'?{sample:{id:'s'}}:state;}};
  const source={mode:'continuity',conversationId:'c',entryId:'e'};
  const page=UI.mount({document:d,root:d.root,client,search:'?study=a',getGeneratedSources:async()=>[{title:'הטיוטה שלי',text:'נוסח מקור',generatedSource:source}]});await page.load();
  assert.equal(control(d.root,'המסר לשיתוף').readOnly,true);await button(d.root,'טעינת הטיוטות שלי').click();const select=control(d.root,'טיוטה לבחירה');select.value='0';select.listeners.change();
  assert.equal(control(d.root,'המסר לשיתוף').value,'נוסח מקור');control(d.root,'המסר נכתב או נערך על ידך עבור התקשורת שלך').checked=true;control(d.root,'נבדקו וצומצמו פרטים מזהים של צדדים אחרים').checked=true;await button(d.root,'שיתוף הדוגמה במחקר').click();
  assert.deepEqual(calls.find(([a])=>a==='sampleSubmit')[1].generatedSource,source);
});
test('provider uncertainty requires owner evidence and never queues a duplicate mail',async()=>{
  const UI=require('../../app/lib/research-management-ui.js');const d=doc(),calls=[];const study={id:'a',status:'active',revision:2,config:{title:'מחקר'}};
  const client={setScope(){},call:async(a,p)=>{calls.push([a,p]);return a==='bootstrap'?{owner:true,studies:[study]}:a==='studyGet'?{study}:{messages:[{id:'m',kind:'followup',status:'unknown',attempts:1}]};}};
  const page=UI.mount({document:d,root:d.root,client,confirm:()=>true});await page.load();await page.openStudy('a');await button(d.root,'הודעות המחקר').click();control(d.root,'תיעוד הבדיקה והאסמכתה').value='בדיקה אצל ספק הדוא״ל';await button(d.root,'רישום תוצאה מאומתת').click();
  assert.equal(calls.find(([a])=>a==='mailResolve')[1].evidence,'בדיקה אצל ספק הדוא״ל');assert.ok(!calls.some(([a])=>a==='contactQueue'));
});
test('same-session revalidation clears private display first, restores pending draft after verified rights, and discards it on denial',async()=>{
  const R=require(clientPath),UI=require('../../app/lib/research-management-ui.js');const d=doc();let page,deny=false,defer=false,resolve;
  const client=R.create({getToken:()=> 'OWNER',onClear:r=>page?.clear(r),fetchImpl:async()=>{if(defer)return new Promise(r=>resolve=r);return response({owner:true,studies:[]});}});
  page=UI.mount({document:d,root:d.root,client});await page.load();await button(d.root,'מחקר חדש').click();control(d.root,'כותרת המחקר').value='טיוטה שלא נשמרה';
  const events={};const environment={addEventListener:(k,f)=>events[k]=f,document:{addEventListener(){}}};const life=R.lifecycle(page,client,environment);
  defer=true;const refresh=life.refresh();assert.ok(!d.root.textContent.includes('מחקר חדש'));resolve(response({owner:true,studies:[]}));await refresh;assert.equal(control(d.root,'כותרת המחקר').value,'טיוטה שלא נשמרה');
  const rejected=life.refresh();resolve(response({error:'unauthorized'},403));await rejected;assert.ok(!control(d.root,'כותרת המחקר'));assert.match(d.root.textContent,/הכניסה או ההרשאה הסתיימו/);
});
test('participant pending consent restores only for the same immutable consent version',async()=>{
  const UI=require('../../app/lib/research-participation-ui.js');const d=doc();let version='v';
  const client={setScope(){},call:async()=>({study:{id:'a',title:'מחקר'},consent:{id:version,definition:{categories:['usage']}},instruments:[]})};
  const page=UI.mount({document:d,root:d.root,client,search:'?invite=opaque'});await page.load();control(d.root,'הסכמה להשתתפות במחקר הזה').checked=true;const saved=page.capture();await page.load(saved);assert.equal(control(d.root,'הסכמה להשתתפות במחקר הזה').checked,true);
  version='v2';await page.load(saved);assert.equal(control(d.root,'הסכמה להשתתפות במחקר הזה').checked,false);
});
test('mutation retry reuses receipt UUID after lost connection without storing research in browser storage',async()=>{
  const R=require(clientPath);let attempts=0,ids=0;const sent=[];
  const client=R.create({getToken:()=> 'A',uuid:()=>String(++ids),fetchImpl:async(u,o)=>{sent.push(JSON.parse(o.body));if(++attempts===1)throw new Error('offline');return response({study:{id:'a'}});}});
  await assert.rejects(client.call('studyCreate',{config:{title:'טיוטה'}}),/network/);await client.call('studyCreate',{config:{title:'טיוטה'}});assert.equal(sent[0].requestId,sent[1].requestId);assert.equal(ids,1);
});
test('account switch before focus never carries the previous accounts pending research fields into the new session',async()=>{
  const R=require(clientPath),UI=require('../../app/lib/research-management-ui.js');const d=doc();let page,token='OWNER_A';
  const client=R.create({getToken:()=>token,onClear:r=>page?.clear(r),fetchImpl:async()=>response({owner:true,studies:[]})});page=UI.mount({document:d,root:d.root,client});await page.load();await button(d.root,'מחקר חדש').click();control(d.root,'כותרת המחקר').value='PRIVATE FROM A';
  const environment={addEventListener(){},document:{addEventListener(){}}},life=R.lifecycle(page,client,environment);token='OWNER_B';await life.refresh();assert.ok(!control(d.root,'כותרת המחקר'));await button(d.root,'מחקר חדש').click();assert.equal(control(d.root,'כותרת המחקר').value,'');
});
test('lost sample response followed by same-session study revalidation retries the identical mutation receipt and payload',async()=>{
  const R=require(clientPath),UI=require('../../app/lib/research-participation-ui.js');const d=doc();let page,ids=0;const mutations=[];
  const state={study:{id:'a',title:'מחקר א',schedule:[]},participation:{id:'p',status:'enrolled',verified:true,consentVersionId:'v',consents:{historical:true},preferences:{}},consent:{id:'v',definition:{categories:['historical'],contactKinds:[]}},instruments:[],responses:[]};
  const client=R.create({getToken:()=> 'A',onClear:r=>page?.clear(r),uuid:()=>`00000000-0000-4000-8000-${String(++ids).padStart(12,'0')}`,fetchImpl:async(u,o)=>{const body=JSON.parse(o.body);if(body.action==='sampleSubmit'){mutations.push(body);if(mutations.length===1)throw new Error('lost acknowledgment');return response({sample:{id:'s'}});}return response(state);}});
  page=UI.mount({document:d,root:d.root,client,search:'?study=a'});await page.load();control(d.root,'המסר לשיתוף').value='נוסח שלי';control(d.root,'קהל המסר').value='הורים';control(d.root,'המסר נכתב או נערך על ידך עבור התקשורת שלך').checked=true;control(d.root,'נבדקו וצומצמו פרטים מזהים של צדדים אחרים').checked=true;
  await button(d.root,'שיתוף הדוגמה במחקר').click();const life=R.lifecycle(page,client,{addEventListener(){},document:{addEventListener(){}}});await life.refresh();assert.equal(control(d.root,'המסר לשיתוף').value,'נוסח שלי');await button(d.root,'שיתוף הדוגמה במחקר').click();
  assert.equal(mutations.length,2);assert.equal(mutations[0].requestId,mutations[1].requestId);assert.deepEqual(mutations[0],mutations[1]);
});
test('pending mutation receipts are discarded on scope, account, denial and page exit changes',async()=>{
  const R=require(clientPath);
  for(const change of ['scope','account','denial','leave']){let token='A',ids=0;const mutations=[];
    const client=R.create({getToken:()=>token,uuid:()=>String(++ids),fetchImpl:async(u,o)=>{mutations.push(JSON.parse(o.body));throw new Error('lost acknowledgment');}});client.setScope('a');
    await assert.rejects(client.call('surveySubmit',{studyId:'a',answers:{item:1}}),/network/);
    if(change==='scope')client.setScope('b');else if(change==='account'){token='B';client.invalidate('refresh');}else client.invalidate(change==='denial'?'not_found':'leave');
    client.setScope('a');await assert.rejects(client.call('surveySubmit',{studyId:'a',answers:{item:1}}),/network/);assert.notEqual(mutations[0].requestId,mutations[1].requestId,change);
  }
});
function attachmentReader(){const context={window:{},TextDecoder,Uint8Array};runInNewContext(readFileSync(new URL('../../app/lib/communication-attachments.js',import.meta.url),'utf8'),context);return context.window.SBE_COMMUNICATION_ATTACHMENTS.prepare;}
function fileSetup(source='historical'){
  const R=require(clientPath),UI=require('../../app/lib/research-participation-ui.js'),d=doc();let page,token='A',nextResponse;
  let state={study:{id:'a',title:'מחקר א',schedule:[]},participation:{id:'p',status:'enrolled',verified:true,consentVersionId:'v',consents:{[source]:true},preferences:{}},consent:{id:'v',definition:{categories:[source],contactKinds:[]}},instruments:[],responses:[]};
  const client=R.create({getToken:()=>token,onClear:r=>page?.clear(r),fetchImpl:async()=>{if(nextResponse){const pending=nextResponse;nextResponse=null;return pending;}return response(state);}});page=UI.mount({document:d,root:d.root,client,search:'?study=a',readAttachment:attachmentReader()});
  const life=R.lifecycle(page,client,{addEventListener(){},document:{addEventListener(){}}});return {d,page,client,life,state:()=>state,setState:s=>state=s,setToken:t=>token=t,deferResponse:()=>{let release;nextResponse=new Promise(r=>release=()=>r(response(state)));return ()=>release();}};
}
function delayedTextFile(text){const bytes=new TextEncoder().encode(text);let release;const pending=new Promise(r=>release=()=>r(bytes.buffer));return {file:{name:'history.txt',size:bytes.length,type:'text/plain',arrayBuffer:()=>pending},release:()=>release()};}
test('delayed actual TXT extraction reaches rebuilt matching form after successful focus revalidation',async()=>{
  const f=fileSetup();await f.page.load();const upload=delayedTextFile('מסר מקובץ שנבחר');const input=control(f.d.root,'קריאה מקובץ TXT או DOCX');input.files=[upload.file];const reading=input.listeners.change();await f.life.refresh();upload.release();await reading;assert.equal(control(f.d.root,'המסר לשיתוף').value,'מסר מקובץ שנבחר');
});
test('delayed file result is discarded when a successfully revalidated participant has a new immutable consent',async()=>{
  const f=fileSetup();await f.page.load();const upload=delayedTextFile('OLD CONSENT TEXT');const input=control(f.d.root,'קריאה מקובץ TXT או DOCX');input.files=[upload.file];const reading=input.listeners.change();const next=structuredClone(f.state());next.consent.id='v2';next.participation.consentVersionId='v2';f.setState(next);await f.life.refresh();upload.release();await reading;assert.equal(control(f.d.root,'המסר לשיתוף').value,'');assert.ok(!f.d.root.textContent.includes('OLD CONSENT TEXT'));
});
test('completed extraction stays undisplayed until pending same-study authorization succeeds',async()=>{
  const f=fileSetup();await f.page.load();const upload=delayedTextFile('מסר שממתין לאישור התצוגה');const input=control(f.d.root,'קריאה מקובץ TXT או DOCX');input.files=[upload.file];const reading=input.listeners.change();const authorize=f.deferResponse();const refresh=f.life.refresh();upload.release();await reading;assert.ok(!control(f.d.root,'המסר לשיתוף'));authorize();await refresh;assert.equal(control(f.d.root,'המסר לשיתוף').value,'מסר שממתין לאישור התצוגה');
});
test('delayed generated JSON selection restores its canonical readonly preview after focus revalidation',async()=>{
  const f=fileSetup('generated');await f.page.load();let release;const data={mode:'single',document:{entries:[{id:'draft',text:'טיוטה מהמקור'}]},proof:'signed-proof',draftId:'draft'},pending=new Promise(r=>release=()=>r(JSON.stringify(data)));const input=control(f.d.root,'פתיחת קובץ מקור מהכלי');input.files=[{name:'source.json',size:500,text:()=>pending}];const reading=input.listeners.change();await f.life.refresh();release();await reading;assert.equal(control(f.d.root,'המסר לשיתוף').value,'טיוטה מהמקור');assert.equal(control(f.d.root,'המסר לשיתוף').readOnly,true);
});
test('latest file selection wins over an older deferred extraction',async()=>{
  const f=fileSetup();await f.page.load();const first=delayedTextFile('OLDER'),second=delayedTextFile('LATEST'),input=control(f.d.root,'קריאה מקובץ TXT או DOCX');input.files=[first.file];const earlier=input.listeners.change();input.files=[second.file];const latest=input.listeners.change();second.release();await latest;first.release();await earlier;assert.equal(control(f.d.root,'המסר לשיתוף').value,'LATEST');
});
test('new explicit manual text after focus rebuild is not overwritten by the selected files delayed extraction',async()=>{
  const f=fileSetup();await f.page.load();const upload=delayedTextFile('FILE TEXT'),input=control(f.d.root,'קריאה מקובץ TXT או DOCX');input.files=[upload.file];const reading=input.listeners.change();await f.life.refresh();const text=control(f.d.root,'המסר לשיתוף');text.value='הנוסח המעודכן שלי';text.listeners.input();upload.release();await reading;assert.equal(control(f.d.root,'המסר לשיתוף').value,'הנוסח המעודכן שלי');
});
test('pending extraction is discarded on account, study, permission denial, withdrawal, separate consent removal and page exit',async()=>{
  for(const boundary of ['account','study','denial','withdrawal','category','leave']){const f=fileSetup();await f.page.load();const upload=delayedTextFile('STALE PRIVATE FILE'),input=control(f.d.root,'קריאה מקובץ TXT או DOCX');input.files=[upload.file];const reading=input.listeners.change();
    if(boundary==='account'){f.setToken('B');await f.life.refresh();}
    else if(boundary==='study'){const next=structuredClone(f.state());next.study.id='b';f.setState(next);await f.page.open('b');}
    else if(boundary==='denial'){f.client.invalidate('not_found');}
    else if(boundary==='leave'){f.client.invalidate('leave');}
    else {const next=structuredClone(f.state());if(boundary==='withdrawal')next.participation.status='withdrawn';else next.participation.consents.historical=false;f.setState(next);await f.life.refresh();}
    upload.release();await reading;assert.ok(!f.d.root.textContent.includes('STALE PRIVATE FILE'),boundary);assert.ok(!nodes(f.d.root).some(n=>n.value==='STALE PRIVATE FILE'),boundary);
  }
});
