import test from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { createHmac, randomUUID } from 'node:crypto';
import { createPracticeServer } from '../practice-server.mjs';
import { setTimeout as delay } from 'node:timers/promises';

// Exercise the real request listener and transport with isolated streams; no ports.
test('public HTTP intake has its own byte cap, fixed service RPC, socket rate bucket and existing CORS', async () => {
  const previous = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_KEY, fetch: globalThis.fetch };
  process.env.SUPABASE_URL = 'https://synthetic.invalid'; process.env.SUPABASE_SERVICE_KEY = 'sb_secret_synthetic';
  const calls = [], secret = 'synthetic-http-secret'; let providers = 0;
  const access = { async get(key) { return key === 'token-secret' ? { secret } : null; }, async list() { return []; } };
  globalThis.fetch = async (url, init) => { const body = JSON.parse(init.body); calls.push({ url, init, body }); return Response.json(body.p_action === 'intakePublicInfo' ? { terms: null, acceptingApplications: false } : { receipt: { id: randomUUID(), status: 'submitted', submittedAt: '2026-10-20T00:00:00Z' } }); };
  const server = createPracticeServer({ authStore: access, providerFactory() { providers++; throw new Error('synthetic unavailable'); } });
  const listener = server.listeners('request')[0];
  async function request(path, body, method = 'POST') {
    const req = new PassThrough(); req.url = path; req.method = method; req.headers = { origin: 'https://be-good.co.il', 'x-forwarded-for': 'forged-address' }; req.socket = { remoteAddress: 'synthetic-socket' };
    const res = { headers: {}, setHeader(key, value) { this.headers[key.toLowerCase()] = value; }, writeHead(status, headers) { this.status = status; Object.assign(this.headers, headers); }, end(value) { this.body = JSON.parse(value); } };
    const handling = listener(req, res); req.end(typeof body === 'string' ? body : JSON.stringify(body)); await handling; return res;
  }
  try {
    const publicInfo = await request('/api/research-intake', { action: 'intakePublicInfo' }); assert.equal(publicInfo.status, 200); assert.equal(publicInfo.headers['access-control-allow-origin'], 'https://be-good.co.il'); assert.match(publicInfo.headers['cache-control'], /no-store/);
    const submit = { action: 'intakeSubmit', requestId: randomUUID(), termsVersionId: randomUUID(), termsHash: 'a'.repeat(64), acknowledged: true, application: { title: 'Synthetic', applicationType: 'partnership', fullName: 'Synthetic Person', email: 'synthetic@example.invalid', objectives: 'Synthetic', requestedTools: ['writer'], applicantType: 'individual' } };
    assert.equal((await request('/api/research-intake', submit)).status, 200);
    const call = calls.at(-1); assert.equal(call.url, 'https://synthetic.invalid/rest/v1/rpc/research_intake_rpc'); assert.equal(call.body.p_token, ''); assert.equal(call.init.headers.apikey, 'sb_secret_synthetic');
    const bucket = address => createHmac('sha256', secret).update(JSON.stringify(['BEGOOD/research-intake-rate/v1', address])).digest('hex');
    assert.equal(call.body.p_payload.rateBucket, bucket('synthetic-socket')); assert.notEqual(call.body.p_payload.rateBucket, bucket('forged-address')); assert.equal(providers, 0);
    for (const invalid of [{ action: 'intakeOwnerBootstrap' }, { ...submit, token: 'forged' }, { ...submit, rateBucket: 'a'.repeat(64) }]) assert.equal((await request('/api/research-intake', invalid)).status, 400);
    assert.equal((await request('/api/research-intake', { action: 'intakePublicInfo' }, 'GET')).status, 405);
    assert.equal((await request('/api/research-intake', '{')).status, 400);
    const oversized = JSON.stringify({ action: 'intakePublicInfo', padding: 'א'.repeat(70 * 1024) });
    assert.equal((await request('/api/research-intake', oversized)).status, 413);
    assert.equal((await request('/api/research', oversized)).status, 400);
    assert.equal(calls.length, 2);
  } finally {
    globalThis.fetch = previous.fetch;
    if (previous.url === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = previous.url;
    if (previous.key === undefined) delete process.env.SUPABASE_SERVICE_KEY; else process.env.SUPABASE_SERVICE_KEY = previous.key;
    server.close();
  }
});

test('public intake returns unavailable when the access-settings request stalls',async(t)=>{
  const previous={url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SERVICE_KEY,fetch:globalThis.fetch};
  process.env.SUPABASE_URL='https://synthetic.invalid';process.env.SUPABASE_SERVICE_KEY='sb_secret_synthetic';
  const originalTimeout=AbortSignal.timeout;let deadline=0;
  t.mock.method(AbortSignal,'timeout',milliseconds=>{deadline=milliseconds;return originalTimeout(25);});
  globalThis.fetch=async(url,options)=>{
    if(new URL(url).searchParams.get('key')?.startsWith('like.'))return Response.json([]);
    return new Promise((resolve,reject)=>options.signal?.addEventListener('abort',()=>reject(Error('synthetic timeout'))));
  };
  const server=createPracticeServer(),listener=server.listeners('request')[0],req=new PassThrough();req.url='/api/research-intake';req.method='POST';req.headers={};req.socket={remoteAddress:'synthetic-socket'};
  const res={setHeader(){},writeHead(status){this.status=status;},end(value){this.body=JSON.parse(value);}};
  try{
    const handling=listener(req,res);req.end(JSON.stringify({action:'intakeSubmit',requestId:randomUUID(),termsVersionId:randomUUID(),termsHash:'a'.repeat(64),acknowledged:true,application:{title:'Synthetic',applicationType:'partnership',fullName:'Synthetic',email:'s@example.invalid',objectives:'Synthetic',requestedTools:['communication'],applicantType:'individual'}}));
    await Promise.race([handling,delay(500).then(()=>{throw Error('public access-settings request remained unbounded');})]);
    assert.equal(deadline,8000);assert.equal(res.status,503);assert.equal(res.body.code,'unavailable');
  }finally{
    globalThis.fetch=previous.fetch;if(previous.url===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=previous.url;if(previous.key===undefined)delete process.env.SUPABASE_SERVICE_KEY;else process.env.SUPABASE_SERVICE_KEY=previous.key;server.close();
  }
});


test('production server signing gate defaults off and only top-level trusted opt-in wires callbacks',async()=>{
 const previous={url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SERVICE_KEY,fetch:globalThis.fetch};process.env.SUPABASE_URL='https://synthetic.invalid';process.env.SUPABASE_SERVICE_KEY='sb_secret_synthetic';
 let providerCalls=0;const secret='synthetic-release-gate-secret',record={kind:'staff',inst:'Synthetic School'},access={async get(key){return key==='token-secret'?{secret}:key==='code:PERSON1'?record:key==='institutions'?[{name:record.inst,active:true}]:null;},async list(){return [];}};
 const tokenBody=Buffer.from(JSON.stringify({k:'code',c:'PERSON1',...record,exp:Date.now()+60000})).toString('base64url'),token=tokenBody+'.'+createHmac('sha256',secret).update(tokenBody).digest('base64url');
 const adapter={provider:'docusign',readiness(){providerCalls++;return {configured:true,state:'ready'};},verifyEvent(){providerCalls++;return {completed:false};}};
 globalThis.fetch=async()=>Response.json({readiness:{}});
 const partnershipOptions={signingEnabled:true,signingAdapter:adapter,documentKey:Buffer.alloc(32,8).toString('base64')},servers=[];
 async function request(server,path,body){const req=new PassThrough();req.url=path;req.method='POST';req.headers={};req.socket={remoteAddress:'synthetic'};const res={setHeader(){},writeHead(status){this.status=status;},end(value){this.body=JSON.parse(value);}};const pending=server.listeners('request')[0](req,res);req.end(JSON.stringify(body));await pending;return res;}
 try{
  const disabled=createPracticeServer({authStore:access,partnershipOptions});servers.push(disabled);
  const bootstrap=await request(disabled,'/api/research',{token,action:'workspaceBootstrap'});assert.equal(bootstrap.status,200);assert.equal(bootstrap.body.readiness.signing.configured,false);assert.equal(bootstrap.body.readiness.signing.state,'disabled');
  assert.equal((await request(disabled,'/api/research-signing/webhook',{})).status,503);assert.equal(providerCalls,0);
  const enabled=createPracticeServer({authStore:access,partnershipOptions,signingEnabled:true});servers.push(enabled);assert.equal((await request(enabled,'/api/research-signing/webhook',{})).status,200);assert.equal(providerCalls,1);
 }finally{for(const server of servers)server.close();globalThis.fetch=previous.fetch;for(const [key,value]of [['SUPABASE_URL',previous.url],['SUPABASE_SERVICE_KEY',previous.key]])if(value===undefined)delete process.env[key];else process.env[key]=value;}
});
