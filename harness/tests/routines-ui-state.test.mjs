import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const read=name=>readFileSync(new URL('../../app/lib/'+name,import.meta.url),'utf8');
const uiSource=read('routines-ui.js'),demoSource=read('demo-hook.js');
const key='sbe.routines.v1:synthetic-owner';
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
    this.classList={toggle:(name,on)=>{const yes=on===undefined?!classes.split(/\s+/).includes(name):on;classes=classes.split(/\s+/).filter(x=>x&&x!==name).concat(yes?[name]:[]).join(' ');return yes;},contains:name=>classes.split(/\s+/).includes(name),add:(...names)=>{classes=[...new Set(classes.split(/\s+/).filter(Boolean).concat(names))].join(' ');}};
  }
  append(...nodes){nodes.flat().forEach(value=>{const n=typeof value==='object'?value:new TextNode(value);n.remove();n.parentNode=this;this.childNodes.push(n);});}
  appendChild(node){this.append(node);return node;}
  get lastChild(){return this.childNodes.at(-1)||null;}
  focus(){} scrollIntoView(){}
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
  async click(){if(this.disabled)return;if(this.tagName==='SUMMARY'&&this.parentNode?.tagName==='DETAILS'){this.parentNode.open=!this.parentNode.open;await this.parentNode.fire('toggle');}await this.fire('click');}
  querySelectorAll(selector){return all(this).filter(n=>matches(n,selector));}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  closest(selector){for(let n=this;n;n=n.parentNode)if(matches(n,selector))return n;return null;}
  replaceWith(node){const parent=this.parentNode;if(!parent)return;const index=parent.childNodes.indexOf(this);node.remove();node.parentNode=parent;parent.childNodes[index]=node;this.parentNode=null;}
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

const plan=title=>({title,action:{name:title,purpose:'ננסה פעולה שלנו',when:'כל שבוע'},board:[{task:'נכין לוח',role:'אחראי/ת',backup:'מגבה',when:'ראשון',done:'לוח מוכן'}],roles:[{role:'אחראי/ת',does:'מכין/ה לוח'}],agreement:{what:'אנחנו מכינים לוח'},run:[{part:'פתיחה',what:'פותחים יחד',lead:'אחראי/ת',minutes:2}],after:[],resilience:[],skills:[],sources:[]});
const run=()=>({date:'',status:{},worked:'',hard:'',next:'',reqs:[]});
function item(id,{ready=false,chosen=false}={}){return {id,step:ready?4:1,form:{mechType:'לוח עזרה',purpose:'מטרה '+id,future:'עתיד '+id,chosen:chosen?'פעולה '+id:''},options:null,choose:null,pick:'',how:'הסכמה בשיחה',plan:ready?plan(id):null,version:ready?2:0,at:'11.10.26',people:{'אחראי/ת':{who:'SYNTHETIC_PRIVATE_CHILD_NAME',backup:'SYNTHETIC_PRIVATE_CONTACT',ok:true}},runs:[run(),run()],decided:{},proposal:null,changes:[],ansAI:[],balance:'',versions:[{v:2,at:'11.10.26',by:'SYNTHETIC_PRIVATE_APPROVER',note:'היסטוריה שלנו'}],log:[{d:'11.10.26',what:'החלטה קיימת',how:'שיחה',who:'SYNTHETIC_PRIVATE_CHILD_NAME'}],rounds:[{version:1,runs:[]}],reviewDate:'2026-10-25'};}
const options=tag=>({options:[{name:tag+' אחת',what:'נכין יחד'},{name:tag+' שתיים',what:'נלמד יחד'}],choose:{how:'שיחה'},sources:[]});
function fixture({items=[item('A'),item('B',{ready:true})],demo=false,embedded=true,admin=true,query='1',home='admin.html?role=sys',fail=false,deferred=false}={}){
  const data=new Map([[key,JSON.stringify({items:plain(items),cur:items[0].id})],['sbe.studio.v1:synthetic-owner',JSON.stringify({state:{activity:{title:'SYNTHETIC_PRIVATE_STUDIO',socialMechanism:{type:'board',name:'SYNTHETIC_PRIVATE_STUDIO_MECHANISM'}}}})]]);
  const root=new Element('html'),head=new Element('head'),body=new Element('body');root.append(head,body);
  const html=readFileSync(new URL('../../app/routines-hub.html',import.meta.url),'utf8');
  for(const [,tag,attrs,id]of html.matchAll(/<([a-z][\w-]*)\b([^>]*?\bid="([^"]+)"[^>]*)>/gi)){
    const n=new Element(tag);n.id=id;if(/\bhidden\b/.test(attrs))n.hidden=true;
    for(const [,k,v]of attrs.matchAll(/(data-[\w-]+|type|class)="([^"]*)"/g)){if(k==='type')n.type=v;else if(k==='class')n.className=v;else n.dataset[k.slice(5)]=v;}
    body.append(n);
  }
  const document={body,head,documentElement:root,readyState:'loading',createElement:tag=>new Element(tag),createTextNode:text=>new TextNode(text),getElementById:id=>all(root).find(n=>n.id===id)||null,querySelector:s=>root.querySelector(s),querySelectorAll:s=>root.querySelectorAll(s)};
  let reads=0,writes=0,clock=0;const calls=[],pending=[];
  const storage={getItem(k){reads++;return data.get(k)??null;},setItem(k,v){writes++;data.set(k,v);}};
  const window={sbeUserKey:k=>k+':synthetic-owner',SBE_ADVISOR_SOURCES:{forAdvisor:()=>[]},addEventListener(){},scrollTo(){},
    sbeCallAIJson:async(_origin,request,_timeout,check)=>{calls.push(plain(request));if(fail)throw new Error('synthetic provider failure');
      if(deferred)return new Promise((resolve,reject)=>pending.push({resolve:value=>{assert.equal(check(value),true);resolve(plain(value));},reject}));
      const result=plan('תוצר סינתטי של הדמו');assert.equal(check(result),true);return plain(result);}};
  window.parent=embedded?{postMessage(){}}:window;
  class FixtureDate extends Date{static now(){return clock+=100000;}}
  const context=vm.createContext({window,self:window,document,Node:Element,localStorage:storage,sessionStorage:{getItem:k=>k==='sbe.session.homeUrl'?(admin?home:'home.html'):null},location:{search:demo?'?demolab='+query:'',pathname:'/routines-hub.html',href:'https://example.test/routines-hub.html',origin:'https://example.test'},URLSearchParams,Map,WeakMap,Date:FixtureDate,Option:class extends Element{constructor(text,value){super('option');this.textContent=text;this.value=value;}},Event:class{constructor(type){this.type=type;}},sbeUserKey:window.sbeUserKey,confirm:()=>true,alert(){},console:{warn(){}},setTimeout:fn=>{queueMicrotask(fn);return 1;},clearTimeout(){},setInterval:()=>1,clearInterval(){}});
  for(const file of ['routines-model.js','report-table.js'])vm.runInContext(read(file),context,{filename:file});context.SBE_TABLE=window.SBE_TABLE;
  vm.runInContext(uiSource,context,{filename:'routines-ui.js'});
  if(demo&&embedded&&admin&&query==='1'&&home==='admin.html?role=sys'){
    const at=demoSource.lastIndexOf('\n})();');vm.runInContext(demoSource.slice(0,at)+'\nwindow.__routinesDemo={recipe:RECIPES[page],inputSummary,standalone};\n'+demoSource.slice(at),context,{filename:'demo-hook.js'});
  }
  return {document,data,calls,pending,window,reads:()=>reads,writes:()=>writes,state:()=>JSON.parse(data.get(key)),f:id=>document.getElementById(id),
    select:async id=>{const i=JSON.parse(data.get(key)).items.findIndex(x=>x.id===id);await document.getElementById('hub').querySelectorAll('button.mech')[i].click();},
    button:text=>document.querySelectorAll('button').find(n=>n.textContent===text)};
}
const absent=value=>assert.doesNotMatch(String(value),/SYNTHETIC_PRIVATE/);

for(const operation of ['options','build','revise'])test(operation+' completion belongs to A after switching to B and preserves all B data',async()=>{
  const a=item('A',{ready:operation==='revise',chosen:operation==='build'});if(operation==='revise')a.runs[0].worked='פעלנו יחד';
  const f=fixture({items:[a,item('B',{ready:true})],deferred:true}),before=plain(f.state().items[1]);
  const completion=f.f(operation==='revise'?'revise':'go').click();assert.equal(f.calls.length,1);await f.select('B');
  f.pending[0].resolve(operation==='options'?options('A חזרה'):plan('A חזרה'));await completion;
  const after=f.state();assert.equal(after.cur,'B');assert.deepEqual(after.items[1],before);
  if(operation==='options')assert.equal(after.items[0].options[0].name,'A חזרה אחת');
  else assert.equal(after.items[0][operation==='build'?'plan':'proposal'].title,'A חזרה');
  assert.match(f.f('out4').textContent,/B/);assert.doesNotMatch(f.f('out4').textContent,/A חזרה/);
});

for(const operation of ['options','build','revise'])test(operation+' cannot resurrect deleted A or replace B after a deferred result',async()=>{
  const a=item('A',{ready:operation==='revise',chosen:operation==='build'});if(operation==='revise')a.runs[0].worked='ניסוי';
  const f=fixture({items:[a,item('B',{ready:true})],deferred:true}),before=plain(f.state().items[1]);
  const completion=f.f(operation==='revise'?'revise':'go').click();await f.f('delItem').click();
  f.pending[0].resolve(operation==='options'?options('נמחק'):plan('נמחק'));await completion;
  assert.deepEqual(f.state().items,[before]);assert.equal(f.state().cur,'B');
});

for(const operation of ['options','build','revise'])test(operation+' discards a result after its initiating inputs change and permits a fresh request',async()=>{
  const a=item('A',{ready:operation==='revise',chosen:operation==='build'});if(operation==='revise')a.runs[0].worked='ניסוי';
  const f=fixture({items:[a],deferred:true});const completion=f.f(operation==='revise'?'revise':'go').click();
  if(operation==='revise'){const note=f.document.querySelector('[aria-label="החלטה"]')||f.document.querySelector('[aria-label="מה הוחלט"]');if(note){note.value='החלטה חדשה';await note.fire('input');}else{await f.f('example').click();}}
  else{const input=f.f('f-purpose');input.value='מטרה מעודכנת';await input.fire('input');}
  f.pending[0].resolve(operation==='options'?options('מיושן'):plan('מיושן'));await completion;
  const current=f.state().items[0];assert.doesNotMatch(JSON.stringify(current),/מיושן/);
  const fresh=f.f(operation==='revise'?'revise':'go').click();assert.equal(f.calls.length,2);f.pending[1].resolve(operation==='options'?options('עדכני'):plan('עדכני'));await fresh;
});

test('request lock survives A to B to A redraw, including the recreated options build button',async()=>{
  const a=item('A');a.options=options('קודם').options;a.pick='0';
  const f=fixture({items:[a,item('B',{ready:true})],deferred:true});const original=f.button('בניית לוח הביצוע וההסכם');const completion=original.click();
  await f.select('B');await f.select('A');const replacement=f.button('בניית לוח הביצוע וההסכם');assert.notEqual(replacement,original);assert.equal(replacement.disabled,true);
  await replacement.click();await f.f('go').click();assert.equal(f.calls.length,1);f.pending[0].resolve(plan('הגרסה שלנו'));await completion;assert.equal(f.f('go').disabled,false);
});

test('switching to B lets its own request finish first without A clearing B pending controls',async()=>{
  const f=fixture({items:[item('A'),item('B')],deferred:true});const ca=f.f('go').click();await f.select('B');assert.equal(f.f('go').disabled,false);const cb=f.f('go').click();
  f.pending[0].resolve(options('A'));await ca;assert.equal(f.f('go').disabled,true);assert.equal(f.f('wait1').hidden,false);
  f.pending[1].resolve(options('B'));await cb;assert.equal(f.f('go').disabled,false);assert.equal(f.state().items[1].options[0].name,'B אחת');
});

test('revision includes anonymized human decisions and journal while approval stays human owned',async()=>{
  const a=item('A',{ready:true});a.runs[0].worked='עבדנו יחד';a.runs[0].reqs=[{role:'אחראי/ת',what:'נרחיב לוח',why:'יותר מקום'},{role:'מגבה',what:'נחליף יום',why:'זמן נוח'}];
  const f=fixture({items:[a],deferred:true});
  const statuses=f.document.querySelectorAll('select[aria-label="מה הוחלט"]'),notes=f.document.querySelectorAll('input[aria-label="הערה להחלטה"]');
  for(const [i,status,note]of [[0,'לא הפעם','SYNTHETIC_REJECTED_NOTE אצל SYNTHETIC_PRIVATE_CHILD_NAME'],[1,'הותאמה','SYNTHETIC_ADAPTED_NOTE עם SYNTHETIC_PRIVATE_CONTACT']]){statuses[i].value=status;await statuses[i].fire('change');notes[i].value=note;await notes[i].fire('input');}
  const journal=f.document.querySelector('textarea[aria-label="מה הוחלט"]');journal.value='SYNTHETIC_JOURNAL_NOTE עבור SYNTHETIC_PRIVATE_CHILD_NAME';await journal.fire('input');
  const before=plain(f.state().items[0]);const completion=f.f('revise').click(),request=f.calls[0];
  for(const token of ['לא הפעם','הותאמה','SYNTHETIC_REJECTED_NOTE','SYNTHETIC_ADAPTED_NOTE','SYNTHETIC_JOURNAL_NOTE'])assert.match(request.messages[0].content,new RegExp(token));
  absent(request.messages[0].content);assert.match(request.system,/החלטות.*אנוש|החלטות.*הקבוצה/);assert.match(request.system,/לבחון מחדש|לשקול מחדש/);
  f.pending[0].resolve(plan('הצעה שלנו'));await completion;const after=f.state().items[0];assert.deepEqual(after.decided,before.decided);assert.deepEqual(after.log,before.log);assert.deepEqual(after.plan,before.plan);assert.equal(after.version,before.version);assert.equal(after.proposal.title,'הצעה שלנו');
});

test('a decision edited during revision is preserved and invalidates the older proposal',async()=>{
  const a=item('A',{ready:true});a.runs[0].reqs=[{role:'אחראי/ת',what:'נרחיב לוח'}];
  const f=fixture({items:[a],deferred:true}),completion=f.f('revise').click();
  const note=f.document.querySelector('input[aria-label="הערה להחלטה"]');note.value='הסבר מעודכן שלנו';await note.fire('input');
  f.pending[0].resolve(plan('הצעה מיושנת'));await completion;assert.equal(f.state().items[0].proposal,null);assert.equal(f.state().items[0].decided['0-0'].note,'הסבר מעודכן שלנו');assert.equal(f.f('revise').disabled,false);
});

test('a change then restoration still invalidates the earlier request revision',async()=>{
  const f=fixture({items:[item('A')],deferred:true}),completion=f.f('go').click(),purpose=f.f('f-purpose'),original=purpose.value;
  purpose.value='מטרה חדשה זמנית';await purpose.fire('input');purpose.value=original;await purpose.fire('input');
  f.pending[0].resolve(options('תוצאה ישנה'));await completion;assert.equal(f.state().items[0].options,null);assert.equal(f.state().items[0].form.purpose,original);
});

test('the old provider failure does not expose an error or release B request lock',async()=>{
  const f=fixture({items:[item('A'),item('B')],deferred:true}),ca=f.f('go').click();await f.select('B');const cb=f.f('go').click();
  f.pending[0].reject(new Error('synthetic late failure'));await ca;assert.equal(f.f('go').disabled,true);assert.equal(f.f('err1').hidden,true);assert.equal(f.f('wait1').hidden,false);
  f.pending[1].resolve(options('B'));await cb;assert.equal(f.f('go').disabled,false);
});

for(const fail of [false,true])test((fail?'failed':'successful')+' actual routines demo recipe uses fresh memory without private read, write, import, request or capture',async()=>{
  const f=fixture({items:[item('A',{ready:true})],demo:true,fail}),before=new Map(f.data);
  if(fail)await assert.rejects(f.window.__routinesDemo.recipe(),/אין כרגע חיבור|הזמן עבר/);
  else{const products=await f.window.__routinesDemo.recipe();assert.equal(products.length,1);assert.equal(products[0].tool,'routines');assert.match(products[0].html,/תוצר סינתטי/);absent(JSON.stringify(products));}
  assert.equal(f.calls.length,1);assert.equal(f.reads(),0);assert.equal(f.writes(),0);assert.deepEqual(f.data,before);assert.equal(f.f('fromStudio').hidden,true);
  absent(JSON.stringify(f.calls));absent(f.window.__routinesDemo.inputSummary());absent(f.window.__routinesDemo.standalone(f.f('out2'),'התוצר שלנו'));
});

for(const [label,gates]of [['no demo',{demo:false}],['standalone',{demo:true,embedded:false}],['non-admin',{demo:true,admin:false}],['inexact demo',{demo:true,query:'01'}],['inexact home',{demo:true,home:'admin.html?role=sys&extra=1'}]])test(label+' keeps ordinary workspace and Studio reads, persistent edits and reload',async()=>{
  const f=fixture(gates);assert.equal(f.reads(),2);assert.equal(f.f('fromStudio').hidden,false);assert.match(f.f('f-purpose').value,/מטרה A/);
  const purpose=f.f('f-purpose');purpose.value='הנוסח האישי שלנו';await purpose.fire('input');assert.equal(f.state().items[0].form.purpose,purpose.value);assert.ok(f.writes()>0);
  await f.f('fromStudio').click();assert.match(f.state().items[0].form.chosen,/SYNTHETIC_PRIVATE_STUDIO_MECHANISM/);
  const reopened=fixture({...gates,items:f.state().items});assert.equal(reopened.f('f-purpose').value,'הנוסח האישי שלנו');assert.match(reopened.f('f-chosen').value,/SYNTHETIC_PRIVATE_STUDIO_MECHANISM/);
});
