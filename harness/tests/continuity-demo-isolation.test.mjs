import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../../app/lib/continuity-kit-ui.js',import.meta.url),'utf8');
const boundary=source.indexOf('// ── הטופס ──');
assert.ok(boundary>0);
// Execute the actual initialization, load and save functions. Rendering and
// provider calls are outside this storage-boundary test.
const initialized=source.slice(0,boundary)+'\nfunction drawStatus() {}\nwindow.__continuityStorage={state:()=>S,save};\n})();';
function fixture({sys=true,embedded=true,search='?demolab=1'}={}) {
  const marker='SYNTHETIC_PRIVATE_CONTINUITY',key='sbe.continuity.v2:fixture-owner';
  const stored=JSON.stringify({form:{group:marker},local:{studentsLink:'https://example.test/'+marker,letter:{name:marker},students:[{c0:marker}]}});
  const data=new Map([[key,stored]]);let reads=0,writes=0;
  const storage={getItem(k){reads++;return data.get(k)??null;},setItem(k,v){writes++;data.set(k,v);}};
  const session=new Map([['sbe.session.homeUrl',sys?'admin.html?role=sys':'home.html']]);
  const window={SBE_CONT:{},SBE_ADVISOR_SOURCES:{forAdvisor:()=>[]},sbeUserKey:k=>k+':fixture-owner'};
  window.parent=embedded?{}:window;
  vm.runInNewContext(initialized,{window,document:{getElementById:()=>({})},location:{search},URLSearchParams,
    sessionStorage:{getItem:k=>session.get(k)??null},localStorage:storage,sbeUserKey:window.sbeUserKey});
  return {api:window.__continuityStorage,data,key,marker,stored,reads:()=>reads,writes:()=>writes};
}
test('authorized embedded continuity demo never loads or overwrites an ordinary private kit',()=>{
  const f=fixture();assert.equal(f.reads(),0);assert.doesNotMatch(JSON.stringify(f.api.state()),new RegExp(f.marker));
  f.api.state().form.group='synthetic demo group';f.api.save();
  assert.equal(f.writes(),0);assert.equal(f.data.get(f.key),f.stored);
});
for(const [name,options] of [['standalone',{embedded:false}],['non-admin',{sys:false}],['ordinary embedded',{search:''}]]) {
  test(name+' continuity uses its ordinary owner store rather than broadening demo isolation',()=>{
    const f=fixture(options);assert.equal(f.reads(),1);assert.match(JSON.stringify(f.api.state()),new RegExp(f.marker));
    f.api.state().form.group='ordinary human edit';f.api.save();
    assert.equal(f.writes(),1);assert.equal(JSON.parse(f.data.get(f.key)).form.group,'ordinary human edit');
  });
}
