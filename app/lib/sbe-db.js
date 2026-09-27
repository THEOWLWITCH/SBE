// Supabase REST client — קריאה בלבד עם המפתח הציבורי.
// כתיבה (שמירת תרחישים) — דרך practice-server.mjs בלבד (מפתח שירות).

const SUPABASE_URL = 'https://liausvuuqxeaildbbsjm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Gpyb_CFqhRodf8CPhpXuyw_bhvkH1S5';
const REST = `${SUPABASE_URL}/rest/v1`;

const BASE_HEADERS = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  Accept: 'application/json',
};

async function supa(path, opts = {}) {
  const r = await fetch(`${REST}${path}`, {
    ...opts,
    headers: { ...BASE_HEADERS, ...opts.headers },
  });
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error(`Supabase ${r.status}: ${body || r.statusText}`);
  }
  return r;
}

const SELECT_COLS = [
  'id','institution_id','name','subtitle','roles','event_desc',
  'broad_topic','domain','content_type','approach','age_group',
  'product_type','skills','language','duration_min','creator',
  'runs','rating','created_at',
].join(',');

export async function fetchScenarios({
  q            = '',
  institutionId = '',
  scope         = 'mine',   // 'mine' | 'shared'
  domain        = '',
  approach      = '',
  ageGroup      = '',
  contentType   = '',
  productType   = '',
  language      = '',
  creator       = '',
  sort          = 'new',    // 'new' | 'used' | 'name'
  limit         = 200,
} = {}) {
  const url = new URL(`${REST}/scenarios`);
  const p = url.searchParams;
  p.set('select', SELECT_COLS);

  if (scope === 'mine' && institutionId) {
    p.set('institution_id', `eq.${institutionId}`);
  } else if (scope === 'shared') {
    p.set('institution_id', 'eq.shared');
  }

  if (q.trim()) p.set('search_vector', `wfts(simple).${q.trim()}`);

  if (domain)       p.set('domain',        `eq.${domain}`);
  if (approach)     p.set('approach',      `eq.${approach}`);
  if (ageGroup)     p.set('age_group',     `eq.${ageGroup}`);
  if (contentType)  p.set('content_type',  `eq.${contentType}`);
  if (productType)  p.set('product_type',  `eq.${productType}`);
  if (language)     p.set('language',      `eq.${language}`);
  if (creator)      p.set('creator',       `eq.${creator}`);

  const ORDER = { new: 'created_at.desc', used: 'runs.desc', name: 'name.asc' };
  p.set('order', ORDER[sort] ?? 'created_at.desc');
  p.set('limit', String(limit));

  const r = await supa(`/scenarios?${p.toString()}`, {
    headers: { Prefer: 'count=exact' },
  });
  const cr = r.headers.get('Content-Range') || '';
  const total = parseInt(cr.split('/')[1] ?? '0', 10) || 0;
  const data = await r.json();
  return { data, total };
}

export async function getScenario(id) {
  const r = await supa(`/scenarios?id=eq.${encodeURIComponent(id)}&select=*&limit=1`);
  const [row] = await r.json();
  return row ?? null;
}

export async function incrementRuns(id) {
  try {
    await supa('/rpc/increment_scenario_runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_id: id }),
    });
  } catch { /* non-critical */ }
}
