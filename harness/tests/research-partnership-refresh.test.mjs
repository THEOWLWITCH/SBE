import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID,createHash } from 'node:crypto';
import { createPartnershipIntegration } from '../fixtures/research-partnership-integrated.mjs';
import { encryptResearchValue } from '../lib/research-mail.mjs';
import { researchSigningWorkerToken } from '../lib/research-signing.mjs';
import CORE from '../../app/lib/research-partnership-core.js';

test('failed provider refresh keeps the same request retryable and throttles only a verified successful check',async()=>{
 let calls=0,failNext=true;
 const adapter={readiness:()=>({configured:true,state:'ready'}),async refresh(){calls++;if(failNext){failNext=false;throw Object.assign(new Error('unavailable'),{code:'unavailable'});}return {completed:false,state:'in_progress'};}};
 const f=await createPartnershipIntegration({signingAdapter:adapter});
 try{
  const {study}=await f.seedStudy();
  const partner=(await f.checked(f.tokens.owner,'partnerSave',f.request({individualCode:f.codes.a,expectedRevision:null,profile:{fullName:'Synthetic Partner',email:'partner@example.invalid'}}))).partner;
  await f.checked(f.tokens.owner,'memberSet',f.request({studyId:study.id,expectedRevision:study.revision,code:f.codes.a,role:'researcher',permissions:CORE.ACCESS_PRESETS.approved_findings}));
  const scope={studyId:study.id,partnerId:partner.id};
  let t=await f.checked(f.tokens.owner,'recordSave',f.request({...scope,kind:'agreement_template',expectedRevision:null,data:{title:'Synthetic template',templateVersion:'1',explanationVersion:'1',sectionClauses:CORE.AGREEMENT_SECTIONS.map(s=>({sectionId:s.id,text:'Synthetic clause'})),ipExplanation:'Synthetic explanation',mutualIPClause:'Synthetic rights',requiredFieldIds:[]}}));
  await f.checked(f.tokens.owner,'recordReview',f.request({...scope,recordId:t.record.id,versionId:t.version.id,expectedRevision:t.record.revision,decision:'approved'}));
  let a=await f.checked(f.tokens.a,'recordSave',f.request({...scope,kind:'agreement',expectedRevision:null,data:{title:'Synthetic agreement',ownerName:'Owner',ownerEmail:'owner@example.invalid',ownerSignatory:'Owner',ownerAuthority:'Synthetic authority',partnerName:'Synthetic Partner',partnerSignatory:'Synthetic Partner',partnerAuthority:'Synthetic institution authority',studyTitle:'Synthetic study',purpose:'Synthetic verification',effectiveDate:'2026-01-01',templateVersionId:t.version.id,ipExplanationVersionId:t.version.id}}));
  const exact={...scope,recordId:a.record.id,versionId:a.version.id},hash=a.version.contentHash;
  a=await f.checked(f.tokens.a,'recordSubmit',f.request({...exact,expectedRevision:a.record.revision}));a=await f.checked(f.tokens.owner,'recordReview',f.request({...exact,expectedRevision:a.record.revision,decision:'approved'}));
  for(const who of [f.tokens.owner,f.tokens.a])a=await f.checked(who,'agreementApprove',f.request({...exact,expectedRevision:a.record.revision,documentHash:hash,ipExplanationVersionId:t.version.id,ipReadAcknowledged:true}));
  const worker=await researchSigningWorkerToken(f.accessStore),session=randomUUID(),digest=createHash('sha256').update('synthetic-provider-document').digest('hex');
  const prepared=await f.researchStore.rpc(worker,'signingPrepare',f.request({...exact,expectedRevision:a.record.revision,documentHash:hash,signerPartiesHash:(await f.query('SELECT research_private.signing_current_identity_hash($1,$2,$3) AS hash',[study.id,partner.id,exact.versionId])).rows[0].hash,providerSessionId:session,providerDocumentHash:digest,authorityPolicyHash:digest,expiresAt:new Date(Date.now()+3600000).toISOString(),providerStateCiphertext:encryptResearchValue({providerSessionId:session},f.documentKey)}));
  const refresh=f.request({...scope,recordId:a.record.id,signingId:prepared.signing.id,expectedRevision:prepared.record.revision});
  assert.equal((await f.callResearch({token:f.tokens.a,action:'signingRefresh',...refresh}))[0],503);assert.equal(calls,1);
  assert.equal((await f.query('SELECT provider_checked_at FROM research_private.partnership_signings WHERE id=$1',[prepared.signing.id])).rows[0].provider_checked_at,null);
  assert.equal((await f.query("SELECT count(*)::int n FROM research_private.partnership_receipts WHERE action='signingRefresh'")).rows[0].n,0);
  assert.equal((await f.checked(f.tokens.a,'signingRefresh',refresh)).signing.state,'in_progress');assert.equal(calls,2);
  assert.ok((await f.query('SELECT provider_checked_at FROM research_private.partnership_signings WHERE id=$1',[prepared.signing.id])).rows[0].provider_checked_at);
  await f.checked(f.tokens.a,'signingRefresh',refresh);await f.checked(f.tokens.a,'signingRefresh',{...refresh,requestId:randomUUID()});assert.equal(calls,2);
  await f.query("UPDATE research_private.partnership_signings SET provider_checked_at=CURRENT_TIMESTAMP-INTERVAL '16 minutes' WHERE id=$1",[prepared.signing.id]);
  await f.checked(f.tokens.a,'signingRefresh',refresh);assert.equal(calls,3);await f.checked(f.tokens.a,'signingRefresh',refresh);assert.equal(calls,3);
  assert.equal((await f.checked(f.tokens.owner,'recordGet',{...scope,recordId:a.record.id})).record.status,'signing');assert.equal((await f.query('SELECT count(*)::int n FROM research_private.partnership_executions')).rows[0].n,0);
 }finally{await f.close();}
});
