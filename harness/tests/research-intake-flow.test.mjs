import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { createPracticeServer } from '../practice-server.mjs';
import { createPartnershipIntegration } from '../fixtures/research-partnership-integrated.mjs';

// Characterize committed gateway behavior through native HTTP and unchanged SQL.
// Only the synthetic Supabase transport is intercepted; every RPC reaches PGlite.
test('public proposal becomes an owner-approved private folder through HTTP and PostgreSQL', { timeout: 90000 }, async () => {
  const f = await createPartnershipIntegration();
  const nativeFetch = globalThis.fetch;
  const syntheticUrl = 'https://research-intake.synthetic.invalid';
  const syntheticKey = 'sb_secret_synthetic_intake_flow_only';
  const environment = {
    SUPABASE_URL: syntheticUrl, SUPABASE_SERVICE_KEY: syntheticKey,
    RESEARCH_DOCUMENT_KEY: f.documentKey, RESEARCH_CONTACT_KEY: f.documentKey,
    PROVIDER: 'synthetic-unconfigured', ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '',
    RESEND_API_KEY: '', NOTIFY_FROM: '', NTFY_TOPIC: '', TELEGRAM_BOT_TOKEN: '',
    TELEGRAM_CHAT_ID: '', CALLMEBOT_API_KEY: '', RESEARCH_SIGNING_PROVIDER: ''
  };
  const previousEnvironment = Object.fromEntries(Object.keys(environment).map(key => [key, process.env[key]]));
  const rpcCalls = [], externalRequests = [];
  let server, modelRequests = 0;
  try {
    Object.assign(process.env, environment);
    globalThis.fetch = async (target, init) => {
      const url = new URL(target);
      if (url.origin !== syntheticUrl) {
        externalRequests.push(url.origin);
        throw new Error('External network is disabled in this synthetic test');
      }
      const body = JSON.parse(init.body);
      const procedure = body.p_action.startsWith('intake') ? 'research_intake_rpc'
        : ['partnerGet', 'workspaceList', 'recordGet', 'agreementSources', 'agreementPrepare', 'agreementRefreshPreview', 'agreementRefreshApply', 'processingPolicyGet'].includes(body.p_action) ? 'research_partnership_rpc' : 'research_rpc';
      assert.equal(url.pathname, '/rest/v1/rpc/' + procedure);
      assert.equal(init.method, 'POST');
      assert.equal(init.headers.apikey, syntheticKey);
      rpcCalls.push({ procedure, ...body });
      try { return Response.json(await f.researchStore.rpc(body.p_token, body.p_action, body.p_payload)); }
      catch (error) { return Response.json({ error: error.code || 'unavailable', status: error.status || 503 }); }
    };
    server = createPracticeServer({ authStore: f.accessStore, providerFactory: () => ({
      async complete() { modelRequests++; throw new Error('Model requests are disabled in this synthetic test'); }
    }) });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = 'http://127.0.0.1:' + server.address().port;
    async function post(path, body, expected = 200) {
      const response = await nativeFetch(base + path, {
        method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://be-good.co.il' },
        body: JSON.stringify(body), signal: AbortSignal.timeout(10000)
      });
      const output = await response.json();
      assert.equal(response.status, expected, body.action + ': ' + JSON.stringify(output));
      assert.match(response.headers.get('cache-control'), /private.*no-store/);
      assert.match(response.headers.get('vary'), /origin/i);
      assert.equal(response.headers.get('access-control-allow-origin'), 'https://be-good.co.il');
      return output;
    }
    const api = (token, action, payload = {}, status = 200) => post('/api/research', { token, action, ...payload }, status);
    const publicApi = (action, payload = {}, status = 200) => post('/api/research-intake', { action, ...payload }, status);
    const owner = (action, payload = {}, status = 200) => api(f.tokens.owner, action, payload, status);
    const mutation = payload => ({ requestId: randomUUID(), ...payload });
    const counts = async () => (await f.query(`SELECT
      (SELECT count(*) FROM public.access_settings WHERE key LIKE 'code:%')::int AS credentials,
      (SELECT count(*) FROM research_private.memberships)::int AS memberships,
      (SELECT count(*) FROM research_private.partnership_partners)::int AS partners,
      (SELECT count(*) FROM research_private.partnership_records)::int AS records,
      (SELECT count(*) FROM research_private.intake_reviews)::int AS reviews`)).rows[0];
    const application = {
      title: 'Synthetic individual proposal', applicationType: 'partnership', applicantType: 'individual',
      fullName: 'Synthetic Individual', email: 'individual@example.invalid', phone: '000-0000000',
      objectives: 'Synthetic research objective', requestedTools: ['writer'],
      requestedPermissions: ['view_study', 'export_data']
    };
    const submission = (terms, data = application) => mutation({
      termsVersionId: terms.versionId, termsHash: terms.hash, acknowledged: true, application: data
    });

    const initialPublic = await publicApi('intakePublicInfo');
    assert.equal(initialPublic.acceptingApplications, false);
    assert.equal(initialPublic.terms, null);
    const initial = (await owner('intakeOwnerBootstrap')).termsState;
    await publicApi('intakeSubmit', submission(initial.draftVersion), 409);
    const saved = (await owner('intakeTermsSave', mutation({ expectedRevision: initial.revision,
      title: 'Synthetic exact conditions', text: 'A synthetic proposal grants no access and is not a signature or financial obligation.' }))).termsState;
    const published = (await owner('intakeTermsPublish', mutation({
      expectedRevision: saved.revision, versionId: saved.draftVersion.versionId
    }))).termsState;
    assert.equal(published.publishedVersionId, saved.draftVersion.versionId);
    const publicInfo = await publicApi('intakePublicInfo');
    assert.equal(publicInfo.acceptingApplications, true);
    const terms = publicInfo.terms;
    assert.equal(terms.versionId, saved.draftVersion.versionId);
    assert.equal(terms.hash, saved.draftVersion.hash);
    assert.equal(terms.text, saved.draftVersion.text);

    const beforePublic = await counts();
    const individualInput = submission(terms);
    assert.equal(Object.hasOwn(individualInput.application, 'institution'), false);
    const individual = await publicApi('intakeSubmit', individualInput);
    const institutionData = { ...application, title: 'Synthetic institution proposal', applicantType: 'institution',
      institution: 'Synthetic Institute', fullName: 'Untrusted replacement name', email: 'representative@example.invalid' };
    const institutionInput = submission(terms, institutionData);
    const institution = await publicApi('intakeSubmit', institutionInput);
    for (const result of [individual, institution]) {
      assert.deepEqual(Object.keys(result).sort(), ['ok', 'receipt', 'status']);
      assert.deepEqual(Object.keys(result.receipt).sort(), ['id', 'status', 'submittedAt']);
      assert.equal(result.receipt.status, 'submitted');
      assert.doesNotMatch(JSON.stringify(result), /example\.invalid|Synthetic|termsHash|token|phone|permissions/i);
    }
    assert.deepEqual(await counts(), beforePublic, 'anonymous proposals create no credentials, memberships, partners or workspace records');
    assert.deepEqual(await publicApi('intakeSubmit', individualInput), individual);
    for (const bad of [{ action: 'intakeList' }, { action: 'intakeSubmit', ...individualInput, token: f.tokens.owner },
      { action: 'intakeSubmit', ...individualInput, rateBucket: 'a'.repeat(64) }]) {
      await post('/api/research-intake', bad, 400);
    }
    const submitCalls = rpcCalls.filter(call => call.p_action === 'intakeSubmit');
    assert.ok(submitCalls.every(call => call.p_token === '' && /^[a-f0-9]{64}$/.test(call.p_payload.rateBucket)));
    for (const credential of ['', f.tokens.b]) {
      await api(credential, 'intakeOwnerBootstrap', {}, 403);
      await api(credential, 'intakeGet', { applicationId: individual.receipt.id }, 403);
    }
    const inbox = await owner('intakeList');
    assert.deepEqual(inbox.applications.map(item => item.id).sort(), [individual.receipt.id, institution.receipt.id].sort());
    const original = await owner('intakeGet', { applicationId: individual.receipt.id });
    assert.deepEqual(original.application.application, application);
    assert.deepEqual(original.terms, terms);
    assert.equal(original.application.termsHash, terms.hash);
    assert.equal(original.workspace, null);
    assert.deepEqual((await owner('intakeGet', { applicationId: institution.receipt.id })).application.application, institutionData);

    const firstStudy = (await owner('studyCreate', mutation({ config: { title: 'Synthetic first draft' } }))).study;
    const createIdentity = mutation({ institution: 'Synthetic School', label: 'Synthetic verified individual' });
    const identities = await Promise.all([owner('intakeIdentityCreate', createIdentity), owner('intakeIdentityCreate', createIdentity)]);
    assert.deepEqual(identities[1], identities[0]);
    const identity = identities[0].identity;
    assert.match(identity.code, /^[A-Z0-9]+$/);
    assert.equal(identity.researchOnly, true);
    const identityRecord = await f.accessStore.get('code:' + identity.code);
    assert.equal(identityRecord.kind, 'staff');
    assert.deepEqual(identityRecord.perms, []);
    const afterIdentity = await counts();
    assert.deepEqual(afterIdentity, { ...beforePublic, credentials: beforePublic.credentials + 1 });
    const login = await post('/api/access', { action: 'login', kind: 'code', secret: identity.code });
    assert.deepEqual(login.perms, []);
    const researcher = login.token;
    assert.deepEqual((await api(researcher, 'workspaceList')).workspaces, []);
    await api(researcher, 'intakeList', {}, 403);

    const grants = ['view_study', 'view_approved_findings'];
    const approval = mutation({ applicationId: individual.receipt.id, expectedRevision: original.application.revision,
      decision: 'approved', studyId: firstStudy.id, studyExpectedRevision: firstStudy.revision,
      individualCode: identity.code, permissions: grants });
    const approved = await owner('intakeReview', approval);
    assert.equal(approved.application.status, 'approved');
    assert.equal(approved.workspace.study.status, 'draft');
    assert.equal(approved.workspace.study.revision, firstStudy.revision + 1);
    assert.deepEqual(approved.workspace.grantedPermissions, grants);
    assert.equal(approved.workspace.partnershipActive, false);
    const afterApproval = await counts();
    assert.deepEqual(afterApproval, { ...afterIdentity, memberships: 1, partners: 1, records: 3, reviews: 1 });
    assert.equal(approved.preparation.record.kind, 'agreement');
    assert.equal(approved.preparation.record.status, 'draft');
    assert.equal(approved.preparation.template.record.status, 'draft');
    assert.deepEqual(approved.preparation.version.data.requestedPermissions, grants);
    assert.deepEqual(await owner('intakeReview', approval), approved);
    assert.deepEqual(await counts(), afterApproval, 'review replay creates no duplicate rights or records');
    const recordScope = { studyId: firstStudy.id, partnerId: approved.partner.id, recordId: approved.application.recordId };
    const imported = await owner('recordGet', recordScope);
    assert.equal(imported.record.kind, 'application');
    assert.equal(imported.record.status, 'draft');
    assert.equal(imported.record.binding, false);
    assert.deepEqual(imported.version.data, application);
    const retained = await owner('intakeGet', { applicationId: individual.receipt.id });
    assert.deepEqual(retained.application.application, application);
    assert.deepEqual(retained.terms, terms);
    const privateFolder = await api(researcher, 'partnerGet', { partnerId: approved.partner.id });
    const agreementScope = {studyId:firstStudy.id,partnerId:approved.partner.id};
    assert.deepEqual((await api(researcher,'agreementSources',agreementScope)).sources.currentGrants,grants);
    await api(f.tokens.b,'agreementSources',agreementScope,404);
    await api(researcher,'agreementPrepare',mutation(agreementScope),403);
    await api(researcher,'processingPolicyGet',agreementScope,403);
    assert.deepEqual(privateFolder.workspaces.map(workspace => workspace.studyId), [firstStudy.id]);
    assert.deepEqual(privateFolder.workspaces[0].grantedPermissions, grants);
    await api(f.tokens.b, 'partnerGet', { partnerId: approved.partner.id }, 404);
    await api(f.tokens.b, 'recordGet', recordScope, 404);

    const secondStudy = (await owner('studyCreate', mutation({ config: { title: 'Synthetic second draft' } }))).study;
    const secondApproval = await owner('intakeReview', mutation({ applicationId: institution.receipt.id,
      expectedRevision: 0, decision: 'approved', studyId: secondStudy.id, studyExpectedRevision: secondStudy.revision,
      individualCode: identity.code, permissions: grants }));
    assert.equal(secondApproval.partner.id, approved.partner.id);
    assert.deepEqual(secondApproval.partner.profile, approved.partner.profile, 'untrusted later claims never overwrite an existing identity profile');
    const aggregated = await api(researcher, 'partnerGet', { partnerId: approved.partner.id });
    assert.deepEqual(aggregated.workspaces.map(workspace => workspace.studyId).sort(), [firstStudy.id, secondStudy.id].sort());
    assert.ok(aggregated.workspaces.every(workspace => JSON.stringify(workspace.grantedPermissions) === JSON.stringify(grants)));
    const member = (await owner('memberList', { studyId: firstStudy.id })).members[0];
    const currentStudy = (await owner('studyGet', { studyId: firstStudy.id })).study;
    await owner('memberRemove', mutation({ studyId: firstStudy.id, expectedRevision: currentStudy.revision, memberId: member.id }));
    const currentFolders = await api(researcher, 'partnerGet', { partnerId: approved.partner.id });
    assert.deepEqual(currentFolders.workspaces.map(workspace => workspace.studyId), [secondStudy.id]);
    await api(researcher, 'recordGet', recordScope, 404);
    const ownerHistory = await owner('partnerGet', { partnerId: approved.partner.id });
    assert.equal(ownerHistory.workspaces.length, 2);
    assert.deepEqual(ownerHistory.workspaces.find(workspace => workspace.studyId === firstStudy.id).grantedPermissions, []);
    assert.deepEqual((await owner('recordGet', recordScope)).version.data, application);
    await post('/api/access', { action: 'codeRevoke', token: f.tokens.owner, code: identity.code });
    await api(researcher, 'partnerGet', { partnerId: approved.partner.id }, 403);
    await api(researcher, 'studyGet', { studyId: secondStudy.id }, 403);
    assert.equal((await owner('intakeGet', { applicationId: individual.receipt.id })).application.status, 'approved');

    const effects = (await f.query(`SELECT
      (SELECT count(*) FROM research_private.partnership_executions)::int AS executions,
      (SELECT count(*) FROM research_private.partnership_approvals)::int AS signatures,
      (SELECT count(*) FROM research_private.partnership_signings)::int AS signingSessions,
      (SELECT count(*) FROM research_private.partnership_records WHERE kind IN ('agreement','obligation','budget'))::int AS financialOrLegalRecords,
      (SELECT count(*) FROM research_private.outbox)::int AS queuedMail,
      (SELECT count(*) FROM research_private.mail_attempts)::int AS mailAttempts`)).rows[0];
    assert.deepEqual(effects, { executions: 0, signatures: 0, signingsessions: 0, financialorlegalrecords: 2, queuedmail: 0, mailattempts: 0 });
    assert.equal(modelRequests, 0);
    assert.deepEqual(externalRequests, []);
    assert.deepEqual(new Set(rpcCalls.map(call => call.procedure)), new Set(['research_intake_rpc', 'research_rpc', 'research_partnership_rpc']));
  } finally {
    if (server) {
      const closing = new Promise(resolve => server.close(resolve));
      server.closeAllConnections();
      await closing;
    }
    globalThis.fetch = nativeFetch;
    for (const [key, value] of Object.entries(previousEnvironment)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    await f.close();
  }
});
