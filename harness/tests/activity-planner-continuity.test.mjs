import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const page=readFileSync(new URL('../../app/activity-planner.html',import.meta.url),'utf8');
const helper=readFileSync(new URL('../../app/lib/planner-continuity.js',import.meta.url),'utf8');
const part=(from,to)=>page.slice(page.indexOf(from),page.indexOf(to,page.indexOf(from)));
class Text {constructor(text){this.nodeType=3;this.textContent=String(text);}}
class Node {
  constructor(tag){this.nodeType=1;this.tagName=tag.toUpperCase();this.childNodes=[];this.attrs=new Map();this.listeners=new Map();this.style={};this.value='';this.classList={add(){},remove(){},toggle(){}};}
  append(...xs){xs.flat().forEach(x=>{if(x==null)return;const n=typeof x==='object'?x:new Text(x);n.parentNode=this;this.childNodes.push(n);});}
  prepend(...xs){const old=this.childNodes;this.childNodes=[];this.append(...xs);this.childNodes.push(...old);}
  get textContent(){return this.childNodes.map(x=>x.textContent).join('');}
  set textContent(x){this.childNodes=[];if(x)this.append(String(x));}
  set className(x){this.setAttribute('class',x);}get className(){return this.getAttribute('class')||'';}
  get innerHTML(){return this.childNodes.map(x=>x.nodeType===3?x.textContent.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])):x.outerHTML).join('');}
  get outerHTML(){return `<${this.tagName.toLowerCase()}>${this.innerHTML}</${this.tagName.toLowerCase()}>`;}
  setAttribute(k,v){this.attrs.set(k,String(v));}getAttribute(k){return this.attrs.get(k)??null;}
  addEventListener(k,fn){const a=this.listeners.get(k)||[];a.push(fn);this.listeners.set(k,a);}
  async fire(k){for(const fn of this.listeners.get(k)||[])await fn({target:this});}
  querySelector(q){return descendants(this).find(x=>q[0]==='#'?x.getAttribute('id')===q.slice(1):x.tagName===q.toUpperCase())||null;}
  querySelectorAll(q){return descendants(this).filter(x=>x.tagName===q.toUpperCase());}
  showModal(){this.open=true;}close(){this.open=false;void this.fire('close');}remove(){if(this.parentNode)this.parentNode.childNodes=this.parentNode.childNodes.filter(x=>x!==this);}focus(){}
}
const descendants=n=>n.childNodes.filter(x=>x.nodeType===1).flatMap(x=>[x,...descendants(x)]);
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
function environment(){
  const ids=new Map(),storage=new Map(),printed=[],responses=[];let owner='A',failWrite=false,serial=0;
  const document={body:new Node('body'),createElement:t=>new Node(t),createTextNode:t=>new Text(t),
    getElementById:id=>{const found=descendants(document.body).find(x=>x.getAttribute('id')===id);if(found)return found;if(!ids.has(id)){const n=new Node(id==='dlg'?'dialog':'div');n.setAttribute('id',id);ids.set(id,n);}return ids.get(id);},querySelectorAll:()=>[]};
  ['dlgB','dlgF','dlgH'].forEach(id=>document.getElementById('dlg').append(document.getElementById(id)));document.body.append(document.getElementById('dlg'));
  const el=(tag,attrs={},...xs)=>{const n=document.createElement(tag);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v));n.append(...xs);return n;};
  const window={sbeUserKey:k=>k+':'+owner,crypto:{randomUUID:()=>`product-${++serial}`},navigator:{locks:{request:(_name,callback)=>Promise.resolve().then(callback)}},addEventListener(){},scrollTo(){},SBE_DOC:{editable:n=>{n.setAttribute('contenteditable','true');return n;},print:x=>printed.push(x)}};
  const localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>{if(failWrite)throw Error('quota');storage.set(k,v);}};
  const fields=new Map(['goal','smart','domain','opening','mainActivity'].map(k=>[k,{k}]));
  const ctx=vm.createContext({window,document,localStorage,AbortController,DOMException,Date,console:{warn(){}},setTimeout:()=>0,clearTimeout(){},el,SBE_DOC:window.SBE_DOC,FIELDS:fields,GROUPS:[],SMART_ITEMS:[],state:{},smartFields:new Map(),selectFields:new Map(),NO_MODEL:'אין חיבור',SBE_CREDIT:'Begood',str:x=>String(x??'').trim(),val:k=>document.getElementById('i-'+k).value.trim(),smartLines:x=>x,
    syncAllCardVisuals(){},refresh(){},renderIdeas(){},setAIStatus(){},confirm:()=>true,normalize:x=>JSON.parse(JSON.stringify(x)),emptySub:()=>({t:'',min:''}),emptySession:()=>({main:'',subs:[]}),emptySeq:()=>({creator:'',goals:[''],sessions:[{main:'',subs:[]}]}),props:new Set(),seq:{creator:'א',topic:'רצף',goals:['מטרה'],sessions:[{main:'א',subs:[]},{main:'',subs:[]}]},snapshot:null,openSess:new Set([0]),renderSeq(){},updateStatus(){},isEmptySession:s=>!s.main,missingRequired:()=>[],mechanicalChecks:()=>[],mockNote:t=>el('p',{},t),safeName:()=> 'synthetic',CHUNK:4,PARALLEL:4,CHUNK_TOKENS:100,CHUNK_TIMEOUT:1000,MAX_GOALS:5,preamble:()=>'',planForAI:()=>JSON.parse(JSON.stringify(ctx.seq)),parseJSON:JSON.parse,
    SESSION_SCHEMA:'synthetic schema',TIME_RULE:'synthetic time',isEmptySub:x=>!x.t&&!x.min,
    callAI:async(...args)=>{responses.push(args);return await ctx.next.promise;},synthesizeActivityNarrative:async()=>{responses.push('single narrative');return await ctx.next.promise;},
    buildNarrativeDocView:(d,c,n)=>el('article',{},el('table',{},el('tr',{},el('td',{},n.paragraphs[0])))),buildCardView:d=>el('article',{},d.opening||'כרטיס'),next:deferred(),loadLibrary:async()=>[],libCatalog:()=>'',
    btn:(t,fn,cls)=>{const n=el('button',{},t);n.addEventListener('click',fn);return n;},seqDialog:(t,body,tools=[])=>{ctx.shown={title:t,body,tools};},shown:null,busy:(b,t)=>{b.disabled=true;return()=>{b.disabled=false;};},frameOf:()=>el('iframe'),seqDocHTML:()=>'<article>תוצר</article>',printFrame(){},downloadHTML:(...args)=>{ctx.download=args;},today:()=> '2026-10-08',location:{href:''}});
  vm.runInContext(helper,ctx);ctx.SBE_PLANNER=window.SBE_PLANNER;ctx.singleArchive=window.SBE_PLANNER.createArchive('sbe.activityplanner.saved.v2');ctx.seqArchive=window.SBE_PLANNER.createArchive('sbe.seqplanner.saved.v2');ctx.PLANNER_OWNER=window.sbeUserKey('sbe.activityplanner.owner');
  ctx.singleWork=window.SBE_PLANNER.createWork(()=>Object.fromEntries([...fields.keys()].map(k=>[k,ctx.val(k)])));
  ctx.seqWork=window.SBE_PLANNER.createWork(()=>({seq:ctx.seq,importText:document.getElementById('sqDocText').value,importCount:document.getElementById('sqDocN').value,question:document.getElementById('sqQ').value}));
  ctx.SAVED_KEY='oldScoped';ctx.DRAFT_KEY=window.sbeUserKey('sbe.seqplanner.draft.v1');ctx.saveTimer=null;ctx.touch=human=>{if(human!==false)ctx.seqWork.invalidate();};
  vm.runInContext(part('let invalidateSequence','function syncCardVisual(k)'),ctx);
  return{ctx,document,storage,printed,responses,el,setOwner:x=>owner=x,setFailWrite:x=>failWrite=x,run:code=>vm.runInContext(code,ctx)};
}
function single(env){env.run(part('document.getElementById("bBuild").addEventListener','// ── מצב 2:'));env.run(part('document.getElementById("bReset").addEventListener','// ── משוב היוריסטי'));}
function sequence(env){env.run(part('invalidateSequence = () => seqWork.invalidate()','let saveTimer = null'));env.run(part('function busy(b, text','function mockNote(text)'));env.run(part('function getP(path)','function fieldState(path)'));env.run('function parseSmart(){return {};}');env.run(part('function ranges(n)','// ספריית המקורות המאומתת'));env.run(part('// ── מיזוג תוצאות המודל','// ── ייבוא מסמך תכנון קיים'));}

test('Single activity saves actual edited document/card, prints them and preserves version history on reopen',async()=>{
  const e=environment();single(e);e.document.getElementById('i-goal').value='מטרה';e.document.getElementById('i-opening').value='מקור';
  e.ctx.next.resolve({title:'תוצר',paragraphs:['נוסח AI'],prepare:[]});await e.document.getElementById('bBuild').fire('click');
  const products=descendants(e.document.getElementById('dlgB')).filter(n=>n.getAttribute('contenteditable')==='true');assert.equal(products.length,2);
  products[0].querySelector('td').textContent='נוסח שערכתי\nבחירה';products[1].textContent='כרטיס שערכתי';
  const buttons=descendants(e.document.getElementById('dlgF')).filter(n=>n.tagName==='BUTTON');await buttons.find(n=>/שמירה/.test(n.textContent)&&!/PDF/.test(n.textContent)).fire('click');
  const records=e.ctx.singleArchive.list();assert.equal(records.length,1);assert.match(e.ctx.singleArchive.restore(records[0]).map(n=>n.textContent).join(' '),/נוסח שערכתי\nבחירה.*כרטיס שערכתי/);
  products[0].querySelector('td').textContent='גרסה שנייה';await buttons.find(n=>/נשמר/.test(n.textContent)).fire('click');assert.equal(e.ctx.singleArchive.list()[0].version,2);
  assert.match(e.ctx.singleArchive.restore(e.ctx.singleArchive.list()[0].history[0]).map(n=>n.textContent).join(' '),/נוסח שערכתי/);await buttons[0].fire('click');assert.match(e.printed[0].nodes.map(n=>n.textContent).join(' '),/גרסה שנייה.*כרטיס שערכתי/);assert.equal(e.storage.has('sbe.activityplanner.saved.v1'),false);
});
test('Single build ignores success or failure after reset and cannot replace a newer product',async()=>{
  const e=environment();single(e);e.document.getElementById('i-goal').value='ישן';const pending=e.document.getElementById('bBuild').fire('click');await e.document.getElementById('bReset').fire('click');
  e.ctx.next.resolve({paragraphs:['מאוחר']});await pending;assert.equal(e.document.getElementById('dlg').open,undefined);assert.equal(e.document.getElementById('dlgB').textContent,'');
  e.document.getElementById('i-goal').value='א';e.ctx.next=deferred();const a=e.document.getElementById('bBuild').fire('click'),old=e.ctx.next;
  e.document.getElementById('i-goal').value='ב';e.ctx.next=deferred();const b=e.document.getElementById('bBuild').fire('click');e.ctx.next.resolve({paragraphs:['נוסח ב']});await b;old.reject(Error('old failure'));await a;assert.match(e.document.getElementById('dlgB').textContent,/נוסח ב/);
});
test('Sequence deletion/reset rejects a late fill while owned incremental chunks can continue',async()=>{
  const e=environment();sequence(e);e.ctx.seq.sessions=[{main:'',subs:[]},{main:'',subs:[]}];const pending=e.document.getElementById('bSeqFill').fire('click');e.run('seq.sessions.splice(0,1);touch();');e.ctx.next.resolve(JSON.stringify({sessions:[{n:1,main:'מילוי מאוחר'}]}));await pending;assert.equal(e.ctx.seq.sessions.length,1);assert.equal(e.ctx.seq.sessions[0].main,'');assert.equal(e.ctx.shown,null);assert.equal(e.responses.length,1);
  e.ctx.next=deferred();const p=e.document.getElementById('bSeqFill').fire('click');await e.document.getElementById('bSeqReset').fire('click');e.ctx.next.resolve(JSON.stringify({sessions:[{n:1,main:'מילוי אחרי ניקוי'}]}));await p;assert.equal(e.ctx.seq.sessions[0].main,'');
  e.ctx.seq.sessions=Array.from({length:5},()=>({main:'',subs:[]}));e.ctx.callAI=async(_s,user)=>{const p=JSON.parse(user.split('\n')[1]);const n=p.sessions.length;return JSON.stringify({sessions:Array.from({length:n},(_,i)=>({n:i+1,main:'תוכן '+(i+1)}))});};
  await e.document.getElementById('bSeqFill').fire('click');assert.equal(e.ctx.seq.sessions.filter(s=>s.main).length,5);
});
test('Sequence improved proposal keeps comparison and declines adoption after a newer human edit',async()=>{
  const e=environment();sequence(e);e.ctx.next.resolve(JSON.stringify({plan:{sessions:[{n:1,main:'הצעת AI'},{n:2,main:'שני'}]},changes:[]}));await e.document.getElementById('bSeqImprove').fire('click');assert.match(e.ctx.shown.body.textContent,/הנוסח שלך.*א.*נוסח משופר.*הצעת AI/);
  e.run("seq.sessions[0].main='עריכה חדשה';touch();");await e.ctx.shown.tools[0].fire('click');assert.equal(e.ctx.seq.sessions[0].main,'עריכה חדשה');assert.equal(e.ctx.snapshot,null);
});

test('Fresh sequence improvement can be adopted and undo restores the original plan',async()=>{
  const e=environment();sequence(e);e.ctx.next.resolve(JSON.stringify({plan:{sessions:[{n:1,main:'הצעת AI'},{n:2,main:'שני'}]},changes:[]}));await e.document.getElementById('bSeqImprove').fire('click');await e.ctx.shown.tools[0].fire('click');assert.equal(e.ctx.seq.sessions[0].main,'הצעת AI');assert.equal(e.ctx.snapshot.seq.sessions[0].main,'א');
  await e.document.getElementById('bSeqUndo').fire('click');assert.equal(e.ctx.seq.sessions[0].main,'א');assert.equal(e.ctx.snapshot,null);
});
test('Sequence document saves, reopens, prints and downloads the actual edited table without active pasted markup',async()=>{
  const e=environment();sequence(e);const article=e.el('article',{},e.el('h1',{},'כותרת'),e.el('table',{},e.el('tr',{},e.el('td',{},'לפני עריכה'))));
  e.ctx.DOMParser=class{parseFromString(){return{querySelector:()=>article};}};e.ctx.aiNarrative=async()=>({paragraphs:['תוכן']});e.ctx.docShell=(title,body)=>`<!doctype html><title>${title}</title><body>${body}</body>`;e.ctx.esc=s=>String(s||'').replace(/[&<>"']/g,'');e.document.getElementById('brandLogo').src='brand.png';
  await e.document.getElementById('bSeqBuild').fire('click');const doc=e.ctx.shown.body.querySelector('article');assert.equal(doc.getAttribute('contenteditable'),'true');doc.querySelector('td').textContent='נוסח רצף שערכתי\nשאלה משותפת';doc.append(e.el('script',{},'activeAttack()'));doc.querySelector('td').setAttribute('onclick','activeAttack()');
  e.setFailWrite(true);await e.ctx.shown.tools[1].fire('click');assert.match(e.ctx.shown.tools[1].textContent,/לא נשמר/);assert.equal(e.ctx.seqArchive.list().length,0);
  e.setFailWrite(false);await e.ctx.shown.tools[1].fire('click');let record=e.ctx.seqArchive.list()[0];assert.match(e.ctx.seqArchive.restore(record)[0].textContent,/נוסח רצף שערכתי\nשאלה משותפת/);assert.equal(e.ctx.seqArchive.restore(record)[0].querySelector('script'),null);
  doc.querySelector('td').textContent='גרסה נוספת';await e.ctx.shown.tools[1].fire('click');record=e.ctx.seqArchive.list()[0];assert.equal(record.version,2);assert.match(e.ctx.seqArchive.restore(record.history[0])[0].textContent,/נוסח רצף שערכתי/);
  await e.ctx.shown.tools[0].fire('click');assert.match(e.printed[0].nodes[0].textContent,/גרסה נוספת/);assert.equal(e.printed[0].nodes[0].querySelector('script'),null);await e.ctx.shown.tools[2].fire('click');assert.match(e.ctx.download[1],/גרסה נוספת/);assert.doesNotMatch(e.ctx.download[1],/activeAttack|onclick|<script/);assert.equal(e.storage.has('oldScoped'),false);
});
test('Owner switch blocks new AI submissions, saved-product writes and the captured sequence draft key',async()=>{
  const e=environment();single(e);sequence(e);e.run(part('function saveDraft()','function touch('));e.run('saveDraft();');const original=e.storage.get(e.ctx.DRAFT_KEY);e.setOwner('B');
  await e.document.getElementById('bBuild').fire('click');await e.document.getElementById('bSeqFill').fire('click');assert.equal(e.responses.length,0);assert.match(e.ctx.shown.body.textContent,/הכניסה.*רענן/);e.run("seq.creator='still A';saveDraft();");assert.equal(e.storage.get(e.ctx.DRAFT_KEY),original);assert.equal(e.storage.has('sbe.seqplanner.draft.v1:B'),false);assert.throws(()=>e.ctx.seqArchive.save({title:'A',nodes:[]}),/כניסה/);
  e.setOwner('A');e.run('saveDraft();');assert.match(e.storage.get(e.ctx.DRAFT_KEY),/still A/);
});
test('Sequence import and Q&A ignore late replies after input edits or reset',async()=>{
  const e=environment();sequence(e);e.ctx.MAX_SESSIONS=30;e.ctx.APPROACH_CARDS=[];e.ctx.PREF_ITEMS=[];e.ctx.LIMIT_ITEMS=[];e.ctx.AUDIENCE_OPTS=[];e.ctx.AGE_RANGE_OPTS=[];e.ctx.DOC_MAX_CHARS=60000;e.run(part('async function aiImportOutline','// ── דוגמה: השתלמות מורים'));
  e.document.getElementById('sqDocText').value='מסמך סינתטי';e.document.getElementById('sqDocN').value='2';const importing=e.document.getElementById('sqImportBtn').fire('click');e.run("seq.topic='עריכה חדשה';touch();");e.ctx.next.resolve(JSON.stringify({outline:[{title:'מאוחר'}]}));await importing;assert.equal(e.ctx.seq.topic,'עריכה חדשה');assert.equal(e.responses.length,1);
  e.ctx.next=deferred();e.document.getElementById('sqQ').value='שאלה על שלב';const asking=e.document.getElementById('sqAsk').fire('click');await e.document.getElementById('bSeqReset').fire('click');e.ctx.next.resolve('תשובה ישנה');await asking;assert.doesNotMatch(e.document.getElementById('sqAnswers').textContent,/תשובה ישנה/);assert.equal(e.document.getElementById('sqQ').value,'שאלה על שלב');
});
test('Superseding work releases its previous button while an old finally cannot unlock the newer request',async()=>{
  const e=environment();single(e);sequence(e);const build=e.document.getElementById('bBuild'),fill=e.document.getElementById('bSeqFill');
  const first=e.ctx.next,a=build.fire('click');assert.equal(build.disabled,true);e.ctx.next=deferred();const second=e.ctx.next,b=fill.fire('click');assert.equal(build.disabled,false);assert.equal(fill.disabled,true);
  first.resolve({paragraphs:['ישן']});await a;assert.equal(fill.disabled,true);e.ctx.next=deferred();const c=fill.fire('click');second.resolve(JSON.stringify({sessions:[{n:1,main:'ישן'}]}));await b;assert.equal(fill.disabled,true);e.ctx.next.resolve(JSON.stringify({sessions:[{n:1,main:'חדש'},{n:2,main:'חדש שני'}]}));await c;assert.equal(fill.disabled,false);assert.equal(e.ctx.seq.sessions[1].main,'חדש שני');
});
