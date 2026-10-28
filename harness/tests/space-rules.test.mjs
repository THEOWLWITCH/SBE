// המרחב הארגוני (28/10/2026): "המילים מחנך/ת או מורה לא יופיעו בחלק הארגוני", והמרחב מסומן בהגדרות המוסד.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { handleAccess, authorizeModel, spaceFromPerms } from '../lib/access.mjs';
import { providerSystem, withSpace } from '../lib/provider-input.mjs';
import { seedOwnerPassword, SYNTHETIC_OWNER_PASSWORD } from './synthetic-access.mjs';
const INVITE = createRequire(import.meta.url)('../../app/lib/invite-language.js');

function memoryStore(seed = {}) {
  const data = new Map(Object.entries(seed));
  return { data, async get(k) { return data.get(k) || null; }, async set(k, v) { data.set(k, v); }, async del(k) { data.delete(k); },
    async list(prefix, o = {}) { return [...data].filter(([k]) => k.startsWith(prefix)).map(([key, value]) => o.keysOnly ? { key } : { key, value }); },
    async delPrefix(prefix) { for (const k of data.keys()) if (k.startsWith(prefix)) data.delete(k); } };
}
const EDU_WORDS = /מחנכ|מורה|מורים|מורות|תלמיד|כיתה|בית ספר/;

test('org rules carry no school words outside the vocabulary rule itself', () => {
  const sys = providerSystem('הנחיה', undefined, 'org');
  assert.ok(sys.includes(INVITE.ORG_TITLE) && sys.includes(INVITE.ORG_WORDS_TITLE));
  assert.ok(!sys.includes(INVITE.EDU_TITLE));
  const withoutVocabulary = sys.replace(INVITE.orgWords, '');
  assert.equal(EDU_WORDS.test(withoutVocabulary), false, withoutVocabulary.match(new RegExp('.{30}(' + EDU_WORDS.source + ').{20}'))?.[0]);
  // the education space is unchanged
  assert.equal(providerSystem('הנחיה'), INVITE.apply('הנחיה'));
  assert.ok(providerSystem('הנחיה').includes(INVITE.EDU_TITLE));
  // communication-continuity keeps its narrower set, with the org vocabulary
  const cc = providerSystem('x', 'communication-continuity', 'org');
  assert.ok(cc.includes(INVITE.ORG_WORDS_TITLE) && !cc.includes(INVITE.ORG_TITLE));
});

test('withSpace passes the org space to every call, and leaves edu untouched', async () => {
  const seen = [];
  const p = { complete: async (o) => { seen.push(o.space); return { text: '' }; } };
  assert.equal(withSpace(p, 'edu'), p);
  await withSpace(p, 'org').complete({ system: 's' });
  assert.deepEqual(seen, ['org']);
});

test('the space comes from the institution, and otherwise from the tools in the code', async () => {
  assert.equal(spaceFromPerms(['horizon', 'teamthink']), 'org');
  assert.equal(spaceFromPerms(['horizon', 'practi']), 'edu');
  assert.equal(spaceFromPerms([]), 'edu');
  const store = memoryStore({ institutions: [{ name: 'Inst', code: '123456', active: true }],
    'modules:Inst': { horizon: true, practi: true },
    'code:TEST1234': { code: 'TEST-1234', kind: 'staff', inst: 'Inst', perms: ['horizon', 'practi'], revoked: false } });
  let [, out] = await handleAccess(store, { action: 'login', kind: 'code', secret: 'TEST-1234' });
  assert.equal(out.space, 'edu');
  assert.equal((await authorizeModel(store, { token: out.token, page: 'hl-voice.html' })).space, 'edu');
  // the system admin marks the institution as org
  await seedOwnerPassword(store);
  const [st] = await handleAccess(store, { action: 'setInstitutionSpace', name: 'Inst', space: 'org', auth: SYNTHETIC_OWNER_PASSWORD });
  assert.equal(st, 200);
  assert.equal(store.data.get('institutions')[0].space, 'org');
  [, out] = await handleAccess(store, { action: 'login', kind: 'code', secret: 'TEST-1234' });
  assert.equal(out.space, 'org');
  assert.equal((await authorizeModel(store, { token: out.token, page: 'hl-voice.html', space: 'edu' })).space, 'org', 'a code cannot choose its own space');
  // clearing returns to the tools
  await handleAccess(store, { action: 'setInstitutionSpace', name: 'Inst', space: null, auth: SYNTHETIC_OWNER_PASSWORD });
  assert.equal(store.data.get('institutions')[0].space, undefined);
  // only the system admin may change it
  const [denied] = await handleAccess(store, { action: 'setInstitutionSpace', name: 'Inst', space: 'org', token: out.token });
  assert.equal(denied, 403);
});
