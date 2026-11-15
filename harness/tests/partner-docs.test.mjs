// מסמך שותפות למחקר (15/11/2026): מנהלת המערכת כותבת ושולחת; השותף/ה קורא/ת ומאשר/ת בלי כניסה.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { handleAccess } from '../lib/access.mjs';
import { seedOwnerPassword, SYNTHETIC_OWNER_PASSWORD } from './synthetic-access.mjs';

function memoryStore() {
  const data = new Map();
  return { data, async get(k) { return data.get(k) || null; }, async set(k, v) { data.set(k, v); }, async del(k) { data.delete(k); },
    async list(prefix, o = {}) { return [...data].filter(([k]) => k.startsWith(prefix)).map(([key, value]) => o.keysOnly ? { key } : { key, value }); } };
}
const doc = { title: 'שותפות במחקר שיחות מאתגרות', partnerName: 'ד״ר עינת', fromName: 'ד״ר יעל שדה',
  sections: [{ id: 'why', title: 'למה יחד', text: 'כי ביחד רואים יותר.' }, { title: '', text: '' }] };

test('only the admin writes; a draft is hidden; the partner reads and approves the current version', async () => {
  const store = memoryStore(); await seedOwnerPassword(store);
  const [, sys] = await handleAccess(store, { action: 'login', kind: 'sys', secret: SYNTHETIC_OWNER_PASSWORD });
  assert.equal((await handleAccess(store, { action: 'pdocSave', doc }))[0], 403);
  const [st, saved] = await handleAccess(store, { action: 'pdocSave', token: sys.token, doc });
  assert.equal(st, 200); assert.equal(saved.doc.status, 'draft'); assert.equal(saved.doc.sections.length, 1);
  assert.match(saved.doc.link, /partner-doc\.html\?d=[a-f0-9]{32}$/);
  const id = saved.doc.id;
  assert.equal((await handleAccess(store, { action: 'pdocGet', id }))[0], 404);
  const [, sent] = await handleAccess(store, { action: 'pdocSave', token: sys.token, send: true, doc: { ...doc, id } });
  assert.equal(sent.doc.status, 'sent');
  const [, got] = await handleAccess(store, { action: 'pdocGet', id });
  assert.equal(got.doc.partnerName, 'ד״ר עינת'); assert.equal(got.doc.partnerEmail, undefined);
  assert.equal((await handleAccess(store, { action: 'pdocRespond', id, kind: 'approve', name: 'עינת', version: got.doc.version }))[1].error, 'name and agreement');
  const [, q] = await handleAccess(store, { action: 'pdocRespond', id, kind: 'question', text: 'אפשר להוסיף פגישה חודשית?' });
  assert.equal(q.doc.status, 'changes');
  const [, ok] = await handleAccess(store, { action: 'pdocRespond', id, kind: 'approve', name: 'עינת שושן־רפאלי', agree: true, version: got.doc.version });
  assert.equal(ok.doc.status, 'approved'); assert.equal(ok.doc.approval.name, 'עינת שושן־רפאלי');
  // שינוי אחרי האישור: גרסה חדשה, והאישור הקודם לא חל עליה
  const [, edited] = await handleAccess(store, { action: 'pdocSave', token: sys.token, doc: { ...doc, id, closing: 'נתראה!' } });
  assert.equal(edited.doc.status, 'sent');
  const [, again] = await handleAccess(store, { action: 'pdocGet', id });
  assert.equal(again.doc.approval, null);
  assert.equal((await handleAccess(store, { action: 'pdocRespond', id, kind: 'approve', name: 'עינת', agree: true, version: got.doc.version }))[0], 409);
  assert.equal((await handleAccess(store, { action: 'pdocList' }))[0], 403);
  const [, list] = await handleAccess(store, { action: 'pdocList', token: sys.token });
  assert.equal(list.items.length, 1);
  assert.equal((await handleAccess(store, { action: 'pdocGet', id: 'abc' }))[0], 404);
});

test('the default document invites, and is not written in legal or obligating language', () => {
  const src = readFileSync(new URL('../../app/lib/partner-doc-core.js', import.meta.url), 'utf8');
  const text = src.replace(/\/\/.*$/gm, '');
  for (const w of ['צריך', 'חייב', 'חובה', 'מתחייב', 'סעיף', 'הצדדים', 'להלן', 'הואיל', '—']) assert.ok(!text.includes(w), w);
});
