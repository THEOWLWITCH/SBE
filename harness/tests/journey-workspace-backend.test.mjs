import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHmac } from 'node:crypto';
import { handleAccess } from '../lib/access.mjs';
import { seedOwnerPassword, SYNTHETIC_OWNER_PASSWORD } from './synthetic-access.mjs';
const W = createRequire(import.meta.url)('../../app/lib/journey-workspace-model.js');
const clone = value => value == null ? null : JSON.parse(JSON.stringify(value));
function memoryStore(seed = {}) {
  const data = new Map(Object.entries(seed));
  return { data,
    async get(k) { return clone(data.get(k)); },
    async set(k, v) { data.set(k, clone(v)); },
    async del(k) { data.delete(k); },
    async list(prefix) { return [...data].filter(([k]) => k.startsWith(prefix)).map(([key, value]) => ({ key, value: clone(value) })); },
    async compareSet(k, revision, value) {
      if (revision === null ? data.has(k) : data.get(k)?.revision !== revision) return false;
      data.set(k, clone(value)); return true;
    }
  };
}
async function fixture() {
  const store = memoryStore({ institutions: [{ name: 'School', code: '123456', active: true }],
    'modules:School': { journey: true },
    'code:TEST1234': { code: 'TEST-1234', kind: 'staff', inst: 'School', perms: ['journey'], revoked: false },
    'code:OTHR1234': { code: 'OTHR-1234', kind: 'staff', inst: 'School', perms: ['journey'], revoked: false } });
  await seedOwnerPassword(store);
  const [, sys] = await handleAccess(store, { action: 'login', kind: 'sys', secret: SYNTHETIC_OWNER_PASSWORD });
  const [, staff] = await handleAccess(store, { action: 'login', kind: 'code', secret: 'TEST-1234' });
  const [, other] = await handleAccess(store, { action: 'login', kind: 'code', secret: 'OTHR-1234' });
  const call = (action, extra = {}, token = staff.token) => handleAccess(store, { action, token, ...extra });
  const [, created] = await call('jrCreate', { mode: 'workspace', unit: 'school', unitName: 'בית ספר', research: true, demo: true });
  return { store, call, id: created.id, token: staff.token, other: other.token, admin: sys.token };
}

test('workspace creation, save and retrieval are persistent and versioned; legacy creation stays unchanged', async () => {
  const { call, id, store } = await fixture();
  const [, got] = await call('jrGet', { id });
  assert.equal(got.journey.version, 2); assert.equal(got.journey.status, 'workspace'); assert.equal(got.journey.revision, 0);
  const w = W.empty(); w.context.goal = 'לשפר למידה משותפת'; w.roles.push({ id: 'r1', title: 'צוות' });
  const [status, saved] = await call('jrSaveWorkspace', { id, revision: 0, workspace: w });
  assert.equal(status, 200); assert.equal(saved.revision, 1); assert.equal(saved.workspace.roles[0].title, 'צוות');
  const persisted = store.data.get('jr:' + id); assert.deepEqual(persisted.workspace, saved.workspace);
  assert.deepEqual(persisted.events, []); assert.equal(persisted.workspaceHistory.length, 1);
  assert.deepEqual(Object.keys(persisted.workspaceHistory[0]).sort(), ['at', 'editor', 'revision']);
  const [, mine] = await call('jrMine'); assert.equal(mine.items[0].version, 2);
  const [, legacy] = await call('jrCreate', { unitName: 'מסע ותיק' });
  assert.equal((await call('jrSaveMapping', { id: legacy.id, mapping: { hello: 'שלום' } }))[0], 200);
  assert.equal((await call('jrSaveWorkspace', { id: legacy.id, revision: 0, workspace: W.empty() }))[0], 409);
  assert.equal(store.data.get('jr:' + legacy.id).status, 'mapping');
});

test('concurrent stale saves have exactly one winner and no overwrite', async () => {
  const { call, id } = await fixture();
  const a = W.empty(), b = W.empty(); a.context.goal = 'א'; b.context.goal = 'ב';
  const results = await Promise.all([call('jrSaveWorkspace', { id, revision: 0, workspace: a }), call('jrSaveWorkspace', { id, revision: 0, workspace: b })]);
  assert.deepEqual(results.map(x => x[0]).sort(), [200, 409]);
  assert.equal(results.find(x => x[0] === 409)[1].revision, 1);
  assert.equal((await call('jrGet', { id }))[1].journey.revision, 1);
});

test('live permission and ownership protect workspace reads and writes', async () => {
  for (const reason of ['wrong-owner', 'invalid', 'revoked', 'ceiling', 'inactive', 'expired', 'token-expired', 'subscription-expired']) {
    const { store, call, id, other, token } = await fixture();
    let actor = token;
    if (reason === 'wrong-owner') actor = other;
    if (reason === 'invalid') actor = 'invalid';
    if (reason === 'revoked') store.data.get('code:TEST1234').revoked = true;
    if (reason === 'ceiling') store.data.set('modules:School', {});
    if (reason === 'inactive') store.data.get('institutions')[0].active = false;
    if (reason === 'expired') store.data.get('code:TEST1234').expiresAt = '2000-01-01';
    if (reason === 'subscription-expired') store.data.get('institutions')[0].subEnd = '2000-01-01';
    if (reason === 'token-expired') {
      const payload = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(token.split('.')[0], 'base64url')), exp: 1 })).toString('base64url');
      actor = payload + '.' + createHmac('sha256', store.data.get('token-secret').secret).update(payload).digest('base64url');
    }
    assert.equal((await call('jrGet', { id }, actor))[0], 403, reason);
    assert.equal((await call('jrSaveWorkspace', { id, revision: 0, workspace: W.empty() }, actor))[0], 403, reason);
    assert.equal(store.data.get('jr:' + id).revision, 0);
  }
});

test('schema, size and missing atomic storage fail without partial writes', async () => {
  const { store, call, id } = await fixture();
  for (const workspace of [{ roles: [{ id: 'r', evidenceIds: ['missing'] }] }, JSON.parse('{"__proto__":{}}')]) {
    assert.equal((await call('jrSaveWorkspace', { id, revision: 0, workspace }))[0], 400);
  }
  assert.equal((await call('jrSaveWorkspace', { id, revision: '0', workspace: W.empty() }))[0], 400);
  const big = W.empty(); big.roles = Array.from({ length: 80 }, (_, i) => ({ id: 'r' + i, title: 'א'.repeat(4000) }));
  assert.equal((await call('jrSaveWorkspace', { id, revision: 0, workspace: big }))[0], 413);
  assert.equal(store.data.get('jr:' + id).revision, 0);
  delete store.compareSet;
  assert.equal((await call('jrSaveWorkspace', { id, revision: 0, workspace: W.empty() }))[0], 503);
  assert.equal((await call('jrCreate', { mode: 'workspace', unitName: 'מרחב חדש' }))[0], 503);
  assert.equal((await call('jrContact', { id, email: 'test@example.org' }))[0], 503);
  assert.equal((await call('jrPost', { id, text: 'הודעה' }))[0], 503);
});

test('institution entry without an owner code cannot access journey data', async () => {
  const { store, call, id } = await fixture();
  store.data.get('institutions').push({ name: 'Other School', code: '654321', active: true });
  store.data.set('modules:Other School', { journey: true });
  for (const code of ['123456', '654321']) {
    const [, entered] = await handleAccess(store, { action: 'login', kind: 'inst-code', secret: code });
    assert.ok(entered.token);
    for (const [action, payload] of [
      ['jrCreate', { mode: 'workspace', unitName: 'מרחב מוסדי' }], ['jrMine', {}], ['jrGet', { id }],
      ['jrSaveWorkspace', { id, revision: 0, workspace: W.empty() }], ['jrDelete', { id }]
    ]) assert.equal((await call(action, payload, entered.token))[0], 403, action);
  }
  assert.equal(store.data.get('jr:' + id).revision, 0);
});

test('legacy owner codes remain scoped to their institution for reads, writes, listing and limits', async () => {
  const { store, call } = await fixture();
  store.data.get('institutions').push({ name: 'Other School', code: '654321', active: true });
  store.data.set('modules:Other School', { journey: true });
  const [, a] = await handleAccess(store, { action: 'login', kind: 'code', secret: '123456' });
  const [, b] = await handleAccess(store, { action: 'login', kind: 'code', secret: '654321' });
  const [, createdA] = await call('jrCreate', { mode: 'workspace', unitName: 'מרחב א' }, a.token);
  const [, createdB] = await call('jrCreate', { mode: 'workspace', unitName: 'מרחב ב' }, b.token);
  assert.ok(createdA.id && createdB.id);
  assert.equal((await call('jrGet', { id: createdA.id }, a.token))[0], 200);
  assert.equal((await call('jrGet', { id: createdB.id }, b.token))[0], 200);
  for (const [action, payload] of [
    ['jrGet', { id: createdA.id }], ['jrSaveWorkspace', { id: createdA.id, revision: 0, workspace: W.empty() }],
    ['jrPost', { id: createdA.id, text: 'הודעה ממסגרת אחרת' }], ['jrDelete', { id: createdA.id }]
  ]) assert.equal((await call(action, payload, b.token))[0], 403, action);
  assert.deepEqual((await call('jrMine', {}, b.token))[1].items.map(j => j.id), [createdB.id]);
  assert.equal(store.data.get('jr:' + createdA.id).revision, 0);
  for (let i = 0; i < 10; i++) store.data.set('jr:seed' + i, { id: 'seed' + i, code: 'LEGACY', inst: 'School' });
  assert.equal((await call('jrCreate', { mode: 'workspace', unitName: 'עוד מרחב ב' }, b.token))[0], 200);
});

test('revision metadata is bounded and does not contain replaced workspace content', async () => {
  const { store, call, id, admin } = await fixture();
  for (let revision = 0; revision < 23; revision++) {
    const w = W.empty(); w.context.goal = 'תוכן פרטי ' + revision;
    assert.equal((await call('jrSaveWorkspace', { id, revision, workspace: w }, admin))[0], 200);
  }
  const j = store.data.get('jr:' + id);
  assert.equal(j.workspaceHistory.length, 20); assert.equal(j.workspaceHistory[0].revision, 4);
  assert.equal(j.workspaceHistory.at(-1).editor, 'admin');
  assert.doesNotMatch(JSON.stringify(j.workspaceHistory), /תוכן פרטי/);
});

test('legacy mutators and certificate routes cannot change or certify a workspace; no research export', async () => {
  const { store, call, id, admin } = await fixture();
  for (const action of ['jrSaveMapping', 'jrSetProposal', 'jrSubmitChoices', 'jrSubmitMilestone', 'jrFinalReflection', 'jrApprove', 'jrReturn', 'jrReview', 'jrEdit']) {
    assert.equal((await call(action, { id, milestones: [{ title: 'bad' }] }, admin))[0], 409, action);
  }
  store.data.get('jr:' + id).events = [{ type: 'final', learned: 'private workspace data' }];
  store.data.get('jr:' + id).milestones = [{ title: 'bad cert', status: 'approved', cert: { code: 'secret' } }];
  assert.equal((await call('jrCert', { id, code: 'secret' }))[0], 404);
  assert.deepEqual((await call('jrExport', {}, admin))[1].rows, []);
  assert.equal(store.data.get('jr:' + id).status, 'workspace');
});

test('contact and posts use atomic latest-state patches and preserve concurrent workspace content', async () => {
  const { store, call, id } = await fixture();
  const w = W.empty(); w.context.goal = 'שומרים על הנתונים';
  const results = await Promise.all([call('jrSaveWorkspace', { id, revision: 0, workspace: w }), call('jrContact', { id, email: 'test@example.org' }), call('jrPost', { id, text: 'הודעה לצוות', kind: 'comment' })]);
  assert.equal(results[1][0], 200); assert.equal(results[2][0], 200);
  const j = store.data.get('jr:' + id);
  assert.equal(j.contact.email, 'test@example.org'); assert.equal(j.thread.length, 1);
  if (results[0][0] === 200) assert.equal(j.workspace.context.goal, w.context.goal);
  else assert.equal(results[0][0], 409);
  assert.ok(j.revision >= 2);
});

test('a post returns its committed workspace base so clients can safely acknowledge metadata revisions', async () => {
  const { store, call, id } = await fixture();
  const first = W.empty(); first.context.goal = 'הבסיס השמור';
  const [, saved] = await call('jrSaveWorkspace', { id, revision: 0, workspace: first });
  const [, posted] = await call('jrPost', { id, text: 'הודעה ראשונה' });
  assert.equal(posted.revision, 2);
  assert.deepEqual(posted.workspace, saved.workspace);
  const second = W.empty(); second.context.goal = 'בסיס שהשתנה';
  await call('jrSaveWorkspace', { id, revision: 2, workspace: second });
  const [, nextPost] = await call('jrPost', { id, text: 'הודעה שנייה' });
  assert.equal(nextPost.revision, 4);
  assert.deepEqual(nextPost.workspace, W.clean(second));
  assert.notDeepEqual(nextPost.workspace, posted.workspace);
  assert.equal(store.data.get('jr:' + id).thread.length, 2);
});
