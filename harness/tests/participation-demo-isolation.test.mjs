import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const read=name=>readFileSync(new URL('../../app/lib/'+name,import.meta.url),'utf8');
const uiSource=read('participation-ui.js'),demoSource=read('demo-hook.js');
const modes=['single','seq'];
const key=mode=>'sbe.paths.v1:synthetic-owner.'+mode;
const plain=value=>JSON.parse(JSON.stringify(value));
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// The DOM/event fixture follows continuity-kit-ui.test.mjs. Product state,
// rendering, model validation, the demo recipe and capture run from real files.
class TextNode {
  constructor(text){this.nodeType=3;this.textContent=String(text);this.parentNode=null;}
  remove(){if(this.parentNode)this.parentNode.childNodes=this.parentNode.childNodes.filter(n=>n!==this);this.parentNode=null;}
  cloneNode(){return new TextNode(this.textContent);}
  get outerHTML(){return escape(this.textContent);}
}
class Element {
  constructor(tag){
    this.nodeType=1;this.tagName=tag.toUpperCase();this.childNodes=[];this.attrs=new Map();this.listeners=new Map();this.parentNode=null;this.style={};this.disabled=false;this.value='';this.dataset={};this.open=false;
    let classes='';
    Object.defineProperty(this,'className',{get:()=>classes,set:value=>{classes=String(value);}});
    this.classList={contains:name=>classes.split(/\s+/).includes(name),add:(...names)=>{classes=[...new Set(classes.split(/\s+/).filter(Boolean).concat(names))].join(' ');}};
  }
  append(...nodes){nodes.flat().forEach(value=>{const n=typeof value==='object'?value:new TextNode(value);n.remove();n.parentNode=this;this.childNodes.push(n);});}
  appendChild(node){this.append(node);return node;}
  get children(){return this.childNodes.filter(n=>n.nodeType===1);}
  get textContent(){return this.childNodes.map(n=>n.textContent).join('');}
  set textContent(value){this.childNodes.forEach(n=>n.parentNode=null);this.childNodes=[];if(value)this.append(new TextNode(value));}
  get innerText(){return this.textContent;}
  get hidden(){return this.attrs.has('hidden');}set hidden(value){if(value)this.attrs.set('hidden','');else this.attrs.delete('hidden');}
  setAttribute(k,v){if(k==='class')this.className=v;else if(k==='id')this.id=String(v);else this.attrs.set(k,String(v));}
  getAttribute(k){return k==='class'?this.className||null:k==='id'?this.id||null:k==='type'?this.type??null:this.attrs.get(k)??null;}
  removeAttribute(k){if(k==='class')this.className='';else this.attrs.delete(k);}
  get options(){return this.children.filter(n=>n.tagName==='OPTION');}
  addEventListener(type,fn){const listeners=this.listeners.get(type)||[];listeners.push(fn);this.listeners.set(type,listeners);}
  async fire(type,extra={}){for(const fn of this.listeners.get(type)||[])await fn({target:this,...extra});}
  dispatchEvent(event){return this.fire(event.type,event);}
  async click(){if(this.tagName==='SUMMARY'&&this.parentNode?.tagName==='DETAILS'){this.parentNode.open=!this.parentNode.open;await this.parentNode.fire('toggle');}await this.fire('click');}
  querySelectorAll(selector){return all(this).filter(n=>matches(n,selector));}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  closest(selector){for(let n=this;n;n=n.parentNode)if(matches(n,selector))return n;return null;}
  remove(){if(this.parentNode)this.parentNode.childNodes=this.parentNode.childNodes.filter(n=>n!==this);this.parentNode=null;}
  cloneNode(deep=false){const n=new Element(this.tagName);n.className=this.className;n.id=this.id;n.value=this.value;n.type=this.type;n.checked=this.checked;n.open=this.open;for(const [k,v]of this.attrs)n.setAttribute(k,v);if(deep)n.append(...this.childNodes.map(c=>c.cloneNode(true)));return n;}
  get outerHTML(){const attrs=new Map(this.attrs);if(this.className)attrs.set('class',this.className);if(this.id)attrs.set('id',this.id);return '<'+this.tagName.toLowerCase()+[...attrs].map(([k,v])=>' '+k+'="'+escape(v)+'"').join('')+'>'+this.childNodes.map(n=>n.outerHTML).join('')+'</'+this.tagName.toLowerCase()+'>';}
}
const all=root=>root.childNodes.flatMap(n=>n.nodeType===1?[n,...all(n)]:[]);
function simple(node,selector){
  if(node.nodeType!==1)return false;
  const not=/:not\(([^)]+)\)/.exec(selector);if(not){if(simple(node,not[1]))return false;selector=selector.replace(not[0],'');}
  for(const [,k,v]of selector.matchAll(/\[([^=\]]+)(?:=["']?([^"'\]]+)["']?)?\]/g)){if(v!==undefined?node.getAttribute(k)!==v:node.getAttribute(k)===null)return false;}
  const rest=selector.replace(/\[[^\]]+\]/g,''),tag=/^[a-z][\w-]*/i.exec(rest)?.[0];if(tag&&node.tagName!==tag.toUpperCase())return false;
  const id=/#([\w-]+)/.exec(rest)?.[1];if(id&&node.id!==id)return false;
  return [...rest.matchAll(/\.([\w-]+)/g)].every(([,name])=>node.classList.contains(name));
}
function matches(node,selector){return selector.split(',').some(part=>{const tokens=part.trim().split(/\s+(?![^\[]*\])/);if(!simple(node,tokens.pop()))return false;let p=node.parentNode;while(tokens.length){const wanted=tokens.pop();while(p&&!simple(p,wanted))p=p.parentNode;if(!p)return false;p=p.parentNode;}return true;});}

function privateRecord(mode){const marker='SYNTHETIC_PRIVATE_'+mode.toUpperCase();return {
  must:marker+'_GOAL',choose:marker+'_CHOICE',open:true,cur:0,
  cards:[{name:marker+'_SELECTED_CARD',mode:'בזוג',how:marker+'_CONTACT',crit:marker+'_CRITERION',on:true,ok:true}],
  obs:{[marker+'_SELECTED_CARD']:{count:'7',ev:'כן',cond:marker+'_OBSERVATION_CONTACT'}},
  lessons:[{label:marker+'_LESSON',offered:[marker+'_SELECTED_CARD'],used:{[marker+'_SELECTED_CARD']:7},decision:marker+'_LESSON_DECISION'}]
};}
function fixture({demo=true,embedded=true,admin=true,fail=false,data=new Map(modes.map(mode=>[key(mode),JSON.stringify(privateRecord(mode))]))}={}){
  const root=new Element('html'),head=new Element('head'),body=new Element('body');root.append(head,body);
  const goal=new Element('input');goal.id='i-goal';goal.type='text';body.append(goal);
  const nodes={};for(const mode of modes){const n=new Element('div');n.id=mode==='single'?'pathsSingle':'pathsSeq';body.append(n);nodes[mode]=n;}
  const document={body,head,documentElement:root,readyState:'loading',createElement:tag=>new Element(tag),createTextNode:text=>new TextNode(text),getElementById:id=>all(root).find(n=>n.id===id)||null,querySelector:s=>root.querySelector(s),querySelectorAll:s=>root.querySelectorAll(s)};
  let reads=0,writes=0,clock=0;const calls=[];
  const storage={getItem(k){reads++;return data.get(k)??null;},setItem(k,v){writes++;data.set(k,v);}};
  const window={sbeUserKey:k=>k+':synthetic-owner',SBE_ADVISOR_SOURCES:{forAdvisor:()=>[]},addEventListener(){},
    sbeCallAIJson:async(_origin,request,_timeout,check)=>{calls.push(plain(request));if(fail)throw new Error('synthetic provider failure');
      const result={must:'נציג ראיה להבנה שלנו',choose:'נבחר דרך להראות הבנה',cards:['דרך סינתטית א','דרך סינתטית ב','דרך סינתטית ג'].map((name,i)=>({name,mode:i?'בזוג':'לבד',how:'נציג רעיון משלנו',evidence:'ננמק את הרעיון'})),sources:[]};assert.equal(check(result),true);return plain(result);}};
  window.parent=embedded?{postMessage(){}}:window;
  class FixtureDate extends Date{static now(){return clock+=100000;}}
  const context=vm.createContext({window,self:window,document,Node:Element,localStorage:storage,sessionStorage:{getItem:k=>k==='sbe.session.homeUrl'?(admin?'admin.html?role=sys':'home.html'):null},location:{search:demo?'?demolab=1&part=paths':'?part=paths',pathname:'/activity-planner.html',href:'https://example.test/activity-planner.html',origin:'https://example.test'},URLSearchParams,Map,Date:FixtureDate,Option:class extends Element{constructor(text,value){super('option');this.textContent=text;this.value=value;}},Event:class{constructor(type){this.type=type;}},sbeUserKey:window.sbeUserKey,SAMPLE:{goal:'מטרה סינתטית של מעבדת הדמו'},console:{warn(){}},setTimeout:fn=>{queueMicrotask(fn);return 1;},clearTimeout(){},setInterval:()=>1,clearInterval(){}});
  for(const file of ['participation-model.js','report-table.js'])vm.runInContext(read(file),context,{filename:file});
  context.SBE_TABLE=window.SBE_TABLE;
  vm.runInContext(uiSource,context,{filename:'participation-ui.js'});
  const mount=mode=>window.SBE_PATHS_UI.mount(nodes[mode],{mode,context:()=>({goal:goal.value,topic:goal.value,sessions:['מפגש סינתטי ראשון','מפגש סינתטי שני']})});
  modes.forEach(mount);
  const at=demoSource.lastIndexOf('\n})();');
  vm.runInContext(demoSource.slice(0,at)+'\nwindow.__pathsDemo={recipe:RECIPES[page],inputSummary,standalone};\n'+demoSource.slice(at),context,{filename:'demo-hook.js'});
  return {window,document,data,nodes,calls,mount,reads:()=>reads,writes:()=>writes,
    box:mode=>nodes[mode].querySelector('details.paths'),
    button:(mode,text)=>nodes[mode].querySelectorAll('button').find(n=>n.textContent.includes(text)),
    input:(mode,label)=>nodes[mode].querySelector('[aria-label="'+label+'"]')};
}
const privateAbsent=value=>assert.doesNotMatch(String(value),/SYNTHETIC_PRIVATE/);

for(const fail of [false,true])test((fail?'failed':'successful')+' actual participation demo recipe never reads, writes or captures either private workspace',async()=>{
  const f=fixture({fail}),before=new Map(f.data);
  if(fail)await assert.rejects(f.window.__pathsDemo.recipe(),/הזמן עבר|מסלולי ההשתתפות|אין כרגע חיבור/);
  else{const items=await f.window.__pathsDemo.recipe();assert.equal(items.length,1);assert.equal(items[0].tool,'paths');assert.match(items[0].html,/דרך סינתטית/);privateAbsent(JSON.stringify(items));}
  assert.equal(f.calls.length,1);assert.equal(f.reads(),0);assert.equal(f.writes(),0);assert.deepEqual(f.data,before);
  privateAbsent(JSON.stringify(f.calls));privateAbsent(f.window.__pathsDemo.inputSummary());
  for(const mode of modes)privateAbsent(f.window.__pathsDemo.standalone(f.nodes[mode],'מסלולי השתתפות'));
});

for(const mode of modes)test(mode+' demo edits and lesson tracking stay in fresh instance memory across remounts',async()=>{
  const f=fixture(),before=new Map(f.data);assert.equal(f.box(mode).open,false);
  await f.box(mode).querySelector('summary').click();
  const cardName=f.window.SBE_PATHS.CATALOG[0].n;await f.button(mode,'➕ '+cardName).click();
  const wording=f.input(mode,'מה כולם מדגימים');wording.value='ניסוח סינתטי זמני';await wording.fire('input');
  const count=f.input(mode,'כמה בחרו: '+cardName);count.value='3';await count.fire('input');
  const cond=f.input(mode,'מה אפשר או עיכב: '+cardName);cond.value='תנאי השתתפות סינתטיים';await cond.fire('input');
  await f.button(mode,'במעקב').click();assert.ok(f.nodes[mode].querySelector('.ptrack'));assert.match(f.nodes[mode].textContent,/שיעור 1|מפגש 1/);
  assert.equal(f.reads(),0);assert.equal(f.writes(),0);assert.deepEqual(f.data,before);
  // A new mount uses new memory, rather than an owner-keyed demo residue.
  f.nodes[mode].textContent='';f.mount(mode);assert.equal(f.box(mode).open,false);
  await f.box(mode).querySelector('summary').click();assert.equal(f.nodes[mode].querySelector('.pcard'),null);assert.equal(f.nodes[mode].querySelector('.ptrack'),null);
  assert.equal(f.reads(),0);assert.equal(f.writes(),0);assert.deepEqual(f.data,before);
});

for(const [name,options] of [['standalone',{embedded:false}],['non-admin',{admin:false}],['ordinary embedded',{demo:false}]])test(name+' participation keeps ordinary owner reads and persistent edits in both modes',async()=>{
  const f=fixture(options);assert.equal(f.reads(),2);
  for(const mode of modes){assert.match(f.nodes[mode].textContent,/SYNTHETIC_PRIVATE/);const must=f.input(mode,'מה כולם מדגימים');must.value='ניסוח אישי רגיל '+mode;await must.fire('input');assert.equal(JSON.parse(f.data.get(key(mode))).must,must.value);}
  assert.equal(f.writes(),2);
  for(const mode of modes){f.nodes[mode].textContent='';f.mount(mode);assert.equal(f.input(mode,'מה כולם מדגימים').value,'ניסוח אישי רגיל '+mode);}
  assert.equal(f.reads(),4);
});
function heldParticipation(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
const routesReply={must:'מטרה סינתטית חדשה',choose:'בחירה סינתטית חדשה',cards:['הצעה א','הצעה ב','הצעה ג'].map(name=>({name,how:'נציג ראיה יחד',mode:'בזוג'})),sources:[]};

test('participation suggestion keeps one mount-owned lock after closing and reopening',async t=>{
  const f=fixture({demo:false}),late=heldParticipation();t.after(()=>late.resolve(routesReply));
  f.document.getElementById('i-goal').value='המטרה המשותפת';let calls=0;
  f.window.sbeCallAIJson=async()=>{calls++;return late.promise;};
  const pending=f.button('single','הצעה חדשה למטרה').click();assert.equal(calls,1);
  await f.box('single').querySelector('summary').click();await f.box('single').querySelector('summary').click();
  const rebuilt=f.button('single','הצעה חדשה למטרה');assert.equal(rebuilt.disabled,true);
  await rebuilt.click();assert.equal(calls,1);
  late.resolve(routesReply);await pending;
  assert.equal(f.button('single','הצעה חדשה למטרה').disabled,false);assert.match(f.nodes.single.textContent,/הצעה א/);
});

test('participation adjustment locks recreated controls and unlocks after a provider failure',async t=>{
  const f=fixture({demo:false}),late=heldParticipation();t.after(()=>late.resolve(null));let calls=0;
  f.document.getElementById('i-goal').value='המטרה המשותפת';
  f.window.sbeCallAIJson=async()=>{calls++;await late.promise;throw new Error('synthetic failure');};
  const pending=f.button('single','הצעת התאמה').click();assert.equal(calls,1);
  await f.box('single').querySelector('summary').click();await f.box('single').querySelector('summary').click();
  const rebuilt=f.button('single','הצעת התאמה');assert.equal(rebuilt.disabled,true);
  await rebuilt.click();assert.equal(calls,1);
  late.resolve(null);await pending;
  assert.equal(f.button('single','הצעת התאמה').disabled,false);
  assert.match(f.nodes.single.textContent,/אין כרגע חיבור|לא הצלחנו/);
});

test('a participation suggestion for a previous sequence meeting cannot replace the selected meeting',async t=>{
  const f=fixture({demo:false}),late=heldParticipation();t.after(()=>late.resolve(routesReply));
  f.document.getElementById('i-goal').value='המטרה המשותפת';
  f.window.sbeCallAIJson=async()=>late.promise;
  const pending=f.button('seq','הצעה חדשה למטרה').click();
  const meeting=f.input('seq','המפגש');meeting.value='1';await meeting.fire('change');
  late.resolve(routesReply);await pending;
  const stored=JSON.parse(f.data.get(key('seq')));assert.equal(stored.cur,1);assert.equal(stored.must,privateRecord('seq').must);
  assert.equal(f.button('seq','הצעה חדשה למטרה').disabled,false);
});

test('an adjustment for observations already saved as a lesson cannot re-enter the next lesson',async t=>{
  const f=fixture({demo:false}),late=heldParticipation();t.after(()=>late.resolve({options:[{name:'התאמה ישנה'}]}));
  f.document.getElementById('i-goal').value='המטרה המשותפת';
  f.window.sbeCallAIJson=async()=>late.promise;
  const pending=f.button('single','הצעת התאמה').click();
  await f.button('single','במעקב').click();
  late.resolve({options:[{name:'התאמה ישנה'}]});await pending;
  const stored=JSON.parse(f.data.get(key('single')));assert.equal(stored.lessons.length,2);
  assert.deepEqual(stored.obs,{});assert.equal(stored.adjust,null);
  assert.doesNotMatch(f.nodes.single.textContent,/התאמה ישנה/);
});
