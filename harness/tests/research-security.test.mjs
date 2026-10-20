import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createResearchDatabase, token, TOKENS, SECRET, OWNER_PASSWORD, request } from '../fixtures/research-database.mjs';
import { readFile } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { verifyToken } from '../lib/access.mjs';
import { createPracticeServer } from '../practice-server.mjs';
import { createModelLimits } from '../lib/model-limits.mjs';
import { accessFixture } from '../fixtures/research-scenarios.mjs';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import PARTNERSHIP_CORE from '../../app/lib/research-partnership-core.js';

const version = record => createHash('sha256').update(record.salt + ':' + record.hash).digest('hex');

test('research authentication survives the complete hardened release migration order under a non-superuser operator without opening credential access', async () => {
  const runtime = process.env.RESEARCH_PGLITE_PATH || fileURLToPath(new URL('../../../research-test-runtime/node_modules/@electric-sql/pglite/', import.meta.url));
  const { PGlite } = await import(pathToFileURL(runtime + '/dist/index.js').href);
  const { pgcrypto } = await import(pathToFileURL(runtime + '/dist/contrib/pgcrypto.js').href);
  const db = new PGlite({ extensions: { pgcrypto } });
  const rpc = async (credential, action, payload = {}, name = 'research_rpc') => {
    await db.exec('SET ROLE service_role');
    try { return (await db.query('SELECT public.' + name + '($1,$2,$3::jsonb) AS result', [credential, action, payload])).rows[0].result; }
    finally { await db.exec('RESET ROLE'); }
  };
  try {
    await db.exec('CREATE ROLE migration_operator NOLOGIN NOSUPERUSER NOBYPASSRLS CREATEROLE; CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS; CREATE TABLE public.access_settings(key text PRIMARY KEY,value jsonb NOT NULL); CREATE TABLE public.scenarios(id text PRIMARY KEY,institution_id text,runs integer);');
    for (const [key, value] of [
      ['token-secret', { secret: SECRET }], ['pw-sys', OWNER_PASSWORD],
      ['institutions', [{ name: 'Synthetic School', active: true }]], ['settings', { graceDays: 14 }],
      ['unrelated-sensitive', { synthetic: true }],
      ...['STAFFA', 'STAFFB'].map(code => ['code:' + code, { code, kind: 'staff', inst: 'Synthetic School', perms: ['writer'], revoked: false }])
    ]) await db.query('INSERT INTO public.access_settings VALUES($1,$2)', [key, value]);
    // The hosted migration operator owns application objects and has explicit
    // crypto grant authority; CREATEROLE does not make it a PostgreSQL superuser.
    await db.exec('ALTER TABLE public.access_settings OWNER TO migration_operator; ALTER TABLE public.scenarios OWNER TO migration_operator; CREATE SCHEMA extensions AUTHORIZATION migration_operator; CREATE EXTENSION pgcrypto WITH SCHEMA extensions; GRANT USAGE,CREATE ON SCHEMA public TO migration_operator; GRANT EXECUTE ON FUNCTION extensions.hmac(bytea,bytea,text) TO migration_operator WITH GRANT OPTION;');
    const databaseName = (await db.query('SELECT current_database() AS name')).rows[0].name;
    await db.exec('GRANT CREATE ON DATABASE "' + databaseName.replace(/"/g, '""') + '" TO migration_operator; SET ROLE migration_operator');
    for (const migration of ['20261014-service-data-boundaries.sql', '20261013-communication-storage.sql', '20261013-research-management.sql', '20261018-research-partnerships.sql']) {
      await db.exec(await readFile(new URL('../migrations/' + migration, import.meta.url), 'utf8'));
    }
    const boundary = await readFile(new URL('../migrations/20261019-research-auth-boundary.sql', import.meta.url), 'utf8');
    await db.exec('ALTER ROLE research_worker LOGIN');
    await assert.rejects(db.exec(boundary), /role is missing or unsafe/);
    await db.exec('ROLLBACK; ALTER ROLE research_worker NOLOGIN');
    await db.exec('CREATE POLICY synthetic_existing_auth_policy ON public.access_settings FOR SELECT TO research_worker USING (false)');
    await assert.rejects(db.exec(boundary), /none are replaced/);
    await db.exec('ROLLBACK');
    assert.equal((await db.query("SELECT count(*)::int n FROM pg_policy WHERE polname='synthetic_existing_auth_policy'")).rows[0].n, 1);
    await db.exec('DROP POLICY synthetic_existing_auth_policy ON public.access_settings');
    await db.exec(boundary);
    for (const migration of ['20261020-partnership-profile.sql', '20261020-partnership-intake.sql', '20261020-guided-agreement-contract.sql', '20261020-guided-agreements.sql', '20261020-guided-signing.sql', '20261020-guided-workflow.sql']) {
      await db.exec(await readFile(new URL('../migrations/' + migration, import.meta.url), 'utf8'));
    }
    assert.deepEqual((await db.query("SELECT current_user,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user")).rows[0], { current_user: 'migration_operator', rolsuper: false, rolbypassrls: false });
    const partnershipContract=(await db.query('SELECT research_private.partnership_contract() c')).rows[0].c;
    assert.deepEqual(partnershipContract.schemas,PARTNERSHIP_CORE.RECORD_SCHEMAS);
    assert.deepEqual(partnershipContract.operations,PARTNERSHIP_CORE.OPERATIONS);
    assert.deepEqual(partnershipContract.versions,PARTNERSHIP_CORE.VERSIONS);
    assert.deepEqual(partnershipContract.guidedAgreement,PARTNERSHIP_CORE.GUIDED_AGREEMENT);
    assert.equal((await db.query("SELECT has_schema_privilege('research_worker','research_private','CREATE') AS allowed")).rows[0].allowed, false);

    assert.equal((await rpc(TOKENS.owner, 'bootstrap')).owner, true, 'owner authentication must work after storage RLS hardening');
    assert.equal((await rpc(TOKENS.owner, 'workspaceBootstrap', {}, 'research_partnership_rpc')).owner, true);
    const a = (await rpc(TOKENS.owner, 'studyCreate', request({ config: { title: 'Synthetic hardened study A' } }))).study;
    const b = (await rpc(TOKENS.owner, 'studyCreate', request({ config: { title: 'Synthetic hardened study B' } }))).study;
    const intakeRpc = (credential, action, payload = {}) => rpc(credential, action, payload, 'research_intake_rpc');
    let termsState = (await intakeRpc(TOKENS.owner, 'intakeOwnerBootstrap')).termsState;
    assert.equal((await intakeRpc('', 'intakePublicInfo')).acceptingApplications, false);
    termsState = (await intakeRpc(TOKENS.owner, 'intakeTermsSave', request({ expectedRevision: termsState.revision, title: 'Synthetic hardened intake', text: 'Synthetic conditions, no agreement.' }))).termsState;
    await intakeRpc(TOKENS.owner, 'intakeTermsPublish', request({ expectedRevision: termsState.revision, versionId: termsState.draftVersion.versionId }));
    const terms = (await intakeRpc('', 'intakePublicInfo')).terms;
    const incoming = await intakeRpc('', 'intakeSubmit', request({ termsVersionId: terms.versionId, termsHash: terms.hash, acknowledged: true, rateBucket: 'b'.repeat(64), application: { applicantType: 'individual', title: 'Synthetic hardened proposal', applicationType: 'partnership', fullName: 'Synthetic Partner B', email: 'hardened@example.invalid', objectives: 'Synthetic collaboration', requestedTools: ['communication'] } }));
    assert.equal(incoming.receipt.status, 'submitted');
    assert.equal((await intakeRpc(TOKENS.a, 'intakeList')).error, 'unauthorized');
    const approval = await intakeRpc(TOKENS.owner, 'intakeReview', request({ applicationId: incoming.receipt.id, expectedRevision: 0, decision: 'approved', studyId: b.id, studyExpectedRevision: b.revision, individualCode: 'STAFFB', permissions: ['view_study', 'view_approved_findings'] }));
    assert.equal(approval.application.status, 'approved', JSON.stringify(approval));
    assert.deepEqual(approval.workspace.grantedPermissions, ['view_study', 'view_approved_findings']);
    assert.equal(approval.workspace.study.status, 'draft');
    await rpc(TOKENS.owner, 'memberSet', request({ studyId: a.id, expectedRevision: a.revision, code: 'STAFFA', role: 'researcher', permissions: ['view_study'] }));
    assert.deepEqual((await rpc(TOKENS.a, 'bootstrap')).studies.map(study => study.id), [a.id]);
    assert.equal((await rpc(TOKENS.a, 'studyGet', { studyId: b.id })).error, 'not_found');
    for (const role of ['anon', 'authenticated']) {
      await db.exec('SET ROLE ' + role);
      try {
        await assert.rejects(db.query('SELECT * FROM public.access_settings'), /permission denied/);
        for (const name of ['research_rpc', 'research_partnership_rpc', 'research_intake_rpc']) await assert.rejects(db.query('SELECT public.' + name + '($1,$2,$3::jsonb)', [TOKENS.owner, 'bootstrap', {}]), /permission denied/);
      } finally { await db.exec('RESET ROLE'); }
    }
    const worker = (await db.query("SELECT rolcanlogin,rolsuper,rolbypassrls FROM pg_roles WHERE rolname='research_worker'")).rows[0];
    assert.deepEqual(worker, { rolcanlogin: false, rolsuper: false, rolbypassrls: false });
    await db.exec('SET ROLE research_worker');
    try {
      assert.deepEqual((await db.query('SELECT key FROM public.access_settings ORDER BY key')).rows.map(row => row.key), ['code:STAFFA', 'code:STAFFB', 'institutions', 'pw-sys', 'settings', 'token-secret']);
      await assert.rejects(db.query("UPDATE public.access_settings SET value='{}'::jsonb WHERE key='token-secret'"), /row-level security/);
      await assert.rejects(db.query("INSERT INTO public.access_settings VALUES('code:FORGED','{}'::jsonb)"), /permission denied/);
      await assert.rejects(db.query("DELETE FROM public.access_settings WHERE key='pw-sys'"), /permission denied/);
    } finally { await db.exec('RESET ROLE'); }
    await db.query("UPDATE public.access_settings SET value=value||'{\"revoked\":true}'::jsonb WHERE key='code:STAFFA'");
    assert.equal((await rpc(TOKENS.a, 'bootstrap')).error, 'unauthorized');
    assert.equal((await rpc(TOKENS.a, 'workspaceBootstrap', {}, 'research_partnership_rpc')).error, 'unauthorized');
  } finally { await db.close(); }
});

test('research migration rejects an unsafe existing worker without changing its attributes or existing records', async () => {
  const fixture = await createResearchDatabase();
  try {
    await fixture.db.exec('ALTER ROLE research_worker LOGIN');
    const migration = await readFile(new URL('../migrations/20261013-research-management.sql', import.meta.url), 'utf8');
    await assert.rejects(fixture.db.exec(migration), /Unsafe existing research role/);
    await fixture.db.exec('ROLLBACK');
    assert.equal((await fixture.db.query("SELECT rolcanlogin FROM pg_roles WHERE rolname='research_worker'")).rows[0].rolcanlogin, true);
    assert.equal((await fixture.db.query("SELECT count(*)::int n FROM public.access_settings WHERE key='pw-sys'")).rows[0].n, 1);
  } finally { await fixture.close(); }
});

test('research SQL and access authentication reject legacy and rotated owner credentials', async () => {
  const fixture = await createResearchDatabase();
  const password = {salt:'synthetic-owner-salt',hash:'synthetic-owner-hash'};
  const set = value => fixture.db.query('INSERT INTO public.access_settings VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value',['pw-sys',value]);
  const store = {async get(key) {return (await fixture.db.query('SELECT value FROM public.access_settings WHERE key=$1',[key])).rows[0]?.value || null;}};
  try {
    await set(password);
    const legacy = token({k:'sys'}), current = token({k:'sys',authVersion:version(password)});
    assert.equal(await verifyToken(store,legacy),null);
    assert.equal((await fixture.rpc(legacy,'bootstrap')).error,'unauthorized');
    assert.equal((await verifyToken(store,current)).k,'sys');
    assert.equal((await fixture.rpc(current,'bootstrap')).owner,true);
    const replacement = {...password,hash:'rotated-synthetic-hash'};
    await set(replacement);
    assert.equal(await verifyToken(store,current),null);
    assert.equal((await fixture.rpc(current,'bootstrap')).error,'unauthorized');
    const renewed = token({k:'sys',authVersion:version(replacement)});
    assert.equal((await fixture.rpc(renewed,'bootstrap')).owner,true);
    await fixture.db.query("DELETE FROM public.access_settings WHERE key='pw-sys'");
    assert.equal((await fixture.rpc(renewed,'bootstrap')).error,'unauthorized');
  } finally {await fixture.close();}
});

test('unified communication shares existing AI quota while non-AI drafts stay available', async () => {
  const f=accessFixture(), originalUrl=process.env.SUPABASE_URL, originalKey=process.env.SUPABASE_SERVICE_KEY;
  process.env.SUPABASE_URL='';process.env.SUPABASE_SERVICE_KEY='';
  f.store.rows.set('modules:Synthetic Institution',{writer:true});
  f.store.list=async(prefix)=>[...f.store.rows].filter(([key])=>key.startsWith(prefix)).map(([key,value])=>({key,value:structuredClone(value)}));
  f.store.compareSet=async(key,revision,value)=>{const current=f.store.rows.get(key);if(revision===null?!!current:current?.revision!==revision)return false;f.store.rows.set(key,structuredClone(value));return true;};
  const analysis=Object.fromEntries(['facts','interpretations','control','influence','outsideControl','responsibility','resources','barriers','agreements','openQuestions','followUp'].map(key=>[key,[]]));
  let calls=0;
  const provider={id:'synthetic',model:'synthetic-security-integration',async complete(){calls++;return {text:JSON.stringify({message:'נוסח סינתטי לבדיקה.',why:'בדיקה',next:'בדיקה',clarification:'',analysis})};}};
  const server=createPracticeServer({authStore:f.store,providerFactory:()=>provider,limits:createModelLimits({env:{MODEL_USER_RATE:'1'}})});
  try {
    server.listen(0,'127.0.0.1');await once(server,'listening');
    const post=async(path,body)=>{const response=await fetch('http://127.0.0.1:'+server.address().port+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});return {response,body:await response.json()};};
    const first=await post('/api/communication-continuity',{token:f.participant,action:'singleGenerate',requestId:randomUUID(),input:{text:'הודעה סינתטית',audience:'צוות'}});
    assert.equal(first.body.status,200,JSON.stringify(first.body));assert.equal(calls,1);
    const limited=await post('/api/complete',{system:'Synthetic test',messages:[{role:'user',content:'Synthetic input'}],_auth:{token:f.participant,page:'message-writer.html'}});
    assert.equal(limited.response.status,429);assert.equal(limited.body.code,'model_limit');assert.equal(calls,1);
    const denied=await post('/api/communication-continuity',{token:'invalid',action:'singleGenerate',requestId:randomUUID(),input:{text:'Synthetic input'}});
    assert.equal(denied.body.status,403);assert.equal(calls,1);
    const draft=await post('/api/communication-continuity',{token:f.participant,action:'create',id:randomUUID(),requestId:randomUUID(),expectedRevision:null});
    assert.equal(draft.body.status,200);assert.equal(calls,1);
  } finally {
    await new Promise(resolve=>server.close(resolve));
    if(originalUrl===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=originalUrl;
    if(originalKey===undefined)delete process.env.SUPABASE_SERVICE_KEY;else process.env.SUPABASE_SERVICE_KEY=originalKey;
  }
});
