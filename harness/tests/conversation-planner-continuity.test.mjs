import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Run the page's real handlers and product renderers. Only the AI boundary is deferred.
class TextNode {
  constructor(text){this.nodeType=3;this.textContent=String(text);this.parentNode=null;}
  cloneNode(){return new TextNode(this.textContent);}
  get outerHTML(){return this.textContent.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));}
}
class Element {
  constructor(tag){this.nodeType=1;this.tagName=tag.toUpperCase();this.childNodes=[];this.attributes=new Map();this.listeners=new Map();this.dataset={};this.style={};this.value='';this.disabled=false;this.parentNode=null;
    this.classList={add:(...items)=>this.className=[...new Set([...this.className.split(/\s+/).filter(Boolean),...items])].join(' '),remove:item=>this.className=this.className.split(/\s+/).filter(x=>x!==item).join(' '),toggle:(item,on)=>{const has=this.className.split(/\s+/).includes(item);const next=on??!has;if(next)this.classList.add(item);else this.classList.remove(item);return next;}};}
  get className(){return this.getAttribute('class')||'';}set className(v){this.setAttribute('class',v);}
  get id(){return this.getAttribute('id');}set id(v){this.setAttribute('id',v);}
  get textContent(){return this.childNodes.map(n=>n.textContent).join('');}set textContent(v){this.childNodes=[];if(v)this.append(String(v));}
  get innerText(){return this.textContent;}
  set innerHTML(v){this.textContent=v;}
  get outerHTML(){return '<'+this.tagName.toLowerCase()+[...this.attributes].map(([k,v])=>' '+k+'="'+v+'"').join('')+'>'+this.childNodes.map(n=>n.outerHTML).join('')+'</'+this.tagName.toLowerCase()+'>';}
  append(...nodes){for(let node of nodes){if(typeof node!=='object')node=new TextNode(node);if(node.tagName==='#FRAGMENT'){this.append(...node.childNodes);continue;}this.childNodes.push(node);node.parentNode=this;}}
  setAttribute(k,v){this.attributes.set(k,String(v));if(k.startsWith('data-'))this.dataset[k.slice(5)]=String(v);}
  getAttribute(k){return this.attributes.get(k)??null;}removeAttribute(k){this.attributes.delete(k);}
  addEventListener(name,fn){const list=this.listeners.get(name)||[];list.push(fn);this.listeners.set(name,list);}
  dispatchEvent(event){event.target ||= this;for(const fn of this.listeners.get(event.type)||[])fn(event);if(event.bubbles&&this.parentNode)this.parentNode.dispatchEvent(event);}
  fire(name,extra={}){const event={type:name,target:this,preventDefault(){},...extra};let result;for(const fn of this.listeners.get(name)||[])result=fn(event);if(event.bubbles&&this.parentNode)this.parentNode.dispatchEvent(event);return result;}
  click(){return this.fire('click');}
  showModal(){this.open=true;}close(){this.open=false;this.fire('close');}remove(){if(this.parentNode)this.parentNode.childNodes=this.parentNode.childNodes.filter(n=>n!==this);}
  matches(selector){const attr=selector.match(/\[([^=\]]+)(?:="([^"]*)")?\]/);const bare=selector.replace(/\[[^\]]+\]/g,'');const bits=bare.split('.');if(bits[0]&&this.tagName!==bits[0].toUpperCase())return false;if(bits.slice(1).some(c=>!this.className.split(/\s+/).includes(c)))return false;return !attr||(this.getAttribute(attr[1])!==null&&(attr[2]===undefined||this.getAttribute(attr[1])===attr[2]));}
  querySelectorAll(selector){const parts=selector.split(','),found=[];const walk=n=>{for(const c of n.childNodes){if(c.nodeType!==1)continue;if(parts.some(s=>c.matches(s)))found.push(c);walk(c);}};walk(this);return found;}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  closest(selector){return this.matches(selector)?this:this.parentNode?.closest(selector)||null;}
  cloneNode(deep){const n=new Element(this.tagName);for(const [k,v]of this.attributes)n.setAttribute(k,v);if(deep)n.append(...this.childNodes.map(c=>c.cloneNode(true)));return n;}
}
function page(storage=new Map()){
  let owner='A',quota=false,serial=0;
  const body=new Element('body'),head=new Element('head'),calls=[],prints=[];
  for(const id of ['form','bSuggest','bBuild','bReset','bSaved','hint','ready','cW','cP','cS','dlg','dlgH','dlgB','dlgX','aiStatusChip']){const n=new Element(id.startsWith('b')||id==='dlgX'?'button':id==='dlg'?'dialog':'div');n.id=id;body.append(n);}
  const document={body,head,baseURI:'http://localhost:8123/conversation-planner.html',images:[],createElement:tag=>new Element(tag),createTextNode:text=>new TextNode(text),createDocumentFragment:()=>new Element('#fragment'),getElementById:id=>[body,head,...body.querySelectorAll('[id]'),...head.querySelectorAll('[id]')].find(n=>n.id===id)||null,querySelector:s=>body.querySelector(s),querySelectorAll:s=>body.querySelectorAll(s),addEventListener(){}};
  const context={document,Node:Element,TextNode,URL,URLSearchParams,location:{search:''},AbortController,DOMException,Date,setTimeout,Event:class{constructor(type,opts={}){this.type=type;Object.assign(this,opts);}},console:{warn(){}},navigator:{clipboard:{writeText:async()=>{}}},alert(){},crypto:{randomUUID:()=> 'conversation-'+(++serial)},sbeUserKey:base=>base+':'+owner,sbeAIOrigin:()=> 'http://localhost:8124',localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>{if(quota)throw Error('quota');storage.set(key,value);}},open:()=>({document:{write:html=>prints.push(html),close(){}}}),sbeCallAI:(server,request,timeout,options)=>new Promise((resolve,reject)=>calls.push({server,request,timeout,options,resolve,reject}))};
  context.window=context;vm.createContext(context);
  for(const file of ['product-doc.js','planner-continuity.js'])vm.runInContext(readFileSync(new URL('../../app/lib/'+file,import.meta.url),'utf8'),context);
  const html=readFileSync(new URL('../../app/conversation-planner.html',import.meta.url),'utf8');
  const source=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('const FIELDS = new Map()'));
  vm.runInContext(source,context);
  const byId=id=>document.getElementById(id),edit=(key,value)=>{byId('i-'+key).value=value;byId('i-'+key).fire('input');};
  edit('myself','מורה סינתטית');edit('otherParty','עמיתה סינתטית');edit('goal','בחירת צעד משותף');
  return {context,document,storage,calls,prints,byId,edit,owner:value=>owner=value,quota:value=>quota=value,buttons:node=>(node||body).querySelectorAll('button'),clickText:(text,node)=>{const button=(node||body).querySelectorAll('button').find(n=>n.textContent.includes(text)&&(text!=='שמירה'||!n.textContent.includes('PDF')));assert.ok(button,'button: '+text);return button.fire('click');},dialog:()=>byId('dlgB').textContent};
}
const digital=label=>JSON.stringify({full:'שלום, '+label+' — תודה על השותפות. נשמח לבחור יחד צעד ראשון.',short:'שלום, '+label+' — נבחר יחד צעד?'});
const oral='**מה על הכף**\nהעמיתה והמורה מבקשות לבחור צעד משותף, להקשיב לצרכים ולקבל החלטה יחד. אפשר לעצור ולחשוב לפני שמציעים דבר.\n\n**איך לפתוח**\nשלום, תודה על השותפות. מה חשוב לך שנשיג היום?\n\n**איך לסיים**\nאפשר לבחור יחד מי תעדכן ובאיזה מועד נשוב לשיחה.';
async function startDigital(env,label){env.edit('productType','התכתבות דיגיטלית (הודעה, מייל או צ\'אט)');const pending=env.byId('bBuild').fire('click');env.calls.at(-1).resolve(digital(label));await pending;}

test('Digital page saves actual edited full and short text, reopens, prints and versions without another AI call',async()=>{
  const env=page();await startDigital(env,'טיוטה');const boxes=env.byId('dlgB').querySelectorAll('.draftbox');boxes[0].textContent='מלאה שערכתי\nהצעד שלנו';boxes[1].textContent='קצרה שערכתי';
  env.clickText('שמירה',env.byId('dlgB'));env.byId('dlgX').fire('click');
  const reloaded=page(env.storage);reloaded.byId('bSaved').fire('click');reloaded.clickText('טיוטת הודעה');
  const archive=reloaded.document.body.querySelectorAll('dialog').at(-1);assert.match(archive.textContent,/מלאה שערכתי/);assert.match(archive.textContent,/קצרה שערכתי/);assert.equal(reloaded.calls.length,0);
  assert.equal(archive.querySelectorAll('.sbe-edit-hint').length,1,'one editing instruction for the whole saved product');
  const restored=archive.querySelectorAll('.draftbox');restored[0].textContent='גרסה שנייה';reloaded.clickText('שמירה פרטית',archive);assert.match(archive.querySelector('h3').textContent,/גרסה 2/);assert.ok(archive.querySelectorAll('button').some(b=>b.textContent==='פתיחת גרסה 1'));reloaded.clickText('הדפסה',archive);assert.match(reloaded.prints[0],/גרסה שנייה/);assert.match(reloaded.prints[0],/קצרה שערכתי/);
  const records=reloaded.context.SBE_PLANNER.createArchive('sbe.conversationplanner.saved.v2').list();assert.equal(records[0].version,2);assert.match(JSON.stringify(records[0].history[0].document),/מלאה שערכתי/);
});
test('Oral briefing and reminder save current edited table cells and show failed storage writes',async()=>{
  const env=page();env.edit('productType','שיחה בעל פה');const pending=env.byId('bBuild').fire('click');env.calls[0].resolve(oral);await pending;
  const tables=env.byId('dlgB').querySelectorAll('table');assert.equal(tables.length,2);tables[0].querySelector('td').textContent='התדריך שערכתי';tables[1].querySelector('td').textContent='המטרה ששיניתי';
  env.quota(true);env.clickText('שמירה',env.byId('dlgB'));assert.match(env.dialog(),/לא נשמר/);assert.match(env.dialog(),/התדריך שערכתי/);env.quota(false);env.clickText('לא נשמר',env.byId('dlgB'));assert.match(env.dialog(),/נשמר.*✓/);
  env.byId('dlgX').fire('click');env.byId('bSaved').fire('click');env.clickText('תדריך לפני שיחה');const archive=env.document.body.querySelectorAll('dialog').at(-1);assert.match(archive.textContent,/התדריך שערכתי/);assert.match(archive.textContent,/המטרה ששיניתי/);
});
test('Proposal replies never refill cleared fields or reset forms',async()=>{
  for(const action of ['clear','reset']){const env=page();const pending=env.byId('bSuggest').fire('click');if(action==='clear')env.edit('goal','');else env.byId('bReset').fire('click');env.calls[0].resolve(JSON.stringify({goal:'תשובה ישנה',openingLine:'נוסח ישן'}));await pending;assert.equal(env.byId('i-goal').value,'');assert.equal(env.byId('i-openingLine').value,'');assert.equal(env.byId('dlg').open,undefined);}
});
test('Old successful and failed generations cannot replace a newer edited product',async()=>{
  for(const fail of [false,true]){const env=page();env.edit('productType','התכתבות דיגיטלית (הודעה, מייל או צ\'אט)');const first=env.byId('bBuild').fire('click');env.edit('goal','מטרה חדשה');const second=env.byId('bBuild').fire('click');env.calls[1].resolve(digital('תוצר חדש'));await second;env.byId('dlgB').querySelector('.draftbox').textContent='עריכה שנשארת';if(fail)env.calls[0].reject(Error('provider unavailable'));else env.calls[0].resolve(digital('תוצר ישן'));await first;assert.match(env.dialog(),/עריכה שנשארת/);assert.doesNotMatch(env.dialog(),/תוצר ישן|התוצר לא הופק/);}
});
test('Closing, resetting, reopening saved products or changing identity invalidates pending generation',async()=>{
  for(const action of ['close','reset','reopen','owner']){const env=page();await startDigital(env,'תוצר קיים');const before=env.dialog();const pending=env.byId('bBuild').fire('click');if(action==='close')env.byId('dlgX').fire('click');if(action==='reset')env.byId('bReset').fire('click');if(action==='reopen')env.byId('bSaved').fire('click');if(action==='owner')env.owner('B');env.calls.at(-1).resolve(digital('תשובה מאוחרת'));await pending;assert.equal(env.dialog(),before,action);assert.doesNotMatch(env.dialog(),/תשובה מאוחרת/);if(action==='close')assert.equal(env.byId('dlg').open,false);}
});
test('Owner A/B/A isolates saved products, preserves legacy data and passes the run signal to the local AI origin',async()=>{
  const storage=new Map([['sbe.conversationplanner.saved.v1','[{"private":"legacy"}]']]);const env=page(storage);await startDigital(env,'פרטי A');assert.equal(env.calls[0].server,'http://localhost:8124');assert.ok(env.calls[0].options?.signal);env.clickText('שמירה',env.byId('dlgB'));env.owner('B');env.clickText('נשמר',env.byId('dlgB'));assert.match(env.dialog(),/לא נשמר.*כניסה/);
  const b=page(storage);b.owner('B');const archiveB=b.context.SBE_PLANNER.createArchive('sbe.conversationplanner.saved.v2');assert.equal(archiveB.list().length,0);const again=page(storage);again.byId('bSaved').fire('click');again.clickText('טיוטת הודעה');assert.match(again.document.body.textContent,/פרטי A/);assert.equal(storage.get('sbe.conversationplanner.saved.v1'),'[{"private":"legacy"}]');
});
test('Editing the visible product aborts pending work and its late reply leaves the edited text intact',async()=>{
  const env=page();await startDigital(env,'קיים');const pending=env.byId('bBuild').fire('click');assert.equal(env.byId('bBuild').disabled,true);const box=env.byId('dlgB').querySelector('.draftbox');box.textContent='עריכה בזמן הפקה';box.fire('input',{bubbles:true});assert.equal(env.calls[1].options.signal.aborted,true);env.calls[1].resolve(digital('מאוחר'));await pending;assert.match(env.dialog(),/עריכה בזמן הפקה/);assert.doesNotMatch(env.dialog(),/מאוחר/);
});
test('After identity changes, new work on the old form refuses to send its previous owner fields',async()=>{
  const env=page();env.owner('B');const pending=env.byId('bBuild').fire('click');assert.equal(env.calls.length,0);await pending;assert.match(env.byId('hint').textContent,/כניסה.*השתנתה/);await env.byId('bSuggest').fire('click');assert.equal(env.calls.length,0);
});
