import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { handleAccess } from '../lib/access.mjs';
import { handleResearch } from '../lib/research.mjs';
import { syntheticOwnerRecord } from './synthetic-access.mjs';

const require = createRequire(import.meta.url);
const I = require('../../app/lib/research-intake-core.js');
const secret = 'synthetic-intake-secret';
const institution = 'Synthetic School';
function fixture() {
  const password = syntheticOwnerRecord();
  const rows = new Map(Object.entries({ 'token-secret': { secret }, 'pw-sys': password,
    institutions: [{ name: institution, active: true }, { name: 'Inactive School', active: false }],
    'modules:Synthetic School': { writer: true },
    'code:PERSON1': { code: 'PERS-ON1', kind: 'staff', inst: institution, label: 'Synthetic Person', perms: [] },
    'code:ADMIN1': { code: 'ADMI-N1', kind: 'instadmin', inst: institution, label: 'Synthetic Admin', perms: [] }
  }));
  const writes = [];
  const access = { rows, writes, async get(k) { return rows.get(k) ?? null; }, async set(k, v) { writes.push(k); rows.set(k, v); },
    async list(prefix) { return [...rows].filter(([k]) => k.startsWith(prefix)).map(([key, value]) => ({ key, value })); },
    async compareSet(k, expected, value) { if (expected === null ? rows.has(k) : rows.get(k)?.revision !== expected) return false; writes.push(k); rows.set(k, value); return true; } };
  const token = payload => { const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 3600000 })).toString('base64url'); return body + '.' + createHmac('sha256', secret).update(body).digest('base64url'); };
  const owner = token({ k: 'sys', authVersion: require('node:crypto').createHash('sha256').update(password.salt + ':' + password.hash).digest('hex') });
  const person = token({ k: 'code', c: 'PERSON1', kind: 'staff', inst: institution });
  const admin = token({ k: 'code', c: 'ADMIN1', kind: 'instadmin', inst: institution });
  const calls = [];
  const store = { async rpc(token, action, payload) { calls.push({ token, action, payload }); return action === 'intakeOwnerBootstrap' ? { termsState: { revision: 0, draftVersion: { ...I.DEFAULT_TERMS_DRAFT } }, secret: 'private' } : action === 'intakePublicInfo' ? { terms: null, acceptingApplications: false, private: 'hidden' } : { receipt: { id: randomUUID(), status: 'submitted', submittedAt: '2026-10-20T00:00:00Z' }, private: 'hidden' }; } };
  return { access, owner, person, admin, calls, store };
}
const submission = () => ({ action: 'intakeSubmit', requestId: randomUUID(), termsVersionId: randomUUID(), termsHash: 'a'.repeat(64), acknowledged: true,
  application: { title: 'Synthetic request', applicationType: 'partnership', fullName: 'Synthetic Applicant', email: 'synthetic@example.invalid', objectives: 'Synthetic research', requestedTools: ['writer'], applicantType: 'individual' } });

test('public intake accepts only its two typed actions and creates a private address bucket after validation', async () => {
  const { handleIntake, isPublicIntakeAction, isIntakeAction } = await import('../lib/research-intake.mjs');
  const f = fixture();
  assert.equal(isPublicIntakeAction('intakeSubmit'), true); assert.equal(isPublicIntakeAction('intakeReview'), false); assert.equal(isIntakeAction('intakeReview'), true);
  assert.deepEqual(await handleIntake(f.access, f.store, { action: 'intakePublicInfo' }), [200, { terms: null, acceptingApplications: false }]);
  const valid = submission();
  assert.equal((await handleIntake(f.access, f.store, valid, { clientAddress: 'synthetic-address' }))[0], 200);
  const sent = f.calls.at(-1); assert.equal(sent.token, ''); assert.equal(sent.action, 'intakeSubmit'); assert.match(sent.payload.rateBucket, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(sent.payload).includes('synthetic-address'), false); assert.equal(valid.rateBucket, undefined);
  const bucket = sent.payload.rateBucket;
  await handleIntake(f.access, f.store, valid, { clientAddress: 'synthetic-address' }); assert.equal(f.calls.at(-1).payload.rateBucket, bucket);
  await handleIntake(f.access, f.store, valid); assert.match(f.calls.at(-1).payload.rateBucket, /^[a-f0-9]{64}$/); assert.notEqual(f.calls.at(-1).payload.rateBucket, bucket);
  const before = f.calls.length;
  for (const body of [{ ...valid, token: f.owner }, { ...valid, owner: true }, { ...valid, rateBucket: 'b'.repeat(64) }, { ...valid, application: { ...valid.application, owner: true } }, { action: 'intakeReview' }, { action: 'unknown' }]) assert.equal((await handleIntake(f.access, f.store, body))[0], 400);
  assert.equal(f.calls.length, before); assert.deepEqual(f.access.writes, []);
  f.access.rows.delete('token-secret'); assert.equal((await handleIntake(f.access, f.store, valid))[1].code, 'not_configured');
});

test('private intake management rechecks the actual owner and public actions never enter private research', async () => {
  const f = fixture();
  for (const action of I.PUBLIC_ACTIONS) assert.equal((await handleResearch(f.access, f.store, { action }))[0], 400);
  for (const token of ['', f.person, f.admin]) assert.equal((await handleResearch(f.access, f.store, { action: 'intakeOwnerBootstrap', token }))[0], 403);
  const [status, out] = await handleResearch(f.access, f.store, { action: 'intakeOwnerBootstrap', token: f.owner });
  assert.equal(status, 200); assert.equal(out.secret, undefined); assert.deepEqual(out.institutions, [institution]); assert.deepEqual(out.identities.map(x => x.code), ['PERSON1', 'ADMIN1']);
  assert.deepEqual(out.identities[0], { code: 'PERSON1', label: 'Synthetic Person', institution });
  f.access.rows.get('code:PERSON1').revoked = true; f.access.rows.get('code:ADMIN1').expiresAt = '2000-01-01';
  assert.deepEqual((await handleResearch(f.access, f.store, { action: 'intakeOwnerBootstrap', token: f.owner }))[1].identities, []);
  f.access.rows.set('pw-sys', { salt: 'changed', hash: 'changed' });
  const before = f.calls.length; assert.equal((await handleResearch(f.access, f.store, { action: 'intakeOwnerBootstrap', token: f.owner }))[0], 403); assert.equal(f.calls.length, before);
});

test('research identity creation uses ordinary staff login with no tools and atomically replays the same request', async () => {
  const f = fixture(), input = { action: 'intakeIdentityCreate', token: f.owner, requestId: randomUUID(), institution, label: 'Synthetic Researcher' };
  const created = await Promise.all([handleResearch(f.access, f.store, input), handleResearch(f.access, f.store, input)]);
  const [status, out] = created[0]; assert.equal(status, 200); assert.deepEqual(created[1], created[0]); assert.equal(out.identity.researchOnly, true); assert.equal(out.identity.institution, institution);
  const rec = f.access.rows.get('code:' + out.identity.code); assert.equal(rec.kind, 'staff'); assert.deepEqual(rec.perms, []);
  const [loginStatus, login] = await handleAccess(f.access, { action: 'login', kind: 'code', secret: out.identity.code }); assert.equal(loginStatus, 200); assert.deepEqual(login.perms, []);
  const same = await Promise.all([handleResearch(f.access, f.store, input), handleResearch(f.access, f.store, input)]); assert.deepEqual(same, [[200, out], [200, out]]);
  assert.equal(f.access.writes.filter(k => k.startsWith('code:')).length, 1); assert.equal(f.calls.length, 0);
  assert.equal((await handleResearch(f.access, f.store, { ...input, label: 'Different' }))[0], 409);
  assert.equal((await handleResearch(f.access, f.store, { ...input, token: f.admin }))[0], 403);
  rec.revoked = true; assert.equal((await handleResearch(f.access, f.store, input))[0], 409); assert.equal(rec.revoked, true);
  rec.revoked = false; rec.expiresAt = '2000-01-01'; assert.equal((await handleResearch(f.access, f.store, input))[0], 409); assert.equal(rec.expiresAt, '2000-01-01');
  rec.expiresAt = null; f.access.rows.get('institutions')[0].active = false; assert.equal((await handleResearch(f.access, f.store, input))[0], 403);
  f.access.rows.get('institutions')[0].active = true; f.access.rows.set('pw-sys', { salt: 'changed', hash: 'changed' }); assert.equal((await handleResearch(f.access, f.store, input))[0], 403);
  assert.equal(f.access.writes.filter(k => k.startsWith('code:')).length, 1);
});

test('researchOnly codeCreate is strictly owner staff with empty permissions while ordinary permissions stay required', async () => {
  const f = fixture(), input = { action: 'codeCreate', token: f.owner, kind: 'staff', inst: institution, label: 'Synthetic', perms: [], researchOnly: true, requestId: randomUUID() };
  assert.equal((await handleAccess(f.access, input))[0], 200);
  for (const change of [{ kind: 'instadmin' }, { perms: ['writer'] }, { kind: 'course' }, { token: f.admin }, { researchOnly: 'true' }]) assert.notEqual((await handleAccess(f.access, { ...input, ...change }))[0], 200);
  assert.equal((await handleAccess(f.access, { ...input, researchOnly: undefined }))[0], 400);
  const ordinary = await handleAccess(f.access, { ...input, researchOnly: undefined, perms: ['writer'] }); assert.equal(ordinary[0], 200); assert.equal(Object.hasOwn(ordinary[1].code, 'researchOnly'), false);
  assert.equal(JSON.stringify((await handleAccess(f.access, { action: 'codesList', token: f.owner }))[1]).includes('researchRequest'), false);
});

test('intake errors use fixed safe codes without personal or provider exception detail', async () => {
  const { handleIntake } = await import('../lib/research-intake.mjs'); const f = fixture();
  for (const [error, status, code] of [[Object.assign(new Error('synthetic@example.invalid'), { code: 'rate_limited' }), 429, 'rate_limited'], [new Error('private SQL credential'), 503, 'unavailable']]) {
    const result = await handleIntake(f.access, { async rpc() { throw error; } }, submission()); assert.equal(result[0], status); assert.equal(result[1].code, code); assert.doesNotMatch(JSON.stringify(result), /synthetic@example|SQL credential/);
  }
});

test('private browser client supports intake owner operations and still rejects anonymous/public calls', async () => {
  const client = require('../../app/lib/research-client.js'), requests = [];
  const options = { getToken: () => 'owner-token', uuid: () => '11111111-1111-4111-8111-111111111111', fetchImpl: async (url, init) => { requests.push({ url, body: JSON.parse(init.body) }); return { ok: true, status: 200, async json() { return {}; } }; } };
  const owner = client.create(options); await owner.call('intakeOwnerBootstrap'); await owner.call('intakeTermsSave', { title: 'Synthetic', text: 'Synthetic', expectedRevision: 0 });
  assert.equal(requests[0].body.requestId, undefined); assert.equal(requests[1].body.requestId, options.uuid()); assert.equal(requests[1].body.token, 'owner-token');
  for (const action of I.PUBLIC_ACTIONS) await assert.rejects(owner.call(action), error => error.code === 'invalid');
  await assert.rejects(client.create({ ...options, getToken: () => '' }).call('intakeOwnerBootstrap'), error => error.code === 'unauthorized');
});
