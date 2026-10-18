import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const PARTNERSHIP_ACTIONS = new Set([...require('../../app/lib/research-partnership-core.js').CLIENT_ACTIONS, 'signingPrepare', 'signatureComplete', 'signingEvidencePut', 'signingEventContext', 'signingStateUpdate']);
const CODES = Object.freeze({ not_found: 404, unauthorized: 403, invalid: 400, conflict: 409, consent_changed: 409, rate_limited: 429, not_configured: 503, unavailable: 503 });
export class ResearchStoreError extends Error {
  constructor(code = 'unavailable', status = CODES[code] || 503) { super(code in CODES ? code : 'unavailable'); this.name = 'ResearchStoreError'; this.code = this.message; this.status = CODES[this.code] || status; }
}
export function supabaseResearchStore(url, key, { fetchImpl = globalThis.fetch, timeoutMs = 8000 } = {}) {
  if (!url || !key || typeof fetchImpl !== 'function') throw new ResearchStoreError('not_configured');
  const endpoint = String(url).replace(/\/$/, '') + '/rest/v1/rpc/';
  return Object.freeze({ async rpc(token, action, payload = {}) {
    if (typeof token !== 'string' || typeof action !== 'string' || !payload || typeof payload !== 'object' || Array.isArray(payload)) throw new ResearchStoreError('invalid');
    const headers = { apikey: key, 'Content-Type': 'application/json', Accept: 'application/json' };
    if (!String(key).startsWith('sb_secret_')) headers.Authorization = 'Bearer ' + key;
    try {
      const response = await fetchImpl(endpoint + (PARTNERSHIP_ACTIONS.has(action) ? 'research_partnership_rpc' : 'research_rpc'), { method: 'POST', headers, body: JSON.stringify({ p_token: token, p_action: action, p_payload: payload }), signal: AbortSignal.timeout(timeoutMs) });
      const result = await response.json();
      if (!response.ok) throw new ResearchStoreError('unavailable');
      if (!result || typeof result !== 'object' || Array.isArray(result)) throw new ResearchStoreError('unavailable');
      if (result.error) throw new ResearchStoreError(result.error, result.status);
      return result;
    } catch (error) { if (error instanceof ResearchStoreError) throw error; throw new ResearchStoreError('unavailable'); }
  } });
}
