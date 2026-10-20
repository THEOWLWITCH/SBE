import { createHmac } from 'node:crypto';
import { createRequire } from 'node:module';
import { verifyToken, ilToday, isActiveResearchIdentity } from './access.mjs';
import { decryptResearchValue, encryptResearchValue, researchContactOptions, researchDigest } from './research-mail.mjs';
import { handlePartnership, isPartnershipAction } from './research-partnerships.mjs';
import { handleIntake, isIntakeAction } from './research-intake.mjs';

const require = createRequire(import.meta.url);
const CORE = require('../../app/lib/research-core.js');
const COMMUNICATION = require('../../app/lib/communication-core.js');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OPAQUE = /^[A-Za-z0-9_-]{43}$/;
const own = Object.hasOwn;
const fail = (status, code) => { throw Object.assign(new Error(code), { status, code }); };
const invalid = () => fail(400, 'invalid');
const CLIENT = new Set(CORE.CLIENT_ACTIONS);
const MUTATIONS = new Set(['studyCreate', 'studySave', 'studyStatus', 'memberSet', 'memberRemove', 'versionSave', 'versionPublish', 'mailResolve', 'contactQueue', 'retentionRun', 'inviteCreate', 'enroll', 'verifyEmail', 'reconsent', 'preferencesSet', 'emailChange', 'withdraw', 'eraseMyData', 'surveySubmit', 'sampleSubmit']);
const REVISED = new Set(['studySave', 'studyStatus', 'memberSet', 'memberRemove', 'versionSave', 'versionPublish']);
const OWNER_ACTIONS = new Set(['studyCreate', 'studyStatus', 'mailResolve', 'retentionRun']);
const PARTICIPANT_ACTIONS = new Set(['inviteInfo', 'enroll', 'verifyEmail', 'myStudies', 'participationGet', 'reconsent', 'preferencesSet', 'emailChange', 'withdraw', 'eraseMyData', 'surveySubmit', 'sampleSubmit']);
const UNSCOPED = new Set(['bootstrap', 'studyCreate', 'inviteInfo', 'enroll', 'myStudies']);
const FIELDS = Object.freeze({
  bootstrap: [], studyCreate: ['config'], studyGet: [], studySave: ['config'], studyStatus: ['status', 'confirmApprovals'],
  memberList: [], memberSet: ['code', 'role', 'permissions', 'delegablePermissions'], memberRemove: ['memberId'],
  versionList: ['kind'], versionSave: ['kind', 'definition'], versionPublish: ['versionId'], participantList: [], contactGet: ['participantId'],
  resultsGet: ['category'], exportData: ['category', 'includeContent'], auditList: [], mailList: [], mailResolve: ['messageId', 'outcome', 'evidence'],
  contactQueue: ['participantIds', 'kind', 'subject', 'text'], retentionRun: [], inviteCreate: [], inviteInfo: ['invite'],
  enroll: ['invite', 'consentVersionId', 'consents', 'email', 'preferences'], verifyEmail: ['verificationToken'], myStudies: [], participationGet: [],
  reconsent: ['consentVersionId', 'consents', 'preferences'], preferencesSet: ['preferences'], emailChange: ['email'], withdraw: [], eraseMyData: [],
  surveySubmit: ['instrumentVersionId', 'waveId', 'answers'], sampleSubmit: ['source', 'category', 'approximateDate', 'audience', 'sourceType', 'text', 'ownAuthorship', 'minimized', 'consentVersionId', 'generatedSource'], sampleGet: ['sampleId']
});
const RESULT_KEYS = Object.freeze({
  bootstrap: ['owner', 'studies'], studyCreate: ['study'], studyGet: ['study'], studySave: ['study'], studyStatus: ['study'],
  memberList: ['members'], memberSet: ['members', 'revision'], memberRemove: ['members', 'revision'], versionList: ['versions'], versionSave: ['version', 'revision'], versionPublish: ['version', 'revision'],
  participantList: ['participants'], contactGet: ['contact'], resultsGet: ['category', 'rows', 'dictionary', 'versions'], exportData: ['category', 'rows', 'dictionary', 'versions'],
  auditList: ['events'], mailList: ['messages'], mailResolve: ['message'], contactQueue: ['queued'], retentionRun: ['removed'], inviteCreate: ['invite'], inviteInfo: ['study', 'consent', 'instruments'],
  enroll: ['participation', 'verificationPending'], verifyEmail: ['participation'], myStudies: ['participations'], participationGet: ['participation', 'study', 'consent', 'instruments', 'responses'],
  reconsent: ['participation'], preferencesSet: ['participation'], emailChange: ['participation', 'verificationPending'], withdraw: ['participation'], eraseMyData: ['erased'], surveySubmit: ['response'], sampleSubmit: ['sample'], sampleGet: ['sample']
});
const FIXED_GRANTS = Object.freeze({ studySave: ['edit_study'], memberList: ['manage_researchers'], memberSet: ['manage_researchers'], memberRemove: ['manage_researchers'],
  participantList: ['manage_participants'], contactGet: ['view_identifiable_data', 'contact_participants'], auditList: ['view_audit_log'], mailList: ['contact_participants'],
  contactQueue: ['contact_participants', 'view_identifiable_data'], inviteCreate: ['manage_participants'] });

function object(value, fields) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || (fields && Object.keys(value).some(key => !fields.includes(key)))) invalid();
  return value;
}
function string(value, max, { required = true, trim = true } = {}) {
  if (!required && value == null) return '';
  if (typeof value !== 'string' || value.length > max || /\x00/.test(value) || (required && !value.trim())) invalid();
  return trim ? value.trim() : value;
}
function integer(value, min = 0, max = 100000) {
  if (!Number.isSafeInteger(value) || value < min || value > max) invalid();
  return value;
}
function uuid(value) { if (typeof value !== 'string' || !UUID.test(value)) invalid(); return value.toLowerCase(); }
function enumerated(value, values) { if (!values.includes(value)) invalid(); return value; }
function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) invalid();
  const timestamp = Date.parse(value + 'T00:00:00Z');
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) invalid();
  return value;
}
function array(value, validate, max = 100) {
  if (!Array.isArray(value) || value.length > max) invalid();
  return value.map(validate);
}
function unique(value, validate, max = 100) {
  const values = array(value, validate, max);
  if (new Set(values).size !== values.length) invalid();
  return values;
}
const permissions = values => unique(values, value => enumerated(value, Object.keys(CORE.PERMISSIONS)), Object.keys(CORE.PERMISSIONS).length);
const categories = values => unique(values, value => enumerated(value, Object.keys(CORE.DATA_CATEGORIES)), 6);
const contactKinds = values => unique(values, value => enumerated(value, Object.keys(CORE.CONTACT_KINDS)), 3);
function preferences(value) {
  object(value, Object.keys(CORE.CONTACT_KINDS));
  return Object.fromEntries(Object.keys(CORE.CONTACT_KINDS).map(key => {
    if (own(value, key) && typeof value[key] !== 'boolean') invalid();
    return [key, value[key] === true];
  }));
}
function consents(value) {
  object(value, ['participate', 'surveys', 'usage', 'historical', 'generated']);
  if (value.participate !== true) invalid();
  return Object.fromEntries(['participate', 'surveys', 'usage', 'historical', 'generated'].map(key => {
    if (own(value, key) && typeof value[key] !== 'boolean') invalid();
    return [key, value[key] === true];
  }));
}
function email(value) {
  const normalized = string(value, 254).toLowerCase();
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(normalized)) invalid();
  return normalized;
}
const opaque = value => { if (typeof value !== 'string' || !OPAQUE.test(value)) invalid(); return value; };
const formKind = value => enumerated(value, ['consent', 'instrument']);

export function validateStudyConfig(input) {
  object(input, ['title', 'description', 'researchQuestions', 'principalInvestigator', 'population', 'eligibleInstitutions', 'startDate', 'endDate', 'approvals', 'consentVersionId', 'instrumentVersionIds', 'schedule', 'dataCategories', 'exportCategories', 'retentionDays', 'withdrawalPolicy', 'contactKinds', 'expectations']);
  const out = {};
  for (const key of ['title', 'principalInvestigator']) if (own(input, key)) out[key] = string(input[key], 240, { required: false });
  for (const key of ['description', 'population', 'expectations']) if (own(input, key)) out[key] = string(input[key], 20000, { required: false });
  if (own(input, 'researchQuestions')) out.researchQuestions = array(input.researchQuestions, value => string(value, 2000), 100);
  if (own(input, 'eligibleInstitutions')) out.eligibleInstitutions = unique(input.eligibleInstitutions, value => string(value, 240), 200);
  for (const key of ['startDate', 'endDate']) if (own(input, key)) out[key] = input[key] ? date(input[key]) : '';
  if (out.startDate && out.endDate && out.startDate > out.endDate) invalid();
  if (own(input, 'approvals')) {
    object(input.approvals, ['status', 'reference', 'documentation']);
    out.approvals = { status: enumerated(input.approvals.status, ['pending', 'approved']), reference: string(input.approvals.reference, 2000, { required: false }), documentation: string(input.approvals.documentation, 20000, { required: false }) };
  }
  if (own(input, 'consentVersionId')) out.consentVersionId = input.consentVersionId ? uuid(input.consentVersionId) : null;
  if (own(input, 'instrumentVersionIds')) out.instrumentVersionIds = unique(input.instrumentVersionIds, uuid, 100);
  if (own(input, 'schedule')) {
    out.schedule = array(input.schedule, wave => {
      object(wave, ['waveId', 'instrumentVersionId', 'offsetDays', 'reminderDays']);
      const waveId = string(wave.waveId, 100);
      if (!/^[A-Za-z0-9_-]+$/.test(waveId)) invalid();
      return { waveId, instrumentVersionId: uuid(wave.instrumentVersionId), offsetDays: integer(wave.offsetDays, 0, 36500), reminderDays: unique(Array.isArray(wave.reminderDays) ? wave.reminderDays : wave.reminderDays == null ? [] : [wave.reminderDays], value => integer(value, 1, 36500), 100) };
    }, 100);
    if (new Set(out.schedule.map(wave => wave.waveId)).size !== out.schedule.length) invalid();
  }
  for (const key of ['dataCategories', 'exportCategories']) if (own(input, key)) out[key] = categories(input[key]);
  if (own(input, 'retentionDays')) out.retentionDays = integer(input.retentionDays, 1, 36500);
  if (own(input, 'withdrawalPolicy')) out.withdrawalPolicy = enumerated(input.withdrawalPolicy, ['erase', 'retain-consented']);
  if (own(input, 'contactKinds')) out.contactKinds = contactKinds(input.contactKinds);
  return out;
}

export function validateConsent(input) {
  object(input, ['title', 'text', 'categories', 'contactKinds', 'retentionDays', 'withdrawalPolicy', 'expectations']);
  return { title: string(input.title, 240), text: string(input.text, 100000, { trim: false }), categories: categories(input.categories), contactKinds: contactKinds(input.contactKinds), retentionDays: integer(input.retentionDays, 1, 36500), withdrawalPolicy: enumerated(input.withdrawalPolicy, ['erase', 'retain-consented']), expectations: string(input.expectations, 20000, { required: false }) };
}

export function validateInstrument(input) {
  object(input, ['title', 'construct', 'validationStatus', 'description', 'items']);
  const out = { title: string(input.title, 240), construct: string(input.construct, 200), validationStatus: enumerated(input.validationStatus, ['under-development', 'study-approved']), description: string(input.description, 20000, { required: false }) };
  out.items = array(input.items, item => {
    object(item, ['id', 'type', 'label', 'required', 'options', 'min', 'max']);
    const id = string(item.id, 100);
    if (!/^[A-Za-z0-9_-]+$/.test(id) || typeof item.required !== 'boolean') invalid();
    const value = { id, type: enumerated(item.type, Object.keys(CORE.ITEM_TYPES)), label: string(item.label, 2000), required: item.required };
    if (['choice', 'multiple'].includes(value.type)) {
      value.options = unique(item.options, option => string(option, 1000), 100);
      if (!value.options.length) invalid();
    } else if (own(item, 'options')) invalid();
    if (['number', 'likert'].includes(value.type)) {
      for (const key of ['min', 'max']) if (own(item, key)) {
        if (typeof item[key] !== 'number' || !Number.isFinite(item[key])) invalid();
        value[key] = item[key];
      }
      if (value.min !== undefined && value.max !== undefined && value.min > value.max) invalid();
      if (value.type === 'likert' && (!Number.isSafeInteger(value.min) || !Number.isSafeInteger(value.max))) invalid();
    } else if (own(item, 'min') || own(item, 'max')) invalid();
    return value;
  }, 200);
  if (new Set(out.items.map(item => item.id)).size !== out.items.length) invalid();
  return out;
}

export function validateAnswers(definition, input) {
  object(input, definition.items.map(item => item.id));
  const out = Object.create(null);
  for (const item of definition.items) {
    const answer = input[item.id];
    if (!own(input, item.id) || answer == null || answer === '') {
      if (item.required) invalid();
      if (own(input, item.id)) out[item.id] = answer;
      continue;
    }
    switch (item.type) {
      case 'number': case 'likert':
        if (typeof answer !== 'number' || !Number.isFinite(answer) || item.type === 'likert' && !Number.isSafeInteger(answer) || item.min !== undefined && answer < item.min || item.max !== undefined && answer > item.max) invalid();
        out[item.id] = answer; break;
      case 'choice': out[item.id] = enumerated(answer, item.options); break;
      case 'multiple':
        out[item.id] = unique(answer, value => enumerated(value, item.options), item.options.length);
        if (item.required && !out[item.id].length) invalid();
        break;
      case 'date': out[item.id] = date(answer); break;
      case 'text': out[item.id] = string(answer, 20000, { trim: false }); break;
      default: invalid();
    }
  }
  return { ...out };
}

// Existing custom sessions do not contain research permissions. Recheck their
// current personal credential/subscription, then SQL independently locks/rechecks.
export async function verifyResearchIdentity(accessStore, token) {
  if (!accessStore?.get) fail(503, 'not_configured');
  if (typeof token !== 'string' || token.length > 16000 || token.split('.').length !== 2) fail(403, 'unauthorized');
  if (!(await accessStore.get('token-secret'))?.secret) fail(503, 'not_configured');
  const actor = await verifyToken(accessStore, token);
  if (!actor) fail(403, 'unauthorized');
  if (actor.k === 'sys') return { ...actor, owner: true };
  if (actor.k !== 'code' || actor.c === 'LEGACY' || !['staff', 'instadmin'].includes(actor.kind) || typeof actor.c !== 'string' || !/^[A-Z0-9]+$/.test(actor.c)) fail(403, 'unauthorized');
  const rec = await accessStore.get('code:' + actor.c);
  if (!rec || rec.kind !== actor.kind || rec.inst !== actor.inst || !(await isActiveResearchIdentity(accessStore, rec))) fail(403, 'unauthorized');
  return { ...actor, owner: false };
}

function payloadFor(body) {
  const action = body.action;
  object(body, ['token', 'action', 'requestId', 'studyId', 'expectedRevision', ...FIELDS[action]]);
  const payload = {};
  if (MUTATIONS.has(action)) payload.requestId = uuid(body.requestId);
  else if (own(body, 'requestId')) payload.requestId = uuid(body.requestId);
  if (!UNSCOPED.has(action)) payload.studyId = uuid(body.studyId);
  else if (own(body, 'studyId')) invalid();
  if (REVISED.has(action)) payload.expectedRevision = integer(body.expectedRevision, 0, Number.MAX_SAFE_INTEGER);
  else if (own(body, 'expectedRevision')) invalid();
  switch (action) {
    case 'studyCreate': case 'studySave': payload.config = validateStudyConfig(body.config); break;
    case 'studyStatus':
      payload.status = enumerated(body.status, Object.keys(CORE.STUDY_STATUSES));
      if (own(body, 'confirmApprovals') && typeof body.confirmApprovals !== 'boolean') invalid();
      payload.confirmApprovals = body.confirmApprovals === true; break;
    case 'memberSet':
      payload.code = string(body.code, 100).toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (!payload.code) invalid();
      payload.role = enumerated(body.role, Object.keys(CORE.ROLES)); payload.permissions = permissions(body.permissions);
      if (own(body, 'delegablePermissions')) payload.delegablePermissions = permissions(body.delegablePermissions); break;
    case 'memberRemove': payload.memberId = uuid(body.memberId); break;
    case 'versionList': payload.kind = formKind(body.kind); break;
    case 'versionSave':
      payload.kind = formKind(body.kind); payload.definition = payload.kind === 'consent' ? validateConsent(body.definition) : validateInstrument(body.definition); break;
    case 'versionPublish': payload.versionId = uuid(body.versionId); break;
    case 'contactGet': payload.participantId = uuid(body.participantId); break;
    case 'resultsGet': payload.category = enumerated(body.category, ['aggregate', 'surveys', 'usage', 'historical', 'generated']); break;
    case 'exportData':
      payload.category = enumerated(body.category, Object.keys(CORE.DATA_CATEGORIES));
      if (own(body, 'includeContent') && typeof body.includeContent !== 'boolean') invalid();
      payload.includeContent = body.includeContent === true;
      if (payload.includeContent && !['historical', 'generated'].includes(payload.category)) invalid(); break;
    case 'mailResolve':
      payload.messageId = uuid(body.messageId); payload.outcome = enumerated(body.outcome, ['accepted', 'not_sent']); payload.evidence = string(body.evidence, 2000); break;
    case 'contactQueue':
      payload.participantIds = unique(body.participantIds, uuid, 1000); if (!payload.participantIds.length) invalid();
      payload.kind = enumerated(body.kind, ['feedback', 'update']); payload.subject = string(body.subject, 240);
      if (/[\r\n]/.test(payload.subject)) invalid();
      payload.text = string(body.text, 100000, { trim: false }); break;
    case 'inviteInfo': payload.invite = opaque(body.invite); break;
    case 'enroll':
      payload.invite = opaque(body.invite); payload.consentVersionId = uuid(body.consentVersionId); payload.consents = consents(body.consents); payload.preferences = preferences(body.preferences); payload.email = email(body.email); break;
    case 'verifyEmail': payload.verificationToken = opaque(body.verificationToken); break;
    case 'reconsent': payload.consentVersionId = uuid(body.consentVersionId); payload.consents = consents(body.consents); payload.preferences = preferences(body.preferences); break;
    case 'preferencesSet': payload.preferences = preferences(body.preferences); break;
    case 'emailChange': payload.email = email(body.email); break;
    case 'surveySubmit':
      payload.instrumentVersionId = uuid(body.instrumentVersionId); payload.waveId = string(body.waveId, 100); object(body.answers); payload.answers = body.answers; break;
    case 'sampleSubmit':
      payload.source = enumerated(body.source, ['historical', 'generated']); payload.category = string(body.category, 200); payload.approximateDate = string(body.approximateDate, 100, { required: false });
      payload.audience = string(body.audience, 200); payload.sourceType = string(body.sourceType, 200); payload.consentVersionId = uuid(body.consentVersionId);
      if (body.ownAuthorship !== true || body.minimized !== true) invalid();
      payload.ownAuthorship = true; payload.minimized = true;
      if (payload.source === 'historical') { payload.text = string(body.text, 120000, { trim: false }); if (own(body, 'generatedSource')) invalid(); }
      else {
        object(body.generatedSource); payload.generatedSource = generatedSource(body.generatedSource);
        if (own(body, 'text')) string(body.text, 120000, { required: false, trim: false });
      } break;
    case 'sampleGet': payload.sampleId = uuid(body.sampleId); break;
  }
  return payload;
}

function generatedSource(value) {
  if (value.mode === 'single') {
    object(value, ['mode', 'document', 'proof', 'draftId']); object(value.document);
    if (Buffer.byteLength(JSON.stringify(value.document)) > 12 * 1024 * 1024) invalid();
    if (typeof value.proof !== 'string' || !/^[a-f0-9]{64}$/.test(value.proof)) invalid();
    return { mode: 'single', document: value.document, proof: value.proof, draftId: uuid(value.draftId) };
  }
  if (value.mode === 'continuity') {
    object(value, ['mode', 'conversationId', 'entryId']);
    return { mode: 'continuity', conversationId: uuid(value.conversationId), entryId: uuid(value.entryId) };
  }
  invalid();
}

async function call(store, token, action, payload) {
  if (!store?.rpc) fail(503, 'not_configured');
  const result = await store.rpc(token, action, payload);
  if (result?.error) fail(Number(result.status) || 503, result.code || result.error);
  return result || {};
}
function grantsFor(action, payload) {
  if (FIXED_GRANTS[action]) return FIXED_GRANTS[action];
  if (['versionList', 'versionSave'].includes(action)) return [payload.kind === 'consent' ? 'manage_consent' : 'manage_questionnaires'];
  if (action === 'resultsGet') return [payload.category === 'aggregate' ? 'view_aggregate_results' : 'view_pseudonymized_data'];
  if (action === 'exportData') return ['export_data', ...(payload.category === 'contacts' ? ['view_identifiable_data', 'contact_participants'] : payload.category === 'identities' ? ['view_identifiable_data'] : ['view_pseudonymized_data']), ...(payload.includeContent ? ['view_document_content'] : [])];
  return [];
}

async function authorizeAction(store, token, actor, action, payload) {
  if (OWNER_ACTIONS.has(action) && !actor.owner) fail(403, 'unauthorized');
  if (PARTICIPANT_ACTIONS.has(action) && actor.owner) fail(403, 'unauthorized');
  if (actor.owner || UNSCOPED.has(action) || PARTICIPANT_ACTIONS.has(action)) return;
  if (action === 'sampleGet') {
    try {
      const context = await call(store, token, 'studyGet', { studyId: payload.studyId });
      if (context.study?.permissions?.includes('view_study') && context.study.permissions.includes('view_document_content')) return;
    } catch (error) { if (![403, 404].includes(error.status)) throw error; }
    // A participant may inspect only their own separately consented sample;
    // the actual sample ownership/content grant is checked again inside SQL.
    await call(store, token, 'participationGet', { studyId: payload.studyId }); return;
  }
  if (action === 'studyGet') return; // SQL's exact-scope view check is the preflight itself.
  const { study } = await call(store, token, 'studyGet', { studyId: payload.studyId });
  const allowed = study?.permissions || [];
  if (!allowed.includes('view_study') || !grantsFor(action, payload).every(permission => allowed.includes(permission))) fail(403, 'unauthorized');
  if (action === 'versionPublish') {
    const kinds = [['consent', 'manage_consent'], ['instrument', 'manage_questionnaires']].filter(([, permission]) => allowed.includes(permission));
    if (!kinds.length) fail(403, 'unauthorized');
    let found = false;
    for (const [kind] of kinds) {
      const { versions } = await call(store, token, 'versionList', { studyId: payload.studyId, kind });
      if (versions?.some(version => version.id === payload.versionId && version.kind === kind)) { found = true; break; }
    }
    if (!found) fail(404, 'not_found');
  }
  if (action === 'memberSet') {
    if (own(payload, 'delegablePermissions') || payload.code === actor.c || !payload.permissions.every(permission => (study.delegablePermissions || []).includes(permission))) fail(403, 'unauthorized');
  }
  if (action === 'memberRemove') {
    const { members } = await call(store, token, 'memberList', { studyId: payload.studyId });
    const member = members?.find(value => value.id === payload.memberId);
    if (!member) fail(404, 'not_found');
    if (member.self === true) fail(403, 'unauthorized');
  }
}

async function opaqueFor(accessStore, actor, purpose, scope, requestId, destination = '') {
  const secret = (await accessStore.get('token-secret'))?.secret;
  if (typeof secret !== 'string' || !secret) fail(503, 'not_configured');
  return createHmac('sha256', secret).update(JSON.stringify(['BEGOOD/research/token/v1', purpose, actor.owner ? 'sys' : ['code', actor.c, actor.kind, actor.inst], scope, requestId, destination])).digest('base64url');
}

function versionsSnapshot() {
  return { application: CORE.VERSIONS.application, research: CORE.VERSIONS.research, schema: CORE.VERSIONS.schema, metrics: CORE.VERSIONS.metrics, tool: COMMUNICATION.VERSIONS.tool, prompt: COMMUNICATION.VERSIONS.prompt, engine: COMMUNICATION.VERSIONS.engine, principles: COMMUNICATION.VERSIONS.principles, model: null };
}
function collectionAllowed(details, category, payload, options) {
  const participant = details.participation, study = details.study;
  if (!participant || participant.status !== 'enrolled' || participant.verified !== true || study?.status !== 'active') fail(409, 'conflict');
  const config = study.config || {};
  if (!config.consentVersionId || participant.consentVersionId !== config.consentVersionId || payload.consentVersionId && payload.consentVersionId !== config.consentVersionId) fail(409, 'consent_changed');
  if (participant.consents?.participate !== true || participant.consents[category] !== true || !config.dataCategories?.includes(category)) fail(403, 'unauthorized');
  const now = typeof options.now === 'function' ? options.now() : options.now ?? Date.now();
  const today = ilToday(new Date(now));
  if (config.startDate && today < config.startDate || config.endDate && today > config.endDate) fail(409, 'conflict');
}
function publicResult(action, result) {
  return Object.fromEntries(RESULT_KEYS[action].filter(key => own(result, key)).map(key => [key, result[key]]));
}
function cell(value) {
  let text = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (/^[\s\uFEFF]*[=+\-@]/u.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
export function researchCsv(rows) {
  const fields = [...new Set(rows.flatMap(row => Object.keys(row)))];
  return '\uFEFF' + [fields.map(cell).join(','), ...rows.map(row => fields.map(field => cell(row[field])).join(','))].join('\r\n');
}

export async function handleResearch(accessStore, researchStore, body, options = {}) {
  try {
    object(body);
    if (isIntakeAction(body.action)) return await handleIntake(accessStore, researchStore, body, { ...options, privateEndpoint: true, verifyIdentity: verifyResearchIdentity });
    if (isPartnershipAction(body.action)) return await handlePartnership(accessStore, researchStore, body, { ...options, verifyIdentity: verifyResearchIdentity });
    if (typeof body.action !== 'string' || !CLIENT.has(body.action)) invalid();
    const action = body.action;
    const payload = payloadFor(body);
    const actor = await verifyResearchIdentity(accessStore, body.token);
    await authorizeAction(researchStore, body.token, actor, action, payload);
    let returnedInvite;
    if (action === 'inviteCreate') {
      returnedInvite = await opaqueFor(accessStore, actor, 'invite', payload.studyId, payload.requestId);
      payload.inviteDigest = researchDigest(returnedInvite);
      const now = typeof options.now === 'function' ? options.now() : options.now ?? Date.now();
      payload.expiresAt = new Date(now + 30 * 86400000).toISOString();
    }
    if (action === 'inviteInfo' || action === 'enroll') { payload.inviteDigest = researchDigest(payload.invite); delete payload.invite; }
    if (action === 'verifyEmail') { payload.verificationDigest = researchDigest(payload.verificationToken); delete payload.verificationToken; }
    if (action === 'enroll' || action === 'emailChange') {
      const settings = researchContactOptions(options);
      const details = action === 'enroll'
        ? await call(researchStore, body.token, 'inviteInfo', { inviteDigest: payload.inviteDigest })
        : await call(researchStore, body.token, 'participationGet', { studyId: payload.studyId });
      const studyId = uuid(details.study?.id || payload.studyId);
      const verificationToken = await opaqueFor(accessStore, actor, 'verification', studyId, payload.requestId, payload.email);
      const portal = new URL('/research-participation.html', settings.siteOrigin); portal.searchParams.set('study', studyId);
      const verificationLink = portal.href + '#verify=' + verificationToken;
      const title = string(details.study?.title || 'מחקר BE GOOD', 240);
      const expectations = string(details.study?.expectations ?? details.study?.config?.expectations ?? '', 20000, { required: false });
      payload.destinationHash = researchDigest(payload.email);
      payload.verificationDigest = researchDigest(verificationToken);
      payload.contactCiphertext = encryptResearchValue({ email: payload.email }, settings.contactKey);
      payload.verificationCiphertext = encryptResearchValue({ email: payload.email, verificationToken, subject: 'BE GOOD: אימות כתובת למחקר', text: `בחרת להשתתף במחקר "${title}".\n\nאפשר לאמת את הכתובת בקישור הבא, ואז לאשר את האימות במסך ההשתתפות:\n${verificationLink}\n\nהקישור תקף ל־30 דקות. אם לא ביקשת את ההודעה, אפשר להתעלם ממנה.` }, settings.contactKey);
      payload.welcomeCiphertext = encryptResearchValue({ subject: 'BE GOOD: תודה על ההצטרפות למחקר', text: `תודה על ההצטרפות למחקר "${title}".\n\n${expectations}\n\nאפשר לענות על שאלונים, לעדכן העדפות קשר או לסיים את ההשתתפות כאן:\n${portal.href}` }, settings.contactKey);
      payload.followupCiphertext = encryptResearchValue({ subject: 'BE GOOD: שאלון המשך למחקר', text: `אפשר לעיין בשאלוני ההמשך ובהסבר המחקר במסך ההשתתפות:\n${portal.href}\n\nאפשר גם לשנות העדפות קשר או לסיים את ההשתתפות באותו מסך.` }, settings.contactKey);
      delete payload.email;
    }
    if (action === 'contactQueue') {
      const settings = researchContactOptions(options);
      payload.bodyDigest = researchDigest(JSON.stringify({ subject: payload.subject, text: payload.text }));
      payload.encryptedBody = encryptResearchValue({ subject: payload.subject, text: payload.text }, settings.contactKey);
      delete payload.subject; delete payload.text;
    }
    if (action === 'surveySubmit') {
      const details = await call(researchStore, body.token, 'participationGet', { studyId: payload.studyId });
      collectionAllowed(details, 'surveys', payload, options);
      const instrument = details.instruments?.find(value => value.id === payload.instrumentVersionId || value.versionId === payload.instrumentVersionId);
      if (!instrument) fail(404, 'not_found');
      if (!instrument.published || !details.study.config.schedule?.some(wave => wave.waveId === payload.waveId && wave.instrumentVersionId === payload.instrumentVersionId)) fail(409, 'conflict');
      payload.answers = validateAnswers(validateInstrument(instrument.definition), payload.answers);
      payload.versions = versionsSnapshot();
    }
    if (action === 'sampleSubmit') {
      const details = await call(researchStore, body.token, 'participationGet', { studyId: payload.studyId });
      collectionAllowed(details, payload.source, payload, options);
      if (payload.source === 'generated') {
        if (typeof options.resolveGeneratedSample !== 'function') fail(503, 'not_configured');
        const source = await options.resolveGeneratedSample({ token: body.token, generatedSource: payload.generatedSource, studyId: payload.studyId });
        payload.text = string(source?.text, 120000, { trim: false });
        if (own(body, 'text') && body.text !== payload.text) fail(409, 'conflict');
        object(source.versions);
        payload.versions = { ...versionsSnapshot(), ...Object.fromEntries(['tool', 'prompt', 'engine', 'principles', 'model', 'editVersions', 'sourceRevision'].map(key => [key, source.versions[key] ?? null])) };
        payload.sourceId = string(source.sourceId, 500);
        payload.mode = enumerated(source.mode || payload.generatedSource.mode, ['single', 'continuity']);
        payload.provenance = 'verified-BE-GOOD'; payload.usedBeGood = true;
        delete payload.generatedSource;
      } else {
        payload.versions = { ...versionsSnapshot(), tool: null, prompt: null, engine: null, principles: null, model: null };
        payload.provenance = 'participant-declared'; payload.usedBeGood = false;
      }
    }
    const result = await call(researchStore, body.token, action, payload);
    const out = publicResult(action, result);
    if (action === 'bootstrap') out.owner = actor.owner;
    if (action === 'inviteCreate') out.invite = { ...out.invite, token: returnedInvite };
    if (action === 'contactGet' && out.contact) {
      const key = options.contactKey ?? (options.env || process.env).RESEARCH_CONTACT_KEY;
      const encrypted = out.contact.contactCiphertext || out.contact.ciphertext;
      const contact = decryptResearchValue(encrypted, key);
      out.contact = { participantId: payload.participantId, email: email(contact.email), ...(out.contact.label ? { label: out.contact.label } : {}) };
    }
    if (action === 'exportData') {
      if (payload.category === 'contacts') {
        const key = options.contactKey ?? (options.env || process.env).RESEARCH_CONTACT_KEY;
        out.rows = (out.rows || []).map(row => ({ participantId: row.participantId, email: email(decryptResearchValue(row.contactCiphertext || row.ciphertext, key).email) }));
      }
      out.csv = researchCsv(out.rows || []);
      out.json = JSON.stringify({ category: out.category, rows: out.rows || [], dictionary: out.dictionary || [], versions: out.versions || {} });
    }
    return [200, out];
  } catch (error) {
    const safeCodes = ['invalid', 'unauthorized', 'not_found', 'conflict', 'consent_changed', 'rate_limited', 'not_configured'];
    const code = safeCodes.includes(error.code) ? error.code : safeCodes.includes(error.message) ? error.message : 'storage_unavailable';
    const status = code === 'storage_unavailable' ? 503 : ({ invalid: 400, unauthorized: 403, not_found: 404, conflict: 409, consent_changed: 409, rate_limited: 429, not_configured: 503 })[code];
    return [status, { error: code, code }];
  }
}
