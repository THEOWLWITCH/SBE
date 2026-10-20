import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
class Element {
  constructor(tag='div'){this.tagName=tag;this.children=[];this.listeners={};this.attributes={};this.value='';this.checked=false;this.style={};}
  append(...nodes){for(const n of nodes){n.parentNode=this;this.children.push(n);}}
  replaceChildren(...nodes){this.children=[];this._text='';this.append(...nodes);}
  set textContent(v){this._text=String(v);this.children=[];}
  get textContent(){return (this._text||'')+this.children.map(n=>n.textContent).join(' ');}
  addEventListener(name,fn){this.listeners[name]=fn;}
  setAttribute(k,v){this.attributes[k]=v;}
  getAttribute(k){return this.attributes[k];}
  click(){return this.listeners.click?.({preventDefault(){}});}
}
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const walk=n=>[n,...n.children.flatMap(walk)];
const button=(r,s)=>walk(r).find(n=>n.tagName==='button'&&n.textContent===s);
const field=(r,s)=>walk(r).find(n=>n.attributes['data-research-field']===s);
const setup=()=>({root:new Element(),document:{createElement:t=>new Element(t)}});
const terms={versionId:id(1),number:1,title:'תנאים סינתטיים',text:'שורה ראשונה\n\nשורה שנייה <b>טקסט</b>',hash:'a'.repeat(64)};
function fill(root,type='individual'){
  for(const [label,value]of Object.entries({'כותרת הבקשה':'מחקר סינתטי','שם מלא':'פונה לבדיקה','דוא״ל':'synthetic@example.test','מטרות בקצרה':'היכרות ראשונית','כלים מבוקשים':'פרקטי\nנוגי','סוג הפונה':type}))field(root,label).value=value;
}
test('public transport omits authentication and retains request UUID only for the same ambiguous payload',async()=>{
  const UI=require('../../app/lib/research-intake-ui.js'),calls=[];let fail=true,next=10;
  const client=UI.createPublicClient({uuid:()=>id(next++),fetchImpl:async(url,options)=>{calls.push({url,options,body:JSON.parse(options.body)});if(fail)throw Error('offline');return {ok:true,status:200,json:async()=>({receipt:{id:id(90),status:'submitted'}})};}});
  const application={title:'א',applicationType:'partnership',fullName:'בדיקה',email:'a@example.test',objectives:'מטרות',requestedTools:['פרקטי'],applicantType:'individual'};
  const payload={termsVersionId:terms.versionId,termsHash:terms.hash,acknowledged:true,application};
  await assert.rejects(client.call('intakeSubmit',payload));await assert.rejects(client.call('intakeSubmit',payload));
  assert.equal(calls[0].body.requestId,calls[1].body.requestId);assert.equal(calls[0].options.credentials,'omit');assert.equal(calls[0].options.cache,'no-store');assert.equal(calls[0].body.token,undefined);assert.match(calls[0].url,/\/api\/research-intake$/);
  fail=false;await client.call('intakeSubmit',{...payload,application:{...application,title:'ב'}});assert.notEqual(calls[2].body.requestId,calls[0].body.requestId);
  await assert.rejects(client.call('intakeReview',{}),/invalid/);
});
test('public preliminary request uses typed fields, conditional institution and reading acknowledgement, then neutral receipt',async()=>{
  const UI=require('../../app/lib/research-intake-ui.js'),s=setup(),calls=[];
  const page=UI.mountPublic({...s,client:{call:async(a,p)=>{calls.push([a,p]);return a==='intakePublicInfo'?{terms,acceptingApplications:true}:{receipt:{id:id(90),status:'submitted',submittedAt:'2026-10-20T10:00:00Z'}};}}});
  await page.load();assert.ok(s.root.textContent.includes(terms.text));assert.equal(field(s.root,'קראתי את תנאי הפנייה. אישור הקריאה אינו חתימה על הסכם').checked,false);
  await button(s.root,'הגשת בקשה').click();assert.match(s.root.textContent,/כותרת הבקשה.*שם מלא.*דוא״ל.*מטרות בקצרה.*כלים מבוקשים/);
  fill(s.root,'institution');field(s.root,'קראתי את תנאי הפנייה. אישור הקריאה אינו חתימה על הסכם').checked=true;
  await button(s.root,'הגשת בקשה').click();assert.equal(calls.filter(([a])=>a==='intakeSubmit').length,0);assert.match(s.root.textContent,/להשלמת הפנייה: מוסד/);
  field(s.root,'סוג הפונה').value='individual';field(s.root,'קראתי את תנאי הפנייה. אישור הקריאה אינו חתימה על הסכם').checked=false;
  await button(s.root,'הגשת בקשה').click();assert.equal(calls.filter(([a])=>a==='intakeSubmit').length,0);
  field(s.root,'קראתי את תנאי הפנייה. אישור הקריאה אינו חתימה על הסכם').checked=true;await button(s.root,'הגשת בקשה').click();
  const sent=calls.find(([a])=>a==='intakeSubmit')[1];assert.deepEqual(sent.application.requestedTools,['פרקטי','נוגי']);assert.equal(sent.application.applicantType,'individual');assert.equal(sent.application.method,undefined);assert.match(s.root.textContent,/הבקשה התקבלה לבדיקה/);assert.match(s.root.textContent,/אינה יוצרת חשבון/);
});
test('unavailable published terms close submission and changing terms retains the draft with a fresh unchecked acknowledgement',async()=>{
  const UI=require('../../app/lib/research-intake-ui.js'),s=setup();let info={terms:null,acceptingApplications:false};
  const page=UI.mountPublic({...s,client:{call:async()=>info}});await page.load();assert.match(s.root.textContent,/הפניות סגורות כרגע/);assert.equal(button(s.root,'הגשת בקשה'),undefined);
  info={terms,acceptingApplications:true};await page.load();fill(s.root);field(s.root,'קראתי את תנאי הפנייה. אישור הקריאה אינו חתימה על הסכם').checked=true;
  await page.load();assert.equal(field(s.root,'קראתי את תנאי הפנייה. אישור הקריאה אינו חתימה על הסכם').checked,true);
  info={terms:{...terms,versionId:id(2),number:2,hash:'b'.repeat(64)},acceptingApplications:true};await page.load();assert.equal(field(s.root,'כותרת הבקשה').value,'מחקר סינתטי');assert.equal(field(s.root,'קראתי את תנאי הפנייה. אישור הקריאה אינו חתימה על הסכם').checked,false);assert.match(s.root.textContent,/התנאים עודכנו/);
  assert.ok(walk(s.root).filter(n=>['input','textarea','select'].includes(n.tagName)).every(n=>n.attributes.dir==='rtl'));
});
test('stale submitted terms ask for review of the new exact version without erasing the draft',async()=>{
  const UI=require('../../app/lib/research-intake-ui.js'),s=setup();let current=terms;
  const page=UI.mountPublic({...s,client:{call:async(a)=>{if(a==='intakePublicInfo')return {terms:current,acceptingApplications:true};current={...terms,versionId:id(2),number:2,hash:'b'.repeat(64)};throw {code:'conflict'};}}});
  await page.load();fill(s.root);field(s.root,'קראתי את תנאי הפנייה. אישור הקריאה אינו חתימה על הסכם').checked=true;await button(s.root,'הגשת בקשה').click();assert.equal(field(s.root,'כותרת הבקשה').value,'מחקר סינתטי');assert.equal(field(s.root,'קראתי את תנאי הפנייה. אישור הקריאה אינו חתימה על הסכם').checked,false);assert.match(s.root.textContent,/גרסה 2/);assert.match(s.root.textContent,/התנאים עודכנו/);
});
test('focus refresh during an in-flight submission does not discard a successful receipt',async()=>{
  const UI=require('../../app/lib/research-intake-ui.js'),s=setup();let complete;
  const page=UI.mountPublic({...s,client:{call:async(a)=>a==='intakePublicInfo'?{terms,acceptingApplications:true}:new Promise(resolve=>{complete=()=>resolve({receipt:{id:id(90),status:'submitted'}});})}});
  await page.load();fill(s.root);field(s.root,'קראתי את תנאי הפנייה. אישור הקריאה אינו חתימה על הסכם').checked=true;const submitted=button(s.root,'הגשת בקשה').click();await page.load();complete();await submitted;assert.match(s.root.textContent,/הבקשה התקבלה לבדיקה/);
});
function ownerSetup(){
  const s=setup(),calls=[];let termsState={revision:0,draftVersion:null,publishedVersionId:null};
  const application={id:id(20),revision:2,status:'submitted',submittedAt:'2026-10-20T10:00:00Z',application:{title:'מחקר סינתטי',objectives:'מטרות סינתטיות',fullName:'פונה סינתטית',email:'synthetic@example.test',requestedPermissions:['export_data'],applicantType:'individual'}};
  const bootstrap={owner:true,studies:[{id:id(30),revision:4,config:{title:'מחקר קיים'}}],identities:[{code:'SYNTHETIC',label:'זהות מאומתת',institution:'בדיקה'}],institutions:['בדיקה']};
  const client={call:async(a,p)=>{calls.push([a,p]);if(a==='intakeOwnerBootstrap')return {...bootstrap,termsState};if(a==='intakeList')return {applications:[application],nextCursor:null};if(a==='intakeGet')return {application,terms};if(a==='intakeTermsSave'){termsState={revision:1,draftVersion:{...terms,title:p.title,text:p.text},publishedVersionId:null};return {termsState};}if(a==='intakeTermsPublish'){termsState={...termsState,revision:2,publishedVersionId:p.versionId};return {termsState};}if(a==='intakeReview')return {application:{...application,revision:3,status:p.decision}};if(a==='studyCreate')return {study:{id:id(31),revision:0,status:'draft',config:p.config}};if(a==='intakeIdentityCreate')return {identity:{code:'NEW-SYNTHETIC',label:p.label,institution:p.institution,researchOnly:true}};return {};}};
  return {...s,calls,client,bootstrap,application};
}
test('owner terms begin as proposed draft and saving never publishes; publication names exact saved version',async()=>{
  const UI=require('../../app/lib/research-intake-ui.js'),s=ownerSetup(),page=UI.mountOwner(s);await page.terms();assert.match(s.root.textContent,/נוסח מוצע/);assert.equal(button(s.root,'פרסום הגרסה השמורה'),undefined);
  await button(s.root,'שמירת טיוטת תנאים').click();assert.equal(s.calls.filter(([a])=>a==='intakeTermsPublish').length,0);await button(s.root,'פרסום הגרסה השמורה').click();assert.equal(s.calls.find(([a])=>a==='intakeTermsPublish')[1].versionId,terms.versionId);
});
test('owner review selects explicit personal identity and study grants; creates minimal study and research-only identity without retyping',async()=>{
  const UI=require('../../app/lib/research-intake-ui.js'),s=ownerSetup(),page=UI.mountOwner(s);await page.inbox();await button(s.root,'מחקר סינתטי').click();assert.match(s.root.textContent,/export|ייצוא/);assert.ok(s.root.textContent.includes(terms.text));
  field(s.root,'הערות לבדיקה').value='הערת בדיקה';await button(s.root,'שמירה בבדיקה').click();assert.equal(s.calls.find(([a,p])=>a==='intakeReview'&&p.decision==='under_review')[1].note,'הערת בדיקה');
  await button(s.root,'מחקר סינתטי').click();field(s.root,'הערות לבדיקה').value='שומרת הקשר';await button(s.root,'יצירת מחקר כטיוטה מהבקשה').click();assert.deepEqual(s.calls.find(([a])=>a==='studyCreate')[1].config,{title:'מחקר סינתטי',description:'מטרות סינתטיות'});assert.equal(field(s.root,'הערות לבדיקה').value,'שומרת הקשר');assert.equal(field(s.root,'מחקר לאישור').value,id(31));
  await button(s.root,'יצירת קוד אישי למחקר').click();assert.equal(field(s.root,'זהות אישית מאומתת').value,'NEW-SYNTHETIC');assert.match(s.root.textContent,/NEW-SYNTHETIC/);assert.ok(!s.calls.some(([a])=>a==='intakeReview'&&s.calls.at(-1)[1]?.decision==='approved'));
  field(s.root,'וידוא זהות הפונה הושלם').checked=true;await button(s.root,'אישור הבקשה וההרשאות שנבחרו').click();const sent=s.calls.find(([a,p])=>a==='intakeReview'&&p.decision==='approved')[1];assert.deepEqual(sent.permissions,['view_study','view_approved_findings']);assert.equal(sent.studyId,id(31));assert.equal(sent.studyExpectedRevision,0);assert.equal(sent.individualCode,'NEW-SYNTHETIC');assert.equal(sent.note,'שומרת הקשר');
});
