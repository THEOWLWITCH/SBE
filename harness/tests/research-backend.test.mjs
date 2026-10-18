import test from 'node:test';
import assert from 'node:assert/strict';
import { accessFixture, rpcFixture, IDS, CONTACT_KEY, EMAIL, requestId, participantResult, instrumentDefinition } from '../fixtures/research-scenarios.mjs';

const load = () => import('../lib/research.mjs');
const options = { contactKey: CONTACT_KEY, siteOrigin: 'https://example.invalid' };

test('research API denies browser internal operations and asserted authority before RPC', async () => {
  const { handleResearch } = await load(); const a = accessFixture(); const r = rpcFixture();
  for (const body of [{ action: 'recordUsage' }, { action: 'mailClaim' }, { action: 'bootstrap', owner: true }, { action: 'bootstrap', actor: 'RESEARCHA' }]) {
    assert.equal((await handleResearch(a.store, r, { token: a.participant, ...body }))[0], 400);
  }
  assert.equal(r.calls.length, 0);
});

test('shared, expired, revoked and inactive credentials cannot access research', async () => {
  const { handleResearch } = await load(); const a = accessFixture(); const r = rpcFixture();
  for (const token of [a.token({ k: 'inst' }), a.token({ k: 'open' }), a.token({ kind: 'course' }), a.token({ exp: 1 }), a.token({ c: 'LEGACY' })]) assert.equal((await handleResearch(a.store, r, { token, action: 'bootstrap' }))[0], 403);
  a.store.rows.get('code:PARTICIPANT').revoked = true;
  assert.equal((await handleResearch(a.store, r, { token: a.participant, action: 'bootstrap' }))[0], 403);
  a.store.rows.get('code:PARTICIPANT').revoked = false;
  a.store.rows.get('institutions')[0].active = false;
  assert.equal((await handleResearch(a.store, r, { token: a.participant, action: 'bootstrap' }))[0], 403);
  assert.equal(r.calls.length, 0);
});

test('ordinary users cannot create studies and export_data does not grant email or content', async () => {
  const { handleResearch } = await load(); const a = accessFixture();
  const r = rpcFixture(() => ({ study: { id: IDS.studyA, permissions: ['view_study', 'export_data'] } }));
  assert.equal((await handleResearch(a.store, r, { token: a.ordinary, action: 'studyCreate', requestId: requestId(), config: {} }))[0], 403);
  for (const body of [{ action: 'contactGet', participantId: IDS.participant }, { action: 'exportData', category: 'contacts' }, { action: 'exportData', category: 'historical', includeContent: true }]) assert.equal((await handleResearch(a.store, r, { token: a.a, studyId: IDS.studyA, ...body }))[0], 403);
  assert.ok(r.calls.every(c => c.action === 'studyGet'));
});

test('API preserves same sanitized unavailable result for a foreign and unknown study', async () => {
  const { handleResearch } = await load(); const a = accessFixture();
  const r = rpcFixture(() => { throw Object.assign(Error('private database text'), { status: 404, code: 'not_found' }); });
  const foreign = await handleResearch(a.store, r, { token: a.a, action: 'studyGet', studyId: IDS.studyB });
  const unknown = await handleResearch(a.store, r, { token: a.a, action: 'studyGet', studyId: requestId() });
  assert.deepEqual(foreign, unknown); assert.equal(foreign[0], 404); assert.ok(!JSON.stringify(foreign).includes('private'));
});

test('consent preview only reads; explicit enrollment encrypts email/token and never returns either', async () => {
  const { handleResearch } = await load(); const { decryptResearchValue } = await import('../lib/research-mail.mjs');
  const a = accessFixture(); const r = rpcFixture(action => action === 'inviteInfo' ? { ...participantResult(), study: { id: IDS.studyA, title: 'Synthetic A', expectations: 'Synthetic expectations' } } : { participation: participantResult().participation, verificationPending: true });
  const invite = 'i'.repeat(43);
  assert.equal((await handleResearch(a.store, r, { token: a.participant, action: 'inviteInfo', invite }, options))[0], 200);
  assert.deepEqual(r.calls.map(c => c.action), ['inviteInfo']);
  const out = await handleResearch(a.store, r, { token: a.participant, action: 'enroll', requestId: requestId(), invite, consentVersionId: IDS.consent, consents: { participate: true, surveys: true, usage: false, historical: false, generated: false }, email: EMAIL, preferences: { followup: true, feedback: false, update: false } }, options);
  assert.equal(out[0], 200); assert.ok(!JSON.stringify(out).includes(EMAIL));
  const payload = r.calls.find(c => c.action === 'enroll').payload;
  assert.ok(!JSON.stringify(payload).includes(EMAIL)); assert.match(payload.verificationDigest, /^[a-f0-9]{64}$/);
  assert.equal(decryptResearchValue(payload.contactCiphertext, CONTACT_KEY).email, EMAIL);
  assert.ok(decryptResearchValue(payload.verificationCiphertext, CONTACT_KEY).verificationToken);
  assert.ok(payload.welcomeCiphertext); assert.equal(payload.email, undefined);
});

test('mutations require UUID receipts; enrollment refuses absent configuration or false consent', async () => {
  const { handleResearch } = await load(); const a = accessFixture(); const r = rpcFixture();
  assert.equal((await handleResearch(a.store, r, { token: a.owner, action: 'studySave', studyId: IDS.studyA, expectedRevision: 0, config: {} }))[0], 400);
  const b = { token: a.participant, action: 'enroll', invite: 'i'.repeat(43), requestId: requestId(), consentVersionId: IDS.consent, consents: { participate: true }, email: EMAIL, preferences: {} };
  assert.equal((await handleResearch(a.store, r, b))[0], 503);
  assert.equal((await handleResearch(a.store, r, { ...b, consents: { participate: false } }, options))[0], 400);
});

test('configured questionnaire answers support all types and reject extra/range/option values', async () => {
  const { validateInstrument, validateAnswers } = await load(); const d = validateInstrument(instrumentDefinition());
  assert.deepEqual(validateAnswers(d, { confidence: 3, choice: 'A', multiple: ['A'], date: '2026-10-13', number: 0, reflection: 'Synthetic response' }), { confidence: 3, choice: 'A', multiple: ['A'], date: '2026-10-13', number: 0, reflection: 'Synthetic response' });
  for (const answers of [{ confidence: 9 }, { confidence: 3, choice: 'C' }, { confidence: 3, unexpected: 'x' }, { confidence: 3, multiple: ['A', 'A'] }, { confidence: 3, date: '2026-02-30' }]) assert.throws(() => validateAnswers(d, answers));
  assert.equal(d.combinedScore, undefined);
});

test('historical samples are optional and require authorship/minimization; generated versions come from verified resolver', async () => {
  const { handleResearch } = await load(); const a = accessFixture();
  const r = rpcFixture(action => action === 'participationGet' ? participantResult() : { sample: { id: IDS.sample } });
  const b = { token: a.participant, action: 'sampleSubmit', studyId: IDS.studyA, requestId: requestId(), source: 'historical', category: 'letter', approximateDate: '2025', audience: 'parents', sourceType: 'pasted', text: 'Synthetic educator text', consentVersionId: IDS.consent, ownAuthorship: true, minimized: true };
  assert.equal((await handleResearch(a.store, r, { ...b, minimized: false }))[0], 400);
  assert.equal((await handleResearch(a.store, r, b))[0], 200);
  const v = { tool: '1.2.0', prompt: '1.1.1', engine: '1.1.1', principles: '18-1.0.0', model: 'synthetic-model' };
  assert.equal((await handleResearch(a.store, r, { ...b, text: 'Verified synthetic text', source: 'generated', generatedSource: { mode: 'continuity', conversationId: requestId(), entryId: requestId() } }, { resolveGeneratedSample: async () => ({ text: 'Verified synthetic text', versions: v, sourceId: 'private-source-id' }) }))[0], 200);
  const saved = r.calls.filter(c => c.action === 'sampleSubmit').at(-1).payload;
  assert.equal(saved.text, 'Verified synthetic text'); assert.equal(saved.versions.model, 'synthetic-model'); assert.equal(saved.generatedSource, undefined);
});

test('generated sample cannot share a canonical draft differing from the displayed/minimized text', async () => {
  const { handleResearch } = await load(); const a = accessFixture(); const r = rpcFixture(() => participantResult());
  const out = await handleResearch(a.store, r, { token: a.participant, action: 'sampleSubmit', studyId: IDS.studyA, requestId: requestId(), source: 'generated', category: 'letter', audience: 'parents', sourceType: 'BE GOOD', text: 'Minimized displayed text', ownAuthorship: true, minimized: true, consentVersionId: IDS.consent, generatedSource: { mode: 'continuity', conversationId: requestId(), entryId: requestId() } }, { resolveGeneratedSample: async () => ({ text: 'Original includes a third-party identity', versions: {}, sourceId: 'private-source-id' }) });
  assert.equal(out[0], 409); assert.ok(!r.calls.some(call => call.action === 'sampleSubmit'));
});

test('exports include dictionary/manifests and safe CSV while exact JSON preserves input', async () => {
  const { handleResearch } = await load(); const a = accessFixture();
  const rows = [{ participantId: IDS.participant, answer: ' \t=HYPERLINK("x")' }];
  const r = rpcFixture(action => action === 'studyGet' ? { study: { permissions: ['view_study', 'export_data', 'view_pseudonymized_data'] } } : { category: 'surveys', rows, dictionary: [{ field: 'answer', definition: 'Exact response' }], versions: { schema: 1 } });
  const [status, out] = await handleResearch(a.store, r, { token: a.a, action: 'exportData', studyId: IDS.studyA, category: 'surveys' });
  assert.equal(status, 200); assert.ok(out.csv.includes("' \t=HYPERLINK")); assert.deepEqual(JSON.parse(out.json).rows, rows); assert.ok(out.dictionary); assert.equal(out.versions.schema, 1);
});

test('API capture preflight stops paused, unverified, withdrawn, stale and separately unconsented participation', async () => {
  const { handleResearch } = await load(); const a = accessFixture();
  const b = { token: a.participant, action: 'surveySubmit', studyId: IDS.studyA, requestId: requestId(), instrumentVersionId: IDS.instrument, waveId: 'baseline', answers: { confidence: 3 } };
  for (const change of [details => { details.study.status = 'paused'; }, details => { details.participation.verified = false; }, details => { details.participation.status = 'withdrawn'; }, details => { details.participation.consentVersionId = requestId(); }, details => { details.participation.consents.surveys = false; }]) {
    const details = participantResult(); change(details);
    const r = rpcFixture(action => action === 'participationGet' ? details : { response: {} });
    assert.ok((await handleResearch(a.store, r, b))[0] >= 400);
    assert.ok(!r.calls.some(call => call.action === 'surveySubmit'));
  }
});

test('stable enrollment/invite retries preserve token digest while changed destination stays distinct', async () => {
  const { handleResearch } = await load(); const a = accessFixture();
  const r = rpcFixture(action => action === 'inviteInfo' ? participantResult() : action === 'inviteCreate' ? { invite: { studyId: IDS.studyA } } : { verificationPending: true, participation: participantResult().participation });
  const b = { token: a.participant, action: 'enroll', requestId: requestId(), invite: 'i'.repeat(43), consentVersionId: IDS.consent, consents: { participate: true }, email: EMAIL, preferences: {} };
  assert.equal((await handleResearch(a.store, r, b, options))[0], 200);
  assert.equal((await handleResearch(a.store, r, b, options))[0], 200);
  const payloads = r.calls.filter(call => call.action === 'enroll').map(call => call.payload);
  assert.equal(payloads[0].verificationDigest, payloads[1].verificationDigest); assert.equal(payloads[0].destinationHash, payloads[1].destinationHash);
  assert.notDeepEqual(payloads[0].contactCiphertext, payloads[1].contactCiphertext);
  await handleResearch(a.store, r, { ...b, email: 'other@example.invalid' }, options);
  assert.notEqual(r.calls.at(-1).payload.destinationHash, payloads[0].destinationHash);
  const inviteRequest = { token: a.owner, action: 'inviteCreate', studyId: IDS.studyA, requestId: requestId() };
  const first = await handleResearch(a.store, r, inviteRequest); const second = await handleResearch(a.store, r, inviteRequest);
  assert.equal(first[1].invite.token, second[1].invite.token);
});

test('delegated collaborator manager cannot edit self or exceed owner envelope', async () => {
  const { handleResearch } = await load(); const a = accessFixture();
  const r = rpcFixture(action => action === 'studyGet' ? { study: { permissions: ['view_study', 'manage_researchers'], delegablePermissions: ['view_study'] } } : { members: [], revision: 2 });
  const b = { token: a.a, action: 'memberSet', studyId: IDS.studyA, requestId: requestId(), expectedRevision: 1, code: 'RESEARCHB', role: 'assistant', permissions: ['view_study'] };
  assert.equal((await handleResearch(a.store, r, b))[0], 200);
  for (const additions of [{ code: 'RESEARCHA' }, { permissions: ['view_study', 'export_data'] }, { delegablePermissions: ['view_study'] }]) assert.equal((await handleResearch(a.store, r, { ...b, ...additions }))[0], 403);
});

test('contact reads and queues decrypt/encrypt only through both independent grants', async () => {
  const { handleResearch } = await load(); const { encryptResearchValue, decryptResearchValue } = await import('../lib/research-mail.mjs'); const a = accessFixture();
  const r = rpcFixture(action => action === 'studyGet' ? { study: { permissions: ['view_study', 'view_identifiable_data', 'contact_participants'] } } : action === 'contactGet' ? { contact: { contactCiphertext: encryptResearchValue({ email: EMAIL }, CONTACT_KEY) } } : { queued: 1 });
  const read = await handleResearch(a.store, r, { token: a.a, action: 'contactGet', studyId: IDS.studyA, participantId: IDS.participant }, options);
  assert.deepEqual(read, [200, { contact: { participantId: IDS.participant, email: EMAIL } }]);
  const queued = await handleResearch(a.store, r, { token: a.a, action: 'contactQueue', studyId: IDS.studyA, requestId: requestId(), participantIds: [IDS.participant], kind: 'feedback', subject: 'Synthetic feedback', text: 'Synthetic private message' }, options);
  assert.equal(queued[0], 200); const payload = r.calls.at(-1).payload;
  assert.ok(!JSON.stringify(payload).includes('Synthetic private message')); assert.match(payload.bodyDigest, /^[a-f0-9]{64}$/);
  assert.equal(decryptResearchValue(payload.encryptedBody, CONTACT_KEY).text, 'Synthetic private message');
});

test('questionnaire publishing cannot cross into consent management through a version ID', async () => {
  const { handleResearch } = await load(); const a = accessFixture();
  const r = rpcFixture((action, payload) => action === 'studyGet' ? { study: { permissions: ['view_study', 'manage_questionnaires'] } } : action === 'versionList' ? { versions: [{ id: IDS.instrument, kind: payload.kind }] } : { version: {} });
  const b = { token: a.a, action: 'versionPublish', studyId: IDS.studyA, expectedRevision: 2, requestId: requestId() };
  assert.equal((await handleResearch(a.store, r, { ...b, versionId: IDS.consent }))[0], 404);
  assert.ok(!r.calls.some(call => call.action === 'versionPublish'));
  assert.equal((await handleResearch(a.store, r, { ...b, versionId: IDS.instrument }))[0], 200);
});

test('questionnaire IDs remain plain data even when matching JavaScript prototype keys', async () => {
  const { validateInstrument, validateAnswers } = await load();
  const definition = validateInstrument({ ...instrumentDefinition(), items: [{ id: '__proto__', type: 'text', label: 'Synthetic plain-data field', required: true }] });
  const result = validateAnswers(definition, JSON.parse('{"__proto__":"Synthetic answer"}'));
  assert.equal(Object.hasOwn(result, '__proto__'), true); assert.equal(result.__proto__, 'Synthetic answer');
  assert.equal(Object.getPrototypeOf(result), Object.prototype); assert.equal({}.polluted, undefined);
});

test('personal credential and subscription dates expire at the Israel calendar boundary', async () => {
  const { handleResearch } = await load(); const RealDate = globalThis.Date;
  const timestamp = RealDate.parse('2026-10-13T22:30:00Z');
  class IsraelBoundaryDate extends RealDate {
    constructor(...args) { super(...(args.length ? args : [timestamp])); }
    static now() { return timestamp; }
  }
  globalThis.Date = IsraelBoundaryDate;
  try {
    const a = accessFixture(); const r = rpcFixture(() => ({ studies: [] }));
    const rec = a.store.rows.get('code:PARTICIPANT'); rec.expiresAt = '2026-10-13';
    assert.equal((await handleResearch(a.store, r, { token: a.participant, action: 'bootstrap' }))[0], 403);
    rec.expiresAt = '2026-10-14';
    a.store.rows.get('institutions')[0].subEnd = '2026-10-13'; a.store.rows.set('settings', { graceDays: 0 });
    assert.equal((await handleResearch(a.store, r, { token: a.participant, action: 'bootstrap' }))[0], 403);
    a.store.rows.get('institutions')[0].subEnd = '2026-10-14';
    assert.equal((await handleResearch(a.store, r, { token: a.participant, action: 'bootstrap' }))[0], 200);
  } finally { globalThis.Date = RealDate; }
});
