import test from 'node:test';
import assert from 'node:assert/strict';
import https from 'node:https';
import { createRequire, syncBuiltinESMExports } from 'node:module';
import { EventEmitter, once } from 'node:events';
import { createHash } from 'node:crypto';
import * as providers from '../lib/providers.mjs';
import { createPracticeServer } from '../practice-server.mjs';
import { createPartnershipIntegration } from '../fixtures/research-partnership-integrated.mjs';
import { impactRequest, minimizePartnershipImpact, IMPACT_VERSIONS } from '../lib/research-partnership-impact.mjs';
import CORE from '../../app/lib/research-partnership-core.js';
const INVITE = createRequire(import.meta.url)('../../app/lib/invite-language.js');

function environment(t, values) {
  const previous = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  for (const [key, value] of Object.entries(values)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
  t.after(() => { for (const [key, value] of Object.entries(previous)) if (value === undefined) delete process.env[key]; else process.env[key] = value; });
}
function captureOpenAI(t, onCall = async () => {}) {
  const requests = [];
  t.mock.method(https, 'request', (options, callback) => {
    assert.equal(options.hostname, 'api.openai.com');
    const request = new EventEmitter(); let data = '';
    request.write = chunk => { data += chunk; };
    request.end = () => { queueMicrotask(async () => {
      const body = JSON.parse(data); requests.push(body); const reply = await onCall(body);
      const response = new EventEmitter(); response.statusCode = reply?.status || 200; response.setEncoding = () => {};
      callback(response); response.emit('data', JSON.stringify(reply?.body || { output_text: 'הסבר סינתטי בלבד.', usage: {} })); response.emit('end');
    }); };
    return request;
  });
  syncBuiltinESMExports();
  t.after(() => { t.mock.restoreAll(); syncBuiltinESMExports(); });
  return requests;
}

test('provider metadata resolves defaults and model binding without any API key or provider construction', t => {
  environment(t, { PROVIDER: undefined, MODEL: undefined, OPENAI_API_KEY: undefined, ANTHROPIC_API_KEY: undefined });
  assert.equal(typeof providers.getProviderDescriptor, 'function');
  const defaults = providers.getProviderDescriptor();
  assert.equal(defaults.provider, 'anthropic'); assert.equal(defaults.model, 'claude-opus-5');
  assert.ok(defaults.version); assert.equal(Object.hasOwn(defaults, 'apiKey'), false);
  process.env.PROVIDER = 'openai';
  const standard = providers.getProviderDescriptor(); assert.equal(standard.model, 'gpt-4.1');
  process.env.MODEL = 'synthetic-model';
  const selected = providers.getProviderDescriptor();
  assert.equal(selected.provider, 'openai'); assert.equal(selected.model, 'synthetic-model'); assert.notEqual(selected.version, standard.version);
  assert.throws(() => providers.getProvider('openai'), /OPENAI_API_KEY/);
});

test('existing OpenAI adapter preserves exact research input with no storage and keeps professional and communication policies', async t => {
  environment(t, { MODEL: 'synthetic-model', OPENAI_API_KEY: 'synthetic-key-only' });
  let transient = false;const wire = captureOpenAI(t,()=>{if(transient){transient=false;return {status:503,body:{error:{message:'synthetic unavailable'}}};}}), provider = providers.getProvider('openai');
  const request = impactRequest(minimizePartnershipImpact('agreement', [{ path: 'startDate', before: '2026-11-01', after: '2026-11-02' }]), { kind: 'agreement' });
  await provider.complete(request);
  assert.equal(wire[0].store, false); assert.equal(wire[0].temperature, 0.3);
  assert.deepEqual(wire[0].input, [{ role: 'system', content: request.system }, ...request.messages]);
  await provider.complete({ system: 'professional system', prompt: 'professional prompt', variation: 'medium', maxTokens: 100 });
  assert.equal(Object.hasOwn(wire[1], 'store'), false); assert.equal(wire[1].temperature, 0.7);
  assert.equal(wire[1].input, INVITE.apply('professional system') + '\n\nprofessional prompt');
  await provider.complete({ system: 'communication system', messages: [{ role: 'user', content: 'synthetic message' }], policy: 'communication-continuity', variation: 'fast', maxTokens: 100 });
  assert.equal(wire[2].store, false); assert.match(wire[2].input[0].content, /communication system/);
  transient=true;await provider.complete({system:'professional retry',prompt:'synthetic',variation:'low',maxTokens:100});assert.equal(wire.length,5,'professional retries retain their existing behavior');
  transient=true;await assert.rejects(()=>provider.complete(request),error=>error.retryable===true);assert.equal(wire.length,6,'research failures require an explicitly reauthorized new request');
});

test('HTTP default impact wiring constructs only after scoped approval, records exact provenance and suppresses revoked results', { timeout: 180000 }, async t => {
  environment(t, { PROVIDER: 'openai', MODEL: 'synthetic-model', OPENAI_API_KEY: undefined, SUPABASE_URL: 'https://impact.synthetic.invalid', SUPABASE_SERVICE_KEY: 'synthetic-service-only' });
  const f = await createPartnershipIntegration(); t.after(() => f.close());
  const nativeFetch = globalThis.fetch, actions = []; let constructed = 0, revoke = false, withdraw = false, unavailable = false;
  t.mock.method(globalThis, 'fetch', async (target, init) => {
    const url = new URL(target); assert.equal(url.origin, process.env.SUPABASE_URL); assert.match(url.pathname, /research_(?:partnership_)?rpc$/);
    const body = JSON.parse(init.body); actions.push(body.p_action);
    try { return Response.json(await f.researchStore.rpc(body.p_token, body.p_action, body.p_payload)); }
    catch (error) { return Response.json({ error: error.code, status: error.status || 503 }); }
  });
  const wire = captureOpenAI(t, async () => {
    assert.deepEqual(actions.slice(-2), ['impactAuthorize', 'impactAuthorize']);
    if (revoke) await f.query("UPDATE public.access_settings SET value=value||'{\"revoked\":true}' WHERE key='code:STAFFA'");
    if(withdraw){withdraw=false;await savePolicy();}
    if(unavailable){unavailable=false;return {status:503,body:{error:{message:'synthetic unavailable'}}};}
  });
  const server = createPracticeServer({ authStore: f.accessStore, providerFactory: name => { constructed++; return providers.getProvider(name); } });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  let base = 'http://127.0.0.1:' + server.address().port;
  async function api(token, action, payload = {}, expected = 200) {
    const response = await nativeFetch(base + '/api/research', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token, action, ...payload }) });
    const out = await response.json(); assert.equal(response.status, expected, JSON.stringify(out)); return out;
  }
  const bootstrap = await api(f.tokens.a, 'workspaceBootstrap');
  assert.equal(bootstrap.readiness.impactAI.state, 'scope_policy_required'); assert.equal(bootstrap.readiness.impactAI.configured, false);
  assert.equal(constructed, 0); assert.equal(wire.length, 0);
  const { study } = await f.seedStudy();
  const partner = (await f.checked(f.tokens.owner, 'partnerSave', f.request({ individualCode: f.codes.a, expectedRevision: null, profile: { fullName: 'Synthetic Partner', email: 'partner@example.invalid' } }))).partner;
  await f.checked(f.tokens.owner, 'memberSet', f.request({ studyId: study.id, expectedRevision: study.revision, code: f.codes.a, role: 'researcher', permissions: CORE.ACCESS_PRESETS.approved_findings }));
  const scope = { studyId: study.id, partnerId: partner.id };
  let saved = await f.checked(f.tokens.a, 'recordSave', f.request({ ...scope, kind: 'agreement', expectedRevision: null, data: { title: 'Synthetic only', ownerName: 'Synthetic Owner', partnerName: 'Synthetic Partner', startDate: '2026-11-01' } }));
  const from = saved.version;
  saved = await f.checked(f.tokens.a, 'recordSave', f.request({ ...scope, recordId: saved.record.id, kind: 'agreement', expectedRevision: saved.record.revision, data: { ...saved.version.data, startDate: '2026-11-02' } }));
  const exact = { ...scope, recordId: saved.record.id, fromVersionId: from.id, toVersionId: saved.version.id, includeAI: true };
  assert.equal((await api(f.tokens.a, 'workspaceImpact', exact)).ai.state, 'blocked'); assert.equal(constructed, 0);
  process.env.OPENAI_API_KEY = 'synthetic-key-only';
  const descriptor = providers.getProviderDescriptor();
  const policy = { purpose: 'external_impact', provider: descriptor.provider, providerVersion: descriptor.version, dataCategories: ['agreement_changes', 'personal', 'confidential'], authorizedActors: ['sys', 'code:STAFFA'], ...Object.fromEntries(['partyRoles', 'transferBasis', 'storageLocation', 'retention', 'backups', 'deletion', 'withdrawal', 'securityMeasures', 'ethicsReference', 'consentReview'].map(key => [key, 'Synthetic explicit ' + key])) };
  async function savePolicy() {
    const current = (await f.checked(f.tokens.owner, 'processingPolicyGet', { ...scope, purpose: 'external_impact' })).policy;
    return (await f.checked(f.tokens.owner, 'processingPolicySave', f.request({ ...scope, expectedRevision: current?.revision || 0, policy }))).policy;
  }
  async function approve() { const draft = await savePolicy(); await f.checked(f.tokens.owner, 'processingPolicyApprove', f.request({ ...scope, expectedRevision: draft.revision, policyVersionId: draft.id, policyHash: draft.hash })); }
  await approve();
  const explained = await api(f.tokens.a, 'workspaceImpact', exact);
  assert.equal(explained.ai.state, 'ready'); assert.equal(explained.ai.summary, 'הסבר סינתטי בלבד.'); assert.equal(constructed, 1); assert.equal(wire.length, 1);
  const request = { ...impactRequest(minimizePartnershipImpact('agreement', CORE.compareRecords('agreement', from.data, saved.version.data)), { kind: 'agreement' }), model: descriptor.model };
  assert.deepEqual(wire[0].input, [{ role: 'system', content: request.system }, ...request.messages]); assert.equal(wire[0].store, false);
  const events = (await f.query("SELECT e.*,p.policy->>'providerVersion' AS provider_version FROM research_private.partnership_processing_events e JOIN research_private.processing_policies p ON p.id=e.policy_id ORDER BY e.created_at,e.id")).rows;
  assert.equal(events.length, 2); assert.ok(events.every(event => event.payload_hash === createHash('sha256').update(JSON.stringify(request)).digest('hex') && event.provider === descriptor.provider && event.provider_version === descriptor.version && event.model === descriptor.model && event.prompt_version === IMPACT_VERSIONS.prompt && event.engine_version === IMPACT_VERSIONS.engine));
  assert.doesNotMatch(JSON.stringify(events), /הסבר סינתטי בלבד|synthetic-key-only|Synthetic Partner/);
  withdraw=true;const withdrawn=await api(f.tokens.a,'workspaceImpact',exact);assert.equal(withdrawn.ai.state,'blocked');assert.equal(withdrawn.ai.summary,null);assert.equal(wire.length,2);await approve();
  const originalBase = base;
  process.env.MODEL = 'synthetic-model-next';
  const changedModelServer = createPracticeServer({ authStore: f.accessStore, providerFactory: name => { constructed++; return providers.getProvider(name); } });
  changedModelServer.listen(0, '127.0.0.1'); await once(changedModelServer, 'listening');
  try {
    base = 'http://127.0.0.1:' + changedModelServer.address().port;
    assert.equal((await api(f.tokens.a, 'workspaceImpact', exact)).ai.state, 'blocked');
    assert.equal(constructed, 2); assert.equal(wire.length, 2, 'approval for a previous model never authorizes a new model');
  } finally {
    base = originalBase; process.env.MODEL = descriptor.model;
    changedModelServer.closeAllConnections(); await new Promise(resolve => changedModelServer.close(resolve));
  }
  await savePolicy(); assert.equal((await api(f.tokens.a, 'workspaceImpact', exact)).ai.state, 'blocked'); assert.equal(constructed, 2); assert.equal(wire.length, 2);
  await approve(); revoke = true;
  const revoked = await api(f.tokens.a, 'workspaceImpact', exact, 403); assert.doesNotMatch(JSON.stringify(revoked), /הסבר סינתטי בלבד/);
  assert.equal(wire.length, 3); assert.equal((await f.query("SELECT count(*)::int n FROM research_private.partnership_processing_events WHERE outcome='succeeded'")).rows[0].n, 3);
  await f.query("UPDATE public.access_settings SET value=value-'revoked' WHERE key='code:STAFFA'");unavailable=true;
  await api(f.tokens.a,'workspaceImpact',exact,403);assert.equal(wire.length,4,'revocation after a retryable response must prevent another transfer');
  assert.equal((await f.query("SELECT count(*)::int n FROM research_private.partnership_processing_events WHERE outcome='failed'")).rows[0].n,1);
});
