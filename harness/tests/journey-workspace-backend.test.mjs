import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHmac } from 'node:crypto';
import { handleAccess } from '../lib/access.mjs';
import { seedOwnerPassword, SYNTHETIC_OWNER_PASSWORD } from './synthetic-access.mjs';
import { workspaceFixture, reportFixture } from '../fixtures/journey-analysis.mjs';
const W = createRequire(import.meta.url)('../../app/lib/journey-workspace-model.js');
const A = createRequire(import.meta.url)('../../app/lib/journey-analysis-model.js');
const N = createRequire(import.meta.url)('../../app/lib/journey-network-model.js');
const clone = value => value == null ? null : JSON.parse(JSON.stringify(value));
function analysis(workspace, { id = 'a1', sourceRevision = 0, baselineId = '', unit = 'school', large = false } = {}) {
  const output = reportFixture();
  if (large) {
    const long = 'א'.repeat(4000);
    output.summary.overview = long; output.summary.limits = long;
    for (const field of ['title', 'observation', 'interpretation', 'uncertainty', 'presentImplication', 'futureImplication']) output.findings[0][field] = long;
    output.findings[0].alternativeExplanations = [long, long, long];
  }
  return A.cleanAnalysis({ id, createdAt: '2026-10-26T12:00:00.000Z', sourceRevision, baselineId,
    input: A.buildInput(workspace, { kind: unit, label: unit === 'school' ? 'בית ספר' : 'קהילה' }, ['e1']), output, responses: [] });
}
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

test('scenario alternatives and futures persist through the same authorized revision contract', async () => {
  const {call,id,other}=await fixture();
  const w=W.clean(workspaceFixture());
  w.context.autonomy='בחירה בגבולות המנדט';
  w.mechanisms[0].autonomyContribution='החלטה משותפת על דרכי הפעולה';
  const a=N.createAlternative(w,'scenario1',0,'2026-10-27T10:00:00.000Z');
  a.title='חלופה לבדיקה'; a.proposal.mechanisms.push({id:'hypothetical',title:'מנגנון מוצע ללא ראיות'});
  w.lab={futures:[{id:'future1',title:'פחות זמן',conditions:'צמצום הזמן המשותף'}],alternatives:[a]};
  const [status,saved]=await call('jrSaveWorkspace',{id,revision:0,workspace:w});
  assert.equal(status,200);
  assert.equal(saved.workspace.mechanisms.some(m=>m.id==='hypothetical'),false);
  assert.equal(saved.workspace.lab.alternatives[0].proposal.mechanisms.at(-1).id,'hypothetical');
  assert.equal(saved.workspace.context.autonomy,'בחירה בגבולות המנדט');
  assert.equal(saved.workspace.lab.alternatives[0].baseline.mechanisms[0].autonomyContribution,'החלטה משותפת על דרכי הפעולה');
  assert.equal((await call('jrSaveWorkspace',{id,revision:0,workspace:w}))[0],409);
  assert.equal((await call('jrGet',{id},other))[0],403);
  const [,loaded]=await call('jrGet',{id});
  assert.deepEqual(loaded.journey.workspace.lab,saved.workspace.lab);
  const invalid=clone(saved.workspace); invalid.lab.alternatives[0].proposal.mechanisms[0].infrastructureIds=['missing'];
  assert.equal((await call('jrSaveWorkspace',{id,revision:1,workspace:invalid}))[0],400);
  const input=A.buildInput(saved.workspace,{kind:'school',label:'מסגרת'},['e1']);
  assert.equal('lab' in input,false);
  assert.equal(input.mechanisms.some(m=>m.id==='hypothetical'),false);
});

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
  const original = W.clean(workspaceFixture()); original.analyses = [analysis(original)];
  assert.equal((await call('jrSaveWorkspace', { id, revision: 0, workspace: original }))[0], 200);
  const a = clone(original), b = clone(original); a.context.goal = 'א'; b.context.goal = 'ב';
  a.analyses[0].responses = [{ findingId: 'f1', state: 'accepted', comment: 'א' }];
  b.analyses[0].responses = [{ findingId: 'f1', state: 'rejected', comment: 'ב' }];
  const results = await Promise.all([call('jrSaveWorkspace', { id, revision: 1, workspace: a }), call('jrSaveWorkspace', { id, revision: 1, workspace: b })]);
  assert.deepEqual(results.map(x => x[0]).sort(), [200, 409]);
  assert.equal(results.find(x => x[0] === 409)[1].revision, 2);
  const j = (await call('jrGet', { id }))[1].journey;
  assert.equal(j.revision, 2);
  assert.deepEqual(j.workspace, results.find(x => x[0] === 200)[1].workspace);
  assert.deepEqual(j.workspace.analyses[0].input, original.analyses[0].input);
});

test('live permission and ownership protect workspace reads and writes', async () => {
  for (const reason of ['wrong-owner', 'invalid', 'revoked', 'ceiling', 'inactive', 'expired', 'token-expired', 'subscription-expired']) {
    const { store, call, id, other, token } = await fixture();
    const w = W.clean(workspaceFixture()); w.analyses = [analysis(w)];
    assert.equal((await call('jrSaveWorkspace', { id, revision: 0, workspace: w }))[0], 200);
    const before = clone(store.data.get('jr:' + id));
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
    assert.equal((await call('jrSaveWorkspace', { id, revision: 1, workspace: W.empty(), removedAnalysisIds: ['a1'] }, actor))[0], 403, reason);
    assert.equal((await call('jrDelete', { id }, actor))[0], 403, reason);
    assert.deepEqual(store.data.get('jr:' + id), before, reason);
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
  const w = W.clean(workspaceFixture()); w.analyses = [analysis(w)];
  assert.equal((await call('jrSaveWorkspace', { id: createdA.id, revision: 0, workspace: w }, a.token))[0], 200);
  const before = clone(store.data.get('jr:' + createdA.id));
  assert.equal((await call('jrGet', { id: createdA.id }, a.token))[0], 200);
  assert.equal((await call('jrGet', { id: createdB.id }, b.token))[0], 200);
  for (const [action, payload] of [
    ['jrGet', { id: createdA.id }], ['jrSaveWorkspace', { id: createdA.id, revision: 1, workspace: W.empty(), removedAnalysisIds: ['a1'] }],
    ['jrPost', { id: createdA.id, text: 'הודעה ממסגרת אחרת' }], ['jrDelete', { id: createdA.id }]
  ]) assert.equal((await call(action, payload, b.token))[0], 403, action);
  assert.deepEqual((await call('jrMine', {}, b.token))[1].items.map(j => j.id), [createdB.id]);
  assert.deepEqual(store.data.get('jr:' + createdA.id), before);
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
  const w = W.clean(workspaceFixture()); w.analyses = [analysis(w)];
  assert.equal((await call('jrSaveWorkspace', { id, revision: 0, workspace: w }))[0], 200);
  w.context.goal = 'שומרים על הנתונים';
  const results = await Promise.all([call('jrSaveWorkspace', { id, revision: 1, workspace: w }), call('jrContact', { id, email: 'test@example.org' }), call('jrPost', { id, text: 'הודעה לצוות', kind: 'comment' })]);
  assert.equal(results[1][0], 200); assert.equal(results[2][0], 200);
  const j = store.data.get('jr:' + id);
  assert.equal(j.contact.email, 'test@example.org'); assert.equal(j.thread.length, 1);
  if (results[0][0] === 200) assert.equal(j.workspace.context.goal, w.context.goal);
  else assert.equal(results[0][0], 409);
  assert.deepEqual(j.workspace.analyses, w.analyses);
  assert.ok(j.revision >= 3);
});

test('a post returns its committed workspace base so clients can safely acknowledge metadata revisions', async () => {
  const { store, call, id } = await fixture();
  const first = W.clean(workspaceFixture()); first.context.goal = 'הבסיס השמור'; first.analyses = [analysis(first)];
  const [, saved] = await call('jrSaveWorkspace', { id, revision: 0, workspace: first });
  const [, posted] = await call('jrPost', { id, text: 'הודעה ראשונה' });
  assert.equal(posted.revision, 2);
  assert.deepEqual(posted.workspace, saved.workspace);
  const second = clone(first); second.context.goal = 'בסיס שהשתנה';
  await call('jrSaveWorkspace', { id, revision: 2, workspace: second });
  const [, nextPost] = await call('jrPost', { id, text: 'הודעה שנייה' });
  assert.equal(nextPost.revision, 4);
  assert.deepEqual(nextPost.workspace, W.clean(second));
  assert.notDeepEqual(nextPost.workspace, posted.workspace);
  assert.equal(store.data.get('jr:' + id).thread.length, 2);
});

test('analysis retrieval preserves reviewed facts exactly and allows later human responses in either setting', async () => {
  for (const unit of ['school', 'community']) {
    const { store, call, id } = await fixture();
    const w = W.clean(workspaceFixture(unit)); w.analyses = [analysis(w, { unit })];
    const original = clone(w.analyses[0]);
    const [status, saved] = await call('jrSaveWorkspace', { id, revision: 0, workspace: w });
    assert.equal(status, 200, unit);
    assert.deepEqual(saved.workspace.analyses, [original]);
    assert.deepEqual((await call('jrGet', { id }))[1].journey.workspace.analyses, [original]);
    w.analyses[0].responses = [{ findingId: 'f1', state: 'edited', comment: 'ייתכן שיש גיבוי שלא תועד', priorityReason: 'בירור עם קולות חסרים', disagreement: 'אין עדיין הסכמה', reviewedBy: 'צוות בדוי', reviewedAt: '2026-10-26T13:00:00.000Z' }];
    const [, updated] = await call('jrSaveWorkspace', { id, revision: 1, workspace: w });
    assert.equal(updated.revision, 2);
    assert.deepEqual(updated.workspace.analyses[0], { ...original, responses: w.analyses[0].responses });
    assert.deepEqual(store.data.get('jr:' + id).workspace.analyses, updated.workspace.analyses);
  }
});

test('retained analysis facts cannot change and every invalid evolution fails without a write', async () => {
  const { store, call, id } = await fixture();
  const w = W.clean(workspaceFixture()); w.analyses = [analysis(w)];
  assert.equal((await call('jrSaveWorkspace', { id, revision: 0, workspace: w }))[0], 200);
  const before = clone(store.data.get('jr:' + id));
  const mutations = [
    a => a.id = 'changed', a => a.createdAt = '2026-10-26T13:00:00.000Z', a => a.sourceRevision = 1,
    a => a.baselineId = 'other', a => a.input.context.baseline = 'תיאור מוחלף',
    a => a.output.findings[0].interpretation = 'פירוש מוחלף'
  ];
  for (const mutate of mutations) {
    const changed = clone(w); mutate(changed.analyses[0]);
    const [status] = await call('jrSaveWorkspace', { id, revision: 1, workspace: changed });
    assert.equal(status, 400);
    assert.deepEqual(store.data.get('jr:' + id), before);
  }
  const removed = clone(w); removed.analyses = [];
  for (const declaration of [{}, { removedAnalysisIds: [] }, { removedAnalysisIds: ['unknown'] }, { removedAnalysisIds: ['a1', 'unknown'] }, { removedAnalysisIds: ['a1', 'a1'] }]) {
    assert.equal((await call('jrSaveWorkspace', { id, revision: 1, workspace: removed, ...declaration }))[0], 400);
    assert.deepEqual(store.data.get('jr:' + id), before);
  }
  for (const removedAnalysisIds of [null, false, 'a1', {}, ['a1'], ['unknown']]) {
    assert.equal((await call('jrSaveWorkspace', { id, revision: 1, workspace: w, removedAnalysisIds }))[0], 400);
    assert.deepEqual(store.data.get('jr:' + id), before);
  }
});

test('explicit selected-report deletion permits dangling baseline and later analyses; whole deletion removes history', async () => {
  const { store, call, id } = await fixture();
  const w = W.clean(workspaceFixture());
  w.analyses = [analysis(w), analysis(w, { id: 'a2', baselineId: 'a1' })];
  assert.equal((await call('jrSaveWorkspace', { id, revision: 0, workspace: w }))[0], 200);
  w.analyses.shift();
  const [status, removed] = await call('jrSaveWorkspace', { id, revision: 1, workspace: w, removedAnalysisIds: ['a1'] });
  assert.equal(status, 200); assert.equal(removed.revision, 2);
  assert.equal(removed.workspace.analyses[0].baselineId, 'a1');
  w.analyses.push(analysis(w, { id: 'a3', sourceRevision: 2, baselineId: 'a2' }));
  assert.equal((await call('jrSaveWorkspace', { id, revision: 2, workspace: w }))[0], 200);
  assert.deepEqual((await call('jrGet', { id }))[1].journey.workspace.analyses, w.analyses);
  assert.equal((await call('jrDelete', { id }))[0], 200);
  assert.equal(store.data.has('jr:' + id), false);
  assert.equal((await call('jrGet', { id }))[0], 404);
});

test('current mapping removal never invalidates or rewrites historical snapshot references', async () => {
  const { store, call, id } = await fixture();
  const w = W.clean(workspaceFixture()); w.analyses = [analysis(w)];
  const historical = clone(w.analyses);
  assert.equal((await call('jrSaveWorkspace', { id, revision: 0, workspace: w }))[0], 200);
  const changed = W.empty(); changed.analyses = clone(historical); changed.context.periodStart = '2026-11-01';
  assert.equal((await call('jrSaveWorkspace', { id, revision: 1, workspace: changed }))[0], 200);
  const j = store.data.get('jr:' + id);
  assert.deepEqual(j.workspace.analyses, historical);
  assert.equal(j.workspace.mechanisms.length, 0);
  assert.equal(j.workspace.analyses[0].input.mechanisms[0].id, 'm1');
  assert.equal(j.workspace.analyses[0].output.findings[0].entityRefs[0].id, 'l1');
});

test('new snapshots accept an older saved source revision but reject a future one atomically', async () => {
  const { store, call, id } = await fixture();
  const w = W.clean(workspaceFixture());
  assert.equal((await call('jrPost', { id, text: 'הודעה ששינתה רק מטא נתונים' }))[0], 200);
  w.analyses = [analysis(w)];
  assert.equal((await call('jrSaveWorkspace', { id, revision: 1, workspace: w }))[0], 200);
  const before = clone(store.data.get('jr:' + id));
  w.analyses.push(analysis(w, { id: 'a2', sourceRevision: 3 }));
  assert.equal((await call('jrSaveWorkspace', { id, revision: 2, workspace: w }))[0], 400);
  assert.deepEqual(store.data.get('jr:' + id), before);
});

test('analysis history has its own whole-record budget without weakening base budget or silently truncating', async () => {
  const { store, call, id } = await fixture();
  const w = W.clean(workspaceFixture());
  w.analyses = Array.from({ length: 6 }, (_, n) => analysis(w, { id: 'a' + n, large: true }));
  assert.ok(Buffer.byteLength(JSON.stringify(w)) > 400000);
  assert.ok(Buffer.byteLength(JSON.stringify(w)) < 1800000);
  const [status] = await call('jrSaveWorkspace', { id, revision: 0, workspace: w });
  assert.equal(status, 200);
  const before = clone(store.data.get('jr:' + id));
  const largeBase = clone(w); largeBase.roles = Array.from({ length: 80 }, (_, n) => ({ id: 'role' + n, title: 'א'.repeat(4000) }));
  largeBase.mechanisms.forEach(m => m.roleIds = []);
  assert.equal((await call('jrSaveWorkspace', { id, revision: 1, workspace: largeBase }))[0], 413);
  assert.deepEqual(store.data.get('jr:' + id), before);
  const tooMany = clone(w); tooMany.analyses = Array.from({ length: 21 }, (_, n) => analysis(w, { id: 'a' + n }));
  assert.equal((await call('jrSaveWorkspace', { id, revision: 1, workspace: tooMany }))[0], 400);
  assert.deepEqual(store.data.get('jr:' + id), before);
  const tooLarge = clone(w); tooLarge.analyses = Array.from({ length: 20 }, (_, n) => analysis(w, { id: 'a' + n, large: true }));
  assert.ok(Buffer.byteLength(JSON.stringify(tooLarge)) > 1800000);
  assert.equal((await call('jrSaveWorkspace', { id, revision: 1, workspace: tooLarge }))[0], 413);
  assert.deepEqual(store.data.get('jr:' + id), before);
  assert.equal((await call('jrPost', { id, text: 'תוספת אחרי שמירת דוחות' }))[0], 200);
  assert.equal((await call('jrContact', { id, email: 'test@example.org' }))[0], 200);
  assert.deepEqual(store.data.get('jr:' + id).workspace.analyses, w.analyses);
});

test('metadata commits enforce both budgets and preserve exact stored analyses on any rejection', async () => {
  const { store, call, id } = await fixture();
  const w = W.clean(workspaceFixture()); w.analyses = [analysis(w)];
  assert.equal((await call('jrSaveWorkspace', { id, revision: 0, workspace: w }))[0], 200);
  for (const budget of ['base', 'whole']) {
    const j = clone(store.data.get('jr:' + id));
    if (budget === 'base') j.thread = [{ text: 'א'.repeat(200001) }];
    else {
      j.thread = [];
      j.workspace.analyses = Array.from({ length: 20 }, (_, n) => analysis(w, { id: 'a' + n, large: true }));
    }
    store.data.set('jr:' + id, j);
    const before = clone(j);
    for (const [action, extra] of [['jrPost', { text: 'לא לשכתב דוחות' }], ['jrContact', { email: 'test@example.org' }]]) {
      assert.equal((await call(action, { id, ...extra }))[0], 413, budget + ' ' + action);
      assert.deepEqual(store.data.get('jr:' + id), before);
    }
  }
});
