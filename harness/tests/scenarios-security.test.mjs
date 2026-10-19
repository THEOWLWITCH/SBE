import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { handleScenarios, supabaseScenarios } from '../lib/scenarios.mjs';
import { handleAccess } from '../lib/access.mjs';
import { seedOwnerPassword, SYNTHETIC_OWNER_PASSWORD } from './synthetic-access.mjs';

async function fixture() {
  const secret = 'synthetic-scenario-test-key';
  const data = new Map(Object.entries({ 'token-secret': { secret }, institutions: [
    { name: 'בית ספר א׳', active: true }, { name: 'בית ספר ב׳', active: true } ],
    'modules:בית ספר א׳': { fac_trainee: true }, 'modules:בית ספר ב׳': { fac_trainee: true },
    'code:AAAATEST': { code: 'AAAA-TEST', inst: 'בית ספר א׳', kind: 'staff', perms: ['fac_trainee'], revoked: false },
    'code:BBBBTEST': { code: 'BBBB-TEST', inst: 'בית ספר ב׳', kind: 'staff', perms: ['fac_trainee'], revoked: false },
    'code:WRITTEST': { code: 'WRIT-TEST', inst: 'בית ספר א׳', kind: 'staff', perms: ['writer'], revoked: false },
  }));
  const store = { async get(k) { return data.get(k) || null; }, async set(k,v) { data.set(k,v); } };
  await seedOwnerPassword(store);
  const tokens = {};
  for (const [name, code] of [['a','AAAA-TEST'],['b','BBBB-TEST'],['writer','WRIT-TEST']])
    tokens[name] = (await handleAccess(store,{action:'login',kind:'code',secret:code}))[1].token;
  tokens.sys = (await handleAccess(store,{action:'login',kind:'sys',secret:SYNTHETIC_OWNER_PASSWORD}))[1].token;
  const rows = [
    { id: 'TR-A-01', institution_id: 'בית ספר א׳', name: 'פרטי א', runs: 0, scenario_json: { name: 'פרטי א' } },
    { id: 'TR-B-01', institution_id: 'בית ספר ב׳', name: 'פרטי ב', runs: 0, scenario_json: { name: 'פרטי ב' } },
    { id: 'TR-S-01', institution_id: 'shared', name: 'משותף', runs: 0, scenario_json: { name: 'משותף' } },
    { id: 'TR-U-01', institution_id: 'unknown', name: 'ללא בעלות', runs: 0 },
  ];
  const allowed = (row, scope) => scope.all || row.institution_id === scope.institutionId;
  const repository = {
    async list(scope) { const visible = rows.filter(r => allowed(r, scope)); return { data: visible, total: visible.length }; },
    async get(id, scope) { return rows.find(r => r.id === id && allowed(r, scope)) || null; },
    async increment(id, scope) { const row = rows.find(r => r.id === id && (scope.all || r.institution_id === 'shared' || r.institution_id === scope.institutionId)); if (!row) return false; row.runs++; return true; },
  };
  return { data, store, tokens, rows, repository };
}

test('anonymous listing is explicitly shared and private list derives the live institution', async () => {
  const f = await fixture();
  assert.equal((await handleScenarios(f.store, { action: 'list' }, f))[0], 401);
  const [sharedStatus, shared] = await handleScenarios(f.store, { action: 'list', scope: 'shared' }, f);
  assert.equal(sharedStatus, 200); assert.deepEqual(shared.data.map(r => r.id), ['TR-S-01']);
  const [status, out] = await handleScenarios(f.store, { action: 'list', token: f.tokens.a, institutionId: 'בית ספר ב׳' }, f);
  assert.equal(status, 200); assert.deepEqual(out.data.map(r => r.id), ['TR-A-01']);
  assert.equal((await handleScenarios(f.store, { action: 'list', token: f.tokens.writer }, f))[0], 403);
});

test('known IDs do not grant cross-institution reads or updates, and admin has global access', async () => {
  const f = await fixture();
  for (const action of ['get', 'increment']) {
    assert.equal((await handleScenarios(f.store, { action, id: 'TR-B-01', token: f.tokens.a, institutionId: 'בית ספר ב׳' }, f))[0], 404);
    assert.equal((await handleScenarios(f.store, { action, id: 'TR-A-01', token: f.tokens.b }, f))[0], 404);
    assert.equal((await handleScenarios(f.store, { action, id: 'TR-U-01', token: f.tokens.a }, f))[0], 404);
    assert.equal((await handleScenarios(f.store, { action, id: 'TR-A-01' }, f))[0], 404);
    assert.equal((await handleScenarios(f.store, { action, id: 'TR-S-01' }, f))[0], 200);
    assert.equal((await handleScenarios(f.store, { action, id: 'TR-A-01', token: f.tokens.a }, f))[0], 200);
    assert.equal((await handleScenarios(f.store, { action, id: 'TR-B-01', token: f.tokens.sys }, f))[0], 200);
  }
  assert.equal(f.rows[1].runs, 1);
});

test('revocation, removed module, forged token and unavailable configuration stop private access', async () => {
  const f = await fixture();
  f.data.get('code:AAAATEST').revoked = true;
  assert.equal((await handleScenarios(f.store, { action: 'get', id: 'TR-A-01', token: f.tokens.a }, f))[0], 403);
  assert.equal((await handleScenarios(f.store, { action: 'get', id: 'TR-A-01', token: f.tokens.a.slice(0, -2) + 'xx' }, f))[0], 403);
  f.data.get('code:AAAATEST').revoked = false;
  f.data.set('modules:בית ספר א׳', { fac_trainee: false, fac_parent: false, fac_youth: false });
  assert.equal((await handleScenarios(f.store, { action: 'get', id: 'TR-A-01', token: f.tokens.a }, f))[0], 403);
  assert.equal((await handleScenarios(null, { action: 'list', scope: 'shared' }, {}))[0], 503);
});

test('input validation and repository errors disclose no upstream details', async () => {
  const f = await fixture();
  for (const payload of [{ action: 'get', id: 'x&select=*' }, { action: 'list', scope: 'all' }, { action: 'list', limit: 10001 }, { action: 'list', q: 'x'.repeat(301) }, { action: 'list', sort: 'unsafe' }])
    assert.equal((await handleScenarios(f.store, { ...payload, token: f.tokens.a }, f))[0], 400);
  const [, out] = await handleScenarios(f.store, { action: 'list', scope: 'shared' }, { repository: { async list() { throw new Error('synthetic-private-upstream-detail'); } } });
  assert.equal(JSON.stringify(out).includes('synthetic-private-upstream-detail'), false);
});

test('adapter uses encoded exact scope filters and service-only atomic increment', async () => {
  const calls = [];
  const repository = supabaseScenarios('https://synthetic.example.test', 'synthetic-key', { fetchImpl: async (url, options) => {
    calls.push({ url: new URL(url), options });
    return new Response(options.method === 'POST' ? 'true' : '[]', { headers: { 'Content-Range': '0-0/0', 'Content-Type': 'application/json' } });
  } });
  const institutionId = 'בית ספר (א), \\"מבחן"';
  await repository.list({ institutionId, q: 'x&select=*', filters: { domain: 'a,b)' }, sort: 'new', limit: 10 });
  assert.equal(calls[0].url.pathname, '/rest/v1/scenarios');
  assert.equal(calls[0].url.searchParams.get('institution_id'), 'eq."' + institutionId.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"');
  assert.equal(calls[0].url.searchParams.has('or'), false);
  assert.equal(calls[0].url.searchParams.get('search_vector'), 'wfts(simple).x&select=*');
  assert.equal(calls[0].options.headers.Authorization, undefined, 'opaque keys are apikey-only');
  assert.equal(await repository.increment('TR-A-01', { institutionId, all: false }), true);
  assert.equal(calls[1].url.pathname, '/rest/v1/rpc/be_good_increment_scenario_runs');
  assert.deepEqual(JSON.parse(calls[1].options.body), { p_id: 'TR-A-01', p_institution: institutionId, p_all: false });
});

test('browser routes all scenario actions through the server with the existing signed session token', async () => {
  const source = await readFile(new URL('../../app/lib/sbe-db.js', import.meta.url), 'utf8');
  assert.match(source, /\/api\/scenarios/);
  assert.match(source, /sbe\.session\.token/);
  assert.doesNotMatch(source, /sb_publishable_|SUPABASE_KEY|\/rest\/v1/);
});

test('search opens the current server-authorized detail and starts anonymous browsing in shared scope', async () => {
  const source = await readFile(new URL('../../app/search.html', import.meta.url), 'utf8');
  assert.match(source, /await getScenario\(r\.id\)/);
  assert.match(source, /setScope\(signedIn \? 'mine' : 'shared'\)/);
  assert.match(source, /readonly dir="rtl"/);
  assert.doesNotMatch(source, /sessionStorage\.getItem\('sbe_inst'\)|instEl\.addEventListener\('input'/);
});

async function syntheticDatabase() {
  // Test-only runtime outside the application. This is never a hosted DB test.
  const { PGlite } = await import(new URL('../../../research-test-runtime/node_modules/@electric-sql/pglite/dist/index.js', import.meta.url));
  const db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    CREATE TABLE public.access_settings(key text PRIMARY KEY, value jsonb);
    CREATE TABLE public.scenarios(id text PRIMARY KEY, institution_id text, runs integer);
    INSERT INTO public.access_settings VALUES ('synthetic:private', '{"private":true}');
    INSERT INTO public.scenarios VALUES ('TR-A-01', 'בית ספר א׳', 0), ('TR-B-01', 'בית ספר ב׳', 0),
      ('TR-S-01', 'shared', 0), ('TR-U-01', 'unknown', 0), ('TR-N-01', NULL, 0);
    GRANT ALL ON public.access_settings, public.scenarios TO anon, authenticated;
    CREATE FUNCTION public.increment_scenario_runs(p_id text) RETURNS void LANGUAGE sql SECURITY DEFINER
      AS 'UPDATE public.scenarios SET runs = runs + 1 WHERE id = p_id';`);
  return db;
}

test('synthetic PostgreSQL enforces shared-only client reads, service-only data and scoped atomic counters', async () => {
  const db = await syntheticDatabase();
  try {
    const migration = await readFile(new URL('../migrations/20261014-service-data-boundaries.sql', import.meta.url), 'utf8');
    await db.exec(migration);
    await db.exec(migration); // Repeat without broad policy removal or data loss.
    for (const role of ['anon', 'authenticated']) {
      await db.exec('SET ROLE ' + role);
      assert.deepEqual((await db.query('SELECT id FROM public.scenarios ORDER BY id')).rows, [{ id: 'TR-S-01' }]);
      assert.deepEqual((await db.query("SELECT id FROM public.scenarios WHERE id='TR-A-01'")).rows, []);
      await assert.rejects(db.query('SELECT * FROM public.access_settings'), /permission denied/);
      await assert.rejects(db.query("UPDATE public.scenarios SET runs=9 WHERE id='TR-S-01'"), /permission denied/);
      await assert.rejects(db.query("SELECT public.increment_scenario_runs('TR-A-01')"), /permission denied/);
      await assert.rejects(db.query("SELECT public.be_good_increment_scenario_runs('TR-A-01', 'בית ספר א׳', true)"), /permission denied/);
      await db.exec('RESET ROLE');
    }
    await db.exec('SET ROLE service_role');
    assert.equal((await db.query('SELECT count(*)::integer AS n FROM public.access_settings')).rows[0].n, 1);
    for (const [id, inst, all, wanted] of [['TR-A-01', 'בית ספר א׳', false, true], ['TR-B-01', 'בית ספר א׳', false, false],
      ['TR-S-01', null, false, true], ['TR-U-01', 'בית ספר א׳', false, false], ['TR-N-01', null, false, false], ['TR-B-01', null, true, true]]) {
      assert.equal((await db.query('SELECT public.be_good_increment_scenario_runs($1,$2,$3) AS ok', [id, inst, all])).rows[0].ok, wanted);
    }
    assert.deepEqual((await db.query('SELECT id,runs FROM public.scenarios ORDER BY id')).rows,
      [{ id: 'TR-A-01', runs: 1 }, { id: 'TR-B-01', runs: 1 }, { id: 'TR-N-01', runs: 0 }, { id: 'TR-S-01', runs: 1 }, { id: 'TR-U-01', runs: 0 }]);
  } finally { await db.close(); }
});

test('prepared migration refuses an unexpected existing policy and preserves it on rollback', async () => {
  const db = await syntheticDatabase();
  try {
    await db.exec('CREATE POLICY unrelated_existing_policy ON public.scenarios FOR SELECT USING (true)');
    const migration = await readFile(new URL('../migrations/20261014-service-data-boundaries.sql', import.meta.url), 'utf8');
    await assert.rejects(db.exec(migration), /Unexpected existing policy/);
    await db.exec('ROLLBACK');
    assert.equal((await db.query("SELECT count(*)::integer AS n FROM pg_policy WHERE polname='unrelated_existing_policy'")).rows[0].n, 1);
    assert.equal((await db.query('SELECT count(*)::integer AS n FROM public.scenarios')).rows[0].n, 5);
  } finally { await db.close(); }
});

test('known legacy anon_read policy is narrowed before strict service hardening without changing scenario rows', async () => {
  const db = await syntheticDatabase();
  try {
    await db.exec('ALTER TABLE public.scenarios ENABLE ROW LEVEL SECURITY; CREATE POLICY anon_read ON public.scenarios FOR SELECT TO anon USING (true)');
    const before = (await db.query('SELECT * FROM public.scenarios ORDER BY id')).rows;
    await db.exec('SET ROLE anon');
    assert.equal((await db.query('SELECT count(*)::int n FROM public.scenarios')).rows[0].n, 5);
    await db.exec('RESET ROLE');
    const originalPolicy = (await db.query("SELECT oid FROM pg_policy WHERE polrelid='public.scenarios'::regclass AND polname='anon_read'")).rows[0].oid;
    await db.exec(await readFile(new URL('../migrations/20261019-normalize-legacy-scenario-policy.sql', import.meta.url), 'utf8'));
    const narrowed = (await db.query("SELECT oid,polname,pg_get_expr(polqual,polrelid) AS expression FROM pg_policy WHERE polrelid='public.scenarios'::regclass")).rows;
    assert.equal(narrowed.length, 1);
    assert.equal(narrowed[0].oid, originalPolicy, 'rename and narrowing preserve the original policy object');
    assert.equal(narrowed[0].polname, 'be_good_scenarios_shared_read');
    await db.exec('SET ROLE anon');
    assert.deepEqual((await db.query('SELECT id FROM public.scenarios ORDER BY id')).rows, [{ id: 'TR-S-01' }]);
    await db.exec('RESET ROLE');
    await db.exec(await readFile(new URL('../migrations/20261014-service-data-boundaries.sql', import.meta.url), 'utf8'));
    for (const role of ['anon', 'authenticated']) {
      await db.exec('SET ROLE ' + role);
      try {
        assert.deepEqual((await db.query('SELECT id FROM public.scenarios ORDER BY id')).rows, [{ id: 'TR-S-01' }]);
        await assert.rejects(db.query("UPDATE public.scenarios SET runs=9 WHERE id='TR-S-01'"), /permission denied/);
        await assert.rejects(db.query('SELECT * FROM public.access_settings'), /permission denied/);
      } finally { await db.exec('RESET ROLE'); }
    }
    assert.deepEqual((await db.query('SELECT * FROM public.scenarios ORDER BY id')).rows, before);
  } finally { await db.close(); }
});

test('legacy policy normalization refuses unknown definitions or additional policies and preserves them on rollback', async () => {
  const db = await syntheticDatabase();
  try {
    const migration = await readFile(new URL('../migrations/20261019-normalize-legacy-scenario-policy.sql', import.meta.url), 'utf8');
    const definitions = [
      'CREATE POLICY unrelated_existing_policy ON public.scenarios FOR SELECT TO anon USING (true)',
      'CREATE POLICY anon_read ON public.scenarios FOR SELECT TO anon USING (false)',
      'CREATE POLICY anon_read ON public.scenarios FOR SELECT TO anon,authenticated USING (true)',
      'CREATE POLICY anon_read ON public.scenarios AS RESTRICTIVE FOR SELECT TO anon USING (true)',
      'CREATE POLICY anon_read ON public.scenarios FOR ALL TO anon USING (true) WITH CHECK (true)',
      'CREATE POLICY anon_read ON public.scenarios FOR SELECT TO anon USING (true); CREATE POLICY be_good_scenarios_shared_read ON public.scenarios FOR SELECT TO anon USING (true)',
      'CREATE POLICY anon_read ON public.scenarios FOR SELECT TO anon USING (true); CREATE POLICY unrelated_existing_policy ON public.scenarios FOR SELECT USING (false)'
    ];
    const rows = (await db.query('SELECT * FROM public.scenarios ORDER BY id')).rows;
    for (const definition of definitions) {
      await db.exec('BEGIN; ' + definition);
      const before = (await db.query("SELECT oid,polname,polcmd,polpermissive,polroles,pg_get_expr(polqual,polrelid) AS qualifier,pg_get_expr(polwithcheck,polrelid) AS check_expression FROM pg_policy WHERE polrelid='public.scenarios'::regclass ORDER BY polname")).rows;
      // Keep fixture policies committed so migration rollback must preserve them.
      await db.exec('COMMIT');
      await assert.rejects(db.exec(migration), /Unexpected/);
      await db.exec('ROLLBACK');
      const after = (await db.query("SELECT oid,polname,polcmd,polpermissive,polroles,pg_get_expr(polqual,polrelid) AS qualifier,pg_get_expr(polwithcheck,polrelid) AS check_expression FROM pg_policy WHERE polrelid='public.scenarios'::regclass ORDER BY polname")).rows;
      assert.deepEqual(after, before);
      assert.deepEqual((await db.query('SELECT * FROM public.scenarios ORDER BY id')).rows, rows);
      for (const policy of before) await db.exec('DROP POLICY ' + policy.polname + ' ON public.scenarios');
    }
  } finally { await db.close(); }
});
