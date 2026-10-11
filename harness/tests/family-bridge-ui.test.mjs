import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const read=name=>readFileSync(new URL('../../app/lib/'+name,import.meta.url),'utf8');
const uiSource=read('family-bridge-ui.js'),demoSource=read('demo-hook.js');

const key='sbe.bridge.v1:synthetic-owner';
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
    this.classList={contains:name=>classes.split(/\s+/).includes(name),add:(...names)=>{classes=[...new Set(classes.split(/\s+/).filter(Boolean).concat(names))].join(' ');},toggle:(name,on)=>{const values=new Set(classes.split(/\s+/).filter(Boolean));if(on)values.add(name);else values.delete(name);classes=[...values].join(' ');}};
  }
  append(...nodes){nodes.flat().forEach(value=>{const n=typeof value==='object'?value:new TextNode(value);n.remove();n.parentNode=this;this.childNodes.push(n);});}
  appendChild(node){this.append(node);return node;}
  prepend(...nodes){const existing=[...this.childNodes];this.childNodes=[];this.append(...nodes,...existing);}
  replaceWith(node){const parent=this.parentNode;if(!parent)return;const i=parent.childNodes.indexOf(this);this.remove();node.remove();node.parentNode=parent;parent.childNodes.splice(i,0,node);}
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

const plan=(title='סבב סינתטי')=>({title,goal:{text:'נבנה דרך קשר שלנו',why:'נשמור על קשר',sign:'נקודת קשר'},ways:[{name:'הודעה',what:'עדכון קצר'},{name:'שיחה',what:'שיחה קצרה'}],school:{what:'פגישה בכיתה'},card:{greeting:'שלום למשפחה',goal:'נבחר דרך קשר',intro:'נשמח לבחור',options:['הודעה','שיחה']},styles:[],channels:[],resilience:[],skills:[],sources:[]});
const decision=()=>({options:[{name:'המשך מוסכם',inClass:'שיחה בכיתה',atHome:'הודעה קצרה',why:'קשר שלנו'}],reply:{text:'נשמח להיות בקשר'},check:{look:'מה השתנה',when:'בעוד שבועיים'}});
function record({privateData=false,step=3}={}){
  const marker=privateData?'SYNTHETIC_PRIVATE_FAMILY':'סינתטי';
  return {step,form:{focus:'קודם בונים קשר',forWho:'כמה משפחות',age:'ג–ד',lang:'עברית',time:'20 דקות בשבוע',context:marker+'_CONTEXT',known:marker+'_CONTACT',inClass:'שיחת בוקר'},plan:plan(marker+'_PLAN'),version:2,at:'11.10.26',families:[{id:'f1',label:marker+'_NICKNAME',status:'בחרה דרך',chosen:'הודעה',clear:'כן',doable:'כן',decision:decision(),pick:'המשך מוסכם',checkWhen:'2026-10-25',story:{what:marker+'_STORY',me:marker+'_FEELING'},practice:{open:true,turns:[{me:true,text:marker+'_PRIVATE_TURN'},{me:false,text:'תגובה סינתטית'}],feedback:null},result:marker+'_OBSERVATION'}],changes:[{where:marker+'_HISTORY',what:marker+'_OLD_CHANGE',why:marker+'_REASON'}],learned:marker+'_LEARNED',reflect:marker+'_REFLECTION'};
}
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
function fixture({demo=false,embedded=true,admin=true,search,fail=false,defer=false,stored=record()}={}){
  const root=new Element('html'),head=new Element('head'),body=new Element('body');root.append(head,body);
  const ids={};for(const id of ['nav-home','form','steps','go','revise','example','newRound','wait1','wait4','err1','err4','s1','s2','s3','s4','out2','out3','out4']){const n=new Element(['go','revise','example','newRound'].includes(id)?'button':'div');n.id=id;ids[id]=n;body.append(n);}
  for(const step of [1,2,3,4]){const b=new Element('button');b.dataset.go=String(step);b.setAttribute('data-go',String(step));body.append(b);}
  const importInput=new Element('input');importInput.type='file';importInput.setAttribute('data-openwork','');body.append(importInput);
  // A minimal DOM skeleton is sufficient: the production UI constructs all
  // family controls, document tables, editable fields and event listeners.
  const document={body,head,documentElement:root,readyState:'loading',createElement:tag=>new Element(tag),createTextNode:text=>new TextNode(text),getElementById:id=>all(root).find(n=>n.id===id)||null,querySelector:s=>root.querySelector(s),querySelectorAll:s=>root.querySelectorAll(s)};
  const data=new Map(stored?[[key,JSON.stringify(stored)]]:[]);let reads=0,writes=0,clock=0,reloads=0;const calls=[];
  const storage={getItem(k){reads++;return data.get(k)??null;},setItem(k,v){writes++;data.set(k,v);}};
  const call=async(kind,request,check)=>{const pending=deferred(),entry={kind,request:plain(request),...pending};calls.push(entry);if(defer)return pending.promise;if(fail)throw new Error('synthetic provider failure');const result=plan('תוצר הדמו הסינתטי שלנו');if(check)assert.equal(check(result),true);return plain(result);};
  const window={sbeUserKey:k=>k+':synthetic-owner',SBE_ADVISOR_SOURCES:{forAdvisor:()=>[]},addEventListener(){},scrollTo(){},sbeCallAIJson:(_origin,request,_timeout,check)=>call('json',request,check),sbeCallAI:(_origin,request)=>call('text',request)};
  window.parent=embedded?{postMessage(){}}:window;
  class FixtureDate extends Date{static now(){return clock+=100000;}}
  const context=vm.createContext({window,self:window,document,Node:Element,localStorage:storage,sessionStorage:{getItem:k=>k==='sbe.session.homeUrl'?(admin?'admin.html?role=sys':'home.html'):null},location:{search:search??(demo?'?demolab=1':''),pathname:'/family-bridge.html',href:'https://example.test/family-bridge.html',origin:'https://example.test',reload(){reloads++;}},URLSearchParams,Map,Date:FixtureDate,Option:class extends Element{constructor(text,value){super('option');this.textContent=text;this.value=value;}},Event:class{constructor(type){this.type=type;}},sbeUserKey:window.sbeUserKey,console:{warn(){}},confirm:()=>true,alert(){},setTimeout:fn=>{queueMicrotask(fn);return 1;},clearTimeout(){},setInterval:()=>1,clearInterval(){}});
  for(const file of ['family-bridge-model.js','report-table.js'])vm.runInContext(read(file),context,{filename:file});
  context.SBE_TABLE=window.SBE_TABLE;
  // Expose a read-only test view at the existing IIFE boundary. No UI handler
  // or storage operation is replaced; every test dispatches actual listeners.
  const end=uiSource.lastIndexOf('})();');
  vm.runInContext(uiSource.slice(0,end)+'window.__bridgeState=()=>S;\n'+uiSource.slice(end),context,{filename:'family-bridge-ui.js'});
  if(demo&&embedded&&admin){const at=demoSource.lastIndexOf('\n})();');vm.runInContext(demoSource.slice(0,at)+'\nwindow.__bridgeDemo={recipe:RECIPES[page],inputSummary,standalone};\n'+demoSource.slice(at),context,{filename:'demo-hook.js'});}
  return {window,document,data,ids,calls,importInput,reads:()=>reads,writes:()=>writes,reloads:()=>reloads,state:()=>plain(window.__bridgeState()),button:text=>ids.out3.querySelectorAll('button').find(n=>n.textContent===text),
    step:async n=>{await document.querySelector('[data-go="'+n+'"]').click();},field:(id,value)=>{const input=document.getElementById(id);input.value=value;return input.fire('input');}};
}
const privateAbsent=value=>assert.doesNotMatch(String(value),/SYNTHETIC_PRIVATE/);
for(const fail of [false,true])test((fail?'failed':'successful')+' actual family demo recipe isolates private state before all reads and capture',async()=>{
  const f=fixture({demo:true,fail,stored:record({privateData:true})}),before=new Map(f.data);
  privateAbsent(JSON.stringify(f.state()));
  if(fail)await assert.rejects(f.window.__bridgeDemo.recipe(),/הזמן עבר|אין כרגע חיבור/);
  else{const items=await f.window.__bridgeDemo.recipe();assert.equal(items.length,1);assert.equal(items[0].tool,'bridge');assert.match(items[0].html,/תוצר הדמו הסינתטי/);privateAbsent(JSON.stringify(items));}
  assert.equal(f.calls.length,1);assert.equal(f.reads(),0);assert.equal(f.writes(),0);assert.deepEqual(f.data,before);
  privateAbsent(JSON.stringify(f.calls.map(x=>x.request)));privateAbsent(f.window.__bridgeDemo.inputSummary());
  await f.ids.newRound.click();await f.field('f-context','טיוטת דמו זמנית');assert.equal(f.writes(),0);
  const next=fixture({demo:true,stored:JSON.parse(f.data.get(key))});assert.equal(next.state().plan,null);assert.equal(next.reads(),0);assert.equal(next.writes(),0);
});
for(const [name,options] of [['standalone',{embedded:false}],['non-admin',{admin:false}],['ordinary embedded',{demo:false}],['near-match flag',{search:'?demolab=10'}]])test(name+' family mode retains normal owner reads, writes and reload',async()=>{
  const f=fixture({demo:true,...options,stored:record({privateData:true})});assert.equal(f.reads(),1);assert.match(JSON.stringify(f.state()),/SYNTHETIC_PRIVATE/);
  await f.field('f-context','עריכה אישית שנשמרת');assert.equal(JSON.parse(f.data.get(key)).form.context,'עריכה אישית שנשמרת');
  const next=fixture({...options,stored:JSON.parse(f.data.get(key))});assert.equal(next.state().form.context,'עריכה אישית שנשמרת');assert.equal(next.reads(),1);
});

test('late family revision cannot restore an old plan or unlock a new round generation',async()=>{
  const f=fixture({defer:true});await f.step(4);const old=f.ids.revise.click();assert.equal(f.calls.length,1);
  await f.ids.newRound.click();assert.equal(f.state().plan,null);const newer=f.ids.go.click();assert.equal(f.calls.length,2);assert.equal(f.ids.go.disabled,true);
  f.calls[0].resolve(plan('OLD_REVISION'));await old;assert.equal(f.state().plan,null);assert.equal(f.ids.go.disabled,true);assert.equal(f.ids.wait1.hidden,false);
  f.calls[1].resolve(plan('CURRENT_ROUND'));await newer;assert.equal(f.state().plan.title,'CURRENT_ROUND');assert.equal(f.state().version,1);assert.equal(f.ids.go.disabled,false);
});
test('late initial generation cannot overwrite a newer generation or stop its wait',async()=>{
  const f=fixture({defer:true});await f.step(1);const old=f.ids.go.click();await f.ids.newRound.click();const newer=f.ids.go.click();assert.equal(f.calls.length,2);
  f.calls[0].resolve(plan('OLD_GENERATION'));await old;assert.equal(f.state().plan,null);assert.equal(f.ids.go.disabled,true);assert.equal(f.ids.wait1.hidden,false);
  f.calls[1].resolve(plan('NEW_GENERATION'));await newer;assert.equal(f.state().plan.title,'NEW_GENERATION');assert.equal(f.state().step,2);
});
test('editing generation input preserves the new wording and rejects advice for the previous wording',async()=>{
  const f=fixture({defer:true});await f.step(1);const before=f.state().plan,old=f.ids.go.click();assert.equal(f.calls.length,1);
  await f.field('f-context','הקשר חדש שנכתב בזמן ההמתנה');const writes=f.writes();f.calls[0].resolve(plan('ADVICE_FOR_OLD_CONTEXT'));await old;
  assert.equal(f.writes(),writes);assert.deepEqual(f.state().plan,before);assert.equal(f.state().form.context,'הקשר חדש שנכתב בזמן ההמתנה');assert.equal(f.ids.go.disabled,false);assert.equal(f.ids.wait1.hidden,true);assert.equal(f.state().step,1);
});
test('editing a family response while deciding rejects advice for the previous response',async()=>{
  const f=fixture({defer:true}),before=f.state().families[0].decision,old=f.button('רוצה הצעה אחרת?').click();
  const status=f.ids.out3.querySelector('.famcard [aria-label="מה המשפחה ענתה"]');status.value='לא מעשי כרגע';await status.fire('change');const writes=f.writes();
  f.calls[0].resolve({...decision(),reply:{text:'ADVICE_FOR_OLD_RESPONSE'}});await old;
  assert.equal(f.writes(),writes);assert.deepEqual(f.state().families[0].decision,before);assert.equal(f.state().families[0].status,'לא מעשי כרגע');assert.equal(f.button('רוצה הצעה אחרת?').disabled,false);
});
test('editing another family leaves an independent pending decision valid',async()=>{
  const stored=record();stored.families.push({...plain(stored.families[0]),id:'f2',label:'משפחה שנייה סינתטית'});const f=fixture({defer:true,stored}),old=f.button('רוצה הצעה אחרת?').click();
  const status=f.ids.out3.querySelectorAll('.famcard')[1].querySelector('[aria-label="מה המשפחה ענתה"]');status.value='לא מעשי כרגע';await status.fire('change');
  f.calls[0].resolve({...decision(),reply:{text:'הצעה עדכנית למשפחה הראשונה'}});await old;
  assert.equal(f.state().families[0].decision.reply.text,'הצעה עדכנית למשפחה הראשונה');assert.equal(f.state().families[1].status,'לא מעשי כרגע');assert.equal(f.button('רוצה הצעה אחרת?').disabled,false);
});
test('imported family round rejects a pending revision without changing imported history',async()=>{
  const f=fixture({defer:true});await f.step(4);const old=f.ids.revise.click(),imported=record({step:2});imported.plan=plan('IMPORTED');imported.version=9;
  f.importInput.files=[{text:async()=>JSON.stringify({type:'begood-bridge',state:imported})}];await f.importInput.fire('change');assert.equal(f.reloads(),1);
  const before=f.data.get(key);f.calls[0].resolve(plan('OLD_REVISION'));await old;assert.equal(f.data.get(key),before);assert.equal(f.state().plan.title,'IMPORTED');assert.equal(f.state().version,9);
});
test('an old family completion cannot release a newer imported family request with the same ID',async()=>{
  const f=fixture({defer:true});const old=f.button('רוצה הצעה אחרת?').click();
  f.importInput.files=[{text:async()=>JSON.stringify({type:'begood-bridge',state:record()})}];await f.importInput.fire('change');await f.step(3);
  const newer=f.button('רוצה הצעה אחרת?').click();assert.equal(f.calls.length,2);const writes=f.writes();
  f.calls[0].reject(new Error('old synthetic failure'));await old;assert.equal(f.writes(),writes);assert.equal(f.button('רוצה הצעה אחרת?').disabled,true);assert.equal(f.document.getElementById('err-f1').hidden,true);
  f.calls[1].resolve(decision());await newer;assert.equal(f.button('רוצה הצעה אחרת?').disabled,false);assert.equal(f.state().families[0].pick,'');
});
const familyActions=[
  ['decision','רוצה הצעה אחרת?',()=>decision()],
  ['plan next','תכנון הקשר בחודשיים הקרובים',()=>({steps:[{when:'מחר',what:'קשר',how:'הודעה',who:'אנחנו'}]})],
  ['summary','הכנת סיכום',()=>({title:'OLD_SUMMARY',rows:[{label:'השינוי',text:'הצעה קודמת'}]})],
  ['feedback','סיום התרגול ומשוב',()=>({worked:['הקשבה'],try:['שאלה פתוחה'],next:'ננסה'})],
  ['practice turn','שליחה',()=> 'OLD_PRACTICE_REPLY']
];
for(const [name,text,result]of familyActions)test('late '+name+' stays out of a new family round',async()=>{
  const f=fixture({defer:true});if(name==='practice turn'){const input=f.ids.out3.querySelector('[aria-label="מה את אומרת"]');input.value='תגובה שלנו';}
  const button=f.button(text);assert.ok(button,text);const old=button.click();assert.equal(f.calls.length,1);
  await f.ids.newRound.click();const current=f.ids.go.click();assert.equal(f.calls.length,2);f.calls[1].resolve(plan('NEW_ROUND'));await current;
  const before=f.data.get(key),writes=f.writes();f.calls[0].resolve(result());await old;assert.equal(f.writes(),writes);assert.equal(f.data.get(key),before);assert.equal(f.state().plan.title,'NEW_ROUND');assert.equal(f.state().families[0].decision,null);assert.equal(f.state().step,2);
});
for(const [name,text,result]of familyActions)test('current '+name+' commits to its originating family and releases the lock',async()=>{
  const f=fixture({defer:true});if(name==='practice turn')f.ids.out3.querySelector('[aria-label="מה את אומרת"]').value='תגובה שלנו';
  const action=f.button(text).click();assert.equal(f.calls.length,1);f.calls[0].resolve(result());await action;
  const family=f.state().families[0];
  if(name==='decision')assert.equal(family.pick,'');
  if(name==='plan next')assert.equal(family.planNext.steps[0].when,'מחר');
  if(name==='summary')assert.equal(family.summary.title,'OLD_SUMMARY');
  if(name==='feedback')assert.deepEqual(family.practice.feedback.worked,['הקשבה']);
  if(name==='practice turn'){assert.equal(family.practice.turns.at(-1).text,'OLD_PRACTICE_REPLY');assert.equal(f.calls[0].request.messages.at(-1).content,'תגובה שלנו');}
  assert.equal(f.button('רוצה הצעה אחרת?').disabled,false);assert.equal(f.ids.go.disabled,false);
  assert.deepEqual(JSON.parse(f.data.get(key)).families[0],family);
});
test('family AI lock survives redraw and blocks duplicate and conflicting operations',async()=>{
  const f=fixture({defer:true}),old=f.button('רוצה הצעה אחרת?').click();await f.step(2);await f.step(3);
  const repeated=f.button('רוצה הצעה אחרת?'),summary=f.button('הכנת סיכום');assert.equal(repeated.disabled,true);assert.equal(summary.disabled,true);
  await repeated.fire('click');await summary.fire('click');assert.equal(f.calls.length,1);
  f.calls[0].resolve(decision());await old;assert.equal(f.button('רוצה הצעה אחרת?').disabled,false);assert.equal(f.button('הכנת סיכום').disabled,false);
});
test('a new plan replacement invalidates older per-family advice in the same round',async()=>{
  const f=fixture({defer:true});const old=f.button('רוצה הצעה אחרת?').click();await f.step(1);const replacement=f.ids.go.click();assert.equal(f.calls.length,2);
  f.calls[1].resolve(plan('REPLACEMENT'));await replacement;const before=f.data.get(key),writes=f.writes();f.calls[0].resolve(decision());await old;
  assert.equal(f.writes(),writes);assert.equal(f.data.get(key),before);assert.equal(f.state().plan.title,'REPLACEMENT');assert.equal(f.state().families[0].decision,null);assert.equal(f.state().step,2);
});
test('current family failure keeps existing data and permits a new attempt after redraw',async()=>{
  const f=fixture({defer:true}),before=f.state().families[0].decision;const action=f.button('רוצה הצעה אחרת?').click();
  f.calls[0].reject(new Error('synthetic provider failure'));await action;assert.deepEqual(f.state().families[0].decision,before);
  assert.match(f.document.getElementById('err-f1').textContent,/אין כרגע חיבור/);await f.step(2);await f.step(3);
  assert.equal(f.button('רוצה הצעה אחרת?').disabled,false);const retry=f.button('רוצה הצעה אחרת?').click();assert.equal(f.calls.length,2);f.calls[1].resolve(decision());await retry;
});
test('the latest file selection owns import even when the earlier file resolves first',async()=>{
  const f=fixture(),first=deferred(),latest=deferred();f.importInput.files=[{text:()=>first.promise}];const old=f.importInput.fire('change');
  f.importInput.files=[{text:()=>latest.promise}];f.importInput.value='latest-file.json';const newer=f.importInput.fire('change');
  const original=f.data.get(key);first.resolve(JSON.stringify({type:'begood-bridge',state:{...record(),plan:plan('OLD_FILE')}}));await old;
  assert.equal(f.data.get(key),original);assert.equal(f.importInput.value,'latest-file.json');assert.equal(f.reloads(),0);
  latest.resolve(JSON.stringify({type:'begood-bridge',state:{...record(),plan:plan('LATEST_FILE')}}));await newer;assert.equal(f.state().plan.title,'LATEST_FILE');assert.equal(f.importInput.value,'');assert.equal(f.reloads(),1);
});
test('opening a new round during file reading prevents the old import from replacing it',async()=>{
  const f=fixture(),file=deferred();f.importInput.files=[{text:()=>file.promise}];const old=f.importInput.fire('change');
  await f.ids.newRound.click();const before=f.data.get(key),writes=f.writes();file.resolve(JSON.stringify({type:'begood-bridge',state:record()}));await old;
  assert.equal(f.state().plan,null);assert.equal(f.data.get(key),before);assert.equal(f.writes(),writes);assert.equal(f.reloads(),0);
});
