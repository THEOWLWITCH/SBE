// סיפורים אישיים בהסכמה (14/10/2026): נשמרים רק עם הסכמה, רק מי ששיתף/ה מבטל/ת, ורק מנהלת המערכת קוראת.
import test from 'node:test';
import assert from 'node:assert/strict';
import { handleAccess } from '../lib/access.mjs';

function memoryStore() {
  const data = new Map();
  return { data, async get(k) { return data.get(k) || null; }, async set(k, v) { data.set(k, v); }, async del(k) { data.delete(k); },
    async list(prefix, o = {}) { return [...data].filter(([k]) => k.startsWith(prefix)).map(([key, value]) => o.keysOnly ? { key } : { key, value }); },
    async delPrefix(prefix) { for (const k of data.keys()) if (k.startsWith(prefix)) data.delete(k); } };
}
const form = { story: 'אבא של תלמיד כתב לי שהבן שלו לא רוצה לבוא לבית הספר בגלל ילדים בכיתה.', role: 'מחנכת', other: 'אבא' };

test('a personal story is saved only with consent, and only by someone who signed in', async () => {
  const store = memoryStore();
  const [, sys] = await handleAccess(store, { action: 'login', kind: 'sys', secret: '990211' });
  assert.equal((await handleAccess(store, { action: 'storyShare', form, consent: { share: true } }))[0], 403);
  assert.equal((await handleAccess(store, { action: 'storyShare', token: sys.token, form }))[1].error, 'no consent');
  assert.equal((await handleAccess(store, { action: 'storyShare', token: sys.token, form: { story: 'קצר' }, consent: { share: true } }))[1].error, 'too short');
  const [st, out] = await handleAccess(store, { action: 'storyShare', token: sys.token, form, consent: { share: true, research: true }, scenario: { name: 'אבא מודאג' } });
  assert.equal(st, 200); assert.ok(out.id && out.key);
  const rec = await store.get('story:' + out.id);
  assert.equal(rec.consent.research, true); assert.equal(rec.form.role, 'מחנכת'); assert.equal(rec.status, 'חדש');
});

test('only the admin reads the stories, the key never leaves, and the sharer can withdraw', async () => {
  const store = memoryStore();
  const [, sys] = await handleAccess(store, { action: 'login', kind: 'sys', secret: '990211' });
  const [, out] = await handleAccess(store, { action: 'storyShare', token: sys.token, form, consent: { share: true } });
  assert.equal((await handleAccess(store, { action: 'storyList' }))[0], 403);
  const [, list] = await handleAccess(store, { action: 'storyList', token: sys.token });
  assert.equal(list.items.length, 1); assert.equal(list.items[0].key, undefined);
  assert.equal((await handleAccess(store, { action: 'storyStatus', token: sys.token, id: out.id, status: 'מתאים למאגר' }))[0], 200);
  assert.equal((await handleAccess(store, { action: 'storyWithdraw', id: out.id, key: 'wrong' }))[0], 404);
  assert.equal((await handleAccess(store, { action: 'storyWithdraw', id: out.id, key: out.key }))[0], 200);
  assert.equal((await handleAccess(store, { action: 'storyList', token: sys.token }))[1].items.length, 0);
});

test('a practice conversation can be saved with consent, without a story form', async () => {
  const store = memoryStore();
  const [, sys] = await handleAccess(store, { action: 'login', kind: 'sys', secret: '990211' });
  const talk = [{ who: 'character', line: 'בואי נגיד שראיתי מהחלון.' }, { who: 'trainee', line: 'מה ראית?' }, { who: 'system', line: 'x' }];
  const [st, r] = await handleAccess(store, { action: 'storyShare', token: sys.token, talk, consent: { share: true, research: true }, scenario: { name: 'הגננת' } });
  assert.equal(st, 200);
  const rec = await store.get('story:' + r.id);
  assert.equal(rec.kind, 'שיחה'); assert.equal(rec.talk.length, 2); assert.equal(rec.consent.research, true);
  assert.equal((await handleAccess(store, { action: 'storyShare', token: sys.token, talk: talk.slice(0, 1), consent: { share: true } }))[1].error, 'too short');
  assert.equal((await handleAccess(store, { action: 'storyWithdraw', id: r.id, key: r.key }))[0], 200);
});
