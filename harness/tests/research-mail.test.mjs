import test from 'node:test';
import assert from 'node:assert/strict';
import { CONTACT_KEY, EMAIL, IDS, accessFixture, rpcFixture } from '../fixtures/research-scenarios.mjs';
const load = () => import('../lib/research-mail.mjs');

test('AES-GCM protects contact/body/token and authenticates tampering', async () => {
  const { encryptResearchValue, decryptResearchValue } = await load();
  const encrypted = encryptResearchValue({ email: EMAIL, verificationToken: 'synthetic-token' }, CONTACT_KEY);
  assert.ok(!JSON.stringify(encrypted).includes(EMAIL)); assert.equal(decryptResearchValue(encrypted, CONTACT_KEY).email, EMAIL);
  assert.throws(() => decryptResearchValue({ ...encrypted, tag: Buffer.alloc(16).toString('base64') }, CONTACT_KEY));
  assert.throws(() => encryptResearchValue({}, 'bad'));
});

async function mailFixture({ recheck = true, firstAttemptAt = null } = {}) {
  const m = await load(); const a = accessFixture(); const now = Date.now();
  const message = { messageId: IDS.message, leaseId: 'synthetic-lease', participantId: IDS.participant, studyId: IDS.studyA, kind: 'welcome', idempotencyKey: 'synthetic-idempotency', createdAt: new Date(now).toISOString(), firstAttemptAt,
    contactCiphertext: m.encryptResearchValue({ email: EMAIL }, CONTACT_KEY), payloadCiphertext: m.encryptResearchValue({ subject: 'Synthetic welcome', text: 'Synthetic test only' }, CONTACT_KEY) };
  let finished = false;
  const r = rpcFixture((action, payload) => {
    if (action === 'mailClaim') {
      if (payload.messageId && !recheck) finished = true;
      return { messages: finished ? [] : [message] };
    }
    if (action === 'mailComplete') finished = true;
    return { complete: true };
  });
  return { m, a, r, message, now, opts: { contactKey: CONTACT_KEY, apiKey: 'synthetic-provider-key', from: 'Synthetic <sender@example.invalid>', siteOrigin: 'https://example.invalid', now: () => now } };
}

test('mail dispatch repeats current eligibility immediately before sending and preserves provider key', async () => {
  const { m, a, r, opts } = await mailFixture(); const requests = [];
  const result = await m.runResearchMail(a.store, r, { ...opts, fetchImpl: async (url, init) => { requests.push({ url, init }); return { ok: true, status: 200, json: async () => ({ id: 'synthetic-provider-id' }) }; } });
  assert.equal(requests.length, 1); assert.equal(requests[0].init.headers['Idempotency-Key'], 'synthetic-idempotency');
  assert.equal(JSON.parse(requests[0].init.body).html, undefined); assert.equal(result.accepted, 1);
  assert.deepEqual(r.calls.map(c => c.action), ['followupSchedule', 'mailClaim', 'mailClaim', 'mailComplete', 'mailClaim']);
  assert.equal(r.calls.find(call => call.action === 'mailComplete').payload.outcome, 'accepted');
});

test('withdrawal/current-consent recheck cancels stale claims before provider fetch', async () => {
  const { m, a, r, opts } = await mailFixture({ recheck: false }); let sent = 0;
  const result = await m.runResearchMail(a.store, r, { ...opts, fetchImpl: async () => { sent++; } });
  assert.equal(sent, 0); assert.equal(result.cancelled, 1); assert.ok(!r.calls.some(c => c.action === 'mailComplete'));
});

test('lost acknowledgments beyond dedup window are unknown and never automatically resent', async () => {
  const { m, a, r, opts, now } = await mailFixture({ firstAttemptAt: new Date(Date.now() - 25 * 3600000).toISOString() }); let sent = 0;
  const result = await m.runResearchMail(a.store, r, { ...opts, now: () => now, fetchImpl: async () => { sent++; } });
  assert.equal(sent, 0); assert.equal(result.unknown, 1); assert.equal(r.calls.find(call => call.action === 'mailComplete').payload.outcome, 'unknown');
});

test('timeout retries existing intent/key within24h and missing configuration is visible', async () => {
  const { m, a, r, opts } = await mailFixture();
  const result = await m.runResearchMail(a.store, r, { ...opts, fetchImpl: async () => { throw Error('synthetic network uncertainty'); } });
  assert.equal(result.retry, 1); assert.equal(r.calls.find(call => call.action === 'mailComplete').payload.outcome, 'retry');
  const unavailable = await m.runResearchMail(a.store, r, {});
  assert.equal(unavailable.code, 'not_configured'); assert.equal(unavailable.accepted, 0);
});

test('deduplication age is checked at each dispatch rather than batch start', async () => {
  const fixture = await mailFixture(); const { m, a, r, opts, message, now } = fixture;
  message.firstAttemptAt = new Date(now - 23 * 3600000).toISOString();
  let clock = now, sent = 0;
  const originalRpc = r.rpc.bind(r);
  r.rpc = async (...args) => {
    const result = await originalRpc(...args);
    if (args[1] === 'mailClaim' && args[2].messageId) clock += 2 * 3600000;
    return result;
  };
  const result = await m.runResearchMail(a.store, r, { ...opts, now: () => clock, fetchImpl: async () => { sent++; } });
  assert.equal(sent, 0); assert.equal(result.unknown, 1);
});

test('provider transient, idempotency-in-progress and permanent failures have durable safe outcomes', async () => {
  for (const [status, expected] of [[429, 'retry'], [503, 'retry'], [409, 'retry'], [422, 'blocked']]) {
    const { m, a, r, opts } = await mailFixture();
    const result = await m.runResearchMail(a.store, r, { ...opts, fetchImpl: async () => ({ ok: false, status, json: async () => ({ message: 'Private provider email detail' }) }) });
    assert.equal(result[expected], 1); assert.equal(r.calls.find(call => call.action === 'mailComplete').payload.outcome, expected); assert.ok(!JSON.stringify(result).includes('Private'));
  }
});

test('sequential delivery claims one intent at a time so later mail never waits on an expiring batch lease', async () => {
  const { m, a, r, opts } = await mailFixture();
  await m.runResearchMail(a.store, r, { ...opts, limit: 100, fetchImpl: async () => ({ ok: true, json: async () => ({ id: 'synthetic-provider-id' }) }) });
  const initialClaims = r.calls.filter(call => call.action === 'mailClaim' && !call.payload.messageId);
  assert.ok(initialClaims.length >= 1); assert.ok(initialClaims.every(call => call.payload.limit === 1));
});
