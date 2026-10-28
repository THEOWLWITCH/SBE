import { createHash } from 'node:crypto';

// Pure Resend boundary: the trusted runner owns current authorization, encrypted
// intent storage, immutable recipient snapshots and the 24-hour deduplication
// window. This transport never searches credentials or retries a mutation.
// https://resend.com/docs/api-reference/emails/send-email
// https://resend.com/docs/api-reference/emails/retrieve-email
const BASE = 'https://api.resend.com/emails';
const MAX_DOCUMENT = 8 * 1024 * 1024;
const MAX_JSON = 256 * 1024;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const HASH = /^[a-f0-9]{64}$/;
const RECEIPT_STATUSES = new Set(['delivered', 'bounced', 'delivery_delayed', 'failed', 'sent', 'suppressed']);
const mailId = value => typeof value === 'string' && UUID.test(value);
const singleLine = (value, max) => typeof value === 'string' && value.length > 0 && value.length <= max && value.trim() === value && !/[\x00-\x1f\x7f]/.test(value);
const email = value => singleLine(value, 254) && /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(value);
const sender = value => singleLine(value, 500) && (email(value) || (() => {
  const match = /^([^<>]+) <([^<>]+)>$/.exec(value);
  return !!match && singleLine(match[1], 200) && !/[,;]/.test(match[1]) && email(match[2]);
})());
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

function configuration(input) {
  if (!input || !singleLine(input.apiKey, 512) || !/^[\x21-\x7e]+$/.test(input.apiKey) || !sender(input.from) || !singleLine(input.providerVersion, 200)) return null;
  return { apiKey: input.apiKey, from: input.from, providerVersion: input.providerVersion };
}

function outbound(message, settings) {
  if (!message || !email(message.recipient) || (message.from !== undefined && message.from !== settings.from) ||
    !singleLine(message.subject, 240) || typeof message.text !== 'string' || !message.text.length || message.text.length > 100000 || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(message.text) ||
    !singleLine(message.filename, 150) || /[\\/:*?"<>|]/.test(message.filename) || !/\.pdf$/i.test(message.filename) ||
    !singleLine(message.idempotencyKey, 256) || !/^[\x21-\x7e]+$/.test(message.idempotencyKey) || !HASH.test(message.documentHash || '') ||
    !(message.documentBytes instanceof Uint8Array) || message.documentBytes.byteLength < 5 || message.documentBytes.byteLength > MAX_DOCUMENT) return null;
  // Freeze the exact bytes into the JSON request before the first asynchronous
  // operation; a mutable caller Buffer cannot change the verified attachment.
  const bytes = Buffer.from(message.documentBytes);
  if (bytes.subarray(0, 5).toString('ascii') !== '%PDF-' || sha256(bytes) !== message.documentHash) return null;
  return { key: message.idempotencyKey, body: JSON.stringify({ from: settings.from, to: [message.recipient], subject: message.subject, text: message.text, attachments: [{ filename: message.filename, content: bytes.toString('base64') }] }) };
}

async function boundedJson(response) {
  const contentType = response.headers?.get?.('content-type')?.split(';')[0].trim().toLowerCase();
  const length = response.headers?.get?.('content-length');
  if (contentType !== 'application/json' || (length !== null && length !== undefined && (!/^\d+$/.test(length) || Number(length) > MAX_JSON)) || !response.body?.getReader) throw new Error('invalid_response');
  const reader = response.body.getReader(), chunks = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_JSON) { await reader.cancel(); throw new Error('invalid_response'); }
      chunks.push(Buffer.from(value));
    }
  } finally { reader.releaseLock(); }
  const value = JSON.parse(Buffer.concat(chunks, total).toString('utf8'));
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid_response');
  return value;
}

export function createPartnershipCopyTransport(options = {}) {
  const settings = configuration(options);
  const fetchImpl = options?.fetchImpl || globalThis.fetch;
  const configured = !!settings && typeof fetchImpl === 'function';
  async function request(url, init) {
    return fetchImpl(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(20000), headers: { Authorization: 'Bearer ' + settings.apiKey, Accept: 'application/json', ...init.headers } });
  }
  return Object.freeze({
    readiness() { return { configured, state: configured ? 'ready' : 'not_configured', provider: 'resend', ...(configured ? { providerVersion: settings.providerVersion } : {}) }; },
    async send(message) {
      if (!configured) return { status: 'unavailable', safeCode: 'not_configured' };
      const input = outbound(message, settings);
      if (!input) return { status: 'blocked', safeCode: 'invalid_message' };
      try {
        const response = await request(BASE, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': input.key }, body: input.body });
        if (!response?.ok || response.redirected) {
          if (!response?.redirected && response?.status >= 400 && response.status < 500 && ![408, 409, 429].includes(response.status)) return { status: 'blocked', safeCode: 'provider_rejected' };
          return { status: 'retry', safeCode: 'provider_uncertain' };
        }
        const accepted = await boundedJson(response);
        if (!mailId(accepted.id)) return { status: 'retry', safeCode: 'provider_uncertain' };
        // Acceptance proves only submission to Resend. Delivery is a separate,
        // exact-ID/recipient/from receipt and never means the recipient read it.
        return { status: 'accepted', providerId: accepted.id };
      } catch { return { status: 'retry', safeCode: 'provider_uncertain' }; }
    },
    async receipt(message) {
      if (!configured) return { status: 'unavailable', safeCode: 'not_configured' };
      if (!message || !mailId(message.providerId) || !email(message.recipient) || (message.from !== undefined && message.from !== settings.from)) return { status: 'unavailable', safeCode: 'invalid_receipt' };
      const providerId = message.providerId, recipient = message.recipient;
      try {
        const response = await request(BASE + '/' + providerId, { method: 'GET' });
        if (!response?.ok || response.redirected) return { providerId, status: 'unavailable', safeCode: 'provider_unavailable' };
        const receipt = await boundedJson(response);
        if (receipt.id !== providerId || !Array.isArray(receipt.to) || receipt.to.length !== 1 || receipt.to[0] !== recipient || receipt.from !== settings.from) return { providerId, status: 'unavailable', safeCode: 'receipt_mismatch' };
        if (!RECEIPT_STATUSES.has(receipt.last_event)) return { providerId, status: 'unavailable', safeCode: 'receipt_unavailable' };
        return { providerId, status: receipt.last_event };
      } catch { return { providerId, status: 'unavailable', safeCode: 'provider_unavailable' }; }
    }
  });
}
