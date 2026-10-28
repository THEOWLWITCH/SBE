import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createHash, randomUUID } from 'node:crypto';
import { createPracticeServer } from '../practice-server.mjs';
import { createPartnershipIntegration } from '../fixtures/research-partnership-integrated.mjs';
import { syntheticSignWell } from '../fixtures/research-signing-synthetic.mjs';
import { runPartnershipWork } from '../lib/research-partnership-work.mjs';
import { researchSigningWorkerToken } from '../lib/research-signing.mjs';
import CORE from '../../app/lib/research-partnership-core.js';

// Every identity, term, amount and transport below is invented. The native HTTP
// gateway reaches actual isolated SQL; no external provider or email is called.
function fieldValue(field) {
  if (field.type === 'rows') return [Object.fromEntries(field.fields.filter(f => !f.reference).map(f => [f.id, fieldValue(f)]))];
  if (field.type === 'tags') return [field.choices?.[0] || 'נתון סינתטי ' + field.id];
  if (field.type === 'enum') return Object.keys(field.choices)[0];
  return { email: 'synthetic@example.invalid', date: '2026-11-02', money: '10.00', integer: 2, boolean: true }[field.type] ?? 'החלטה סינתטית ' + field.id;
}

function completeGuidedData(prepared, study, consent, instrument) {
  const fields = CORE.RECORD_SCHEMAS.agreement.fields;
  const data = { ...prepared.version.data, ...Object.fromEntries(fields.filter(f => !f.reference).map(f => [f.id, fieldValue(f)])) };
  Object.assign(data, {
    guidedVersion: '4', title: 'הסכם V4 סינתטי מלא לבדיקת רצף',
    ownerName: 'Synthetic Owner', ownerSignatory: 'Synthetic Owner', ownerEmail: 'owner@example.invalid', ownerAuthority: 'Synthetic owner authority',
    partnerName: 'Synthetic Partner', partnerSignatory: 'Synthetic Partner', partnerEmail: 'partner@example.invalid', partnerAuthority: 'Synthetic partner authority',
    studyIdentifier: study.id, studyTitle: study.config.title, applicationId: prepared.version.data.applicationId,
    templateVersionId: prepared.template.version.id, ipExplanationVersionId: prepared.template.version.id,
    consentProtocolVersionId: consent.id, questionnaireVersionIds: [instrument.id],
    startDate: '2026-11-01', effectiveDate: '2026-11-01', endDate: '2027-05-01', terminationDate: '2027-05-01',
    requestedPermissions: ['view_study', 'view_approved_findings'],
    agreementContacts: [{ party: 'owner', name: 'Synthetic Owner', role: 'Synthetic contact', email: 'owner@example.invalid', purpose: 'Synthetic notices' }],
    copyRecipients: [
      { party: 'owner', name: 'Synthetic Owner', email: 'owner@example.invalid', deliveryMethod: 'Synthetic private copy' },
      { party: 'partner', name: 'Synthetic Partner', email: 'partner@example.invalid', deliveryMethod: 'Synthetic private copy' }
    ],
    sharedExpenses: [{ description: 'תשלום סינתטי מוסכם', amount: '100.00', party: 'owner', dueDate: '2026-12-01', terms: 'Synthetic explicit signed-source duty' }],
    customClauses: [{ sectionId: 'mutualIP', title: 'זכויות בתוצר בדוי', text: 'זכויות קודמות נשמרות; אין העברת זכויות משתמעת.' }]
  });
  for (const annex of CORE.GUIDED_AGREEMENT.annexes) {
    data[annex.statusField] = 'applicable';
    delete data[annex.reasonField];
  }
  data.annexB[0].actions = ['view_study'];
  data.annexB[0].authorizedUsers = ['Synthetic Partner'];
  data.annexE[0].authorizedPeople = ['Synthetic Owner', 'Synthetic Partner'];
  assert.deepEqual(CORE.missingFields('agreement', data), []);
  return CORE.validateRecord('agreement', data, { complete: true });
}

test('complete V4 public request, negotiation, bounded signing work, private delivery, obligations and amendment stay scoped through HTTP and SQL', { timeout: 180000 }, async () => {
  const provider = syntheticSignWell(), f = await createPartnershipIntegration(provider.options);
  const nativeFetch = globalThis.fetch, rpcCalls = [], externalRequests = [], impactRequests = [];
  const syntheticOrigin = 'https://guided-journey.synthetic.invalid';
  const environment = { SUPABASE_URL: syntheticOrigin, SUPABASE_SERVICE_KEY: 'sb_secret_synthetic_journey_only', RESEARCH_DOCUMENT_KEY: f.documentKey, RESEARCH_CONTACT_KEY: f.documentKey };
  const previous = Object.fromEntries(Object.keys(environment).map(key => [key, process.env[key]]));
  const descriptor = { provider: 'synthetic-ai', model: 'synthetic-model', version: 'synthetic-ai-policy-v1' };
  let server;
  try {
    Object.assign(process.env, environment);
    globalThis.fetch = async (target, init) => {
      const url = new URL(target);
      if (url.origin !== syntheticOrigin) { externalRequests.push(url.origin); throw new Error('External network disabled'); }
      assert.equal(init.method, 'POST');
      assert.match(url.pathname, /^\/rest\/v1\/rpc\/research_(?:partnership_|intake_)?rpc$/);
      assert.equal(init.headers.apikey, environment.SUPABASE_SERVICE_KEY);
      const body = JSON.parse(init.body);
      rpcCalls.push({ procedure: url.pathname, action: body.p_action });
      try { return Response.json(await f.researchStore.rpc(body.p_token, body.p_action, body.p_payload)); }
      catch (error) { return Response.json({ error: error.code || 'unavailable', status: error.status || 503 }); }
    };
    server = createPracticeServer({ signingEnabled: true, authStore: f.accessStore, partnershipOptions: {
      ...provider.options, documentKey: f.documentKey, contactKey: f.documentKey,
      impactDescriptor: descriptor, impactProviderFactory: () => ({ id: descriptor.provider, model: descriptor.model,
        async complete(request) { impactRequests.push(structuredClone(request)); return { text: 'מה המשמעות עבורי? הסבר סינתטי בלבד.' }; } })
    }, providerFactory: () => { throw new Error('General model disabled'); } });
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    const base = 'http://127.0.0.1:' + server.address().port;
    async function post(path, body, expected = 200) {
      const response = await nativeFetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://be-good.co.il' }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) });
      const output = await response.json();
      assert.ok((Array.isArray(expected) ? expected : [expected]).includes(response.status), body.action + ': HTTP ' + response.status + ' ' + JSON.stringify(output));
      assert.match(response.headers.get('cache-control'), /private.*no-store/);
      assert.match(response.headers.get('vary'), /origin/i);
      return output;
    }
    const api = (token, action, payload = {}, expected) => post('/api/research', { token, action, ...payload }, expected);
    const owner = (action, payload = {}, expected) => api(f.tokens.owner, action, payload, expected);
    const partner = (action, payload = {}, expected) => api(f.tokens.a, action, payload, expected);
    const mutate = payload => ({ requestId: randomUUID(), ...payload });
    const publicApi = (action, payload = {}) => post('/api/research-intake', { action, ...payload });
    const count = async table => (await f.query('SELECT count(*)::int n FROM research_private.' + table)).rows[0].n;

    // Anonymous requests use exact published terms and grant no credentials or rights.
    let termsState = (await owner('intakeOwnerBootstrap')).termsState;
    termsState = (await owner('intakeTermsSave', mutate({ expectedRevision: termsState.revision, title: 'תנאים סינתטיים', text: 'בקשה סינתטית בלבד; אין חתימה, התחייבות כספית או הרשאת גישה.' }))).termsState;
    await owner('intakeTermsPublish', mutate({ expectedRevision: termsState.revision, versionId: termsState.draftVersion.versionId }));
    const terms = (await publicApi('intakePublicInfo')).terms;
    const application = { title: 'בקשה סינתטית לשותפות', applicationType: 'partnership', applicantType: 'individual', fullName: 'Synthetic Partner', email: 'partner@example.invalid', objectives: 'מחקר סינתטי', requestedTools: ['writer'], requestedPermissions: ['view_study', 'export_data'] };
    const intake = mutate({ termsVersionId: terms.versionId, termsHash: terms.hash, acknowledged: true, application });
    const proposal = await publicApi('intakeSubmit', intake);
    assert.deepEqual(await publicApi('intakeSubmit', intake), proposal);
    const institution = await publicApi('intakeSubmit', { ...intake, requestId: randomUUID(), application: { ...application, title: 'בקשה סינתטית ממוסד', applicantType: 'institution', institution: 'Synthetic Institute', fullName: 'Synthetic Other Partner', email: 'other@example.invalid' } });
    assert.equal(await count('partnership_records'), 0);
    assert.equal(await count('memberships'), 0);
    assert.doesNotMatch(JSON.stringify(proposal), /example\.invalid|token|permissions/);
    await api(f.tokens.b, 'intakeGet', { applicationId: proposal.receipt.id }, 403);

    const { study, consent, instrument } = await f.seedStudy('מחקר V4 סינתטי מלא');
    let currentStudy = (await owner('studyGet', { studyId: study.id })).study;
    const reviewRequest = mutate({ applicationId: proposal.receipt.id, expectedRevision: 0, decision: 'approved', studyId: study.id, studyExpectedRevision: currentStudy.revision, individualCode: f.codes.a, permissions: CORE.ACCESS_PRESETS.approved_findings });
    const approved = await owner('intakeReview', reviewRequest), prepared = approved.preparation;
    assert.equal(approved.workspace.partnershipActive, false);
    assert.equal(prepared.record.status, 'draft'); assert.equal(prepared.record.binding, false);
    assert.equal(prepared.template.record.status, 'draft');
    assert.equal(prepared.version.data.applicationId, approved.application.recordId);
    assert.deepEqual(await owner('intakeReview', reviewRequest), approved);
    assert.equal(await count('partnership_records'), 3);
    const scope = { studyId: study.id, partnerId: approved.partner.id }, rs = { ...scope, recordId: prepared.record.id };
    const originalMembers = (await owner('memberList', { studyId: study.id })).members;
    assert.equal(originalMembers.length, 1);
    const originalMemberId = originalMembers[0].id;
    assert.deepEqual((await partner('agreementSources', scope)).sources.currentGrants, CORE.ACCESS_PRESETS.approved_findings);
    assert.equal((await owner('agreementPrepare', mutate(scope))).record.id, rs.recordId);
    await partner('agreementPrepare', mutate(scope), 403);
    const login = await post('/api/access', { action: 'login', kind: 'code', secret: f.codes.a });
    assert.equal((await api(login.token, 'partnerGet', { partnerId: scope.partnerId })).workspaces.length, 1);

    // Intake approval creates a folder; the detailed research application is a
    // separate professional review before it can be a final contract source.
    const applicationScope = { ...scope, recordId: approved.application.recordId };
    let researchApplication = await partner('recordGet', applicationScope);
    researchApplication = await partner('recordSave', mutate({ ...applicationScope, kind: 'application', expectedRevision: researchApplication.record.revision, data: {
      ...researchApplication.version.data, researchQuestions: ['Synthetic research question'], method: 'Synthetic descriptive design', population: 'Invented educator cohort',
      startDate: '2026-11-01', endDate: '2027-05-01', ethicsStatus: 'approved', ethicsDetails: 'Synthetic documented review only', consentPlan: 'Synthetic optional participation', questionnaireVersionIds: [instrument.id]
    } }));
    researchApplication = { ...researchApplication, ...await partner('recordSubmit', mutate({ ...applicationScope, versionId: researchApplication.version.id, expectedRevision: researchApplication.record.revision })) };
    await owner('recordReview', mutate({ ...applicationScope, versionId: researchApplication.version.id, expectedRevision: researchApplication.record.revision, decision: 'approved' }));

    // A known second researcher in the same study and a second study provides real-ID isolation probes.
    currentStudy = (await owner('studyGet', { studyId: study.id })).study;
    const siblingApproval = await owner('intakeReview', mutate({ applicationId: institution.receipt.id, expectedRevision: 0, decision: 'approved', studyId: study.id, studyExpectedRevision: currentStudy.revision, individualCode: f.codes.b, permissions: CORE.ACCESS_PRESETS.approved_findings }));
    const otherStudy = (await f.seedStudy('מחקר סינתטי נוסף')).study;
    await owner('memberSet', mutate({ studyId: otherStudy.id, expectedRevision: otherStudy.revision, code: f.codes.b, role: 'researcher', permissions: CORE.ACCESS_PRESETS.approved_findings }));
    const siblingScope = { studyId: study.id, partnerId: siblingApproval.partner.id };
    const sibling = await api(f.tokens.b, 'recordSave', mutate({ ...siblingScope, kind: 'contribution', expectedRevision: null, data: { title: 'תרומה פרטית סינתטית אחרת', category: 'technology', description: 'Private sibling material' } }));
    for (const [token, action, payload] of [
      [f.tokens.b, 'recordGet', rs], [f.tokens.b, 'recordVersions', rs], [f.tokens.b, 'agreementSources', scope],
      [f.tokens.a, 'recordGet', { ...siblingScope, recordId: sibling.record.id }],
      [f.tokens.a, 'recordGet', { ...rs, studyId: otherStudy.id }],
      [f.tokens.a, 'recordGet', { ...rs, partnerId: siblingScope.partnerId }]
    ]) await api(token, action, payload, 404);
    assert.doesNotMatch(JSON.stringify(await api(f.tokens.b, 'workspaceList')), /הסכם V4 סינתטי מלא|partner@example\.invalid/);

    // Complete every selected V4 section and all six real annex schemas, using the prepared catalog template.
    await owner('recordReview', mutate({ ...scope, recordId: prepared.template.record.id, versionId: prepared.template.version.id, expectedRevision: prepared.template.record.revision, decision: 'approved' }));
    let agreement = await partner('recordSave', mutate({ ...rs, kind: 'agreement', expectedRevision: prepared.record.revision, data: completeGuidedData(prepared, study, consent, instrument) }));
    assert.equal(agreement.version.data.guidedVersion, '4');
    for (const annex of CORE.GUIDED_AGREEMENT.annexes) assert.equal(agreement.version.data[annex.rowsField].length, 1);
    const initialVersion = agreement.version;
    const exported = await partner('workspaceExport', { ...rs, versionId: initialVersion.id, format: 'json' });
    const rendered = JSON.parse(Buffer.from(exported.contentBase64, 'base64')).rendered;
    assert.equal(rendered.ready, true); assert.deepEqual(rendered.missingFields, []); assert.equal(rendered.sections.length, 12);
    for (const annex of CORE.GUIDED_AGREEMENT.annexes) assert.match(rendered.text, new RegExp('נספח ' + annex.id));
    agreement = { ...agreement, ...await partner('recordSubmit', mutate({ ...rs, versionId: agreement.version.id, expectedRevision: agreement.record.revision })) };
    agreement = { ...agreement, ...await owner('recordReview', mutate({ ...rs, versionId: agreement.version.id, expectedRevision: agreement.record.revision, decision: 'approved' })) };
    agreement = { ...agreement, ...await owner('agreementApprove', mutate({ ...rs, versionId: agreement.version.id, expectedRevision: agreement.record.revision, documentHash: agreement.version.contentHash, ipExplanationVersionId: prepared.template.version.id, ipReadAcknowledged: true })) };
    assert.equal(await count('partnership_executions'), 0); assert.equal(await count('partnership_signings'), 0);
    const unsignedDuties = await f.query("SELECT count(*)::int n FROM research_private.partnership_records WHERE kind='obligation'");
    assert.equal(unsignedDuties.rows[0].n, 0);
    await partner('recordReview', mutate({ ...rs, versionId: initialVersion.id, expectedRevision: agreement.record.revision, decision: 'approved' }), 404);

    // A substantive partner proposal invalidates the old approval, with exact deterministic money/date/IP differences.
    const negotiated = { ...agreement.version.data, newIPOwnership: 'Synthetic output remains with its identified creator; proposed limited nonexclusive research licence only.', sharedExpenses: [{ ...agreement.version.data.sharedExpenses[0], amount: '125.00', dueDate: '2026-12-15' }] };
    const savedRequest = mutate({ ...rs, kind: 'agreement', expectedRevision: agreement.record.revision, data: negotiated });
    agreement = await partner('recordSave', savedRequest);
    assert.equal(agreement.record.approvedVersionId, null); assert.equal(agreement.record.status, 'draft');
    assert.equal((await partner('recordGet', { ...rs, versionId: initialVersion.id })).version.data.sharedExpenses[0].amount, '100.00');
    const comparison = { ...rs, fromVersionId: initialVersion.id, toVersionId: agreement.version.id, includeAI: true };
    const blockedImpact = await partner('workspaceImpact', comparison);
    assert.equal(blockedImpact.ai.state, 'blocked'); assert.equal(impactRequests.length, 0);
    for (const [path, category, before, after] of [
      ['sharedExpenses[0].amount', 'financial', '100.00', '125.00'],
      ['sharedExpenses[0].dueDate', 'deadline', '2026-12-01', '2026-12-15'],
      ['newIPOwnership', 'IP', initialVersion.data.newIPOwnership, negotiated.newIPOwnership]
    ]) assert.ok(blockedImpact.changes.some(change => change.path === path && change.category === category && change.before === before && change.after === after), path);
    assert.equal((await partner('recordGet', rs)).approvals.length, 0);

    async function approvePolicy(purpose, policyProvider, version, extra = {}) {
      const head = (await owner('processingPolicyGet', { ...scope, purpose })).policy;
      const policy = { purpose, provider: policyProvider, providerVersion: version, dataCategories: ['agreement_changes', 'agreement_document', 'personal', 'confidential'], authorizedActors: ['sys', 'code:' + f.codes.a], ...Object.fromEntries(['partyRoles', 'transferBasis', 'storageLocation', 'retention', 'backups', 'deletion', 'withdrawal', 'securityMeasures', 'ethicsReference', 'consentReview'].map(key => [key, 'Synthetic explicit decision ' + key])), ...extra };
      const saved = (await owner('processingPolicySave', mutate({ ...scope, expectedRevision: head?.revision || 0, policy }))).policy;
      return (await owner('processingPolicyApprove', mutate({ ...scope, expectedRevision: saved.revision, policyVersionId: saved.id, policyHash: saved.hash }))).policy;
    }
    await partner('processingPolicyGet', { ...scope, purpose: 'external_impact' }, 403);
    await approvePolicy('external_impact', descriptor.provider, descriptor.version);
    assert.equal((await partner('workspaceImpact', comparison)).ai.state, 'ready'); assert.equal(impactRequests.length, 1);
    assert.doesNotMatch(JSON.stringify(impactRequests[0]), /Synthetic Partner|example\.invalid|limited nonexclusive|החלטה סינתטית/);

    agreement = { ...agreement, ...await partner('recordSubmit', mutate({ ...rs, versionId: agreement.version.id, expectedRevision: agreement.record.revision })) };
    agreement = { ...agreement, ...await owner('recordReview', mutate({ ...rs, versionId: agreement.version.id, expectedRevision: agreement.record.revision, decision: 'approved', note: 'Synthetic negotiated changes accepted' })) };
    for (const who of [owner, partner]) agreement = { ...agreement, ...await who('agreementApprove', mutate({ ...rs, versionId: agreement.version.id, expectedRevision: agreement.record.revision, documentHash: agreement.version.contentHash, ipExplanationVersionId: prepared.template.version.id, ipReadAcknowledged: true })) };
    const both = (await partner('recordGet', rs)).approvals;
    assert.deepEqual(both.map(a => a.party).sort(), ['owner', 'partner']);
    assert.ok(both.every(a => a.versionId === agreement.version.id && a.documentHash === agreement.version.contentHash));
    const signingRequest = mutate({ ...rs, versionId: agreement.version.id, expectedRevision: agreement.record.revision, documentHash: agreement.version.contentHash, consent: true });
    await owner('signingStart', signingRequest, 503); assert.equal(provider.state.creates, 0);
    await approvePolicy('pre_signing_document', 'signwell', 'wrong-synthetic-policy-version');
    await owner('signingStart', signingRequest, 503); assert.equal(provider.state.creates, 0);
    await approvePolicy('pre_signing_document', 'signwell', 'synthetic-policy-v1');
    const finalDocx = await owner('workspaceExport', { ...rs, versionId: agreement.version.id, format: 'docx' });
    const started = await owner('signingStart', signingRequest);
    assert.equal(started.signing.provider, 'signwell'); assert.equal(provider.state.creates, 1); assert.equal(provider.state.sends, 0);
    assert.equal(provider.state.sourceHash, finalDocx.documentHash); assert.equal(provider.state.sourceName, 'research-agreement.docx');
    await owner('signingStart', { ...signingRequest, requestId: randomUUID() }, 409);
    assert.equal(provider.state.creates, 1, 'a stale revision with a new request ID cannot create a replacement');
    const view = { ...rs, signingId: started.signing.id };
    await api(f.tokens.b, 'signingView', view, 404);
    assert.equal((await partner('signingView', view)).signing.embeddedUrl, 'https://www.signwell.com/docs/synthetic_2/');
    assert.equal(provider.state.sends, 1); assert.equal(provider.state.creates, 1);

    // No browser refresh is involved: the bounded server worker retries missing evidence, then executes exactly once.
    provider.state.status = 'Completed';
    const workOptions = { ...provider.options, enabled: true, documentKey: f.documentKey, limit: 3 };
    assert.equal((await runPartnershipWork(f.accessStore, f.researchStore, workOptions)).pending, 1);
    assert.equal(await count('partnership_executions'), 0); assert.equal(await count('partnership_copy_outbox'), 0);
    assert.equal((await partner('recordGet', rs)).record.status, 'signing');
    await f.query("UPDATE research_private.partnership_signings SET work_due_at=CURRENT_TIMESTAMP-INTERVAL '1 minute' WHERE id=$1", [started.signing.id]);
    provider.state.fullEvidence = true;
    assert.equal((await runPartnershipWork(f.accessStore, f.researchStore, workOptions)).completed, 1);
    await runPartnershipWork(f.accessStore, f.researchStore, workOptions);
    const executed = await partner('recordGet', rs);
    assert.equal(executed.record.status, 'executed'); assert.equal(executed.record.binding, true);
    assert.equal(executed.version.id, agreement.version.id); assert.equal(await count('partnership_executions'), 1); assert.equal(await count('partnership_copy_outbox'), 2);
    const refresh = mutate({ ...view, expectedRevision: executed.record.revision });
    assert.equal((await partner('signingRefresh', refresh)).signing.state, 'completed');
    assert.equal((await partner('signingRefresh', { ...refresh, requestId: randomUUID() })).signing.state, 'completed');
    assert.equal(await count('partnership_executions'), 1); assert.equal(provider.state.creates, 1); assert.equal(provider.state.sends, 1);
    const storedSigning = (await f.query('SELECT provider,provider_session_id FROM research_private.partnership_signings WHERE id=$1', [started.signing.id])).rows[0];
    assert.deepEqual(storedSigning, { provider: 'signwell', provider_session_id: 'signwell/' + provider.state.document.id });
    const evidence = (await f.query('SELECT id,sha256,evidence_purpose FROM research_private.partnership_documents WHERE signing_id=$1 ORDER BY evidence_purpose', [started.signing.id])).rows;
    assert.deepEqual(evidence.map(d => d.evidence_purpose), ['certificate', 'final']);
    for (const doc of evidence) {
      for (const token of [f.tokens.owner, f.tokens.a]) {
        const downloaded = await api(token, 'workspaceDocumentGet', { ...scope, documentId: doc.id, download: true });
        assert.equal(createHash('sha256').update(Buffer.from(downloaded.contentBase64, 'base64')).digest('hex'), doc.sha256);
      }
      await api(f.tokens.b, 'workspaceDocumentGet', { ...scope, documentId: doc.id, download: true }, 404);
      await partner('workspaceDocumentGet', { ...scope, studyId: otherStudy.id, documentId: doc.id }, 404);
    }
    for (const token of [f.tokens.owner, f.tokens.a]) await api(token, 'workspaceExport', { ...rs, versionId: executed.version.id, format: 'docx' }, 409);
    await api(f.tokens.b, 'workspaceExport', { ...rs, versionId: executed.version.id, format: 'docx' }, 404);
    await partner('recordSave', mutate({ ...rs, kind: 'agreement', expectedRevision: executed.record.revision, data: negotiated }), 409);
    await partner('agreementRefreshPreview', { ...rs, versionId: executed.version.id }, 409);
    await assert.rejects(f.query('UPDATE research_private.partnership_executions SET document_hash=document_hash'), /immutable/);
    await assert.rejects(f.query('UPDATE research_private.partnership_documents SET filename=filename WHERE signing_id=$1', [started.signing.id]), /immutable/);

    // Private availability is separate from accepted mail and later recipient delivery evidence.
    const privateFolder = () => partner('workspaceList', scope);
    const ownFolder = () => owner('workspaceList', scope);
    assert.equal((await privateFolder()).workspaces[0].signedCopies[0].privateCopy, 'available');
    assert.equal((await privateFolder()).workspaces[0].signedCopies[0].deliveryEvidence, 'unavailable');
    assert.equal((await privateFolder()).workspaces[0].partnershipActive, true);
    const messages = [], receipts = [], ids = new Map(); let lostPartnerResponse = true;
    const transport = { readiness: () => ({ configured: true, provider: 'resend', providerVersion: 'synthetic-mail-v1' }),
      async send(message) {
        messages.push({ recipient: message.recipient, key: message.idempotencyKey, hash: message.documentHash });
        assert.equal(createHash('sha256').update(message.documentBytes).digest('hex'), evidence.find(d => d.evidence_purpose === 'final').sha256);
        if (message.recipient === 'partner@example.invalid' && lostPartnerResponse) { lostPartnerResponse = false; throw new Error('Synthetic lost acceptance response'); }
        if (!ids.has(message.recipient)) ids.set(message.recipient, randomUUID());
        return { status: 'accepted', providerId: ids.get(message.recipient) };
      }, async receipt(message) { receipts.push(message.recipient); return { status: message.recipient === 'owner@example.invalid' ? 'delivered' : 'bounced', providerId: message.providerId }; }
    };
    const deliveryOptions = { ...workOptions, copyMail: { from: 'owner@example.invalid' }, copyTransportFactory: () => transport };
    await runPartnershipWork(f.accessStore, f.researchStore, deliveryOptions); assert.equal(messages.length, 0, 'pre-signing policy cannot authorize copy mail');
    await approvePolicy('signed_copy_delivery', 'resend', 'synthetic-mail-v1');
    const dueCopies = () => f.query("UPDATE research_private.partnership_copy_outbox SET due_at=CURRENT_TIMESTAMP-INTERVAL '1 minute'");
    await dueCopies(); await runPartnershipWork(f.accessStore, f.researchStore, deliveryOptions);
    assert.equal(messages.length, 2); assert.equal(receipts.length, 0);
    let copies = (await f.query('SELECT party,submission,delivery FROM research_private.partnership_copy_outbox ORDER BY party')).rows;
    assert.deepEqual(copies, [{ party: 'owner', submission: 'accepted', delivery: 'unavailable' }, { party: 'partner', submission: 'retry', delivery: 'unavailable' }]);

    // A membership removed between attempts blocks new transfer even with an existing signed contract/policy.
    currentStudy = (await owner('studyGet', { studyId: study.id })).study;
    const member = (await owner('memberList', { studyId: study.id })).members.find(m => m.id === originalMemberId);
    assert.ok(member, 'known actual researcher membership');
    await owner('memberRemove', mutate({ studyId: study.id, expectedRevision: currentStudy.revision, memberId: member.id }));
    await partner('recordGet', rs, 404); await partner('workspaceDocumentGet', { ...scope, documentId: evidence[0].id }, 404);
    await partner('signingView', view, 404);
    const beforeRetry = messages.length;
    await dueCopies(); await runPartnershipWork(f.accessStore, f.researchStore, deliveryOptions);
    assert.equal(messages.length, beforeRetry);
    assert.equal((await owner('recordGet', rs)).record.status, 'executed');
    currentStudy = (await owner('studyGet', { studyId: study.id })).study;
    await owner('memberSet', mutate({ studyId: study.id, expectedRevision: currentStudy.revision, code: f.codes.a, role: 'researcher', permissions: CORE.ACCESS_PRESETS.approved_findings }));
    await dueCopies(); await runPartnershipWork(f.accessStore, f.researchStore, deliveryOptions);
    assert.equal(messages.filter(m => m.recipient === 'partner@example.invalid').length, 2);
    assert.equal(new Set(messages.filter(m => m.recipient === 'partner@example.invalid').map(m => m.key)).size, 1);
    await dueCopies(); await runPartnershipWork(f.accessStore, f.researchStore, deliveryOptions);
    copies = (await f.query('SELECT party,submission,delivery FROM research_private.partnership_copy_outbox ORDER BY party')).rows;
    assert.deepEqual(copies, [{ party: 'owner', submission: 'accepted', delivery: 'delivered' }, { party: 'partner', submission: 'accepted', delivery: 'bounced' }]);
    assert.equal((await privateFolder()).workspaces[0].signedCopies[0].deliveryEvidence, 'bounced');
    assert.equal((await ownFolder()).workspaces[0].signedCopies.find(c => c.party === 'owner').deliveryEvidence, 'delivered');
    assert.equal(await count('partnership_executions'), 1);

    // Verified contract execution alone does not override the study's separate research approval conditions.
    currentStudy = (await owner('studyGet', { studyId: study.id })).study;
    const approvedStudyConfig = structuredClone(currentStudy.config);
    currentStudy = (await owner('studyStatus', mutate({ studyId: study.id, expectedRevision: currentStudy.revision, status: 'paused' }))).study;
    currentStudy = (await owner('studySave', mutate({ studyId: study.id, expectedRevision: currentStudy.revision, config: { ...approvedStudyConfig, approvals: { status: 'pending', reference: 'SYNTHETIC-REVIEW', documentation: 'Synthetic approval reconsideration' } } }))).study;
    assert.equal((await privateFolder()).workspaces[0].partnershipActive, false);
    assert.equal((await partner('recordGet', rs)).record.binding, true);
    await owner('studyStatus', mutate({ studyId: study.id, expectedRevision: currentStudy.revision, status: 'active', confirmApprovals: true }), 400);
    currentStudy = (await owner('studySave', mutate({ studyId: study.id, expectedRevision: currentStudy.revision, config: approvedStudyConfig }))).study;
    await owner('studyStatus', mutate({ studyId: study.id, expectedRevision: currentStudy.revision, status: 'active', confirmApprovals: true }));
    assert.equal((await privateFolder()).workspaces[0].partnershipActive, true);

    // Owner-reviewed duties keep their exact signed clause/amount/date after completion evidence and an unsigned amendment.
    const rows = (await ownFolder()).workspaces[0].records.filter(r => r.kind === 'obligation');
    assert.ok(rows.length >= 10, 'V4 annex/development duties are extracted for review');
    const duties = await Promise.all(rows.map(r => owner('recordGet', { ...scope, recordId: r.id })));
    assert.ok(duties.every(d => d.record.status === 'draft' && d.record.binding === false && d.version.data.sourceAgreementVersionId === executed.version.id));
    const ambiguous = duties.find(d => d.version.data.clauseReference === 'annexC[1]');
    assert.equal(ambiguous.version.data.party, undefined); assert.equal(ambiguous.version.data.amount, undefined);
    let duty = duties.find(d => d.version.data.clauseReference === 'sharedExpenses[1]');
    assert.equal(duty.version.data.amount, '125.00'); assert.equal(duty.version.data.dueDate, '2026-12-15');
    const ds = { ...scope, recordId: duty.record.id };
    await partner('recordSubmit', mutate({ ...ds, versionId: duty.version.id, expectedRevision: duty.record.revision }), 404);
    duty = { ...duty, ...await owner('recordSubmit', mutate({ ...ds, versionId: duty.version.id, expectedRevision: duty.record.revision })) };
    duty = { ...duty, ...await owner('recordReview', mutate({ ...ds, versionId: duty.version.id, expectedRevision: duty.record.revision, decision: 'approved' })) };
    assert.equal(duty.record.binding, true);
    const sourceDutyVersion = duty.version;
    duty = await owner('recordSave', mutate({ ...ds, kind: 'obligation', expectedRevision: duty.record.revision, data: { ...duty.version.data, completionEvidence: 'Synthetic documented completion' } }));
    duty = { ...duty, ...await owner('recordReview', mutate({ ...ds, versionId: duty.version.id, expectedRevision: duty.record.revision, decision: 'completed' })) };
    assert.equal(duty.record.status, 'completed');
    assert.equal((await owner('recordGet', { ...ds, versionId: sourceDutyVersion.id })).version.data.completionEvidence, undefined);
    await owner('recordSave', mutate({ ...ds, kind: 'obligation', expectedRevision: duty.record.revision, data: { ...duty.version.data, amount: '999.00' } }), 409);
    const amendment = await partner('agreementAmend', mutate({ ...rs, versionId: executed.version.id, expectedRevision: executed.record.revision, reason: 'Synthetic new negotiated date proposal', data: { ...executed.version.data, amendsAgreementVersionId: executed.version.id, sharedExpenses: [{ ...executed.version.data.sharedExpenses[0], amount: '150.00', dueDate: '2027-01-01' }] } }));
    assert.notEqual(amendment.record.id, executed.record.id); assert.equal(amendment.record.status, 'draft'); assert.equal(amendment.record.binding, false);
    assert.equal(amendment.version.data.amendsAgreementVersionId, executed.version.id);
    assert.equal((await owner('recordGet', rs)).version.contentHash, executed.version.contentHash);
    assert.equal((await owner('recordGet', ds)).version.data.amount, '125.00'); assert.equal(await count('partnership_executions'), 1);
    assert.equal(await count('partnership_copy_outbox'), 2);

    const worker = await researchSigningWorkerToken(f.accessStore);
    const copyId = (await f.query('SELECT id FROM research_private.partnership_copy_outbox LIMIT 1')).rows[0].id;
    for (const token of [f.tokens.owner, f.tokens.a, f.tokens.b, f.tokens.worker]) {
      await assert.rejects(f.researchStore.rpc(token, 'signingWorkClaim', { limit: 1 }), e => e.code === 'unauthorized');
      await assert.rejects(f.researchStore.rpc(token, 'partnershipCopyClaim', { messageId: copyId, leaseId: randomUUID() }), e => e.code === 'unauthorized');
    }
    assert.deepEqual(await f.researchStore.rpc(worker, 'signingWorkClaim', { limit: 1 }), { jobs: [] });
    await owner('signingWorkClaim', mutate({ limit: 1 }), 400);
    await partner('partnershipCopyClaim', mutate({ messageId: copyId, leaseId: randomUUID() }), 400);

    // Revocation rejects valid old mutation receipts as well as fresh reads and URLs; retained history stays with the owner.
    await post('/api/access', { action: 'codeRevoke', token: f.tokens.owner, code: f.codes.a });
    for (const [action, payload] of [
      ['recordSave', savedRequest], ['recordGet', rs], ['recordGet', { ...scope, recordId: amendment.record.id }],
      ['workspaceDocumentGet', { ...scope, documentId: evidence[0].id, download: true }],
      ['workspaceExport', { ...rs, versionId: executed.version.id, format: 'docx' }], ['signingView', view], ['agreementSources', scope]
    ]) await partner(action, payload, 403);
    assert.equal((await owner('recordGet', rs)).version.contentHash, executed.version.contentHash);
    assert.equal((await owner('intakeGet', { applicationId: proposal.receipt.id })).application.termsHash, terms.hash);
    assert.ok(rpcCalls.some(c => c.procedure.endsWith('/research_intake_rpc')));
    assert.ok(rpcCalls.some(c => c.procedure.endsWith('/research_partnership_rpc')));
    assert.ok(rpcCalls.some(c => c.procedure.endsWith('/research_rpc')));
    assert.deepEqual(externalRequests, []);
  } finally {
    if (server) { const closing = new Promise(resolve => server.close(resolve)); server.closeAllConnections(); await closing; }
    globalThis.fetch = nativeFetch;
    for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    await f.close();
  }
});
