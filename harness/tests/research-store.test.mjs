import test from 'node:test';
import assert from 'node:assert/strict';

test('intake public and owner operations use only the intake service RPC, with an empty public token', async () => {
 const {supabaseResearchStore}=await import('../lib/research-store.mjs'); const calls=[];
 const store=supabaseResearchStore('https://synthetic.invalid','sb_secret_synthetic',{fetchImpl:async(url,init)=>{calls.push({url,init});return Response.json({});}});
 for(const action of ['intakePublicInfo','intakeSubmit','intakeOwnerBootstrap','intakeReview']) {
  await store.rpc(action==='intakeSubmit'?'':'verified',action,{});
  assert.equal(calls.at(-1).url,'https://synthetic.invalid/rest/v1/rpc/research_intake_rpc');
  assert.equal(calls.at(-1).init.headers.apikey,'sb_secret_synthetic');
 }
 assert.equal(JSON.parse(calls[1].init.body).p_token,'');
});
test('partnership public and private actions use only their fixed RPC',async()=>{
 const {supabaseResearchStore}=await import('../lib/research-store.mjs');let endpoint;
 const store=supabaseResearchStore('https://synthetic.invalid','sb_secret_synthetic',{fetchImpl:async(url)=>{endpoint=url;return Response.json({});}});
 for(const action of ['recordSave','workspaceExport','signingPrepare','signatureComplete','agreementSources','agreementPrepare','agreementRefreshPreview','agreementRefreshApply','processingPolicyGet','processingPolicySave','processingPolicyApprove']){await store.rpc('verified',action,{});assert.equal(endpoint,'https://synthetic.invalid/rest/v1/rpc/research_partnership_rpc');}
});
test('fixed RPC transport uses legacy/opaque key headers and safe failures', async () => {
  const { supabaseResearchStore, ResearchStoreError } = await import('../lib/research-store.mjs');
  for (const key of ['synthetic.jwt.key', 'sb_secret_synthetic']) {
    let observed;
    const store = supabaseResearchStore('https://synthetic.invalid/', key, { fetchImpl: async (...args) => { observed = args; return new Response(JSON.stringify({ studies: [] }), { status: 200 }); } });
    assert.deepEqual(await store.rpc('personal-token', 'bootstrap', {}), { studies: [] });
    assert.equal(observed[0], 'https://synthetic.invalid/rest/v1/rpc/research_rpc');
    assert.equal(observed[1].headers.apikey, key);
    assert.equal(observed[1].headers.Authorization, key.startsWith('sb_secret_') ? undefined : 'Bearer ' + key);
    assert.deepEqual(JSON.parse(observed[1].body), { p_token: 'personal-token', p_action: 'bootstrap', p_payload: {} });
  }
  const store = supabaseResearchStore('https://synthetic.invalid', 'sb_secret_synthetic', { fetchImpl: async () => new Response(JSON.stringify({ error: 'not_found', status: 404 }), { status: 200 }) });
  await assert.rejects(store.rpc('token', 'studyGet', {}), error => error instanceof ResearchStoreError && error.code === 'not_found' && error.status === 404);
});
test('RPC transport never exposes failed-provider text, malformed JSON or object error codes',async()=>{
 const {supabaseResearchStore}=await import('../lib/research-store.mjs');
 for(const response of [new Response('private provider stack',{status:500}),new Response('not-json',{status:200}),new Response(JSON.stringify([{private:'data'}]),{status:200}),new Response(JSON.stringify({error:'private SQL detail',status:418}),{status:200})]){
  const store=supabaseResearchStore('https://synthetic.invalid','sb_secret_synthetic',{fetchImpl:async()=>response});await assert.rejects(store.rpc('token','bootstrap',{}),e=>e.message==='unavailable'&&e.status===503);
 }
 const network=supabaseResearchStore('https://synthetic.invalid','sb_secret_synthetic',{fetchImpl:async()=>{throw new Error('private credential')}});await assert.rejects(network.rpc('token','bootstrap',{}),e=>e.message==='unavailable');
 await assert.rejects(network.rpc('token','bootstrap',[]),e=>e.message==='invalid');
});
