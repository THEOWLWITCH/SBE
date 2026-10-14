import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { handleAccess, authorizeModel } from '../lib/access.mjs';
import { studioRequest } from '../lib/studio.mjs';

function memoryStore(seed = {}) {
  const data = new Map(Object.entries(seed));
  return { data, async get(k) { return data.get(k) || null; }, async set(k,v) { data.set(k,v); }, async del(k) { data.delete(k); },
    async list(prefix) { return [...data].filter(([k]) => k.startsWith(prefix)).map(([key,value]) => ({key,value})); } };
}
async function signed(perms = ['writer']) {
  const store = memoryStore({ institutions: [{name:'Synthetic school',active:true}],
    'modules:Synthetic school': Object.fromEntries(perms.map(p => [p,true])),
    'code:TEST1234': {kind:'staff',inst:'Synthetic school',perms,revoked:false} });
  const [status,out] = await handleAccess(store,{action:'login',kind:'code',secret:'TEST-1234'});
  assert.equal(status,200);
  return {store,token:out.token};
}

test('a permitted writer cannot claim its page to invoke the simulation pipeline or character route', async () => {
  const {store,token} = await signed();
  assert.equal((await authorizeModel(store,{token,page:'message-writer.html'},'/api/complete')).ok,true);
  for (const route of ['/api/pipeline','/api/character-turn','/api/unlisted'])
    assert.equal((await authorizeModel(store,{token,page:'message-writer.html'},route)).ok,false,route);
});

test('server model identity and institution come from a verified token', async () => {
  const {store,token} = await signed();
  const actor = await authorizeModel(store,{token,page:'message-writer.html',institutionId:'Other school'},'/api/complete');
  assert.equal(actor.institutionId,'Synthetic school');
  assert.ok(actor.owner && actor.principal);
  assert.ok(!JSON.stringify(actor).includes(token));
});

test('source includes no built-in management password fallback', () => {
  const source = readFileSync(new URL('../lib/access.mjs',import.meta.url),'utf8');
  assert.ok(!source.includes('DEFAULT_PASSWORDS'));
});

test('revocation blocks an existing Studio background result immediately', async () => {
  const {store,token} = await signed(['studio']);
  const prior = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'synthetic-provider-key';
  let resolveProvider;
  try {
    const [status,out] = await studioRequest(store,{token,action:'consult',async:true,brief:{},stage:'starting',question:'מה הצעד הבא?'},
      {fetchImpl: () => new Promise(resolve => {resolveProvider = resolve;})});
    assert.equal(status,200); assert.ok(out.jobId);
    store.data.get('code:TEST1234').revoked = true;
    assert.equal((await studioRequest(store,{token,action:'status',jobId:out.jobId}))[0],403);
  } finally {
    resolveProvider?.({ok:false});
    if (prior === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = prior;
  }
});
