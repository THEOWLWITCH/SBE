// תיקיית התוצרים (12/10/2026: "תוצרים לא נטענים"): מחיקת הכול שרצה במקביל לתיקון לא מחזירה תוצרים בלי מסמך.
import test from 'node:test';
import assert from 'node:assert/strict';
import { handleAccess } from '../lib/access.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function slowStore() {
  const data = new Map();
  return { data, async get(k) { await sleep(5); return data.has(k) ? JSON.parse(JSON.stringify(data.get(k))) : null; }, async set(k, v) { await sleep(5); data.set(k, v); }, async del(k) { await sleep(5); data.delete(k); },
    async list(prefix) { return [...data].filter(([k]) => k.startsWith(prefix)).map(([key, value]) => ({ key, value })); }, async delPrefix() {} };
}
async function sys(store) { const [, out] = await handleAccess(store, { action: 'login', kind: 'sys', secret: '990211' }); return out.token; }
const doc = '<!doctype html><html><body><main><p>תוצר לדוגמה עם מספיק טקסט כדי להיראות.</p></main></body></html>';

test('clearing the folder while a fix is being saved leaves no product without its document', async () => {
  const store = slowStore(); const token = await sys(store);
  const ids = [];
  for (let i = 0; i < 3; i++) { const [, out] = await handleAccess(store, { action: 'demoSave', token, tool: 'practi', title: 't' + i, html: doc }); ids.push(out.item.id); }
  // התיקון מתחיל אחרי שהמחיקה כבר קראה את הרשימה, ולפני שסיימה
  await Promise.all([
    handleAccess(store, { action: 'demoClear', token }),
    sleep(12).then(() => handleAccess(store, { action: 'demoUpdate', token, id: ids[0], html: doc.replace('תוצר', 'תוצר מתוקן'), rv: { ready: true } })),
    sleep(14).then(() => handleAccess(store, { action: 'demoUpdate', token, id: ids[1], rv: { ready: true } })),
  ]);
  const [, list] = await handleAccess(store, { action: 'demoList', token });
  for (const d of list.items) assert.ok(store.data.has('demo:' + d.id), 'every listed product has its document');
  assert.equal(list.items.length, 0);
});

test('a listed product whose document is missing is removed from the list when opened; the public never gets the input', async () => {
  const store = slowStore(); const token = await sys(store);
  const [, a] = await handleAccess(store, { action: 'demoSave', token, tool: 'practi', title: 'a', html: doc, input: 'סוד' });
  const [, b] = await handleAccess(store, { action: 'demoSave', token, tool: 'practi', title: 'b', html: doc, input: 'סוד' });
  await handleAccess(store, { action: 'demoPublish', token, id: b.item.id, public: true });
  store.data.delete('demo:' + a.item.id);
  const [st, out] = await handleAccess(store, { action: 'demoGet', token, id: a.item.id });
  assert.equal(st, 404); assert.equal(out.error, 'gone');
  const [, list] = await handleAccess(store, { action: 'demoList', token });
  assert.deepEqual(list.items.map((d) => d.id), [b.item.id]);
  const [, pub] = await handleAccess(store, { action: 'demoGet', id: b.item.id });
  assert.ok(pub.html && !('input' in pub));
  const [, plist] = await handleAccess(store, { action: 'demoPublicList' });
  assert.ok(plist.items.length === 1 && !('input' in plist.items[0]));
});
