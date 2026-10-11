import test from 'node:test';
import assert from 'node:assert/strict';
import { createPracticeServer } from '../practice-server.mjs';
import { createAtomicMemoryStore, handleAccess } from '../lib/access.mjs';

async function fixture(t, provider) {
  const store = createAtomicMemoryStore({ institutions: [{ name: 'Synthetic', code: '123456', active: true }],
    'modules:Synthetic': { writer: true, nana: true },
    'code:WRITER01': { code: 'WRITER01', kind: 'staff', inst: 'Synthetic', perms: ['writer'], revoked: false },
    'code:NANA0001': { code: 'NANA0001', kind: 'staff', inst: 'Synthetic', perms: ['writer', 'nana'], revoked: false } });
  const [, writer] = await handleAccess(store, { action: 'login', kind: 'code', secret: 'WRITER01' });
  const [, nana] = await handleAccess(store, { action: 'login', kind: 'code', secret: 'NANA0001' });
  const server = createPracticeServer({ store, providerFactory: () => provider(store) });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await server.waitForJobs(); await new Promise(resolve => server.close(resolve)); });
  const post = async (path, token, body, headers = {}) => {
    const res = await fetch(`http://127.0.0.1:${server.address().port}${path}`, { method: 'POST',
      headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}), ...headers }, body: JSON.stringify(body) });
    return { status: res.status, body: await res.json() };
  };
  return { store, server, post, writer: writer.token, nana: nana.token };
}
const prompt = { messages: [{ role: 'user', content: 'synthetic' }], maxTokens: 50, async: true };
const reply = { status: 'completed', text: 'synthetic result', usage: { outputTokens: 3 } };

test('actual HTTP boundary accepts the owned tool and refuses other, missing or mismatched tool declarations', async t => {
  const received = [];
  const f = await fixture(t, () => ({ complete: async request => { received.push(request); return reply; } }));
  for (const body of [
    prompt,
    { ...prompt, _auth: { token: f.writer, page: 'team-learning-lab.html' } },
    { ...prompt, _auth: { token: f.nana, page: 'message-writer.html' } },
    { ...prompt, _auth: { token: f.writer, page: 'message-writer.html' }, permission: 'nana' },
    { ...prompt, _auth: { token: f.writer, page: 'message-writer.html' }, permission: 'writer' }
  ]) {
    const isAllowed = body.permission === 'writer';
    assert.equal((await f.post('/api/complete', f.writer, body)).status, isAllowed ? 200 : 403);
  }
  await f.server.waitForJobs();
  assert.equal(received.length, 1);
  assert.equal((await f.post('/api/complete', f.writer, { ...prompt, permission: 'writer' }, { 'x-sbe-permission': 'nana' })).status, 403);
  assert.equal(received[0]._auth, undefined, 'credential metadata never reaches the provider');
  const jobs = await f.store.list('pj:');
  assert.equal(jobs.length, 1);
  assert.ok(!JSON.stringify(jobs).includes(f.writer), 'signed credentials never enter durable jobs');
});

test('explicit API permission and body auth use the same signed principal, without a workshop-id bypass', async t => {
  let calls = 0;
  const f = await fixture(t, () => ({ complete: async () => { calls++; return reply; } }));
  assert.equal((await f.post('/api/complete', f.writer, { ...prompt, permission: 'writer' })).status, 200);
  await f.server.waitForJobs();
  assert.equal((await f.post('/api/complete', undefined, { ...prompt, _auth: { token: f.writer, page: 'message-writer.html' } })).status, 200);
  await f.server.waitForJobs();
  assert.equal((await f.post('/api/complete', undefined, { ...prompt, _auth: { w: 'abcdefgh12', page: 'practice.html' } })).status, 403);
  assert.equal(calls, 2);
});

test('removing the requested module during completion stops result persistence and later polling', async t => {
  let finish, observed;
  const f = await fixture(t, () => ({ complete: async request => { observed = request; return new Promise(resolve => { finish = resolve; }); } }));
  const started = await f.post('/api/complete', f.nana, { ...prompt, _auth: { token: f.nana, page: 'team-learning-lab.html' } });
  assert.equal(started.status, 200);
  while (!finish) await new Promise(resolve => setImmediate(resolve));
  await f.store.set('modules:Synthetic', { writer: true, nana: false });
  try { await assert.rejects(observed.beforeAttempt(), /access ended|access denied/i); }
  finally { finish(reply); }
  await f.server.waitForJobs();
  const job = await f.store.get('pj:' + started.body.jobId);
  assert.equal(job.status, 'error');
  assert.equal(job.output, undefined);
  assert.equal((await f.post('/api/pipeline-status', f.nana, { jobId: started.body.jobId })).status, 403);
});

test('a revoked credential closes generation and polling without another provider call', async t => {
  let calls = 0;
  const f = await fixture(t, () => ({ complete: async () => { calls++; return reply; } }));
  const started = await f.post('/api/complete', f.writer, { ...prompt, permission: 'writer' });
  await f.server.waitForJobs();
  const code = await f.store.get('code:WRITER01');
  await f.store.set('code:WRITER01', { ...code, revoked: true });
  assert.equal((await f.post('/api/complete', f.writer, { ...prompt, permission: 'writer' })).status, 403);
  assert.equal((await f.post('/api/pipeline-status', f.writer, { jobId: started.body.jobId })).status, 403);
  assert.equal(calls, 1);
});

test('idempotency ignores consumed credential metadata and distinguishes the requested tool', async t => {
  let calls = 0;
  const f = await fixture(t, () => ({ complete: async () => { calls++; return reply; } }));
  const body = { ...prompt, requestId: 'scoped-tool-request', _auth: { token: f.nana, page: 'message-writer.html' } };
  const first = await f.post('/api/complete', f.nana, body);
  await f.server.waitForJobs();
  const duplicate = await f.post('/api/complete', f.nana, { ...body, _auth: { ...body._auth, w: 'ignored-metadata' } });
  assert.equal(duplicate.body.jobId, first.body.jobId);
  assert.equal((await f.post('/api/complete', f.nana, { ...body, _auth: { ...body._auth, page: 'facilitation-advisor.html' } })).status, 409);
  assert.equal(calls, 1);
});
