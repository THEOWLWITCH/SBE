import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const clientPath = new URL('../../app/lib/studies-client.js', import.meta.url);
async function loadClient(options = {}) {
  const requests = [];
  const window = {
    sessionStorage: { getItem: () => 'reader-token' },
    fetch: async (url, init) => {
      requests.push({ url, ...init, body: JSON.parse(init.body) });
      return options.response || { ok: true, json: async () => ({ groups: [], items: [] }) };
    },
    document: { currentScript: { src: 'https://local.example/app/lib/studies-client.js' } },
    location: { href: 'https://local.example/app/social-resilience-studies.html' }
  };
  const context = vm.createContext({ window, document: window.document, URL, Blob, Uint8Array, ArrayBuffer,
    btoa, Intl, Date: options.Date || Date, console, setTimeout, clearTimeout, setImmediate, clearImmediate });
  if (options.zip) {
    window.document.createElement = () => ({ remove() {} });
    window.document.head = { appendChild(element) {
      assert.equal(element.src, 'https://local.example/app/lib/vendor/studies/jszip/jszip.min.js');
      readFile(new URL('../../app/lib/vendor/studies/jszip/jszip.min.js', import.meta.url), 'utf8')
        .then(source => { vm.runInContext(source, context); element.onload(); }).catch(element.onerror);
    } };
  }
  vm.runInContext(await readFile(clientPath, 'utf8'), context, { filename: 'studies-client.js' });
  return { client: window.SBE_STUDIES, requests, window };
}
function file(name, data, type = '') {
  return Object.assign(new Blob([data], { type }), { name });
}

test('today uses Jerusalem across the UTC date boundary', async () => {
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : ['2026-10-12T21:30:00Z'])); } }
  const { client } = await loadClient({ Date: Clock });
  assert.equal(client.today(), '2026-10-13');
});

test('call uses the approved endpoint and current token; explicit token wins', async () => {
  const { client, requests } = await loadClient();
  await client.call('list');
  await client.call('groupSave', { group: { title: 'קבוצה' }, token: 'injected', action: 'delete' }, 'system-token');
  assert.equal(requests[0].url, 'https://sbe-server.onrender.com/api/studies');
  assert.equal(requests[0].body.token, 'reader-token');
  assert.equal(requests[1].body.token, 'system-token');
  assert.equal(requests[1].body.action, 'groupSave');
  assert.equal(requests[1].body.group.title, 'קבוצה');
});

test('readFile normalizes missing PowerPoint MIME and preserves actual file bytes', async () => {
  const { client } = await loadClient();
  const result = await client.readFile(file('מצגת.PPTX', 'actual bytes'));
  assert.equal(result.name, 'מצגת.PPTX');
  assert.equal(result.mime, 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
  assert.equal(atob(result.data), 'actual bytes');
});

test('HTML/SVG and files over 50 MiB are rejected before reading or upload', async () => {
  const { client } = await loadClient();
  await assert.rejects(client.readFile(file('page.html', '<h1>unsafe</h1>', 'text/html')));
  await assert.rejects(client.readFile(file('image.svg', '<svg/>', 'image/svg+xml')));
  await assert.rejects(client.readFile(file('disguised.pdf', 'text', 'text/plain')));
  await assert.rejects(client.readFile({ name: 'large.pdf', type: 'application/pdf', size: 50 * 1024 * 1024 + 1,
    arrayBuffer: () => { throw new Error('large file was read'); } }), /50/);
});

test('CSV browser aliases normalize to the server MIME', async () => {
  const { client } = await loadClient();
  for (const type of ['text/plain', 'application/vnd.ms-excel', '']) {
    assert.equal((await client.readFile(file('table.csv', 'a,b', type))).mime, 'text/csv');
  }
});

test('real vendored JSZip reads a PPTX with no embedded cover without inventing a slide', async () => {
  const { client, window } = await loadClient({ zip: true });
  // This empty ZIP first loads the official UMD library through the real lazy loader.
  const emptyZip = Uint8Array.from([80,75,5,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]);
  assert.equal((await client.previews(file('empty.pptx', emptyZip))).length, 0);
  assert.equal(window.JSZip.version, '3.10.2');
  const archive = new window.JSZip();
  archive.file('ppt/media/image1.png', 'unrelated embedded slide image');
  archive.file('docProps/thumbnail.emf', 'unsupported cover format');
  const data = await archive.generateAsync({ type: 'uint8array' });
  assert.equal((await client.previews(file('no-cover.pptx', data))).length, 0);
});

test('non-preview attachments return no invented slides and do not load vendor libraries', async () => {
  const { client } = await loadClient();
  assert.equal((await client.previews(file('notes.docx', 'contents'))).length, 0);
  assert.equal((await client.previews(file('slides.ppt', 'contents'))).length, 0);
});

test('manual preview images enforce the three-image contract', async () => {
  const { client } = await loadClient();
  await assert.rejects(client.images([file('1.png', ''), file('2.png', ''), file('3.png', ''), file('4.png', '')]), /3/);
  await assert.rejects(client.images([file('not-image.pdf', '')]));
});

test('file returns a Blob after authorization; errors preserve status for reader UI', async () => {
  const attachment = new Blob(['private attachment'], { type: 'application/pdf' });
  const ok = await loadClient({ response: { ok: true, blob: async () => attachment } });
  assert.equal(await ok.client.file('item1'), attachment);
  assert.deepEqual(ok.requests[0].body, { id: 'item1', action: 'file', token: 'reader-token' });
  const denied = await loadClient({ response: { ok: false, status: 403, json: async () => ({ error: 'permission denied' }) } });
  await assert.rejects(denied.client.call('list'), error => error.status === 403 && /permission denied/.test(error.message));
});
