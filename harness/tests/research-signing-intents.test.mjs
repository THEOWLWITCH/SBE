import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {createPartnershipIntegration} from '../fixtures/research-partnership-integrated.mjs';
import {researchSigningWorkerToken} from '../lib/research-signing.mjs';
import {encryptResearchValue} from '../lib/research-mail.mjs';
import CORE from '../../app/lib/research-partnership-core.js';
import {syntheticSignWell} from '../fixtures/research-signing-synthetic.mjs';

export async function approvedAgreement(f){
 const {study}=await f.seedStudy(),partner=(await f.checked(f.tokens.owner,'partnerSave',f.request({expectedRevision:null,individualCode:f.codes.a,profile:{fullName:'Synthetic Partner',email:'partner@example.invalid'}}))).partner;
 const invite=await f.checked(f.tokens.owner,'partnerInviteCreate',f.request({studyId:study.id,partnerId:partner.id,preset:'approved_findings'}));await f.checked(f.tokens.a,'partnerInviteAccept',f.request({invite:invite.invitation.token}));const scope={studyId:study.id,partnerId:partner.id};
 const template=await f.checked(f.tokens.owner,'recordSave',f.request({...scope,kind:'agreement_template',expectedRevision:null,data:{title:'Synthetic template',templateVersion:'v1',explanationVersion:'ip1',sectionClauses:CORE.AGREEMENT_SECTIONS.map(s=>({sectionId:s.id,text:'Synthetic '+s.label})),ipExplanation:'Synthetic explanation',mutualIPClause:'Synthetic clause',requiredFieldIds:[]}}));
 await f.checked(f.tokens.owner,'recordReview',f.request({...scope,recordId:template.record.id,versionId:template.version.id,expectedRevision:template.record.revision,decision:'approved'}));
 let agreement=await f.checked(f.tokens.a,'recordSave',f.request({...scope,kind:'agreement',expectedRevision:null,data:{title:'Synthetic agreement',ownerName:'Synthetic Owner',ownerSignatory:'Synthetic Owner',ownerEmail:'owner@example.invalid',ownerAuthority:'Synthetic owner authority',partnerName:'Synthetic Partner',partnerSignatory:'Synthetic Partner',partnerAuthority:'Synthetic partner authority',studyTitle:study.config.title,purpose:'Synthetic test',effectiveDate:'2026-11-01',templateVersionId:template.version.id,ipExplanationVersionId:template.version.id}}));
 const rs={...scope,recordId:agreement.record.id},versionId=agreement.version.id,documentHash=agreement.version.contentHash;
 agreement=await f.checked(f.tokens.a,'recordSubmit',f.request({...rs,versionId,expectedRevision:agreement.record.revision}));agreement=await f.checked(f.tokens.owner,'recordReview',f.request({...rs,versionId,expectedRevision:agreement.record.revision,decision:'approved'}));
 for(const who of ['owner','a'])agreement=await f.checked(f.tokens[who],'agreementApprove',f.request({...rs,versionId,expectedRevision:agreement.record.revision,documentHash,ipExplanationVersionId:template.version.id,ipReadAcknowledged:true}));
 const policy={purpose:'pre_signing_document',provider:'signwell',providerVersion:'synthetic-policy-v1',dataCategories:['agreement_document','personal','confidential'],authorizedActors:['sys','code:STAFFA'],...Object.fromEntries(['partyRoles','transferBasis','storageLocation','retention','backups','deletion','withdrawal','securityMeasures','ethicsReference','consentReview'].map(k=>[k,'Synthetic explicit decision '+k]))};
 const saved=(await f.checked(f.tokens.owner,'processingPolicySave',f.request({...scope,expectedRevision:0,policy}))).policy;await f.checked(f.tokens.owner,'processingPolicyApprove',f.request({...scope,expectedRevision:saved.revision,policyVersionId:saved.id,policyHash:saved.hash}));
 return {...rs,versionId,documentHash,expectedRevision:agreement.record.revision,consent:true,requestId:randomUUID()};
}
function reserve(f,start){return {...start,provider:'signwell',providerVersion:'synthetic-policy-v1',providerDocumentHash:createHash('sha256').update('synthetic-docx').digest('hex'),authorityPolicyHash:'b'.repeat(64),expiresAt:new Date(Date.now()+86400000).toISOString(),providerStateCiphertext:encryptResearchValue({provider:'signwell',intentId:start.requestId},f.documentKey)};}
async function internal(f,token,action,payload){return f.researchStore.rpc(token,action,payload);}

test('private signing intents reserve the exact approved version and claim creation at most once across request IDs',async()=>{
 const f=await createPartnershipIntegration();try{
  const start=await approvedAgreement(f),payload=reserve(f,start);
  const reserved=await internal(f,f.tokens.owner,'signingIntentReserve',payload);assert.equal(reserved.intent.state,'reserved');
  for(const forged of [{...payload,studyId:randomUUID()},{...payload,partnerId:randomUUID()},{...payload,versionId:randomUUID()},{...payload,documentHash:'d'.repeat(64)},{...payload,consent:false}])await assert.rejects(internal(f,f.tokens.owner,'signingIntentReserve',forged));
  assert.equal((await internal(f,f.tokens.owner,'signingIntentReserve',payload)).intent.id,reserved.intent.id);
  assert.equal((await internal(f,f.tokens.owner,'signingIntentReserve',{...payload,requestId:randomUUID()})).intent.id,reserved.intent.id);
  await assert.rejects(internal(f,f.tokens.owner,'signingIntentReserve',{...payload,providerDocumentHash:'c'.repeat(64)}),e=>e.code==='conflict');
  for(const token of [f.tokens.owner,f.tokens.a,f.tokens.worker])await assert.rejects(internal(f,token,'signingIntentCreateClaim',{intentId:reserved.intent.id,authorizationToken:f.tokens.owner}),e=>e.code==='unauthorized');
  const worker=await researchSigningWorkerToken(f.accessStore),claim={intentId:reserved.intent.id,authorizationToken:f.tokens.owner};
  assert.equal((await internal(f,worker,'signingIntentCreateClaim',claim)).claimed,true);
  const second=await internal(f,worker,'signingIntentCreateClaim',claim);assert.equal(second.claimed,false);assert.equal(second.intent.state,'creation_uncertain');
  assert.equal((await internal(f,f.tokens.owner,'signingIntentReserve',{...payload,requestId:randomUUID()})).intent.state,'creation_uncertain');
  for(const token of [f.tokens.a,f.tokens.b])await assert.rejects(internal(f,token,'signingIntentReserve',payload));
  assert.notEqual((await f.callResearch({token:f.tokens.owner,action:'signingIntentReserve',...payload}))[0],200,'private methods are never browser actions');
  assert.equal((await f.query("SELECT relforcerowsecurity FROM pg_class WHERE oid='research_private.signing_intents'::regclass")).rows[0].relforcerowsecurity,true);
 }finally{await f.close();}
});

test('SignWell commits the create claim before POST and keeps lost creation responses uncertain across new request IDs',async t=>{
 for(const failure of ['after-claim','lost-create'])await t.test(failure,async()=>{
  const provider=syntheticSignWell(),f=await createPartnershipIntegration(provider.options);try{
   const start=await approvedAgreement(f),rpc=f.researchStore.rpc;
   provider.state.beforeCreate=async()=>assert.equal((await f.query('SELECT state FROM research_private.signing_intents')).rows[0].state,'creating');
   if(failure==='after-claim'){let first=true;f.researchStore.rpc=async(...args)=>{const out=await rpc(...args);if(args[1]==='signingIntentCreateClaim'&&first){first=false;throw Object.assign(new Error('unavailable'),{code:'unavailable'});}return out;};}
   else provider.state.loseCreate=true;
   const first=await f.callResearch({token:f.tokens.owner,action:'signingStart',...start});assert.equal(first[0],failure==='after-claim'?503:200);
   f.researchStore.rpc=rpc;
   for(let n=0;n<2;n++){const again=await f.checked(f.tokens.owner,'signingStart',{...start,requestId:randomUUID()});assert.equal(again.signing.state,'creation_uncertain');}
   assert.equal(provider.state.creates,failure==='after-claim'?0:1);assert.equal(provider.state.sends,0);
   assert.equal((await f.query('SELECT count(*)::int n FROM research_private.partnership_signings')).rows[0].n,0);
   assert.equal((await f.query('SELECT state FROM research_private.signing_intents')).rows[0].state,'creation_uncertain');
  }finally{await f.close();}
 });
});

test('SignWell captures a known draft, links it durably, and recovers uncertain send by GET without a duplicate POST',async()=>{
 const provider=syntheticSignWell(),f=await createPartnershipIntegration(provider.options);try{
  const start=await approvedAgreement(f),started=await f.checked(f.tokens.owner,'signingStart',start);assert.equal(started.signing.provider,'signwell');assert.equal(provider.state.creates,1);assert.equal(provider.state.sends,0);assert.equal(provider.state.sourceName,'research-agreement.docx');
  const row=(await f.query('SELECT provider,provider_session_id,provider_document_hash FROM research_private.partnership_signings')).rows[0];assert.equal(row.provider,'signwell');assert.equal(row.provider_session_id,'signwell/'+provider.state.document.id);assert.equal(row.provider_document_hash,provider.state.sourceHash);assert.notEqual(row.provider_document_hash,start.documentHash);
  const intent=(await f.query('SELECT state,signing_id FROM research_private.signing_intents')).rows[0];assert.equal(intent.state,'linked');assert.equal(intent.signing_id,started.signing.id);
  provider.state.loseSend=true;const scope={studyId:start.studyId,partnerId:start.partnerId,recordId:start.recordId},view={...scope,signingId:started.signing.id};
  const uncertain=await f.checked(f.tokens.owner,'signingView',view);assert.equal(uncertain.signing.state,'send_uncertain');assert.equal(provider.state.sends,1);
  const recovered=await f.checked(f.tokens.a,'signingView',view);assert.equal(recovered.signing.embeddedUrl,'https://www.signwell.com/docs/synthetic_2/');assert.equal(provider.state.sends,1);assert.equal(provider.state.creates,1);
  const rotated=await f.callResearch({token:f.tokens.a,action:'signingView',...view},{signing:{...provider.options.signing,apiKey:'rotated-synthetic-not-live'}});assert.equal(rotated[0],200);assert.equal(provider.state.sends,1);assert.equal(provider.state.creates,1,'credential rotation does not create or send a replacement');
  assert.doesNotMatch(JSON.stringify((await f.query('SELECT provider_state_ciphertext FROM research_private.partnership_signings')).rows),/synthetic-private-passcode|signwell\.com\/docs/);
  provider.state.status='Completed';const record=(await f.checked(f.tokens.owner,'recordGet',scope)).record,refresh=f.request({...view,expectedRevision:record.revision});
  const missing=await f.checked(f.tokens.a,'signingRefresh',refresh);assert.equal(missing.signing.state,'evidence_missing');assert.equal((await f.query('SELECT count(*)::int n FROM research_private.partnership_executions')).rows[0].n,0);
  provider.state.fullEvidence=true;await f.query("UPDATE research_private.partnership_signings SET provider_checked_at=CURRENT_TIMESTAMP-INTERVAL '16 minutes'");
  const complete=await f.checked(f.tokens.a,'signingRefresh',{...refresh,requestId:randomUUID()});assert.equal(complete.signing.state,'completed');assert.equal(complete.record.status,'executed');assert.equal((await f.query('SELECT count(*)::int n FROM research_private.partnership_executions')).rows[0].n,1);
 }finally{await f.close();}
});

test('an authenticated encrypted state cannot be swapped onto another signing intent binding',async()=>{
 const provider=syntheticSignWell(),f=await createPartnershipIntegration(provider.options);try{
  const start=await approvedAgreement(f),started=await f.checked(f.tokens.owner,'signingStart',start),worker=await researchSigningWorkerToken(f.accessStore);
  const i=(await internal(f,worker,'signingIntentGet',{intentId:start.requestId})).intent;
  const {decryptResearchValue}=await import('../lib/research-mail.mjs'),state=decryptResearchValue(i.providerStateCiphertext,f.documentKey),before=provider.state.reads;
  await f.query('UPDATE research_private.partnership_signings SET provider_state_ciphertext=$1 WHERE id=$2',[encryptResearchValue({...state,versionId:randomUUID()},f.documentKey),started.signing.id]);
  const out=await f.callResearch({token:f.tokens.owner,action:'signingView',studyId:start.studyId,partnerId:start.partnerId,recordId:start.recordId,signingId:started.signing.id});assert.equal(out[0],409);assert.equal(provider.state.reads,before);assert.equal(provider.state.sends,0);
 }finally{await f.close();}
});

test('known SignWell draft response remains private after access revocation and never becomes an active session',async()=>{
 const provider=syntheticSignWell(),f=await createPartnershipIntegration(provider.options);try{
  const start=await approvedAgreement(f);provider.state.beforeCreate=()=>f.query("DELETE FROM research_private.memberships WHERE study_id=$1 AND actor_ref='code:STAFFA'",[start.studyId]);
  assert.equal((await f.callResearch({token:f.tokens.owner,action:'signingStart',...start}))[0],404);
  const i=(await f.query('SELECT state,provider_session_id FROM research_private.signing_intents')).rows[0];assert.equal(i.state,'created');assert.equal(i.provider_session_id,provider.state.document.id);assert.equal(provider.state.sends,0);assert.equal((await f.query('SELECT count(*)::int n FROM research_private.partnership_signings')).rows[0].n,0);
  const worker=await researchSigningWorkerToken(f.accessStore);await assert.rejects(internal(f,worker,'signingIntentLink',{intentId:start.requestId,authorizationToken:f.tokens.owner}),e=>e.code==='not_found');
  await assert.rejects(f.query('UPDATE research_private.signing_intent_events SET state=state'),/immutable/);
 }finally{await f.close();}
});

test('known draft survives a failed durable link, while repeated attach failure never causes another creation',async t=>{
 for(const failure of ['link-before-commit','link-after-commit','attach-unavailable'])await t.test(failure,async()=>{
  const provider=syntheticSignWell(),f=await createPartnershipIntegration(provider.options);try{
   const start=await approvedAgreement(f),rpc=f.researchStore.rpc;let first=true;
   f.researchStore.rpc=async(...args)=>{if(failure==='attach-unavailable'&&args[1]==='signingIntentAttach')throw Object.assign(new Error('unavailable'),{code:'unavailable'});if(first&&args[1]==='signingIntentLink'){first=false;if(failure==='link-after-commit')await rpc(...args);throw Object.assign(new Error('unavailable'),{code:'unavailable'});}return rpc(...args);};
   assert.equal((await f.callResearch({token:f.tokens.owner,action:'signingStart',...start}))[0],503);assert.equal(provider.state.creates,1);assert.equal(provider.state.sends,0);
   f.researchStore.rpc=rpc;const again=await f.checked(f.tokens.owner,'signingStart',start);assert.equal(again.signing.state,failure==='attach-unavailable'?'creation_uncertain':'awaiting_signers');assert.equal(provider.state.creates,1);assert.equal(provider.state.sends,0);
   assert.equal((await f.query('SELECT count(*)::int n FROM research_private.partnership_signings')).rows[0].n,failure==='attach-unavailable'?0:1);
  }finally{await f.close();}
 });
});

test('fresh signer read cannot publish after revocation, a changed policy or changed party details',async t=>{
 for(const change of ['membership','policy','party'])await t.test(change,async()=>{
  const provider=syntheticSignWell(),f=await createPartnershipIntegration(provider.options);try{
   const start=await approvedAgreement(f),started=await f.checked(f.tokens.owner,'signingStart',start),baseFetch=provider.options.signingFetchImpl;let changed=false;
   const signingFetchImpl=async(url,init)=>{const response=await baseFetch(url,init);if(!changed&&init.method==='GET'){changed=true;if(change==='membership')await f.query("DELETE FROM research_private.memberships WHERE study_id=$1 AND actor_ref='code:STAFFA'",[start.studyId]);else if(change==='policy')await f.query("UPDATE research_private.studies SET config=config||'{\"description\":\"Synthetic changed restrictions\"}' WHERE id=$1",[start.studyId]);else await f.query("UPDATE research_private.partnership_partners SET profile=profile||'{\"email\":\"changed@example.invalid\"}' WHERE id=$1",[start.partnerId]);}return response;};
   const result=await f.callResearch({token:f.tokens.owner,action:'signingView',studyId:start.studyId,partnerId:start.partnerId,recordId:start.recordId,signingId:started.signing.id},{signingFetchImpl});assert.notEqual(result[0],200);assert.equal(provider.state.sends,0,'no mutation after the last awaited read changed authorization');assert.equal(result[1].signing?.embeddedUrl,undefined);
  }finally{await f.close();}
 });
});

test('private reserve never treats a cached signing preflight as authorization after the agreement changes',async()=>{
 const f=await createPartnershipIntegration();try{
  const start=await approvedAgreement(f),payload=reserve(f,start);await internal(f,f.tokens.owner,'signingIntentReserve',payload);
  const current=await f.checked(f.tokens.owner,'recordGet',{studyId:start.studyId,partnerId:start.partnerId,recordId:start.recordId});
  await f.checked(f.tokens.owner,'recordSave',f.request({studyId:start.studyId,partnerId:start.partnerId,recordId:start.recordId,kind:'agreement',expectedRevision:current.record.revision,data:{...current.version.data,purpose:'Synthetic revised purpose'}}));
  await assert.rejects(internal(f,f.tokens.owner,'signingIntentReserve',payload),e=>e.code==='conflict');
  const worker=await researchSigningWorkerToken(f.accessStore);await assert.rejects(internal(f,worker,'signingIntentCreateClaim',{intentId:start.requestId,authorizationToken:f.tokens.owner}),e=>e.code==='conflict');
 }finally{await f.close();}
});
