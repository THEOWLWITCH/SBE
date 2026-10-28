(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./research-partnership-core.js'));
  else root.SBE_RESEARCH_INTAKE = factory(root.SBE_RESEARCH_PARTNERSHIPS);
})(typeof self !== 'undefined' ? self : this, function (partnerships) {
  'use strict';

  function freeze(value) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }
    return value;
  }
  const VERSIONS = { api: '1.0.0', schema: 1 };
  const PUBLIC_ACTIONS = ['intakePublicInfo', 'intakeSubmit'];
  const CLIENT_ACTIONS = ['intakeOwnerBootstrap', 'intakeList', 'intakeGet', 'intakeTermsSave', 'intakeTermsPublish', 'intakeReview', 'intakeIdentityCreate'];
  const READ_ACTIONS = ['intakeOwnerBootstrap', 'intakeList', 'intakeGet'];
  const APPLICANT_TYPES = partnerships.RECORD_SCHEMAS.application.fields.find(field => field.id === 'applicantType').choices;
  const APPLICATION_STATUSES = { submitted: 'הוגשה', under_review: 'בבדיקה', approved: 'אושרה', rejected: 'נדחתה' };
  const PUBLIC_FIELDS = partnerships.RECORD_SCHEMAS.application.fields.filter(field => !['questionnaireVersionIds', 'supportingDocumentIds'].includes(field.id));
  const SUBMISSION_REQUIRED_FIELDS = ['title', 'applicationType', 'fullName', 'email', 'objectives', 'requestedTools', 'applicantType'];
  const DEFAULT_TERMS_DRAFT = {
    title: 'טיוטת תנאי פנייה לשותפות',
    text: 'זהו נוסח מוצע לעיון בעלת המערכת לפני פרסום. הפנייה היא בקשה לבדיקה. הגשתה אינה יוצרת חשבון, הרשאה, שותפות פעילה או התחייבות. אישור הקריאה אינו חתימה על הסכם.'
  };
  function operation(request, result, authority) { return { request, result, authority }; }
  const OPERATIONS = {
    intakePublicInfo: operation({}, { terms: 'IntakeTerms|null', acceptingApplications: 'boolean' }, 'public; published terms only'),
    intakeSubmit: operation({ requestId: 'uuid', termsVersionId: 'uuid', termsHash: 'sha256', acknowledged: 'true', application: 'PublicApplicationData' }, { receipt: 'IntakeReceipt {id,status:submitted,submittedAt}' }, 'public proposal only; no identity or grants'),
    intakeOwnerBootstrap: operation({}, { termsState: 'IntakeTermsState {revision,draftVersion,publishedVersionId}', identities: 'IndividualIdentity[]', institutions: 'string[]' }, 'owner'),
    intakeList: operation({ status: 'IntakeStatus?', query: 'string?', cursor: 'string?' }, { applications: 'IntakeApplicationSummary[]', nextCursor: 'string|null' }, 'owner'),
    intakeGet: operation({ applicationId: 'uuid' }, { application: 'IntakeApplication', terms: 'IntakeTerms', workspace: 'WorkspaceSummary?' }, 'owner'),
    intakeTermsSave: operation({ requestId: 'uuid', expectedRevision: 'integer', title: 'string', text: 'string' }, { termsState: 'IntakeTermsState' }, 'owner; proposed draft only'),
    intakeTermsPublish: operation({ requestId: 'uuid', expectedRevision: 'integer', versionId: 'uuid' }, { termsState: 'IntakeTermsState' }, 'owner; explicit exact-version publication'),
    intakeReview: operation({ requestId: 'uuid', applicationId: 'uuid', expectedRevision: 'integer', decision: 'under_review|rejected|approved', note: 'string?', studyId: 'uuid? approval only', studyExpectedRevision: 'integer? approval only', individualCode: 'string? approval only', permissions: 'string[]? approval only; explicit view_study' }, { application: 'IntakeApplication', partner: 'Partner?', workspace: 'WorkspaceSummary?', preparation: 'PreparedAgreement?' }, 'owner; approval binds selected live identity and explicit study grants'),
    intakeIdentityCreate: operation({ requestId: 'uuid', institution: 'string', label: 'string' }, { identity: 'IndividualIdentity' }, 'owner; existing access mechanism; no automatic tool or research grants')
  };
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const PERMISSIONS = partnerships.RECORD_SCHEMAS.application.fields.find(field => field.id === 'requestedPermissions').choices;
  const publicFieldIds = new Set(PUBLIC_FIELDS.map(field => field.id));
  function invalid() { throw partnerships.safeError('invalid'); }
  function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null); }
  function nonempty(value) { return value !== undefined && value !== null && (typeof value !== 'string' || value.trim() !== '') && (!Array.isArray(value) || value.length > 0); }
  function string(value, maxLength = 20000, required = false) { if (typeof value !== 'string' || value.length > maxLength || required && !value.trim()) invalid(); return value; }
  function uuid(value) { if (typeof value !== 'string' || !UUID.test(value)) invalid(); return value; }
  function revision(value) { if (!Number.isSafeInteger(value) || value < 0) invalid(); return value; }
  function application(value) {
    if (!object(value) || Object.keys(value).some(key => !publicFieldIds.has(key))) invalid();
    const checked = partnerships.validateRecord('application', value);
    if (SUBMISSION_REQUIRED_FIELDS.some(key => !nonempty(checked[key])) || checked.applicantType === 'institution' && !nonempty(checked.institution)) invalid();
    return checked;
  }
  function validatePayload(action, body) {
    if (typeof action !== 'string' || !own(OPERATIONS, action) || !object(body)) invalid();
    const isPublic = PUBLIC_ACTIONS.includes(action);
    const fields = OPERATIONS[action].request;
    for (const key of Object.keys(body)) {
      if (key === 'action') { if (body.action !== action) invalid(); }
      else if (key === 'token' && !isPublic) continue;
      else if (!own(fields, key)) invalid();
    }
    const result = {};
    for (const [key, type] of Object.entries(fields)) {
      if (!own(body, key)) { if (!type.includes('?')) invalid(); continue; }
      const value = body[key];
      if (key === 'application') result[key] = application(value);
      else if (type.startsWith('uuid')) result[key] = uuid(value);
      else if (type.startsWith('integer')) result[key] = revision(value);
      else if (key === 'termsHash') { if (typeof value !== 'string' || !/^[a-f0-9]{64}$/i.test(value)) invalid(); result[key] = value.toLowerCase(); }
      else if (key === 'acknowledged') { if (value !== true) invalid(); result[key] = true; }
      else if (key === 'status') { if (typeof value !== 'string' || !own(APPLICATION_STATUSES, value)) invalid(); result[key] = value; }
      else if (key === 'decision') { if (!['under_review', 'rejected', 'approved'].includes(value)) invalid(); result[key] = value; }
      else if (key === 'permissions') {
        if (!Array.isArray(value) || value.length > PERMISSIONS.length || new Set(value).size !== value.length || !value.includes('view_study') || value.some(permission => !PERMISSIONS.includes(permission))) invalid();
        result[key] = [...value];
      } else result[key] = string(value, key === 'title' ? 240 : key === 'query' ? 500 : key === 'cursor' ? 2000 : key === 'individualCode' ? 100 : 20000, ['title', 'text', 'institution', 'label', 'individualCode'].includes(key));
    }
    if (action === 'intakeReview') {
      const approvalFields = ['studyId', 'studyExpectedRevision', 'individualCode', 'permissions'];
      if (result.decision === 'approved' ? approvalFields.some(key => !own(result, key)) : approvalFields.some(key => own(result, key))) invalid();
    }
    return result;
  }
  return freeze({ VERSIONS, PUBLIC_ACTIONS, CLIENT_ACTIONS, READ_ACTIONS, OPERATIONS, APPLICANT_TYPES, APPLICATION_STATUSES, PUBLIC_FIELDS, SUBMISSION_REQUIRED_FIELDS, DEFAULT_TERMS_DRAFT, validatePayload });
});
