import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createPartnershipCopyTransport } from '../lib/research-partnership-copy-mail.mjs';

const providerId = '7e8f347c-b72b-4f46-a13e-961d50bddf25';
const recipient = 'partner@example.invalid';
const from = 'BE GOOD synthetic <owner@example.invalid>';
const bytes = Buffer.from('%PDF-1.7\nSynthetic immutable signed agreement only.');
const digest = value => createHash('sha256').update(value).digest('hex');
const message = () => ({ recipient, from, subject: 'עותק ההסכם — ניסוי', text: 'עותק בדיקה בלבד.\nSynthetic fixture only.', documentBytes: Buffer.from(bytes), documentHash: digest(bytes), filename: 'הסכם-מחקר.pdf', idempotencyKey: 'partnership-copy/synthetic-fixed-intent/owner' });
function fixture({ fetchImpl, settings = {} } = {}) {
  const calls = [];
  const transport = createPartnershipCopyTransport({ apiKey: 'synthetic-never-live-key', from, providerVersion: 'resend-api-v1', ...settings, fetchImpl: async (url, init) => {
    calls.push({ url, init });
    if (fetchImpl) return fetchImpl(url, init);
    return Response.json(init.method === 'POST' ? { id: providerId } : { id: providerId, to: [recipient], from, last_event: 'delivered', subject: 'PRIVATE_SUBJECT', text: 'PRIVATE_MAIL_BODY', html: 'PRIVATE_HTML' });
  } });
  return { transport, calls };
}
const storedReceipt = () => ({ providerId, recipient, from });

test('copy transport requires explicit configuration and never searches environment credentials', async () => {
  let calls = 0;
  for (const settings of [{}, { apiKey: 'synthetic' }, { apiKey: 'synthetic', from }, { apiKey: 'synthetic', from, providerVersion: '' }, { apiKey: 'synthetic\r\nInjected', from, providerVersion: 'v1' }, { apiKey: 'synthetic', from: 'attacker@example.invalid,other@example.invalid', providerVersion: 'v1' }, { apiKey: 'synthetic', from, providerVersion: 'v1\nsecret' }]) {
    const transport = createPartnershipCopyTransport({ ...settings, fetchImpl: async () => { calls++; } });
    assert.equal(transport.readiness().configured, false);
    assert.deepEqual(await transport.send(message()), { status: 'unavailable', safeCode: 'not_configured' });
    assert.deepEqual(await transport.receipt(storedReceipt()), { status: 'unavailable', safeCode: 'not_configured' });
  }
  assert.equal(calls, 0);
  const f = fixture();
  assert.deepEqual(f.transport.readiness(), { configured: true, state: 'ready', provider: 'resend', providerVersion: 'resend-api-v1' });
  assert.ok(Object.isFrozen(f.transport));
});

test('copy submission attaches exactly the verified PDF and records acceptance separately from delivery', async () => {
  const f = fixture(), input = message();
  const result = await f.transport.send({ ...input, unrelatedPrivateValue: 'NEVER_SEND_THIS' });
  assert.deepEqual(result, { status: 'accepted', providerId });
  assert.equal(f.calls.length, 1);
  const { url, init } = f.calls[0];
  assert.equal(url, 'https://api.resend.com/emails');
  assert.equal(init.method, 'POST'); assert.equal(init.redirect, 'error');
  assert.ok(init.signal instanceof AbortSignal); assert.equal(init.signal.aborted, false);
  assert.equal(init.headers.Authorization, 'Bearer synthetic-never-live-key');
  assert.equal(init.headers['Idempotency-Key'], input.idempotencyKey);
  assert.equal(init.headers['Content-Type'], 'application/json');
  const body = JSON.parse(init.body);
  assert.deepEqual(body, { from, to: [recipient], subject: input.subject, text: input.text, attachments: [{ filename: input.filename, content: bytes.toString('base64') }] });
  assert.ok(Buffer.from(body.attachments[0].content, 'base64').equals(bytes));
  assert.equal(digest(Buffer.from(body.attachments[0].content, 'base64')), input.documentHash);
  assert.doesNotMatch(JSON.stringify(result), /example\.invalid|PRIVATE_|synthetic-never-live|document|delivered|NEVER_/);
});

test('changed bytes, invalid PDF, destination, sender and unbounded fields fail before any transfer', async () => {
  const f = fixture();
  const tooLarge = Buffer.alloc(8 * 1024 * 1024 + 1, 65); bytes.copy(tooLarge);
  const invalid = [
    { documentBytes: Buffer.from('%PDF-1.7\nChanged after verification') }, { documentHash: 'a'.repeat(64) }, { documentHash: digest(bytes).toUpperCase() },
    { documentBytes: Buffer.from('not a PDF'), documentHash: digest(Buffer.from('not a PDF')) }, { documentBytes: bytes.toString('base64') },
    { documentBytes: tooLarge, documentHash: digest(tooLarge) }, { documentBytes: Buffer.alloc(0), documentHash: digest(Buffer.alloc(0)) },
    { recipient: 'other@example.invalid,extra@example.invalid' }, { recipient: 'Partner <partner@example.invalid>' }, { recipient: 'partner@example.invalid\r\nBcc: attacker@example.invalid' },
    { recipient: 'x'.repeat(255) + '@example.invalid' }, { from: 'other@example.invalid' }, { from: from + '\n' },
    { subject: '' }, { subject: 'x'.repeat(241) }, { subject: 'hello\nBcc: attacker' },
    { text: '' }, { text: 'x'.repeat(100001) }, { text: 'bad\0body' },
    { filename: '../agreement.pdf' }, { filename: 'x\\agreement.pdf' }, { filename: 'agreement.docx' }, { filename: 'bad\r\n.pdf' },
    { idempotencyKey: '' }, { idempotencyKey: 'x'.repeat(257) }, { idempotencyKey: 'bad\r\nkey' }
  ];
  for (const change of invalid) assert.deepEqual(await f.transport.send({ ...message(), ...change }), { status: 'blocked', safeCode: 'invalid_message' });
  assert.equal(f.calls.length, 0);
  assert.deepEqual(await f.transport.send({ ...message(), from: undefined }), { status: 'accepted', providerId });
});

test('transport snapshots configuration and serialized payload across asynchronous provider work', async () => {
  const settings = { apiKey: 'synthetic-key', from, providerVersion: 'v1' };
  let release, captured;
  const transport = createPartnershipCopyTransport({ ...settings, fetchImpl: async (_url, init) => { captured = init; await new Promise(resolve => { release = resolve; }); return Response.json({ id: providerId }); } });
  const input = message(), pending = transport.send(input);
  input.documentBytes.fill(0); input.recipient = 'changed@example.invalid'; input.subject = 'changed'; settings.apiKey = 'changed';
  release(); assert.deepEqual(await pending, { status: 'accepted', providerId });
  const sent = JSON.parse(captured.body);
  assert.equal(sent.to[0], recipient); assert.equal(sent.subject, 'עותק ההסכם — ניסוי');
  assert.ok(Buffer.from(sent.attachments[0].content, 'base64').equals(bytes));
  assert.equal(captured.headers.Authorization, 'Bearer synthetic-key');
});

test('ambiguous sends do not retry internally and return safe outcomes without provider error content', async () => {
  for (const scenario of [
    async () => { throw new Error('PRIVATE_NETWORK_URL_TOKEN'); },
    async () => Response.json({ message: 'PRIVATE_PROVIDER_ERROR' }, { status: 429 }),
    async () => Response.json({ message: 'PRIVATE_PROVIDER_ERROR' }, { status: 503 }),
    async () => Response.json({ message: 'PRIVATE_PROVIDER_ERROR' }, { status: 409 }),
    async () => Response.json({ message: 'PRIVATE_PROVIDER_ERROR' }, { status: 408 }),
    async () => Response.json({ id: 'not-an-exact-mail-id', body: 'PRIVATE_BODY' }),
    async () => Response.json({ id: [providerId], body: 'PRIVATE_BODY' }),
    async () => new Response('PRIVATE_NOT_JSON', { headers: { 'Content-Type': 'application/json' } }),
    async () => Response.json({ id: providerId }, { headers: { 'Content-Length': String(256 * 1024 + 1) } }),
    async () => new Response(JSON.stringify({ id: providerId }), { headers: { 'Content-Type': 'text/html' } })
  ]) {
    const f = fixture({ fetchImpl: scenario }), result = await f.transport.send(message());
    assert.equal(result.status, 'retry'); assert.ok(result.safeCode); assert.equal(f.calls.length, 1);
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE_|TOKEN|example\.invalid|synthetic-never-live/);
  }
  for (const status of [400, 401, 403, 404, 413, 422]) {
    const f = fixture({ fetchImpl: async () => Response.json({ message: 'PRIVATE_REJECTION' }, { status }) });
    assert.deepEqual(await f.transport.send(message()), { status: 'blocked', safeCode: 'provider_rejected' }); assert.equal(f.calls.length, 1);
  }
});

test('stored receipt polls one fixed official ID and returns only exact-bound status metadata', async () => {
  for (const status of ['delivered', 'bounced', 'delivery_delayed', 'failed', 'sent', 'suppressed']) {
    const f = fixture({ fetchImpl: async () => Response.json({ id: providerId, to: [recipient], from, last_event: status, text: 'PRIVATE_BODY', html: 'PRIVATE_HTML', subject: 'PRIVATE_SUBJECT' }) });
    assert.deepEqual(await f.transport.receipt(storedReceipt()), { providerId, status });
    assert.equal(f.calls.length, 1); assert.equal(f.calls[0].url, 'https://api.resend.com/emails/' + providerId);
    assert.equal(f.calls[0].init.method, 'GET'); assert.equal(f.calls[0].init.redirect, 'error'); assert.equal(f.calls[0].init.body, undefined);
    assert.equal(f.calls[0].init.headers['Idempotency-Key'], undefined);
  }
});

test('receipt ID, destination and sender mismatches are unavailable, never delivery proof', async () => {
  const baseline = { id: providerId, to: [recipient], from, last_event: 'delivered' };
  for (const change of [
    { id: '6b6753fb-575c-4631-b46b-a7aa23512387' }, { to: ['other@example.invalid'] }, { to: [recipient, 'extra@example.invalid'] },
    { to: recipient }, { to: [recipient.toUpperCase()] }, { from: 'Other <owner@example.invalid>' }, { from: undefined },
    { last_event: 'opened' }, { last_event: 'clicked' }, { last_event: 'new_unknown_event' }, { last_event: 'email.delivered' }, { last_event: null }
  ]) {
    const f = fixture({ fetchImpl: async () => Response.json({ ...baseline, ...change, text: 'PRIVATE_BODY' }) });
    const result = await f.transport.receipt(storedReceipt()); assert.equal(result.status, 'unavailable'); assert.equal(result.providerId, providerId);
    assert.ok(result.safeCode); assert.doesNotMatch(JSON.stringify(result), /PRIVATE_|example\.invalid|owner@|other@/);
  }
  const f = fixture();
  for (const change of [{ providerId: 'https://evil.invalid/' }, { providerId: providerId + '/other' }, { providerId: '../' }, { providerId: '' }, { providerId: [providerId] }, { recipient: 'bad' }, { from: 'changed@example.invalid' }]) assert.deepEqual(await f.transport.receipt({ ...storedReceipt(), ...change }), { status: 'unavailable', safeCode: 'invalid_receipt' });
  assert.equal(f.calls.length, 0);
});

test('receipt binding uses the original recipient snapshot rather than a later mutable object', async () => {
  let release;
  const f = fixture({ fetchImpl: async () => { await new Promise(resolve => { release = resolve; }); return Response.json({ id: providerId, to: [recipient], from, last_event: 'delivered' }); } });
  const input = storedReceipt(), pending = f.transport.receipt(input);
  input.recipient = 'changed@example.invalid'; input.providerId = '6b6753fb-575c-4631-b46b-a7aa23512387';
  release();
  assert.deepEqual(await pending, { providerId, status: 'delivered' });
  assert.equal(f.calls[0].url, 'https://api.resend.com/emails/' + providerId);
});

test('receipt unavailability, redirects and oversized streamed JSON never become delivered', async () => {
  let cancelled = false;
  const huge = () => new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(256 * 1024)); controller.enqueue(new Uint8Array(1)); }, cancel() { cancelled = true; } }), { headers: { 'Content-Type': 'application/json' } });
  const redirected = () => { const response = Response.json({ id: providerId, to: [recipient], from, last_event: 'delivered' }); Object.defineProperty(response, 'redirected', { value: true }); return response; };
  for (const response of [async () => { throw Error('PRIVATE_ERROR'); }, async () => new Response('private', { status: 404 }), async () => new Response(null, { status: 302, headers: { Location: 'https://evil.invalid/private' } }), async () => redirected(), async () => huge()]) {
    const f = fixture({ fetchImpl: response }), result = await f.transport.receipt(storedReceipt());
    assert.equal(result.status, 'unavailable'); assert.equal(result.providerId, providerId); assert.ok(result.safeCode); assert.equal(f.calls.length, 1);
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE_|evil|private/);
  }
  assert.equal(cancelled, true);
});

test('at-limit verified PDF is accepted without weakening attachment integrity checks', async () => {
  const atLimit = Buffer.alloc(8 * 1024 * 1024, 65); bytes.copy(atLimit);
  const f = fixture();
  assert.deepEqual(await f.transport.send({ ...message(), documentBytes: atLimit, documentHash: digest(atLimit) }), { status: 'accepted', providerId });
  const body = JSON.parse(f.calls[0].init.body);
  assert.equal(Buffer.from(body.attachments[0].content, 'base64').byteLength, atLimit.byteLength);
  assert.equal(digest(Buffer.from(body.attachments[0].content, 'base64')), digest(atLimit));
});
