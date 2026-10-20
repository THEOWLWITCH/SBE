import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

const require = createRequire(import.meta.url);
const C = require('../../app/lib/research-partnership-core.js');
const id = '11111111-1111-4111-8111-111111111111';
const invalid = fn => assert.throws(fn, error => error.code === 'invalid' && error.message === 'invalid' && !error.message.includes('PRIVATE'));

test('private V4 catalog covers the supplied source and each body placeholder once', () => {
  const catalog = JSON.parse(readFileSync(new URL('../content/research-agreement-guidance-v4.json', import.meta.url)));
  const source = catalog.sourceDocument;
  // Independent constants captured from the complete supplied unsigned source, not generated from the catalog.
  assert.equal(catalog.source.sha256,'73a22c07e4df4cdac9560b95a77d6284d389e21aebcdacd64acc5e24a4c325ad');
  assert.equal(createHash('sha256').update(JSON.stringify(source)).digest('hex'),'2688c94d99c624afb469b678e76fce3d2b8a35f49de97e678f4f619fa98ef0ac');
  const supplied = new URL('../../../../outputs/agreement-guided-v4/content.json', import.meta.url);
  if(existsSync(supplied)) assert.equal(createHash('sha256').update(readFileSync(supplied)).digest('hex'),catalog.source.sha256);
  assert.deepEqual(catalog.sections.map(s => s.id), C.AGREEMENT_SECTIONS.map(s => s.id));
  const actual = source.sections.flatMap((s, si) => s.paragraphs.flatMap((p, pi) => [...p.matchAll(/\[להשלמה[^\]]*\]/g)].map((m, oi) => ({sectionId:C.AGREEMENT_SECTIONS[si].id, paragraphIndex:pi, occurrence:oi, marker:m[0]}))));
  assert.equal(actual.length, 19);
  assert.deepEqual(catalog.bodyPlaceholders.map(({fieldId,fieldIds,...location})=>location),actual);
  const paths = new Set(C.RECORD_SCHEMAS.agreement.fields.flatMap(f => [f.id,...(f.fields||[]).map(n=>f.id+'[].'+n.id)]));
  for(const marker of catalog.bodyPlaceholders) {assert.ok(paths.has(marker.fieldId),marker.fieldId);assert.ok(marker.fieldIds.includes(marker.fieldId));for(const component of marker.fieldIds)assert.ok(paths.has(component),component);}
  assert.deepEqual(catalog.bodyPlaceholders.find(m=>m.fieldId==='leadResearcher').fieldIds,['leadResearcher','leadResearcherRole','leadResearcherInstitution']);
  for(const [si, section] of source.sections.entries()) for(const kind of ['complete','guidance']) for(const [index,text] of section[kind].entries()) {
    const mapped = catalog.decisions.filter(d=>d.sectionId===C.AGREEMENT_SECTIONS[si].id&&d.kind===kind&&d.index===index);
    assert.equal(mapped.length,1); assert.equal(mapped[0].text,text); assert.ok(mapped[0].fieldPaths.length);
    for(const path of mapped[0].fieldPaths) assert.ok(paths.has(path),path);
  }
  assert.deepEqual(catalog.checklist.map(c=>c.text),source.completionChecklist);
  for(const item of catalog.checklist) {assert.ok(item.fieldPaths.length);for(const path of item.fieldPaths)assert.ok(paths.has(path),path);}
  assert.deepEqual(catalog.sections[7].paragraphs.slice(0,2).map(p=>p.text),source.sections[7].paragraphs.slice(0,2));
  assert.deepEqual(catalog.sections.flatMap(s=>s.paragraphs).filter(p=>p.status==='owner_approved').map(p=>p.text),source.sections[7].paragraphs.slice(0,2));
  assert.doesNotThrow(()=>C.validateRecord('agreement_template',catalog.templateData,{complete:true}));
  assert.doesNotMatch(catalog.templateData.sectionClauses.map(c=>c.text).join('\n'),/\[להשלמה|השלמה מוצעת|מבנה נספחים מוצע|21 ימי עסקים|30 ימים|זו אפשרות לדיון|זו רשימת מסמכים להכנה/);
  assert.doesNotMatch(readFileSync(new URL('../../app/lib/research-partnership-core.js',import.meta.url),'utf8'),new RegExp(source.sections[7].paragraphs[0]));
});

test('professional service annex rows require provider, separate recipient, output, price and acceptance decisions',()=>{
 const fields=C.RECORD_SCHEMAS.agreement.fields.find(f=>f.id==='annexC').fields;
 const operating=Object.fromEntries(fields.filter(f=>f.required&&!f.requiredWhen).map(f=>[f.id,f.type==='money'?'0.00':f.type==='enum'?Object.keys(f.choices)[0]:'החלטה בדויה']));
 const agreement={title:'בדוי',ownerName:'בדויה',partnerName:'בדויה',studyTitle:'בדוי',purpose:'בדוי',effectiveDate:'2026-11-01',templateVersionId:id,ipExplanationVersionId:id,annexCStatus:'applicable',annexC:[operating]};
 assert.doesNotThrow(()=>C.validateRecord('agreement',agreement,{complete:true}));
 const service={...operating,kind:'service'};
 for(const field of ['provider','serviceRecipient','deliverable','pricingMethod','serviceAmount','hourCap','acceptance','credit'])assert.ok(C.missingFields('agreement',{annexC:[service]}).includes('annexC[0].'+field));
 invalid(()=>C.validateRecord('agreement',{...agreement,annexC:[service]},{complete:true}));
 for(const f of fields.filter(f=>f.requiredWhen))service[f.id]=f.type==='money'?'0.00':f.type==='enum'?'unpaid':'החלטה בדויה';
 assert.doesNotThrow(()=>C.validateRecord('agreement',{...agreement,annexC:[service]},{complete:true}));
 for(const field of ['estimatedAmount','approvedCap','ownerShare','partnerShare']){const row={...service};delete row[field];invalid(()=>C.validateRecord('agreement',{...agreement,annexC:[row]},{complete:true}));}
});

test('each guided field group renders in its own section without editor guidance or numeric defaults',()=>{
 const catalog=JSON.parse(readFileSync(new URL('../content/research-agreement-guidance-v4.json',import.meta.url)));
 const sample=f=>({text:'ערך בדוי '+f.id,email:'synthetic@example.invalid',date:'2026-11-01',id,type:null}[f.type] ?? (f.type==='enum'?Object.keys(f.choices)[0]:f.type==='integer'?7:f.type==='money'?'12.34':f.type==='boolean'?true:f.type==='tags'?[f.itemType==='id'?id:f.choices?f.choices[0]:'ערך בדוי']:f.type==='rows'?[Object.fromEntries(f.fields.map(n=>[n.id,sample(n)]))]:undefined));
 for(const definition of C.RECORD_SCHEMAS.agreement.fields){
  const value=sample(definition);
  const rendered=C.renderAgreement({[definition.id]:value},catalog.templateData);
  const ownSection=rendered.sections.find(s=>s.id===definition.section);
  assert.ok(ownSection.fields.some(f=>f.id===definition.id),definition.id);
 }
 const rendered=C.renderAgreement({},catalog.templateData);
 assert.doesNotMatch(rendered.text,/30 ימים|21 ימי עסקים|זו אפשרות לדיון|כיוון לדיון|\[להשלמה/);
 assert.equal(rendered.text.split(catalog.sourceDocument.sections[7].paragraphs[0]).length-1,1);
 assert.equal(rendered.text.split(catalog.sourceDocument.sections[7].paragraphs[1]).length-1,1);
 const data={guidedVersion:'4'};
 for(const annex of C.GUIDED_AGREEMENT.annexes){data[annex.statusField]='not_applicable';data[annex.reasonField]='לא חל במחקר בדוי';}
 const withoutVersion={...data};delete withoutVersion.guidedVersion;
 assert.ok(C.renderAgreement(withoutVersion,catalog.templateData).missingFields.includes('guidedVersion'));
 invalid(()=>C.validateRecord('agreement',{guidedVersion:'3'}));
});

test('V4 annex applicability has typed content or a reason, while legacy drafts remain readable',()=>{
  assert.equal(C.GUIDED_AGREEMENT.version,'4');
  assert.equal(C.GUIDED_AGREEMENT.annexes.length,6);
  assert.ok(C.missingFields('agreement',{guidedVersion:'4'}).includes('ownerRegistration'));
  for(const annex of C.GUIDED_AGREEMENT.annexes){
    assert.ok(C.missingFields('agreement',{guidedVersion:'4'}).includes(annex.statusField));
    assert.ok(C.missingFields('agreement',{guidedVersion:'4',[annex.statusField]:'applicable'}).includes(annex.rowsField));
    assert.ok(C.missingFields('agreement',{guidedVersion:'4',[annex.statusField]:'not_applicable'}).includes(annex.reasonField));
    assert.equal(C.missingFields('agreement',{guidedVersion:'4',[annex.statusField]:'not_applicable',[annex.reasonField]:'לא חל במחקר הבדוי'}).includes(annex.reasonField),false);
    const def=C.RECORD_SCHEMAS.agreement.fields.find(f=>f.id===annex.rowsField);
    const missing=C.missingFields('agreement',{guidedVersion:'4',[annex.statusField]:'applicable',[annex.rowsField]:[{}]});
    for(const nested of def.fields.filter(f=>f.required&&!f.requiredWhen)) assert.ok(missing.includes(annex.rowsField+'[0].'+nested.id));
    invalid(()=>C.validateRecord('agreement',{[annex.rowsField]:[{PRIVATE:'sentinel'}]}));
  }
  invalid(()=>C.validateRecord('agreement',{annexC:[{estimatedAmount:'1.001'}]}));
  invalid(()=>C.validateRecord('agreement',{annexA:[{startDate:'2026-02-30'}]}));
  invalid(()=>C.validateRecord('agreement',{annexA:[{startDate:'2026-12-01',endDate:'2026-11-01'}]}));
  assert.doesNotThrow(()=>C.validateRecord('agreement',{title:'גרסה קודמת'}));
});

test('owner release of approved contributions and analysis results has explicit version viewer and download scopes', () => {
  assert.equal(C.OPERATIONS.recordReview.request.viewerPartnerIds, 'uuid[]? analysis_result publication or approved contribution only');
  assert.equal(C.OPERATIONS.recordReview.request.downloadPartnerIds, 'uuid[]? subset of explicit viewers');
});
const application = () => ({title:'בקשת שותפות בדויה',applicationType:'partnership',fullName:'חוקרת בדויה',email:'researcher@example.invalid',institution:'מוסד בדוי',position:'חוקרת',objectives:'בדיקת תהליך',researchQuestions:['מה השתנה?'],method:'תיאורית',population:'צוות בדוי',requestedTools:['communication'],startDate:'2026-10-20',endDate:'2027-01-20',ethicsStatus:'pending',ethicsDetails:'נדרש אישור',consentPlan:'הסכמה נפרדת',requestedPermissions:['view_approved_findings']});
const template = () => ({title:'תבנית שסופקה לבדיקה בלבד',templateVersion:'synthetic-1',explanationVersion:'synthetic-ip-1',sectionClauses:C.AGREEMENT_SECTIONS.map(section=>({sectionId:section.id,text:section.id==='parties'?'צדדים: {{ownerName}} / {{partnerName}}':'טקסט בדוי שנמסר לבדיקה '+section.label})),ipExplanation:'הסבר בדוי שסופק לבדיקה',mutualIPClause:'סעיף בדוי שסופק לבדיקה',requiredFieldIds:['ownerName','partnerName','studyTitle','purpose','effectiveDate','templateVersionId','ipExplanationVersionId']});

test('agreement preview names permission choices in Hebrew while retaining canonical permission IDs',()=>{
  const data={title:'הסכם בדוי',requestedPermissions:['view_study','view_approved_findings']};
  const text=C.renderAgreement(data,template()).text;
  assert.match(text,/צפייה במחקר/);assert.match(text,/צפייה בממצאים מאושרים/);
  assert.doesNotMatch(text,/view_study|view_approved_findings/);
  assert.deepEqual(data.requestedPermissions,['view_study','view_approved_findings']);
});

test('partnership vocabulary is a deeply frozen browser/CommonJS contract with no public execution callback', () => {
  assert.equal(C.CLIENT_ACTIONS.length,26);
  assert.deepEqual(C.INTERNAL_ACTIONS,['signatureComplete']);
  assert.equal(C.CLIENT_ACTIONS.includes('signatureComplete'),false);
  for(const action of C.READ_ACTIONS) assert.ok(C.CLIENT_ACTIONS.includes(action));
  assert.deepEqual(Object.keys(C.OPERATIONS),C.CLIENT_ACTIONS);
  assert.ok(Object.isFrozen(C));
  assert.ok(Object.isFrozen(C.RECORD_SCHEMAS.agreement.fields[0]));
  assert.ok(Object.isFrozen(C.OPERATIONS.recordSave.request));
  const context = {};
  vm.runInNewContext(readFileSync(new URL('../../app/lib/research-partnership-core.js',import.meta.url),'utf8'),context);
  assert.equal(context.SBE_RESEARCH_PARTNERSHIPS.VERSIONS.schema,3);
  assert.equal(context.SBE_RESEARCH_PARTNERSHIPS.CLIENT_ACTIONS.length,26);
});

test('approved findings and collaborative analysis presets have no implicit raw-data or export grants', () => {
  assert.deepEqual(C.ACCESS_PRESETS.approved_findings,['view_study','view_approved_findings']);
  assert.deepEqual(C.ACCESS_PRESETS.collaborative_analysis,['view_study','view_approved_findings','propose_analysis','view_analysis_results','comment_on_findings']);
  assert.equal(C.ROLE_PRESETS.researcher,C.ACCESS_PRESETS.approved_findings);
  for(const grants of Object.values(C.ACCESS_PRESETS)) for(const grant of ['view_pseudonymized_data','view_identifiable_data','export_data','download_approved_findings','view_approved_pseudonymized_data','export_approved_dataset']) assert.equal(grants.includes(grant),false);
  assert.equal(C.PERMISSION_ALIASES.manage_study_questionnaires,'manage_questionnaires');
});

test('comparison requests require an explicit cohort field while descriptive and trend requests remain simple',()=>{
 const data={title:'Cohort comparison',questions:['Synthetic'],variables:['q1'],requestedOutputs:['mean'],operation:'comparison'};
 assert.ok(C.missingFields('analysis_request',data).includes('groupingVariable'));
 invalid(()=>C.validateRecord('analysis_request',data,{complete:true}));
 assert.equal(C.validateRecord('analysis_request',{...data,groupingVariable:'cohort'},{complete:true}).groupingVariable,'cohort');
 for(const operation of ['descriptive','trend'])assert.doesNotThrow(()=>C.validateRecord('analysis_request',{...data,operation},{complete:true}));
});

test('complete typed applications retain values and reject arbitrary keys and client authority', () => {
  const input = application();
  const validated = C.validateRecord('application',input,{complete:true});
  assert.deepEqual(validated,input);
  assert.notEqual(validated,input);
  for(const extra of [{owner:true},{status:'approved'},{signed:true},{permissions:['export_data']},{arbitrary:{PRIVATE:'sentinel'}}]) invalid(()=>C.validateRecord('application',{...input,...extra}));
  invalid(()=>C.validateRecord('unknown',{}));
  invalid(()=>C.validateRecord('application',{...input,email:'PRIVATE'}));
  invalid(()=>C.validateRecord('application',{...input,requestedPermissions:['arbitrary_sql']}));
});

test('draft completion lists exact missing fields; submitted application rejects gaps and reversed dates', () => {
  assert.ok(C.missingFields('application',{}).includes('fullName'));
  assert.doesNotThrow(()=>C.validateRecord('application',{}));
  invalid(()=>C.validateRecord('application',{}, {complete:true}));
  invalid(()=>C.validateRecord('application',{...application(),startDate:'2026-02-30'}));
  invalid(()=>C.validateRecord('application',{...application(),endDate:'2026-10-01'}));
});

test('individual profiles and applications can be complete without an institution while legacy and institution profiles retain it', () => {
  const profile = { fullName: 'אדם בדוי', email: 'individual@example.invalid', applicantType: 'individual' };
  assert.deepEqual(C.validatePartner(profile, { complete: true }), profile);
  const individual = { ...application(), applicantType: 'individual' };
  delete individual.institution;
  assert.deepEqual(C.validateRecord('application', individual, { complete: true }), individual);
  assert.equal(C.missingFields('application', individual).includes('institution'), false);
  for (const applicantType of ['institution', undefined]) {
    const legacy = { ...profile };
    if (applicantType) legacy.applicantType = applicantType; else delete legacy.applicantType;
    invalid(() => C.validatePartner(legacy, { complete: true }));
    const incomplete = { ...individual };
    if (applicantType) incomplete.applicantType = applicantType; else delete incomplete.applicantType;
    invalid(() => C.validateRecord('application', incomplete, { complete: true }));
    assert.ok(C.missingFields('application', incomplete).includes('institution'));
    assert.doesNotThrow(() => C.validatePartner({ ...legacy, institution: 'מוסד בדוי' }, { complete: true }));
  }
  invalid(() => C.validatePartner({ ...profile, applicantType: 'other' }));
  invalid(() => C.validateRecord('application', { ...individual, applicantType: 'other' }));
});

test('contribution registry has exactly eight categories and seven statuses and keeps requested/agreed terms distinct', () => {
  assert.deepEqual(Object.keys(C.CONTRIBUTION_CATEGORIES),['scientific','methodological','questionnaires','educational_content','technology','funding','professional_services','other']);
  assert.deepEqual(Object.keys(C.RECORD_STATUSES.contribution),['draft','submitted','under_review','changes_requested','approved','rejected','completed']);
  const proposal={title:'תרומה בדויה',category:'technology',description:'כלי בדוי',requestedRecognition:'אזכור',requestedCompensation:'125.25',requestedUsage:'מחקר',requestedIP:'זכויות קודמות נשמרות',requestedOwnerObligations:'בדיקה',supportingDocumentIds:[id]};
  assert.deepEqual(C.validateRecord('contribution',proposal,{complete:true}),proposal);
  invalid(()=>C.validateRecord('contribution',{...proposal,agreedTerms:{amount:125}}));
  assert.equal(C.isBindingObligation({status:'approved',kind:'contribution',data:proposal}),false);
});

test('money, references and nested object rows are typed and reject hidden keys', () => {
  const budget={title:'תקציב בדוי',currency:'ILS',items:[{description:'בדיקה',amount:'20.25',party:'partner',dueDate:'2026-12-01',contributionId:id}]};
  assert.deepEqual(C.validateRecord('budget',budget,{complete:true}),budget);
  for(const amount of [-1,0.001,20.25,'20.250','01.00',Infinity]) invalid(()=>C.validateRecord('budget',{...budget,items:[{...budget.items[0],amount}]}));
  invalid(()=>C.validateRecord('budget',{...budget,items:[{...budget.items[0],PRIVATE:{sql:'select'}}]}));
  invalid(()=>C.validateRecord('budget',{...budget,items:[{...budget.items[0],contributionId:'not-an-id'}]}));
  invalid(()=>C.validateRecord('budget',{...budget,items:[{...budget.items[0],dueDate:'2026-13-01'}]}));
});

test('findings require provenance and privacy review while publication viewers remain operation-only', () => {
  const finding={title:'ממצא בדוי',summary:'תיאור',evidence:'ראיות בדויות',sourceSnapshotId:id,method:'תיאור',analysisVersion:'1',toolVersion:'1.2.0',questionnaireVersionIds:[id],consentProtocolVersionId:id,privacyReview:'בדיקה שהושלמה',consentReview:'נבדק היקף ההסכמה'};
  assert.deepEqual(C.validateRecord('finding',finding,{complete:true}),finding);
  assert.deepEqual(Object.keys(C.RECORD_STATUSES.finding),['draft','owner_review','approved','published','withdrawn']);
  invalid(()=>C.validateRecord('finding',{...finding,authorizedViewerIds:[id]}));
  invalid(()=>C.validateRecord('finding',{...finding,privacyReviewed:true}));
  invalid(()=>C.validateRecord('finding',{...finding,sourceSnapshotId:''},{complete:true}));
});

test('all twelve agreement sections expose Hebrew typed fields and templates validate known placeholders', () => {
  assert.deepEqual(C.AGREEMENT_SECTIONS.map(section=>section.id),['parties','study','tools','contributions','sharedExpenses','professionalFees','development','mutualIP','privacyEthics','durationTermination','annexes','reviewSigning']);
  for(const section of C.AGREEMENT_SECTIONS) {
    assert.match(section.label,/[א-ת]/u);
    assert.ok(C.RECORD_SCHEMAS.agreement.fields.some(field=>field.section===section.id));
  }
  assert.deepEqual(C.validateRecord('agreement_template',template(),{complete:true}),template());
  invalid(()=>C.validateRecord('agreement_template',{...template(),sectionClauses:[{sectionId:'parties',text:'{{PRIVATE_unknown}}'}]}));
  invalid(()=>C.validateRecord('agreement_template',{...template(),requiredFieldIds:['PRIVATE_unknown']}));
  invalid(()=>C.validateRecord('agreement_template',{...template(),sectionClauses:[{sectionId:'parties',text:'{{ownerName'}]}));
  invalid(()=>C.validateRecord('agreement_template',{...template(),sectionClauses:template().sectionClauses.slice(1)},{complete:true}));
});

test('agreement preview is deterministic Hebrew RTL, preserves mixed content and marks missing required values', () => {
  const agreement={title:'הסכם בדוי',ownerName:'בעלת הכלי',partnerName:'Example Researcher',studyTitle:'מחקר א׳',purpose:'Synthetic study',effectiveDate:'2026-11-01',templateVersionId:id,ipExplanationVersionId:id};
  const preview=C.renderAgreement(agreement,template());
  assert.equal(preview.direction,'rtl');
  assert.equal(preview.lang,'he');
  assert.equal(preview.sections.length,12);
  assert.equal(preview.ready,true);
  assert.match(preview.text,/בעלת הכלי \/ Example Researcher/u);
  assert.match(preview.text,/2026-11-01/u);
  assert.deepEqual(C.renderAgreement(agreement,template()),preview);
  const incomplete=C.renderAgreement({...agreement,partnerName:''},template());
  assert.ok(incomplete.missingFields.includes('partnerName'));
  assert.equal(incomplete.ready,false);
  assert.match(incomplete.text,/חסר/u);
  assert.equal(C.renderAgreement(agreement,null).dependency,'approved_template_missing');
});

test('agreement comparison gives exact before/after values and financial, deadline, IP, access, privacy and obligations implications', () => {
  const before={sharedExpenses:[{description:'הוצאה',amount:'10.00',party:'owner'}],effectiveDate:'2026-11-01',newIPOwnership:'א׳',accessTerms:'צפייה',privacyTerms:'מוגבל',ownerResponsibilities:'בדיקה'};
  const after={...before,sharedExpenses:[{description:'הוצאה',amount:'20.00',party:'owner'}],effectiveDate:'2026-12-01',newIPOwnership:'ב׳',accessTerms:'צפייה מאושרת',privacyTerms:'מצומצם',ownerResponsibilities:'בדיקה נוספת'};
  const changes=C.compareRecords('agreement',before,after);
  assert.deepEqual(changes.map(change=>change.category).sort(),['IP','access','deadline','financial','obligations','privacy'].sort());
  assert.deepEqual(changes.find(change=>change.path==='sharedExpenses[0].amount'),{path:'sharedExpenses[0].amount',fieldId:'sharedExpenses',label:'הוצאות משותפות / סכום',category:'financial',before:'10.00',after:'20.00'});
  assert.equal(C.compareRecords('agreement',after,after).length,0);
});

test('status contract separates author submissions, owner review, publication and verified signing execution', () => {
  assert.equal(C.canTransition('application','draft','submitted','recordSubmit','author'),true);
  assert.equal(C.canTransition('application','submitted','approved','recordReview','author'),false);
  assert.equal(C.canTransition('finding','approved','published','findingPublish','owner'),true);
  assert.equal(C.canTransition('agreement','approved','executed','recordReview','owner'),false);
  assert.equal(C.canTransition('agreement','signing','executed','signatureComplete','internal'),true);
  assert.equal(C.isBindingObligation({kind:'obligation',status:'approved',sourceAgreementStatus:'approved'}),false);
  assert.equal(C.isBindingObligation({kind:'obligation',status:'approved',sourceAgreementStatus:'executed',sourceAgreementVersionId:id,sourceAgreementHash:'a'.repeat(64),providerVerification:'verified',ownerReviewed:true}),true);
});

test('validation errors never carry a supplied value or arbitrary error text', () => {
  const error=C.safeError('invalid');
  assert.equal(error.code,'invalid');
  assert.equal(error.message,'invalid');
  assert.match(error.userMessage,/[א-ת]/u);
  assert.equal(C.safeError('PRIVATE payload').code,'invalid');
});

test('running approved analysis persists a consent snapshot and a draft result while impact reports real AI readiness', () => {
  assert.equal(C.READ_ACTIONS.includes('workspaceAnalysis'),false);
  assert.equal(C.OPERATIONS.workspaceAnalysis.request.sourceSnapshotId,'uuid? omit to create consent-bound snapshot');
  assert.equal(C.OPERATIONS.workspaceAnalysis.result.record,'Record draft analysis_result');
  assert.equal(C.OPERATIONS.workspaceAnalysis.result.version,'RecordVersion');
  assert.equal(C.OPERATIONS.workspaceImpact.result.ai,'ImpactAIState');
});
