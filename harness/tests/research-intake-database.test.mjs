import test from 'node:test';
import assert from 'node:assert/strict';
import { createPartnershipDatabase, TOKENS, request } from '../fixtures/research-partnership-database.mjs';
import { randomUUID } from 'node:crypto';
import INTAKE from '../../app/lib/research-intake-core.js';

async function ok(f,action,payload={},credential=TOKENS.owner){const result=await f.intakeRpc(credential,action,payload);assert.equal(result.error,undefined,action+': '+JSON.stringify(result));return result;}
async function publish(f,title='Synthetic published terms',text='Synthetic conditions; submission is not a signature or financial obligation'){
 const initial=(await ok(f,'intakeOwnerBootstrap')).termsState;
 const save=request({expectedRevision:initial.revision,title,text});const saved=await ok(f,'intakeTermsSave',save);
 const pub=request({expectedRevision:saved.termsState.revision,versionId:saved.termsState.draftVersion.versionId});const published=await ok(f,'intakeTermsPublish',pub);
 return {terms:(await ok(f,'intakePublicInfo',{},null)).terms,save,saved,pub,published};
}
const proposal=(extra={})=>({title:'Synthetic proposal',applicationType:'partnership',applicantType:'individual',fullName:'Synthetic Individual',email:'synthetic@example.invalid',objectives:'Synthetic research objective',requestedTools:['synthetic tool'],requestedPermissions:['view_study','export_data'],...extra});
const submission=(terms,application=proposal(),extra={})=>request({termsVersionId:terms.versionId,termsHash:terms.hash,acknowledged:true,application,rateBucket:'a'.repeat(64),...extra});
async function submit(f,terms,application=proposal(),extra={}){const payload=submission(terms,application,extra);return {...await ok(f,'intakeSubmit',payload,null),payload};}
async function study(f,title='Synthetic intake study'){const result=await f.rpc(TOKENS.owner,'studyCreate',request({config:{title}}));assert.equal(result.error,undefined);return result.study;}
const approve=(id,s,extra={})=>request({applicationId:id,expectedRevision:0,decision:'approved',studyId:s.id,studyExpectedRevision:s.revision,individualCode:'STAFFA',permissions:['view_study'],...extra});

test('unpublished intake exposes no terms and accepts no applications', async () => {
 const f=await createPartnershipDatabase();try {
  assert.equal(typeof f.intakeRpc,'function');
  assert.deepEqual(await f.intakeRpc(null,'intakePublicInfo',{}),{terms:null,acceptingApplications:false});
  const draft=(await ok(f,'intakeOwnerBootstrap')).termsState;assert.equal(draft.revision,0);assert.deepEqual({title:draft.draftVersion.title,text:draft.draftVersion.text},INTAKE.DEFAULT_TERMS_DRAFT);
  assert.equal((await f.intakeRpc(null,'intakeSubmit',submission(draft.draftVersion))).error,'conflict');
 }finally{await f.close();}
});

test('published exact conditions bind immutable individual and institution proposals without creating rights',async()=>{
 const f=await createPartnershipDatabase();try{
  const before=(await f.db.query('SELECT count(*)::int n FROM public.access_settings')).rows[0].n;const {terms}=await publish(f);
  const individual=await submit(f,terms);const institution=await submit(f,terms,proposal({applicantType:'institution',institution:'Synthetic Institute',fullName:'Synthetic representative'}));
  assert.deepEqual(Object.keys(individual.receipt).sort(),['id','status','submittedAt']);assert.equal(individual.receipt.status,'submitted');
  const got=await ok(f,'intakeGet',{applicationId:institution.receipt.id});assert.deepEqual(got.application.application,institution.payload.application);assert.deepEqual(got.terms,terms);assert.equal(got.application.termsHash,terms.hash);assert.ok(got.application.acknowledgedAt);assert.equal(got.workspace,null);
  assert.equal((await f.db.query('SELECT count(*)::int n FROM public.access_settings')).rows[0].n,before);
  for(const table of ['memberships','partnership_partners','partnership_records','partnership_executions'])assert.equal((await f.db.query('SELECT count(*)::int n FROM research_private.'+table)).rows[0].n,0);
  for(const table of ['intake_applications','intake_terms_versions','intake_reviews'])await assert.rejects(f.db.query('UPDATE research_private.'+table+' SET '+(table==='intake_applications'?'application=application':table==='intake_terms_versions'?'title=title':'note=note')),/immutable/);
  const later=await publish(f,'New synthetic terms');assert.notEqual(later.terms.versionId,terms.versionId);
  assert.deepEqual(await f.intakeRpc(null,'intakeSubmit',{...individual.payload,rateBucket:'b'.repeat(64)}),{receipt:individual.receipt});
  assert.equal((await f.intakeRpc(null,'intakeSubmit',submission(terms))).error,'conflict');
  assert.equal((await f.intakeRpc(null,'intakeSubmit',{...individual.payload,application:proposal({title:'Changed'})})).error,'conflict');
  assert.deepEqual((await ok(f,'intakeGet',{applicationId:individual.receipt.id})).terms,terms);
 }finally{await f.close();}
});

test('SQL validates public types and authority and keeps inbox and direct tables private',async()=>{
 const f=await createPartnershipDatabase();try{
  const {terms}=await publish(f);const good=submission(terms);
  for(const payload of [{...good,owner:true},{...good,rateBucket:'client-ip'},{...good,acknowledged:'true'},{...good,application:{...good.application,questionnaireVersionIds:[randomUUID()]}},{...good,application:{...good.application,fullName:3}},{...good,application:{...good.application,requestedTools:[]}},{...good,application:proposal({applicantType:'institution'})},{...good,application:proposal({requestedPermissions:['system_admin']})},{...good,application:proposal({startDate:'2026-02-30'})}])assert.equal((await f.intakeRpc(null,'intakeSubmit',payload)).error,'invalid');
  const sent=await submit(f,terms);
  for(const credential of [null,TOKENS.a,TOKENS.worker])for(const [action,payload]of [['intakeOwnerBootstrap',{}],['intakeList',{}],['intakeGet',{applicationId:sent.receipt.id}],['intakeReview',request({applicationId:sent.receipt.id,expectedRevision:0,decision:'rejected'})]])assert.equal((await f.intakeRpc(credential,action,payload)).error,'unauthorized');
  assert.equal((await f.intakeRpc(TOKENS.owner,'intakePublicInfo',{})).error,'invalid');
  for(const role of ['anon','authenticated','service_role']){
   await f.db.exec('SET ROLE '+role);for(const table of ['intake_applications','intake_terms_versions','intake_decisions','intake_reviews','intake_receipts'])await assert.rejects(f.db.query('SELECT * FROM research_private.'+table),/permission denied/);
   if(role!=='service_role')await assert.rejects(f.db.query("SELECT public.research_intake_rpc(NULL,'intakePublicInfo','{}')"),/permission denied/);await f.db.exec('RESET ROLE');
  }
  await f.db.exec('SET ROLE research_worker');assert.equal((await f.db.query('SELECT count(*)::int n FROM research_private.intake_applications')).rows[0].n,0);await f.db.exec('RESET ROLE');
  const flags=(await f.db.query("SELECT current_setting('research.owner',true) owner,current_setting('research.intake_public',true) public,current_setting('research.intake_request',true) request")).rows[0];assert.ok(flags.owner!=='true'&&flags.public!=='true'&&!flags.request);
 }finally{await f.close();}
});

test('terms and review use CAS and exact request replay; owner lists query with stable pagination',async()=>{
 const f=await createPartnershipDatabase();try{
  const {terms,save,saved,pub,published}=await publish(f);
  assert.deepEqual(await ok(f,'intakeTermsSave',save),saved);assert.deepEqual(await ok(f,'intakeTermsPublish',pub),published);
  assert.equal((await f.intakeRpc(TOKENS.owner,'intakeTermsSave',{...save,text:'different'})).error,'conflict');
  assert.equal((await f.intakeRpc(TOKENS.owner,'intakeTermsPublish',request({expectedRevision:0,versionId:terms.versionId}))).error,'conflict');
  const sent=await submit(f,terms);const review=request({applicationId:sent.receipt.id,expectedRevision:0,decision:'under_review',note:'Synthetic owner note'});const reviewed=await ok(f,'intakeReview',review);assert.equal(reviewed.application.revision,1);assert.deepEqual(await ok(f,'intakeReview',review),reviewed);
  assert.equal((await f.intakeRpc(TOKENS.owner,'intakeReview',request({applicationId:sent.receipt.id,expectedRevision:0,decision:'rejected'}))).error,'conflict');
  assert.equal((await ok(f,'intakeList',{status:'under_review',query:'synthetic individual'})).applications.length,1);
  await ok(f,'intakeReview',request({applicationId:sent.receipt.id,expectedRevision:1,decision:'rejected'}));assert.equal((await ok(f,'intakeList',{status:'under_review'})).applications.length,0);
  // Seed many synthetic proposals directly to exercise the owner's actual SQL page boundary.
  for(let i=0;i<52;i++)await f.db.query('WITH inserted AS (INSERT INTO research_private.intake_applications(request_id,payload_hash,application,terms_version_id,terms_hash) VALUES($1,$2,$3,$4,$2) RETURNING id) INSERT INTO research_private.intake_decisions(application_id) SELECT id FROM inserted',[randomUUID(),'a'.repeat(64),proposal({title:'Page synthetic '+i}),terms.versionId]);
  const first=await ok(f,'intakeList',{query:'Page synthetic'});assert.equal(first.applications.length,50);assert.ok(first.nextCursor);const last=await ok(f,'intakeList',{query:'Page synthetic',cursor:first.nextCursor});assert.equal(last.applications.length,2);assert.equal(last.nextCursor,null);assert.equal(new Set([...first.applications,...last.applications].map(a=>a.id)).size,52);
 }finally{await f.close();}
});

test('atomic approval imports a draft and exact selected membership, retaining same-code profile and owner history',async()=>{
 const f=await createPartnershipDatabase();try{
  const {terms}=await publish(f);const sent=await submit(f,terms);let s=await study(f);const approval=approve(sent.receipt.id,s);
  const approved=await ok(f,'intakeReview',approval);assert.equal(approved.application.status,'approved');assert.equal(approved.application.revision,1);assert.equal(approved.workspace.study.id,s.id);assert.equal(approved.workspace.study.status,'draft');assert.equal(approved.workspace.study.revision,s.revision+1);assert.deepEqual(approved.workspace.grantedPermissions,['view_study']);assert.equal(approved.workspace.partnershipActive,false);
  assert.deepEqual(await ok(f,'intakeReview',approval),approved);assert.equal((await f.intakeRpc(TOKENS.owner,'intakeReview',request({...approval,requestId:randomUUID(),expectedRevision:1}))).error,'conflict');
  const record=(await f.db.query('SELECT * FROM research_private.partnership_records WHERE id=$1',[approved.application.recordId])).rows[0];assert.equal(record.kind,'application');assert.equal(record.status,'draft');assert.equal(record.partner_id,approved.partner.id);assert.equal(record.study_id,s.id);
  for(const table of ['partnership_executions','partnership_approvals','partnership_signings'])assert.equal((await f.db.query('SELECT count(*)::int n FROM research_private.'+table)).rows[0].n,0);assert.equal((await f.db.query("SELECT count(*)::int n FROM research_private.partnership_records WHERE kind IN ('agreement','obligation','budget')")).rows[0].n,0);
  const second=await submit(f,terms,proposal({fullName:'Untrusted renamed person',email:'other@example.invalid'}));const anotherStudy=await study(f,'Second synthetic');const same=await ok(f,'intakeReview',approve(second.receipt.id,anotherStudy,{permissions:['view_study','propose_analysis']}));assert.equal(same.partner.id,approved.partner.id);assert.equal(same.partner.profile.fullName,'Synthetic Individual');
  const third=await submit(f,terms,proposal({fullName:'Another researcher, same email'}));const current=(await f.db.query('SELECT revision FROM research_private.studies WHERE id=$1',[s.id])).rows[0];const distinct=await ok(f,'intakeReview',approve(third.receipt.id,{...s,revision:current.revision},{individualCode:'STAFFB',permissions:['view_study','view_approved_findings']}));assert.notEqual(distinct.partner.id,approved.partner.id);
  const ownerFolders=await f.partnershipRpc(TOKENS.owner,'partnerGet',{partnerId:approved.partner.id});const ownFolders=await f.partnershipRpc(TOKENS.a,'partnerGet',{partnerId:approved.partner.id});assert.equal(ownerFolders.workspaces.length,2);assert.equal(ownFolders.workspaces.length,2);assert.deepEqual(ownerFolders.workspaces[0].grantedPermissions,['view_study']);assert.notDeepEqual(ownerFolders.workspaces[0].grantedPermissions,INTAKE.PUBLIC_FIELDS.find(f=>f.id==='requestedPermissions').choices);
  await f.db.query("DELETE FROM research_private.memberships WHERE study_id=$1 AND actor_ref='code:STAFFA'",[s.id]);assert.equal((await f.partnershipRpc(TOKENS.a,'partnerGet',{partnerId:approved.partner.id})).workspaces.length,1);assert.equal((await f.partnershipRpc(TOKENS.owner,'partnerGet',{partnerId:approved.partner.id})).workspaces.length,2);
  await f.db.query("UPDATE public.access_settings SET value=jsonb_set(value,'{revoked}','true') WHERE key='code:STAFFA'");assert.equal((await f.partnershipRpc(TOKENS.a,'partnerGet',{partnerId:approved.partner.id})).error,'unauthorized');assert.equal((await ok(f,'intakeGet',{applicationId:sent.receipt.id})).application.status,'approved');
 }finally{await f.close();}
});

test('approval conflicts roll back every intermediate effect and public submissions enforce per-bucket rate',async()=>{
 const f=await createPartnershipDatabase();try{
  const {terms}=await publish(f);const sent=await submit(f,terms);const s=await study(f);
  assert.equal((await f.intakeRpc(TOKENS.owner,'intakeReview',approve(sent.receipt.id,s,{studyExpectedRevision:s.revision+1}))).error,'conflict');
  assert.equal((await f.intakeRpc(TOKENS.owner,'intakeReview',approve(sent.receipt.id,s,{individualCode:'MISSING'}))).error,'invalid');
  // A record write failure after memberSet/partnerSave proves the outer transaction rolls both back.
  await f.db.exec("CREATE FUNCTION public.synthetic_intake_record_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'invalid'; END $$; CREATE TRIGGER synthetic_intake_record_failure BEFORE INSERT ON research_private.partnership_records FOR EACH ROW EXECUTE FUNCTION public.synthetic_intake_record_failure()");
  assert.equal((await f.intakeRpc(TOKENS.owner,'intakeReview',approve(sent.receipt.id,s))).error,'invalid');
  for(const table of ['memberships','partnership_partners','partnership_records','intake_reviews'])assert.equal((await f.db.query('SELECT count(*)::int n FROM research_private.'+table)).rows[0].n,0);assert.equal((await f.db.query('SELECT revision FROM research_private.studies WHERE id=$1',[s.id])).rows[0].revision,s.revision);
  assert.equal((await ok(f,'intakeGet',{applicationId:sent.receipt.id})).application.status,'submitted');
  // A single synthetic transaction fixes the rate minute even when this test crosses a wall-clock boundary.
  await f.db.exec('BEGIN');for(let i=0;i<20;i++)await submit(f,terms,proposal(),{rateBucket:'c'.repeat(64)});
  assert.deepEqual(await f.intakeRpc(null,'intakeSubmit',{...sent.payload,rateBucket:'b'.repeat(64)}),{receipt:sent.receipt});
  assert.deepEqual(await f.intakeRpc(null,'intakeSubmit',submission(terms,proposal(),{rateBucket:'c'.repeat(64)})),{error:'rate_limited',status:429});
  await submit(f,terms,proposal(),{rateBucket:'b'.repeat(64)});
  await f.db.exec('COMMIT');
 }finally{await f.close();}
});
