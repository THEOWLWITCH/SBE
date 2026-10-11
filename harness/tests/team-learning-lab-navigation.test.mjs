import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const guard = readFileSync(new URL('../../app/lib/access-guard.js', import.meta.url), 'utf8');
function pageAccess(page, home, permissions) {
  const data = new Map([['sbe.session.homeUrl', home], ['sbe.session.perms', JSON.stringify(permissions)]]);
  const storage = {getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};
  const root = {style:{},classList:{add(){}}};
  let redirected = '';
  vm.runInNewContext(guard, {window:{},sessionStorage:storage,localStorage:{getItem:()=>null,setItem(){},removeItem(){}},
    document:{documentElement:root,head:{appendChild(){}},createElement:()=>({})},
    location:{pathname:'/'+page,search:'',replace:value=>redirected=value},URLSearchParams,TextDecoder,Uint8Array,atob});
  return {visible:root.style.display!=='none',redirected};
}

test('Team learning lab extends Nana without granting Studio or Writer access', () => {
  assert.equal(pageAccess('team-learning-lab.html','home.html',['nana']).visible,true);
  assert.equal(pageAccess('team-learning-lab.html','admin.html?role=sys',[]).visible,true);
  for (const permission of ['activity','studio','writer','resilience','practi','leadership','academic','journey']) {
    const result = pageAccess('team-learning-lab.html','home.html',[permission]);
    assert.equal(result.visible,false,permission);
    assert.equal(result.redirected,'home.html');
  }
  assert.equal(pageAccess('resilience-studio.html','home.html',['nana']).visible,false);
  assert.equal(pageAccess('message-writer.html','home.html',['nana']).visible,false);
  assert.equal(pageAccess('team-learning-lab.html','',[]).redirected,'entry.html');
});
