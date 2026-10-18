import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { supabaseStore } from '../lib/access.mjs';
const source=readFileSync(new URL('../../app/lib/access-guard.js',import.meta.url),'utf8');
function screen(page,payload,home='home.html') {
  const values=new Map([['sbe.session.homeUrl',home],['sbe.session.perms','[]'],['sbe.session.token',payload?Buffer.from(JSON.stringify({exp:Date.now()+3600000,...payload})).toString('base64url')+'.synthetic-signature':'']]);
  const storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
  const html={style:{},classList:{add(){}}};let redirect='';
  vm.runInNewContext(source,{window:{},sessionStorage:storage,localStorage:{getItem:()=>null,setItem(){},removeItem(){}},
    document:{documentElement:html,head:{appendChild(){}},createElement:()=>({})},
    location:{pathname:'/'+page,search:'',replace:url=>redirect=url},URLSearchParams,Uint8Array,TextDecoder,atob});
  return {allowed:html.style.display!=='none',redirect};
}
test('dedicated research shell opens for live individual sessions without granting general admin pages',()=>{
  for(const page of ['research-management.html','research-participation.html']) {
    assert.equal(screen(page,{k:'code',c:'SYNTHETIC',kind:'staff'}).allowed,true,page);
    assert.equal(screen(page,{k:'code',c:'SYNTHETIC',kind:'instadmin'},'admin.html?role=inst').allowed,true,page);
    assert.equal(screen(page,{k:'sys'},'admin.html?role=sys').allowed,true,page);
    for(const payload of [{k:'inst'},{k:'open'}, {k:'code',c:'COURSE',kind:'course'}, {k:'code',c:'LEGACY',kind:'legacy'}]) assert.equal(screen(page,payload).allowed,false);
    assert.equal(screen(page,{k:'code',c:'SYNTHETIC',kind:'staff',exp:Date.now()-1000}).redirect,'entry.html?expired=1');
  }
  assert.equal(screen('admin.html',{k:'code',c:'SYNTHETIC',kind:'staff'}).allowed,false);
});
test('existing access transport accepts an opaque service key without an invalid JWT bearer while retaining legacy headers',async()=>{
  for(const key of ['sb_secret_synthetic','synthetic.jwt.key']) {
    let headers;
    const store=supabaseStore('https://fixture.invalid',key,{fetchImpl:async(_url,options)=>{headers=options.headers;return new Response(JSON.stringify([{value:{synthetic:true}}]));}});
    assert.deepEqual(await store.get('synthetic'),{synthetic:true}); assert.equal(headers.apikey,key);
    assert.equal(headers.Authorization,key.startsWith('sb_secret_')?undefined:'Bearer '+key);
  }
});
