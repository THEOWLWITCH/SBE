import test from 'node:test';
import assert from 'node:assert/strict';
import { supabaseStore } from '../lib/access.mjs';
import { openAIInput, providerSystem } from '../lib/provider-input.mjs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const INVITE = require('../../app/lib/invite-language.js');

test('OpenAI receives ordered conversation messages and supported vision parts', () => {
  const input = openAIInput('system', null, [
    { role: 'user', content: 'הודעה קודמת' },
    { role: 'assistant', content: 'טיוטה' },
    { role: 'user', content: [
      { type: 'text', text: 'תגובה חדשה' },
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'aGVsbG8=' } },
      { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: 'cGRm' } }
    ] }
  ]);
  assert.equal(input[0].role, 'system');
  assert.deepEqual(input.slice(1).map(x => x.role), ['user', 'assistant', 'user']);
  assert.equal(input[1].content, 'הודעה קודמת');
  assert.equal(input[3].content[0].text, 'תגובה חדשה');
  assert.equal(input[3].content[1].image_url, 'data:image/png;base64,aGVsbG8=');
  assert.equal(input[3].content[2].file_data, 'data:application/pdf;base64,cGRm');
  assert.equal(input[3].content[2].filename, 'attachment.pdf');
});

test('legacy prompts remain intact and unsupported message parts fail visibly', () => {
  assert.equal(openAIInput('system', 'prompt'), 'system\n\nprompt');
  assert.equal(openAIInput('', 'prompt'), 'prompt');
  assert.throws(() => openAIInput('', '', [{role:'user', content:[{type:'unknown'}]}]));
});

test('communication policy is narrow and old tools retain historical language rules', () => {
  assert.equal(providerSystem('hello'), INVITE.apply('hello'));
  const s = providerSystem('module request', 'communication-continuity');
  assert.ok(s.includes('module request'));
  assert.ok(s.includes(INVITE.rule));
  assert.ok(s.includes(INVITE.nonjudging));
  assert.ok(!s.includes(INVITE.educator));
  assert.ok(!s.includes(INVITE.agency));
});

test('Supabase compare-and-set emits atomic revision predicates and detects conflicts', async () => {
  const data = new Map();
  const fetchImpl = async (target, opts) => {
    const u = new URL(target), body=JSON.parse(opts.body);
    assert.equal(u.searchParams.get('select'),'key');
    if(opts.method==='POST') {
      if(data.has(body.key)) return Response.json({}, {status:409});
      data.set(body.key, body.value); return Response.json([body], {status:201});
    }
    if(opts.method==='PATCH') {
      const key=u.searchParams.get('key').replace(/^eq\./,'');
      const revision=u.searchParams.get('value->>revision');
      const current=data.get(key);
      assert.equal(opts.headers.Prefer,'return=representation');
      if(!current || revision!=='eq.'+current.revision) return Response.json([]);
      data.set(key,body.value); return Response.json([{key,value:body.value}]);
    }
    throw new Error('Unexpected request');
  };
  const first=supabaseStore('https://fixture.invalid','test-service',{fetchImpl}), second=supabaseStore('https://fixture.invalid','test-service',{fetchImpl});
  assert.equal(await first.compareSet('cc:test:uuid',null,{revision:1,text:'original'}),true);
  assert.equal(await second.compareSet('cc:test:uuid',null,{revision:1,text:'overwrite'}),false);
  const wins=await Promise.all([
    first.compareSet('cc:test:uuid',1,{revision:2,text:'first'}),
    second.compareSet('cc:test:uuid',1,{revision:2,text:'second'})
  ]);
  assert.equal(wins.filter(Boolean).length,1);
  assert.equal(data.get('cc:test:uuid').revision,2);
  assert.equal(await first.compareSet('cc:test:uuid',1,{revision:3}),false);
});

test('saved-conversation list projects metadata at storage without private history',async()=>{
  const requests=[];
  const store=supabaseStore('https://fixture.invalid','synthetic-service',{fetchImpl:async(target)=>{
    const u=new URL(target);requests.push(u);
    return Response.json(u.searchParams.get('select')==='key'?[{key:'cc:owner:id'}]:[{key:'cc:owner:id',id:'id',title:'שיחה',revision:'3',rounds:'2',_deleted:null,versions:{tool:'1.0.0'}}]);
  }});
  const rows=await store.list('cc:owner:',{conversationSummaries:true});
  assert.equal(rows[0].value.revision,3);assert.equal(rows[0].value.rounds,2);
  assert.equal(rows[0].value._deleted,false);
  const select=requests[0].searchParams.get('select');
  assert.ok(select.includes('title:value->>title'));
  assert.ok(select.includes('versions:value->versions'));
  assert.ok(!/(?:^|,)value(?:,|$)|entries|latestAI|research|_requests/.test(select));
  assert.deepEqual(await store.list('cc:owner:',{keysOnly:true,conversationSummaries:true}),[{key:'cc:owner:id'}]);
});
