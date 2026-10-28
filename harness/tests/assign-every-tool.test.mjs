// "תבדוק שאני יכולה לשייך את כל הכלים למי שמקבל קוד" (28/10/2026):
// every permission can be opened for an institution, given in a personal code
// (by the system owner and by the institution admin), and works after login.
import { seedOwnerPassword, SYNTHETIC_OWNER_PASSWORD } from './synthetic-access.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { handleAccess, PERMS, MODEL_PAGES, authorizePermission } from '../lib/access.mjs';

function memoryStore() {
  const data = new Map();
  return { data, async get(k) { return data.get(k) || null; }, async set(k, v) { data.set(k, v); }, async del(k) { data.delete(k); },
    async list(prefix, o = {}) { return [...data].filter(([k]) => k.startsWith(prefix)).map(([key, value]) => o.keysOnly ? { key } : { key, value }); },
    async delPrefix(prefix) { for (const k of data.keys()) if (k.startsWith(prefix)) data.delete(k); } };
}
const call = (store, body) => handleAccess(store, body);

test('every permission can be assigned in a code and works after login', async () => {
  const store = memoryStore();
  await seedOwnerPassword(store);
  const [, s] = await call(store, { action: 'login', kind: 'sys', secret: SYNTHETIC_OWNER_PASSWORD });
  const token = s.token;
  assert.equal((await call(store, { action: 'addInstitution', token, name: 'בית ספר בדיקה' }))[0], 200);
  const [st] = await call(store, { action: 'setModules', token, inst: 'בית ספר בדיקה', modules: Object.fromEntries(PERMS.map((p) => [p, true])) });
  assert.equal(st, 200);

  // the institution admin code
  const [, ad] = await call(store, { action: 'codeCreate', token, kind: 'instadmin', inst: 'בית ספר בדיקה' });
  const [, adl] = await call(store, { action: 'login', kind: 'code', secret: ad.code.code });
  for (const p of PERMS) assert.ok(adl.perms.includes(p), 'institution admin sees ' + p);

  const pagesOf = (p) => Object.entries(MODEL_PAGES).filter(([, ps]) => ps.includes(p)).map(([pg]) => pg);
  for (const p of PERMS) {
    for (const [who, tk] of [['system owner', token], ['institution admin', adl.token]]) {
      const [cs, c] = await call(store, { action: 'codeCreate', token: tk, kind: 'staff', inst: 'בית ספר בדיקה', perms: [p], label: p });
      assert.equal(cs, 200, who + ' can give ' + p + ': ' + JSON.stringify(c));
      const [ls, l] = await call(store, { action: 'login', kind: 'code', secret: c.code.code });
      assert.equal(ls, 200, 'login with ' + p);
      assert.deepEqual(l.perms, [p], 'the code opens exactly ' + p);
      assert.ok(await authorizePermission(store, l.token, p), 'live permission ' + p);
    }
    if (!['lecturer', 'studies'].includes(p)) assert.ok(pagesOf(p).length, p + ' opens at least one page that uses the model');
  }
});

test('every permission has a label in the admin, home and request screens', () => {
  const app = new URL('../../app/', import.meta.url);
  const admin = fs.readFileSync(new URL('admin.html', app), 'utf8').match(/const MOD_LABELS = \{([\s\S]*?)\};/)[1];
  const home = fs.readFileSync(new URL('home.html', app), 'utf8').match(/const PERM_LABEL = \{([\s\S]*?)\};/)[1];
  const renew = fs.readFileSync(new URL('renew.html', app), 'utf8');
  for (const p of PERMS) {
    assert.match(admin, new RegExp('(^|[\\s{,])' + p + '\\s*:'), 'admin label ' + p);
    assert.match(home, new RegExp('(^|[\\s{,])' + p + '\\s*:'), 'home label ' + p);
    assert.ok(renew.includes('"' + p + '"'), 'request form ' + p);
  }
});
