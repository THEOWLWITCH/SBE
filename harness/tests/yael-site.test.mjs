// האתר האישי של ד״ר יעל שדה (yael-site/, אתר Netlify נפרד, 31/10/2026): כניסה בסיסמה, שמירה, העלאת קבצים ומחיקה.
import test from 'node:test';
import assert from 'node:assert/strict';
import { handle, cleanSite, safeUrl } from '../../yael-site/netlify/functions/site.mjs';

function memoryStore() {
  const data = new Map();
  return {
    data,
    async get(k) { return data.has(k) ? structuredClone(data.get(k)) : null; },
    async set(k, v) { data.set(k, structuredClone(v)); },
    async delete(k) { data.delete(k); },
    async getBin(k) { return data.has(k) ? data.get(k) : null; },
    async setBin(k, v) { data.set(k, Buffer.from(v)); },
  };
}
const ENV = { password: 'sod-gadol' };
const post = (body) => new Request('https://example.org/api/site', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const get = (path) => new Request('https://example.org' + path);
const call = async (store, body, env = ENV, ip = '1.1.1.1') => { const r = await handle(post(body), store, env, ip); return { status: r.status, ...(await r.json()) }; };

test('login: wrong password, no password configured, and a rate limit', async () => {
  const store = memoryStore();
  assert.equal((await call(store, { action: 'login', password: 'x' }, { password: '' })).status, 503);
  assert.equal((await call(store, { action: 'login', password: 'wrong' })).status, 401);
  for (let i = 0; i < 7; i++) await call(store, { action: 'login', password: 'wrong' });
  assert.equal((await call(store, { action: 'login', password: 'sod-gadol' })).status, 429);
  const ok = await call(store, { action: 'login', password: 'sod-gadol' }, ENV, '2.2.2.2');
  assert.equal(ok.status, 200);
  assert.ok(ok.token);
  assert.equal((await call(store, { action: 'check', token: ok.token })).ok, true);
  // החלפת הסיסמה מבטלת כניסות קודמות
  assert.equal((await call(store, { action: 'check', token: ok.token }, { password: 'sisma-hadasha' })).status, 401);
  assert.equal((await call(store, { action: 'save', token: 'nope', site: {} })).status, 401);
});

test('save, read publicly, upload a file, and removed files are deleted', async () => {
  const store = memoryStore();
  const { token } = await call(store, { action: 'login', password: 'sod-gadol', remember: true });
  assert.deepEqual(await (await handle(get('/api/site'), store, ENV)).json(), { site: null });

  const up = await call(store, { action: 'upload', token, name: 'הרצאה.pdf', data: 'data:application/pdf;base64,' + Buffer.from('%PDF-1.4 test').toString('base64') });
  assert.equal(up.status, 200);
  assert.equal(up.file.type, 'application/pdf');
  assert.equal((await call(store, { action: 'upload', token, name: 'x.html', data: 'PGI+' })).status, 415);
  assert.equal((await call(store, { action: 'upload', token, name: 'x.svg', data: 'PGI+' })).status, 415);

  const site = { brand: { name: 'ד״ר יעל שדה' }, pages: [
    { id: 'home', home: true, title: 'בית', items: [] },
    { id: 'research', title: 'מחקר', items: [{ id: 'a1', type: 'file', title: 'מצגת', file: up.file }, { id: 'a2', type: 'link', title: 'רע', url: 'javascript:alert(1)' }] },
  ] };
  const s1 = await call(store, { action: 'save', token, site });
  assert.equal(s1.status, 200);
  const pub = (await (await handle(get('/api/site'), store, ENV)).json()).site;
  assert.equal(pub.pages[1].items[0].file.id, up.file.id);
  assert.equal(pub.pages[1].items[1].url, '');

  const f = await handle(get('/api/file?id=' + up.file.id), store, ENV);
  assert.equal(f.status, 200);
  assert.equal(f.headers.get('content-type'), 'application/pdf');
  assert.match(f.headers.get('content-disposition'), /^inline/);
  assert.equal(Buffer.from(await f.arrayBuffer()).toString(), '%PDF-1.4 test');
  assert.equal((await call(store, { action: 'deleteFile', token, id: up.file.id })).status, 409);

  // שמירה מגרסה ישנה נעצרת
  assert.equal((await call(store, { action: 'save', token, site, base: '2020-01-01' })).status, 409);
  // הסרת הפריט מוחקת את הקובץ
  site.pages[1].items = [];
  assert.equal((await call(store, { action: 'save', token, site, base: s1.updatedAt })).status, 200);
  assert.equal((await handle(get('/api/file?id=' + up.file.id), store, ENV)).status, 404);
});

test('cleanSite keeps one home page and only known fields; safeUrl', () => {
  const s = cleanSite({ pages: [{ id: 'a', title: 'א', home: true, hidden: true, x: 1 }, { id: 'a', title: 'ב', home: true }, { title: '' }] });
  assert.equal(s.pages.filter((p) => p.home).length, 1);
  assert.equal(s.pages[0].hidden, false);
  assert.notEqual(s.pages[1].id, 'a');
  assert.equal(s.pages[2].title, 'דף');
  assert.equal('x' in s.pages[0], false);
  assert.equal(safeUrl('https://be-good.co.il'), 'https://be-good.co.il');
  assert.equal(safeUrl('mailto:a@b.co'), 'mailto:a@b.co');
  assert.equal(safeUrl('//evil.com'), '');
  assert.equal(safeUrl('data:text/html,x'), '');
});
