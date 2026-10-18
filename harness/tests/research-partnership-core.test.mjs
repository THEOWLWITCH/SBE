import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const C = require('../../app/lib/research-partnership-core.js');
const id = '11111111-1111-4111-8111-111111111111';
const invalid = fn => assert.throws(fn, error => error.code === 'invalid' && error.message === 'invalid' && !error.message.includes('PRIVATE'));

test('owner release of approved contributions and analysis results has explicit version viewer and download scopes', () => {
  assert.equal(C.OPERATIONS.recordReview.request.viewerPartnerIds, 'uuid[]? analysis_result publication or approved contribution only');
  assert.equal(C.OPERATIONS.recordReview.request.downloadPartnerIds, 'uuid[]? subset of explicit viewers');
});
const application = () => ({title:'בקשת שותפות בדויה',applicationType:'partnership',fullName:'חוקרת בדויה',email:'researcher@example.invalid',institution:'מוסד בדוי',position:'חוקרת',objectives:'בדיקת תהליך',researchQuestions:['מה השתנה?'],method:'תיאורית',population:'צוות בדוי',requestedTools:['communication'],startDate:'2026-10-20',endDate:'2027-01-20',ethicsStatus:'pending',ethicsDetails:'נדרש אישור',consentPlan:'הסכמה נפרדת',requestedPermissions:['view_approved_findings']});
const template = () => ({title:'תבנית שסופקה לבדיקה בלבד',templateVersion:'synthetic-1',explanationVersion:'synthetic-ip-1',sectionClauses:C.AGREEMENT_SECTIONS.map(section=>({sectionId:section.id,text:section.id==='parties'?'צדדים: {{ownerName}} / {{partnerName}}':'טקסט בדוי שנמסר לבדיקה '+section.label})),ipExplanation:'הסבר בדוי שסופק לבדיקה',mutualIPClause:'סעיף בדוי שסופק לבדיקה',requiredFieldIds:['ownerName','partnerName','studyTitle','purpose','effectiveDate','templateVersionId','ipExplanationVersionId']});

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
  assert.equal(context.SBE_RESEARCH_PARTNERSHIPS.VERSIONS.schema,1);
  assert.equal(context.SBE_RESEARCH_PARTNERSHIPS.CLIENT_ACTIONS.length,26);
});

test('approved findings and collaborative analysis presets have no implicit raw-data or export grants', () => {
  assert.deepEqual(C.ACCESS_PRESETS.approved_findings,['view_study','view_approved_findings']);
  assert.deepEqual(C.ACCESS_PRESETS.collaborative_analysis,['view_study','view_approved_findings','propose_analysis','view_analysis_results','comment_on_findings']);
  assert.equal(C.ROLE_PRESETS.researcher,C.ACCESS_PRESETS.approved_findings);
  for(const grants of Object.values(C.ACCESS_PRESETS)) for(const grant of ['view_pseudonymized_data','view_identifiable_data','export_data','download_approved_findings','view_approved_pseudonymized_data','export_approved_dataset']) assert.equal(grants.includes(grant),false);
  assert.equal(C.PERMISSION_ALIASES.manage_study_questionnaires,'manage_questionnaires');
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
