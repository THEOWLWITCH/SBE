// Private scenario library access is server-side. Browser institution hints never
// confer access, and live permissions are checked again for every request.
import { authorizePermission } from './access.mjs';

const PERMISSIONS = ['fac_trainee', 'fac_parent', 'fac_youth'];
const FIELDS = ['id', 'institution_id', 'name', 'subtitle', 'roles', 'event_desc', 'broad_topic', 'domain',
  'content_type', 'approach', 'age_group', 'product_type', 'skills', 'language', 'duration_min', 'creator',
  'runs', 'rating', 'created_at'];
const FILTERS = { domain: 'domain', approach: 'approach', ageGroup: 'age_group', contentType: 'content_type',
  productType: 'product_type', language: 'language', creator: 'creator' };
const ORDER = { new: 'created_at.desc', used: 'runs.desc', name: 'name.asc' };
const validId = id => typeof id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(id);
const invalid = () => Object.assign(new Error('אפשר לשלוח בקשה תקינה למאגר.'), { status: 400, code: 'scenarios_invalid' });
function text(value, max) {
  if (value == null) return '';
  if (typeof value !== 'string' || value.length > max || /[\x00-\x1f\x7f]/.test(value)) throw invalid();
  return value.trim();
}
function query(body) {
  const scope = body.scope ?? 'mine', sort = body.sort ?? 'new', limit = body.limit ?? 200;
  if (!['mine', 'shared'].includes(scope) || !Object.hasOwn(ORDER, sort) || !Number.isInteger(limit) || limit < 1 || limit > 200) throw invalid();
  return { scope, sort, limit, q: text(body.q, 300),
    filters: Object.fromEntries(Object.entries(FILTERS).map(([input, column]) => [column, text(body[input], 240)])) };
}
const visible = (row, scope) => !!row && (scope.all || row.institution_id === scope.institutionId);
const publicRow = (row, detail = false) => Object.fromEntries([...FIELDS, ...(detail ? ['scenario_json'] : [])]
  .filter(field => Object.hasOwn(row, field)).map(field => [field, row[field]]));
const missing = [404, { code: 'scenarios_missing', error: 'התרחיש אינו זמין. אפשר לרענן את הרשימה.' }];

export async function handleScenarios(store, body, { repository } = {}) {
  try {
    if (!store || !repository) return [503, { code: 'scenarios_unavailable', error: 'המאגר אינו זמין כעת. אפשר לנסות שוב בהמשך.' }];
    if (!body || typeof body !== 'object' || Array.isArray(body) || !['list', 'get', 'increment'].includes(body.action)) throw invalid();
    const token = text(body.token, 4096);
    const actor = token ? await authorizePermission(store, token, PERMISSIONS) : null;
    if (token && !actor) return [403, { code: 'scenarios_forbidden', error: 'הגישה למאגר הסתיימה. אפשר להיכנס שוב עם הרשאה מתאימה.' }];
    if (body.action === 'list') {
      const options = query(body);
      if (options.scope === 'mine' && !actor) return [401, { code: 'scenarios_signin', error: 'אפשר להיכנס כדי לראות את המאגר של המוסד.' }];
      const scope = options.scope === 'shared' ? { institutionId: 'shared', all: false }
        : actor.k === 'sys' ? { institutionId: text(body.institutionId, 240) || null, all: !text(body.institutionId, 240) }
          : { institutionId: actor.inst, all: false };
      if (!scope.all && !scope.institutionId) return [403, { code: 'scenarios_forbidden', error: 'אין גישה למאגר מוסדי בכניסה הזאת.' }];
      const result = await repository.list({ ...options, ...scope });
      if (!result || !Array.isArray(result.data)) throw new Error('invalid repository response');
      const rows = result.data.filter(row => visible(row, scope));
      return [200, { data: rows.map(row => publicRow(row)), total: rows.length !== result.data.length ? rows.length
        : Number.isSafeInteger(result.total) && result.total >= rows.length ? result.total : rows.length,
        institutionId: actor?.inst || null, scope: options.scope }];
    }
    if (!validId(body.id)) throw invalid();
    // Two exact queries avoid interpolation into a PostgREST OR expression.
    // Each returned row is also checked before any data is released.
    const shared = { institutionId: 'shared', all: false };
    const own = actor?.k === 'sys' ? { all: true, institutionId: null }
      : actor?.inst ? { all: false, institutionId: actor.inst } : null;
    let row = await repository.get(body.id, shared);
    if (!visible(row, shared)) row = null;
    if (!row && own) {
      const candidate = await repository.get(body.id, own);
      if (visible(candidate, own)) row = candidate;
    }
    if (!row) return missing;
    if (body.action === 'get') return [200, { scenario: publicRow(row, true) }];
    // The database RPC repeats the scope condition atomically. If ownership was
    // changed after the read, the counter update is refused rather than leaked.
    const scope = own || { institutionId: null, all: false };
    return await repository.increment(body.id, scope) ? [200, { ok: true }] : missing;
  } catch (error) {
    if (error.status === 400) return [400, { code: error.code, error: error.message }];
    return [503, { code: 'scenarios_unavailable', error: 'המאגר אינו זמין כעת. אפשר לנסות שוב בהמשך.' }];
  }
}

// Double-quoted PostgREST scalar values preserve commas, parentheses, quotes,
// backslashes and mixed Hebrew text as one value. URLSearchParams encodes once.
const exact = value => 'eq."' + value.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
export function supabaseScenarios(url, key, { fetchImpl = fetch, timeoutMs = 15000 } = {}) {
  if (typeof key !== 'string' || !key) throw new Error('scenarios configuration missing');
  const origin = new URL(url);
  if (!['https:', 'http:'].includes(origin.protocol) || origin.username || origin.password || origin.search || origin.hash) throw new Error('invalid scenarios configuration');
  const base = origin.href.replace(/\/+$/, '') + '/rest/v1';
  const headers = { apikey: key, 'Content-Type': 'application/json', Accept: 'application/json',
    ...(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(key) ? { Authorization: 'Bearer ' + key } : {}) };
  async function request(path, options = {}) {
    const response = await fetchImpl(base + path, { ...options, headers: { ...headers, ...options.headers }, signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) throw new Error('scenarios repository request failed');
    return response;
  }
  function scoped(scope) {
    if (!scope || typeof scope !== 'object' || (scope.all !== true && !text(scope.institutionId, 240))) throw invalid();
    return scope.all === true ? null : exact(text(scope.institutionId, 240));
  }
  function params(scope, detail = false) {
    const p = new URLSearchParams({ select: [...FIELDS, ...(detail ? ['scenario_json'] : [])].join(',') });
    const filter = scoped(scope);
    if (filter !== null) p.set('institution_id', filter);
    return p;
  }
  return {
    async list(options) {
      const p = params(options);
      const { sort = 'new', limit = 200, q = '', filters = {} } = options;
      if (!Object.hasOwn(ORDER, sort) || !Number.isInteger(limit) || limit < 1 || limit > 200) throw invalid();
      if (text(q, 300)) p.set('search_vector', 'wfts(simple).' + text(q, 300));
      for (const column of Object.values(FILTERS)) if (text(filters[column], 240)) p.set(column, exact(text(filters[column], 240)));
      p.set('order', ORDER[sort]); p.set('limit', String(limit));
      const response = await request('/scenarios?' + p.toString(), { headers: { Prefer: 'count=exact' } });
      const data = await response.json();
      const count = Number((response.headers.get('Content-Range') || '').split('/')[1]);
      return { data, total: Number.isSafeInteger(count) && count >= 0 ? count : data.length };
    },
    async get(id, scope) {
      if (!validId(id)) throw invalid();
      const p = params(scope, true); p.set('id', exact(id)); p.set('limit', '1');
      const data = await (await request('/scenarios?' + p.toString())).json();
      return data[0] || null;
    },
    async increment(id, scope) {
      if (!validId(id) || !scope || typeof scope.all !== 'boolean') throw invalid();
      const institutionId = text(scope.institutionId, 240) || null;
      const response = await request('/rpc/be_good_increment_scenario_runs', { method: 'POST',
        body: JSON.stringify({ p_id: id, p_institution: institutionId, p_all: scope.all }) });
      return await response.json() === true;
    },
  };
}
