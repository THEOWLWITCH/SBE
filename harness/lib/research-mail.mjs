import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto';

const AAD = Buffer.from('BEGOOD-research-v1', 'utf8');
const DAY = 24 * 3600000;
const unavailable = () => Object.assign(new Error('Research contact configuration unavailable'), { status: 503, code: 'not_configured' });
const milliseconds = value => typeof value === 'function' ? Number(value()) : value == null ? Date.now() : Number(value);

function encryptionKey(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9+/]{43}=$/.test(value)) throw unavailable();
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32 || key.toString('base64') !== value) throw unavailable();
  return key;
}

export function encryptResearchValue(value, contactKey) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(contactKey), iv);
  cipher.setAAD(AAD);
  const data = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return { v: 1, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') };
}

export function decryptResearchValue(envelope, contactKey) {
  if (!envelope || envelope.v !== 1 || typeof envelope.iv !== 'string' || typeof envelope.tag !== 'string' || typeof envelope.data !== 'string') throw unavailable();
  const decode = value => {
    const bytes = Buffer.from(value, 'base64');
    if (bytes.toString('base64') !== value) throw unavailable();
    return bytes;
  };
  const iv = decode(envelope.iv), tag = decode(envelope.tag), data = decode(envelope.data);
  if (iv.length !== 12 || tag.length !== 16) throw unavailable();
  try {
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(contactKey), iv);
    decipher.setAAD(AAD); decipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8'));
  } catch { throw unavailable(); }
}

export const researchDigest = value => createHash('sha256').update(value, 'utf8').digest('hex');
export const researchOpaqueToken = () => randomBytes(32).toString('base64url');

export function researchContactOptions(options = {}) {
  const env = options.env || process.env;
  const contactKey = options.contactKey ?? env.RESEARCH_CONTACT_KEY;
  encryptionKey(contactKey);
  let origin;
  try { origin = new URL(options.siteOrigin ?? env.CORS_ORIGIN?.split(',')[0]?.trim()); } catch { throw unavailable(); }
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw unavailable();
  return { contactKey, siteOrigin: origin.origin };
}

// HMAC authority is restricted by SQL to INTERNAL_ACTIONS; this is not a system session.
export async function researchWorkerToken(accessStore, { now } = {}) {
  const secret = (await accessStore.get('token-secret'))?.secret;
  if (typeof secret !== 'string' || !secret) throw unavailable();
  const body = Buffer.from(JSON.stringify({ k: 'research_worker', purpose: 'research', exp: milliseconds(now) + 5 * 60000 })).toString('base64url');
  return body + '.' + createHmac('sha256', secret).update(body).digest('base64url');
}

function deliveryOptions(options) {
  const env = options.env || process.env;
  const contact = researchContactOptions(options);
  const apiKey = options.apiKey ?? env.RESEND_API_KEY;
  const from = options.from ?? env.NOTIFY_FROM;
  if (typeof apiKey !== 'string' || !apiKey || typeof from !== 'string' || /[\r\n\x00]/.test(from) || !/@/.test(from)) throw unavailable();
  return { ...contact, apiKey, from };
}

function mailBody(message, settings) {
  const contact = decryptResearchValue(message.contactCiphertext, settings.contactKey);
  const body = decryptResearchValue(message.payloadCiphertext, settings.contactKey);
  if (typeof contact.email !== 'string' || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(contact.email) || contact.email.length > 254 ||
    typeof body.subject !== 'string' || !body.subject || body.subject.length > 240 || /[\r\n\x00]/.test(body.subject) ||
    typeof body.text !== 'string' || !body.text || body.text.length > 100000) throw unavailable();
  return { from: settings.from, to: [contact.email], subject: body.subject, text: body.text };
}

// A provider acceptance is recorded separately from delivery. The persistent
// intent/key survives retries; no ambiguous request is sent after the 24h window.
export async function runResearchMail(accessStore, researchStore, options = {}) {
  const result = { accepted: 0, retry: 0, blocked: 0, unknown: 0, cancelled: 0 };
  let settings;
  try { settings = deliveryOptions(options); } catch { return { ...result, code: 'not_configured' }; }
  if (!researchStore?.rpc || !accessStore?.get) return { ...result, code: 'not_configured' };
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const time = milliseconds(options.now);
  if (!Number.isFinite(time)) return { ...result, code: 'not_configured' };
  const limit = Number.isInteger(options.limit) && options.limit >= 1 && options.limit <= 100 ? options.limit : 20;
  const leaseSeconds = 60;
  try {
    const workerCall = async (action, payload) => researchStore.rpc(await researchWorkerToken(accessStore, { now: options.now }), action, payload);
    await workerCall('followupSchedule', options.studyId ? { studyId: options.studyId } : {});
    for (let processed = 0; processed < limit; processed++) {
      const claimed = await workerCall('mailClaim', { limit: 1, leaseSeconds });
      const initial = claimed.messages?.[0];
      if (!initial) break;
      // This fresh transaction sees withdrawals, current consent, preferences,
      // pause and credential revocation committed since the initial batch claim.
      const fresh = await workerCall('mailClaim', { messageId: initial.messageId, leaseId: initial.leaseId });
      const message = fresh.messages?.find(row => row.messageId === initial.messageId && row.leaseId === initial.leaseId);
      if (!message) { result.cancelled++; continue; }
      const complete = (outcome, extra = {}) => workerCall('mailComplete', { messageId: message.messageId, leaseId: message.leaseId, outcome, ...extra });
      const firstAttempt = message.firstAttemptAt == null ? null : Date.parse(message.firstAttemptAt);
      if (firstAttempt !== null && (!Number.isFinite(firstAttempt) || milliseconds(options.now) - firstAttempt >= DAY)) {
        await complete('unknown', { code: 'dedup_window_expired' }); result.unknown++; continue;
      }
      let body;
      try { body = mailBody(message, settings); }
      catch { await complete('blocked', { code: 'not_configured' }); result.blocked++; continue; }
      if (typeof message.idempotencyKey !== 'string' || !message.idempotencyKey || message.idempotencyKey.length > 256 || /[\r\n\x00]/.test(message.idempotencyKey)) {
        await complete('blocked', { code: 'invalid_intent' }); result.blocked++; continue;
      }
      let outcome = 'retry', providerId, code = 'provider_uncertain';
      try {
        const response = await fetchImpl('https://api.resend.com/emails', {
          method: 'POST', headers: { Authorization: 'Bearer ' + settings.apiKey, 'Content-Type': 'application/json', 'Idempotency-Key': message.idempotencyKey },
          body: JSON.stringify(body), signal: AbortSignal.timeout(options.timeoutMs || 15000)
        });
        if (response.ok) {
          const accepted = await response.json();
          if (typeof accepted.id === 'string' && accepted.id.length > 0 && accepted.id.length <= 200) { outcome = 'accepted'; providerId = accepted.id; code = undefined; }
        } else if (response.status >= 400 && response.status < 500 && ![408, 409, 429].includes(response.status)) { outcome = 'blocked'; code = 'provider_rejected'; }
        else code = 'provider_unavailable';
      } catch { /* The provider may have accepted before the connection failed. */ }
      await complete(outcome, { ...(providerId ? { providerId } : {}), ...(code ? { code } : {}) });
      result[outcome]++;
    }
    return result;
  } catch (error) { return { ...result, code: error.code === 'not_configured' ? 'not_configured' : 'storage_unavailable' }; }
}
