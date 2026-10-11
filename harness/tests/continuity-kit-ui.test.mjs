import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const read=name=>readFileSync(new URL('../../app/lib/'+name,import.meta.url),'utf8');
const source=read('continuity-kit-ui.js'), demoSource=read('demo-hook.js');
const key='sbe.continuity.v2:synthetic-owner';
const plain=value=>JSON.parse(JSON.stringify(value));
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
class TextNode {
  constructor(text){this.nodeType=3;this.textContent=String(text);this.parentNode=null;}
  remove(){if(this.parentNode)this.parentNode.childNodes=this.parentNode.childNodes.filter(n=>n!==this);this.parentNode=null;}
  cloneNode(){return new TextNode(this.textContent);}
  get outerHTML(){return escape(this.textContent);}
}
class Element {
  constructor(tag){
    this.nodeType=tag==='#fragment'?11:1;this.tagName=tag.toUpperCase();this.childNodes=[];this.attrs=new Map();this.listeners=new Map();this.parentNode=null;this.style={};this.hidden=false;this.disabled=false;this.value='';
    let classText='';const tokens=()=>new Set(classText.split(/\s+/).filter(Boolean));
    this.classList={add:(...xs)=>{const classes=tokens();xs.forEach(x=>classes.add(x));classText=[...classes].join(' ');},remove:(...xs)=>{const classes=tokens();xs.forEach(x=>classes.delete(x));classText=[...classes].join(' ');},contains:x=>tokens().has(x),toggle:(x,force)=>{const classes=tokens(),yes=force===undefined?!classes.has(x):!!force;if(yes)classes.add(x);else classes.delete(x);classText=[...classes].join(' ');return yes;}};
    Object.defineProperty(this,'className',{get:()=>classText,set:value=>{classText=String(value);}});
    this.dataset=new Proxy({},{set:(target,k,v)=>{target[k]=String(v);this.attrs.set('data-'+k.replace(/[A-Z]/g,c=>'-'+c.toLowerCase()),String(v));return true;}});
  }
  append(...nodes){nodes.flat().forEach(value=>{const n=typeof value==='object'?value:new TextNode(value);if(n.nodeType===11){this.append(...n.childNodes.slice());return;}n.remove();n.parentNode=this;this.childNodes.push(n);});}
  appendChild(node){this.append(node);return node;}
  replaceChildren(...nodes){this.childNodes.forEach(n=>n.parentNode=null);this.childNodes=[];this.append(...nodes);}
  get children(){return this.childNodes.filter(n=>n.nodeType===1);}
  get firstChild(){return this.childNodes[0]||null;}get lastChild(){return this.childNodes.at(-1)||null;}get parentElement(){return this.parentNode;}
  get nextElementSibling(){const xs=this.parentNode?.children||[];return xs[xs.indexOf(this)+1]||null;}
  get textContent(){return this.childNodes.map(n=>n.textContent).join('');}set textContent(value){this.replaceChildren(...(value?[new TextNode(value)]:[]));}
  get innerText(){return this.textContent;}
  setAttribute(k,v){if(k==='class')this.className=v;else if(k==='id')this.id=String(v);else{this.attrs.set(k,String(v));if(k.startsWith('data-'))this.dataset[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=v;}}
  getAttribute(k){return k==='class'?this.className||null:k==='id'?this.id||null:this.attrs.get(k)??null;}
  removeAttribute(k){if(k==='class')this.className='';else this.attrs.delete(k);}
  get options(){return this.children.filter(n=>n.tagName==='OPTION');}get selectedIndex(){return Math.max(0,this.options.findIndex(n=>n.value===this.value));}
  addEventListener(type,fn){const xs=this.listeners.get(type)||[];xs.push(fn);this.listeners.set(type,xs);}
  async fire(type,extra={}){const event={target:this,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},...extra};for(const fn of this.listeners.get(type)||[])await fn(event);return event;}
  click(){return this.fire('click');}focus(){}
  contains(n){return n===this||all(this).includes(n);}
  querySelectorAll(selector){if(selector.startsWith(':scope > '))return this.children.filter(n=>matches(n,selector.slice(9)));return all(this).filter(n=>matches(n,selector));}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  matches(selector){return matches(this,selector);}
  insertBefore(node,reference){node.remove();const i=this.childNodes.indexOf(reference);node.parentNode=this;this.childNodes.splice(i<0?this.childNodes.length:i,0,node);}
  closest(selector){for(let n=this;n;n=n.parentNode)if(matches(n,selector))return n;return null;}
  remove(){if(this.parentNode)this.parentNode.childNodes=this.parentNode.childNodes.filter(n=>n!==this);this.parentNode=null;}
  replaceWith(node){const p=this.parentNode;if(!p)return;const i=p.childNodes.indexOf(this);node.remove();p.childNodes[i]=node;node.parentNode=p;this.parentNode=null;}
  cloneNode(deep=false){const n=new Element(this.tagName);n.className=this.className;n.id=this.id;n.hidden=this.hidden;n.value=this.value;n.type=this.type;n.checked=this.checked;for(const [k,v]of this.attrs)n.setAttribute(k,v);if(deep)n.append(...this.childNodes.map(c=>c.cloneNode(true)));return n;}
  get outerHTML(){const attrs=new Map(this.attrs);if(this.className)attrs.set('class',this.className);if(this.id)attrs.set('id',this.id);return '<'+this.tagName.toLowerCase()+[...attrs].map(([k,v])=>' '+k+'="'+escape(v)+'"').join('')+'>'+this.childNodes.map(n=>n.outerHTML).join('')+'</'+this.tagName.toLowerCase()+'>';}
}
const all=root=>root.childNodes.flatMap(n=>n.nodeType===1?[n,...all(n)]:[]);
function simple(node,selector){
  if(node.nodeType!==1)return false;
  const not=/:(?:not)\(([^)]+)\)/.exec(selector);if(not){if(simple(node,not[1]))return false;selector=selector.replace(not[0],'');}
  for(const [,k,v]of selector.matchAll(/\[([^=\]]+)(?:=["']?([^"'\]]+)["']?)?\]/g)){if(k==='type'){if(v!==undefined?node.type!==v:node.type===undefined)return false;}else if(v!==undefined?node.getAttribute(k)!==v:node.getAttribute(k)===null)return false;}
  const rest=selector.replace(/\[[^\]]+\]/g,''),tag=/^[a-z][\w-]*/i.exec(rest)?.[0];if(tag&&node.tagName!==tag.toUpperCase())return false;
  const id=/#([\w-]+)/.exec(rest)?.[1];if(id&&node.id!==id)return false;
  return [...rest.matchAll(/\.([\w-]+)/g)].every(([,c])=>node.classList.contains(c));
}
function matches(node,selector){return selector.split(',').some(part=>{const tokens=part.trim().split(/\s+(?![^\[]*\])/);if(!simple(node,tokens.pop()))return false;let p=node.parentNode;while(tokens.length){const wanted=tokens.pop();while(p&&!simple(p,wanted))p=p.parentNode;if(!p)return false;p=p.parentNode;}return true;});}
function record(){return {form:{role:'מחנכת כיתה',receiver:'עמיתה בצוות',routines:'פתיחת בוקר משותפת',group:'קבוצה סינתטית'},version:1,at:'11.10.26',
  kit:{title:'תיק רציפות',opening:[{h:'פתיחה',t:'כרטיס פתיחה מקורי'}],routines:[{name:'שגרה מקורית',when:'בבוקר',what:'מתכנסים',helpers:'הצוות'}],trial:[{task:'ניסיון',check:'בדיקה'}],resilience:'חוסן בשגרה',sources:['Synthetic2026a']},
  emerg:{remote:[{subject:'חשבון',task:'משימה מקורית',where:'בבית'}],chain:[{who:'תפקיד',whom:'תפקיד נוסף',when:'בבוקר',how:'הודעה'}],parentLetter:'שלום למשפחות, [שם המחליפה] תלווה את הקבוצה. יחד נשמור על קשר ועל רצף הלמידה שלנו.',resilience:'חוסן בחירום',sources:['Synthetic2026a','Synthetic2026b']},
  local:{students:[{c0:'SYNTHETIC_PRIVATE_ROSTER',c1:'SYNTHETIC_PRIVATE_PARENT'}],studentsLink:'https://example.test/SYNTHETIC_PRIVATE_CONTACT',red:[{c0:'SYNTHETIC_PRIVATE_MEDICAL',c1:'מידע מקומי'}],letter:{sub:'SYNTHETIC_PRIVATE_SUB',contact:'SYNTHETIC_PRIVATE_CONTACT'}}};}
function fixture({data=new Map([[key,JSON.stringify(record())]]),demo=false,fail=false}={}){
  const root=new Element('html'),head=new Element('head'),body=new Element('body');root.append(head,body);
  const ids=new Map();for(const id of ['nav-home','form','s1','s2','s3','status','kit','go','err1','wait1','print','printShare','saveFile','openFile','remind','reviewDate','toTrial','back1','back2','revise','trialNote','trialWho','err3','wait3','changes','example']){const n=new Element(['go','print','printShare','revise','example'].includes(id)?'button':'div');n.id=id;ids.set(id,n);body.append(n);}
  const steps=new Element('ol');steps.id='steps';for(let i=1;i<=3;i++){const li=new Element('li');li.dataset.step=i;steps.append(li);}body.append(steps);
  const document={body,head,documentElement:root,readyState:'loading',baseURI:'https://example.test/continuity-kit.html',images:[],createElement:tag=>new Element(tag),createTextNode:text=>new TextNode(text),createDocumentFragment:()=>new Element('#fragment'),getElementById:id=>all(root).find(n=>n.id===id)||null,querySelector:s=>root.querySelector(s),querySelectorAll:s=>root.querySelectorAll(s)};
  let reads=0,writes=0,clock=0;const calls=[],printed=[],printHtml=[],urlInputs=[];
  const storage={getItem(k){reads++;return data.get(k)??null;},setItem(k,v){writes++;data.set(k,v);}};
  const sources={byKey:{Synthetic2026a:{apa:'Synthetic source A.'},Synthetic2026b:{apa:'Synthetic source B.'}},forAdvisor:()=>[]};
  const window={sbeUserKey:k=>k+':synthetic-owner',SBE_ADVISOR_SOURCES:sources,scrollTo(){},addEventListener(){},open:()=>({document:{write:html=>printHtml.push(html),close(){}}}),
    sbeCallAIJson:async(_origin,request,_timeout,check)=>{calls.push(plain(request));if(fail)throw new Error('synthetic provider failure');const result=request.system.includes('parentLetter')?record().emerg:record().kit;assert.equal(check(result),true);return plain(result);}};
  window.parent=demo?{postMessage(){}}:window;
  class FixtureDate extends Date{static now(){return clock+=1000;}}
  class FixtureURL extends URL{constructor(input,...rest){urlInputs.push(String(input));super(input,...rest);}}
  const context=vm.createContext({window,self:window,document,Node:Element,localStorage:storage,sessionStorage:{getItem:k=>k==='sbe.session.homeUrl'?'admin.html?role=sys':null},location:{search:demo?'?demolab=1':'',pathname:'/continuity-kit.html',href:'https://example.test/continuity-kit.html',origin:'https://example.test'},URL:FixtureURL,URLSearchParams,Map,Set,Date:FixtureDate,Blob,Option:class extends Element{constructor(text,value){super('option');this.textContent=text;this.value=value;}},sbeUserKey:window.sbeUserKey,console:{warn(){}},confirm:()=>true,alert(){},setTimeout:fn=>{queueMicrotask(fn);return 1;},clearTimeout(){},setInterval:()=>1,clearInterval(){},navigator:{clipboard:{writeText:async()=>{}}}});
  for(const file of ['continuity-model.js','report-table.js','product-doc.js','ref-collect.js'])vm.runInContext(read(file),context,{filename:file});
  context.SBE_REFS=window.SBE_REFS;
  // Run real print construction/filtering into a synthetic window document.
  // This verifies generated HTML, not browser layout or a physical PDF.
  const realPrint=window.SBE_DOC.print;
  window.SBE_DOC.print=spec=>{window.SBE_REFS.forPrint(spec.node);realPrint(spec);printed.push({...spec,html:printHtml.at(-1)});};
  const at=source.lastIndexOf('\n})();');
  vm.runInContext(source.slice(0,at)+'\nwindow.__continuityTest={state:()=>S,showKit,printable,captureEdit,restoreEdit};\n'+source.slice(at),context,{filename:'continuity-kit-ui.js'});
  return {window,context,document,data,api:window.__continuityTest,calls,printed,urlInputs,reads:()=>reads,writes:()=>writes,
    edit:k=>document.querySelector('[data-edit-key="'+k+'"]'),pane:k=>document.querySelector('[data-pane="'+k+'"]')};
}

test('generated routine and emergency wording survives rebuild/reload while private controls keep working',async()=>{
  const f=fixture();assert.ok(f.edit('routine.main'));assert.ok(f.edit('emerg.main'));
  f.edit('routine.main').querySelector('td').textContent='הנוסח שלנו בשגרה';await f.edit('routine.main').fire('input');
  f.edit('emerg.main').querySelector('td').textContent='הנוסח שלנו בחירום';await f.edit('emerg.main').fire('input');
  const roster=f.pane('students').querySelector('.etable input');roster.value='שם סינתטי שערכנו';await roster.fire('input');
  const link=f.document.getElementById('st-link');link.value='https://example.test/edited';await link.fire('input');
  assert.equal(f.api.state().local.students[0].c0,'שם סינתטי שערכנו');assert.equal(f.api.state().local.studentsLink,link.value);
  f.api.showKit();assert.match(f.edit('routine.main').textContent,/הנוסח שלנו בשגרה/);assert.match(f.edit('emerg.main').textContent,/הנוסח שלנו בחירום/);
  const g=fixture({data:f.data});assert.match(g.edit('routine.main').textContent,/הנוסח שלנו בשגרה/);assert.match(g.edit('emerg.main').textContent,/הנוסח שלנו בחירום/);
  assert.equal(g.pane('students').querySelector('.etable input').value,'שם סינתטי שערכנו');
  assert.doesNotMatch(JSON.stringify(g.api.state().edits),/SYNTHETIC_PRIVATE|onclick|<script/);
  await g.document.getElementById('printShare').click();assert.match(g.printed[0].node.textContent,/הנוסח שלנו בחירום/);assert.doesNotMatch(g.printed[0].node.textContent,/SYNTHETIC_PRIVATE_ROSTER|SYNTHETIC_PRIVATE_MEDICAL/);
});

test('editing the unfilled letter preserves wording when local details change, and only filled preview prints',async()=>{
  const f=fixture(),template=f.edit('emerg.letter');template.textContent='משפחות יקרות, [שם המחליפה] איתנו. נלמד ונשמור על הקשר שלנו.';await template.fire('input');
  const field=f.document.getElementById('lt-sub');field.value='מחליפה סינתטית אחרת';await field.fire('input');
  assert.equal(template.textContent,'משפחות יקרות, [שם המחליפה] איתנו. נלמד ונשמור על הקשר שלנו.');
  assert.match(f.pane('emerg').querySelector('.letter-out').textContent,/מחליפה סינתטית אחרת איתנו/);
  f.api.showKit();assert.match(f.edit('emerg.letter').textContent,/\[שם המחליפה\]/);assert.match(f.pane('emerg').querySelector('.letter-out').textContent,/מחליפה סינתטית אחרת/);
  await f.document.getElementById('printShare').click();const letter=f.printed[0].node.querySelector('.letter-out');assert.match(letter.textContent,/מחליפה סינתטית אחרת/);
  assert.match(f.printed[0].html,/מחליפה סינתטית אחרת איתנו/);assert.doesNotMatch(f.printed[0].html,/עריכת נוסח המכתב|\[שם המחליפה\]/);
  assert.doesNotMatch(JSON.stringify(f.api.state().edits['emerg.letter']),/מחליפה סינתטית אחרת|SYNTHETIC_PRIVATE/);
});

test('sources start folded/excluded, persist independent choices and print once after all panes',async()=>{
  const f=fixture();const refs=()=>['routine','emerg'].map(k=>f.pane(k).querySelector('.sbe-refs'));
  assert.ok(refs().every(n=>!n.classList.contains('open')&&!n.classList.contains('attach')));
  await refs()[0].querySelector('.refs-open').click();await f.document.getElementById('print').click();assert.equal(f.printed[0].node.querySelector('.sbe-refs'),null);
  await refs()[0].querySelector('.refs-attach').click();await f.document.getElementById('printShare').click();assert.equal(f.printed.at(-1).node.querySelectorAll('.sbe-refs li').length,1);
  await refs()[1].querySelector('.refs-attach').click();const g=fixture({data:f.data});
  assert.ok(g.pane('routine').querySelector('.sbe-refs').classList.contains('open'));assert.ok(['routine','emerg'].every(k=>g.pane(k).querySelector('.sbe-refs').classList.contains('attach')));
  await g.document.getElementById('print').click();const out=g.printed[0].node;assert.equal(out.querySelectorAll('.sbe-refs').length,1);assert.equal(out.lastChild.className,'sbe-refs attach');assert.deepEqual(out.lastChild.querySelectorAll('li').map(n=>n.textContent.replace(/ ↗$/,'')),['Synthetic source A.','Synthetic source B.']);
  assert.equal(out.querySelector('.pane .sbe-refs'),null);
  assert.equal(g.printed[0].html.match(/Synthetic source A\./g).length,1);assert.equal(g.printed[0].html.match(/Synthetic source B\./g).length,1);
  await g.pane('routine').querySelector('.refs-attach').click();await g.pane('emerg').querySelector('.refs-attach').click();await g.document.getElementById('printShare').click();assert.equal(g.printed.at(-1).node.querySelector('.sbe-refs'),null);
});

test('paste/drop block active live markup and snapshots/print strip active attributes and private controls',async()=>{
  const f=fixture(),node=f.edit('emerg.main'),payload='<img src=x onerror="attack()"><script>attack()</script><span onclick="attack()">נוסח</span>';
  const paste=await node.fire('paste',{clipboardData:{getData:type=>type==='text/plain'?'טקסט שהדבקנו':payload}});assert.equal(paste.defaultPrevented,true);assert.match(node.textContent,/טקסט שהדבקנו/);assert.equal(node.querySelector('img,script,[onclick]'),null);
  const drop=await node.fire('drop',{dataTransfer:{getData:type=>type==='text/html'?payload:''}});assert.equal(drop.defaultPrevented,true);assert.equal(node.querySelector('img,script,[onclick]'),null);
  const safe=new Element('p');safe.textContent='נוסח נקי';safe.setAttribute('onclick','attack()');const script=new Element('script');script.textContent='attack()';const privateInput=new Element('input');privateInput.value='SYNTHETIC_PRIVATE_PASTED';const sensitive=new Element('div');sensitive.className='sens';sensitive.textContent='SYNTHETIC_PRIVATE_PASTED';const anchor=new Element('a');anchor.setAttribute('href','javascript:attack()');anchor.textContent='קישור';node.append(safe,script,privateInput,sensitive,anchor);await node.fire('input');
  assert.doesNotMatch(JSON.stringify(f.api.state().edits),/onclick|attack|SYNTHETIC_PRIVATE_PASTED|javascript:/);
  await f.document.getElementById('print').click();assert.equal(f.printed[0].node.querySelector('[onclick],script,[href="javascript:attack()"]'),null);
  assert.doesNotMatch(f.printed[0].html,/attack\(\)|SYNTHETIC_PRIVATE_PASTED|javascript:/);
  const g=fixture({data:f.data});assert.equal(g.edit('emerg.main').querySelector('script,input,[onclick]'),null);assert.match(g.edit('emerg.main').textContent,/נוסח נקי/);
});

test('a newly accepted routine replaces its edits while emergency wording and source selections survive',async()=>{
  const f=fixture();f.edit('routine.main').textContent='עריכה בשגרה';await f.edit('routine.main').fire('input');f.edit('emerg.main').textContent='עריכה בחירום';await f.edit('emerg.main').fire('input');await f.pane('emerg').querySelector('.refs-attach').click();
  f.document.getElementById('trialNote').value='נרצה להבהיר את הפתיחה';await f.document.getElementById('revise').click();assert.doesNotMatch(f.edit('routine.main').textContent,/עריכה בשגרה/);assert.match(f.edit('emerg.main').textContent,/עריכה בחירום/);assert.ok(f.pane('emerg').querySelector('.sbe-refs').classList.contains('attach'));assert.equal(f.api.state().version,2);
});

test('stored editable trees reject controls/private blocks and filter event attributes or active links',()=>{
  const value=record();value.edits={
    'routine.main':{v:1,nodes:[{tag:'input',attrs:{value:'SYNTHETIC_PRIVATE_IMPORTED'},children:[]}]},
    'routine.followup':{v:1,nodes:[{tag:'div',attrs:{class:'sens'},children:[{text:'SYNTHETIC_PRIVATE_IMPORTED'}]}]},
    'emerg.main':{v:1,nodes:[{tag:'p',attrs:{onclick:'attack()'},children:[{text:'נוסח שמור בטוח'}, {tag:'a',attrs:{href:'javascript:attack()'},children:[{text:'קישור'}]}]}]}
  };
  const f=fixture({data:new Map([[key,JSON.stringify(value)]])});
  assert.match(f.edit('routine.main').textContent,/שגרה מקורית/);assert.doesNotMatch(f.edit('routine.followup').textContent,/SYNTHETIC_PRIVATE_IMPORTED/);
  assert.match(f.edit('emerg.main').textContent,/נוסח שמור בטוח/);assert.equal(f.edit('emerg.main').querySelector('[onclick],[href],input'),null);
});

test('oversized/deep snapshots fall back safely and a rejected oversized edit keeps the prior saved wording',async()=>{
  const value=record();let tree={text:'deep'};for(let i=0;i<82;i++)tree={tag:'div',children:[tree]};
  value.edits={'routine.main':{v:1,nodes:[tree]},'emerg.main':{v:1,nodes:[{text:'x'.repeat(200001)}]}};
  const f=fixture({data:new Map([[key,JSON.stringify(value)]])});assert.match(f.edit('routine.main').textContent,/שגרה מקורית/);assert.match(f.edit('emerg.main').textContent,/משימה מקורית/);
  const node=f.edit('emerg.main');node.textContent='נוסח שמור';await node.fire('input');const previous=JSON.stringify(f.api.state().edits['emerg.main']);
  node.textContent='x'.repeat(200001);await node.fire('input');assert.equal(JSON.stringify(f.api.state().edits['emerg.main']),previous);assert.match(node.parentNode.querySelector('.sbe-edit-hint').textContent,/הנוסח עדיין כאן.*ארוך מדי לשמירה/);
  const g=fixture({data:f.data});assert.equal(g.edit('emerg.main').textContent,'נוסח שמור');
});

test('giant class/href attributes normalize to bounded inert values before capture or URL parsing',async()=>{
  const f=fixture(),classes='model '.repeat(100000),href='https://example.test/'+ 'x'.repeat(600000),node=new Element('a');
  node.className=classes;node.setAttribute('href',href);node.textContent='16 visible chars';
  const root=new Element('div');root.append(node);const captured=f.api.captureEdit(root);
  assert.equal(captured.nodes[0].attrs.class,'model');assert.equal(captured.nodes[0].attrs.href,undefined);assert.ok(JSON.stringify(captured).length<200);
  const restored=f.api.restoreEdit({v:1,nodes:[{tag:'a',attrs:{class:classes,href},children:[{text:'16 visible chars'}]}]});
  assert.equal(restored[0].getAttribute('class'),'model');assert.equal(restored[0].getAttribute('href'),null);assert.equal(restored[0].textContent,'16 visible chars');
  assert.equal(f.urlInputs.some(input=>input.length>2000),false,'oversized hrefs never enter URL parsing');
  const editor=f.edit('emerg.main');editor.replaceChildren(node);await editor.fire('input');assert.equal(f.api.state().edits['emerg.main'].nodes[0].attrs.class,'model');assert.equal(f.api.state().edits['emerg.main'].nodes[0].attrs.href,undefined);
});

test('normalized allowed attributes share the cumulative text budget on capture, restore and actual edit saving',async()=>{
  const f=fixture(),href='https://example.test/'+ 'x'.repeat(1880);
  const snapshot=count=>({v:1,nodes:Array.from({length:count},()=>({tag:'a',attrs:{href,class:'model model'},children:[{text:'v'}]}))});
  const small=snapshot(100);assert.equal(f.api.restoreEdit(small).length,100,'many ordinary bounded links below the total budget remain usable');
  const oversized=snapshot(106);assert.throws(()=>f.api.restoreEdit(oversized),/ארוך מדי לשמירה/);
  const root=new Element('div');for(const tree of oversized.nodes){const link=new Element('a');link.setAttribute('href',tree.attrs.href);link.className=tree.attrs.class;link.textContent='v';root.append(link);}
  assert.throws(()=>f.api.captureEdit(root),/ארוך מדי לשמירה/);
  const editor=f.edit('emerg.main');editor.textContent='נוסח קודם שנשמר';await editor.fire('input');const previous=JSON.stringify(f.api.state().edits['emerg.main']);
  editor.replaceChildren(...root.children.slice());await editor.fire('input');assert.equal(JSON.stringify(f.api.state().edits['emerg.main']),previous);assert.match(editor.parentNode.querySelector('.sbe-edit-hint').textContent,/ארוך מדי לשמירה/);
  const loaded=record();loaded.edits={'emerg.main':oversized};const g=fixture({data:new Map([[key,JSON.stringify(loaded)]])});assert.match(g.edit('emerg.main').textContent,/משימה מקורית/);
});

for(const fail of [false,true])test((fail?'failed':'successful')+' authorized demo leaves the private store untouched and private sentinels absent from input/capture',async()=>{
  const data=new Map([[key,JSON.stringify(record())]]),before=data.get(key),f=fixture({data,demo:true,fail});
  // Run the real recipe and capture helpers. The startup/load listener is not
  // fired; timer callbacks resolve immediately and the clock advances for its
  // bounded wait loop. Provider responses here are synthetic, with no network.
  const at=demoSource.lastIndexOf('\n})();');vm.runInContext(demoSource.slice(0,at)+'\nwindow.__continuityDemo={recipe:RECIPES[page],inputSummary,standalone};\n'+demoSource.slice(at),f.context,{filename:'demo-hook.js'});
  if(fail)await assert.rejects(f.window.__continuityDemo.recipe(),/התיק לא הוכן|התוצר לא הופק/);
  else{const items=await f.window.__continuityDemo.recipe();assert.equal(items.length,1);assert.doesNotMatch(JSON.stringify(items),/SYNTHETIC_PRIVATE/);}
  assert.equal(f.reads(),0);assert.equal(f.writes(),0);assert.equal(data.get(key),before);assert.doesNotMatch(f.window.__continuityDemo.inputSummary(),/SYNTHETIC_PRIVATE/);assert.doesNotMatch(f.window.__continuityDemo.standalone(f.document.getElementById('kit'),'תיק רציפות'),/SYNTHETIC_PRIVATE/);assert.doesNotMatch(JSON.stringify(f.calls),/SYNTHETIC_PRIVATE/);
});
