import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { createPartnershipIntegration } from '../fixtures/research-partnership-integrated.mjs';
const require = createRequire(import.meta.url);
const C = require('../../app/lib/research-partnership-core.js');

test('real gateway and PostgreSQL preserve researcher applications, releases, documents and unsigned agreements', async () => {
  const f = await createPartnershipIntegration();
  try {
    const { owner, a, b } = f.tokens;
    const { study, consent, instrument } = await f.seedStudy('מחקר בדוי משותף');
    const other = (await f.seedStudy('מחקר בדוי נוסף')).study;
    const mutate = (actor, action, payload) => f.checked(actor, action, f.request(payload));
    const denied = async (actor, action, payload) => {
      const [status, body] = await f.callResearch({ token: actor, action, ...payload });
      assert.ok([403, 404].includes(status), action + ': ' + JSON.stringify(body));
    };
    let aMemberId;
    for (const [sid, code] of [[study.id, f.codes.a], [study.id, f.codes.b], [other.id, f.codes.b]]) {
      const current = (await f.checked(owner, 'studyGet', { studyId: sid })).study;
      const assigned = await mutate(owner, 'memberSet', { studyId: sid, expectedRevision: current.revision, code, role: 'researcher', permissions: C.ACCESS_PRESETS.collaborative_analysis });
      if (sid === study.id && code === f.codes.a) aMemberId = assigned.members[0].id;
    }
    const partners = [];
    for (const [code, name] of [[f.codes.a, 'שושי בדויה'], [f.codes.b, 'עינת בדויה']]) partners.push((await mutate(owner, 'partnerSave', { expectedRevision: null, individualCode: code, profile: { fullName: name, email: code.toLowerCase() + '@example.invalid', institution: 'מוסד בדוי' } })).partner);
    const scope = { studyId: study.id, partnerId: partners[0].id };
    const draftData = { title: 'בקשה פרטית של שושי', applicationType: 'partnership', ...partners[0].profile, objectives: 'בחינת מוכנות', researchQuestions: ['כיצד מתקיים שיתוף?'], method: 'מחקר תיאורי', population: 'צוות בדוי', requestedTools: ['communication'], startDate: '2026-11-01', endDate: '2027-03-01', ethicsStatus: 'pending', ethicsDetails: 'בדיקת תוכנה', consentPlan: 'בחירה אישית', requestedPermissions: ['view_approved_findings'] };
    let application = await mutate(a, 'recordSave', { ...scope, expectedRevision: null, kind: 'application', data: draftData });
    const recordScope = { ...scope, recordId: application.record.id };
    const original = application.version;
    await denied(b, 'recordGet', recordScope);
    await denied(a, 'recordGet', { ...recordScope, studyId: other.id });
    await denied(b, 'partnerGet', { partnerId: partners[0].id });
    const bList = await f.checked(b, 'workspaceList', {});
    assert.equal(JSON.stringify(bList).includes('בקשה פרטית של שושי'), false);
    application = await mutate(a, 'recordSubmit', { ...recordScope, versionId: application.version.id, expectedRevision: application.record.revision });
    await denied(a, 'recordReview', f.request({ ...recordScope, versionId: application.version.id, expectedRevision: application.record.revision, decision: 'approved' }));
    const review = await mutate(owner, 'recordReview', { ...recordScope, versionId: application.version.id, expectedRevision: application.record.revision, decision: 'changes_requested', note: 'השלמת שיטה' });
    application = await mutate(a, 'recordSave', { ...recordScope, expectedRevision: review.record.revision, kind: 'application', data: { ...draftData, method: 'שאלון ורפלקציה' } });
    assert.notEqual(application.version.id, original.id);
    assert.equal((await f.checked(a, 'recordGet', { ...recordScope, versionId: original.id })).version.data.method, 'מחקר תיאורי');

    const upload = { ...scope, filename: 'בדיקה.txt', mediaType: 'text/plain', contentBase64: Buffer.from('מסמך בדוי פרטי').toString('base64'), requestId: randomUUID() };
    const doc = await f.checked(a, 'workspaceDocumentPut', upload);
    assert.equal((await f.checked(a, 'workspaceDocumentPut', upload)).document.id, doc.document.id);
    await denied(b, 'workspaceDocumentGet', { ...scope, documentId: doc.document.id });
    assert.equal(Buffer.from((await f.checked(a, 'workspaceDocumentGet', { ...scope, documentId: doc.document.id })).contentBase64, 'base64').toString(), 'מסמך בדוי פרטי');
    assert.equal((await f.callResearch({ token: a, action: 'workspaceDocumentPut', ...upload, contentBase64: Buffer.from('שינוי').toString('base64') }))[0], 409);

    let contribution = await mutate(a, 'recordSave', { ...scope, expectedRevision: null, kind: 'contribution', data: { title: 'תרומה טכנולוגית', category: 'technology', description: 'תוצר בדוי', requestedCompensation: '125.25', requestedIP: 'זכויות קודמות נשמרות' } });
    const contributionScope = { ...scope, recordId: contribution.record.id };
    contribution = await mutate(a, 'recordSubmit', { ...contributionScope, versionId: contribution.version.id, expectedRevision: contribution.record.revision });
    const approvedContribution = await mutate(owner, 'recordReview', { ...contributionScope, versionId: contribution.version.id, expectedRevision: contribution.record.revision, decision: 'approved', approvedTerms: { compensation: '100.00', currency: 'ILS', recognition: 'אזכור בדוי' } });
    assert.equal(approvedContribution.record.binding, false);

    let analysis = await mutate(a, 'recordSave', { ...scope, expectedRevision: null, kind: 'analysis_request', data: { title: 'בקשת ניתוח בדויה', questions: ['תיאור התשובות'], variables: ['q1'], requestedOutputs: ['סיכום'], operation: 'descriptive' } });
    const analysisScope = { ...scope, recordId: analysis.record.id };
    analysis = await mutate(a, 'recordSubmit', { ...analysisScope, versionId: analysis.version.id, expectedRevision: analysis.record.revision });
    await mutate(owner, 'recordReview', { ...analysisScope, versionId: analysis.version.id, expectedRevision: analysis.record.revision, decision: 'approved' });
    const run = await mutate(owner, 'workspaceAnalysis', { ...scope, requestRecordId: analysis.record.id, operation: 'descriptive' });
    assert.equal(run.record.status, 'draft');
    let finding = await mutate(a, 'recordSave', { ...scope, expectedRevision: null, kind: 'finding', data: { title: 'ממצא בדוי לאישור', summary: 'בדיקת מסלול פרסום בלבד', evidence: 'מידע סינתטי', sourceSnapshotId: run.sourceSnapshotId, method: 'תיאורי', analysisVersion: '1.0.0', toolVersion: '1.2.0', questionnaireVersionIds: [instrument.id], consentProtocolVersionId: consent.id, privacyReview: 'נבדק', consentReview: 'נבדק' } });
    const findingScope = { ...scope, recordId: finding.record.id };
    await denied(b, 'recordGet', findingScope);
    finding = await mutate(a, 'recordSubmit', { ...findingScope, versionId: finding.version.id, expectedRevision: finding.record.revision });
    const approvedFinding = await mutate(owner, 'recordReview', { ...findingScope, versionId: finding.version.id, expectedRevision: finding.record.revision, decision: 'approved' });
    const published = await mutate(owner, 'findingPublish', { ...findingScope, versionId: finding.version.id, expectedRevision: approvedFinding.record.revision, viewerPartnerIds: [partners[1].id], downloadPartnerIds: [] });
    assert.equal((await f.checked(b, 'recordGet', findingScope)).version.id, finding.version.id);
    await denied(b, 'workspaceExport', { ...findingScope, versionId: finding.version.id, format: 'html' });
    await denied(b, 'partnerGet', { partnerId: partners[0].id });
    await mutate(owner, 'findingWithdraw', { ...findingScope, versionId: finding.version.id, expectedRevision: published.record.revision, reason: 'הסרה בדויה לבדיקת הרשאות' });
    await denied(b, 'recordGet', findingScope);

    let template = await mutate(owner, 'recordSave', { ...scope, expectedRevision: null, kind: 'agreement_template', data: { title: 'תבנית בדויה לבדיקת תוכנה בלבד', templateVersion: 'synthetic-1', explanationVersion: 'synthetic-ip-1', sectionClauses: C.AGREEMENT_SECTIONS.map(section => ({ sectionId: section.id, text: 'סעיף בדוי לבדיקה ' + section.label })), ipExplanation: 'הסבר בדוי לבדיקה בלבד', mutualIPClause: 'סעיף בדוי שאינו הסכם אמיתי', requiredFieldIds: [] } });
    await mutate(owner, 'recordReview', { ...scope, recordId: template.record.id, versionId: template.version.id, expectedRevision: template.record.revision, decision: 'approved' });
    let agreement = await mutate(a, 'recordSave', { ...scope, expectedRevision: null, kind: 'agreement', data: { title: 'הסכם בדוי', ownerName: 'בעלת מערכת בדויה', partnerName: 'שושי בדויה', studyTitle: 'מחקר בדוי', purpose: 'בדיקת תוכנה בלבד', effectiveDate: '2026-11-01', templateVersionId: template.version.id, ipExplanationVersionId: template.version.id } });
    const agreementScope = { ...scope, recordId: agreement.record.id };
    agreement = await mutate(a, 'recordSubmit', { ...agreementScope, versionId: agreement.version.id, expectedRevision: agreement.record.revision });
    const agreementReview = await mutate(owner, 'recordReview', { ...agreementScope, versionId: agreement.version.id, expectedRevision: agreement.record.revision, decision: 'approved' });
    let current = agreementReview.record;
    for (const actor of [owner, a]) current = (await mutate(actor, 'agreementApprove', { ...agreementScope, versionId: agreement.version.id, expectedRevision: current.revision, documentHash: agreement.version.contentHash, ipExplanationVersionId: template.version.id, ipReadAcknowledged: true })).record;
    const signing = await f.callResearch({ token: owner, action: 'signingStart', ...f.request({ ...agreementScope, versionId: agreement.version.id, expectedRevision: current.revision, documentHash: agreement.version.contentHash, consent: true }) });
    assert.equal(signing[0], 503);
    assert.equal((await f.checked(owner, 'recordGet', agreementScope)).record.status, 'approved');
    assert.equal((await f.checked(owner, 'recordGet', agreementScope)).record.binding, false);
    const edited = await mutate(a, 'recordSave', { ...agreementScope, expectedRevision: current.revision, kind: 'agreement', data: { ...agreement.version.data, purpose: 'הצעה מתוקנת' } });
    assert.equal(edited.record.status, 'draft');
    assert.equal(edited.record.approvedVersionId, null);

    assert.ok(aMemberId);
    const latestStudy = (await f.checked(owner, 'studyGet', { studyId: study.id })).study;
    await mutate(owner, 'memberRemove', { studyId: study.id, expectedRevision: latestStudy.revision, memberId: aMemberId });
    await denied(a, 'recordGet', recordScope);
    await denied(a, 'workspaceDocumentGet', { ...scope, documentId: doc.document.id });
    await denied(a, 'workspaceDocumentPut', upload);
  } finally { await f.close(); }
});
