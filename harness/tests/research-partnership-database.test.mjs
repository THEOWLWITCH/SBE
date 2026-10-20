import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { createPartnershipDatabase, TOKENS, request, token } from '../fixtures/research-partnership-database.mjs';
import CORE from '../../app/lib/research-partnership-core.js';

async function ok(rpc, credential, action, payload = {}) {
  const result = await rpc(credential, action, payload);
  assert.equal(result.error, undefined, JSON.stringify(result));
  return result;
}
const sha = x => createHash('sha256').update(x).digest('hex');

test('actual SQL V4 vocabulary and conditional annex completion match the core without changing legacy drafts',async()=>{
 const f=await createPartnershipDatabase();try{
  const contract=(await f.db.query('SELECT research_private.partnership_contract() c')).rows[0].c;
  assert.deepEqual(contract.versions,CORE.VERSIONS);
  assert.deepEqual(contract.schemas,CORE.RECORD_SCHEMAS);
  assert.deepEqual(contract.guidedAgreement,CORE.GUIDED_AGREEMENT);
  const fields=CORE.RECORD_SCHEMAS.agreement.fields.filter(x=>['guidedVersion','ownerRegistration',...CORE.GUIDED_AGREEMENT.annexes.flatMap(a=>[a.statusField,a.reasonField,a.rowsField])].includes(x.id));
  const check=d=>f.db.query('SELECT research_private.partnership_fields($1::jsonb,$2::jsonb,NULL,NULL,true)',[fields,d]);
  await check({});
  await assert.rejects(check({guidedVersion:'4'}),/invalid/);
  const complete={guidedVersion:'4',ownerRegistration:'Synthetic registration'};
  for(const annex of CORE.GUIDED_AGREEMENT.annexes){complete[annex.statusField]='not_applicable';complete[annex.reasonField]='לא חל במחקר בדוי';}
  await check(complete);
  for(const annex of CORE.GUIDED_AGREEMENT.annexes){
   const missing={...complete};delete missing[annex.reasonField];await assert.rejects(check(missing),/invalid/);
   await assert.rejects(check({...complete,[annex.statusField]:'applicable'}),/invalid/);
   await assert.rejects(check({...complete,[annex.statusField]:'applicable',[annex.rowsField]:[{}]}),/invalid/);
   await assert.rejects(check({[annex.statusField]:'applicable'}),/invalid/,'annex content required even without guidedVersion');
  }
  const studyFields=CORE.RECORD_SCHEMAS.agreement.fields.find(f=>f.id==='annexA').fields;
  const studyRow=Object.fromEntries(studyFields.filter(f=>f.required).map(f=>[f.id,f.type==='date'?(f.id==='startDate'?'2026-11-01':'2026-12-01'):f.type==='integer'?0:'Synthetic study decision']));
  const completeStudy={...complete,annexAStatus:'applicable',annexA:[studyRow]};
  await check(completeStudy);
  await assert.rejects(check({...completeStudy,annexA:[{...studyRow,endDate:'2026-10-31'}]}),/invalid/,'only the valid end date is changed to precede the start');
  await assert.rejects(check({...completeStudy,annexA:[{...studyRow,startDate:'2026-02-30'}]}),/date\/time field value out of range/,'only the start date is changed to an impossible calendar date at the private SQL validator');
  const costFields=CORE.RECORD_SCHEMAS.agreement.fields.find(f=>f.id==='annexC').fields;
  const operating=Object.fromEntries(costFields.filter(f=>f.required&&!f.requiredWhen).map(f=>[f.id,f.type==='money'?'0.00':f.type==='enum'?Object.keys(f.choices)[0]:'Synthetic decision']));
  await check({...complete,annexCStatus:'applicable',annexC:[operating]});
  await assert.rejects(check({...complete,annexCStatus:'applicable',annexC:[{...operating,estimatedAmount:'1.001'}]}),/invalid/,'only money precision changes from an accepted complete row');
  const service={...operating,kind:'service'};
  await assert.rejects(check({...complete,annexCStatus:'applicable',annexC:[service]}),/invalid/);
  for(const def of costFields.filter(f=>f.requiredWhen))service[def.id]=def.type==='money'?'0.00':def.type==='enum'?'unpaid':'Synthetic decision';
  await check({...complete,annexCStatus:'applicable',annexC:[service]});
  for(const field of ['provider','serviceRecipient','deliverable','serviceAmount','estimatedAmount','approvedCap','ownerShare','partnerShare','acceptance']){const row={...service};delete row[field];await assert.rejects(check({...complete,annexCStatus:'applicable',annexC:[row]}),/invalid/);}
 }finally{await f.close();}
});
const cipher = {v:1,iv:'AAAAAAAAAAAAAAAA',tag:'AAAAAAAAAAAAAAAAAAAAAA==',data:'c3ludGhldGlj'};
const profile = fullName => ({fullName,email:fullName.toLowerCase()+'@example.invalid',institution:'Synthetic'});
async function setup(f) {
 const a=(await ok(f.partnershipRpc,TOKENS.owner,'partnerSave',request({individualCode:'STAFFA',expectedRevision:null,profile:profile('Shoshi')}))).partner;
 const b=(await ok(f.partnershipRpc,TOKENS.owner,'partnerSave',request({individualCode:'STAFFB',expectedRevision:null,profile:profile('Einat')}))).partner;
 let s=(await ok(f.rpc,TOKENS.owner,'studyCreate',request({config:{title:'Synthetic same-study privacy'}}))).study;
 for(const code of ['STAFFA','STAFFB']) {const z=await ok(f.rpc,TOKENS.owner,'memberSet',request({studyId:s.id,expectedRevision:s.revision,code,role:'researcher',permissions:['view_study','view_approved_findings','download_approved_findings','comment_on_findings','propose_analysis','view_analysis_results','view_approved_contributions']}));s.revision=z.revision;}
 return {a,b,s};
}
const scope=(s,p,x)=>({studyId:s.id,partnerId:p.id,...(x ? {recordId:x.record.id,versionId:x.version?.id||x.record.headVersionId,expectedRevision:x.record.revision}: {})});
const readScope=(s,p,x,version=true)=>({studyId:s.id,partnerId:p.id,recordId:x.record.id,...(version?{versionId:x.version?.id||x.record.headVersionId}:{})});
async function save(f,s,p,kind,data,credential=TOKENS.a){return ok(f.partnershipRpc,credential,'recordSave',request({...scope(s,p),kind,data,expectedRevision:null}));}
async function submit(f,s,p,x,credential=TOKENS.a){return ok(f.partnershipRpc,credential,'recordSubmit',request(scope(s,p,x)));}
async function review(f,s,p,x,decision,extra={}){return ok(f.partnershipRpc,TOKENS.owner,'recordReview',request({...scope(s,p,x),decision,...extra}));}
async function provenance(f,s,p){
 const consent=randomUUID(),instrument=randomUUID(),snapshot=randomUUID();
 await f.db.query('INSERT INTO research_private.form_versions(id,study_id,kind,definition) VALUES($1,$2,$3,$4),($5,$2,$6,$7)',[consent,s.id,'consent',{title:'Synthetic'},instrument,'instrument',{items:[{id:'q1',type:'number',min:0,max:10},{id:'group',type:'choice',options:['a','b']}]}]);
 for(const id of [consent,instrument])await f.db.query('INSERT INTO research_private.form_publications(study_id,version_id) VALUES($1,$2)',[s.id,id]);
 await f.db.query('UPDATE research_private.studies SET config=config||$1 WHERE id=$2',[{consentVersionId:consent,instrumentVersionIds:[instrument]},s.id]);
 await f.db.query('INSERT INTO research_private.partnership_snapshots(id,study_id,partner_id,consent_version_id,participant_ids,response_ids,variables,source_rows,questionnaire_version_ids) VALUES($1,$2,$3,$4,$5,$5,$6,$7,$8)',[snapshot,s.id,p.id,consent,[],['q1'],[],[instrument]]);
 return {consent,instrument,snapshot};
}
async function analyzed(f,s,p,{operation='descriptive',groupingVariable}={}){
 const pr=await provenance(f,s,p),participants=[],responses=[];
 for(const [group,q1,wave] of [['a',1,'baseline'],['b',5,'baseline'],['a',3,'followup']]){
  const participant=randomUUID(),response=randomUUID();participants.push(participant);responses.push(response);
  await f.db.query("INSERT INTO research_private.participants(id,study_id,actor_ref,status,consent_version_id,consents,verified) VALUES($1,$2,$3,'enrolled',$4,$5,true)",[participant,s.id,'code:'+participant,pr.consent,{participate:true,surveys:true}]);
  await f.db.query('INSERT INTO research_private.responses(id,study_id,participant_id,instrument_version_id,consent_version_id,wave_id,answers,versions,config_revision) VALUES($1,$2,$3,$4,$5,$6,$7,$8,0)',[response,s.id,participant,pr.instrument,pr.consent,wave,{q1,group},{}]);
 }
 let x=await save(f,s,p,'analysis_request',{title:'Approved analysis scope',questions:['Synthetic'],variables:['q1'],requestedOutputs:['mean'],operation,...(groupingVariable?{groupingVariable,comparisons:[groupingVariable],timePoints:['baseline']}:{})});x=await submit(f,s,p,x);x=await review(f,s,p,x,'approved');
 const result=await ok(f.partnershipRpc,TOKENS.owner,'workspaceAnalysis',request({...scope(s,p),requestRecordId:x.record.id,operation}));
 return {...pr,participants,responses,result,analysisRequest:x};
}

test('researcher presets cannot read owner analysis drafts in their own folder, but retain their own proposals',async()=>{
 const f=await createPartnershipDatabase();try{const {a,s}=await setup(f),{result}=await analyzed(f,s,a);
 const doc=(await ok(f.partnershipRpc,TOKENS.owner,'workspaceDocumentPut',request({...scope(s,a),recordId:result.record.id,filename:'private-analysis.txt',mediaType:'text/plain',size:9,sha256:sha('synthetic'),contentCiphertext:cipher}))).document;
 const own=await save(f,s,a,'contribution',{title:'Own proposal remains visible',category:'other',description:'Synthetic'});
 for(const permissions of [CORE.ACCESS_PRESETS.approved_findings,CORE.ACCESS_PRESETS.collaborative_analysis]){
  await f.db.query("UPDATE research_private.memberships SET permissions=$1 WHERE study_id=$2 AND actor_ref='code:STAFFA'",[permissions,s.id]);
  for(const action of ['recordGet','recordVersions','workspaceExport'])assert.equal((await f.partnershipRpc(TOKENS.a,action,{...readScope(s,a,result,action!=='recordVersions'),...(action==='workspaceExport'?{format:'json'}:{})})).error,'not_found',action);
  const ws=(await ok(f.partnershipRpc,TOKENS.a,'workspaceList',{})).workspaces[0];assert.equal(ws.recordCounts.analysis_result,undefined);assert.equal(ws.records.some(r=>r.id===result.record.id),false);
  assert.equal(ws.documents.some(d=>d.id===doc.id),false);assert.equal((await f.partnershipRpc(TOKENS.a,'workspaceDocumentGet',{...scope(s,a),documentId:doc.id})).error,'not_found');
  assert.equal((await ok(f.partnershipRpc,TOKENS.a,'recordGet',readScope(s,a,own))).version.data.title,'Own proposal remains visible');
 }
 let x=await ok(f.partnershipRpc,TOKENS.owner,'recordSave',request({...readScope(s,a,result,false),expectedRevision:result.record.revision,kind:'analysis_result',data:{...result.version.data,privacyReview:'Reviewed',consentReview:'Reviewed'}}));x=await submit(f,s,a,x,TOKENS.owner);x=await review(f,s,a,x,'approved');x=await review(f,s,a,x,'published',{viewerPartnerIds:[a.id],downloadPartnerIds:[]});
 const released=await ok(f.partnershipRpc,TOKENS.a,'recordGet',readScope(s,a,x));assert.equal(released.record.status,'published');assert.equal(released.access.canDownload,false);assert.equal(released.reviews,undefined);assert.equal(released.approvals,undefined);
 assert.equal(released.record.revision,released.version.number);const releasedSummary=(await ok(f.partnershipRpc,TOKENS.a,'workspaceList',{})).workspaces[0].records.find(r=>r.id===x.record.id);assert.equal(releasedSummary.headVersionId,released.version.id);assert.equal(releasedSummary.revision,released.version.number);assert.equal(releasedSummary.status,'published');
 assert.equal((await f.partnershipRpc(TOKENS.a,'workspaceImpact',{...readScope(s,a,x,false),fromVersionId:result.version.id,toVersionId:x.record.headVersionId})).error,'not_found');
 assert.equal((await f.partnershipRpc(TOKENS.a,'recordGet',readScope(s,a,result))).error,'not_found');assert.equal((await ok(f.partnershipRpc,TOKENS.a,'recordVersions',readScope(s,a,x,false))).versions.length,1);
 }finally{await f.close();}
});

test('owner folder counts retain actual researcher attribution without duplicating shared peer records',async()=>{
 const f=await createPartnershipDatabase();try{const {a,b,s}=await setup(f);
 let first=await save(f,s,a,'contribution',{title:'Shoshi actual contribution',category:'other',description:'Synthetic'});const second=await save(f,s,b,'contribution',{title:'Einat actual contribution',category:'other',description:'Synthetic'},TOKENS.b);
 first=await submit(f,s,a,first);first=await review(f,s,a,first,'approved',{viewerPartnerIds:[b.id],downloadPartnerIds:[]});
 const folders=(await ok(f.partnershipRpc,TOKENS.owner,'workspaceList',{studyId:s.id})).workspaces;
 assert.equal(folders.length,2);assert.deepEqual(folders.find(w=>w.partnerId===a.id).records.map(r=>r.id),[first.record.id]);assert.deepEqual(folders.find(w=>w.partnerId===b.id).records.map(r=>r.id),[second.record.id]);
 assert.ok(folders.every(w=>w.recordCounts.contribution===1));assert.equal((await ok(f.partnershipRpc,TOKENS.b,'workspaceList',{studyId:s.id})).workspaces[0].records.length,2);
 }finally{await f.close();}
});

test('current source consent gates stored values, impact, lists and original document bytes for owner and recipient',async()=>{
 for(const cause of ['withdrawal','consent-change','source-deletion']){
 const f=await createPartnershipDatabase();try{const {a,b,s}=await setup(f),pr=await analyzed(f,s,a);
 const doc=await ok(f.partnershipRpc,TOKENS.owner,'workspaceDocumentPut',request({...scope(s,a),recordId:pr.result.record.id,filename:'result.txt',mediaType:'text/plain',size:9,sha256:sha('synthetic'),contentCiphertext:cipher}));
 let x=await ok(f.partnershipRpc,TOKENS.owner,'recordSave',request({...readScope(s,a,pr.result,false),expectedRevision:pr.result.record.revision,kind:'analysis_result',data:{...pr.result.version.data,privacyReview:'Reviewed',consentReview:'Reviewed',resultDocumentIds:[doc.document.id]}}));
 const prior=pr.result.version.id;x=await submit(f,s,a,x,TOKENS.owner);x=await review(f,s,a,x,'approved');x=await review(f,s,a,x,'published',{viewerPartnerIds:[a.id,b.id],downloadPartnerIds:[a.id,b.id]});
 assert.equal((await ok(f.partnershipRpc,TOKENS.b,'recordGet',readScope(s,a,x))).version.data.summary,x.version?.data?.summary||pr.result.version.data.summary);
 if(cause==='withdrawal')await f.db.query("UPDATE research_private.participants SET status='withdrawn' WHERE id=$1",[pr.participants[0]]);
 if(cause==='consent-change')await f.db.query("UPDATE research_private.studies SET config=config||$1 WHERE id=$2",[{consentVersionId:randomUUID()},s.id]);
 if(cause==='source-deletion'){await f.db.exec('ALTER TABLE research_private.responses DISABLE TRIGGER research_frozen');await f.db.query('DELETE FROM research_private.responses WHERE id=$1',[pr.responses[0]]);}
 for(const who of [TOKENS.owner,TOKENS.a,TOKENS.b]){
  assert.equal((await f.partnershipRpc(who,'recordGet',readScope(s,a,x))).error,'not_found',cause+' read');
  assert.equal((await f.partnershipRpc(who,'workspaceDocumentGet',{...scope(s,a),documentId:doc.document.id})).error,'not_found',cause+' document');
  const ws=await ok(f.partnershipRpc,who,'workspaceList',{});assert.equal(ws.workspaces.some(w=>w.records.some(r=>r.id===x.record.id)),false,cause+' list');
 }
 assert.equal((await f.partnershipRpc(TOKENS.owner,'workspaceImpact',{...readScope(s,a,x,false),fromVersionId:prior,toVersionId:x.record.headVersionId})).error,'not_found',cause+' impact');
 assert.equal((await f.db.query('SELECT data FROM research_private.partnership_versions WHERE id=$1',[prior])).rows[0].data.summary,pr.result.version.data.summary);
 }finally{await f.close();}}
});

test('a current replacement head cannot revive original bytes tied to a stale historical source version',async()=>{
 const f=await createPartnershipDatabase();try{const {a,s}=await setup(f),pr=await analyzed(f,s,a),old=pr.result;
 const doc=(await ok(f.partnershipRpc,TOKENS.owner,'workspaceDocumentPut',request({...scope(s,a),recordId:old.record.id,filename:'historical-result.txt',mediaType:'text/plain',size:9,sha256:sha('synthetic'),contentCiphertext:cipher}))).document;
 let x=await ok(f.partnershipRpc,TOKENS.owner,'recordSave',request({...readScope(s,a,old,false),expectedRevision:old.record.revision,kind:'analysis_result',data:{...old.version.data,resultDocumentIds:[doc.id]}}));
 await f.db.query("UPDATE research_private.participants SET status='withdrawn' WHERE id=$1",[pr.participants[0]]);
 const fresh=await ok(f.partnershipRpc,TOKENS.owner,'workspaceAnalysis',request({...scope(s,a),requestRecordId:pr.analysisRequest.record.id,operation:'descriptive'}));assert.equal(fresh.summary.count,2);
 x=await ok(f.partnershipRpc,TOKENS.owner,'recordSave',request({...readScope(s,a,x,false),expectedRevision:x.record.revision,kind:'analysis_result',data:fresh.version.data}));
 assert.equal((await ok(f.partnershipRpc,TOKENS.owner,'recordGet',readScope(s,a,x))).version.id,x.version.id);
 assert.equal((await f.partnershipRpc(TOKENS.owner,'workspaceDocumentGet',{...scope(s,a),documentId:doc.id})).error,'not_found');
 assert.equal((await ok(f.partnershipRpc,TOKENS.owner,'workspaceList',{studyId:s.id,partnerId:a.id})).workspaces[0].documents.some(d=>d.id===doc.id),false);
 assert.equal((await f.db.query('SELECT data FROM research_private.partnership_versions WHERE id=$1',[old.version.id])).rows[0].data.summary,old.version.data.summary);
 }finally{await f.close();}
});

test('released findings, contributions and analysis attachments require their kind view permission and independent byte download rights',async()=>{
 const f=await createPartnershipDatabase();try{const {a,b,s}=await setup(f),pr=await analyzed(f,s,a);
 for(const kind of ['finding','contribution','analysis_result']){
  await f.db.query("UPDATE research_private.memberships SET permissions=$1 WHERE study_id=$2 AND actor_ref='code:STAFFB'",[['view_study','view_approved_findings','view_analysis_results','view_approved_contributions','download_approved_findings'],s.id]);
  let data=kind==='finding'?{title:'Finding attachment',summary:'Aggregate',evidence:'Synthetic',sourceSnapshotId:pr.result.sourceSnapshotId,method:'Descriptive',analysisVersion:'1',toolVersion:'1',questionnaireVersionIds:[pr.instrument],consentProtocolVersionId:pr.consent,privacyReview:'Reviewed',consentReview:'Reviewed'}:kind==='contribution'?{title:'Contribution attachment',category:'other',description:'Synthetic'}:{...pr.result.version.data,title:'Analysis attachment',privacyReview:'Reviewed',consentReview:'Reviewed'};
  let x=await save(f,s,a,kind,data,kind==='analysis_result'?TOKENS.owner:TOKENS.a);
  const doc=await ok(f.partnershipRpc,TOKENS.owner,'workspaceDocumentPut',request({...scope(s,a),recordId:x.record.id,filename:kind+'.txt',mediaType:'text/plain',size:9,sha256:sha('synthetic'),contentCiphertext:cipher}));
  data={...data,[kind==='analysis_result'?'resultDocumentIds':'supportingDocumentIds']:[doc.document.id]};
  x=await ok(f.partnershipRpc,TOKENS.owner,'recordSave',request({...readScope(s,a,x,false),expectedRevision:x.record.revision,kind,data}));x=await submit(f,s,a,x,TOKENS.owner);x=await review(f,s,a,x,'approved',kind==='contribution'?{viewerPartnerIds:[b.id],downloadPartnerIds:[]}:{});
  if(kind==='finding')x=await ok(f.partnershipRpc,TOKENS.owner,'findingPublish',request({...scope(s,a,x),viewerPartnerIds:[b.id],downloadPartnerIds:[]}));
  if(kind==='analysis_result')x=await review(f,s,a,x,'published',{viewerPartnerIds:[b.id],downloadPartnerIds:[]});
  const permission=kind==='analysis_result'?'view_analysis_results':kind==='contribution'?'view_approved_contributions':'view_approved_findings';
  await f.db.query("UPDATE research_private.memberships SET permissions=$1 WHERE study_id=$2 AND actor_ref='code:STAFFB'",[['view_study',permission,'download_approved_findings'],s.id]);
  for(const extra of [{},{download:false},{download:true}])assert.equal((await f.partnershipRpc(TOKENS.b,'workspaceDocumentGet',{...scope(s,a),documentId:doc.document.id,...extra})).error,'not_found',kind+' '+JSON.stringify(extra));
  await f.db.query('UPDATE research_private.partnership_publications SET download_partner_ids=$1 WHERE record_id=$2',[[b.id],x.record.id]);
  for(const extra of [{},{download:false},{download:true}])assert.deepEqual((await ok(f.partnershipRpc,TOKENS.b,'workspaceDocumentGet',{...scope(s,a),documentId:doc.document.id,...extra})).contentCiphertext,cipher,kind);
  await f.db.query("UPDATE research_private.memberships SET permissions=$1 WHERE study_id=$2 AND actor_ref='code:STAFFB'",[['view_study',permission],s.id]);assert.equal((await f.partnershipRpc(TOKENS.b,'workspaceDocumentGet',{...scope(s,a),documentId:doc.document.id})).error,'not_found',kind+' revoked download permission');
  await f.db.query("UPDATE research_private.memberships SET permissions=$1 WHERE study_id=$2 AND actor_ref='code:STAFFB'",[['view_study','download_approved_findings'],s.id]);assert.equal((await f.partnershipRpc(TOKENS.b,'workspaceDocumentGet',{...scope(s,a),documentId:doc.document.id})).error,'not_found',kind+' revoked view permission');
  await f.db.query('UPDATE research_private.partnership_publications SET withdrawn_at=CURRENT_TIMESTAMP WHERE record_id=$1',[x.record.id]);assert.equal((await f.partnershipRpc(TOKENS.b,'workspaceDocumentGet',{...scope(s,a),documentId:doc.document.id})).error,'not_found');
 }
 }finally{await f.close();}
});

test('same researcher cannot transplant document, snapshot or agreement version references across studies',async()=>{
 const f=await createPartnershipDatabase();try{const {a,s}=await setup(f),pr=await provenance(f,s,a);let other=(await ok(f.rpc,TOKENS.owner,'studyCreate',request({config:{title:'Other study same researcher'}}))).study;
 other.revision=(await ok(f.rpc,TOKENS.owner,'memberSet',request({studyId:other.id,expectedRevision:other.revision,code:'STAFFA',role:'researcher'}))).revision;
 const doc=(await ok(f.partnershipRpc,TOKENS.a,'workspaceDocumentPut',request({...scope(s,a),filename:'private.txt',mediaType:'text/plain',size:9,sha256:sha('synthetic'),contentCiphertext:cipher}))).document;
 const agreement=await save(f,s,a,'agreement',{title:'Other scope agreement'});
 const cases=[['contribution',{title:'Wrong doc',category:'other',description:'Synthetic',supportingDocumentIds:[doc.id]}],['finding',{title:'Wrong snapshot',sourceSnapshotId:pr.snapshot}],['agreement',{title:'Wrong version',amendsAgreementVersionId:agreement.version.id}]];
 for(const [kind,data]of cases)assert.equal((await f.partnershipRpc(TOKENS.a,'recordSave',request({...scope(other,a),kind,data,expectedRevision:null}))).error,'not_found',kind);
 }finally{await f.close();}
});

test('approved cohort comparison separates same-wave cohorts and trend keeps wave groups',async()=>{
 const f=await createPartnershipDatabase();try{const {a,s}=await setup(f);const pr=await analyzed(f,s,a,{operation:'comparison',groupingVariable:'group'});
 const groups=pr.result.summary.results;assert.deepEqual(groups.map(g=>g.group).sort(),['a','b']);assert.equal(groups.find(g=>g.group==='a').mean,1);assert.equal(groups.find(g=>g.group==='b').mean,5);assert.equal(pr.result.summary.count,2);assert.equal(pr.result.summary.groupingVariable,'group');assert.equal(pr.result.provenance.analysisVersion,'1.1.0');
 const snapshot=(await f.db.query('SELECT variables FROM research_private.partnership_snapshots WHERE id=$1',[pr.result.sourceSnapshotId])).rows[0];assert.ok(snapshot.variables.includes('group'));
 let trend=await save(f,s,a,'analysis_request',{title:'Wave trend',questions:['Synthetic'],variables:['q1'],requestedOutputs:['mean'],operation:'trend'});trend=await submit(f,s,a,trend);trend=await review(f,s,a,trend,'approved');const out=await ok(f.partnershipRpc,TOKENS.owner,'workspaceAnalysis',request({...scope(s,a),requestRecordId:trend.record.id,operation:'trend'}));assert.equal(out.summary.results.find(g=>g.group==='baseline').mean,3);assert.equal(out.summary.results.find(g=>g.group==='followup').mean,3);
 assert.equal((await f.partnershipRpc(TOKENS.a,'recordSave',request({...scope(s,a),kind:'analysis_request',expectedRevision:null,data:{title:'Unapproved grouping',questions:['Synthetic'],variables:['q1'],groupingVariable:'privateText',operation:'comparison'}}))).error,'invalid');
 }finally{await f.close();}
});
test('partner profiles infer self identity and private immutable record versions use canonical hashes', async () => {
  const f = await createPartnershipDatabase();
  try {
    const p = await ok(f.partnershipRpc, TOKENS.a, 'partnerSave', request({expectedRevision:null, profile:{fullName:'Shoshi',email:'shoshi@example.invalid',institution:'Synthetic'}}));
    assert.equal(p.partner.profile.fullName, 'Shoshi');
    assert.equal(JSON.stringify(p).includes('STAFFA'), false);
    assert.equal((await f.partnershipRpc(TOKENS.b, 'partnerGet', {partnerId:p.partner.id})).error, 'not_found');
    const contract=(await f.db.query('SELECT research_private.partnership_contract() c')).rows[0].c;
    assert.deepEqual(contract.schemas,CORE.RECORD_SCHEMAS);assert.deepEqual(contract.operations,CORE.OPERATIONS);
  } finally { await f.close(); }
});

test('SQL profile and complete application validation matches individual, institution and legacy conditional requirements', async () => {
 const f=await createPartnershipDatabase();try{
  const contract=(await f.db.query('SELECT research_private.partnership_contract() c')).rows[0].c;
  assert.deepEqual(contract.partner,CORE.PARTNER_FIELDS);
  assert.deepEqual(contract.schemas.application,CORE.RECORD_SCHEMAS.application);
  const individual={applicantType:'individual',fullName:'Synthetic Individual',email:'individual@example.invalid'};
  const created=await ok(f.partnershipRpc,TOKENS.a,'partnerSave',request({expectedRevision:null,profile:individual}));
  assert.deepEqual(created.partner.profile,individual);
  assert.deepEqual(contract.versions,CORE.VERSIONS);
  await f.db.query("SELECT research_private.partnership_fields(research_private.partnership_contract()->'partner',$1::jsonb,NULL,NULL,true)",[individual]);
  for(const applicantType of ['institution',undefined]){
   const profile={...individual};if(applicantType)profile.applicantType=applicantType;else delete profile.applicantType;
   await assert.rejects(f.db.query("SELECT research_private.partnership_fields(research_private.partnership_contract()->'partner',$1::jsonb,NULL,NULL,true)",[profile]),error=>error.message==='invalid');
   await f.db.query("SELECT research_private.partnership_fields(research_private.partnership_contract()->'partner',$1::jsonb,NULL,NULL,true)",[{...profile,institution:'Synthetic'}]);
  }
  const complete={...individual,title:'Synthetic proposal',applicationType:'partnership',objectives:'Synthetic',researchQuestions:['Synthetic?'],method:'Synthetic',population:'Synthetic',requestedTools:['communication'],startDate:'2026-11-01',endDate:'2026-12-01',ethicsStatus:'pending',ethicsDetails:'Synthetic',consentPlan:'Synthetic',requestedPermissions:['view_study']};
  await f.db.query("SELECT research_private.partnership_validate('application',$1::jsonb,NULL,NULL,true)",[complete]);
  for(const applicantType of ['institution',undefined]){
   const data={...complete};if(applicantType)data.applicantType=applicantType;else delete data.applicantType;
   await assert.rejects(f.db.query("SELECT research_private.partnership_validate('application',$1::jsonb,NULL,NULL,true)",[data]),error=>error.message==='invalid');
   await f.db.query("SELECT research_private.partnership_validate('application',$1::jsonb,NULL,NULL,true)",[{...data,institution:'Synthetic'}]);
  }
  await assert.rejects(f.db.query("SELECT research_private.partnership_validate('application',$1::jsonb,NULL,NULL,true)",[{...complete,owner:true}]),error=>error.message==='invalid');
 }finally{await f.close();}
});

test('same-study researchers cannot discover folders, metadata, counts, nested references or history; CAS and receipts are exact',async()=>{
 const f=await createPartnershipDatabase();try{
 const {a,b,s}=await setup(f),data={title:'Private Shoshi proposal',category:'scientific',description:'Synthetic requested work',requestedCompensation:'125.25',currency:'ILS'};
 const req=request({...scope(s,a),kind:'contribution',data,expectedRevision:null});const x=await ok(f.partnershipRpc,TOKENS.a,'recordSave',req);
 assert.equal(x.version.contentHash,sha(JSON.stringify(Object.fromEntries(Object.entries(data).sort(([a],[b])=>a.localeCompare(b))))));
 assert.deepEqual(await f.partnershipRpc(TOKENS.a,'recordSave',req),x);
 assert.equal((await f.partnershipRpc(TOKENS.a,'recordSave',{...req,data:{...data,title:'Changed'}})).error,'conflict');
 for(const action of ['recordGet','recordVersions','workspaceExport'])assert.equal((await f.partnershipRpc(TOKENS.b,action,{...readScope(s,a,x,action!=='recordVersions'),...(action==='workspaceExport'?{format:'json'}:{})})).error,'not_found');
 const list=await ok(f.partnershipRpc,TOKENS.b,'workspaceList',{});assert.equal(list.workspaces.length,1);assert.equal(list.workspaces[0].partnerId,b.id);assert.equal(list.workspaces[0].records.length,0);assert.equal(list.workspaces[0].recordCounts.contribution,undefined);
 assert.equal((await f.partnershipRpc(TOKENS.b,'workspaceList',{partnerId:a.id})).error,'not_found');
 const d=await ok(f.partnershipRpc,TOKENS.a,'workspaceDocumentPut',request({...scope(s,a),filename:'synthetic.txt',mediaType:'text/plain',size:9,sha256:sha('synthetic'),contentCiphertext:cipher}));
 assert.equal((await f.partnershipRpc(TOKENS.b,'workspaceDocumentGet',{...scope(s,a),documentId:d.document.id})).error,'not_found');
 assert.equal((await f.partnershipRpc(TOKENS.b,'recordSave',request({...scope(s,b),kind:'contribution',expectedRevision:null,data:{title:'Wrong ref',category:'other',description:'Test',supportingDocumentIds:[d.document.id]}}))).error,'not_found');
 assert.equal((await f.partnershipRpc(TOKENS.a,'recordSave',request({...scope(s,a),kind:'contribution',expectedRevision:null,data:{...data,providerVerification:'verified'}}))).error,'invalid');
 const y=await ok(f.partnershipRpc,TOKENS.owner,'recordSave',request({...readScope(s,a,x,false),expectedRevision:x.record.revision,kind:'contribution',data:{...data,title:'Owner counterproposal'}}));assert.equal(y.version.proposedBy,'owner');assert.equal(y.record.status,'draft');
 assert.equal((await f.partnershipRpc(TOKENS.a,'recordSubmit',request(scope(s,a,x)))).error,'conflict');
 assert.equal((await ok(f.partnershipRpc,TOKENS.a,'recordVersions',readScope(s,a,y,false))).versions.length,2);
 await assert.rejects(f.db.query('UPDATE research_private.partnership_versions SET data=$1',[{}]),/immutable/);
 }finally{await f.close();}
});

test('contribution review preserves requested and agreed terms without creating binding money',async()=>{
 const f=await createPartnershipDatabase();try{const {a,s}=await setup(f);let x=await save(f,s,a,'contribution',{title:'Synthetic funding',category:'funding',description:'Proposal',requestedCompensation:'500.00',currency:'ILS',requestedIP:'Proposed licence'});x=await submit(f,s,a,x);const r=await review(f,s,a,x,'approved',{approvedTerms:{compensation:'250.00',currency:'ILS',ip:'Owner reviewed proposal'}});
 assert.equal(r.record.binding,false);assert.equal(r.review.approvedTerms.compensation,'250.00');const read=await ok(f.partnershipRpc,TOKENS.a,'recordGet',readScope(s,a,r));assert.equal(read.version.data.requestedCompensation,'500.00');assert.equal(read.version.data.requestedIP,'Proposed licence');
 assert.equal((await f.partnershipRpc(TOKENS.owner,'recordReview',request({...scope(s,a,r),decision:'executed'}))).error,'invalid');
 assert.equal((await f.partnershipRpc(TOKENS.a,'recordSave',request({...scope(s,a),kind:'budget',expectedRevision:null,data:{title:'Owner only'}}))).error,'not_found');
 assert.equal((await f.partnershipRpc(TOKENS.owner,'recordSave',request({...scope(s,a),kind:'budget',expectedRevision:null,data:{title:'Nested invalid',items:[{description:'Fee',amount:'1.00',party:'owner',authority:'owner'}]}}))).error,'invalid');
 }finally{await f.close();}
});

test('published findings release one approved version with independent download and withdrawal revocation',async()=>{
 const f=await createPartnershipDatabase();try{const {a,b,s}=await setup(f);const pr=await provenance(f,s,a);let x=await save(f,s,a,'finding',{title:'Private synthetic finding',summary:'Aggregate only',evidence:'Synthetic',sourceSnapshotId:pr.snapshot,method:'Descriptive',analysisVersion:'1',toolVersion:'1',questionnaireVersionIds:[pr.instrument],consentProtocolVersionId:pr.consent,privacyReview:'Owner review',consentReview:'Owner review'});x=await submit(f,s,a,x);x=await review(f,s,a,x,'approved');
 assert.equal((await f.partnershipRpc(TOKENS.b,'recordGet',readScope(s,a,x))).error,'not_found');
 const pub=await ok(f.partnershipRpc,TOKENS.owner,'findingPublish',request({...scope(s,a,x),viewerPartnerIds:[b.id],downloadPartnerIds:[]}));
 const read=await ok(f.partnershipRpc,TOKENS.b,'recordGet',readScope(s,a,pub));assert.equal(read.version.data.summary,'Aggregate only');assert.equal(read.access.canDownload,false);assert.equal(read.access.canComment,true);assert.equal(read.reviews,undefined);assert.equal((await ok(f.partnershipRpc,TOKENS.b,'recordVersions',readScope(s,a,pub,false))).versions.length,1);
 const shared=(await ok(f.partnershipRpc,TOKENS.b,'workspaceList',{})).workspaces[0];assert.equal(shared.partnerId,b.id);assert.equal(shared.records.length,1);assert.equal(shared.records[0].partnerId,a.id);assert.equal(shared.documents.length,0);assert.equal(shared.snapshots.length,0);assert.equal(shared.partnerName,'Einat');
 assert.equal((await f.partnershipRpc(TOKENS.b,'workspaceExport',{...readScope(s,a,pub),format:'json'})).error,'not_found');
 const comment=await ok(f.partnershipRpc,TOKENS.b,'findingComment',request({...readScope(s,a,pub),text:'Synthetic comment'}));assert.equal(comment.comment.versionId,pub.record.publishedVersionId);
 const withdrawn=await ok(f.partnershipRpc,TOKENS.owner,'findingWithdraw',request({...scope(s,a,pub),reason:'Owner withdrew synthetic release'}));assert.equal(withdrawn.record.status,'withdrawn');assert.equal((await f.partnershipRpc(TOKENS.b,'recordGet',readScope(s,a,pub))).error,'not_found');
 }finally{await f.close();}
});

test('private documents are encrypted only, retry by byte hash, and direct browser/service tables stay denied',async()=>{
 const f=await createPartnershipDatabase();try{const {a,s}=await setup(f);const req=request({...scope(s,a),filename:'synthetic.txt',mediaType:'text/plain',size:9,sha256:sha('synthetic'),contentCiphertext:cipher});const d=await ok(f.partnershipRpc,TOKENS.a,'workspaceDocumentPut',req);assert.deepEqual(await f.partnershipRpc(TOKENS.a,'workspaceDocumentPut',{...req,contentCiphertext:{...cipher,iv:'BBBBBBBBBBBBBBBB'}}),d);assert.equal((await f.partnershipRpc(TOKENS.a,'workspaceDocumentPut',{...req,sha256:sha('changed')})).error,'conflict');
 assert.equal((await f.partnershipRpc(TOKENS.a,'workspaceDocumentPut',request({...scope(s,a),filename:'raw.txt',mediaType:'text/plain',contentBase64:'cGxhaW4='}))).error,'invalid');
 const read=await ok(f.partnershipRpc,TOKENS.a,'workspaceDocumentGet',{...scope(s,a),documentId:d.document.id});assert.deepEqual(read.contentCiphertext,cipher);
 for(const role of ['anon','authenticated','service_role']){await f.db.exec('SET ROLE '+role);await assert.rejects(f.db.query('SELECT * FROM research_private.partnership_documents'),/permission denied/);await f.db.exec('RESET ROLE');}
 await f.db.exec('SET ROLE research_worker');assert.equal((await f.db.query('SELECT count(*)::int n FROM research_private.partnership_documents')).rows[0].n,0);await f.db.exec('RESET ROLE');
 }finally{await f.close();}
});

test('individual invitations are bound single-use, expire/revoke, and defaults preserve existing explicit grants',async()=>{
 const f=await createPartnershipDatabase();try{const {a,b,s}=await setup(f);const digest=sha('synthetic-invite');const inv=await ok(f.partnershipRpc,TOKENS.owner,'partnerInviteCreate',request({...scope(s,a),preset:'approved_findings',inviteDigest:digest}));assert.deepEqual(inv.invitation.permissions,['view_study','view_approved_findings']);assert.equal((await f.partnershipRpc(TOKENS.b,'partnerInviteGet',{inviteDigest:digest})).error,'not_found');assert.equal((await ok(f.partnershipRpc,TOKENS.a,'partnerInviteGet',{inviteDigest:digest})).invitation.partnerId,a.id);
 const accept=request({inviteDigest:digest});const accepted=await ok(f.partnershipRpc,TOKENS.a,'partnerInviteAccept',accept);assert.equal(accepted.partner.id,a.id);assert.deepEqual(await f.partnershipRpc(TOKENS.a,'partnerInviteAccept',accept),accepted);assert.equal((await f.partnershipRpc(TOKENS.a,'partnerInviteAccept',request({inviteDigest:digest}))).error,'conflict');
 const membership=(await f.db.query('SELECT permissions FROM research_private.memberships WHERE study_id=$1 AND actor_ref=$2',[s.id,'code:STAFFA'])).rows[0];assert.ok(membership.permissions.includes('comment_on_findings'));
 const revoked=await ok(f.partnershipRpc,TOKENS.owner,'partnerInviteCreate',request({...scope(s,b),preset:'approved_findings',inviteDigest:sha('revoke')}));await ok(f.partnershipRpc,TOKENS.owner,'partnerInviteRevoke',request({...scope(s,b),invitationId:revoked.invitation.id,expectedRevision:0}));assert.equal((await f.partnershipRpc(TOKENS.b,'partnerInviteGet',{inviteDigest:sha('revoke')})).error,'not_found');
 }finally{await f.close();}
});

async function approvedAgreement(f,s,a){
 let template=await save(f,s,a,'agreement_template',{title:'Synthetic supplied template',templateVersion:'test-1',explanationVersion:'test-1',sectionClauses:CORE.AGREEMENT_SECTIONS.map(section=>({sectionId:section.id,text:'Synthetic supplied clause '+section.id})),ipExplanation:'Synthetic supplied explanation',mutualIPClause:'Synthetic supplied mutual clause',requiredFieldIds:[]},TOKENS.owner);
 template=await review(f,s,a,template,'approved');
 let x=await save(f,s,a,'agreement',{title:'Synthetic agreement',ownerName:'Owner',ownerEmail:'owner@example.invalid',ownerSignatory:'Owner',ownerAuthority:'Synthetic owner authority',partnerName:'Shoshi',partnerEmail:a.profile.email,partnerSignatory:'Shoshi',partnerAuthority:'Synthetic partner authority',studyTitle:'Synthetic study',purpose:'Synthetic purpose',effectiveDate:'2026-01-01',templateVersionId:template.record.headVersionId,ipExplanationVersionId:template.record.headVersionId,sharedExpenses:[{description:'Synthetic expense',amount:'25.00',party:'shared',dueDate:'2028-01-01'}],currency:'ILS'});
 x=await submit(f,s,a,x);x=await review(f,s,a,x,'approved');
 let read=await ok(f.partnershipRpc,TOKENS.owner,'recordGet',readScope(s,a,x));
 for(const who of [TOKENS.owner,TOKENS.a]) x=await ok(f.partnershipRpc,who,'agreementApprove',request({...scope(s,a,x),documentHash:read.version.contentHash,ipExplanationVersionId:template.record.headVersionId,ipReadAcknowledged:true}));
 return {x,read,template};
}

test('mutual approvals bind canonical head and revision invalidates them; worker signing is distinct from browser and mail',async()=>{
 const f=await createPartnershipDatabase();try{const {a,s}=await setup(f);let {x,read}=await approvedAgreement(f,s,a);
 const preflight=await ok(f.partnershipRpc,TOKENS.owner,'signingStart',request({...scope(s,a,x),documentHash:read.version.contentHash,consent:true}));assert.equal(preflight.signing,null);assert.equal(preflight.record.status,'approved');
 for(const who of [TOKENS.owner,TOKENS.a,TOKENS.worker])assert.equal((await f.partnershipRpc(who,'signatureComplete',{...readScope(s,a,x),signingId:randomUUID()})).error,'unauthorized');
 const changed=await ok(f.partnershipRpc,TOKENS.owner,'recordSave',request({...readScope(s,a,x,false),expectedRevision:x.record.revision,kind:'agreement',data:{...read.version.data,purpose:'New counterproposal'}}));assert.equal(changed.record.status,'draft');assert.equal(changed.record.approvedVersionId,null);
 const worker=token({k:'research_signing_worker',purpose:'research-signing',exp:Date.now()+300000});assert.equal((await f.partnershipRpc(worker,'signingPrepare',request({...scope(s,a,changed),documentHash:read.version.contentHash,providerSessionId:'synthetic',expiresAt:new Date(Date.now()+3600000).toISOString(),providerStateCiphertext:cipher,providerDocumentHash:sha('synthetic-provider-bytes'),authorityPolicyHash:sha('synthetic')}))).error,'conflict');
 const unsigned=await save(f,s,a,'agreement',{title:'Unsigned synthetic'});assert.equal((await f.partnershipRpc(TOKENS.owner,'recordSave',request({...scope(s,a),kind:'obligation',expectedRevision:null,data:{title:'Cannot bind unsigned',sourceAgreementId:unsigned.record.id,sourceAgreementVersionId:unsigned.version.id,clauseReference:'x',party:'owner',description:'No signature'}}))).error,'not_found');
 }finally{await f.close();}
});

test('trusted execution keeps evidence immutable, extracts reviewable obligations and rejects unilateral term edits',async()=>{
 const f=await createPartnershipDatabase();try{const {a,s}=await setup(f);const {x,read}=await approvedAgreement(f,s,a);const worker=token({k:'research_signing_worker',purpose:'research-signing',exp:Date.now()+300000});
 const prep=await ok(f.partnershipRpc,worker,'signingPrepare',request({...scope(s,a,x),documentHash:read.version.contentHash,providerSessionId:'synthetic-provider-session',expiresAt:new Date(Date.now()+3600000).toISOString(),providerStateCiphertext:cipher,providerDocumentHash:sha('synthetic-provider-bytes'),authorityPolicyHash:sha('synthetic-authority-policy')}));assert.equal(prep.record.status,'signing');
 const poll=request({...readScope(s,a,prep,false),signingId:prep.signing.id,expectedRevision:prep.record.revision});assert.equal((await ok(f.partnershipRpc,TOKENS.owner,'signingRefresh',poll)).providerCheckDue,true);assert.equal((await ok(f.partnershipRpc,TOKENS.owner,'signingRefresh',poll)).providerCheckDue,true);
 const state=await ok(f.partnershipRpc,worker,'signingStateUpdate',{...readScope(s,a,prep,false),signingId:prep.signing.id,state:'in_progress'});assert.equal(state.signing.state,'in_progress');assert.equal((await ok(f.partnershipRpc,TOKENS.owner,'signingRefresh',poll)).providerCheckDue,false);assert.equal((await ok(f.partnershipRpc,TOKENS.owner,'signingRefresh',{...poll,requestId:randomUUID()})).providerCheckDue,false);assert.equal((await f.partnershipRpc(token({k:'research_signing_worker',exp:Date.now()+300000}),'signingEventContext',{providerSessionId:'synthetic-provider-session'})).error,'unauthorized');
 const ctx=await ok(f.partnershipRpc,worker,'signingEventContext',{providerSessionId:'synthetic-provider-session'});assert.equal(ctx.recordId,x.record.id);
 const docs={};for(const purpose of ['final','certificate']) docs[purpose]=(await ok(f.partnershipRpc,worker,'signingEvidencePut',{...readScope(s,a,prep,false),signingId:prep.signing.id,purpose,filename:purpose+'.pdf',mediaType:'application/pdf',size:9,sha256:sha(purpose),contentCiphertext:cipher})).document;
 const now=new Date().toISOString();const done=await ok(f.partnershipRpc,worker,'signatureComplete',{...readScope(s,a,prep),signingId:prep.signing.id,documentHash:read.version.contentHash,providerEventId:'synthetic-event',finalDocumentId:docs.final.id,finalDocumentHash:docs.final.sha256,auditCertificateDocumentId:docs.certificate.id,verifiedSigners:[{party:'owner',email:'owner@example.invalid',name:'Owner',authority:'Synthetic owner authority',recipientId:'synthetic-owner',identityVerified:true,consent:true,signedAt:now},{party:'partner',email:a.profile.email,name:'Shoshi',authority:'Synthetic partner authority',recipientId:'synthetic-partner',identityVerified:true,consent:true,signedAt:now}],completedAt:now});assert.equal(done.record.status,'executed');assert.equal(done.record.binding,true);
 assert.equal((await f.partnershipRpc(TOKENS.owner,'recordSave',request({...readScope(s,a,done,false),expectedRevision:done.record.revision,kind:'agreement',data:read.version.data}))).error,'conflict');
 const ws=(await ok(f.partnershipRpc,TOKENS.owner,'workspaceList',{studyId:s.id,partnerId:a.id})).workspaces[0];const obligation=ws.records.find(r=>r.kind==='obligation');assert.ok(obligation);assert.equal(obligation.status,'draft');let o=await ok(f.partnershipRpc,TOKENS.owner,'recordGet',{studyId:s.id,partnerId:a.id,recordId:obligation.id});assert.equal(o.record.binding,false);assert.equal(o.version.data.amount,'25.00');o=await submit(f,s,a,o,TOKENS.owner);o=await review(f,s,a,o,'approved');assert.equal(o.record.binding,true);assert.equal(CORE.isBindingObligation(o.record),true);
 const old=await ok(f.partnershipRpc,TOKENS.owner,'recordGet',readScope(s,a,o));assert.equal((await f.partnershipRpc(TOKENS.owner,'recordSave',request({...readScope(s,a,o,false),expectedRevision:o.record.revision,kind:'obligation',data:{...old.version.data,amount:'26.00'}}))).error,'conflict');assert.equal((await f.partnershipRpc(TOKENS.owner,'recordReview',request({...scope(s,a,o),decision:'cancelled'}))).error,'not_found');
 await assert.rejects(f.db.query('UPDATE research_private.partnership_executions SET document_hash=$1',[sha('tamper')]),/immutable/);
 }finally{await f.close();}
});

test('revoked researchers lose access while owner history and verified existing signing evidence remain available',async()=>{
 const f=await createPartnershipDatabase();try{
  const {a,s}=await setup(f);await provenance(f,s,a);
  await f.db.query("UPDATE research_private.studies SET status='active',config=config||$1 WHERE id=$2",[{approvals:{status:'approved'}},s.id]);
  const {x,read}=await approvedAgreement(f,s,a),worker=token({k:'research_signing_worker',purpose:'research-signing',exp:Date.now()+300000});
  const prep=await ok(f.partnershipRpc,worker,'signingPrepare',request({...scope(s,a,x),documentHash:read.version.contentHash,providerSessionId:'retained-synthetic-session',expiresAt:new Date(Date.now()+3600000).toISOString(),providerStateCiphertext:cipher,providerDocumentHash:sha('synthetic-provider-bytes'),authorityPolicyHash:sha('synthetic-authority-policy')}));
  await f.db.query("UPDATE public.access_settings SET value=jsonb_set(value,'{revoked}','true') WHERE key='code:STAFFA'");
  assert.equal((await ok(f.partnershipRpc,TOKENS.owner,'recordGet',readScope(s,a,prep))).record.id,x.record.id);
  assert.ok((await ok(f.partnershipRpc,TOKENS.owner,'partnerGet',{partnerId:a.id})).workspaces.some(w=>w.studyId===s.id));
  assert.ok((await f.partnershipRpc(TOKENS.a,'recordGet',readScope(s,a,prep))).error);
  for(const who of [TOKENS.a,TOKENS.owner])assert.ok((await f.partnershipRpc(who,'signingView',{...readScope(s,a,prep,false),signingId:prep.signing.id})).error);
  assert.ok((await f.partnershipRpc(worker,'signingPrepare',request({...scope(s,a,prep),documentHash:read.version.contentHash,providerSessionId:'forbidden-new-session'}))).error);
  const ctx=await ok(f.partnershipRpc,worker,'signingEventContext',{providerSessionId:'retained-synthetic-session'});assert.equal(ctx.recordId,x.record.id);
  assert.equal((await f.partnershipRpc(worker,'signingEventContext',{providerSessionId:'untracked-session'})).error,'not_found');
  await ok(f.partnershipRpc,worker,'signingStateUpdate',{...readScope(s,a,prep,false),signingId:prep.signing.id,state:'in_progress'});
  const docs={};for(const purpose of ['final','certificate'])docs[purpose]=(await ok(f.partnershipRpc,worker,'signingEvidencePut',{...readScope(s,a,prep,false),signingId:prep.signing.id,purpose,filename:purpose+'.pdf',mediaType:'application/pdf',size:9,sha256:sha(purpose),contentCiphertext:cipher})).document;
  const now=new Date().toISOString(),done=await ok(f.partnershipRpc,worker,'signatureComplete',{...readScope(s,a,prep),signingId:prep.signing.id,documentHash:read.version.contentHash,providerEventId:'retained-event',finalDocumentId:docs.final.id,finalDocumentHash:docs.final.sha256,auditCertificateDocumentId:docs.certificate.id,verifiedSigners:[{party:'owner',email:'owner@example.invalid',name:'Owner',authority:'Synthetic owner authority',recipientId:'synthetic-owner',identityVerified:true,consent:true,signedAt:now},{party:'partner',email:a.profile.email,name:'Shoshi',authority:'Synthetic partner authority',recipientId:'synthetic-partner',identityVerified:true,consent:true,signedAt:now}],completedAt:now});
  assert.equal(done.record.status,'executed');
  const workspace=async()=> (await ok(f.partnershipRpc,TOKENS.owner,'workspaceList',{studyId:s.id,partnerId:a.id})).workspaces[0];
  assert.equal((await workspace()).partnershipActive,false,'inactive identity cannot activate the partnership');
  await f.db.query("UPDATE public.access_settings SET value=jsonb_set(value,'{revoked}','false') WHERE key='code:STAFFA'");
  assert.equal((await workspace()).partnershipActive,true);
  await f.db.query("DELETE FROM research_private.memberships WHERE study_id=$1 AND actor_ref='code:STAFFA'",[s.id]);
  const retained=await workspace();assert.equal(retained.partnershipActive,false,'missing membership cannot activate the partnership');
  assert.equal((await ok(f.partnershipRpc,TOKENS.owner,'recordVersions',readScope(s,a,done,false))).versions.length,1);
  assert.equal((await ok(f.partnershipRpc,TOKENS.owner,'workspaceDocumentGet',{...scope(s,a),documentId:docs.final.id})).document.id,docs.final.id);
  assert.equal((await f.partnershipRpc(TOKENS.a,'workspaceDocumentGet',{...scope(s,a),documentId:docs.final.id})).error,'not_found');
  let obligation=await ok(f.partnershipRpc,TOKENS.owner,'recordGet',{...scope(s,a),recordId:retained.records.find(r=>r.kind==='obligation').id});
  obligation=await submit(f,s,a,obligation,TOKENS.owner);obligation=await review(f,s,a,obligation,'approved');obligation=await review(f,s,a,obligation,'completed');
  assert.equal(obligation.record.status,'completed');assert.equal(obligation.record.binding,true);
  assert.equal((await f.partnershipRpc(TOKENS.owner,'recordSave',request({...readScope(s,a,done,false),expectedRevision:done.record.revision,kind:'agreement',data:read.version.data}))).error,'conflict');
 }finally{await f.close();}
});

test('analysis creates only consent-bound row-id snapshots, stale consent and revocation stop use and receipt replay',async()=>{
 const f=await createPartnershipDatabase();try{const {a,b,s}=await setup(f);const pr=await provenance(f,s,a);const participant=randomUUID(),response=randomUUID();await f.db.query("INSERT INTO research_private.participants(id,study_id,actor_ref,status,consent_version_id,consents,verified) VALUES($1,$2,'code:PERSON1','enrolled',$3,$4,true)",[participant,s.id,pr.consent,{participate:true,surveys:true}]);await f.db.query('INSERT INTO research_private.responses(id,study_id,participant_id,instrument_version_id,consent_version_id,wave_id,answers,versions,config_revision) VALUES($1,$2,$3,$4,$5,$6,$7,$8,0)',[response,s.id,participant,pr.instrument,pr.consent,'baseline',{q1:3,privateText:'Never snapshot'},{}]);let x=await save(f,s,a,'analysis_request',{title:'Synthetic analysis',questions:['Synthetic question'],variables:['q1'],requestedOutputs:['mean'],operation:'descriptive'});x=await submit(f,s,a,x);x=await review(f,s,a,x,'approved');
 const req=request({...scope(s,a),requestRecordId:x.record.id,operation:'descriptive'});const result=await ok(f.partnershipRpc,TOKENS.owner,'workspaceAnalysis',req);assert.equal(result.summary.count,1);assert.equal(result.summary.results[0].mean,3);assert.equal(result.record.status,'draft');const snap=(await f.db.query('SELECT source_rows,response_ids FROM research_private.partnership_snapshots WHERE id=$1',[result.sourceSnapshotId])).rows[0];assert.deepEqual(snap.source_rows,[]);assert.deepEqual(snap.response_ids,[response]);assert.equal(JSON.stringify(result).includes('Never snapshot'),false);
 await f.db.query("UPDATE research_private.participants SET status='withdrawn' WHERE id=$1",[participant]);assert.equal((await f.partnershipRpc(TOKENS.owner,'workspaceAnalysis',request({...scope(s,a),requestRecordId:x.record.id,sourceSnapshotId:result.sourceSnapshotId,operation:'descriptive'}))).error,'not_found');assert.equal((await f.partnershipRpc(TOKENS.owner,'workspaceAnalysis',req)).error,'not_found');assert.equal((await f.partnershipRpc(TOKENS.owner,'workspaceExport',{...readScope(s,a,result),format:'json'})).error,'not_found');
 const ownReq=request({...scope(s,a),kind:'contribution',data:{title:'Before revocation',category:'other',description:'Synthetic'},expectedRevision:null});await ok(f.partnershipRpc,TOKENS.a,'recordSave',ownReq);await f.db.query("DELETE FROM research_private.memberships WHERE study_id=$1 AND actor_ref='code:STAFFA'",[s.id]);assert.equal((await f.partnershipRpc(TOKENS.a,'recordSave',ownReq)).error,'not_found');assert.equal((await f.partnershipRpc(TOKENS.a,'recordGet',readScope(s,a,result))).error,'not_found');
 }finally{await f.close();}
});
