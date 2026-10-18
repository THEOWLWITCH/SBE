import test from 'node:test';
import assert from 'node:assert/strict';
import { createResearchDatabase, TOKENS, request, token } from '../fixtures/research-database.mjs';
import { createHash, randomUUID } from 'node:crypto';
const sha = x => createHash('sha256').update(x).digest('hex');
const ciphertext = { v: 1, iv: 'synthetic', tag: 'synthetic', ciphertext: 'encrypted-synthetic-value' };
async function checked(rpc, credential, action, payload) { const result = await rpc(credential, action, payload); assert.equal(result.error, undefined, action + ': ' + JSON.stringify(result)); return result; }
async function activated(rpc, title = 'Synthetic Research') {
  let study = (await checked(rpc, TOKENS.owner, 'studyCreate', request({ config: { title } }))).study;
  const consent = { title: 'Synthetic consent', text: 'Synthetic optional consent disclosure', categories: ['surveys','usage','historical','generated','identities','contacts'], contactKinds: ['followup','feedback','update'], retentionDays: 30, withdrawalPolicy: 'retain-consented', expectations: 'Synthetic questionnaires' };
  const instrument = { title: 'Synthetic questions', construct: 'PLSE', validationStatus: 'under-development', description: 'Synthetic test definition, not a validated instrument', items: [{ id:'q1',type:'number',label:'Synthetic numeric item',required:true,min:1,max:5 },{id:'q2',type:'choice',label:'Synthetic choice',required:false,options:['yes','no']}] };
  let c = await checked(rpc, TOKENS.owner,'versionSave', request({studyId:study.id,expectedRevision:study.revision,kind:'consent',definition:consent})); study.revision=c.revision;
  let z = await checked(rpc,TOKENS.owner,'versionPublish',request({studyId:study.id,expectedRevision:study.revision,versionId:c.version.id}));study.revision=z.revision;
  let i = await checked(rpc,TOKENS.owner,'versionSave',request({studyId:study.id,expectedRevision:study.revision,kind:'instrument',definition:instrument}));study.revision=i.revision;
  z=await checked(rpc,TOKENS.owner,'versionPublish',request({studyId:study.id,expectedRevision:study.revision,versionId:i.version.id}));study.revision=z.revision;
  const config={title,description:'Synthetic study',researchQuestions:['Synthetic question'],principalInvestigator:'Synthetic PI',population:'Educators',eligibleInstitutions:[],startDate:'2026-01-01',endDate:'2030-12-31',approvals:{status:'approved',reference:'SYNTHETIC',documentation:'Fixture only; not real ethics approval'},consentVersionId:c.version.id,instrumentVersionIds:[i.version.id],schedule:[{waveId:'baseline',instrumentVersionId:i.version.id,offsetDays:0,reminderDays:[]}],dataCategories:consent.categories,exportCategories:consent.categories,contactKinds:consent.contactKinds,retentionDays:30,withdrawalPolicy:'retain-consented',expectations:'Synthetic questionnaires'};
  study=(await checked(rpc,TOKENS.owner,'studySave',request({studyId:study.id,expectedRevision:study.revision,config}))).study;
  study=(await checked(rpc,TOKENS.owner,'studyStatus',request({studyId:study.id,expectedRevision:study.revision,status:'pending_approval'}))).study;
  study=(await checked(rpc,TOKENS.owner,'studyStatus',request({studyId:study.id,expectedRevision:study.revision,status:'active',confirmApprovals:true}))).study;
  const invite='synthetic-invite-'+randomUUID(); await checked(rpc,TOKENS.owner,'inviteCreate',request({studyId:study.id,inviteDigest:sha(invite)}));
  return { study, consent:c.version, instrument:i.version, invite };
}
async function enrolled(rpc, fixture, credential=TOKENS.participant) {
  const verification='synthetic-verification-'+randomUUID();
  const payload=request({inviteDigest:sha(fixture.invite),consentVersionId:fixture.consent.id,consents:{participate:true,surveys:true,usage:true,historical:true,generated:true},preferences:{followup:true,feedback:true,update:true},destinationHash:sha('synthetic@example.invalid'),verificationDigest:sha(verification),contactCiphertext:ciphertext,verificationCiphertext:ciphertext,welcomeCiphertext:ciphertext,followupCiphertext:ciphertext});
  const pending=await checked(rpc,credential,'enroll',payload);
  const complete=await checked(rpc,credential,'verifyEmail',request({studyId:fixture.study.id,verificationDigest:sha(verification)}));
  return { pending, complete, verification, payload };
}

test('real database denies direct service/browser reads and gives only assigned study scope', async () => {
  const { db, rpc, close } = await createResearchDatabase();
  try {
    const a = (await rpc(TOKENS.owner, 'studyCreate', request({ config: { title: 'A' } }))).study;
    const b = (await rpc(TOKENS.owner, 'studyCreate', request({ config: { title: 'B' } }))).study;
    assert.ok(a.id); assert.ok(b.id);
    await rpc(TOKENS.owner, 'memberSet', request({ studyId: a.id, expectedRevision: a.revision, code: 'STAFFA', role: 'researcher', permissions: ['view_study', 'view_pseudonymized_data'] }));
    await checked(rpc,TOKENS.owner,'memberSet',request({studyId:b.id,expectedRevision:b.revision,code:'STAFFB',role:'researcher',permissions:['view_study','view_aggregate_results']}));
    assert.deepEqual((await rpc(TOKENS.a, 'bootstrap')).studies.map(x => x.id), [a.id]);
    assert.deepEqual((await rpc(TOKENS.b,'bootstrap')).studies.map(x=>x.id),[b.id]);assert.equal((await rpc(TOKENS.b,'studyGet',{studyId:a.id})).error,'not_found');
    assert.equal((await rpc(TOKENS.a, 'studyGet', { studyId: b.id })).error, 'not_found');
    assert.deepEqual(await rpc(TOKENS.a, 'studyGet', { studyId: b.id }), await rpc(TOKENS.a, 'studyGet', { studyId: '00000000-0000-4000-8000-000000000000' }));
    for (const role of ['anon', 'authenticated', 'service_role']) { await db.exec('SET ROLE ' + role); await assert.rejects(db.query('SELECT * FROM research_private.participants'), /permission denied/); await db.exec('RESET ROLE'); }
    const worker = (await db.query("SELECT rolsuper,rolbypassrls,rolcanlogin FROM pg_roles WHERE rolname='research_worker'")).rows[0];
    assert.deepEqual(worker, { rolsuper: false, rolbypassrls: false, rolcanlogin: false });
  const catalog=(await db.query("SELECT c.relname,pg_get_userbyid(c.relowner) AS owner,c.relrowsecurity,c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='research_private' AND c.relkind='r'")).rows;
  assert.ok(catalog.length>=18);assert.ok(catalog.every(x=>x.owner==='research_table_owner' && x.relrowsecurity && x.relforcerowsecurity));
  const functions=(await db.query("SELECT n.nspname,p.proname,pg_get_userbyid(p.proowner) AS owner,p.prosecdef,p.proconfig,has_function_privilege('anon',p.oid,'EXECUTE') AS anon,has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated,has_function_privilege('service_role',p.oid,'EXECUTE') AS service FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='research_private' OR p.oid='public.research_rpc(text,text,jsonb)'::regprocedure")).rows;
  assert.ok(functions.every(x=>!x.anon&&!x.authenticated));assert.ok(functions.every(x=>x.proconfig.includes('search_path=""')));assert.ok(functions.filter(x=>x.service).every(x=>['dispatch','research_rpc'].includes(x.proname)));assert.equal(functions.find(x=>x.proname==='dispatch').owner,'research_worker');assert.equal(functions.find(x=>x.proname==='dispatch').prosecdef,true);assert.equal(functions.find(x=>x.proname==='research_rpc').prosecdef,false);
  for(const role of ['anon','authenticated']){await db.exec('SET ROLE '+role);await assert.rejects(db.query('SELECT public.research_rpc($1,$2,$3)',[TOKENS.owner,'bootstrap',{}]),/permission denied/);await db.exec('RESET ROLE');}
  await db.exec('SET ROLE research_worker');assert.equal((await db.query('SELECT count(*)::int n FROM research_private.responses')).rows[0].n,0);await db.exec('RESET ROLE');
  await db.exec('BEGIN');await rpc(TOKENS.owner,'studyGet',{studyId:a.id});assert.equal((await db.query("SELECT current_setting('research.owner',true) AS owner,current_setting('research.study',true) AS study")).rows[0].owner,'false');await rpc('invalid','studyGet',{studyId:a.id});await db.exec('ROLLBACK');
  } finally { await close(); }
});

test('atomic current consent verification creates one welcome, bounded reuse and immutable versioned collection', async () => {
 const {db,rpc,close}=await createResearchDatabase();try {
  const f=await activated(rpc);
  const preview=await checked(rpc,TOKENS.participant,'inviteInfo',{inviteDigest:sha(f.invite)});assert.equal(preview.consent.published,true);
  assert.equal((await db.query('SELECT count(*)::int n FROM research_private.participants')).rows[0].n,0);assert.equal((await db.query('SELECT count(*)::int n FROM research_private.outbox')).rows[0].n,0);
  const verification='only-owner-post';const payload=request({inviteDigest:sha(f.invite),consentVersionId:f.consent.id,consents:{participate:true,surveys:true,usage:true,historical:true,generated:true},preferences:{followup:true,feedback:true,update:true},destinationHash:sha('synthetic@example.invalid'),verificationDigest:sha(verification),contactCiphertext:ciphertext,verificationCiphertext:ciphertext,welcomeCiphertext:ciphertext,followupCiphertext:ciphertext});
  const pending=await checked(rpc,TOKENS.participant,'enroll',payload);assert.equal(pending.participation.verified,false);
  assert.deepEqual(await rpc(TOKENS.participant,'enroll',{...payload,contactCiphertext:{...ciphertext,iv:'new'}}),pending);
  await checked(rpc,TOKENS.participant,'enroll',{...payload,requestId:randomUUID()});assert.equal((await db.query('SELECT count(*)::int n FROM research_private.outbox')).rows[0].n,1);
  assert.equal((await rpc(TOKENS.participant,'emailChange',request({...payload,studyId:f.study.id,destinationHash:sha('replacement@example.invalid')}))).error,'rate_limited');
  assert.equal((await rpc(TOKENS.b,'verifyEmail',request({studyId:f.study.id,verificationDigest:sha(verification)}))).error,'not_found');
  const verify=request({studyId:f.study.id,verificationDigest:sha(verification)});const done=await checked(rpc,TOKENS.participant,'verifyEmail',verify);assert.equal(done.participation.status,'enrolled');
  assert.deepEqual(await rpc(TOKENS.participant,'verifyEmail',verify),done);assert.equal((await rpc(TOKENS.participant,'verifyEmail',request({studyId:f.study.id,verificationDigest:sha(verification)}))).error,'invalid');
  assert.equal((await db.query("SELECT count(*)::int n FROM research_private.outbox WHERE kind='welcome'")).rows[0].n,1);
  const survey=request({studyId:f.study.id,instrumentVersionId:f.instrument.id,waveId:'baseline',answers:{q1:3,q2:'yes'}});const response=await checked(rpc,TOKENS.participant,'surveySubmit',survey);assert.equal(response.response.versions.model,null);assert.deepEqual(await rpc(TOKENS.participant,'surveySubmit',survey),response);
  assert.equal((await rpc(TOKENS.participant,'surveySubmit',{...survey,requestId:randomUUID(),answers:{q1:9}})).error,'invalid');
  await assert.rejects(db.query('UPDATE research_private.form_versions SET definition=$1 WHERE id=$2',[{},f.consent.id]),/immutable/);
  await assert.rejects(db.query('DELETE FROM research_private.audit_events'),/immutable/);
  await assert.rejects(db.query('UPDATE research_private.responses SET answers=$1',[{q1:4}]),/immutable/);
 } finally {await close();}
});

test('SQL projections and nested IDs keep identity, document, export and study rights independent', async () => {
 const {db,rpc,close}=await createResearchDatabase();try {
  const a=await activated(rpc,'A'),b=await activated(rpc,'B');const participant=await enrolled(rpc,a);
  await checked(rpc,TOKENS.owner,'memberSet',request({studyId:a.study.id,expectedRevision:a.study.revision,code:'STAFFA',role:'researcher',permissions:['view_study','view_pseudonymized_data','export_data']}));
  const sample=await checked(rpc,TOKENS.participant,'sampleSubmit',request({studyId:a.study.id,source:'historical',category:'announcement',approximateDate:'2025',audience:'parents',sourceType:'paste',text:'Synthetic self-authored text',ownAuthorship:true,minimized:true,consentVersionId:a.consent.id}));
  const preview=await checked(rpc,TOKENS.a,'resultsGet',{studyId:a.study.id,category:'historical'});assert.equal(preview.rows.length,1);assert.equal(preview.rows[0].text,undefined);assert.ok(!JSON.stringify(preview).includes('PERSON1'));assert.ok(!JSON.stringify(preview).includes('synthetic@example.invalid'));
  const exportRows=await checked(rpc,TOKENS.a,'exportData',{studyId:a.study.id,category:'historical'});assert.equal(exportRows.rows[0].text,undefined);assert.ok(exportRows.dictionary);assert.ok(exportRows.versions.forms.length);
  assert.equal((await rpc(TOKENS.a,'sampleGet',{studyId:a.study.id,sampleId:sample.sample.id})).error,'not_found');
  assert.equal((await rpc(TOKENS.a,'exportData',{studyId:a.study.id,category:'contacts'})).error,'not_found');
  assert.equal((await rpc(TOKENS.owner,'contactGet',{studyId:b.study.id,participantId:participant.complete.participation.id})).error,'not_found');
  assert.equal((await rpc(TOKENS.participant,'surveySubmit',request({studyId:a.study.id,instrumentVersionId:b.instrument.id,waveId:'baseline',answers:{q1:2}}))).error,'not_found');
  await assert.rejects(db.query('INSERT INTO research_private.responses(study_id,participant_id,instrument_version_id,consent_version_id,wave_id,answers,versions,config_revision) VALUES($1,$2,$3,$4,$5,$6,$7,0)',[b.study.id,participant.complete.participation.id,b.instrument.id,b.consent.id,'foreign',{},{}]),/foreign key/);
 } finally {await close();}
});

test('current credentials, assignment revocation, consent replacement and withdrawal stop subsequent use', async () => {
 const {db,rpc,close}=await createResearchDatabase();try {
  const f=await activated(rpc);await enrolled(rpc,f);
  let members=await checked(rpc,TOKENS.owner,'memberSet',request({studyId:f.study.id,expectedRevision:f.study.revision,code:'STAFFA',role:'pi',permissions:['view_study','view_pseudonymized_data','manage_researchers'],delegablePermissions:['view_study','view_aggregate_results']}));
  assert.equal((await rpc(TOKENS.a,'memberSet',request({studyId:f.study.id,expectedRevision:members.revision,code:'STAFFB',role:'researcher',permissions:['view_study','export_data']}))).error,'not_found');
  members=await checked(rpc,TOKENS.owner,'memberRemove',request({studyId:f.study.id,expectedRevision:members.revision,memberId:members.members[0].id}));assert.equal((await rpc(TOKENS.a,'studyGet',{studyId:f.study.id})).error,'not_found');
  const event={eventId:randomUUID(),operation:'generate',mode:'single',sourceId:'private-global-document',versions:{model:'synthetic-model'},counts:{sessions:1,drafts:1,revisions:0,rounds:0},durationMs:100};
  await checked(rpc,TOKENS.participant,'recordUsage',event);await checked(rpc,TOKENS.participant,'recordUsage',event);assert.equal((await db.query('SELECT count(*)::int n FROM research_private.usage_events')).rows[0].n,1);
  const rows=await checked(rpc,TOKENS.owner,'resultsGet',{studyId:f.study.id,category:'usage'});assert.ok(!JSON.stringify(rows).includes('private-global-document'));
  await checked(rpc,TOKENS.participant,'withdraw',request({studyId:f.study.id}));assert.equal((await rpc(TOKENS.participant,'recordUsage',{...event,eventId:randomUUID()})).recorded,0);assert.equal((await rpc(TOKENS.participant,'surveySubmit',request({studyId:f.study.id,instrumentVersionId:f.instrument.id,waveId:'baseline',answers:{q1:3}}))).error,'conflict');
  await db.query("UPDATE public.access_settings SET value=value||'{\"revoked\":true}'::jsonb WHERE key='code:PERSON1'");assert.equal((await rpc(TOKENS.participant,'myStudies')).error,'unauthorized');
  assert.equal((await rpc(token({k:'code',c:'PERSON1',kind:'staff',inst:'Synthetic School',exp:1}),'bootstrap')).error,'unauthorized');assert.equal((await rpc('fabricated','bootstrap')).error,'unauthorized');
  assert.equal((await rpc(token({k:'sys',exp:null}),'bootstrap')).error,'unauthorized');assert.equal((await rpc(token({k:'research_worker',purpose:'research'}),'mailClaim',{})).error,'unauthorized');
  assert.equal((await rpc(token({k:'code',c:'STAFFA',inst:'Synthetic School'}),'bootstrap')).error,'unauthorized');
 } finally {await close();}
});

test('mail leases recheck current scope, lost acceptance becomes visible unknown, and erasure is scoped', async () => {
 const {db,rpc,close}=await createResearchDatabase();try {
  const f=await activated(rpc);const participant=await enrolled(rpc,f);
  const claim=await checked(rpc,TOKENS.worker,'mailClaim',{limit:10,leaseSeconds:30});assert.equal(claim.messages.length,1);const message=claim.messages[0];
  assert.equal((await checked(rpc,TOKENS.worker,'mailClaim',{messageId:message.messageId,leaseId:message.leaseId})).messages.length,1);
  await db.query("UPDATE research_private.outbox SET first_attempt_at=CURRENT_TIMESTAMP-INTERVAL '25 hours',lease_until=CURRENT_TIMESTAMP-INTERVAL '1 second' WHERE id=$1",[message.messageId]);
  assert.deepEqual((await checked(rpc,TOKENS.worker,'mailClaim',{limit:10})).messages,[]);assert.equal((await checked(rpc,TOKENS.owner,'mailList',{studyId:f.study.id})).messages.find(x=>x.id===message.messageId).status,'unknown');
  await checked(rpc,TOKENS.owner,'mailResolve',request({studyId:f.study.id,messageId:message.messageId,outcome:'not_sent',evidence:'Synthetic provider reconciliation only'}));assert.deepEqual((await checked(rpc,TOKENS.worker,'mailClaim',{limit:10})).messages,[]);
  await checked(rpc,TOKENS.worker,'followupSchedule',{});const next=await checked(rpc,TOKENS.worker,'mailClaim',{limit:10});assert.equal(next.messages.length,1);
  await checked(rpc,TOKENS.participant,'withdraw',request({studyId:f.study.id}));assert.deepEqual((await checked(rpc,TOKENS.worker,'mailClaim',{messageId:next.messages[0].messageId,leaseId:next.messages[0].leaseId})).messages,[]);
  const erased=await checked(rpc,TOKENS.participant,'eraseMyData',request({studyId:f.study.id}));assert.equal(erased.erased,true);
  await checked(rpc,TOKENS.worker,'mailComplete',{messageId:next.messages[0].messageId,leaseId:next.messages[0].leaseId,outcome:'accepted',providerId:'synthetic-accepted-after-erasure'});
  assert.equal((await db.query('SELECT provider_id FROM research_private.mail_attempts WHERE message_id=$1 AND outcome=$2',[next.messages[0].messageId,'accepted'])).rows[0].provider_id,'synthetic-accepted-after-erasure');assert.deepEqual((await checked(rpc,TOKENS.worker,'mailClaim',{limit:10})).messages,[]);
  assert.equal((await db.query('SELECT count(*)::int n FROM research_private.contacts WHERE study_id=$1',[f.study.id])).rows[0].n,0);assert.equal((await db.query('SELECT actor_ref FROM research_private.participants WHERE id=$1',[participant.complete.participation.id])).rows[0].actor_ref,null);
  const retryAfterErase=await rpc(TOKENS.participant,'enroll',{...participant.payload,requestId:randomUUID(),destinationHash:sha('fresh-after-erase@example.invalid'),verificationDigest:sha('fresh-after-erase')});assert.equal(retryAfterErase.error,'rate_limited');
 } finally {await close();}
});

test('published replacement consent pauses collection and old responses retain exact definitions', async()=>{
 const {db,rpc,close}=await createResearchDatabase();try{
  const f=await activated(rpc);await enrolled(rpc,f);await checked(rpc,TOKENS.participant,'surveySubmit',request({studyId:f.study.id,instrumentVersionId:f.instrument.id,waveId:'baseline',answers:{q1:2}}));
  let next=await checked(rpc,TOKENS.owner,'versionSave',request({studyId:f.study.id,expectedRevision:f.study.revision,kind:'consent',definition:{...f.consent.definition,text:'New synthetic consent wording'}}));
  let publication=await checked(rpc,TOKENS.owner,'versionPublish',request({studyId:f.study.id,expectedRevision:next.revision,versionId:next.version.id}));
  const updated=await checked(rpc,TOKENS.owner,'studySave',request({studyId:f.study.id,expectedRevision:publication.revision,config:{...f.study.config,consentVersionId:next.version.id}}));
  assert.equal((await rpc(TOKENS.participant,'sampleSubmit',request({studyId:f.study.id,source:'historical',text:'Old consent cannot authorize new content',ownAuthorship:true,minimized:true,consentVersionId:f.consent.id}))).error,'consent_changed');
  const old=(await db.query('SELECT consent_version_id,instrument_version_id,answers FROM research_private.responses WHERE study_id=$1',[f.study.id])).rows[0];assert.equal(old.consent_version_id,f.consent.id);assert.equal(old.instrument_version_id,f.instrument.id);assert.deepEqual(old.answers,{q1:2});
  await checked(rpc,TOKENS.participant,'reconsent',request({studyId:f.study.id,consentVersionId:next.version.id,consents:{participate:true,surveys:false,usage:false,historical:false,generated:false},preferences:{followup:false,feedback:false,update:false}}));
  assert.equal((await rpc(TOKENS.participant,'recordUsage',{eventId:randomUUID(),operation:'generate',mode:'single',sourceId:'source',counts:{sessions:1}})).recorded,0);
  const status=await checked(rpc,TOKENS.owner,'studyStatus',request({studyId:f.study.id,expectedRevision:updated.study.revision,status:'paused'}));assert.equal(status.study.status,'paused');
  await checked(rpc,TOKENS.participant,'preferencesSet',request({studyId:f.study.id,preferences:{followup:false,feedback:false,update:false}}));
 }finally{await close();}
});

test('verification destination quota covers other studies and missing category consent denies capture',async()=>{
 const {db,rpc,close}=await createResearchDatabase();try{
  const a=await activated(rpc,'A'),b=await activated(rpc,'B');const person=await enrolled(rpc,a);
  await db.query("UPDATE research_private.verification_attempts SET created_at=CURRENT_TIMESTAMP-INTERVAL '2 minutes' WHERE study_id=$1",[a.study.id]);
  for(let i=0;i<20;i++){const pid=randomUUID();await db.query('INSERT INTO research_private.participants(id,study_id,consent_version_id,consents) VALUES($1,$2,$3,$4)',[pid,b.study.id,b.consent.id,{participate:true}]);await db.query('INSERT INTO research_private.verification_attempts(study_id,participant_id,destination_hash) VALUES($1,$2,$3)',[b.study.id,pid,sha('globally-limited@example.invalid')]);}
  const limited=await rpc(TOKENS.participant,'emailChange',request({studyId:a.study.id,destinationHash:sha('globally-limited@example.invalid'),verificationDigest:sha('global-token'),contactCiphertext:ciphertext,verificationCiphertext:ciphertext,welcomeCiphertext:ciphertext}));assert.equal(limited.error,'rate_limited');
  assert.equal((await db.query('SELECT destination_hash FROM research_private.contacts WHERE study_id=$1',[a.study.id])).rows[0].destination_hash,sha('synthetic@example.invalid'));
  await checked(rpc,TOKENS.participant,'reconsent',request({studyId:a.study.id,consentVersionId:a.consent.id,consents:{participate:true},preferences:{}}));
  assert.equal((await rpc(TOKENS.participant,'surveySubmit',request({studyId:a.study.id,instrumentVersionId:a.instrument.id,waveId:'baseline',answers:{q1:3}}))).error,'unauthorized');
  assert.equal((await rpc(TOKENS.participant,'recordUsage',{eventId:randomUUID(),operation:'generate',mode:'single',sourceId:'local',counts:{sessions:1}})).recorded,0);
  await checked(rpc,TOKENS.worker,'followupSchedule',{});assert.equal((await db.query("SELECT count(*)::int n FROM research_private.outbox WHERE study_id=$1 AND kind='followup'",[a.study.id])).rows[0].n,0);
  const get=await checked(rpc,TOKENS.participant,'participationGet',{studyId:a.study.id});assert.equal(get.participation.id,person.complete.participation.id);
 }finally{await close();}
});

test('replacement email invalidates expired tokens, retention scrubs only expired study data, credentials use Jerusalem day',async()=>{
 const {db,rpc,close}=await createResearchDatabase();try{
  const a=await activated(rpc,'A'),b=await activated(rpc,'B');
  const oldToken='old-verification';const pending=await checked(rpc,TOKENS.participant,'enroll',request({inviteDigest:sha(a.invite),consentVersionId:a.consent.id,consents:{participate:true,surveys:true},preferences:{},destinationHash:sha('old@example.invalid'),verificationDigest:sha(oldToken),contactCiphertext:ciphertext,verificationCiphertext:ciphertext,welcomeCiphertext:ciphertext}));
  await db.query("UPDATE research_private.verification_attempts SET created_at=CURRENT_TIMESTAMP-INTERVAL '2 minutes' WHERE study_id=$1",[a.study.id]);await db.query("UPDATE research_private.verification_tokens SET expires_at=CURRENT_TIMESTAMP-INTERVAL '1 second' WHERE study_id=$1",[a.study.id]);
  assert.equal((await rpc(TOKENS.participant,'verifyEmail',request({studyId:a.study.id,verificationDigest:sha(oldToken)}))).error,'invalid');
  const newToken='new-verification';await checked(rpc,TOKENS.participant,'emailChange',request({studyId:a.study.id,destinationHash:sha('new@example.invalid'),verificationDigest:sha(newToken),contactCiphertext:ciphertext,verificationCiphertext:ciphertext,welcomeCiphertext:ciphertext}));
  assert.equal((await rpc(TOKENS.participant,'verifyEmail',request({studyId:a.study.id,verificationDigest:sha(oldToken)}))).error,'invalid');await checked(rpc,TOKENS.participant,'verifyEmail',request({studyId:a.study.id,verificationDigest:sha(newToken)}));
  const other=await enrolled(rpc,b);assert.notEqual(other.complete.participation.id,pending.participation.id);
  await db.query("UPDATE research_private.participants SET created_at=CURRENT_TIMESTAMP-INTERVAL '31 days' WHERE study_id=$1",[a.study.id]);
  const retained=await checked(rpc,TOKENS.owner,'retentionRun',request({studyId:a.study.id}));assert.equal(retained.removed,1);
  assert.equal((await db.query('SELECT count(*)::int n FROM research_private.contacts WHERE study_id=$1',[a.study.id])).rows[0].n,0);assert.equal((await db.query('SELECT count(*)::int n FROM research_private.contacts WHERE study_id=$1',[b.study.id])).rows[0].n,1);
  assert.ok((await db.query('SELECT count(*)::int n FROM research_private.form_versions WHERE study_id=$1',[a.study.id])).rows[0].n>0);assert.ok((await db.query('SELECT count(*)::int n FROM research_private.audit_events WHERE study_id=$1',[a.study.id])).rows[0].n>0);
  await db.query("UPDATE public.access_settings SET value=value||jsonb_build_object('expiresAt',(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jerusalem')::date::text) WHERE key='code:PERSON1'");await checked(rpc,TOKENS.participant,'myStudies',{});
  await db.query("UPDATE public.access_settings SET value=value||jsonb_build_object('expiresAt',((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jerusalem')::date-1)::text) WHERE key='code:PERSON1'");assert.equal((await rpc(TOKENS.participant,'myStudies')).error,'unauthorized');
 }finally{await close();}
});
