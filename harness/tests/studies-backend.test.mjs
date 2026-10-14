import { seedOwnerPassword, SYNTHETIC_OWNER_PASSWORD, syntheticOwnerRecord } from './synthetic-access.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { handleAccess, supabaseStore } from '../lib/access.mjs';
import { handleStudies, supabaseStudyFiles } from '../lib/studies.mjs';

const clone = value => value == null ? null : JSON.parse(JSON.stringify(value));
function memoryStore(seed = {}) {
  const data = new Map(Object.entries(seed));
  return { data, failSave: false,
    async get(k) { return clone(data.get(k)); },
    async set(k, value) { if (this.failSave && k === 'studies:library') throw Error('save failed'); data.set(k, clone(value)); },
    async del(k) { data.delete(k); },
    async list(prefix) { return [...data].filter(([k]) => k.startsWith(prefix)).map(([key, value]) => ({ key, value: clone(value) })); } };
}
function memoryFiles() {
  return { data: new Map(), reads: 0, failUpload: false,
    async put(path, bytes, mime) { if (this.failUpload) throw Error('upload failed'); this.data.set(path, { bytes: Buffer.from(bytes), mime }); },
    async get(path) { this.reads++; const value = this.data.get(path); if (!value) throw Error('missing file'); return Buffer.from(value.bytes); },
    async del(path) { this.data.delete(path); } };
}
async function fixture(perms = ['studies']) {
  const store = memoryStore({ institutions: [{ name: 'Test school', code: '123456', active: true }],
    'modules:Test school': Object.fromEntries(perms.map(p => [p, true])),
    'code:TEST1234': { code: 'TEST-1234', kind: 'staff', inst: 'Test school', perms, revoked: false } });
  await seedOwnerPassword(store);
  const [, admin] = await handleAccess(store, { action: 'login', kind: 'sys', secret: SYNTHETIC_OWNER_PASSWORD });
  const [, reader] = await handleAccess(store, { action: 'login', kind: 'code', secret: 'TEST-1234' });
  const files = memoryFiles();
  const call = (action, extra = {}, token = admin.token) => handleStudies(store, { action, token, ...extra }, { files });
  return { store, files, call, token: admin.token, reader: reader.token };
}
const item = fields => ({ title: 'מפגש לקבוצה', description: 'חומרי המפגש', date: '2026-10-12', groupId: '', url: 'https://example.org/materials', previews: [], ...fields });
const attachment = (name = 'שקופיות.pdf', text = 'synthetic PDF') => ({ name, mime: 'application/pdf', data: Buffer.from(text).toString('base64') });
const preview = 'data:image/png;base64,iVBORw0KGgo=';

test('admin creates, renames, moves, edits and deletes materials and groups; list is newest first', async () => {
  const { call, reader } = await fixture();
  assert.deepEqual(await call('list', {}, reader), [200, { groups: [], items: [] }]);
  const [created, groupOut] = await call('groupSave', { group: { title: 'לומדים יחד' } });
  assert.equal(created, 200);
  const group = groupOut.group;
  const [, first] = await call('save', { item: item({ groupId: group.id, date: '2026-10-01', previews: [preview] }) });
  const [, second] = await call('save', { item: item({ title: 'חומר נוסף', date: '2026-10-12' }) });
  const [, listed] = await call('list', {}, reader);
  assert.deepEqual(listed.items.map(x => x.id), [second.item.id, first.item.id]);
  assert.deepEqual(listed.items[1].previews, [preview]);
  assert.equal(listed.items[1].file, null);
  assert.equal((await call('groupDelete', { id: group.id }))[0], 409, 'a nonempty group remains');
  const [, renamed] = await call('groupSave', { group: { id: group.id, title: 'קבוצה חדשה' } });
  assert.equal(renamed.group.title, 'קבוצה חדשה');
  const [, moved] = await call('save', { item: { ...first.item, title: 'חומר מעודכן', groupId: '', date: '2026-10-11' } });
  assert.equal(moved.item.groupId, '');
  assert.equal(moved.item.title, 'חומר מעודכן');
  assert.deepEqual(await call('groupDelete', { id: group.id }), [200, { ok: true }]);
  assert.deepEqual(await call('delete', { id: first.item.id }), [200, { ok: true }]);
  assert.deepEqual(await call('delete', { id: second.item.id }), [200, { ok: true }]);
  assert.deepEqual(await call('list', {}, reader), [200, { groups: [], items: [] }]);
});

test('private files open only after live permission checks and never expose object keys', async () => {
  const { call, files, reader } = await fixture();
  const [status, saved] = await call('save', { item: item({ url: '' }), file: attachment() });
  assert.equal(status, 200);
  assert.deepEqual(saved.item.file, { name: 'שקופיות.pdf', mime: 'application/pdf', size: 13 });
  assert.ok(!JSON.stringify(saved).includes('path'));
  const [open, binary] = await call('file', { id: saved.item.id }, reader);
  assert.equal(open, 200);
  assert.equal(binary.bytes.toString(), 'synthetic PDF');
  assert.equal(binary.mime, 'application/pdf');
  assert.equal(binary.name, 'שקופיות.pdf');
  assert.ok(!('path' in binary));
  const [, list] = await call('list', {}, reader);
  assert.deepEqual(list.items[0].file, saved.item.file);
  assert.equal((await call('file', { id: saved.item.id }, 'invalid'))[0], 403);
  assert.equal(files.reads, 1, 'denial happens before object access');
  await call('delete', { id: saved.item.id });
  assert.equal(files.data.size, 0, 'deleting a material cleans up its object');
});

test('missing, invalid, expired, revoked, unpermitted and closed-ceiling readers cannot list or open files', async () => {
  for (const reason of ['missing', 'invalid', 'token-expired', 'revoked', 'code-expired', 'ceiling', 'unpermitted', 'institution-inactive', 'subscription-expired']) {
    const { call, store, files, reader } = await fixture(reason === 'unpermitted' ? ['writer'] : ['studies']);
    const [, saved] = await call('save', { item: item({ url: '' }), file: attachment() });
    let token = reader;
    if (reason === 'missing') token = undefined;
    if (reason === 'invalid') token = 'not-a-token';
    if (reason === 'token-expired') {
      const body = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(reader.split('.')[0], 'base64url')), exp: 1 })).toString('base64url');
      token = body + '.' + createHmac('sha256', store.data.get('token-secret').secret).update(body).digest('base64url');
    }
    if (reason === 'revoked') store.data.get('code:TEST1234').revoked = true;
    if (reason === 'code-expired') store.data.get('code:TEST1234').expiresAt = '2000-01-01';
    if (reason === 'ceiling') store.data.set('modules:Test school', {});
    if (reason === 'institution-inactive') store.data.get('institutions')[0].active = false;
    if (reason === 'subscription-expired') store.data.get('institutions')[0].subEnd = '2000-01-01';
    for (const action of ['list', 'file']) {
      const denied = await handleStudies(store, { action, token, id: saved.item.id }, { files });
      assert.equal(denied[0], 403, reason + ': ' + action);
    }
    assert.equal(files.reads, 0, reason);
  }
});

test('reader and institution tokens cannot manage groups or items', async () => {
  const { call, store, reader } = await fixture();
  const [, institution] = await handleAccess(store, { action: 'login', kind: 'inst-code', secret: '123456' });
  assert.ok(institution.token);
  for (const token of [reader, institution.token, undefined]) for (const action of ['groupSave', 'groupDelete', 'save', 'delete']) {
    assert.equal((await handleStudies(store, { action, token, group: { title: 'new' }, item: item(), id: 'missing' }))[0], 403, action);
  }
  assert.deepEqual((await call('list'))[1], { groups: [], items: [] });
});

test('attachment omission preserves it, null removes it, and replacement failures retain the previous file', async () => {
  const { call, store, files, reader } = await fixture();
  const [, saved] = await call('save', { item: item({ url: '' }), file: attachment('original.pdf', 'old') });
  const [, edited] = await call('save', { item: { ...saved.item, title: 'כותרת חדשה' } });
  assert.equal(edited.item.file.name, 'original.pdf');
  files.failUpload = true;
  assert.equal((await call('save', { item: edited.item, file: attachment('new.pdf', 'new') }))[0], 503);
  files.failUpload = false;
  store.failSave = true;
  assert.equal((await call('save', { item: edited.item, file: attachment('new.pdf', 'new') }))[0], 503);
  store.failSave = false;
  assert.equal(files.data.size, 1, 'failed replacement upload is cleaned up');
  assert.equal((await call('file', { id: saved.item.id }, reader))[1].bytes.toString(), 'old');
  const [, replacement] = await call('save', { item: edited.item, file: attachment('new.pdf', 'new') });
  assert.equal(replacement.item.file.name, 'new.pdf');
  assert.equal(files.data.size, 1, 'successful replacement cleans up the previous file');
  assert.equal((await call('save', { item: replacement.item, file: null }))[0], 400, 'a material keeps a file or a link');
  const [removed, link] = await call('save', { item: { ...replacement.item, url: 'https://example.org' }, file: null });
  assert.equal(removed, 200);
  assert.equal(link.item.file, null);
  assert.equal(files.data.size, 0);
  assert.equal((await call('file', { id: saved.item.id }, reader))[0], 404);
});

test('a metadata write that commits before a transport error keeps the referenced attachment readable', async () => {
  const {call,store,reader} = await fixture();
  const [,saved] = await call('save',{item:item({url:''}),file:attachment('original.pdf','old')});
  const set = store.set.bind(store);
  store.set = async (key,value) => { await set(key,value); if(key === 'studies:library') throw Error('response lost after commit'); };
  assert.equal((await call('save',{item:saved.item,file:attachment('replacement.pdf','new')}))[0],503);
  const [status,opened] = await call('file',{id:saved.item.id},reader);
  assert.equal(status,200);
  assert.equal(opened.bytes.toString(),'new');
});

test('an unavailable read-back never deletes a possibly committed attachment', async () => {
  const {call,store,files,reader} = await fixture();
  const [,saved] = await call('save',{item:item({url:''}),file:attachment('original.pdf','old')});
  const set = store.set.bind(store), get = store.get.bind(store);
  let unavailable = false;
  store.set = async (key,value) => { await set(key,value); if(key === 'studies:library') { unavailable = true; throw Error('response lost after commit'); } };
  store.get = async key => { if(unavailable && key === 'studies:library') throw Error('read unavailable'); return get(key); };
  assert.equal((await call('save',{item:saved.item,file:attachment('replacement.pdf','new')}))[0],503);
  assert.equal(files.data.size,2);
  unavailable = false;
  const [status,opened] = await call('file',{id:saved.item.id},reader);
  assert.equal(status,200);
  assert.equal(opened.bytes.toString(),'new');
});

test('validation rejects malformed title, date, URL, group, file and preview input; omitted date is Israel today', async () => {
  const { call } = await fixture();
  for (const fields of [{ title: '' }, { title: 'x'.repeat(201) }, { date: '2026-02-30' }, { date: 'not-date' }, { url: 'javascript:alert(1)' }, { url: 'file:///secret' }, { groupId: 'unknown' }, { previews: [preview, preview, preview, preview] }, { previews: ['data:text/html;base64,PGgxPmhpPC9oMT4='] }, { previews: ['data:image/png;base64,' + Buffer.alloc(1024 * 1024 + 1).toString('base64')] }]) {
    assert.equal((await call('save', { item: item(fields) }))[0], 400, JSON.stringify(fields).slice(0, 100));
  }
  for (const file of [{ ...attachment(), data: 'not base64!' }, { ...attachment(), name: 'bad\r\nname.pdf' }, { ...attachment(), mime: 'application/pdf\r\nx: y' }, { ...attachment(), data: Buffer.alloc(50 * 1024 * 1024 + 1).toString('base64') }]) {
    assert.equal((await call('save', { item: item(), file }))[0], 400);
  }
  const fields = item(); delete fields.date;
  const [status, saved] = await call('save', { item: fields });
  assert.equal(status, 200);
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const part = type => parts.find(x => x.type === type).value;
  assert.equal(saved.item.date, `${part('year')}-${part('month')}-${part('day')}`);
});

test('the 50 MiB attachment boundary is accepted and allowed extensions infer empty browser MIME safely', async () => {
  const { call, files } = await fixture();
  const [status, saved] = await call('save', { item: item({ url: '' }), file: { name: 'limit.pdf', mime: '', data: Buffer.alloc(50 * 1024 * 1024, 'x').toString('base64') } });
  assert.equal(status, 200);
  assert.equal(saved.item.file.size, 50 * 1024 * 1024);
  assert.equal(saved.item.file.mime, 'application/pdf');
  await call('delete', { id: saved.item.id }); assert.equal(files.data.size, 0);
  for (const extension of ['PPT', 'pptx', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'csv', 'jpg', 'jpeg', 'png', 'webp']) {
    const [accepted, result] = await call('save', { item: item({ url: '' }), file: { name: 'sample.' + extension, mime: 'application/octet-stream', data: 'eA==' } });
    assert.equal(accepted, 200, extension);
    assert.ok(result.item.file.mime !== 'application/octet-stream', extension);
  }
  for (const file of [{ name: 'script.html', mime: 'text/html', data: 'eA==' }, { name: 'script.svg', mime: 'image/svg+xml', data: 'eA==' }, { name: 'named.pdf', mime: 'text/html', data: 'eA==' }]) {
    assert.equal((await call('save', { item: item(), file }))[0], 400);
  }
});

test('group deletion and item save cannot race to leave an orphaned group reference', async () => {
  const { call, store } = await fixture();
  const [, group] = await call('groupSave', { group: { title: 'קבוצה' } });
  const originalGet = store.get;
  store.get = async function (key) { const value = await originalGet.call(this, key); await new Promise(resolve => setTimeout(resolve, 4)); return value; };
  const results = await Promise.all([call('groupDelete', { id: group.group.id }), call('save', { item: item({ groupId: group.group.id }) })]);
  assert.equal(results[0][0], 200);
  assert.equal(results[1][0], 400);
  assert.deepEqual((await call('list'))[1], { groups: [], items: [] });
});

test('private Supabase adapter verifies the bucket, uploads bytes and uses authenticated reads and delete', async () => {
  const requests = [];
  let bucketExists = false;
  const storage = supabaseStudyFiles('https://synthetic.invalid', 'synthetic-service-key', { fetchImpl: async (url, options = {}) => {
    requests.push({ url, options });
    if (url.endsWith('/bucket/study-materials')) return bucketExists ? new Response(JSON.stringify({ id: 'study-materials', public: false })) : new Response(JSON.stringify({ message: 'Bucket not found' }), { status: 404 });
    if (url.endsWith('/bucket')) { bucketExists = true; return new Response(JSON.stringify({ name: 'study-materials' })); }
    if ((options.method || 'GET') === 'GET') return new Response(Buffer.from('saved bytes'));
    return new Response('{}');
  } });
  await storage.put('item/revision.pdf', Buffer.from('saved bytes'), 'application/pdf');
  assert.equal((await storage.get('item/revision.pdf')).toString(), 'saved bytes');
  await storage.del('item/revision.pdf');
  const creation = requests.find(r => r.url.endsWith('/bucket'));
  assert.deepEqual(JSON.parse(creation.options.body), { id: 'study-materials', name: 'study-materials', public: false, file_size_limit: 50 * 1024 * 1024 });
  const upload = requests.find(r => r.options.method === 'POST' && r.url.includes('/object/'));
  assert.equal(upload.options.body.toString(), 'saved bytes');
  assert.equal(upload.options.headers['Content-Type'], 'application/pdf');
  assert.ok(requests.some(r => r.url.endsWith('/object/authenticated/study-materials/item/revision.pdf')));
  assert.ok(requests.some(r => r.options.method === 'DELETE'));
  for (const { url, options } of requests) {
    assert.equal(options.headers.Authorization, 'Bearer synthetic-service-key');
    assert.ok(!url.includes('/public/') && !url.includes('synthetic-service-key'));
  }
});

test('private Supabase adapter refuses a public bucket before uploading or downloading', async () => {
  const requests = [];
  const storage = supabaseStudyFiles('https://synthetic.invalid', 'synthetic-key', { fetchImpl: async (url) => {
    requests.push(url); return new Response(JSON.stringify({ public: true }));
  } });
  await assert.rejects(storage.put('item/file', Buffer.from('private'), 'text/plain'));
  await assert.rejects(storage.get('item/file'));
  assert.ok(requests.every(url => url.endsWith('/bucket/study-materials')));
});

function abortAwareStall(signal, onAbort) {
  return new Promise((resolve, reject) => {
    const fallback = setTimeout(() => finish(Error('test transport stopped without an application deadline')), 300);
    const aborted = () => { onAbort(); finish(signal.reason); };
    function finish(error) {
      clearTimeout(fallback);
      signal?.removeEventListener('abort', aborted);
      reject(error);
    }
    if (signal?.aborted) aborted();
    else signal?.addEventListener('abort', aborted, { once: true });
  });
}

test('a stalled private upload aborts its transport and releases the next queued mutation', async () => {
  const { store, token } = await fixture();
  let aborted = false;
  let began;
  const started = new Promise(resolve => { began = resolve; });
  const files = supabaseStudyFiles('https://synthetic.invalid', 'synthetic-key', { timeoutMs: 20, fetchImpl: async (url, options) => {
    if (url.includes('/bucket/')) return new Response(JSON.stringify({ public: false }));
    if (options.method === 'POST') { began(); return abortAwareStall(options.signal, () => { aborted = true; }); }
    return new Response('{}');
  } });
  const first = handleStudies(store, { action: 'save', token, item: item({ url: '' }), file: attachment() }, { files });
  await started;
  const next = handleStudies(store, { action: 'groupSave', token, group: { title: 'לאחר העלאה שנעצרה' } }, { files });
  assert.equal((await first)[0], 503);
  assert.equal((await next)[0], 200);
  assert.equal(aborted, true, 'the adapter aborts underlying I/O instead of only returning a timeout');
  assert.deepEqual((await store.get('studies:library')).groups.map(group => group.title), ['לאחר העלאה שנעצרה']);
});

test('a stalled metadata response body aborts and releases the next queued mutation', async () => {
  const { store: memory, token } = await fixture();
  let aborted = false;
  let stall = true;
  let began;
  const started = new Promise(resolve => { began = resolve; });
  const fetchImpl = async (target, options) => {
    const url = new URL(target);
    if (options.method === 'POST') {
      const row = JSON.parse(options.body); await memory.set(row.key, row.value);
      return new Response('{}');
    }
    const key = url.searchParams.get('key').slice(3);
    if (key === 'studies:library' && stall) {
      stall = false;
      return { ok: true, json: () => { began(); return abortAwareStall(options.signal, () => { aborted = true; }); } };
    }
    const value = await memory.get(key);
    return new Response(JSON.stringify(value == null ? [] : [{ value }]));
  };
  const store = supabaseStore('https://synthetic.invalid', 'synthetic-key', { timeoutMs: 20, fetchImpl });
  const first = handleStudies(store, { action: 'groupSave', token, group: { title: 'בקשה שנעצרה' } });
  await started;
  const next = handleStudies(store, { action: 'groupSave', token, group: { title: 'בקשה הבאה' } });
  assert.equal((await first)[0], 503);
  assert.equal((await next)[0], 200);
  assert.equal(aborted, true, 'the deadline stays attached through response-body reading');
  assert.deepEqual((await memory.get('studies:library')).groups.map(group => group.title), ['בקשה הבאה']);
});

test('existing Supabase store callers retain their default fetch options', async () => {
  let options;
  const fetchImpl = async (url, supplied) => {
    options = supplied; return new Response('[]');
  };
  const store = supabaseStore('https://synthetic.invalid', 'synthetic-key', { fetchImpl });
  assert.equal(await store.get('missing'), null);
  assert.ok(!('signal' in options), 'only callers opting into a deadline receive an abort signal');
});

test('HTTP studies route accepts larger attachments, serves protected binary with CORS, and retains smaller existing-route limits', async t => {
  const data = new Map([['pw-sys',syntheticOwnerRecord()]]); const objects = new Map();
  const synthetic = createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const bytes = Buffer.concat(chunks);
    const url = new URL(req.url, 'http://synthetic.test');
    let output = {};
    if (url.pathname === '/rest/v1/access_settings') {
      if (req.method === 'POST') { const row = JSON.parse(bytes); data.set(row.key, row.value); }
      else if (req.method === 'GET') { const key = url.searchParams.get('key'); output = key?.startsWith('eq.') && data.has(key.slice(3)) ? [{ value: data.get(key.slice(3)) }] : []; }
    } else if (url.pathname === '/storage/v1/bucket/study-materials') output = { id: 'study-materials', public: false };
    else if (url.pathname.startsWith('/storage/v1/object/')) {
      const path = url.pathname.replace('/storage/v1/object/', '').replace(/^authenticated\//, '');
      if (req.method === 'POST') objects.set(path, Buffer.from(bytes));
      else if (req.method === 'DELETE') objects.delete(path);
      else { res.end(objects.get(path)); return; }
    } else { res.statusCode = 404; }
    res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(output));
  });
  synthetic.listen(0, '127.0.0.1'); await once(synthetic, 'listening');
  t.after(() => new Promise(resolve => synthetic.close(resolve)));
  const reservation = createServer(); reservation.listen(0, '127.0.0.1'); await once(reservation, 'listening');
  const port = reservation.address().port; await new Promise(resolve => reservation.close(resolve));
  const child = spawn(process.execPath, [fileURLToPath(new URL('../practice-server.mjs', import.meta.url)), '--port', String(port)], {
    env: { ...process.env, SUPABASE_URL: `http://127.0.0.1:${synthetic.address().port}`, SUPABASE_SERVICE_KEY: 'local-synthetic-key', ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = ''; child.stdout.on('data', chunk => { logs += chunk; }); child.stderr.on('data', chunk => { logs += chunk; });
  t.after(async () => { if (child.exitCode === null) { child.kill(); await once(child, 'exit'); } });
  const base = `http://127.0.0.1:${port}`;
  let ready = false; let connectionError;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { ready = (await fetch(base + '/health')).ok; if (ready) break; } catch (error) { connectionError = error.cause || error; }
    if (child.exitCode !== null) break;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  assert.ok(ready, logs + String(connectionError));
  const post = (path, body) => fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://be-good.co.il' }, body: JSON.stringify(body) });
  const login = await post('/api/access', { action: 'login', kind: 'sys', secret: SYNTHETIC_OWNER_PASSWORD });
  const { token } = await login.json(); assert.ok(token);
  const upload = { name: 'קובץ לדוגמה.pdf', mime: 'application/pdf', data: Buffer.alloc(3 * 1024 * 1024, 'x').toString('base64') };
  const saved = await post('/api/studies', { action: 'save', token, item: item({ url: '' }), file: upload });
  assert.equal(saved.status, 200);
  const result = await saved.json();
  const binary = await post('/api/studies', { action: 'file', token, id: result.item.id });
  assert.equal(binary.status, 200);
  assert.equal(binary.headers.get('access-control-allow-origin'), 'https://be-good.co.il');
  assert.equal(binary.headers.get('cache-control'), 'private, no-store');
  assert.equal(binary.headers.get('content-type'), 'application/pdf');
  assert.equal(binary.headers.get('x-content-type-options'), 'nosniff');
  assert.ok(binary.headers.get('content-disposition').includes("filename*=UTF-8''" + encodeURIComponent(upload.name)));
  assert.deepEqual(Buffer.from(await binary.arrayBuffer()),Buffer.from(upload.data,'base64'));
  const denied = await post('/api/studies', { action: 'file', id: result.item.id });
  assert.equal(denied.status, 403);
  assert.equal(denied.headers.get('content-type'), 'application/json; charset=utf-8');
  try {
    const oldRoute = await post('/api/access', { action: 'status', padding: 'x'.repeat(2_000_001) });
    assert.equal(oldRoute.status, 400, 'the existing route retains its smaller body limit');
  } catch (error) { assert.equal(error.name, 'TypeError', 'the existing parser may close an oversized connection'); }
});
