import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../../app/lib/ai-call.js', import.meta.url), 'utf8');
const domain = readFileSync(new URL('../../app/lib/team-learning-lab.js', import.meta.url), 'utf8');
const body = () => ({ permission: 'nana', system: 'Synthetic original system', requestId: 'original-request',
  messages: [{ role: 'user', content: 'Synthetic private request' }], maxTokens: 4000, customerReview: false });
const valid = JSON.stringify({ answer: 'Synthetic complete answer', proposedStep: null });
function deferred() {
  let resolve;
  const promise = new Promise(onResolve => { resolve = onResolve; });
  return { promise, resolve };
}
async function settle() { await new Promise(resolve => setTimeout(resolve, 0)); }

function environment({ replies = ['malformed', valid], onStatus, deferAcknowledgment } = {}) {
  const sent = [], waiters = new Map(), gates = new Map(), jobs = new Map();
  let identity = 'owner-A', attempts = 0, requestIds = 0;
  if (deferAcknowledgment) gates.set(deferAcknowledgment, deferred());
  const context = {
    window: { sbeAIHeaders: () => ({ Authorization: `Bearer ${identity}`, 'content-type': 'application/json' }) },
    crypto: { randomUUID: () => `synthetic-request-${++requestIds}` }, document: { hidden: false },
    AbortController, DOMException, Date,
    setTimeout: (callback, ms) => setTimeout(callback, ms === 3000 || ms === 8000 ? 0 : ms), clearTimeout,
    async fetch(url, init) {
      const request = { url, body: JSON.parse(init.body), signal: init.signal, headers: { ...init.headers } }; sent.push(request);
      let data;
      if (url.endsWith('/api/complete')) {
        const attempt = ++attempts; waiters.get(attempt)?.();
        data = gates.has(attempt) ? await gates.get(attempt).promise : { jobId: `synthetic-job-${attempt}` };
        if (data.jobId) jobs.set(data.jobId, attempt);
      } else if (url.endsWith('/api/pipeline-status')) {
        const attempt = jobs.get(request.body.jobId); assert.ok(attempt, 'poll must refer to its acknowledged job');
        onStatus?.({ attempt, request, setIdentity: value => { identity = value; } });
        assert.ok(attempt <= replies.length, 'repair must not submit a third attempt');
        data = { status: 'done', text: replies[attempt - 1] };
      } else if (url.endsWith('/api/pipeline-cancel')) data = { status: 'cancelled' };
      else assert.fail(`unexpected synthetic endpoint ${url}`);
      return { ok: true, status: 200, text: async () => JSON.stringify(data) };
    }
  };
  vm.runInNewContext(source, context, { filename: 'ai-call.js' });
  vm.runInNewContext(domain, context, { filename: 'team-learning-lab.js' });
  assert.equal(typeof context.window.sbeCallAIJson, 'function', 'working AI module must expose the JSON repair helper');
  return {
    call: context.window.sbeCallAIJson, TEAM: context.window.SBE_TEAM, sent,
    completions: () => sent.filter(request => request.url.endsWith('/api/complete')),
    setIdentity: value => { identity = value; }, identity: () => identity,
    waitForAttempt(attempt) { if (attempts >= attempt) return Promise.resolve(); return new Promise(resolve => waiters.set(attempt, resolve)); },
    acknowledge(attempt, data) { gates.get(attempt).resolve(data); }
  };
}
function domainCheck(e) {
  return value => {
    try { e.TEAM.parseReply(JSON.stringify(value), 'question', e.TEAM.newWorkspace().context); return true; }
    catch { return false; }
  };
}

test('malformed JSON repairs once through actual authenticated jobs without mutating the original request', async () => {
  const e = environment(), input = body(), original = JSON.stringify(input); let guards = 0;
  const result = await e.call('http://synthetic.test', input, 60000, domainCheck(e), { beforeAttempt() { guards++; } });
  assert.equal(result.answer, 'Synthetic complete answer'); assert.equal(guards, 4);
  const [first, second] = e.completions(); assert.equal(e.completions().length, 2);
  assert.equal(JSON.stringify(input), original);
  assert.equal(first.body.requestId, input.requestId); assert.notEqual(second.body.requestId, first.body.requestId);
  assert.equal(first.body.async, true); assert.equal(second.body.async, true);
  for (const request of [first, second]) {
    assert.equal(request.body.permission, input.permission); assert.deepEqual(request.body.messages, input.messages);
    assert.equal(request.body.maxTokens, input.maxTokens); assert.equal(request.body.customerReview, false);
    assert.equal(request.headers.Authorization, 'Bearer owner-A'); assert.equal(request.headers['content-type'], 'application/json');
  }
  assert.ok(second.body.system.startsWith(input.system)); assert.ok(second.body.system.length > input.system.length);
  assert.equal(e.sent.filter(request => request.url.endsWith('/api/pipeline-status')).length, 2);
});

test('valid JSON that fails full domain reply validation receives one repair', async () => {
  const e = environment({ replies: ['{"answer":5,"proposedStep":null}', valid] });
  const result = await e.call('http://synthetic.test', body(), 60000, domainCheck(e));
  assert.equal(result.answer, 'Synthetic complete answer'); assert.equal(e.completions().length, 2);
});

test('two unusable replies stop with incomplete after exactly two attempts', async () => {
  const e = environment({ replies: ['null', '{"answer":false}'] }); let guards = 0;
  await assert.rejects(e.call('http://synthetic.test', body(), 60000, domainCheck(e), { beforeAttempt() { guards++; } }), error => error.code === 'incomplete' && /חלקי|מלא|הושלם/.test(error.message));
  assert.equal(guards, 4); assert.equal(e.completions().length, 2);
  assert.equal(e.sent.filter(request => request.url.endsWith('/api/pipeline-status')).length, 2);
});

test('an already aborted helper request never reaches fetch', async () => {
  const e = environment(), controller = new AbortController(); controller.abort();
  await assert.rejects(e.call('http://synthetic.test', body(), 60000, domainCheck(e), { signal: controller.signal }), { name: 'AbortError' });
  assert.equal(e.sent.length, 0);
});

test('beforeAttempt may reject the initial request without submitting a job', async () => {
  const e = environment(); let guards = 0;
  await assert.rejects(e.call('http://synthetic.test', body(), 60000, domainCheck(e), {
    beforeAttempt() { guards++; throw new DOMException('Synthetic stale owner', 'AbortError'); }
  }), { name: 'AbortError' });
  assert.equal(guards, 1); assert.equal(e.sent.length, 0);
});

test('identity change after a malformed null reply blocks repair through beforeAttempt', async () => {
  const e = environment({ replies: ['null', valid], onStatus({ setIdentity }) { setIdentity('owner-B'); } }); let guards = 0;
  await assert.rejects(e.call('http://synthetic.test', body(), 60000, domainCheck(e), {
    beforeAttempt() { guards++; if (e.identity() !== 'owner-A') throw new DOMException('Synthetic identity changed', 'AbortError'); }
  }), { name: 'AbortError' });
  assert.equal(guards, 2); assert.equal(e.completions().length, 1);
  assert.equal(e.completions()[0].headers.Authorization, 'Bearer owner-A');
});

test('abort after malformed output prevents a repair job even when fetch ignores abort', async () => {
  const controller = new AbortController();
  const e = environment({ replies: ['malformed', valid], onStatus() { controller.abort(); } });
  await assert.rejects(e.call('http://synthetic.test', body(), 60000, domainCheck(e), { signal: controller.signal }), { name: 'AbortError' });
  assert.equal(e.completions().length, 1);
});

test('cancelling a repair before acknowledgment cancels its late accepted job with submitting credentials', async () => {
  const e = environment({ deferAcknowledgment: 2 }), controller = new AbortController();
  const pending = e.call('http://synthetic.test', body(), 60000, domainCheck(e), { signal: controller.signal });
  await e.waitForAttempt(2); e.setIdentity('owner-B'); controller.abort();
  const rejection = assert.rejects(pending, { name: 'AbortError' });
  e.acknowledge(2, { jobId: 'repair-accepted-after-cancel' }); await rejection; await settle();
  assert.equal(e.completions().length, 2);
  assert.equal(e.completions()[1].signal.aborted, false, 'bounded acknowledgment remains readable for cancellation');
  const cancelled = e.sent.filter(request => request.url.endsWith('/api/pipeline-cancel'));
  assert.equal(cancelled.length, 1); assert.equal(cancelled[0].body.jobId, 'repair-accepted-after-cancel');
  assert.equal(cancelled[0].headers.Authorization, 'Bearer owner-A');
  assert.equal(e.sent.filter(request => request.url.endsWith('/api/pipeline-status')).length, 1, 'cancelled repair is never polled');
});

test('a validator cancellation propagates without being mistaken for incomplete data', async () => {
  const e = environment({ replies: [valid, valid] });
  await assert.rejects(e.call('http://synthetic.test', body(), 60000, () => { throw new DOMException('Synthetic stale validation', 'AbortError'); }), { name: 'AbortError' });
  assert.equal(e.completions().length, 1);
});
