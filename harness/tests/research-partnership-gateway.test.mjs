import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { handleResearch } from '../lib/research.mjs';
import { contentHash,canonicalJson } from '../lib/research-partnership-exports.mjs';
const secret='synthetic-partnership-test-secret';
const code={kind:'staff',inst:'Synthetic School'};
const access={async get(key){return key==='token-secret'?{secret}:key==='code:PERSON1'?code:key==='institutions'?[{name:code.inst,active:true}]:{};}};
function token(){const b=Buffer.from(JSON.stringify({k:'code',c:'PERSON1',...code,exp:Date.now()+3600000})).toString('base64url');return b+'.'+createHmac('sha256',secret).update(b).digest('base64url');}
const scope=()=>({studyId:randomUUID(),partnerId:randomUUID(),recordId:randomUUID()});

test('guided gateway validates source selection refresh and private policy commands and projects only contracted results',async()=>{
 const {handlePartnership,validatePartnershipPayload}=await import('../lib/research-partnerships.mjs');
 const pair={studyId:randomUUID(),partnerId:randomUUID()},s={...pair,recordId:randomUUID()},versionId=randomUUID(),requestId=randomUUID();
 const policy={purpose:'pre_signing_document',provider:'synthetic-provider',providerVersion:'synthetic-v1',dataCategories:['agreement_document'],authorizedActors:['sys'],...Object.fromEntries(['partyRoles','transferBasis','storageLocation','retention','backups','deletion','withdrawal','securityMeasures','ethicsReference','consentReview'].map(k=>[k,'Synthetic explicit decision']))};
 const samples=[
  {action:'agreementSources',...pair},
  {action:'agreementPrepare',...pair,requestId,applicationVersionId:versionId,budgetVersionIds:[],contributionVersionIds:[]},
  {action:'agreementRefreshPreview',...s,versionId},
  {action:'agreementRefreshApply',...s,versionId,requestId,expectedRevision:1,previewHash:'a'.repeat(64),replaceFields:['leadResearcher']},
  {action:'processingPolicyGet',...pair},
  {action:'processingPolicySave',...pair,requestId,expectedRevision:0,policy},
  {action:'processingPolicyApprove',...pair,requestId,expectedRevision:1,policyVersionId:versionId,policyHash:'a'.repeat(64)}
 ];
 for(const body of samples){let observed;const store={async rpc(t,a,p){observed={a,p};return {sources:{currentGrants:['view_study']},guidance:{decisions:[]},record:{id:s.recordId},version:{id:versionId},preparation:{id:randomUUID()},template:null,resumed:false,preview:{hash:'a'.repeat(64)},policy:{id:versionId},privateProviderSecret:'never returned'};}};const [status,out]=await handlePartnership({},store,{token:'synthetic',...body},{env:{},verifyIdentity:async()=>({owner:true})});assert.equal(status,200,body.action);assert.deepEqual(observed,{a:body.action,p:validatePartnershipPayload(body)});assert.equal(out.privateProviderSecret,undefined);}
 for(const bad of [{...samples[1],provenance:{verified:true}},{...samples[1],budgetVersionIds:[versionId,versionId]},{...samples[3],replaceFields:['population','population']},{...samples[3],previewHash:'forged'},{...samples[5],policy:{...policy,approved:true}},{...samples[5],expectedRevision:null}])assert.throws(()=>validatePartnershipPayload(bad));
 let calls=0;for(const body of samples.filter(b=>b.action==='agreementPrepare'||b.action.startsWith('processingPolicy')))assert.equal((await handlePartnership({},{async rpc(){calls++;return {}; }},{token:'synthetic',...body},{env:{},verifyIdentity:async()=>({owner:false})}))[0],403);assert.equal(calls,0);
});

test('human document exports use Hebrew permission names without changing structured data',async()=>{
 const version={id:randomUUID(),data:{title:'בקשה בדויה',requestedPermissions:['view_study','view_approved_findings']}},store={async rpc(){return {record:{kind:'application'},version};}};
 for(const format of ['text','html']){const [status,result]=await handleResearch(access,store,{token:token(),action:'workspaceExport',...scope(),versionId:version.id,format});assert.equal(status,200);const text=Buffer.from(result.contentBase64,'base64').toString('utf8');assert.match(text,/צפייה במחקר/);assert.match(text,/צפייה בממצאים מאושרים/);assert.doesNotMatch(text,/view_study|view_approved_findings/);}
 const [,json]=await handleResearch(access,store,{token:token(),action:'workspaceExport',...scope(),versionId:version.id,format:'json'});
 assert.deepEqual(JSON.parse(Buffer.from(json.contentBase64,'base64').toString()).version.data.requestedPermissions,version.data.requestedPermissions);
});
test('partnership gateway routes verified typed mutations and rejects authority/unknown nested keys',async()=>{
 const calls=[];const store={async rpc(t,a,p){calls.push({a,p});return {record:{id:p.recordId},version:{data:p.data},providerSecret:'never public'};}};
 const input={token:token(),action:'recordSave',...scope(),requestId:randomUUID(),expectedRevision:0,kind:'agreement',data:{title:'טיוטה'}};
 const [status,out]=await handleResearch(access,store,input);assert.equal(status,200);assert.equal(calls[0].a,'recordSave');assert.equal(out.providerSecret,undefined);
 for(const bad of [{...input,owner:true},{...input,data:{sharedExpenses:[{amount:'1.25',providerEvidence:'forged'}]}},{...input,requestId:undefined},{...input,expectedRevision:undefined}]) assert.equal((await handleResearch(access,store,bad))[0],400);
 assert.equal((await handleResearch(access,store,{token:token(),action:'signatureComplete',...scope()}))[0],400);
});
test('private binary roundtrip encrypts at rest and never accepts executable or mismatched file types',async()=>{
 const calls=[];let saved;const store={async rpc(t,a,p){calls.push(a);if(a==='workspaceDocumentPut'){saved=p;return {document:{id:randomUUID(),filename:p.filename,mediaType:p.mediaType,size:p.size,sha256:p.sha256}};}return {document:{id:p.documentId,sha256:saved.sha256},contentCiphertext:saved.contentCiphertext};}};
 const bytes=Buffer.from('עברית English 2026-10-18');const base={token:token(),studyId:randomUUID(),partnerId:randomUUID()};
 const put={...base,action:'workspaceDocumentPut',requestId:randomUUID(),filename:'הערות.txt',mediaType:'text/plain',contentBase64:bytes.toString('base64')};
 assert.equal((await handleResearch(access,store,put,{env:{}}))[0],503);
 const options={documentKey:Buffer.alloc(32,8).toString('base64')};const [status,out]=await handleResearch(access,store,put,options);assert.equal(status,200);assert.equal(saved.contentBase64,undefined);assert.equal(JSON.stringify(saved).includes(bytes.toString('base64')),false);assert.equal(saved.sha256,createHash('sha256').update(bytes).digest('hex'));
 const get=await handleResearch(access,store,{...base,action:'workspaceDocumentGet',documentId:out.document.id},options);assert.equal(Buffer.from(get[1].contentBase64,'base64').toString(),bytes.toString());assert.equal(get[1].contentCiphertext,undefined);
 assert.equal((await handleResearch(access,store,{...put,filename:'run.html',mediaType:'text/html'},options))[0],400);
});
test('exports are exact authorized version bytes, escaped RTL HTML and actual OOXML',async()=>{
 const v={id:randomUUID(),data:{title:'<script>2026-10-18 English & עברית</script>'},contentHash:'a'.repeat(64)};
 const calls=[];const store={async rpc(t,a,p){calls.push({a,p});return {record:{kind:'agreement'},version:v,template:null};}};
 for(const format of ['text','json','html','docx']){
 const [status,out]=await handleResearch(access,store,{token:token(),action:'workspaceExport',...scope(),versionId:v.id,format});assert.equal(status,200);const bytes=Buffer.from(out.contentBase64,'base64');assert.equal(out.documentHash,createHash('sha256').update(bytes).digest('hex'));assert.notEqual(out.documentHash,v.contentHash);assert.ok(bytes.length);if(format==='html'){assert.match(bytes.toString(),/&lt;script&gt;/);assert.match(bytes.toString(),/24mm/);assert.doesNotMatch(bytes.toString(),/<script>/);}if(format==='docx'){assert.equal(bytes.readUInt32LE(),0x04034b50);assert.match(bytes.toString(),/word\/document.xml/);assert.match(bytes.toString(),/w:bidi/);assert.match(bytes.toString(),/w:rtl/);}}
 assert.ok(calls.every(c=>c.a==='workspaceExport'));
 const revoked={async rpc(){throw Object.assign(new Error('not_found'),{code:'not_found'});}};assert.equal((await handleResearch(access,revoked,{token:token(),action:'workspaceExport',...scope(),versionId:v.id,format:'html'}))[0],404);
});
test('executed agreement exports stop after authorization and leave immutable signed evidence unchanged',async()=>{
 const signed=Buffer.from('%PDF-synthetic immutable provider evidence'),before=Buffer.from(signed),v={id:randomUUID(),data:{unknown:'must never be regenerated'}},calls=[];
 const store={async rpc(t,a,p){calls.push({a,p});return {record:{kind:'agreement',status:'executed'},version:v,signedDocumentBytes:signed};}};
 for(const format of ['text','json','html','docx']){
  const [status,out]=await handleResearch(access,store,{token:token(),action:'workspaceExport',...scope(),versionId:v.id,format});
  assert.equal(status,409);assert.equal(out.code,'signed_original_required');assert.equal(out.contentBase64,undefined);assert.deepEqual(signed,before);
 }
 assert.equal(calls.length,4);assert.ok(calls.every(c=>c.a==='workspaceExport'));
 const denied={async rpc(){throw Object.assign(new Error('not_found'),{code:'not_found'});}};
 assert.equal((await handleResearch(access,denied,{token:token(),action:'workspaceExport',...scope(),versionId:v.id,format:'docx'}))[0],404);
});
test('canonical nested hashes and exact financial/date diffs do not depend on optional AI',async()=>{
 const before={title:'הצעה',sharedExpenses:[{description:'תשלום',amount:'100.00',party:'owner',dueDate:'2026-11-01'}]},after={...before,sharedExpenses:[{...before.sharedExpenses[0],amount:'125.25',dueDate:'2026-12-01'}]};
 assert.equal(canonicalJson({z:[{b:2,a:1}],a:'עברית'}),'{"a":"עברית","z":[{"a":1,"b":2}]}');assert.equal(contentHash({b:before,a:after}),contentHash({a:after,b:before}));
 const store={async rpc(){return {record:{kind:'agreement'},fromVersion:{data:before,contentHash:contentHash(before)},toVersion:{data:after,contentHash:contentHash(after)}};}};
 const [status,out]=await handleResearch(access,store,{token:token(),action:'workspaceImpact',...scope(),fromVersionId:randomUUID(),toVersionId:randomUUID(),includeAI:true},{env:{}});assert.equal(status,200);assert.equal(out.binding,false);assert.equal(out.approvalsInvalidated,true);assert.equal(out.ai.state,'not_configured');assert.equal(out.ai.summary,null);assert.deepEqual(out.changes.map(c=>({path:c.path,before:c.before,after:c.after,category:c.category})),[{path:'sharedExpenses[0].amount',before:'100.00',after:'125.25',category:'financial'},{path:'sharedExpenses[0].dueDate',before:'2026-11-01',after:'2026-12-01',category:'deadline'}]);
});
test('actual SQL gateway isolates same-study documents/exports, rejects invitation reuse and rechecks revocation',async()=>{
 const {createPartnershipIntegration}=await import('../fixtures/research-partnership-integrated.mjs');const f=await createPartnershipIntegration();
 try{
  const {study}=await f.seedStudy();const partners={};
  for(const name of ['a','b']){
   const partner=(await f.checked(f.tokens.owner,'partnerSave',f.request({expectedRevision:null,individualCode:f.codes[name],profile:{fullName:'חוקרת '+name,email:name+'@example.invalid',institution:'מוסד סינתטי'}}))).partner;partners[name]=partner;
   const invite=await f.checked(f.tokens.owner,'partnerInviteCreate',f.request({studyId:study.id,partnerId:partner.id,preset:'approved_findings'}));assert.equal(invite.delivery.status,'not_configured');
   assert.equal((await f.callResearch({token:f.tokens[name==='a'?'b':'a'],action:'partnerInviteGet',invite:invite.invitation.token}))[0],404);
   await f.checked(f.tokens[name],'partnerInviteGet',{invite:invite.invitation.token});await f.checked(f.tokens[name],'partnerInviteAccept',f.request({invite:invite.invitation.token}));
   assert.notEqual((await f.callResearch({token:f.tokens[name],action:'partnerInviteAccept',...f.request({invite:invite.invitation.token})}))[0],200);
  }
  const scope={studyId:study.id,partnerId:partners.a.id};
  const saved=await f.checked(f.tokens.a,'recordSave',f.request({...scope,kind:'application',data:{title:'פרטי לחוקרת א'},expectedRevision:null}));
  const upload=f.request({...scope,recordId:saved.record.id,filename:'סודי.txt',mediaType:'text/plain',contentBase64:Buffer.from('תוכן סינתטי פרטי').toString('base64')});
  const document=(await f.checked(f.tokens.a,'workspaceDocumentPut',upload)).document;
  assert.equal((await f.checked(f.tokens.a,'workspaceDocumentPut',upload)).document.id,document.id);
  const docQuery={...scope,documentId:document.id,download:true};
  assert.equal(Buffer.from((await f.checked(f.tokens.a,'workspaceDocumentGet',docQuery)).contentBase64,'base64').toString(),'תוכן סינתטי פרטי');
  for(const action of ['workspaceDocumentGet','workspaceExport','recordGet']){
   const payload=action==='workspaceDocumentGet'?docQuery:{...scope,recordId:saved.record.id,versionId:saved.version.id,...(action==='workspaceExport'?{format:'html'}:{})};assert.equal((await f.callResearch({token:f.tokens.b,action,...payload}))[0],404);
  }
  const getStudy=await f.checked(f.tokens.owner,'studyGet',{studyId:study.id});const member=(await f.query('SELECT id FROM research_private.memberships WHERE study_id=$1 AND actor_ref=$2',[study.id,'code:'+f.codes.a])).rows[0];
  await f.checked(f.tokens.owner,'memberRemove',f.request({studyId:study.id,expectedRevision:getStudy.study.revision,memberId:member.id}));
  assert.equal((await f.callResearch({token:f.tokens.a,action:'workspaceDocumentGet',...docQuery}))[0],404);
  assert.equal((await f.callResearch({token:f.tokens.a,action:'workspaceExport',...scope,recordId:saved.record.id,versionId:saved.version.id,format:'html'}))[0],404);
 }finally{await f.close();}
});
