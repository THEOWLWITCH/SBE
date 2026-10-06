import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {handleAccess} from '../lib/access.mjs';
const guard=readFileSync(new URL('../../app/lib/access-guard.js',import.meta.url),'utf8');
function guardState(home,perms,modules={},token=''){
  const data=new Map([['sbe.session.homeUrl',home],['sbe.session.perms',JSON.stringify(perms)],['sbe.session.modules',JSON.stringify(modules)],['sbe.session.token',token]]);
  const storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
  const html={style:{},classList:{add(){}}};
  const ctx={window:{},sessionStorage:storage,localStorage:{getItem:()=>null,setItem(){},removeItem(){}},document:{documentElement:html,head:{appendChild(){}},createElement:()=>({})},location:{pathname:'/resilience-studio.html',search:'',replace(){}},URLSearchParams,TextDecoder,Uint8Array,atob};
  vm.runInNewContext(guard,ctx);
  return {allowed:html.style.display!=='none',key:ctx.window.sbeUserKey('sbe.studio.v1'),handoff:ctx.window.sbeUserKey('sbe.studio.mapping')};
}
function screen(home,perms,modules={}){return guardState(home,perms,modules).allowed;}
test('Studio screen matches its declared permissions across broad users',()=>{
  for(const p of ['studio','activity','resilience','practi','leadership'])assert.equal(screen('home.html',[p]),true,p);
  assert.equal(screen('home.html',['academic']),false);
  assert.equal(screen('',[]),false);
  assert.equal(screen('admin.html?role=sys',[]),true);
  assert.equal(screen('system-select.html?track=youth',[],{studio:true}),true);
});
test('Navigation exposes Studio with an accurate permission description',()=>{
  const text=readFileSync(new URL('../../app/lib/screens-menu.js',import.meta.url),'utf8');
  assert.match(text,/file:'resilience-studio.html'.*who:'הרשאת סטודיו/);
});

test('AE1,22: manager and administrator mapping handoffs retain the selected round',()=>{
  const html=readFileSync(new URL('../../app/resilience-team.html',import.meta.url),'utf8');
  const start=html.indexOf("document.getElementById('btn-studio').addEventListener"),end=html.indexOf('function clearAll()',start);
  const code=html.slice(start,end);
  for(const cfg of [{id:'abcdefgh',key:'manager-key'},{id:'abcdefgh',admin:true}]){
    let handler,stored;
    const location={href:''};
    vm.runInNewContext(code,{document:{getElementById:()=>({addEventListener:(name,fn)=>handler=fn})},DEMO:null,loadCfg:()=>cfg,VIEW:2,sessionStorage:{setItem:(key,value)=>stored=JSON.parse(value)},sbeUserKey:x=>x,location,alert:()=>assert.fail('authorized mapping should open')});
    handler();assert.equal(location.href,'resilience-studio.html');assert.equal(stored.id,cfg.id);assert.equal(stored.round,2);assert.equal(stored.key,cfg.key||'');
  }
});
test('AE22: actual legacy institutional sessions have isolated work and mapping keys',async()=>{
  const values={institutions:[{name:'מוסד א',code:'123456',active:true},{name:'מוסד ב',code:'654321',active:true}]};
  const store={get:async key=>values[key]||null,set:async(key,value)=>values[key]=value};
  const keys=[];
  for(const code of ['123456','654321']){
    const [status,session]=await handleAccess(store,{action:'login',kind:'code',secret:code});
    assert.equal(status,200);
    keys.push(guardState('home.html',['studio'],{},session.token));
  }
  assert.notEqual(keys[0].key,keys[1].key);assert.notEqual(keys[0].handoff,keys[1].handoff);
  assert.ok(keys.every(x=>x.key!=='sbe.studio.v1:c-LEGACY'));
});

test('Denied mapping keeps the current work, while revoked Studio access locks it',async()=>{
  const ui=readFileSync(new URL('../../app/lib/resilience-studio-ui.js',import.meta.url),'utf8');
  const start=ui.indexOf('  async function api(body)'),end=ui.indexOf('  async function ensureAuthorized()',start);
  for(const code of ['mapping_forbidden','studio_forbidden']){
    let locks=0;
    const state={activity:{title:'טיוטה אישית'},brief:{goal:'מטרה'},mapping:{domains:[]},confirmed:true};
    const context={state,mappingCredentials:{id:'abcdefgh',key:'wrong'},authorized:true,API:'https://example.test/api/studio',
      token:()=>'',AbortController,setTimeout,clearTimeout,
      fetch:async()=>({ok:false,status:403,json:async()=>({code,error:'אין הרשאה'})}),
      lockWorkspace:()=>{locks++;state.activity=null;state.brief={};},
      $:()=>({checked:true}),renderMapping(){},updateControls(){},persist(){}};
    const api=vm.runInNewContext('('+ui.slice(start,end).trim()+')',context);
    await assert.rejects(api({action:'mapping'}),/אין הרשאה/);
    if(code==='mapping_forbidden'){
      assert.equal(locks,0);assert.equal(state.activity.title,'טיוטה אישית');assert.equal(state.brief.goal,'מטרה');
      assert.equal(context.mappingCredentials,null);assert.equal(state.mapping,null);assert.equal(state.confirmed,false);
    }else{assert.equal(locks,1);assert.equal(state.activity,null);}
  }
});
