import test from 'node:test';
import assert from 'node:assert/strict';
import {createAtomicMemoryStore,handleAccess} from '../lib/access.mjs';

function fixture() {
  return createAtomicMemoryStore({
    'demo:index':[
      {id:'published-demo',tool:'studio',title:'Published example',public:true},
      {id:'private-demo',tool:'studio',title:'Private example',public:false}
    ],
    'demo:published-demo':{html:'<p>Published synthetic example</p>'},
    'demo:private-demo':{html:'<p>Private synthetic example</p>'}
  });
}

async function administrator(store,secret='990211') {
  const [status,result]=await handleAccess(store,{action:'login',kind:'sys',secret});
  assert.equal(status,200);
  return result.token;
}

test('public examples expose only published metadata and documents without login',async()=>{
  const store=fixture();
  const [listed,list]=await handleAccess(store,{action:'demoPublicList'});
  assert.equal(listed,200);
  assert.deepEqual(list.items.map(item=>item.id),['published-demo']);
  assert.equal(JSON.stringify(list).includes('Private'),false);
  assert.equal(JSON.stringify(list).includes('<p>'),false);
  const [read,document]=await handleAccess(store,{action:'demoGet',id:'published-demo'});
  assert.equal(read,200);
  assert.equal(document.html,'<p>Published synthetic example</p>');
  assert.equal((await handleAccess(store,{action:'demoGet',id:'private-demo'}))[0],404);
  assert.equal((await handleAccess(store,{action:'demoGet',id:'unknown-demo'}))[0],404);
});

test('public read exceptions never grant demo management or writes',async()=>{
  const store=fixture(),before=await store.list('demo:');
  for(const request of [
    {action:'demoList'},
    {action:'demoSave',html:'<p>Injected example</p>',title:'Injected'},
    {action:'demoPublish',id:'private-demo',public:true},
    {action:'demoDelete',id:'published-demo'}
  ]) assert.equal((await handleAccess(store,request))[0],403,request.action);
  assert.deepEqual(await store.list('demo:'),before);
});

test('live administrator retains unpublished reads and explicit publication',async()=>{
  const store=fixture(),token=await administrator(store);
  const [read,document]=await handleAccess(store,{action:'demoGet',id:'private-demo',token});
  assert.equal(read,200);
  assert.equal(document.html,'<p>Private synthetic example</p>');
  assert.equal((await handleAccess(store,{action:'demoList',token}))[1].items.length,2);
  assert.equal((await handleAccess(store,{action:'demoPublish',id:'private-demo',public:true,token}))[0],200);
  assert.deepEqual((await handleAccess(store,{action:'demoPublicList'}))[1].items.map(item=>item.id),['published-demo','private-demo']);
});

test('password rotation revokes private demo reads even through the public read route',async()=>{
  const store=fixture(),revokedToken=await administrator(store);
  assert.equal((await handleAccess(store,{action:'setPassword',token:revokedToken,kind:'sys',newPassword:'synthetic-new-password'}))[0],200);
  assert.equal((await handleAccess(store,{action:'demoGet',id:'private-demo',token:revokedToken}))[0],404);
  assert.equal((await handleAccess(store,{action:'demoList',token:revokedToken}))[0],403);
  assert.equal((await handleAccess(store,{action:'demoPublish',id:'private-demo',public:true,token:revokedToken}))[0],403);
  assert.equal((await handleAccess(store,{action:'demoGet',id:'published-demo',token:revokedToken}))[0],200);
  const currentToken=await administrator(store,'synthetic-new-password');
  assert.equal((await handleAccess(store,{action:'demoGet',id:'private-demo',token:currentToken}))[0],200);
});
