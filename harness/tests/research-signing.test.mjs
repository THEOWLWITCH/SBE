import test from 'node:test';
import assert from 'node:assert/strict';
import { createSigningAdapter, researchSigningWorkerToken } from '../lib/research-signing.mjs';
import { randomUUID, createHash, createHmac } from 'node:crypto';
import CORE from '../../app/lib/research-partnership-core.js';
import { contentHash } from '../lib/research-partnership-exports.mjs';
import { handleResearchSigningWebhook } from '../lib/research-partnerships.mjs';
import { approveSigningProcessing } from '../fixtures/research-partnership-integrated.mjs';
test('signing readiness requires credentials, owner policy and explicit supported identity checks',async()=>{
 const adapter=createSigningAdapter({env:{}});assert.equal(adapter.readiness().state,'not_configured');await assert.rejects(adapter.start({}),e=>e.code==='not_configured');
 const token=await researchSigningWorkerToken({get:async()=>({secret:'synthetic'})});const payload=JSON.parse(Buffer.from(token.split('.')[0],'base64url'));assert.equal(payload.k,'research_signing_worker');assert.equal(payload.purpose,'research-signing');
});
test('explicit server provider selection fails closed and never falls back from unknown or unassured SignWell',async()=>{
 let calls=0;const options={env:{},signingFetchImpl:async()=>{calls++;throw new Error('synthetic should not call');}};
 assert.equal(createSigningAdapter(options).provider,'docusign');
 const unknown=createSigningAdapter({...options,signingProvider:'unsupported'});assert.equal(unknown.readiness().state,'unsupported_provider');await assert.rejects(unknown.start({}),e=>e.code==='not_configured');
 const signwell=createSigningAdapter({...options,signingProvider:'signwell',signing:{apiKey:'synthetic-not-live',testMode:false}});assert.equal(signwell.provider,'signwell');assert.equal(signwell.readiness().configured,false);assert.throws(()=>signwell.buildIntent({}),e=>e.code==='not_configured');assert.equal(calls,0);
});
test('synthetic authenticated Connect event completes actual SQL execution without an open browser and stores encrypted immutable evidence',async()=>{
 const {createPartnershipIntegration}=await import('../fixtures/research-partnership-integrated.mjs');
 const accountId=randomUUID(),envelopeId=randomUUID(),workflowId=randomUUID(),connectKey='synthetic-connect-event-key-not-live',signedAt=new Date(Date.now()-1000).toISOString();let created,complete=false,starts=0,envelopeReads=0,signerMismatch;
 const identities=[{name:'Synthetic Owner',email:'owner@example.invalid',authority:'Owner synthetic authority'},{name:'Synthetic Partner',email:'partner@example.invalid',authority:'Partner synthetic authority'}];
 const policy={approved:true,institutionRequirementsReviewed:true,version:'synthetic-policy',identityWorkflowId:workflowId,signerAuthorities:identities};
 const options={env:{},signing:{accessToken:'synthetic-not-live',accountId,baseUrl:'https://demo.docusign.net/restapi',returnUrl:'https://synthetic.example.invalid/research-management.html',connectKey,connectUrl:'https://synthetic.example.invalid/api/research-signing/webhook'},signingPolicy:policy,signingFetchImpl:async(url,init)=>{
  if(url.includes('/envelopes?transaction_ids='))return Response.json({envelopeTransactionStatuses:[]});
  if(init.method==='POST'&&url.endsWith('/envelopes')){starts++;created=JSON.parse(init.body);return Response.json({envelopeId,status:'created'});}
  if(url.endsWith('/custom_fields'))return Response.json({textCustomFields:created.customFields.textCustomFields});
  if(url.includes('/recipients?'))return Response.json({carbonCopies:created.recipients.carbonCopies.map(c=>({...c,status:'completed'})),signers:created.recipients.signers.map((s,i)=>({...s,status:'completed',signedDateTime:signedAt,recipientAuthenticationStatus:{identityVerificationResult:{status:'Passed',eventTimestamp:signedAt}},tabs:{checkboxTabs:[{tabLabel:'BEGOOD_SIGNING_CONSENT',selected:'true'}]},...(i===1?signerMismatch:{})}))});
  if(url.includes('/documents/combined'))return new Response('%PDF-1.7\nSynthetic final signed document');
  if(url.includes('/documents/certificate'))return new Response('%PDF-1.7\nSynthetic certificate');
  envelopeReads++;return Response.json({envelopeId,status:complete?'completed':'delivered',completedDateTime:new Date().toISOString()});
 }};
 const f=await createPartnershipIntegration(options);
 const internalErrors=[],rpc=f.researchStore.rpc;f.researchStore.rpc=async(...args)=>{try{return await rpc(...args);}catch(error){internalErrors.push({action:args[1],code:error.code});throw error;}};
 try{
  const {study}=await f.seedStudy();const partner=(await f.checked(f.tokens.owner,'partnerSave',f.request({expectedRevision:null,individualCode:f.codes.a,profile:{fullName:identities[1].name,email:identities[1].email,institution:'Synthetic'}}))).partner;
  const invite=await f.checked(f.tokens.owner,'partnerInviteCreate',f.request({studyId:study.id,partnerId:partner.id,preset:'approved_findings'}));await f.checked(f.tokens.a,'partnerInviteAccept',f.request({invite:invite.invitation.token}));const scope={studyId:study.id,partnerId:partner.id};
  let template=await f.checked(f.tokens.owner,'recordSave',f.request({...scope,kind:'agreement_template',expectedRevision:null,data:{title:'תבנית בדויה בלבד',templateVersion:'synthetic-v1',explanationVersion:'synthetic-ip-v1',sectionClauses:CORE.AGREEMENT_SECTIONS.map(s=>({sectionId:s.id,text:'סעיף בדוי '+s.label})),ipExplanation:'הסבר בדוי',mutualIPClause:'טקסט בדוי',requiredFieldIds:[]}}));
  await f.checked(f.tokens.owner,'recordReview',f.request({...scope,recordId:template.record.id,versionId:template.version.id,expectedRevision:template.record.revision,decision:'approved'}));
  let agreement=await f.checked(f.tokens.a,'recordSave',f.request({...scope,kind:'agreement',expectedRevision:null,data:{title:'הסכם בדוי בלבד',ownerName:identities[0].name,ownerSignatory:identities[0].name,ownerEmail:identities[0].email,ownerAuthority:identities[0].authority,partnerName:identities[1].name,partnerSignatory:identities[1].name,partnerAuthority:identities[1].authority,studyTitle:study.config.title,purpose:'בדיקת תוכנה מקומית',effectiveDate:'2026-11-01',templateVersionId:template.version.id,ipExplanationVersionId:template.version.id}}));
  assert.equal(agreement.version.contentHash,contentHash(agreement.version.data));
  const agreementScope={...scope,recordId:agreement.record.id},versionId=agreement.version.id,documentHash=agreement.version.contentHash;
  agreement=await f.checked(f.tokens.a,'recordSubmit',f.request({...agreementScope,versionId,expectedRevision:agreement.record.revision}));let reviewed=await f.checked(f.tokens.owner,'recordReview',f.request({...agreementScope,versionId,expectedRevision:agreement.record.revision,decision:'approved'}));
  for(const who of ['owner','a'])reviewed=await f.checked(f.tokens[who],'agreementApprove',f.request({...agreementScope,versionId,expectedRevision:reviewed.record.revision,documentHash,ipExplanationVersionId:template.version.id,ipReadAcknowledged:true}));
  const startRequest=f.request({...agreementScope,versionId,expectedRevision:reviewed.record.revision,documentHash,consent:true});
  assert.equal((await f.callResearch({token:f.tokens.owner,action:'signingStart',...startRequest}))[0],503);assert.equal(starts,0,'editable agreement privacy never authorizes a transfer');
  await approveSigningProcessing(f,scope);
  const started=await f.checked(f.tokens.owner,'signingStart',startRequest);assert.equal(started.signing.state,'awaiting_signers');assert.equal((await f.checked(f.tokens.owner,'recordGet',agreementScope)).record.status,'signing');assert.equal((await f.checked(f.tokens.owner,'signingStart',startRequest)).signing.id,started.signing.id);assert.equal(starts,1);
  const currentRecord=(await f.checked(f.tokens.a,'recordGet',agreementScope)).record,refresh=f.request({...agreementScope,signingId:started.signing.id,expectedRevision:currentRecord.revision});
  assert.equal((await f.checked(f.tokens.a,'signingRefresh',refresh)).signing.state,'in_progress');assert.equal(envelopeReads,1);
  assert.equal((await f.checked(f.tokens.a,'signingRefresh',refresh)).signing.state,'in_progress');assert.equal(envelopeReads,1);
  assert.equal((await f.checked(f.tokens.a,'signingRefresh',{...refresh,requestId:randomUUID()})).signing.state,'in_progress');assert.equal(envelopeReads,1);
  const raw=Buffer.from(JSON.stringify({event:'envelope-completed',data:{accountId,envelopeId},status:'executed',verifiedSigners:['forged ignored']})),signature=createHmac('sha256',connectKey).update(raw).digest('base64');
  const webhook=(body=raw,header=signature)=>handleResearchSigningWebhook(f.accessStore,f.researchStore,body,{'x-docusign-signature-1':header},{...options,documentKey:f.documentKey});
  assert.equal((await webhook(raw,'forged'))[0],403);assert.equal((await webhook())[0],409);assert.equal((await f.query('SELECT count(*)::int n FROM research_private.partnership_executions')).rows[0].n,0);
  complete=true;
  for(signerMismatch of [{email:'different@example.invalid'},{name:'Different Person'},{clientUserId:'different-client'},{identityVerification:{workflowId:randomUUID()}}]){
   assert.equal((await webhook())[0],409,JSON.stringify(signerMismatch));assert.equal((await f.query('SELECT count(*)::int n FROM research_private.partnership_executions')).rows[0].n,0);
  }
  signerMismatch=undefined;const completed=await webhook();assert.equal(completed[0],200,JSON.stringify({completed,internalErrors}));assert.deepEqual(completed[1],{ok:true});assert.equal((await webhook())[0],200);
  assert.equal((await handleResearchSigningWebhook(f.accessStore,f.researchStore,raw,{'x-docusign-signature-1':signature},{...options,signingProvider:'signwell',documentKey:f.documentKey}))[0],200,'issued Connect callbacks keep their provider when new-document default changes');
  assert.equal((await f.checked(f.tokens.a,'recordGet',agreementScope)).record.status,'executed');
  const evidence=(await f.query('SELECT id,size,sha256,content_ciphertext FROM research_private.partnership_documents WHERE record_id=$1',[agreementScope.recordId])).rows;assert.equal(evidence.length,2);assert.ok(evidence.every(d=>d.sha256!==documentHash&&d.content_ciphertext.v===1));
  const bytes=await f.checked(f.tokens.a,'workspaceDocumentGet',{...scope,documentId:evidence[0].id,download:true});assert.match(Buffer.from(bytes.contentBase64,'base64').toString(),/^%PDF-/);
  assert.notEqual((await f.callResearch({token:f.tokens.a,action:'recordSave',...f.request({...agreementScope,kind:'agreement',expectedRevision:(await f.checked(f.tokens.a,'recordGet',agreementScope)).record.revision,data:{title:'Attempt overwrite'}})}))[0],200);
 }finally{await f.close();}
});
test('provider draft remains non-signable after local preparation failure and the exact start request recovers one durable session',async t=>{
 const {createPartnershipIntegration}=await import('../fixtures/research-partnership-integrated.mjs');
 for(const failure of ['before-commit','after-commit'])await t.test(failure,async()=>{
  const accountId=randomUUID(),envelopeId=randomUUID(),workflowId=randomUUID(),identities=[{name:'Owner',email:'owner@example.invalid',authority:'Owner authority'},{name:'Partner',email:'partner@example.invalid',authority:'Partner authority'}];
  let created,providerStatus,starts=0,activations=0,views=0,loseActivationResponse=true,f;
  const options={env:{},signing:{accessToken:'synthetic-not-live',accountId,baseUrl:'https://demo.docusign.net/restapi',returnUrl:'https://synthetic.example.invalid/research-management.html',connectKey:'synthetic-connect-event-key-not-live',connectUrl:'https://synthetic.example.invalid/api/research-signing/webhook'},signingPolicy:{approved:true,institutionRequirementsReviewed:true,version:'synthetic-policy',identityWorkflowId:workflowId,signerAuthorities:identities},signingFetchImpl:async(url,init)=>{
   if(url.includes('/envelopes?transaction_ids='))return Response.json({envelopeTransactionStatuses:created?[{transactionId:created.transactionId,envelopeId,status:providerStatus}]:[]});
   if(init.method==='POST'&&url.endsWith('/envelopes')){starts++;created=JSON.parse(init.body);providerStatus=created.status;return Response.json({envelopeId,status:providerStatus});}
   if(url.endsWith('/custom_fields'))return Response.json({textCustomFields:created.customFields.textCustomFields});
   if(url.includes('/recipients?'))return Response.json(created.recipients);
   if(init.method==='PUT'&&url.endsWith('/envelopes/'+envelopeId)){
    assert.equal((await f.query('SELECT count(*)::int n FROM research_private.partnership_signings')).rows[0].n,1,'activation requires durable local session');
    assert.equal(JSON.parse(init.body).status,'sent');activations++;providerStatus='sent';if(loseActivationResponse){loseActivationResponse=false;throw new Error('synthetic response lost after send');}return Response.json({envelopeId});
   }
   if(url.endsWith('/views/recipient')){views++;assert.equal(providerStatus,'sent');return Response.json({url:'https://demo.docusign.net/Signing/start?synthetic=1'});}
   return Response.json({envelopeId,status:providerStatus});
  }};
  f=await createPartnershipIntegration(options);
  try{
   const {study}=await f.seedStudy(),partner=(await f.checked(f.tokens.owner,'partnerSave',f.request({expectedRevision:null,individualCode:f.codes.a,profile:{fullName:identities[1].name,email:identities[1].email}}))).partner;
   const invite=await f.checked(f.tokens.owner,'partnerInviteCreate',f.request({studyId:study.id,partnerId:partner.id,preset:'approved_findings'}));await f.checked(f.tokens.a,'partnerInviteAccept',f.request({invite:invite.invitation.token}));const scope={studyId:study.id,partnerId:partner.id};
   const template=await f.checked(f.tokens.owner,'recordSave',f.request({...scope,kind:'agreement_template',expectedRevision:null,data:{title:'Synthetic template',templateVersion:'v1',explanationVersion:'ip1',sectionClauses:CORE.AGREEMENT_SECTIONS.map(s=>({sectionId:s.id,text:'Synthetic '+s.label})),ipExplanation:'Synthetic explanation',mutualIPClause:'Synthetic clause',requiredFieldIds:[]}}));
   await f.checked(f.tokens.owner,'recordReview',f.request({...scope,recordId:template.record.id,versionId:template.version.id,expectedRevision:template.record.revision,decision:'approved'}));
   let agreement=await f.checked(f.tokens.a,'recordSave',f.request({...scope,kind:'agreement',expectedRevision:null,data:{title:'Synthetic agreement',ownerName:identities[0].name,ownerSignatory:identities[0].name,ownerEmail:identities[0].email,ownerAuthority:identities[0].authority,partnerName:identities[1].name,partnerSignatory:identities[1].name,partnerAuthority:identities[1].authority,studyTitle:study.config.title,purpose:'Synthetic test',effectiveDate:'2026-11-01',templateVersionId:template.version.id,ipExplanationVersionId:template.version.id}}));
   const agreementScope={...scope,recordId:agreement.record.id},versionId=agreement.version.id,documentHash=agreement.version.contentHash;
   agreement=await f.checked(f.tokens.a,'recordSubmit',f.request({...agreementScope,versionId,expectedRevision:agreement.record.revision}));agreement=await f.checked(f.tokens.owner,'recordReview',f.request({...agreementScope,versionId,expectedRevision:agreement.record.revision,decision:'approved'}));
   for(const who of ['owner','a'])agreement=await f.checked(f.tokens[who],'agreementApprove',f.request({...agreementScope,versionId,expectedRevision:agreement.record.revision,documentHash,ipExplanationVersionId:template.version.id,ipReadAcknowledged:true}));
   await approveSigningProcessing(f,scope);
   const start=f.request({...agreementScope,versionId,expectedRevision:agreement.record.revision,documentHash,consent:true}),rpc=f.researchStore.rpc;let failPrepare=true;
   f.researchStore.rpc=async(...args)=>{if(args[1]==='signingPrepare'&&failPrepare){failPrepare=false;if(failure==='after-commit')await rpc(...args);throw Object.assign(new Error('unavailable'),{code:'unavailable'});}return rpc(...args);};
   assert.equal((await f.callResearch({token:f.tokens.owner,action:'signingStart',...start}))[0],503);
   assert.equal(providerStatus,'created','failed preparation must never leave a signable envelope');assert.equal(activations,0);assert.equal(views,0);
   assert.equal((await f.query('SELECT count(*)::int n FROM research_private.partnership_signings')).rows[0].n,failure==='after-commit'?1:0);
   const recovered=await f.checked(f.tokens.owner,'signingStart',start);assert.equal(starts,1,'same request must recover the existing draft');assert.equal(providerStatus,'created');
   assert.equal((await f.checked(f.tokens.owner,'signingStart',start)).signing.id,recovered.signing.id);
   const view={...agreementScope,signingId:recovered.signing.id};assert.equal((await f.callResearch({token:f.tokens.owner,action:'signingView',...view}))[0],503);
   assert.equal(providerStatus,'sent');assert.equal(views,0);assert.equal(activations,1);
   assert.match((await f.checked(f.tokens.owner,'signingView',view)).signing.embeddedUrl,/docusign/);assert.equal(activations,1,'lost activation response must not send twice');assert.equal(views,1);assert.equal(starts,1);
  }finally{await f.close();}
 });
});
test('uncertain draft creation recovers by transaction ID and refuses reuse for different agreement bytes',async()=>{
 const envelopeId=randomUUID(),accountId=randomUUID(),workflowId=randomUUID(),hash='a'.repeat(64),parties={owner:{email:'owner@example.invalid',name:'Owner',authority:'Owner authority'},partner:{email:'partner@example.invalid',name:'Partner',authority:'Partner authority'}};
 let created,starts=0;
 const options={env:{},signing:{accessToken:'synthetic-not-live',accountId,baseUrl:'https://demo.docusign.net/restapi',returnUrl:'https://synthetic.example.invalid/research-management.html',connectKey:'synthetic-connect-key-never-live',connectUrl:'https://synthetic.example.invalid/api/research-signing/webhook'},signingPolicy:{approved:true,institutionRequirementsReviewed:true,version:'synthetic-policy',identityWorkflowId:workflowId,signerAuthorities:Object.values(parties)},signingFetchImpl:async(url,init)=>{
  if(url.includes('/envelopes?transaction_ids='))return Response.json({envelopeTransactionStatuses:created?[{envelopeId,transactionId:created.transactionId,status:'created'}]:[]});
  if(init.method==='POST'&&url.endsWith('/envelopes')){starts++;created=JSON.parse(init.body);throw new Error('synthetic creation response lost');}
  if(url.endsWith('/custom_fields'))return Response.json({textCustomFields:created.customFields.textCustomFields});
  if(url.includes('/recipients?'))return Response.json(created.recipients);
  return Response.json({envelopeId,status:'created'});
 }};
 const context={record:{id:randomUUID()},version:{id:randomUUID(),contentHash:hash},parties,contentBase64:Buffer.from('synthetic-docx').toString('base64'),documentHash:hash,consent:true,requestId:randomUUID()};
 const started=await createSigningAdapter(options).start(context);assert.equal(started.providerSessionId,envelopeId);assert.equal(created.status,'created');assert.equal(starts,1);
 assert.equal((await createSigningAdapter(options).start(context)).providerSessionId,envelopeId);assert.equal(starts,1,'restarted process recovers same intent');
 await assert.rejects(createSigningAdapter(options).start({...context,contentBase64:Buffer.from('changed document').toString('base64')}),e=>e.code==='conflict');assert.equal(starts,1);
});
test('synthetic DocuSign REST evidence verifies both exact identities, mandatory consent and immutable byte hashes',async()=>{
 const envelopeId=randomUUID(),workflowId=randomUUID(),versionId=randomUUID(),recordId=randomUUID(),hash='a'.repeat(64),now=new Date().toISOString();let created,forged=false,wrongHash=false,activated=false;
 const policy={approved:true,institutionRequirementsReviewed:true,version:'synthetic-policy-v1',identityWorkflowId:workflowId,signerAuthorities:[{email:'owner@example.invalid',name:'Synthetic Owner',authority:'Synthetic owner approval'},{email:'partner@example.invalid',name:'Synthetic Partner',authority:'Synthetic institution approval'}]};
 const accountId=randomUUID(),connectKey='synthetic-connect-key-never-live';
 const calls=[];const adapter=createSigningAdapter({env:{},signing:{accessToken:'synthetic-not-live',accountId,baseUrl:'https://demo.docusign.net/restapi',returnUrl:'https://synthetic.example.invalid/research-management.html',connectKey,connectUrl:'https://synthetic.example.invalid/api/research-signing/webhook'},signingPolicy:policy,signingFetchImpl:async(url,init)=>{
  calls.push({url,method:init.method});assert.match(init.headers.Authorization,/synthetic-not-live/);
  if(url.includes('/envelopes?transaction_ids='))return Response.json({envelopeTransactionStatuses:[]});
  if(init.method==='POST'&&url.endsWith('/envelopes')){created=JSON.parse(init.body);return Response.json({envelopeId,status:'created'});}
  if(init.method==='PUT'&&url.endsWith('/envelopes/'+envelopeId)){activated=true;assert.equal(JSON.parse(init.body).status,'sent');return Response.json({envelopeId});}
  if(url.endsWith('/views/recipient')){const view=JSON.parse(init.body);assert.equal(view.email,'partner@example.invalid');return Response.json({url:'https://demo.docusign.net/Signing/start?synthetic=1'});}
  if(url.endsWith('/custom_fields'))return Response.json({textCustomFields:created.customFields.textCustomFields.map(f=>f.name==='BEGOOD_VERSION_HASH'&&wrongHash?{...f,value:'b'.repeat(64)}:f)});
  if(url.includes('/recipients?'))return Response.json({carbonCopies:created.recipients.carbonCopies.map(c=>({...c,status:'completed'})),signers:created.recipients.signers.map((s,i)=>({...s,status:'completed',signedDateTime:now,recipientAuthenticationStatus:{identityVerificationResult:{status:'Passed',eventTimestamp:now}},tabs:{checkboxTabs:[{tabLabel:'BEGOOD_SIGNING_CONSENT',selected:forged&&i===1?'false':'true'}]}}))});
  if(url.includes('/documents/'))return new Response('%PDF-1.7\nSynthetic '+(url.includes('certificate')?'certificate':'final document'));
  return Response.json({envelopeId,status:activated?'completed':'created',completedDateTime:now});
 }});
 assert.equal(adapter.readiness().configured,true);
 const parties=Object.fromEntries(policy.signerAuthorities.map((p,i)=>[i===0?'owner':'partner',p]));
 const start=await adapter.start({record:{id:recordId},version:{id:versionId,contentHash:hash},parties,contentBase64:Buffer.from('synthetic-docx').toString('base64'),documentHash:hash,consent:true,requestId:randomUUID()});
 assert.equal(start.providerDocumentHash,createHash('sha256').update('synthetic-docx').digest('hex'));assert.notEqual(start.providerDocumentHash,hash);
 assert.equal(created.documents[0].fileExtension,'docx');assert.equal(created.customFields.textCustomFields[0].value,hash);assert.equal(created.recipients.signers.length,2);assert.equal(created.recipients.carbonCopies.length,2);assert.equal(created.eventNotification.includeHMAC,'true');
 assert.match((await adapter.view(start.state,'partner')).embeddedUrl,/docusign/);
 forged=true;await assert.rejects(adapter.refresh(start.state),e=>e.code==='conflict');forged=false;wrongHash=true;await assert.rejects(adapter.refresh(start.state),e=>e.code==='conflict');wrongHash=false;
 const result=await adapter.refresh(start.state);assert.equal(result.completed,true);assert.deepEqual(result.verifiedSigners.map(s=>s.party),['owner','partner']);assert.ok(result.verifiedSigners.every(s=>s.identityVerified&&s.consent));assert.notEqual(createHash('sha256').update(result.finalDocument).digest('hex'),hash);assert.ok(Buffer.isBuffer(result.auditCertificate));assert.ok(calls.some(c=>c.url.includes('/documents/combined')));
 assert.equal(result.secureSignature,undefined);assert.equal(result.certifiedSignature,undefined);
 const raw=Buffer.from(JSON.stringify({event:'envelope-completed',data:{accountId,envelopeId}})),signature=createHmac('sha256',connectKey).update(raw).digest('base64');
 assert.equal(adapter.verifyEvent(raw,{'x-docusign-signature-1':signature}).providerSessionId,envelopeId);
 assert.throws(()=>adapter.verifyEvent(Buffer.concat([raw,Buffer.from(' ')]),{'x-docusign-signature-1':signature}),e=>e.code==='unauthorized');
 assert.throws(()=>adapter.verifyEvent(raw,{'x-docusign-signature-1':'forged'}),e=>e.code==='unauthorized');
});
