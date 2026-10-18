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
function setup(owner=true){const root=new Element(),document={createElement:t=>new Element(t),body:new Element('body')},calls=[];
  const workspace={studyId:id(1),partnerId:id(2),studyTitle:'מחקר א',partnerName:'חוקרת א',pendingCount:2,deadlines:[{title:'השלמת בקשה',dueDate:'2026-11-01'}],records:[]};
  let saved;
  const client={setScope(){},call:async(action,payload)=>{calls.push([action,payload]);if(action==='workspaceBootstrap')return {owner,partners:[{id:id(2),fullName:'חוקרת א'}],studies:[{id:id(1),title:'מחקר א',permissions:['view_study','propose_analysis']}],capabilities:[],readiness:{signing:{configured:false,state:'not_configured',message:'שירות החתימה טרם הוגדר.'}}};if(action==='workspaceList')return {workspaces:[workspace],nextCursor:null};if(action==='partnerGet')return {partner:{id:id(2),revision:1,profile:{fullName:'חוקרת א',email:'a@example.test',institution:'מוסד א'}},workspaces:[workspace]};if(action==='versionList')return {versions:[]};if(action==='recordSave'){saved={record:{id:id(3),studyId:id(1),partnerId:id(2),kind:payload.kind,status:'draft',revision:(saved?.record.revision||0)+1,headVersionId:id(4)},version:{id:id(4),number:(saved?.record.revision||0)+1,data:payload.data,contentHash:'a'.repeat(64)}};workspace.records=[{id:id(3),kind:payload.kind,status:'draft',revision:saved.record.revision,title:payload.data.title,headVersionId:id(4)}];return saved;}if(action==='recordVersions')return {versions:saved?[saved.version]:[]};if(action==='recordGet')return saved;return {};}};
  return {root,document,client,calls,workspace};}
test('partnership client accepts public actions and treats analysis as a mutation',async()=>{const R=require('../../app/lib/research-client.js');const sent=[];const client=R.create({getToken:()=> 'A',uuid:()=>id(99),fetchImpl:async(u,o)=>{sent.push(JSON.parse(o.body));return {ok:true,status:200,json:async()=>({ok:true})};}});await client.call('workspaceBootstrap');await client.call('workspaceAnalysis',{studyId:id(1),partnerId:id(2),requestRecordId:id(3),operation:'descriptive'});assert.equal(sent[0].requestId,undefined);assert.equal(sent[1].requestId,id(99));await assert.rejects(client.call('signatureComplete'),/invalid/);});
test('owner dashboard has authorized filters, counts and folder navigation',async()=>{const UI=require('../../app/lib/research-partnership-ui.js');const s=setup();const page=UI.mount(s);await page.load();assert.match(s.root.textContent,/ניהול שותפויות והסכמים/);assert.match(s.root.textContent,/ממתינים לבדיקה/);assert.ok(field(s.root,'חיפוש חוקרת או מחקר'));field(s.root,'חיפוש חוקרת או מחקר').value='חוקרת א';await btn(s.root,'חיפוש').click();assert.equal(s.calls.filter(([a])=>a==='workspaceList').at(-1)[1].query,'חוקרת א');await page.openWorkspace(s.workspace);assert.match(s.root.textContent,/התיק של חוקרת א/);assert.ok(btn(s.root,'בקשה חדשה'));});
test('researcher works in own folder and typed application saves immutable server draft',async()=>{const UI=require('../../app/lib/research-partnership-ui.js');const s=setup(false);const page=UI.mount(s);await page.load();assert.ok(!s.root.textContent.includes('ניהול שותפויות והסכמים'));assert.ok(!field(s.root,'חיפוש חוקרת או מחקר'));await page.openWorkspace(s.workspace);await btn(s.root,'בקשה חדשה').click();field(s.root,'כותרת').value='הצעת מחקר';field(s.root,'שאלות מחקר').value='שאלה א\nשאלה ב';await btn(s.root,'שמירת טיוטה').click();const payload=s.calls.find(([a])=>a==='recordSave')[1];assert.equal(payload.studyId,id(1));assert.equal(payload.partnerId,id(2));assert.equal(payload.expectedRevision,null);assert.deepEqual(payload.data.researchQuestions,['שאלה א','שאלה ב']);assert.equal(payload.data.fullName,'חוקרת א');assert.ok(walk(s.root).filter(n=>['input','textarea','select'].includes(n.tagName)).every(n=>n.attributes.dir==='rtl'));assert.ok(!walk(s.root).some(n=>n.attributes['data-research-field']==='studyId'));});
test('nested agreement rows are fieldsets and unconfigured signature cannot execute',async()=>{const UI=require('../../app/lib/research-partnership-ui.js');const s=setup();const page=UI.mount(s);await page.load();await page.openWorkspace(s.workspace);await btn(s.root,'הסכם חדש').click();await btn(s.root,'הוספת הוצאות משותפות').click();assert.ok(walk(s.root).some(n=>n.tagName==='fieldset'));assert.ok(field(s.root,'סכום'));assert.match(s.root.textContent,/תבנית מאושרת/);assert.ok(!btn(s.root,'תחילת חתימה'));await btn(s.root,'שמירת טיוטה').click();assert.ok(!s.calls.some(([a])=>a==='signingStart'));});

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
test('new safe partnership errors preserve dependency messages and clear private scope on denial',async()=>{const R=require('../../app/lib/research-client.js');let status=503;const clears=[];const client=R.create({getToken:()=> 'A',onClear:reason=>clears.push(reason),fetchImpl:async()=>({ok:false,status,json:async()=>({ok:false,code:status===503?'not_configured':'not_found',error:'arbitrary server details'})})});client.setScope(id(1));await assert.rejects(client.call('workspaceBootstrap'),e=>e.code==='not_configured'&&!e.userMessage.includes('arbitrary'));status=404;await assert.rejects(client.call('workspaceList'),e=>e.code==='not_found');assert.ok(clears.includes('not_found'));});
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
