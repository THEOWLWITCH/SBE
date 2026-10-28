import test from 'node:test';
import assert from 'node:assert/strict';
import {createPartnershipIntegration} from '../fixtures/research-partnership-integrated.mjs';
import {approvedWorkflowAgreement} from '../fixtures/research-workflow-synthetic.mjs';
import {syntheticSignWell} from '../fixtures/research-signing-synthetic.mjs';
import {runPartnershipWork} from '../lib/research-partnership-work.mjs';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {researchSigningWorkerToken} from '../lib/research-signing.mjs';

async function updateContact(f,start,email){const current=(await f.checked(f.tokens.a,'partnerGet',{partnerId:start.partnerId})).partner;await f.checked(f.tokens.a,'partnerSave',f.request({partnerId:start.partnerId,expectedRevision:current.revision,profile:{...current.profile,email}}));}
async function authorizeProcessor(f,start,purpose,provider,providerVersion){const scope={studyId:start.studyId,partnerId:start.partnerId},head=(await f.checked(f.tokens.owner,'processingPolicyGet',{...scope,purpose})).policy;const policy={purpose,provider,providerVersion,dataCategories:['agreement_document','personal','confidential'],authorizedActors:['sys','code:STAFFA'],...Object.fromEntries(['partyRoles','transferBasis','storageLocation','retention','backups','deletion','withdrawal','securityMeasures','ethicsReference','consentReview'].map(k=>[k,'Synthetic explicit '+k]))};const p=(await f.checked(f.tokens.owner,'processingPolicySave',f.request({...scope,expectedRevision:head?.revision||0,policy}))).policy;await f.checked(f.tokens.owner,'processingPolicyApprove',f.request({...scope,expectedRevision:p.revision,policyVersionId:p.id,policyHash:p.hash}));}
function syntheticDocuSign(){
 const accountId=randomUUID(),envelopeId=randomUUID(),workflowId=randomUUID(),state={created:null,status:'created',beforeLookup:null,beforeCreate:null,creates:0};
 const options={signingEnabled:true,env:{},signingProvider:'docusign',signing:{accessToken:'synthetic-not-live',accountId,baseUrl:'https://demo.docusign.net/restapi',returnUrl:'https://synthetic.example.invalid/research-management.html',connectKey:'synthetic-connect-key-not-live',connectUrl:'https://synthetic.example.invalid/api/research-signing/webhook'},signingPolicy:{approved:true,institutionRequirementsReviewed:true,version:'synthetic-policy-v1',identityWorkflowId:workflowId,signerAuthorities:[{name:'Synthetic Owner',email:'owner@example.invalid',authority:'Synthetic owner authority'},{name:'Synthetic Partner',email:'partner@example.invalid',authority:'Synthetic partner authority'}]},signingFetchImpl:async(url,init)=>{
  if(url.includes('/envelopes?transaction_ids=')){await state.beforeLookup?.();return Response.json({envelopeTransactionStatuses:[]});}
  if(init.method==='POST'&&url.endsWith('/envelopes')){state.creates++;await state.beforeCreate?.();state.created=JSON.parse(init.body);return Response.json({envelopeId,status:'created'});}
  if(url.endsWith('/custom_fields'))return Response.json({textCustomFields:state.created.customFields.textCustomFields});
  if(url.includes('/recipients?'))return Response.json({carbonCopies:state.created.recipients.carbonCopies.map(c=>({...c,status:'completed'})),signers:state.created.recipients.signers.map(s=>({...s,status:'completed',signedDateTime:new Date(Date.now()-2000).toISOString(),recipientAuthenticationStatus:{identityVerificationResult:{status:'Passed',eventTimestamp:new Date(Date.now()-3000).toISOString()}},tabs:{checkboxTabs:[{tabLabel:'BEGOOD_SIGNING_CONSENT',selected:'true'}]}}))});
  if(init.method==='PUT'){state.status='sent';return Response.json({envelopeId,status:'sent'});}
  if(url.endsWith('/views/recipient'))return Response.json({url:'https://demo.docusign.net/Signing/synthetic'});
  if(url.includes('/documents/'))return new Response('%PDF-1.7\nSynthetic '+(url.includes('certificate')?'certificate':'final'));
  return Response.json({envelopeId,status:state.status,completedDateTime:new Date(Date.now()-1000).toISOString()});
 }};return {options,state};
}

test('issued verified identities survive an authorized contact update without authorizing another recipient',async()=>{
 const provider=syntheticSignWell(),f=await createPartnershipIntegration(provider.options);try{
  const start=await approvedWorkflowAgreement(f),scope={studyId:start.studyId,partnerId:start.partnerId,recordId:start.recordId};
  const signing=(await f.checked(f.tokens.owner,'signingStart',start)).signing;
  await f.checked(f.tokens.a,'signingView',{...scope,signingId:signing.id});
  const current=(await f.checked(f.tokens.a,'partnerGet',{partnerId:start.partnerId})).partner;
  await f.checked(f.tokens.a,'partnerSave',f.request({partnerId:start.partnerId,expectedRevision:current.revision,profile:{...current.profile,email:'updated-synthetic@example.invalid'}}));
  assert.equal((await f.callResearch({token:f.tokens.a,action:'signingView',...scope,signingId:signing.id}))[0],409);
  provider.state.status='Completed';provider.state.fullEvidence=true;
  const result=await runPartnershipWork(f.accessStore,f.researchStore,{...provider.options,enabled:true,documentKey:f.documentKey});
  assert.equal(result.completed,1,'completion verifies the issued identity, not mutable contact details');
  const executions=(await f.query('SELECT verified_signers FROM research_private.partnership_executions')).rows;
  assert.equal(executions.length,1);assert.equal(executions[0].verified_signers.find(x=>x.party==='partner').email,'partner@example.invalid');
  assert.equal((await f.query('SELECT count(*)::int n FROM research_private.partnership_documents WHERE signing_id=$1',[signing.id])).rows[0].n,2);
  const copies=(await f.query('SELECT party,recipient_hash FROM research_private.partnership_copy_outbox ORDER BY party')).rows;
  assert.equal(copies.length,2);assert.equal((await f.checked(f.tokens.a,'recordGet',scope)).record.status,'executed');
  await authorizeProcessor(f,start,'signed_copy_delivery','resend','mail-v1');
  const messages=[],options={...provider.options,enabled:true,documentKey:f.documentKey,copyMail:{from:'owner@example.invalid'},copyTransportFactory:()=>({readiness:()=>({configured:true,provider:'resend',providerVersion:'mail-v1'}),async send(m){messages.push(m.recipient);return {status:'accepted',providerId:randomUUID()};}})};
  await runPartnershipWork(f.accessStore,f.researchStore,options);assert.deepEqual(messages,['owner@example.invalid']);assert.equal((await f.query("SELECT submission FROM research_private.partnership_copy_outbox WHERE party='partner'")).rows[0].submission,'blocked');
 }finally{await f.close();}
});

test('legacy completion binds only the authenticated original state and rolls back every forged proof',async()=>{
 const provider=syntheticSignWell(),f=await createPartnershipIntegration(provider.options,{frozenSigningIdentities:false});try{
  const start=await approvedWorkflowAgreement(f),scope={studyId:start.studyId,partnerId:start.partnerId,recordId:start.recordId},signing=(await f.checked(f.tokens.owner,'signingStart',start)).signing;
  await f.checked(f.tokens.a,'signingView',{...scope,signingId:signing.id});
  await f.exec(await readFile(new URL('../migrations/20261020-frozen-signing-identities.sql',import.meta.url),'utf8'));
  assert.equal((await f.query('SELECT signer_parties_hash FROM research_private.partnership_signings')).rows[0].signer_parties_hash,null);
  await assert.rejects(f.query("UPDATE research_private.partnership_signings SET signer_parties_hash=$1",['a'.repeat(64)]),/immutable/);
  await updateContact(f,start,'changed@example.invalid');provider.state.status='Completed';provider.state.fullEvidence=true;
  let captured;const store={rpc:async(...args)=>{if(args[1]==='signatureComplete'){captured=structuredClone(args[2]);throw new Error('Synthetic capture before completion');}return f.researchStore.rpc(...args);}};
  await runPartnershipWork(f.accessStore,store,{...provider.options,enabled:true,documentKey:f.documentKey});assert.ok(captured.signerBinding);delete captured.workLeaseId;
  const worker=await researchSigningWorkerToken(f.accessStore),bad=[];
  for(const key of ['providerStateHash','partiesHash','providerDocumentHash','authorityPolicyHash','documentHash'])bad.push({...captured,signerBinding:{...captured.signerBinding,[key]:'b'.repeat(64)}});
  for(const key of ['versionId','providerSessionId','provider'])bad.push({...captured,signerBinding:{...captured.signerBinding,[key]:key==='versionId'?randomUUID():'wrong'}});
  for(const change of [{email:'changed@example.invalid'},{name:'Forged partner'},{authority:'Forged authority'},{party:'owner'},{consent:false}])bad.push({...captured,verifiedSigners:captured.verifiedSigners.map(p=>p.party==='partner'?{...p,...change}:p)});
  bad.push({...captured,versionId:randomUUID()},{...captured,documentHash:'b'.repeat(64)},{...captured,finalDocumentId:randomUUID()},{...captured,signerBinding:undefined});
  for(const payload of bad){await assert.rejects(f.researchStore.rpc(worker,'signatureComplete',payload));assert.equal((await f.query('SELECT count(*)::int n FROM research_private.partnership_executions')).rows[0].n,0);assert.equal((await f.query('SELECT signer_parties_hash FROM research_private.partnership_signings')).rows[0].signer_parties_hash,null);assert.equal((await f.query('SELECT count(*)::int n FROM research_private.partnership_copy_outbox')).rows[0].n,0);}
  for(const token of [f.tokens.a,f.tokens.owner,f.tokens.worker])await assert.rejects(f.researchStore.rpc(token,'signatureComplete',captured),e=>e.code==='unauthorized');
  const done=await f.researchStore.rpc(worker,'signatureComplete',captured);assert.equal(done.record.status,'executed');assert.equal((await f.query('SELECT signer_parties_hash FROM research_private.partnership_signings')).rows[0].signer_parties_hash,captured.signerBinding.partiesHash);
  await f.researchStore.rpc(worker,'signatureComplete',captured);assert.equal((await f.query('SELECT count(*)::int n FROM research_private.partnership_executions')).rows[0].n,1);
  await assert.rejects(f.query('UPDATE research_private.partnership_signings SET signer_parties_hash=$1',['c'.repeat(64)]),/immutable/);await assert.rejects(f.query('UPDATE research_private.partnership_signings SET signer_parties_hash=NULL'),/immutable/);
 }finally{await f.close();}
});

test('DocuSign freezes case-normalized identities, blocks stale transfers, and preserves legacy issued evidence',async t=>{
 for(const legacy of [false,true])await t.test(legacy?'upgrade existing issued session':'new session',async()=>{
  const provider=syntheticDocuSign(),f=await createPartnershipIntegration(provider.options,{frozenSigningIdentities:!legacy});try{
   const start=await approvedWorkflowAgreement(f,{ownerEmail:'OWNER@EXAMPLE.INVALID'}),scope={studyId:start.studyId,partnerId:start.partnerId,recordId:start.recordId};await updateContact(f,start,'PARTNER@EXAMPLE.INVALID');await authorizeProcessor(f,start,'pre_signing_document','docusign','synthetic-policy-v1');
   const signing=(await f.checked(f.tokens.owner,'signingStart',start)).signing;await f.checked(f.tokens.a,'signingView',{...scope,signingId:signing.id});
   if(legacy)await f.exec(await readFile(new URL('../migrations/20261020-frozen-signing-identities.sql',import.meta.url),'utf8'));
   const before=(await f.query('SELECT signer_parties_hash FROM research_private.partnership_signings')).rows[0].signer_parties_hash;assert.equal(before===null,legacy);
   await updateContact(f,start,'updated@example.invalid');assert.equal((await f.callResearch({token:f.tokens.a,action:'signingView',...scope,signingId:signing.id}))[0],409);
   if(legacy)await f.query("DELETE FROM research_private.memberships WHERE study_id=$1 AND actor_ref='code:STAFFA'",[start.studyId]);
   provider.state.status='completed';const done=await runPartnershipWork(f.accessStore,f.researchStore,{...provider.options,enabled:true,documentKey:f.documentKey});assert.equal(done.completed,1);
   const execution=(await f.query('SELECT verified_signers FROM research_private.partnership_executions')).rows[0];assert.deepEqual(execution.verified_signers.map(s=>s.email),['owner@example.invalid','partner@example.invalid']);assert.ok((await f.query('SELECT signer_parties_hash FROM research_private.partnership_signings')).rows[0].signer_parties_hash);
   assert.equal(provider.state.creates,1);
  }finally{await f.close();}
 });
});

test('DocuSign last-read authorization rejects a changed profile or approved head before provider creation',async t=>{
 for(const change of ['profile','version'])await t.test(change,async()=>{
  const provider=syntheticDocuSign(),f=await createPartnershipIntegration(provider.options);try{
   const start=await approvedWorkflowAgreement(f);await authorizeProcessor(f,start,'pre_signing_document','docusign','synthetic-policy-v1');let changed=false;
   provider.state.beforeLookup=async()=>{if(changed)return;changed=true;if(change==='profile')await updateContact(f,start,'updated@example.invalid');else{const current=await f.checked(f.tokens.owner,'recordGet',{studyId:start.studyId,partnerId:start.partnerId,recordId:start.recordId});await f.checked(f.tokens.owner,'recordSave',f.request({studyId:start.studyId,partnerId:start.partnerId,recordId:start.recordId,kind:'agreement',expectedRevision:current.record.revision,data:{...current.version.data,purpose:'Synthetic changed approved head'}}));}};
   assert.equal((await f.callResearch({token:f.tokens.owner,action:'signingStart',...start}))[0],409);assert.equal(provider.state.creates,0);assert.equal((await f.query('SELECT count(*)::int n FROM research_private.partnership_signings')).rows[0].n,0);
  }finally{await f.close();}
 });
});

test('a profile change after draft creation rejects DocuSign preparation without publishing or substituting identities',async()=>{
 const provider=syntheticDocuSign(),f=await createPartnershipIntegration(provider.options);try{
  const start=await approvedWorkflowAgreement(f);await authorizeProcessor(f,start,'pre_signing_document','docusign','synthetic-policy-v1');provider.state.beforeCreate=()=>updateContact(f,start,'updated@example.invalid');
  assert.equal((await f.callResearch({token:f.tokens.owner,action:'signingStart',...start}))[0],409);assert.equal(provider.state.creates,1);assert.equal(provider.state.status,'created');assert.equal((await f.query('SELECT count(*)::int n FROM research_private.partnership_signings')).rows[0].n,0);
 }finally{await f.close();}
});

test('new DocuSign preparation requires the exact original preflight identity hash',async()=>{
 const provider=syntheticDocuSign(),f=await createPartnershipIntegration(provider.options);try{
  const start=await approvedWorkflowAgreement(f);await authorizeProcessor(f,start,'pre_signing_document','docusign','synthetic-policy-v1');
  let captured;const rpc=f.researchStore.rpc;f.researchStore.rpc=async(...args)=>{if(args[1]==='signingPrepare'){captured=structuredClone(args[2]);throw new Error('Synthetic stop before preparation');}return rpc(...args);};
  assert.equal((await f.callResearch({token:f.tokens.owner,action:'signingStart',...start}))[0],503);assert.ok(captured.signerPartiesHash);const worker=await researchSigningWorkerToken(f.accessStore);
  for(const hash of [undefined,'d'.repeat(64)]){await assert.rejects(rpc(worker,'signingPrepare',{...captured,signerPartiesHash:hash}));assert.equal((await f.query('SELECT count(*)::int n FROM research_private.partnership_signings')).rows[0].n,0);assert.equal((await f.checked(f.tokens.owner,'recordGet',{studyId:start.studyId,partnerId:start.partnerId,recordId:start.recordId})).record.status,'approved');}
  assert.equal((await rpc(worker,'signingPrepare',captured)).record.status,'signing');assert.equal(provider.state.creates,1);
 }finally{await f.close();}
});
