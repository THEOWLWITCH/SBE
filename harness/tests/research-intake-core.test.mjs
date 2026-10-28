import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import C from '../../app/lib/research-intake-core.js';
import P from '../../app/lib/research-partnership-core.js';

const id = '11111111-1111-4111-8111-111111111111';
const application = () => ({ applicantType: 'individual', title: 'בקשה בדויה', applicationType: 'partnership', fullName: 'פונה בדויה', email: 'person@example.invalid', objectives: 'בדיקת תהליך', requestedTools: ['communication'] });
const submit = () => ({ requestId: id, termsVersionId: id, termsHash: 'a'.repeat(64), acknowledged: true, application: application() });
const invalid = fn => assert.throws(fn, error => error.code === 'invalid' && error.message === 'invalid');

test('intake exports the frozen public and owner wire contract in CommonJS and browser contexts', () => {
  assert.deepEqual(C.PUBLIC_ACTIONS, ['intakePublicInfo', 'intakeSubmit']);
  assert.deepEqual(C.CLIENT_ACTIONS, ['intakeOwnerBootstrap', 'intakeList', 'intakeGet', 'intakeTermsSave', 'intakeTermsPublish', 'intakeReview', 'intakeIdentityCreate']);
  assert.deepEqual(C.READ_ACTIONS, ['intakeOwnerBootstrap', 'intakeList', 'intakeGet']);
  assert.deepEqual(Object.keys(C.OPERATIONS), [...C.PUBLIC_ACTIONS, ...C.CLIENT_ACTIONS]);
  assert.deepEqual(C.APPLICANT_TYPES, { individual: 'אדם פרטי', institution: 'מוסד' });
  assert.deepEqual(Object.keys(C.APPLICATION_STATUSES), ['submitted', 'under_review', 'approved', 'rejected']);
  assert.deepEqual(C.SUBMISSION_REQUIRED_FIELDS, ['title', 'applicationType', 'fullName', 'email', 'objectives', 'requestedTools', 'applicantType']);
  assert.deepEqual(C.PUBLIC_FIELDS, P.RECORD_SCHEMAS.application.fields.filter(field => !['questionnaireVersionIds', 'supportingDocumentIds'].includes(field.id)));
  assert.deepEqual(Object.keys(C.DEFAULT_TERMS_DRAFT), ['title', 'text']);
  assert.match(C.DEFAULT_TERMS_DRAFT.text, /בקשה/);
  assert.match(C.DEFAULT_TERMS_DRAFT.text, /אינה/);
  assert.ok(Object.isFrozen(C.OPERATIONS.intakeSubmit.request));
  assert.ok(Object.isFrozen(C.PUBLIC_FIELDS));
  const context = { SBE_RESEARCH_PARTNERSHIPS: P };
  vm.runInNewContext(readFileSync(new URL('../../app/lib/research-intake-core.js', import.meta.url), 'utf8'), context);
  assert.equal(context.SBE_RESEARCH_INTAKE.VERSIONS.api, C.VERSIONS.api);
  assert.equal(context.SBE_RESEARCH_INTAKE.PUBLIC_ACTIONS.length, 2);
});

test('public application is a partial research proposal with its own minimal required fields and conditional institution', () => {
  const input = submit();
  const normalized = C.validatePayload('intakeSubmit', { action: 'intakeSubmit', ...input });
  assert.deepEqual(normalized, input);
  assert.notEqual(normalized.application, input.application);
  assert.deepEqual(C.validatePayload('intakePublicInfo', {}), {});
  for (const field of C.SUBMISSION_REQUIRED_FIELDS) {
    const next = submit(); delete next.application[field];
    invalid(() => C.validatePayload('intakeSubmit', next));
  }
  invalid(() => C.validatePayload('intakeSubmit', { ...input, application: { ...application(), requestedTools: [] } }));
  invalid(() => C.validatePayload('intakeSubmit', { ...input, application: { ...application(), applicantType: 'institution' } }));
  assert.equal(C.validatePayload('intakeSubmit', { ...input, application: { ...application(), applicantType: 'institution', institution: 'מוסד בדוי' } }).application.institution, 'מוסד בדוי');
  assert.equal(C.validatePayload('intakeSubmit', { ...input, application: { ...application(), method: 'תיאורית', requestedPermissions: ['view_approved_findings'] } }).application.method, 'תיאורית');
});

test('public application rejects tokens, confidential references, authority keys and invalid terms acknowledgement', () => {
  const input = submit();
  invalid(() => C.validatePayload('intakePublicInfo', { token: 'PRIVATE' }));
  for (const extra of [{ token: 'PRIVATE' }, { status: 'approved' }, { owner: true }, { action: 'intakeList' }]) invalid(() => C.validatePayload('intakeSubmit', { ...input, ...extra }));
  for (const extra of [{ questionnaireVersionIds: [id] }, { supportingDocumentIds: [id] }, { participants: ['PRIVATE'] }, { permissions: ['view_study'] }, { status: 'approved' }]) invalid(() => C.validatePayload('intakeSubmit', { ...input, application: { ...application(), ...extra } }));
  for (const extra of [{ requestId: 'bad' }, { termsVersionId: 'bad' }, { termsHash: 'PRIVATE' }, { acknowledged: false }, { acknowledged: 'true' }]) invalid(() => C.validatePayload('intakeSubmit', { ...input, ...extra }));
  invalid(() => C.validatePayload('intakeSubmit', { ...input, application: { ...application(), email: 'PRIVATE' } }));
  invalid(() => C.validatePayload('intakeSubmit', { ...input, application: { ...application(), requestedPermissions: ['anything'] } }));
});

test('owner terms edits and lookups strip envelope credentials and validate explicit revisions and versions', () => {
  assert.deepEqual(C.validatePayload('intakeOwnerBootstrap', { token: 'PRIVATE', action: 'intakeOwnerBootstrap' }), {});
  const draft = { requestId: id, expectedRevision: 0, title: 'תנאי פנייה מוצעים', text: 'נוסח בדוי לבדיקה' };
  assert.deepEqual(C.validatePayload('intakeTermsSave', { token: 'PRIVATE', ...draft }), draft);
  assert.deepEqual(C.validatePayload('intakeTermsPublish', { requestId: id, expectedRevision: 1, versionId: id }), { requestId: id, expectedRevision: 1, versionId: id });
  assert.deepEqual(C.validatePayload('intakeGet', { applicationId: id }), { applicationId: id });
  assert.deepEqual(C.validatePayload('intakeList', { status: 'submitted', query: 'בדויה', cursor: id }), { status: 'submitted', query: 'בדויה', cursor: id });
  for (const expectedRevision of [null, -1, 1.5, '1', Number.MAX_SAFE_INTEGER + 1]) invalid(() => C.validatePayload('intakeTermsSave', { ...draft, expectedRevision }));
  for (const extra of [{ title: '' }, { text: '   ' }, { published: true }]) invalid(() => C.validatePayload('intakeTermsSave', { ...draft, ...extra }));
  invalid(() => C.validatePayload('intakeTermsPublish', { requestId: id, expectedRevision: 1, versionId: 'bad' }));
  invalid(() => C.validatePayload('intakeList', { status: 'draft' }));
  invalid(() => C.validatePayload('intakeList', { status: ['submitted'] }));
  invalid(() => C.validatePayload('intakeList', { arbitrary: 'PRIVATE' }));
  invalid(() => C.validatePayload('intakeList', { query: 'q'.repeat(501) }));
  invalid(() => C.validatePayload('intakeList', { cursor: 'c'.repeat(2001) }));
  invalid(() => C.validatePayload('unknown', {}));
  invalid(() => C.validatePayload(['intakeList'], {}));
});

test('approval requires an explicit study revision, personal code and permission list while other decisions cannot grant access', () => {
  const review = { requestId: id, applicationId: id, expectedRevision: 0, decision: 'approved', studyId: id, studyExpectedRevision: 2, individualCode: 'STAFFA', permissions: ['view_study', 'view_approved_findings'] };
  assert.deepEqual(C.validatePayload('intakeReview', review), review);
  invalid(() => C.validatePayload('intakeReview', { ...review, individualCode: 'A'.repeat(101) }));
  for (const field of ['studyId', 'studyExpectedRevision', 'individualCode', 'permissions']) { const next = { ...review }; delete next[field]; invalid(() => C.validatePayload('intakeReview', next)); }
  for (const permissions of [[], ['view_approved_findings'], ['view_study', 'anything'], ['view_study', 'view_study']]) invalid(() => C.validatePayload('intakeReview', { ...review, permissions }));
  for (const decision of ['under_review', 'rejected']) {
    const next = { requestId: id, applicationId: id, expectedRevision: 0, decision, note: 'בדיקה בדויה' };
    assert.deepEqual(C.validatePayload('intakeReview', next), next);
    for (const field of ['studyId', 'studyExpectedRevision', 'individualCode', 'permissions']) invalid(() => C.validatePayload('intakeReview', { ...next, [field]: review[field] }));
  }
  assert.deepEqual(C.validatePayload('intakeIdentityCreate', { requestId: id, institution: 'מסגרת כניסה בדויה', label: 'זהות בדויה' }), { requestId: id, institution: 'מסגרת כניסה בדויה', label: 'זהות בדויה' });
  invalid(() => C.validatePayload('intakeIdentityCreate', { requestId: id, institution: '', label: 'זהות בדויה' }));
  invalid(() => C.validatePayload('intakeIdentityCreate', { requestId: id, institution: 'מסגרת בדויה', label: 'זהות בדויה', perms: ['writer'] }));
});
