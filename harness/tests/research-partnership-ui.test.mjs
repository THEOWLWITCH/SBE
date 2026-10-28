import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
class Element {
  constructor(tag='div'){this.tagName=tag;this.children=[];this.listeners={};this.attributes={};this.value='';this.checked=false;this.style={};}
  append(...nodes){for(const n of nodes){n.parentNode=this;this.children.push(n);}}
  replaceChildren(...nodes){this.children=[];this._text='';this.append(...nodes);}
  set textContent(value){this._text=String(value);this.children=[];}
  get textContent(){return (this._text||'')+this.children.map(n=>n.textContent).join(' ');}
  addEventListener(name,fn){this.listeners[name]=fn;}
  setAttribute(name,value){this.attributes[name]=value;}
  getAttribute(name){return this.attributes[name];}
  remove(){this.parentNode.children=this.parentNode.children.filter(n=>n!==this);}
  click(){return this.listeners.click?.({preventDefault(){}});}
}
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const walk=root=>[root,...root.children.flatMap(walk)];
const btn=(root,label)=>walk(root).find(n=>n.tagName==='button'&&n.textContent===label);
const field=(root,label)=>walk(root).find(n=>n.attributes['data-research-field']===label);
const settle=async()=>{for(let n=0;n<30;n++)await Promise.resolve();};
function setup(owner=true){const root=new Element(),document={createElement:t=>new Element(t),body:new Element('body')},calls=[];
  const workspace={studyId:id(1),partnerId:id(2),studyTitle:'מחקר א',partnerName:'חוקרת א',pendingCount:2,deadlines:[{title:'השלמת בקשה',dueDate:'2026-11-01'}],records:[]};
  let saved;
  const client={setScope(){},call:async(action,payload)=>{calls.push([action,payload]);if(action==='workspaceBootstrap')return {owner,partners:[{id:id(2),fullName:'חוקרת א'}],studies:[{id:id(1),title:'מחקר א',permissions:['view_study','propose_analysis']}],capabilities:[],readiness:{signing:{configured:false,state:'not_configured',message:'שירות החתימה טרם הוגדר.'}}};if(action==='workspaceList')return {workspaces:[workspace],nextCursor:null};if(action==='partnerGet')return {partner:{id:id(2),revision:1,profile:{fullName:'חוקרת א',email:'a@example.test',institution:'מוסד א'}},workspaces:[workspace]};if(action==='versionList')return {versions:[]};if(action==='recordSave'){saved={record:{id:id(3),studyId:id(1),partnerId:id(2),kind:payload.kind,status:'draft',revision:(saved?.record.revision||0)+1,headVersionId:id(4)},version:{id:id(4),number:(saved?.record.revision||0)+1,data:payload.data,contentHash:'a'.repeat(64)}};workspace.records=[{id:id(3),kind:payload.kind,status:'draft',revision:saved.record.revision,title:payload.data.title,headVersionId:id(4)}];return saved;}if(action==='recordVersions')return {versions:saved?[saved.version]:[]};if(action==='recordGet')return saved;return {};}};
  return {root,document,client,calls,workspace};}
test('partnership client accepts public actions and treats analysis as a mutation',async()=>{const R=require('../../app/lib/research-client.js');const sent=[];const client=R.create({getToken:()=> 'A',uuid:()=>id(99),fetchImpl:async(u,o)=>{sent.push(JSON.parse(o.body));return {ok:true,status:200,json:async()=>({ok:true})};}});await client.call('workspaceBootstrap');await client.call('workspaceAnalysis',{studyId:id(1),partnerId:id(2),requestRecordId:id(3),operation:'descriptive'});assert.equal(sent[0].requestId,undefined);assert.equal(sent[1].requestId,id(99));await assert.rejects(client.call('signatureComplete'),/invalid/);});
test('owner dashboard has authorized filters, counts and folder navigation',async()=>{const UI=require('../../app/lib/research-partnership-ui.js');const s=setup();const page=UI.mount(s);await page.load();assert.match(s.root.textContent,/ניהול שותפויות והסכמים/);assert.match(s.root.textContent,/ממתינים לבדיקה/);assert.ok(field(s.root,'חיפוש חוקרת או מחקר'));field(s.root,'חיפוש חוקרת או מחקר').value='חוקרת א';await btn(s.root,'חיפוש').click();assert.equal(s.calls.filter(([a])=>a==='workspaceList').at(-1)[1].query,'חוקרת א');await page.openWorkspace(s.workspace);assert.match(s.root.textContent,/התיק של חוקרת א/);assert.ok(btn(s.root,'בקשה חדשה'));});
test('one partner folder groups every server-authorized study and renders that partner grants rather than owner permissions',async()=>{
  const UI=require('../../app/lib/research-partnership-ui.js'),P=require('../../app/lib/research-partnership-core.js'),s=setup(),original=s.client.call;
  const first={...s.workspace,grantedPermissions:['view_study'],study:{id:id(1),status:'draft',revision:4,config:{title:'מחקר א',description:'תיאור המחקר הראשון',approvals:{status:'pending',reference:'אסמכתה סינתטית'},dataCategories:['surveys'],withdrawalPolicy:'erase'}}};
  const second={...s.workspace,studyId:id(9),studyTitle:'מחקר שני',pendingCount:3,grantedPermissions:['view_study','view_approved_findings'],study:{id:id(9),status:'active',revision:6,config:{title:'מחקר שני',description:'תיאור המחקר השני',population:'אוכלוסייה סינתטית'}}};
  s.client.call=async(a,p)=>{if(a==='workspaceList'){s.calls.push([a,p]);return {workspaces:p?.studyId?[p.studyId===id(9)?second:first]:[first,second],nextCursor:null};}if(a==='partnerGet'){s.calls.push([a,p]);return {partner:{id:id(2),revision:1,profile:{fullName:'חוקרת א',applicantType:'individual'}},workspaces:[first,second]};}return original(a,p);};
  const page=UI.mount(s);await page.load();assert.equal(walk(s.root).filter(n=>n.tagName==='button'&&n.textContent==='פתיחת התיק').length,1);assert.match(s.root.textContent,/ממתינים לבדיקה: 5/);
  await page.openWorkspace(first);assert.equal(field(s.root,'מחקר בתיק').children.length,2);assert.match(s.root.textContent,/תיאור המחקר הראשון/);assert.match(s.root.textContent,/ממתינים לאישור/);assert.match(s.root.textContent,/תשובות לשאלונים/);assert.match(s.root.textContent,/מחיקת נתוני המשתתף לאחר פרישה/);assert.ok(!s.root.textContent.includes(P.permissionLabel('propose_analysis')));
  const selector=field(s.root,'מחקר בתיק');selector.value=id(9);await selector.listeners.change();assert.match(s.root.textContent,/תיאור המחקר השני/);assert.match(s.root.textContent,/אוכלוסייה סינתטית/);assert.match(s.root.textContent,new RegExp(P.permissionLabel('view_approved_findings')));assert.equal(s.calls.filter(([a])=>a==='workspaceList').at(-1)[1].studyId,id(9));
  page.clear();assert.equal(s.root.textContent,'');assert.equal(page.capture().workspace,null);
});
test('researcher works in own folder and typed application saves immutable server draft',async()=>{const UI=require('../../app/lib/research-partnership-ui.js');const s=setup(false);const page=UI.mount(s);await page.load();assert.ok(!s.root.textContent.includes('ניהול שותפויות והסכמים'));assert.ok(!field(s.root,'חיפוש חוקרת או מחקר'));await page.openWorkspace(s.workspace);await btn(s.root,'בקשה חדשה').click();field(s.root,'כותרת').value='הצעת מחקר';field(s.root,'שאלות מחקר').value='שאלה א\nשאלה ב';await btn(s.root,'שמירת טיוטה').click();const payload=s.calls.find(([a])=>a==='recordSave')[1];assert.equal(payload.studyId,id(1));assert.equal(payload.partnerId,id(2));assert.equal(payload.expectedRevision,null);assert.deepEqual(payload.data.researchQuestions,['שאלה א','שאלה ב']);assert.equal(payload.data.fullName,'חוקרת א');assert.ok(walk(s.root).filter(n=>['input','textarea','select'].includes(n.tagName)).every(n=>n.attributes.dir==='rtl'));assert.ok(!walk(s.root).some(n=>n.attributes['data-research-field']==='studyId'));});
test('legacy institution profiles infer applicant type while an individual profile keeps institution optional',async()=>{
  const UI=require('../../app/lib/research-partnership-ui.js'),s=setup(false),page=UI.mount(s);await page.load();await page.openWorkspace(s.workspace);await btn(s.root,'בקשה חדשה').click();assert.equal(field(s.root,'סוג הפונה').value,'institution');
  field(s.root,'סוג הפונה').value='individual';await field(s.root,'סוג הפונה').listeners.change();assert.equal(field(s.root,'מוסד').attributes['aria-required'],'false');page.clear();
});
test('nested agreement rows are fieldsets and unconfigured signature cannot execute',async()=>{const UI=require('../../app/lib/research-partnership-ui.js');const s=guidedSetup();const page=UI.mount(s);await page.load();await page.openWorkspace(s.workspace);await btn(s.root,'הסכם חדש').click();await btn(s.root,'הוספת הוצאות משותפות').click();assert.ok(walk(s.root).some(n=>n.tagName==='fieldset'));assert.ok(field(s.root,'סכום'));assert.match(s.root.textContent,/תבנית מאושרת/);assert.ok(!btn(s.root,'תחילת חתימה'));await btn(s.root,'שמירת טיוטה').click();assert.ok(!s.calls.some(([a])=>a==='signingStart'));page.clear();});

test('uncertain provider creation is visible without claiming a signature or hiding the approved agreement',async()=>{
 const UI=require('../../app/lib/research-partnership-ui.js'),s=guidedSetup(),original=s.client.call;
 s.current().record.status='approved';s.current().version.contentHash='a'.repeat(64);
 s.client.call=async(a,p)=>{if(a==='workspaceBootstrap'){const out=await original(a,p);out.readiness.signing={configured:true,state:'ready'};return out;}if(a==='signingStart')return {signing:{recordId:id(30),versionId:id(31),state:'creation_uncertain',configured:true}};return original(a,p);};
 const page=UI.mount(s);await page.load();await page.openWorkspace(s.workspace);await btn(s.root,'הסכם חדש').click();
 field(s.root,'הסכמה לפתיחת תהליך החתימה לגרסה זו').checked=true;await btn(s.root,'תחילת חתימה').click();
 assert.match(s.root.textContent,/לא ידוע אם טיוטת החתימה נוצרה אצל הספק/);assert.doesNotMatch(s.root.textContent,/החתימה הושלמה ואומתה/);assert.equal(walk(s.root).some(n=>n.tagName==='iframe'),false);page.clear();
});

function guidedSetup(owner=true){
 const s=setup(owner),original=s.client.call;
 s.workspace.grantedPermissions=['view_study'];
 const sources={profile:{id:id(2),revision:1,data:{fullName:'מובילת המחקר'}},study:{id:id(1),revision:2,config:{title:'מחקר א'}},currentGrants:['view_study'],applications:[{recordId:id(20),versionId:id(21),revision:1,data:{title:'בקשת המחקר',requestedTools:['כלי מוצע בלבד']}}],budgets:[],contributions:[],forms:[]};
 let current={record:{id:id(30),studyId:id(1),partnerId:id(2),kind:'agreement',status:'draft',revision:1},version:{id:id(31),number:1,data:{title:'טיוטה שהוכנה בשרת',guidedVersion:'4',leadResearcher:'מובילת המחקר',objectives:'מטרה מקורית',toolIds:['כלי מוצע בלבד'],requestedPermissions:['export_data'],annexBStatus:'applicable',annexB:[{tool:'כלי מוצע בלבד',actions:['export_data'],authorizedUsers:['מורשה סינתטית']}]}}};
 const preparation={id:id(32),initialReceiptId:id(32),recordId:id(30),versionId:id(31),snapshot:{sources,selection:{applicationVersionId:id(21),budgetVersionIds:[],contributionVersionIds:[]},candidate:structuredClone(current.version.data)},fieldSources:{leadResearcher:{source:'profile',id:id(2),revision:1},objectives:{recordId:id(20),versionId:id(21),revision:1}},overrides:[],sourceHash:'a'.repeat(64)};
 const guidance={catalogVersion:'4',sections:[{id:'parties',complete:['אפשר להפריד בין מובילת המחקר לבין הצד המשפטי.'],guidance:[]}]};
 s.client.call=async(action,payload)=>{
  if(['agreementSources','agreementPrepare','agreementRefreshPreview','agreementRefreshApply','processingPolicyGet','processingPolicySave','processingPolicyApprove'].includes(action))s.calls.push([action,payload]);
  if(action==='agreementSources')return structuredClone({sources,guidance});
  if(action==='agreementPrepare'){s.workspace.records=[{id:current.record.id,kind:'agreement',title:current.version.data.title}];return {...structuredClone(current),sources:structuredClone(sources),guidance,preparation,resumed:false,template:null};}
  if(action==='recordGet'&&payload.recordId===current.record.id){s.calls.push([action,payload]);return structuredClone(current);}
  if(action==='recordSave'&&payload.kind==='agreement'){s.calls.push([action,payload]);current={record:{...current.record,revision:current.record.revision+1},version:{id:id(31+current.record.revision),number:current.version.number+1,data:structuredClone(payload.data)}};return structuredClone(current);}
  if(action==='agreementRefreshPreview')return {preview:{recordId:current.record.id,versionId:current.version.id,expectedRevision:current.record.revision,hash:'b'.repeat(64),sources,selection:preparation.snapshot.selection,preparation,changes:[{field:'objectives',current:current.version.data.objectives,proposed:'מטרה עדכנית',proposedPresent:true,overridden:true,source:{recordId:id(20),versionId:id(22),revision:2}},{field:'leadResearcher',current:current.version.data.leadResearcher,proposed:'מובילה מעודכנת',proposedPresent:true,overridden:false,source:{source:'profile',revision:2}}]}};
  if(action==='agreementRefreshApply'){const data=structuredClone(current.version.data);for(const key of payload.replaceFields)data[key]=key==='objectives'?'מטרה עדכנית':'מובילה מעודכנת';current={record:{...current.record,revision:current.record.revision+1},version:{id:id(40),number:current.version.number+1,data}};return {...structuredClone(current),preparation};}
  if(action==='processingPolicyGet')return {policy:null,actorChoices:[{id:'sys',label:'בעלת המערכת'},{id:'code:SYNTHETIC',label:'החוקרת בתיק'}]};
  if(action==='processingPolicySave')return {policy:{id:id(50),revision:1,data:payload.policy,hash:'c'.repeat(64),approved:false,current:true}};
  if(action==='processingPolicyApprove')return {policy:{id:id(50),revision:1,data:s.calls.find(([a])=>a==='processingPolicySave')[1].policy,hash:'c'.repeat(64),approved:true,current:true}};
  return original(action,payload);
 };
 return {...s,sources,preparation,current:()=>current};
}

test('invalid visible date blocks unchanged save, navigation and exact-version approval without putting raw text in API data',async()=>{
 const UI=require('../../app/lib/research-partnership-ui.js'),s=guidedSetup(),page=UI.mount(s);s.current().record.status='approved';await page.load();await page.openWorkspace(s.workspace);await btn(s.root,'הסכם חדש').click();
 const date=field(s.root,'תחילת המחקר');let focused=0;date.value='2026-11-12';date._sbeDateIL={check:focus=>{if(focus)focused++;return false;},draft:()=> '31.02.26'};
 await date.listeners.input();await btn(s.root,'שמירת טיוטה').click();await btn(s.root,'חזרה לתיק החוקרת').click();
 field(s.root,'קראתי את הסבר הקניין הרוחני של גרסה זו').checked=true;const approve=btn(s.root,'אישור הגרסה הסופית');approve.disabled=false;await approve.click();
 assert.equal(s.calls.some(([a])=>['recordSave','agreementApprove'].includes(a)),false);assert.ok(field(s.root,'תחילת המחקר'));assert.ok(focused>=3);assert.match(s.root.textContent,/לתקן את התאריך/);
 const captured=page.capture();assert.equal(captured.editor.dateDraft.startDate,'31.02.26');assert.equal(captured.editor.data.startDate,'2026-11-12');assert.equal(JSON.stringify(captured.editor.data).includes('31.02.26'),false);page.clear();
});

test('raw invalid date draft restores only at the freshly authorized exact record revision and is dropped for a newer head',async()=>{
 const UI=require('../../app/lib/research-partnership-ui.js'),s=guidedSetup(),page=UI.mount(s);await page.load();await page.openWorkspace(s.workspace);await btn(s.root,'הסכם חדש').click();
 const date=field(s.root,'תחילת המחקר');date._sbeDateIL={check:()=>false,draft:()=> '31.02.26'};await date.listeners.input();const captured=page.capture();
 await page.load(captured);assert.equal(field(s.root,'תחילת המחקר')._sbeDateDraft,'31.02.26');s.current().record.revision++;await page.load(captured);assert.equal(field(s.root,'תחילת המחקר'),undefined);assert.match(s.root.textContent,/התיק של/);page.clear();
});

test('guided live preview is a collapsed disclosure that refreshes without hiding completion progress',async()=>{
 const UI=require('../../app/lib/research-partnership-ui.js'),s=guidedSetup(),page=UI.mount(s);await page.load();await page.openWorkspace(s.workspace);await btn(s.root,'הסכם חדש').click();
 const preview=walk(s.root).find(n=>n.tagName==='details'&&n.children[0]?.textContent==='תצוגת נוסח ההסכם');assert.ok(preview);assert.notEqual(preview.open,true);assert.match(s.root.textContent,/להשלמת ההגשה נותרו/);
 preview.open=true;const title=field(s.root,'כותרת');title.value='נוסח מעודכן בתצוגה';await title.listeners.input();assert.equal(preview.open,true);assert.match(preview.textContent,/נוסח מעודכן בתצוגה/);page.clear();
});

test('guided preparation uses the server draft and operational lead while grants stay separate from proposed tools',async()=>{
 const UI=require('../../app/lib/research-partnership-ui.js'),s=guidedSetup(),page=UI.mount(s);await page.load();await page.openWorkspace(s.workspace);await btn(s.root,'הסכם חדש').click();await settle();
 assert.equal(field(s.root,'כותרת').value,'טיוטה שהוכנה בשרת');assert.equal(field(s.root,'שם החוקרת').value,'');assert.ok(s.calls.some(([a])=>a==='agreementPrepare'));assert.ok(!s.calls.some(([a])=>a==='recordSave'));
 assert.match(s.root.textContent,/הרשאות פעילות כעת/);assert.match(s.root.textContent,/כלים מוצעים מתוך הבקשה/);assert.match(s.root.textContent,/אפשר להפריד בין מובילת המחקר/);assert.match(s.root.textContent,/מקור שנשמר/);page.clear();
});

test('guided refresh flushes draft, preserves intentional empty override, and replaces only explicitly selected fields',async()=>{
 const UI=require('../../app/lib/research-partnership-ui.js'),s=guidedSetup(),page=UI.mount(s);await page.load();await page.openWorkspace(s.workspace);await btn(s.root,'הסכם חדש').click();await settle();
 const objectives=field(s.root,'מטרות המחקר');objectives.value='';objectives.listeners.input();await btn(s.root,'בדיקת עדכונים מהמקורות').click();
 assert.equal(s.calls.find(([a])=>a==='recordSave')[1].data.objectives,'');assert.match(s.root.textContent,/מטרה עדכנית/);assert.match(s.root.textContent,/ערך נוכחי/);assert.match(s.root.textContent,/ערך מוצע/);
 assert.equal(field(s.root,'החלפת מטרות המחקר').checked,false);field(s.root,'החלפת שם החוקרת האחראית').checked=true;await btn(s.root,'החלת העדכונים שנבחרו').click();
 const sent=s.calls.find(([a])=>a==='agreementRefreshApply')[1];assert.deepEqual(sent.replaceFields,['leadResearcher']);assert.equal(sent.previewHash,'b'.repeat(64));assert.equal(sent.versionId,id(32));assert.equal(sent.expectedRevision,2);assert.equal(field(s.root,'מטרות המחקר').value,'');assert.equal(field(s.root,'שם החוקרת האחראית').value,'מובילה מעודכנת');page.clear();
});

test('guided refresh save failure and stale server preview retain visible draft',async()=>{
 const UI=require('../../app/lib/research-partnership-ui.js'),s=guidedSetup(),original=s.client.call;let failSave=true;
 s.client.call=async(a,p)=>{if(a==='recordSave'&&failSave)throw {code:'network'};if(a==='agreementRefreshApply'){s.calls.push([a,p]);throw {code:'conflict'};}return original(a,p);};
 const page=UI.mount(s);await page.load();await page.openWorkspace(s.workspace);await btn(s.root,'הסכם חדש').click();await settle();const before=s.calls.filter(([a])=>a==='agreementRefreshPreview').length;
 field(s.root,'מטרות המחקר').value='טיוטה שנשמרת כאן';field(s.root,'מטרות המחקר').listeners.input();await btn(s.root,'בדיקת עדכונים מהמקורות').click();assert.equal(s.calls.filter(([a])=>a==='agreementRefreshPreview').length,before);assert.equal(field(s.root,'מטרות המחקר').value,'טיוטה שנשמרת כאן');
 failSave=false;await btn(s.root,'בדיקת עדכונים מהמקורות').click();field(s.root,'החלפת שם החוקרת האחראית').checked=true;await btn(s.root,'החלת העדכונים שנבחרו').click();assert.equal(field(s.root,'מטרות המחקר').value,'טיוטה שנשמרת כאן');assert.match(s.root.textContent,/השתנה|השתנתה/);page.clear();
});

test('annex applicability excludes inactive rows and marks only active decisions as primary',async()=>{
 const UI=require('../../app/lib/research-partnership-ui.js'),s=guidedSetup(),page=UI.mount(s);await page.load();await page.openWorkspace(s.workspace);await btn(s.root,'הסכם חדש').click();await settle();
 const status=field(s.root,'תחולת נספח B');status.value='not_applicable';status.listeners.change();field(s.root,'נימוק לאי תחולת נספח B').value='אינו נכלל בנוסח הנוכחי';await btn(s.root,'שמירת טיוטה').click();const data=s.calls.find(([a])=>a==='recordSave')[1].data;
 assert.equal(data.annexB,undefined);assert.equal(field(s.root,'נימוק לאי תחולת נספח B').attributes['aria-required'],'true');assert.equal(field(s.root,'נימוק לאי תחולת נספח A').attributes['aria-required'],'false');page.clear();
});

test('researcher edits a prepared draft without owner preparation or processing policy controls',async()=>{
 const UI=require('../../app/lib/research-partnership-ui.js'),s=guidedSetup(false);s.workspace.records=[{id:id(30),kind:'agreement',title:s.current().version.data.title}];const page=UI.mount(s);await page.load();await page.openWorkspace(s.workspace);
 assert.equal(btn(s.root,'הסכם חדש'),undefined);await btn(s.root,'טיוטה שהוכנה בשרת').click();await settle();assert.equal(field(s.root,'מטרות המחקר').value,'מטרה מקורית');assert.equal(btn(s.root,'בדיקת הרשאת עיבוד'),undefined);assert.ok(!s.calls.some(([a])=>a==='agreementPrepare'||a.startsWith('processingPolicy')));page.clear();
});

test('owner policy form has Hebrew choices and separate exact saved approval',async()=>{
 const UI=require('../../app/lib/research-partnership-ui.js'),P=require('../../app/lib/research-partnership-core.js'),s=guidedSetup(),page=UI.mount(s);await page.load();await page.openWorkspace(s.workspace);await btn(s.root,'הסכם חדש').click();await settle();await btn(s.root,'בדיקת הרשאת עיבוד').click();
 assert.ok(!/partyRoles|authorizedActors|agreement_changes/.test(s.root.textContent));field(s.root,'מטרת העברה').value='external_impact';field(s.root,'ספק').value='synthetic-provider';field(s.root,'גרסת ספק').value='1';field(s.root,'שינויי הסכם').checked=true;field(s.root,'בעלת המערכת, הרשאת עיבוד').checked=true;
 for(const def of P.PROCESSING_POLICY_FIELDS.filter(f=>!['purpose','provider','providerVersion','dataCategories','authorizedActors'].includes(f.id))){const control=walk(s.root).find(n=>n.attributes['data-field-id']===def.id);control.value='החלטה סינתטית מפורשת';}
 await btn(s.root,'שמירת הרשאת עיבוד כטיוטה').click();assert.ok(!s.calls.some(([a])=>a==='processingPolicyApprove'));assert.match(s.root.textContent,/טרם אושרה/);await btn(s.root,'אישור הרשאת העיבוד השמורה').click();const payload=s.calls.find(([a])=>a==='processingPolicyApprove')[1];assert.equal(payload.policyVersionId,id(50));assert.equal(payload.policyHash,'c'.repeat(64));assert.equal(payload.expectedRevision,1);page.clear();
});

test('processing purpose selector refetches the scoped head and does not discard an unsaved route decision',async()=>{
 const UI=require('../../app/lib/research-partnership-ui.js'),s=guidedSetup(),page=UI.mount(s);await page.load();await page.openWorkspace(s.workspace);await btn(s.root,'הסכם חדש').click();await btn(s.root,'בדיקת הרשאת עיבוד').click();
 const selector=field(s.root,'מטרת העברה');assert.equal(s.calls.filter(([a])=>a==='processingPolicyGet').at(-1)[1].purpose,'external_impact');selector.value='signed_copy_delivery';await selector.listeners.change();assert.equal(s.calls.filter(([a])=>a==='processingPolicyGet').at(-1)[1].purpose,'signed_copy_delivery');
 field(s.root,'תפקידי הצדדים בעיבוד').value='החלטה מקומית שטרם נשמרה';const count=s.calls.filter(([a])=>a==='processingPolicyGet').length;selector.value='pre_signing_document';await selector.listeners.change();assert.equal(selector.value,'signed_copy_delivery');assert.equal(s.calls.filter(([a])=>a==='processingPolicyGet').length,count);assert.equal(field(s.root,'תפקידי הצדדים בעיבוד').value,'החלטה מקומית שטרם נשמרה');page.clear();
});

test('folder shows private signed-copy availability separately from provider acceptance and delivery evidence',async()=>{
 const UI=require('../../app/lib/research-partnership-ui.js'),s=setup(),original=s.client.call;s.workspace.signedCopies=[{party:'owner',privateCopy:'available',submission:'accepted',deliveryEvidence:'unavailable'},{party:'partner',privateCopy:'available',submission:'accepted',deliveryEvidence:'bounced'}];s.client.call=async(a,p)=>a==='workspaceList'?{workspaces:[s.workspace]}:original(a,p);const page=UI.mount(s);await page.load();await page.openWorkspace(s.workspace);assert.match(s.root.textContent,/עותק מקורי זמין בתיק/);assert.match(s.root.textContent,/ספק הדיוור קיבל את המשלוח/);assert.match(s.root.textContent,/אין ראיית מסירה/);assert.match(s.root.textContent,/שרת הדואר דחה/);assert.doesNotMatch(s.root.textContent,/שרת הדואר של הנמען קיבל את העותק/);page.clear();
});

test('preparation requires meaningful application choice and sends an explicit empty budget choice',async()=>{
 const UI=require('../../app/lib/research-partnership-ui.js'),s=guidedSetup();s.sources.applications.push({recordId:id(23),versionId:id(24),revision:2,data:{title:'בקשה שנייה'}});s.sources.budgets=[{recordId:id(60),versionId:id(61),revision:1,data:{title:'תקציב ראשון'}},{recordId:id(62),versionId:id(63),revision:1,data:{title:'תקציב שני'}}];const page=UI.mount(s);await page.load();await page.openWorkspace(s.workspace);await btn(s.root,'הסכם חדש').click();
 assert.ok(!s.calls.some(([a])=>a==='agreementPrepare'));await btn(s.root,'הכנת טיוטת ההסכם').click();assert.ok(!s.calls.some(([a])=>a==='agreementPrepare'));field(s.root,'בקשה כמקור להסכם').value=id(24);field(s.root,'תקציב ראשון · גרסה 1').checked=false;field(s.root,'תקציב שני · גרסה 1').checked=false;await btn(s.root,'הכנת טיוטת ההסכם').click();const payload=s.calls.find(([a])=>a==='agreementPrepare')[1];assert.equal(payload.applicationVersionId,id(24));assert.deepEqual(payload.budgetVersionIds,[]);assert.deepEqual(payload.contributionVersionIds,[]);page.clear();
});

test('late source preview cannot replace a different editor or offer an apply after typing while waiting',async()=>{
 const UI=require('../../app/lib/research-partnership-ui.js');for(const leave of [false,true]){const s=guidedSetup(),original=s.client.call;let release,delay=false;s.client.call=async(a,p)=>{if(a==='agreementRefreshPreview'&&delay){const result=await original(a,p);return new Promise(resolve=>release=()=>resolve(result));}return original(a,p);};const page=UI.mount(s);await page.load();await page.openWorkspace(s.workspace);await btn(s.root,'הסכם חדש').click();await settle();delay=true;const waiting=btn(s.root,'בדיקת עדכונים מהמקורות').click();await settle();
 if(leave){await btn(s.root,'חזרה לתיק החוקרת').click();await btn(s.root,'בקשה חדשה').click();field(s.root,'כותרת').value='עורכת בקשה אחרת';}else{field(s.root,'מטרות המחקר').value='נוסח שנוסף בזמן ההמתנה';field(s.root,'מטרות המחקר').listeners.input();}release();await waiting;assert.equal(btn(s.root,'החלת העדכונים שנבחרו'),undefined);assert.equal(field(s.root,leave?'כותרת':'מטרות המחקר').value,leave?'עורכת בקשה אחרת':'נוסח שנוסף בזמן ההמתנה');page.clear();}
});

test('a previously approved intake reopens the prepared agreement only after fresh workspace and record reads',async()=>{
 const UI=require('../../app/lib/research-partnership-ui.js'),s=guidedSetup(),original=s.client.call;s.workspace.records=[{id:id(30),kind:'agreement',title:s.current().version.data.title}];
 s.client.call=async(a,p)=>{if(a==='intakeOwnerBootstrap')return {termsState:{revision:0},identities:[],institutions:[]};if(a==='bootstrap')return {owner:true,studies:[]};if(a==='intakeList')return {applications:[{id:id(70),title:'פנייה שאושרה',status:'approved'}]};if(a==='intakeGet')return {application:{id:id(70),revision:1,status:'approved',studyId:id(1),partnerId:id(2),recordId:id(20),application:{title:'פנייה שאושרה'}}};return original(a,p);};
 const page=UI.mount(s);await page.load();await btn(s.root,'בקשות לשותפות').click();await btn(s.root,'פנייה שאושרה').click();assert.ok(btn(s.root,'פתיחת טיוטת ההסכם שהוכנה'));const reads=s.calls.filter(([a])=>a==='recordGet').length;await btn(s.root,'פתיחת טיוטת ההסכם שהוכנה').click();assert.equal(field(s.root,'כותרת')?.value,'טיוטה שהוכנה בשרת');assert.ok(s.calls.filter(([a])=>a==='recordGet').length>reads);assert.ok(!s.calls.some(([a])=>a==='agreementPrepare'));page.clear();
});

test('a delayed policy reload preserves newly typed policy decisions and approval locks those exact decisions',async()=>{
 const UI=require('../../app/lib/research-partnership-ui.js'),P=require('../../app/lib/research-partnership-core.js'),s=guidedSetup(),original=s.client.call;let release,delay=false;
 s.client.call=async(a,p)=>{const result=await original(a,p);if(a==='processingPolicyGet'&&delay)return new Promise(resolve=>release=()=>resolve(result));if(a==='processingPolicyApprove')return new Promise(resolve=>release=()=>resolve(result));return result;};const page=UI.mount(s);await page.load();await page.openWorkspace(s.workspace);await btn(s.root,'הסכם חדש').click();await settle();await btn(s.root,'בדיקת הרשאת עיבוד').click();delay=true;const pending=btn(s.root,'בדיקת הרשאת עיבוד').click();await settle();field(s.root,'תפקידי הצדדים בעיבוד').value='החלטה שנוספה בהמתנה';release();await pending;assert.equal(field(s.root,'תפקידי הצדדים בעיבוד').value,'החלטה שנוספה בהמתנה');
 field(s.root,'מטרת העברה').value='external_impact';field(s.root,'ספק').value='synthetic';field(s.root,'גרסת ספק').value='1';field(s.root,'שינויי הסכם').checked=true;field(s.root,'בעלת המערכת, הרשאת עיבוד').checked=true;for(const def of P.PROCESSING_POLICY_FIELDS.filter(f=>!['purpose','provider','providerVersion','dataCategories','authorizedActors'].includes(f.id)))walk(s.root).find(n=>n.attributes['data-field-id']===def.id).value='החלטה סינתטית';await btn(s.root,'שמירת הרשאת עיבוד כטיוטה').click();const approving=btn(s.root,'אישור הרשאת העיבוד השמורה').click();await settle();assert.equal(field(s.root,'תפקידי הצדדים בעיבוד').disabled,true);release();await approving;page.clear();
});

test('navigation inside intake cancels a pending prepared-agreement handoff',async()=>{
 const UI=require('../../app/lib/research-partnership-ui.js'),s=guidedSetup(),original=s.client.call;let release,delay=false;s.workspace.records=[{id:id(30),kind:'agreement',title:s.current().version.data.title}];s.client.call=async(a,p)=>{if(a==='intakeOwnerBootstrap')return {termsState:{revision:0},identities:[],institutions:[]};if(a==='bootstrap')return {owner:true,studies:[]};if(a==='intakeList')return {applications:[{id:id(70),title:'פנייה שאושרה',status:'approved'}]};if(a==='intakeGet')return {application:{id:id(70),revision:1,status:'approved',studyId:id(1),partnerId:id(2),application:{title:'פנייה שאושרה'}}};const result=await original(a,p);if(a==='workspaceList'&&delay)return new Promise(resolve=>release=()=>resolve(result));return result;};const page=UI.mount(s);await page.load();await btn(s.root,'בקשות לשותפות').click();await btn(s.root,'פנייה שאושרה').click();delay=true;const opening=btn(s.root,'פתיחת טיוטת ההסכם שהוכנה').click();await settle();await btn(s.root,'בקשות לשותפות').click();release();await opening;assert.ok(btn(s.root,'פנייה שאושרה'));assert.equal(field(s.root,'כותרת'),undefined);page.clear();
});

test('source refresh follows selected record identities to newer source versions while preserving empty budget selection',async()=>{
 const UI=require('../../app/lib/research-partnership-ui.js'),s=guidedSetup(),original=s.client.call;let rejectOld=false;s.client.call=async(a,p)=>{if(a==='agreementRefreshPreview'&&rejectOld&&p.applicationVersionId===id(21))throw {code:'not_found',status:404};return original(a,p);};const page=UI.mount(s);await page.load();await page.openWorkspace(s.workspace);await btn(s.root,'הסכם חדש').click();await settle();s.sources.applications[0]={...s.sources.applications[0],versionId:id(22),revision:2};rejectOld=true;await btn(s.root,'בדיקת עדכונים מהמקורות').click();assert.ok(field(s.root,'החלפת שם החוקרת האחראית'));const payload=s.calls.filter(([a])=>a==='agreementRefreshPreview').at(-1)[1];assert.equal(payload.applicationVersionId,id(22));assert.deepEqual(payload.budgetVersionIds,[]);assert.equal(field(s.root,'בקשה כמקור להסכם').value,id(22));page.clear();
});

test('authorized editor resume retains an incomplete local policy draft and identifies nested missing decisions',async()=>{
 const UI=require('../../app/lib/research-partnership-ui.js'),s=guidedSetup(),page=UI.mount(s);await page.load();await page.openWorkspace(s.workspace);await btn(s.root,'הסכם חדש').click();await settle();assert.ok(walk(s.root).some(n=>n.className==='r-notice'&&n.textContent.includes('פריט 1')));await btn(s.root,'בדיקת הרשאת עיבוד').click();field(s.root,'תפקידי הצדדים בעיבוד').value='החלטה חלקית מקומית';await page.load(page.capture());await settle();assert.equal(field(s.root,'תפקידי הצדדים בעיבוד')?.value,'החלטה חלקית מקומית');assert.ok(!s.calls.some(([a])=>a==='processingPolicySave'));page.clear();
});

test('applying selected source changes retains an incomplete policy draft in the same editor',async()=>{
 const UI=require('../../app/lib/research-partnership-ui.js'),s=guidedSetup(),page=UI.mount(s);await page.load();await page.openWorkspace(s.workspace);await btn(s.root,'הסכם חדש').click();await settle();await btn(s.root,'בדיקת הרשאת עיבוד').click();field(s.root,'תפקידי הצדדים בעיבוד').value='החלטה חלקית שלא נשמרה';await btn(s.root,'בדיקת עדכונים מהמקורות').click();field(s.root,'החלפת שם החוקרת האחראית').checked=true;await btn(s.root,'החלת העדכונים שנבחרו').click();await settle();assert.equal(field(s.root,'תפקידי הצדדים בעיבוד')?.value,'החלטה חלקית שלא נשמרה');assert.ok(!s.calls.some(([a])=>a==='processingPolicySave'||a==='processingPolicyApprove'));assert.equal(field(s.root,'שם החוקרת האחראית').value,'מובילה מעודכנת');page.clear();
});

test('approved agreements show signing controls only when the provider readiness is configured',async()=>{
  const UI=require('../../app/lib/research-partnership-ui.js');
  for(const configured of [false,true]){
    const s=setup(),original=s.client.call;
    const agreement={record:{id:id(80),studyId:id(1),partnerId:id(2),kind:'agreement',status:'approved',revision:3},version:{id:id(81),number:1,contentHash:'c'.repeat(64),data:{title:'הסכם שהגיע לאישור',ownerName:'בעלת המערכת',partnerName:'חוקרת א',studyTitle:'מחקר א',purpose:'בדיקת מוכנות',effectiveDate:'2026-11-01'}}};
    s.workspace.records=[{id:id(80),partnerId:id(2),kind:'agreement',status:'approved',title:agreement.version.data.title}];
    s.client.call=async(a,p)=>{
      if(a==='recordGet'){s.calls.push([a,p]);return agreement;}
      const result=await original(a,p);
      if(a==='workspaceBootstrap')result.readiness.signing={configured,state:configured?'ready':'not_configured',message:'שירות החתימה טרם הוגדר.'};
      return result;
    };
    const page=UI.mount(s);await page.load();await page.openWorkspace(s.workspace);await btn(s.root,agreement.version.data.title).click();
    assert.match(s.root.textContent,/אושרה · גרסה 1/);
    assert.equal(Boolean(btn(s.root,'תחילת חתימה')),configured);
    if(!configured)assert.match(s.root.textContent,/שירות החתימה טרם הוגדר/);
    assert.ok(!s.calls.some(([action])=>action==='signingStart'));
    page.clear();
  }
});
test('persisted signing status stays readable but disabled deployment hides signing links and actions',async()=>{
  const UI=require('../../app/lib/research-partnership-ui.js');
  for(const configured of [false,true]){
    const s=setup(),original=s.client.call;
    const agreement={record:{id:id(80),studyId:id(1),partnerId:id(2),kind:'agreement',status:'signing',revision:3},version:{id:id(81),number:1,contentHash:'c'.repeat(64),data:{title:'הסכם עם תהליך חתימה שמור'}},signing:{id:id(82),recordId:id(80),state:'in_progress',configured:true,embeddedUrl:'https://synthetic.example.invalid/signing'}};
    s.workspace.records=[{id:id(80),partnerId:id(2),kind:'agreement',status:'signing',title:agreement.version.data.title}];
    s.client.call=async(a,p)=>{if(a==='recordGet'){s.calls.push([a,p]);return agreement;}const result=await original(a,p);if(a==='workspaceBootstrap')result.readiness.signing={configured,state:configured?'ready':'disabled',message:'החתימה האלקטרונית אינה פעילה בפריסה זו.'};return result;};
    const page=UI.mount(s);await page.load();await page.openWorkspace(s.workspace);await btn(s.root,agreement.version.data.title).click();
    assert.match(s.root.textContent,/החתימה בתהליך/);
    assert.equal(walk(s.root).some(n=>n.tagName==='iframe'),configured);
    assert.equal(walk(s.root).some(n=>n.tagName==='a'&&n.textContent==='פתיחת החתימה המאובטחת'),configured);
    assert.equal(Boolean(btn(s.root,'פתיחת תהליך החתימה')),configured);
    assert.equal(Boolean(btn(s.root,'עדכון מצב החתימה')),configured);
    if(!configured)assert.match(s.root.textContent,/החתימה האלקטרונית אינה פעילה בפריסה זו/);
    assert.ok(btn(s.root,'הורדת Word'));assert.ok(btn(s.root,'PDF והדפסה'));
    assert.ok(!s.calls.some(([action])=>['signingStart','signingView','signingRefresh'].includes(action)));
    page.clear();
  }
});
test('new safe partnership errors preserve dependency messages and clear private scope on denial',async()=>{const R=require('../../app/lib/research-client.js');let status=503;const clears=[];const client=R.create({getToken:()=> 'A',onClear:reason=>clears.push(reason),fetchImpl:async()=>({ok:false,status,json:async()=>({ok:false,code:status===503?'not_configured':'not_found',error:'arbitrary server details'})})});client.setScope(id(1));await assert.rejects(client.call('workspaceBootstrap'),e=>e.code==='not_configured'&&!e.userMessage.includes('arbitrary'));status=404;await assert.rejects(client.call('workspaceList'),e=>e.code==='not_found');assert.ok(clears.includes('not_found'));});
test('client directs an export raced by execution to private signed originals without generic retries or scope clearing',async()=>{
 const R=require('../../app/lib/research-client.js'),clears=[],requests=[];
 const client=R.create({getToken:()=> 'A',onClear:reason=>clears.push(reason),fetchImpl:async(u,o)=>{requests.push(JSON.parse(o.body));return {ok:false,status:409,json:async()=>({code:'signed_original_required',error:'arbitrary confidential provider details'})};}});
 client.setScope(id(1));const initial=clears.length;
 await assert.rejects(client.call('workspaceExport',{studyId:id(1),partnerId:id(2),recordId:id(3),versionId:id(4),format:'docx'}),e=>{
  assert.equal(e.code,'signed_original_required');assert.equal(e.status,409);assert.match(e.userMessage,/לרענן את התיק/);assert.match(e.userMessage,/העותק החתום המקורי/);assert.match(e.userMessage,/מסמכים הפרטיים/);assert.doesNotMatch(e.userMessage,/arbitrary|confidential|provider|לנסות שוב/);return true;
 });
 assert.equal(clears.length,initial);assert.equal(requests.length,1);
});
test('autosave creates server revisions and scope cleanup cancels a pending draft',async()=>{const UI=require('../../app/lib/research-partnership-ui.js'),s=setup(false),page=UI.mount(s);await page.load();await page.openWorkspace(s.workspace);await btn(s.root,'בקשה חדשה').click();const title=field(s.root,'כותרת');title.value='טיוטה אוטומטית';title.listeners.input();await new Promise(resolve=>setTimeout(resolve,1100));assert.equal(s.calls.filter(([a])=>a==='recordSave').length,1);title.value='שינוי שלא נשלח';title.listeners.input();page.clear();await new Promise(resolve=>setTimeout(resolve,1100));assert.equal(s.calls.filter(([a])=>a==='recordSave').length,1);assert.equal(s.root.textContent,'');});
test('same session refresh restores typed draft after authorization and ignores a sibling folder',async()=>{const UI=require('../../app/lib/research-partnership-ui.js'),s=setup(false),page=UI.mount(s);await page.load();await page.openWorkspace(s.workspace);await btn(s.root,'בקשה חדשה').click();field(s.root,'כותרת').value='טיוטה בזיכרון';const saved=page.capture();await page.load(saved);assert.equal(field(s.root,'כותרת').value,'טיוטה בזיכרון');await page.openWorkspace({...s.workspace,partnerId:id(88),partnerName:'SIBLING SECRET'});assert.ok(!s.calls.some(([a,p])=>a==='partnerGet'&&p.partnerId===id(88)));assert.ok(!s.root.textContent.includes('SIBLING SECRET'));page.clear();});
test('nested shell lifecycle captures workspace fields and reopens only after fresh authorization',async()=>{const UI=require('../../app/lib/research-management-ui.js'),s=setup(false),original=s.client.call;s.client.call=async(a,p)=>a==='bootstrap'?{owner:false,studies:[]}:original(a,p);const page=UI.mount({...s,search:'?workspace=1'});await page.load();await btn(s.root,'פתיחת התיק').click();await btn(s.root,'בקשה חדשה').click();field(s.root,'כותרת').value='נשמרת ברענון';const saved=page.capture();assert.equal(saved.workspace.editor.data.title,'נשמרת ברענון');await page.load(saved);assert.equal(field(s.root,'כותרת').value,'נשמרת ברענון');page.clear();});
test('agreement final approval uses canonical version hash, distinct IP acknowledgement and rejects visible unsaved changes',async()=>{const P=require('../../app/lib/research-partnership-core.js'),UI=require('../../app/lib/research-partnership-ui.js'),s=setup(),original=s.client.call;
  const template={record:{id:id(10),kind:'agreement_template',status:'approved',revision:1},version:{id:id(11),number:1,data:{title:'תבנית שסופקה לבדיקה',templateVersion:'1',explanationVersion:'1',sectionClauses:P.AGREEMENT_SECTIONS.map(section=>({sectionId:section.id,text:'נוסח בדיקה שסופק'})),ipExplanation:'הסבר שסופק לבדיקה',mutualIPClause:'נוסח שסופק לבדיקה'}}};
  const agreement={record:{id:id(12),kind:'agreement',status:'approved',revision:3,studyId:id(1),partnerId:id(2)},version:{id:id(13),number:2,contentHash:'b'.repeat(64),data:{title:'הסכם מאושר',ownerName:'בעלת המערכת',partnerName:'חוקרת א',studyTitle:'מחקר א',purpose:'מטרת בדיקה',effectiveDate:'2026-11-01',templateVersionId:id(11),ipExplanationVersionId:id(11),sharedExpenses:[{description:'הוצאה מוצעת',amount:'10.00',party:'shared'}]}}};
  s.workspace.records=[{id:id(10),kind:'agreement_template'},{id:id(12),kind:'agreement'}];s.client.call=async(a,p)=>{if(a==='recordGet'){s.calls.push([a,p]);return p.recordId===id(10)?template:agreement;}if(a==='agreementApprove'){s.calls.push([a,p]);return {record:agreement.record,approvals:[{party:'owner',versionId:id(13),documentHash:'b'.repeat(64)}]};}return original(a,p);};
  const page=UI.mount(s);await page.load();await page.openWorkspace(s.workspace);await btn(s.root,'הסכם מאושר').click();await new Promise(resolve=>setTimeout(resolve,1100));assert.ok(!s.calls.some(([a])=>a==='recordSave'),'loading existing nested rows must not create a counterproposal');await btn(s.root,'אישור הגרסה הסופית').click();assert.ok(!s.calls.some(([a])=>a==='agreementApprove'));field(s.root,'קראתי את הסבר הקניין הרוחני של גרסה זו').checked=true;field(s.root,'כותרת').value='נוסח שלא נשמר';await btn(s.root,'אישור הגרסה הסופית').click();assert.ok(!s.calls.some(([a])=>a==='agreementApprove'));field(s.root,'כותרת').value='הסכם מאושר';await btn(s.root,'אישור הגרסה הסופית').click();const sent=s.calls.find(([a])=>a==='agreementApprove')[1];assert.equal(sent.documentHash,'b'.repeat(64));assert.equal(sent.versionId,id(13));assert.equal(sent.ipReadAcknowledged,true);assert.ok(!s.calls.some(([a])=>a==='signingStart'));page.clear();});
test('an explicitly shared record opens its actual scope without sibling profile and download stays independent',async()=>{const UI=require('../../app/lib/research-partnership-ui.js'),s=setup(false),original=s.client.call;let download=false;s.workspace.records=[{id:id(55),partnerId:id(88),kind:'finding',status:'published',title:'ממצא בודד'}];s.client.call=async(a,p)=>{if(a==='recordGet'){s.calls.push([a,p]);return {record:{id:id(55),kind:'finding',status:'published',partnerId:id(88)},version:{id:id(56),number:1,data:{title:'ממצא בודד',summary:'הסיכום שאושר'}},access:{canView:true,canDownload:download,canComment:false}};}return original(a,p);};const page=UI.mount(s);await page.load();await page.openWorkspace(s.workspace);assert.ok(!s.calls.some(([a])=>a==='recordGet'));await btn(s.root,'ממצא בודד').click();assert.equal(s.calls.find(([a])=>a==='recordGet')[1].partnerId,id(88));assert.ok(!s.calls.some(([a,p])=>a==='partnerGet'&&p.partnerId===id(88)));assert.ok(!btn(s.root,'הורדת Word'));assert.ok(!field(s.root,'תגובה לממצא'));download=true;await page.openWorkspace(s.workspace);await btn(s.root,'ממצא בודד').click();assert.ok(btn(s.root,'הורדת Word'));page.clear();});

test('an owner-created analysis result in the recipient folder uses the released read-only view',async()=>{
  const UI=require('../../app/lib/research-partnership-ui.js'),s=setup(false),original=s.client.call;
  s.workspace.records=[{id:id(57),partnerId:s.workspace.partnerId,kind:'analysis_result',status:'published',title:'ניתוח שפורסם'}];
  s.client.call=async(a,p)=>a==='recordGet'?{record:{id:id(57),partnerId:s.workspace.partnerId,kind:'analysis_result',status:'published'},version:{id:id(58),number:1,data:{title:'ניתוח שפורסם',summary:'תוצאה שאושרה'}},access:{canView:true,canDownload:false,canComment:false}}:original(a,p);
  const page=UI.mount(s);await page.load();await page.openWorkspace(s.workspace);await btn(s.root,'ניתוח שפורסם').click();
  assert.match(s.root.textContent,/תוצאה שאושרה/);
  assert.equal(field(s.root,'כותרת'),undefined);
  assert.equal(btn(s.root,'שמירת טיוטה'),undefined);
  assert.equal(btn(s.root,'הורדת Word'),undefined);
  page.clear();
});
test('a new application uploads actual private bytes and saves only the authorized attachment reference',async()=>{const UI=require('../../app/lib/research-partnership-ui.js'),s=setup(false),original=s.client.call;s.client.call=async(a,p)=>{if(a==='workspaceDocumentPut'){s.calls.push([a,p]);return {document:{id:id(70),filename:p.filename,mediaType:p.mediaType,size:3,studyId:id(1),partnerId:id(2)}};}return original(a,p);};const page=UI.mount(s);await page.load();await page.openWorkspace(s.workspace);await btn(s.root,'בקשה חדשה').click();const input=field(s.root,'צירוף מסמך פרטי');input.files=[{name:'private.txt',type:'text/plain',size:3,arrayBuffer:async()=>new TextEncoder().encode('abc').buffer}];await input.listeners.change();assert.equal(s.calls.find(([a])=>a==='workspaceDocumentPut')[1].contentBase64,'YWJj');await btn(s.root,'שמירת טיוטה').click();const saved=s.calls.find(([a])=>a==='recordSave')[1];assert.deepEqual(saved.data.supportingDocumentIds,[id(70)]);assert.ok(!JSON.stringify(saved).includes('YWJj'));page.clear();});
test('return to folder flushes a valid draft, current version header updates and unchanged save creates no duplicate',async()=>{const UI=require('../../app/lib/research-partnership-ui.js'),C=require('../../app/lib/research-core.js'),s=setup(false),page=UI.mount(s);await page.load();await page.openWorkspace(s.workspace);await btn(s.root,'בקשה חדשה').click();assert.equal(field(s.root,'מועד התחלה').attributes['aria-label'],'מועד התחלה');assert.match(s.root.textContent,new RegExp(C.PERMISSIONS.edit_study));assert.ok(!s.root.textContent.includes('view_audit_log'));const title=field(s.root,'כותרת');title.value='טיוטה בדרך לתיק';title.listeners.input();await btn(s.root,'חזרה לתיק החוקרת').click();assert.equal(s.calls.filter(([a])=>a==='recordSave').length,1);await btn(s.root,'טיוטה בדרך לתיק').click();field(s.root,'כותרת').value='טיוטה מעודכנת';await btn(s.root,'שמירת טיוטה').click();assert.match(s.root.textContent,/טיוטה · גרסה 2/);await btn(s.root,'שמירת טיוטה').click();assert.equal(s.calls.filter(([a])=>a==='recordSave').length,2);page.clear();});

test('failed autosave and manual save retain the draft and block navigation until a save succeeds',async()=>{
  const UI=require('../../app/lib/research-partnership-ui.js');
  for(const autosave of [true,false]){
    const s=setup(false),original=s.client.call;let fail=true,attempts=0;
    s.client.call=async(a,p)=>{if(a==='recordSave'){attempts++;if(fail)throw Object.assign(new Error('network'),{code:'network'});}return original(a,p);};
    const page=UI.mount(s);await page.load();await page.openWorkspace(s.workspace);await btn(s.root,'בקשה חדשה').click();
    const title=field(s.root,'כותרת');title.value='טיוטה שנשמרת גם בתקלה';title.listeners.input();
    if(autosave)await new Promise(resolve=>setTimeout(resolve,1100));else await btn(s.root,'שמירת טיוטה').click();
    await btn(s.root,'חזרה לתיק החוקרת').click();
    assert.equal(field(s.root,'כותרת')?.value,'טיוטה שנשמרת גם בתקלה');assert.equal(attempts,2);
    fail=false;await btn(s.root,'חזרה לתיק החוקרת').click();assert.ok(!field(s.root,'כותרת'));
    await btn(s.root,'טיוטה שנשמרת גם בתקלה').click();assert.equal(field(s.root,'כותרת').value,'טיוטה שנשמרת גם בתקלה');page.clear();
  }
});

test('submission waits for all edited snapshots and never submits after a failed save',async()=>{
  const UI=require('../../app/lib/research-partnership-ui.js'),s=setup(false),original=s.client.call;
  let fail=false,release,submitted;
  s.client.call=async(a,p)=>{
    if(a==='recordSave'&&fail)throw Object.assign(new Error('network'),{code:'network'});
    if(a==='recordSave'&&release===null)return new Promise(resolve=>{release=()=>original(a,p).then(resolve);});
    if(a==='recordSubmit'){s.calls.push([a,p]);submitted=p;const saved=await original('recordGet',p);return {...saved,record:{...saved.record,status:'submitted'}};}
    return original(a,p);
  };
  const page=UI.mount(s);await page.load();await page.openWorkspace(s.workspace);await btn(s.root,'תרומה חדשה').click();
  field(s.root,'כותרת').value='תרומה';field(s.root,'סוג התרומה').value='scientific';field(s.root,'תיאור התרומה').value='תיאור מקורי';await btn(s.root,'שמירת טיוטה').click();
  let description=field(s.root,'תיאור התרומה');description.value='תיאור שלא נשמר';description.listeners.input();fail=true;await btn(s.root,'שמירת טיוטה').click();await btn(s.root,'הגשה לבדיקה').click();
  assert.equal(submitted,undefined);assert.equal(field(s.root,'תיאור התרומה').value,'תיאור שלא נשמר');
  fail=false;release=null;const saving=btn(s.root,'שמירת טיוטה').click();await new Promise(resolve=>setImmediate(resolve));
  description.value='העריכה האחרונה בזמן הבקשה';description.listeners.input();const submitting=btn(s.root,'הגשה לבדיקה').click();release();await saving;await submitting;
  const saves=s.calls.filter(([a])=>a==='recordSave');assert.equal(saves.at(-1)[1].data.description,'העריכה האחרונה בזמן הבקשה');assert.equal(submitted.expectedRevision,3);assert.equal(submitted.versionId,id(4));page.clear();
});

test('authorized lifecycle revalidation retains a failed pending draft and its navigation save requirement',async()=>{
  const UI=require('../../app/lib/research-partnership-ui.js');
  for(const existing of [false,true]){
    const s=setup(false),original=s.client.call;let fail=false,attempts=0;
    s.client.call=async(a,p)=>{if(a==='recordSave'){attempts++;if(fail)throw Object.assign(new Error('network'),{code:'network'});}return original(a,p);};
    const page=UI.mount(s);await page.load();await page.openWorkspace(s.workspace);await btn(s.root,'בקשה חדשה').click();
    if(existing){field(s.root,'כותרת').value='גרסה שנשמרה';await btn(s.root,'שמירת טיוטה').click();}
    const title=field(s.root,'כותרת');title.value='טיוטה ממתינה שלא נשמרה';title.listeners.input();fail=true;await btn(s.root,'שמירת טיוטה').click();
    await page.load(page.capture());const previousAttempts=attempts;await btn(s.root,'חזרה לתיק החוקרת').click();
    assert.equal(field(s.root,'כותרת')?.value,'טיוטה ממתינה שלא נשמרה');assert.equal(attempts,previousAttempts+1);page.clear();
  }
});

test('agreement loads persisted approvals only for its exact current version and hash',async()=>{
  const UI=require('../../app/lib/research-partnership-ui.js'),s=setup(),original=s.client.call;
  const agreement={record:{id:id(80),studyId:id(1),partnerId:id(2),kind:'agreement',status:'approved',revision:3},version:{id:id(81),number:1,contentHash:'c'.repeat(64),data:{title:'הסכם עם אישורים שמורים'}},approvals:[{party:'owner',versionId:id(81),documentHash:'c'.repeat(64)},{party:'partner',versionId:id(81),documentHash:'c'.repeat(64)}]};
  s.workspace.records=[{id:id(80),kind:'agreement',status:'approved',title:agreement.version.data.title}];s.client.call=async(a,p)=>a==='recordGet'?structuredClone(agreement):original(a,p);
  const page=UI.mount(s);await page.load();await page.openWorkspace(s.workspace);await btn(s.root,agreement.version.data.title).click();
  assert.match(s.root.textContent,/בעלת המערכת אישרה את הגרסה הזו/);assert.match(s.root.textContent,/החוקרת אישרה את הגרסה הזו/);
  await page.load(page.capture());assert.match(s.root.textContent,/החוקרת אישרה את הגרסה הזו/);
  agreement.record.revision=4;agreement.version.id=id(82);agreement.version.number=2;agreement.version.contentHash='d'.repeat(64);
  await page.openWorkspace(s.workspace);await btn(s.root,agreement.version.data.title).click();assert.ok(!s.root.textContent.includes('אישרה את הגרסה הזו'));page.clear();
});

test('executed agreement directs downloads to private immutable documents rather than regenerating exports',async()=>{
 const UI=require('../../app/lib/research-partnership-ui.js'),s=setup(),original=s.client.call,source={record:{id:id(80),studyId:id(1),partnerId:id(2),kind:'agreement',status:'executed',revision:5},version:{id:id(81),number:2,data:{title:'הסכם חתום בדוי'}}};
 s.workspace.records=[{id:id(80),kind:'agreement',status:'executed',title:'הסכם חתום בדוי'}];s.client.call=async(a,p)=>a==='recordGet'?source:original(a,p);
 const page=UI.mount(s);await page.load();await page.openWorkspace(s.workspace);await btn(s.root,'הסכם חתום בדוי').click();
 assert.equal(btn(s.root,'הורדת Word'),undefined);assert.equal(btn(s.root,'PDF והדפסה'),undefined);assert.match(s.root.textContent,/ההסכם החתום ותיעוד החתימה/);assert.match(s.root.textContent,/מסמכים פרטיים/);assert.ok(!s.calls.some(([a])=>a==='workspaceExport'));page.clear();
});

test('linked amendments identify the exact executed source and open a separate editable draft',async()=>{
  const UI=require('../../app/lib/research-partnership-ui.js');
  for(const previousSource of [undefined,id(77)]){
    const s=setup(),original=s.client.call,source={record:{id:id(80),studyId:id(1),partnerId:id(2),kind:'agreement',status:'executed',revision:5},version:{id:id(81),number:2,contentHash:'c'.repeat(64),data:{title:'הסכם חתום',...(previousSource?{amendsAgreementVersionId:previousSource}:{})}}},before=structuredClone(source);
    s.workspace.records=[{id:id(80),kind:'agreement',status:'executed',title:'הסכם חתום'}];
    s.client.call=async(a,p)=>{if(a==='recordGet')return source;if(a==='agreementAmend'){s.calls.push([a,p]);return {record:{...source.record,id:id(90),status:'draft',revision:1},version:{id:id(91),number:1,data:{...p.data,title:'תיקון חדש'},contentHash:'d'.repeat(64)}};}return original(a,p);};
    const page=UI.mount(s);await page.load();await page.openWorkspace(s.workspace);await btn(s.root,'הסכם חתום').click();assert.equal(field(s.root,'כותרת').disabled,true);
    field(s.root,'סיבת התיקון להסכם').value='הסכמה הדדית מוצעת';await btn(s.root,'פתיחת תיקון מקושר').click();const sent=s.calls.find(([a])=>a==='agreementAmend')[1];
    assert.equal(sent.versionId,id(81));assert.equal(sent.data.amendsAgreementVersionId,id(81));assert.deepEqual(source,before);assert.equal(field(s.root,'כותרת').value,'תיקון חדש');assert.ok(!field(s.root,'כותרת').disabled);assert.match(s.root.textContent,/טיוטה · גרסה 1/);page.clear();
  }
});

test('the exact delivered invitation fragment survives revalidation then clears before accepted workspace loading',async()=>{
  const UI=require('../../app/lib/research-management-ui.js'),s=setup(false),original=s.client.call,route=new URL('https://example.test/research-management.html#partner-invite=opaque_token-123'),routes=[];
  s.client.call=async(a,p)=>{if(a==='bootstrap')return {owner:false,studies:[]};if(a==='partnerInviteGet'){s.calls.push([a,p]);return {invitation:{studyTitle:'מחקר א',expiresAt:'2026-11-01'}};}if(a==='partnerInviteAccept'){s.calls.push([a,p]);return {invitation:{status:'accepted'}};}return original(a,p);};
  const page=UI.mount({...s,search:route.search,hash:route.hash,replaceRoute:next=>routes.push(next)});await page.load();
  assert.equal(s.calls.find(([a])=>a==='partnerInviteGet')?.[1].invite,'opaque_token-123');assert.ok(btn(s.root,'אישור ההצטרפות למחקר'));
  await page.load(page.capture());assert.equal(s.calls.filter(([a])=>a==='partnerInviteGet').length,2);
  await btn(s.root,'אישור ההצטרפות למחקר').click();assert.deepEqual(routes,['']);assert.ok(btn(s.root,'פתיחת התיק'));assert.ok(!btn(s.root,'אישור ההצטרפות למחקר'));
  await page.load(page.capture());assert.equal(s.calls.filter(([a])=>a==='partnerInviteGet').length,2);assert.equal(s.calls.find(([a])=>a==='partnerInviteAccept')[1].invite,'opaque_token-123');page.clear();
});

test('authorized asynchronous document export and contribution report use the shared inline print path',async()=>{
  const UI=require('../../app/lib/research-partnership-ui.js'),s=setup(),original=s.client.call,printed=[],originalParser=globalThis.DOMParser;
  s.document.importNode=n=>n;
  globalThis.DOMParser=class{parseFromString(html){const text=new Element('p');text.textContent=html;return {body:{children:[text]}};}};
  let release;const exported=new Promise(resolve=>release=resolve);
  s.client.call=async(a,p)=>{if(a==='workspaceExport'){s.calls.push([a,p]);return exported;}return original(a,p);};
  const page=UI.mount({...s,productDoc:{print:args=>printed.push(args)}});
  try{
    await page.load();await page.openWorkspace(s.workspace);await btn(s.root,'בקשה חדשה').click();field(s.root,'כותרת').value='מסמך מורשה';await btn(s.root,'שמירת טיוטה').click();
    const printing=btn(s.root,'PDF והדפסה').click();await new Promise(resolve=>setImmediate(resolve));assert.equal(printed.length,0);
    release({contentBase64:Buffer.from('<p>תוכן שאושר לייצוא</p>').toString('base64')});await printing;
    assert.equal(s.calls.find(([a])=>a==='workspaceExport')[1].versionId,id(4));assert.equal(printed[0].inline,true);assert.match(printed[0].node.textContent,/תוכן שאושר לייצוא/);
    await btn(s.root,'חזרה לתיק החוקרת').click();await btn(s.root,'דוח תרומות לפי מחקר').click();await btn(s.root,'PDF והדפסת דוח התרומות').click();assert.equal(printed[1].inline,true);assert.match(printed[1].node.textContent,/מחקר א/);
  }finally{page.clear();globalThis.DOMParser=originalParser;}
});

test('guided in-app PDF retains authorized document styles and right alignment while printing the title once',async()=>{
 const UI=require('../../app/lib/research-partnership-ui.js'),s=guidedSetup(),original=s.client.call,printed=[],originalParser=globalThis.DOMParser;
 s.document.importNode=n=>n;globalThis.DOMParser=class{parseFromString(){const title=new Element('h1'),p=new Element('p');title.textContent='טיוטה שהוכנה בשרת';p.textContent='פסקה מורשית';return {body:{children:[title,p]},querySelector:selector=>selector==='style'?{textContent:'.agreement-row{break-inside:auto}'}:null};}};
 s.client.call=async(a,p)=>a==='workspaceExport'?{contentBase64:Buffer.from('<html>authorized synthetic HTML</html>').toString('base64')}:original(a,p);
 const page=UI.mount({...s,productDoc:{print:args=>printed.push(args)}});
 try{await page.load();await page.openWorkspace(s.workspace);await btn(s.root,'הסכם חדש').click();await btn(s.root,'PDF והדפסה').click();assert.equal(printed.length,1);assert.equal(printed[0].inline,true);assert.equal(printed[0].title,'טיוטה שהוכנה בשרת');assert.match(printed[0].extraCss,/agreement-row\{break-inside:auto\}/);assert.match(printed[0].extraCss,/text-align:right!important/);assert.equal(walk(printed[0].node).some(n=>n.tagName==='h1'),false);assert.match(printed[0].node.textContent,/פסקה מורשית/);}finally{page.clear();globalThis.DOMParser=originalParser;}
});
