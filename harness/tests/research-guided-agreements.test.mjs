import test from 'node:test';
import assert from 'node:assert/strict';
import { createPartnershipDatabase, TOKENS, request } from '../fixtures/research-partnership-database.mjs';
import { randomUUID } from 'node:crypto';
import CORE from '../../app/lib/research-partnership-core.js';

async function ok(f, action, payload = {}, credential = TOKENS.owner, intake = false) {
 const result = await (intake ? f.intakeRpc : f.partnershipRpc)(credential, action, payload);
 assert.equal(result.error, undefined, action + ': ' + JSON.stringify(result)); return result;
}
async function incoming(f) {
 let state = (await ok(f, 'intakeOwnerBootstrap', {}, TOKENS.owner, true)).termsState;
 state = (await ok(f, 'intakeTermsSave', request({expectedRevision:state.revision,title:'Synthetic terms',text:'Synthetic proposal only'}),TOKENS.owner,true)).termsState;
 await ok(f,'intakeTermsPublish',request({expectedRevision:state.revision,versionId:state.draftVersion.versionId}),TOKENS.owner,true);
 const terms=(await ok(f,'intakePublicInfo',{},'',true)).terms;
 const sent=await ok(f,'intakeSubmit',request({termsVersionId:terms.versionId,termsHash:terms.hash,acknowledged:true,rateBucket:'a'.repeat(64),application:{title:'Synthetic proposal',applicationType:'partnership',applicantType:'individual',fullName:'Synthetic researcher',email:'researcher@example.invalid',objectives:'Synthetic question',requestedTools:['synthetic tool'],requestedPermissions:['view_study','export_data']}}),'',true);
 const s=await f.rpc(TOKENS.owner,'studyCreate',request({config:{title:'Synthetic guided study'}}));
 const approval=request({applicationId:sent.receipt.id,expectedRevision:0,decision:'approved',studyId:s.study.id,studyExpectedRevision:s.study.revision,individualCode:'STAFFA',permissions:['view_study']});
 return {approval,study:s.study};
}

test('guided SQL: intake atomically creates one linked proposed template, draft agreement and trusted receipt',async()=>{
 const f=await createPartnershipDatabase();try{
  const {approval}=await incoming(f),approved=await ok(f,'intakeReview',approval,TOKENS.owner,true);
  assert.ok(approved.preparation?.record?.id,'approval must include the linked prepared agreement');
  assert.equal(approved.preparation.record.kind,'agreement');assert.equal(approved.preparation.record.status,'draft');assert.equal(approved.preparation.record.binding,false);
  assert.equal(approved.preparation.template.record.status,'draft');
  assert.equal(approved.preparation.version.data.applicationId,approved.application.recordId);
  assert.deepEqual(approved.preparation.version.data.annexB[0].actions,['view_study']);
  assert.deepEqual(await ok(f,'intakeReview',approval,TOKENS.owner,true),approved);
  assert.equal((await f.db.query("SELECT count(*)::int n FROM research_private.partnership_records WHERE kind='agreement'")).rows[0].n,1);
 }finally{await f.close();}
});

test('guided SQL: preparation failure rolls back membership profile application and review together',async()=>{
 const f=await createPartnershipDatabase();try{
  const {approval,study}=await incoming(f);
  await f.db.exec("CREATE FUNCTION public.synthetic_guided_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.kind='agreement' THEN RAISE EXCEPTION 'invalid'; END IF; RETURN NEW; END $$; CREATE TRIGGER synthetic_guided_failure BEFORE INSERT ON research_private.partnership_records FOR EACH ROW EXECUTE FUNCTION public.synthetic_guided_failure()");
  assert.equal((await f.intakeRpc(TOKENS.owner,'intakeReview',approval)).error,'invalid');
  for(const table of ['memberships','partnership_partners','partnership_records','intake_reviews'])assert.equal((await f.db.query('SELECT count(*)::int n FROM research_private.'+table)).rows[0].n,0,table);
  assert.equal((await f.db.query('SELECT revision FROM research_private.studies WHERE id=$1',[study.id])).rows[0].revision,study.revision);
 }finally{await f.close();}
});

test('guided SQL: source receipts and refresh preserve explicit empty overrides and reject stale or forged scope',async()=>{
 const f=await createPartnershipDatabase();try{
  const {approval}=await incoming(f),approved=await ok(f,'intakeReview',approval,TOKENS.owner,true),p=approved.preparation,scope={studyId:p.record.studyId,partnerId:p.record.partnerId},rs={...scope,recordId:p.record.id};
  const contract=(await f.db.query('SELECT research_private.partnership_contract() c')).rows[0].c;
  assert.deepEqual(contract.operations,CORE.OPERATIONS);assert.deepEqual(contract.reads,CORE.READ_ACTIONS);assert.deepEqual(contract.processingPolicy,CORE.PROCESSING_POLICY_FIELDS);
  const sources=await ok(f,'agreementSources',scope,TOKENS.a);assert.deepEqual(sources.sources.currentGrants,['view_study']);assert.equal(sources.sources.applications.length,1);assert.equal(sources.guidance.decisions.length,24);
  assert.equal('ownerName' in p.version.data,false);assert.equal('partnerName' in p.version.data,false);assert.equal(p.version.data.leadResearcher,'Synthetic researcher');
  const saved=await ok(f,'recordSave',request({...rs,kind:'agreement',expectedRevision:p.record.revision,data:{...p.version.data,objectives:'',requestedPermissions:[]}}),TOKENS.a);
  const profile=approved.partner;await ok(f,'partnerSave',request({partnerId:profile.id,expectedRevision:profile.revision,profile:{...profile.profile,fullName:'Synthetic updated researcher'}}));
  const preview=(await ok(f,'agreementRefreshPreview',{...rs,versionId:saved.version.id},TOKENS.a)).preview;
  assert.equal(preview.changes.find(c=>c.field==='objectives').overridden,true);assert.equal(preview.changes.find(c=>c.field==='requestedPermissions').overridden,true);
  assert.equal(preview.changes.find(c=>c.field==='leadResearcher').proposed,'Synthetic updated researcher');
  const apply=request({...rs,versionId:saved.version.id,expectedRevision:saved.record.revision,previewHash:preview.hash,replaceFields:['leadResearcher']});
  const refreshed=await ok(f,'agreementRefreshApply',apply,TOKENS.a);assert.equal(refreshed.version.data.objectives,'');assert.deepEqual(refreshed.version.data.requestedPermissions,[]);assert.equal(refreshed.version.data.leadResearcher,'Synthetic updated researcher');assert.equal(refreshed.record.status,'draft');assert.equal(refreshed.record.approvedVersionId,null);assert.equal(refreshed.preparation.initialReceiptId,p.preparation.id);
  assert.deepEqual(await ok(f,'agreementRefreshApply',apply,TOKENS.a),refreshed);
  assert.equal((await f.partnershipRpc(TOKENS.a,'agreementRefreshApply',request({...apply,previewHash:'b'.repeat(64)}))).error,'conflict');
  for(const action of ['agreementSources','agreementPrepare'])assert.equal((await f.partnershipRpc(TOKENS.b,action,action==='agreementPrepare'?request(scope):scope)).error,action==='agreementPrepare'?'unauthorized':'not_found');
  assert.equal((await f.partnershipRpc(TOKENS.a,'agreementSources',{...scope,studyId:randomUUID()})).error,'not_found');
  assert.equal((await f.partnershipRpc(TOKENS.owner,'agreementPrepare',request({...scope,provenance:{verified:true}}))).error,'invalid');
  assert.equal((await f.partnershipRpc(TOKENS.a,'recordSave',request({...rs,kind:'agreement',expectedRevision:refreshed.record.revision,data:{...refreshed.version.data,sourceHash:'a'.repeat(64)}}))).error,'invalid');
  await assert.rejects(f.db.query('UPDATE research_private.agreement_preparations SET snapshot=snapshot'),/immutable/);
  const resumed=await ok(f,'agreementPrepare',request(scope));assert.equal(resumed.resumed,true);assert.equal(resumed.version.id,refreshed.version.id);
  await f.db.query("DELETE FROM research_private.memberships WHERE study_id=$1 AND actor_ref='code:STAFFA'",[scope.studyId]);
  for(const [action,payload]of [['agreementSources',scope],['agreementRefreshApply',apply],['agreementPrepare',request(scope)]])assert.equal((await f.partnershipRpc(action==='agreementPrepare'?TOKENS.owner:TOKENS.a,action,payload)).error,'not_found');
  assert.equal((await f.intakeRpc(TOKENS.owner,'intakeReview',approval)).error,'not_found','handoff replay rechecks target membership');
 }finally{await f.close();}
});

test('guided SQL: private processing policy needs independent owner revision approval and current restrictions',async()=>{
 const f=await createPartnershipDatabase();try{
  const {approval}=await incoming(f),approved=await ok(f,'intakeReview',approval,TOKENS.owner,true),scope={studyId:approved.application.studyId,partnerId:approved.partner.id};
  await f.db.query("UPDATE research_private.memberships SET permissions=ARRAY['view_study','edit_study'] WHERE study_id=$1 AND actor_ref='code:STAFFA'",[scope.studyId]);
  const policy={purpose:'external_impact',provider:'synthetic-provider',providerVersion:'synthetic-v1',dataCategories:['agreement_changes','confidential'],authorizedActors:['sys','code:STAFFA'],...Object.fromEntries(['partyRoles','transferBasis','storageLocation','retention','backups','deletion','withdrawal','securityMeasures','ethicsReference','consentReview'].map(k=>[k,'Synthetic explicit decision '+k]))};
  for(const action of ['processingPolicyGet','processingPolicySave','processingPolicyApprove'])assert.equal((await f.partnershipRpc(TOKENS.a,action,action==='processingPolicyGet'?scope:action==='processingPolicySave'?request({...scope,expectedRevision:0,policy}):request({...scope,expectedRevision:0,policyVersionId:randomUUID(),policyHash:'a'.repeat(64)}))).error,'unauthorized');
  assert.equal((await ok(f,'processingPolicyGet',scope)).policy,null);
  const saved=(await ok(f,'processingPolicySave',request({...scope,expectedRevision:0,policy}))).policy;assert.equal(saved.approved,false);
  const authorize=async(extra={})=>(await f.db.query('SELECT research_private.processing_authorized($1,$2,$3,$4,$5,$6,$7::jsonb) allowed',[TOKENS.a,scope.studyId,scope.partnerId,extra.purpose||policy.purpose,extra.provider||policy.provider,extra.version||policy.providerVersion,extra.categories||['agreement_changes']])).rows[0].allowed;
  assert.equal(await authorize(),false);
  const approvedPolicy=(await ok(f,'processingPolicyApprove',request({...scope,expectedRevision:saved.revision,policyVersionId:saved.id,policyHash:saved.hash}))).policy;assert.equal(approvedPolicy.approved,true);assert.equal(await authorize(),true);
  assert.notEqual((await f.db.query("SELECT current_setting('research.owner',true) owner")).rows[0].owner,'true');
  assert.equal(await authorize({purpose:'pre_signing_document'}),false);assert.equal(await authorize({provider:'wrong'}),false);assert.equal(await authorize({version:'wrong'}),false);assert.equal(await authorize({categories:['personal']}),false);assert.equal(await authorize({categories:[]}),false);
  const next=(await ok(f,'processingPolicySave',request({...scope,expectedRevision:1,policy:{...policy,purpose:'pre_signing_document',dataCategories:['agreement_document']}}))).policy;assert.equal(next.approved,false);assert.equal(await authorize(),false);
  await ok(f,'processingPolicyApprove',request({...scope,expectedRevision:next.revision,policyVersionId:next.id,policyHash:next.hash}));assert.equal(await authorize({purpose:'pre_signing_document',categories:['agreement_document']}),true,'pre-signing transfer does not require execution');
  await f.db.query("UPDATE research_private.studies SET config=config||'{\"description\":\"Synthetic restriction change\"}' WHERE id=$1",[scope.studyId]);assert.equal(await authorize({purpose:'pre_signing_document',categories:['agreement_document']}),false);
  for(const role of ['anon','authenticated','service_role']){await f.db.exec('SET ROLE '+role);for(const table of ['agreement_preparations','processing_policies','processing_policy_approvals'])await assert.rejects(f.db.query('SELECT * FROM research_private.'+table),/permission denied/);await assert.rejects(f.db.query("SELECT research_private.processing_authorized(NULL,NULL,NULL,'','','','[]')"),/permission denied/);await f.db.exec('RESET ROLE');}
  await f.db.query("UPDATE public.access_settings SET value=value||'{\"revoked\":true}' WHERE key='code:STAFFA'");
  assert.equal((await ok(f,'processingPolicyGet',scope)).policy.id,next.id,'current owner can inspect retained policy history');
  assert.equal((await f.partnershipRpc(TOKENS.owner,'processingPolicySave',request({...scope,expectedRevision:next.revision,policy}))).error,'not_found');
 }finally{await f.close();}
});

test('guided SQL: limited partners receive form references without restricted questionnaire items or consent text',async()=>{
 const f=await createPartnershipDatabase();try{
  const {approval,study}=await incoming(f),instrumentId=randomUUID(),consentId=randomUUID();
  await f.db.query("INSERT INTO research_private.form_versions(id,study_id,kind,definition) VALUES($1,$2,'instrument',$3),($4,$2,'consent',$5)",[instrumentId,study.id,{title:'Synthetic instrument',items:[{id:'private',label:'SYNTHETIC-RESTRICTED-ITEM',options:['SYNTHETIC-RESTRICTED-OPTION']}]},consentId,{title:'Synthetic consent',text:'SYNTHETIC-RESTRICTED-CONSENT'}]);
  await f.db.query('INSERT INTO research_private.form_publications(study_id,version_id) VALUES($1,$2),($1,$3)',[study.id,instrumentId,consentId]);
  await f.db.query('UPDATE research_private.studies SET config=config||$2::jsonb WHERE id=$1',[study.id,{instrumentVersionIds:[instrumentId],consentVersionId:consentId,dataCategories:['surveys'],withdrawalPolicy:'retain-consented'}]);
  const approved=await ok(f,'intakeReview',approval,TOKENS.owner,true),scope={studyId:study.id,partnerId:approved.partner.id};
  assert.equal((await f.rpc(TOKENS.a,'versionList',{studyId:study.id,kind:'instrument'})).error,'not_found');
  const sources=await ok(f,'agreementSources',scope,TOKENS.a),preview=await ok(f,'agreementRefreshPreview',{...scope,recordId:approved.preparation.record.id,versionId:approved.preparation.version.id},TOKENS.a);
  assert.equal(sources.sources.forms.find(v=>v.id===instrumentId).hash.length,64);assert.equal('definition' in sources.sources.forms[0],false);
  const receipt=(await f.db.query('SELECT snapshot FROM research_private.agreement_preparations WHERE version_id=$1',[approved.preparation.version.id])).rows[0];
  for(const value of [approved.preparation,sources,preview,receipt])assert.doesNotMatch(JSON.stringify(value),/SYNTHETIC-RESTRICTED-(?:ITEM|OPTION|CONSENT)/);
  const another=(await f.rpc(TOKENS.owner,'studyCreate',request({config:{title:'Synthetic unpublished instrument only'}}))).study,unpublished=randomUUID();
  await f.rpc(TOKENS.owner,'memberSet',request({studyId:another.id,expectedRevision:another.revision,code:'STAFFA',role:'researcher',permissions:['view_study']}));
  await f.db.query("INSERT INTO research_private.form_versions(id,study_id,kind,definition) VALUES($1,$2,'instrument',$3)",[unpublished,another.id,{title:'Synthetic unfinished instrument',items:[{label:'SYNTHETIC-RESTRICTED-ITEM'}]}]);
  await f.db.query('UPDATE research_private.studies SET config=config||$2::jsonb WHERE id=$1',[another.id,{instrumentVersionIds:[unpublished]}]);
  const unfinished=await ok(f,'agreementPrepare',request({studyId:another.id,partnerId:approved.partner.id}));assert.equal('consentConfiguration' in unfinished.version.data,false);assert.equal('consentProtocolVersionId' in unfinished.version.data,false);assert.equal('questionnaireVersionIds' in unfinished.version.data,false);assert.doesNotMatch(JSON.stringify(unfinished),/SYNTHETIC-RESTRICTED-ITEM/);
 }finally{await f.close();}
});

test('guided SQL: ambiguous sources require selection and approved contributions retain requested and agreed terms separately',async()=>{
 const f=await createPartnershipDatabase();try{
  let study=(await f.rpc(TOKENS.owner,'studyCreate',request({config:{title:'Synthetic source selection'}}))).study;
  await f.rpc(TOKENS.owner,'memberSet',request({studyId:study.id,expectedRevision:study.revision,code:'STAFFA',role:'researcher',permissions:['view_study']}));
  const partner=(await ok(f,'partnerSave',request({individualCode:'STAFFA',expectedRevision:null,profile:{applicantType:'individual',fullName:'Synthetic source researcher',email:'source@example.invalid'}}))).partner;
  const scope={studyId:study.id,partnerId:partner.id};
  const save=(kind,data)=>ok(f,'recordSave',request({...scope,kind,data,expectedRevision:null}));
  const app1=await save('application',{title:'First meaning',objectives:'First question'}),app2=await save('application',{title:'Second meaning',objectives:'Second question',population:'Synthetic population'});
  async function approveRecord(row,approvedTerms){row=await ok(f,'recordSubmit',request({...scope,recordId:row.record.id,versionId:row.version.id,expectedRevision:row.record.revision}));return {...row,...await ok(f,'recordReview',request({...scope,recordId:row.record.id,versionId:row.version.id,expectedRevision:row.record.revision,decision:'approved',...(approvedTerms?{approvedTerms}:{})}))};}
  const budget1=await approveRecord(await save('budget',{title:'Synthetic budget A',currency:'ILS',items:[{description:'Synthetic expense A',amount:'100.00',party:'owner'}]}));
  const budget2=await approveRecord(await save('budget',{title:'Synthetic budget B',currency:'USD',items:[{description:'Synthetic expense B',amount:'200.00',party:'partner'}]}));
  const contribution=await approveRecord(await save('contribution',{title:'Synthetic contribution',category:'scientific',description:'Synthetic method',requestedRecognition:'Requested credit',requestedCompensation:'250.00',requestedIP:'Requested broad rights',currency:'ILS'}),{recognition:'Agreed credit',compensation:'100.00',currency:'ILS',ip:'Agreed limited rights'});
  assert.equal((await f.partnershipRpc(TOKENS.owner,'agreementPrepare',request(scope))).error,'conflict');
  assert.equal((await f.partnershipRpc(TOKENS.owner,'agreementPrepare',request({...scope,applicationVersionId:app2.version.id}))).error,'conflict');
  assert.equal((await f.partnershipRpc(TOKENS.owner,'agreementPrepare',request({...scope,applicationVersionId:randomUUID(),budgetVersionIds:[]}))).error,'not_found');
  const prepared=await ok(f,'agreementPrepare',request({...scope,applicationVersionId:app2.version.id,budgetVersionIds:[budget2.version.id],contributionVersionIds:[contribution.version.id]}));
  assert.equal(prepared.version.data.objectives,'Second question');assert.equal(prepared.version.data.budgetId,budget2.record.id);assert.equal(prepared.version.data.annexC[0].approvedCap,'200.00');assert.equal(prepared.version.data.annexC[0].currency,'USD');
  assert.equal(prepared.version.data.annexD[0].requestedPayment,'250.00');assert.equal(prepared.version.data.annexD[0].agreedPayment,'100.00');assert.equal(prepared.version.data.annexD[0].requestedRights,'Requested broad rights');assert.equal(prepared.version.data.annexD[0].agreedRights,'Agreed limited rights');assert.equal(prepared.version.data.annexD[0].confirmingVersion,contribution.version.id);
  assert.equal(prepared.preparation.snapshot.selection.applicationVersionId,app2.version.id);assert.notEqual(prepared.preparation.snapshot.selection.budgetVersionIds[0],budget1.version.id);
  assert.equal((await f.db.query("SELECT count(*)::int n FROM research_private.partnership_records WHERE kind='agreement_template' AND status='approved'")).rows[0].n,0);
  const revisedBudget=await approveRecord(await ok(f,'recordSave',request({...scope,recordId:budget2.record.id,kind:'budget',expectedRevision:budget2.record.revision,data:{...budget2.version.data,items:[{description:'Synthetic revised expense',amount:'300.00',party:'partner'}]}})));
  const revisedContribution=await approveRecord(await ok(f,'recordSave',request({...scope,recordId:contribution.record.id,kind:'contribution',expectedRevision:contribution.record.revision,data:{...contribution.version.data,description:'Synthetic revised method'}})),{recognition:'New agreed credit',compensation:'75.00',currency:'ILS',ip:'New limited rights'});
  await ok(f,'recordSave',request({...scope,recordId:app2.record.id,kind:'application',expectedRevision:app2.record.revision,data:{title:'Second meaning',objectives:'Updated second question'}}));
  await ok(f,'partnerSave',request({partnerId:partner.id,expectedRevision:partner.revision,profile:{...partner.profile,fullName:'Synthetic source researcher revised'}}));
  const rs={...scope,recordId:prepared.record.id};
  const preview=(await ok(f,'agreementRefreshPreview',{...rs,versionId:prepared.version.id})).preview;
  assert.deepEqual(preview.selection.budgetVersionIds,[revisedBudget.version.id]);assert.deepEqual(preview.selection.contributionVersionIds,[revisedContribution.version.id]);
  assert.equal(preview.changes.find(c=>c.field==='annexC').proposed[0].approvedCap,'300.00');assert.equal(preview.changes.find(c=>c.field==='annexD').proposed[0].agreedPayment,'75.00');assert.equal(preview.changes.find(c=>c.field==='population').proposedPresent,false);
  const refreshed=await ok(f,'agreementRefreshApply',request({...rs,versionId:prepared.version.id,expectedRevision:prepared.record.revision,previewHash:preview.hash,replaceFields:['objectives']}));
  assert.equal(refreshed.version.data.population,'Synthetic population');assert.equal(refreshed.version.data.leadResearcher,'Synthetic source researcher');assert.equal(refreshed.preparation.fieldSources.leadResearcher.revision,0);
  const nextPreview=(await ok(f,'agreementRefreshPreview',{...rs,versionId:refreshed.version.id})).preview;
  assert.equal(nextPreview.changes.find(c=>c.field==='population').proposedPresent,false);assert.equal(nextPreview.changes.find(c=>c.field==='leadResearcher').proposed,'Synthetic source researcher revised');
  for(const status of ['signing','executed']){await f.db.query('UPDATE research_private.partnership_records SET status=$1 WHERE id=$2',[status,prepared.record.id]);assert.equal((await f.partnershipRpc(TOKENS.owner,'agreementRefreshPreview',{...rs,versionId:refreshed.version.id})).error,'conflict');const resumed=await ok(f,'agreementPrepare',request(scope));assert.equal(resumed.version.id,refreshed.version.id);assert.equal(resumed.record.status,status);}
  // Seed only invented execution metadata to isolate amendment inheritance.
  // This is not a signing/evidence verification test.
  const documentId=randomUUID(),signingId=randomUUID();
  await f.db.query("INSERT INTO research_private.partnership_documents(id,study_id,partner_id,record_id,filename,media_type,size,sha256,content_ciphertext) VALUES($1,$2,$3,$4,'synthetic-only.txt','text/plain',1,$5,'{\"synthetic\":true}')",[documentId,scope.studyId,scope.partnerId,prepared.record.id,'a'.repeat(64)]);
  await f.db.query("INSERT INTO research_private.partnership_signings(id,study_id,partner_id,record_id,version_id,document_hash,provider_session_id,provider_document_hash,provider_state_ciphertext,authority_policy_hash,state,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$6,'{\"synthetic\":true}',$6,'completed',CURRENT_TIMESTAMP+interval '1 day')",[signingId,scope.studyId,scope.partnerId,prepared.record.id,refreshed.version.id,'a'.repeat(64),'synthetic-'+randomUUID()]);
  await f.db.query("INSERT INTO research_private.partnership_executions(study_id,partner_id,record_id,version_id,signing_id,document_hash,provider_event_id,final_document_id,final_document_hash,audit_document_id,verified_signers,completed_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$6,$8,'[]',CURRENT_TIMESTAMP)",[scope.studyId,scope.partnerId,prepared.record.id,refreshed.version.id,signingId,'a'.repeat(64),'synthetic-'+randomUUID(),documentId]);
  const amended=await ok(f,'agreementAmend',request({...rs,versionId:refreshed.version.id,expectedRevision:refreshed.record.revision,reason:'Synthetic amendment',data:{...refreshed.version.data,objectives:'Synthetic amended objective',amendsAgreementVersionId:refreshed.version.id}}));
  const amendmentPreview=(await ok(f,'agreementRefreshPreview',{...scope,recordId:amended.record.id,versionId:amended.version.id})).preview;assert.equal(amendmentPreview.initialReceiptId,prepared.preparation.id);assert.equal(amendmentPreview.changes.find(c=>c.field==='objectives').overridden,true);assert.equal(amended.record.status,'draft');
 }finally{await f.close();}
});
